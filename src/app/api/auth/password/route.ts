import bcrypt from "bcryptjs";
import { q } from "@/server/db";
import { HttpError, handle, issueSession, requireUser } from "@/server/session";
import { uid } from "@/lib/crypto";

export const dynamic = "force-dynamic";

/** تغيير كلمة المرور — لنفسك (بإدخال الحالية) أو لأي مستخدم إن كنت المدير. */
export function POST(req: Request) {
  return handle(async () => {
    const me = await requireUser();
    const { userId, current, next } = (await req.json()) as { userId: string; current: string | null; next: string };
    if (typeof next !== "string" || next.length < 8) throw new HttpError(400, "كلمة المرور يجب ألا تقل عن ٨ أحرف.");

    const self = userId === me.id;
    if (!self && me.role !== "admin") throw new HttpError(403, "هذه العملية للمدير فقط.");

    const [row] = await q(`select username, password_hash from users where id = $1`, [userId]);
    if (!row) throw new HttpError(404, "المستخدم غير موجود.");
    if (self && me.role !== "admin" && current === null) throw new HttpError(400, "أدخل كلمة المرور الحالية.");
    if (self && current !== null && !(await bcrypt.compare(String(current), String(row.password_hash))))
      throw new HttpError(400, "كلمة المرور الحالية غير صحيحة.");

    // رفع رقم الإصدار يُبطل كل الجلسات القديمة لهذا الحساب فورًا
    const [upd] = await q<{ pwv: number }>(
      `update users set password_hash = $2, pwv = pwv + 1 where id = $1 returning pwv`,
      [userId, await bcrypt.hash(next, 10)]
    );
    await q(`insert into audit_log (id, actor, action, detail) values ($1, $2, 'تغيير كلمة مرور', $3)`,
      [uid("a-"), me.username, row.username]);
    await q(`update revs set rev = rev + 1 where table_name = 'audit_log'`);
    if (self) await issueSession(me.id, Number(upd.pwv));
    return Response.json({ ok: true });
  });
}
