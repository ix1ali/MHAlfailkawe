import bcrypt from "bcryptjs";
import { q } from "@/server/db";
import { HttpError, handle, issueSession, toMe, userCols } from "@/server/session";
import { ensureReady } from "@/server/schema";
import { uid } from "@/lib/crypto";

export const dynamic = "force-dynamic";

const MAX_ATTEMPTS = 5;
const LOCK_SECONDS = 90;
// تجزئة وهمية حتى لا يكشف زمنُ الرد وجودَ اسم المستخدم من عدمه
const DECOY = "$2b$10$CwTycUXWue0Thq9StjUM0uJ8.cH0V1eW8yY9Zt1b3S0q1vS2Qm0dW";

export function POST(req: Request) {
  return handle(async () => {
    await ensureReady();
    const { username, password } = (await req.json()) as { username?: string; password?: string };
    const uname = String(username ?? "").trim().toLowerCase();
    if (!uname || !password) throw new HttpError(400, "أدخل اسم المستخدم وكلمة المرور.");

    const [lock] = await q<{ fails: number; locked_until: string | null }>(
      `select fails, locked_until from login_attempts where username = $1`, [uname]
    );
    if (lock?.locked_until && new Date(lock.locked_until).getTime() > Date.now()) {
      const wait = Math.ceil((new Date(lock.locked_until).getTime() - Date.now()) / 1000);
      return Response.json({ error: `تم إيقاف المحاولات مؤقتًا. حاول بعد ${wait} ثانية.`, waitSeconds: wait }, { status: 429 });
    }

    const [row] = await q(`select ${userCols}, password_hash, pwv from users where username = $1`, [uname]);
    const ok = await bcrypt.compare(password, row ? String(row.password_hash) : DECOY);

    if (!row || !ok) {
      const fails = (lock?.fails ?? 0) + 1;
      const locked = fails >= MAX_ATTEMPTS;
      await q(
        `insert into login_attempts (username, fails, locked_until) values ($1, $2, $3)
         on conflict (username) do update set fails = excluded.fails, locked_until = excluded.locked_until`,
        [uname, locked ? 0 : fails, locked ? new Date(Date.now() + LOCK_SECONDS * 1000) : null]
      );
      const left = MAX_ATTEMPTS - fails;
      throw new HttpError(401, left > 0
        ? `اسم المستخدم أو كلمة المرور غير صحيحة. المحاولات المتبقية: ${left}`
        : `تم إيقاف المحاولات ${LOCK_SECONDS} ثانية بعد ${MAX_ATTEMPTS} محاولات فاشلة.`);
    }
    if (row.active === false) throw new HttpError(403, "هذا الحساب موقوف. راجع المدير.");

    await q(`delete from login_attempts where username = $1`, [uname]);
    await q(`update users set last_login_at = now() where id = $1`, [row.id]);
    await q(
      `insert into audit_log (id, actor, action, detail) values ($1, $2, 'تسجيل دخول', $3)`,
      [uid("a-"), row.username, row.display_name]
    );
    await q(`update revs set rev = rev + 1 where table_name in ('users', 'audit_log')`);
    await issueSession(String(row.id), Number(row.pwv));
    return Response.json({ user: toMe({ ...row, last_login_at: new Date() }) });
  });
}
