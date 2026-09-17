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

export const DATABASE_URL =
  process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL || "";

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
