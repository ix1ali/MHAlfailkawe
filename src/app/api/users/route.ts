import bcrypt from "bcryptjs";
import { q, tx } from "@/server/db";
import { HttpError, handle, requireUser } from "@/server/session";
import { uid } from "@/lib/crypto";

export const dynamic = "force-dynamic";

const ROLES = ["admin", "viewer", "guard"];

/** إنشاء حساب — للمدير فقط. */
export function POST(req: Request) {
  return handle(async () => {
    const me = await requireUser();
    if (me.role !== "admin") throw new HttpError(403, "هذه العملية للمدير فقط.");
    const b = (await req.json()) as {
      username: string; password: string; displayName: string; role: string;
      phone?: string; buildingIds?: string[] | "all" | null;
    };
    const uname = String(b.username ?? "").trim().toLowerCase();
    if (!/^[a-z0-9_.-]{3,20}$/.test(uname)) throw new HttpError(400, "اسم المستخدم غير صالح (٣–٢٠ حرفًا إنجليزيًا أو أرقامًا).");
    if (String(b.password ?? "").length < 8) throw new HttpError(400, "كلمة المرور قصيرة.");
    if (!ROLES.includes(b.role)) throw new HttpError(400, "دور غير معروف.");
    const ids = Array.isArray(b.buildingIds) ? b.buildingIds : null;
    if (b.role === "guard" && !ids?.length) throw new HttpError(400, "اختر عمارة واحدة على الأقل للحارس.");

    const [exists] = await q(`select 1 from users where username = $1`, [uname]);
    if (exists) throw new HttpError(409, "اسم المستخدم محجوز.");

    await tx(async (c) => {
      await c.query(
        `insert into users (id, username, display_name, role, phone, building_ids, password_hash)
         values ($1, $2, $3, $4, $5, $6, $7)`,
        [uid("u-"), uname, String(b.displayName ?? "").trim() || uname, b.role, b.phone || null,
         b.role === "guard" ? ids : null, await bcrypt.hash(b.password, 10)]
      );
      await c.query(`insert into audit_log (id, actor, action, detail) values ($1, $2, 'إضافة مستخدم', $3)`,
        [uid("a-"), me.username, uname]);
      await c.query(`update revs set rev = rev + 1 where table_name in ('users', 'audit_log')`);
    });
    return Response.json({ ok: true });
  });
}

/** حذف حساب نهائيًا — للمدير فقط، ولا يُحذف آخر مدير ولا حسابك أنت. */
export function DELETE(req: Request) {
  return handle(async () => {
    const me = await requireUser();
    if (me.role !== "admin") throw new HttpError(403, "هذه العملية للمدير فقط.");
    const id = new URL(req.url).searchParams.get("id") ?? "";
    if (id === me.id) throw new HttpError(400, "لا يمكنك حذف حسابك.");
    const [target] = await q(`select username, role from users where id = $1`, [id]);
    if (!target) throw new HttpError(404, "المستخدم غير موجود.");
    if (target.role === "admin") {
      const [{ n }] = await q<{ n: number }>(`select count(*)::int n from users where role = 'admin' and active`);
      if (n <= 1) throw new HttpError(400, "يجب بقاء مدير واحد على الأقل.");
    }
    await tx(async (c) => {
      await c.query(`delete from users where id = $1`, [id]);
      await c.query(`insert into audit_log (id, actor, action, detail) values ($1, $2, 'حذف مستخدم', $3)`,
        [uid("a-"), me.username, target.username]);
      await c.query(`update revs set rev = rev + 1 where table_name in ('users', 'audit_log')`);
    });
    return Response.json({ ok: true });
  });
}
