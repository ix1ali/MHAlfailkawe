import { DATABASE_URL, dbEnvNames, q } from "@/server/db";
import { ensureReady } from "@/server/schema";
import { handle } from "@/server/session";

export const dynamic = "force-dynamic";

/**
 * فحص سريع لحالة الخادم وقاعدة البيانات — يفتحه المدير عند تعذّر الدخول.
 * لا يكشف أي سرّ: أسماء المتغيّرات فقط، بلا قيمها، وبلا أي بيانات.
 */
export function GET() {
  return handle(async () => {
    const env = dbEnvNames();
    if (!DATABASE_URL) {
      return Response.json(
        {
          ok: false,
          database: "غير مربوطة",
          hint: "اربط قاعدة Neon بالمشروع من Vercel ← Storage، ثم أعد النشر (Redeploy).",
          envNames: env,
        },
        { status: 503 }
      );
    }
    await ensureReady();
    // زمن استعلام تافه: يكشف بُعد الخادم عن قاعدة البيانات
    const t0 = Date.now();
    await q(`select 1`);
    const pingMs = Date.now() - t0;
    const t1 = Date.now();
    await q(`select 1`);
    const ping2Ms = Date.now() - t1;
    const dbRegion = /@[^/]*?\.([a-z]+-[a-z]+-\d)\./.exec(DATABASE_URL)?.[1] ?? "?";

    const [{ n }] = await q<{ n: number }>(`select count(*)::int n from users`);
    const [{ b }] = await q<{ b: number }>(`select count(*)::int b from buildings`);
    const roles = await q<{ role: string; n: number }>(`select role, count(*)::int n from users group by role`);
    return Response.json({
      ok: true,
      database: "متصلة",
      users: n,
      buildings: b,
      roles: Object.fromEntries(roles.map((r) => [r.role, r.n])),
      dbRegion,
      serverRegion: process.env.VERCEL_REGION ?? "local",
      pingMs,
      ping2Ms,
      version: (process.env.VERCEL_GIT_COMMIT_SHA ?? "local").slice(0, 7),
      envNames: env,
    });
  });
}
