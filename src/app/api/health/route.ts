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
    const [{ n }] = await q<{ n: number }>(`select count(*)::int n from users`);
    const [{ b }] = await q<{ b: number }>(`select count(*)::int b from buildings`);
    return Response.json({ ok: true, database: "متصلة", users: n, buildings: b, envNames: env });
  });
}
