"use client";

import { api } from "./cloud";

/**
 * ملفات المستندات (صور البطاقة المدنية، العقود…) وصور العمارات.
 *
 * تُحفظ في قاعدة البيانات نفسها في مخزن خاص، ولا تُعرض إلا لمستخدم مسجّل الدخول.
 * الصور تُصغَّر على الجهاز قبل الرفع فتبقى خفيفة وسريعة.
 */
const path = (id: string) => `/api/files/${encodeURIComponent(id)}`;

const MAX_BYTES = 4_000_000;

/** المستندات: دقة عالية تكفي لقراءة البطاقة المدنية. */
const DOC = { side: 2200, quality: [0.85, 0.72, 0.6], max: MAX_BYTES, skipUnder: 700_000 };
/** صور العمارات: تُعرض بعرض الشاشة فقط، فلا داعي لأكثر من ذلك. */
const PHOTO = { side: 1280, quality: [0.72, 0.62, 0.5], max: 220_000, skipUnder: 0 };

const isImage = (f: Blob) =>
  f.type.startsWith("image/") && f.type !== "image/gif" && f.type !== "image/svg+xml";

async function draw(file: Blob, side: number) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, side / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) { bmp.close(); return null; }
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  return canvas;
}

/** يصغّر الصورة حسب الغرض، ويعيدها كما هي إن تعذّر ذلك. */
async function shrink(file: Blob, opt: typeof DOC): Promise<Blob> {
  if (!isImage(file)) return file;
  if (opt.skipUnder && file.size < opt.skipUnder) return file;
  try {
    const canvas = await draw(file, opt.side);
    if (!canvas) return file;
    let last: Blob | null = null;
    for (const quality of opt.quality) {
      const out = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", quality));
      if (!out) break;
      last = out;
      if (out.size <= opt.max) break;
    }
    if (last && last.size < file.size) return last;
  } catch { /* صيغة لا يفكّها المتصفح — تُرفع كما هي */ }
  return file;
}

/**
 * معاينة مصغّرة جدًا تُحفظ مع بيانات العمارة نفسها (بضع مئات من البايتات).
 * تُرسم فور فتح الصفحة قبل وصول الصورة الحقيقية، فلا يبقى مكانها فارغًا.
 */
export async function makeBlur(file: Blob): Promise<string | undefined> {
  if (!isImage(file)) return undefined;
  try {
    const canvas = await draw(file, 20);
    if (!canvas) return undefined;
    const out = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.5));
    if (!out || out.size > 2000) return undefined;
    return await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.onerror = rej;
      r.readAsDataURL(out);
    });
  } catch {
    return undefined;
  }
}

async function upload(id: string, body: Blob) {
  if (body.size > MAX_BYTES) throw new Error("الملف أكبر من ٤ ميغابايت.");
  await api(path(id), {
    method: "PUT",
    body,
    headers: { "Content-Type": body.type || "application/octet-stream" },
  });
}

/** مستند عادي. */
export async function putBlob(id: string, file: Blob): Promise<void> {
  await upload(id, await shrink(file, DOC));
}

/** صورة واجهة عمارة: مفتاح جديد لكل رفع، فتُخزَّن في المتصفح للأبد بلا إعادة تحميل. */
export async function putPhoto(buildingId: string, file: Blob): Promise<{ key: string; blur?: string }> {
  const key = `bldv-${buildingId}-${Date.now().toString(36)}`;
  const [small, blur] = await Promise.all([shrink(file, PHOTO), makeBlur(file)]);
  await upload(key, small);
  return { key, blur };
}

/** رابط عرض الملف — للصور وملفات PDF داخل الصفحة. الجلسة تُرسل تلقائيًا. */
export async function blobUrl(id: string): Promise<string | null> {
  return path(id);
}

/** رابط مباشر بلا انتظار — الملف يُطلب من نفس النطاق بجلسة المستخدم. */
export const fileUrl = (id: string) => path(id);

export async function openBlob(id: string, fileName: string): Promise<void> {
  const a = document.createElement("a");
  a.href = `${path(id)}?download=${encodeURIComponent(fileName)}`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function delBlob(id: string): Promise<void> {
  await api(path(id), { method: "DELETE" });
}
