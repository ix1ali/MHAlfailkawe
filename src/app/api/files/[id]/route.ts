import { q } from "@/server/db";
import { HttpError, handle, requireUser } from "@/server/session";
import { canUpload } from "@/server/access";

export const dynamic = "force-dynamic";

/** أقصى حجم للملف بعد الضغط — حدّ الطلب على Vercel ٤٫٥ ميغا. */
const MAX_BYTES = 4_200_000;
const safeId = (id: string) => {
  if (!/^[\w.-]{1,120}$/.test(id)) throw new HttpError(400, "معرّف غير صالح.");
  return id;
};

/** عرض الملف أو تنزيله — لأي مستخدم مسجّل الدخول. */
export function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requireUser();
    const id = safeId((await ctx.params).id);
    const [f] = await q<{ mime: string; data: Buffer }>(`select mime, data from files where id = $1`, [id]);
    if (!f) throw new HttpError(404, "الملف غير موجود.");
    const download = new URL(req.url).searchParams.get("download");
    const headers: Record<string, string> = {
      "Content-Type": f.mime || "application/octet-stream",
      "Cache-Control": "private, max-age=600",
      "X-Content-Type-Options": "nosniff",
    };
    if (download) headers["Content-Disposition"] = `attachment; filename*=UTF-8''${encodeURIComponent(download)}`;
    return new Response(new Uint8Array(f.data), { headers });
  });
}

/** رفع ملف (المحتوى الخام في جسم الطلب). */
export function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireUser();
    if (!canUpload(me)) throw new HttpError(403, "لا تملك صلاحية رفع الملفات.");
    const id = safeId((await ctx.params).id);
    const buf = Buffer.from(await req.arrayBuffer());
    if (!buf.length) throw new HttpError(400, "الملف فارغ.");
    if (buf.length > MAX_BYTES) throw new HttpError(413, "الملف أكبر من ٤ ميغابايت.");
    const mime = (req.headers.get("content-type") || "application/octet-stream").slice(0, 100);
    await q(
      `insert into files (id, mime, size, data) values ($1, $2, $3, $4)
       on conflict (id) do update set mime = excluded.mime, size = excluded.size, data = excluded.data, created_at = now()`,
      [id, mime, buf.length, buf]
    );
    return Response.json({ ok: true });
  });
}

export function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireUser();
    if (!canUpload(me)) throw new HttpError(403, "لا تملك صلاحية حذف الملفات.");
    const id = safeId((await ctx.params).id);
    await q(`delete from files where id = $1`, [id]);
    return Response.json({ ok: true });
  });
}
