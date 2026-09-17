import "server-only";
import { Pool, types, type PoolClient } from "pg";

/**
 * الاتصال بقاعدة البيانات (Neon Postgres).
 *
 * عند ربط Neon من لوحة Vercel يُضاف DATABASE_URL تلقائيًا.
 * للتشغيل المحلي يكفي أي Postgres، أو `npm run db:local`.
 */

// التواريخ تبقى نصًا كما هي (YYYY-MM-DD) فلا تنزاح بفارق التوقيت
types.setTypeParser(1082, (v) => v);
// الأرقام العشرية والكبيرة تُعاد أرقامًا لا نصوصًا
types.setTypeParser(1700, (v) => parseFloat(v));
types.setTypeParser(20, (v) => parseInt(v, 10));

/**
 * يقبل أي اسم يضعه تكامل Neon/Vercel للرابط (DATABASE_URL أو POSTGRES_URL
 * أو باسم مسبوق بلاحقة المخزن)، فلا يتعطّل النظام لاختلاف التسمية.
 * يُفضَّل الرابط المجمَّع (pooler) لأنه الأنسب للدوال بلا خادم.
 */
export const DATABASE_URL = (() => {
  const named = ["DATABASE_URL", "POSTGRES_URL", "NEON_DATABASE_URL", "POSTGRES_PRISMA_URL"];
  const isPg = (v?: string) => !!v && /^postgres(ql)?:\/\//.test(v);
  for (const k of named) if (isPg(process.env[k])) return process.env[k]!;

  const found = Object.entries(process.env)
    .filter(([k, v]) => isPg(v) && /url|uri/i.test(k) && !/UNPOOLED|NO_SSL|NON_?POOL/i.test(k))
    .map(([, v]) => v!);
  if (found.length) return found.find((v) => /-pooler\./.test(v)) ?? found[0];

  // آخر محاولة: حتى الرابط غير المجمَّع خير من لا شيء
  return Object.values(process.env).find(isPg) ?? "";
})();

/** أسماء متغيّرات البيئة التي تحمل رابط قاعدة بيانات — للتشخيص فقط، بلا قيم. */
export const dbEnvNames = () =>
  Object.entries(process.env)
    .filter(([, v]) => /^postgres(ql)?:\/\//.test(v ?? ""))
    .map(([k]) => k);

const g = globalThis as unknown as { __aqarPool?: Pool };

export function pool(): Pool {
  if (!DATABASE_URL) throw new Error("no-database");
  if (!g.__aqarPool) {
    const local = /localhost|127\.0\.0\.1/.test(DATABASE_URL);
    g.__aqarPool = new Pool({
      connectionString: DATABASE_URL,
      max: Number(process.env.PG_POOL_MAX || (local ? 1 : 5)),
      idleTimeoutMillis: 10_000,
      ssl: local ? false : { rejectUnauthorized: false },
    });
  }
  return g.__aqarPool;
}

export async function q<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const r = await pool().query(sql, params);
  return r.rows as T[];
}

export async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool().connect();
  try {
    await c.query("begin");
    const out = await fn(c);
    await c.query("commit");
    return out;
  } catch (e) {
    try { await c.query("rollback"); } catch {}
    throw e;
  } finally {
    c.release();
  }
}
