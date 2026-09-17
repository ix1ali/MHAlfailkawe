"use client";

import { api } from "./cloud";

/**
 * ملفات المستندات (صور البطاقة المدنية، العقود…) وصور العقارات.
 *
 * تُحفظ في قاعدة البيانات نفسها في مخزن خاص، ولا تُعرض إلا لمستخدم مسجّل الدخول.
 * الصور الكبيرة تُصغَّر على الجهاز قبل الرفع فتبقى خفيفة وسريعة.
 */
const path = (id: string) => `/api/files/${encodeURIComponent(id)}`;

const MAX_BYTES = 4_000_000;
const MAX_SIDE = 2200;

/** يصغّر الصورة إن كانت كبيرة — دقة كافية لقراءة البطاقة المدنية بوضوح. */
async function shrink(file: Blob): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.type === "image/svg+xml") return file;
  if (file.size < 700_000) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    for (const quality of [0.85, 0.72, 0.6]) {
      const out = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", quality));
      if (out && out.size <= MAX_BYTES) return out.size < file.size ? out : file;
    }
  } catch { /* صيغة لا يفكّها المتصفح — تُرفع كما هي */ }
  return file;
}

export async function putBlob(id: string, file: Blob): Promise<void> {
  const body = await shrink(file);
  if (body.size > MAX_BYTES) throw new Error("الملف أكبر من ٤ ميغابايت.");
  await api(path(id), {
    method: "PUT",
    body,
    headers: { "Content-Type": body.type || "application/octet-stream" },
  });
}

/** رابط عرض الملف — للصور وملفات PDF داخل الصفحة. الجلسة تُرسل تلقائيًا. */
export async function blobUrl(id: string): Promise<string | null> {
  return path(id);
}

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
