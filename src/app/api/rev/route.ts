import { q } from "@/server/db";
import { handle, requireUser } from "@/server/session";

export const dynamic = "force-dynamic";

/** عدّادات التغيير — طلب خفيف تسأل عنه الأجهزة كل بضع ثوانٍ. */
export function GET() {
  return handle(async () => {
    await requireUser();
    const rows = await q<{ table_name: string; rev: number }>(`select table_name, rev from revs`);
    return Response.json({ revs: Object.fromEntries(rows.map((r) => [r.table_name, Number(r.rev)])) });
  });
}
