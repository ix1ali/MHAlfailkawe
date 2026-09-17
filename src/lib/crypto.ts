// أدوات صغيرة للمعرّفات وقوة كلمة المرور. التجزئة الفعلية لكلمات المرور تتم على الخادم (bcrypt).

export const uid = (prefix = "") =>
  prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export interface PwStrength { score: 0 | 1 | 2 | 3 | 4; label: string; problems: string[] }

export function passwordStrength(pw: string): PwStrength {
  const problems: string[] = [];
  if (pw.length < 8) problems.push("٨ أحرف على الأقل");
  if (!/[a-z]/i.test(pw)) problems.push("حرف إنجليزي واحد على الأقل");
  if (!/[0-9]/.test(pw)) problems.push("رقم واحد على الأقل");
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  const labels = ["ضعيفة جدًا", "ضعيفة", "متوسطة", "قوية", "قوية جدًا"];
  return { score: Math.min(score, 4) as PwStrength["score"], label: labels[Math.min(score, 4)], problems };
}
