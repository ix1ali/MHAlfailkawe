import "server-only";
import { createHash } from "crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { DATABASE_URL, q } from "./db";
import { ensureReady } from "./schema";
import type { Role } from "@/lib/types";

export const COOKIE = "aqar_session";

export interface Me {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  /** null = كل العقارات */
  buildingIds: string[] | null;
  phone: string | null;
  active: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

/** مفتاح التوقيع: AUTH_SECRET إن ضُبط، وإلا يُشتقّ من رابط قاعدة البيانات السرّي. */
const secret = () =>
  new TextEncoder().encode(
    process.env.AUTH_SECRET || createHash("sha256").update(`aqar-session:${DATABASE_URL}`).digest("hex")
  );

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export const userCols = `id, username, display_name, role, phone, active, building_ids, created_at, last_login_at`;

export const toMe = (r: Record<string, unknown>): Me => ({
  id: String(r.id),
  username: String(r.username),
  displayName: String(r.display_name),
  role: r.role as Role,
  buildingIds: Array.isArray(r.building_ids) ? (r.building_ids as string[]) : null,
  phone: (r.phone as string) ?? null,
  active: r.active !== false,
  createdAt: r.created_at ? new Date(r.created_at as string).toISOString() : "",
  lastLoginAt: r.last_login_at ? new Date(r.last_login_at as string).toISOString() : null,
});

export async function issueSession(userId: string, pwv: number) {
  const [st] = await q<{ session_minutes: number }>(`select session_minutes from settings where id = 1`);
  const minutes = Math.max(30, st?.session_minutes ?? 43200);
  const token = await new SignJWT({ pwv })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${minutes}m`)
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: minutes * 60,
  });
}

export async function clearSession() {
  (await cookies()).delete(COOKIE);
}

/** المستخدم الحالي من الجلسة — أو null. يرفض الحساب الموقوف وكلمة المرور المتغيّرة. */
export async function currentUser(): Promise<Me | null> {
  await ensureReady();
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    const [row] = await q(`select ${userCols}, pwv from users where id = $1`, [payload.sub]);
    if (!row || row.active === false || Number(row.pwv) !== Number(payload.pwv)) return null;
    return toMe(row);
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<Me> {
  const me = await currentUser();
  if (!me) throw new HttpError(401, "انتهت الجلسة، سجّل الدخول مرة أخرى.");
  return me;
}

/** يحوّل أي خطأ إلى رد JSON بالعربية. */
export function handle(fn: () => Promise<Response>): Promise<Response> {
  return fn().catch((e: unknown) => {
    if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
    const m = (e as { message?: string; code?: string })?.message ?? "";
    const code = (e as { code?: string })?.code;
    if (m === "no-database")
      return Response.json({ error: "لم تُربط قاعدة البيانات بعد (DATABASE_URL)." }, { status: 503 });
    if (code === "23505") return Response.json({ error: "القيمة مسجّلة مسبقًا (تكرار)." }, { status: 409 });
    if (code === "23503") return Response.json({ error: "السجل مرتبط بسجل غير موجود." }, { status: 409 });
    console.error(e);
    return Response.json({ error: "حدث خطأ في الخادم." }, { status: 500 });
  });
}
