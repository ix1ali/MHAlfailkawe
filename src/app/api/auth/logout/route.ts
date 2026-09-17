import { q } from "@/server/db";
import { clearSession, currentUser, handle } from "@/server/session";
import { uid } from "@/lib/crypto";

export const dynamic = "force-dynamic";

export function POST() {
  return handle(async () => {
    const me = await currentUser();
    if (me) {
      await q(`insert into audit_log (id, actor, action, detail) values ($1, $2, 'تسجيل خروج', $3)`,
        [uid("a-"), me.username, me.displayName]);
      await q(`update revs set rev = rev + 1 where table_name = 'audit_log'`);
    }
    await clearSession();
    return Response.json({ ok: true });
  });
}
