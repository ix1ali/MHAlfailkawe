"use client";

import type { Role, User } from "./types";

/**
 * الاتصال بخادم النظام (واجهات /api) — قاعدة البيانات لا تُلمس من المتصفح أبدًا،
 * والجلسة في كعكة httpOnly لا تقرؤها السكربتات.
 */

/** النظام دائمًا مشترك عبر الخادم. */
export const CLOUD = true;

export const normalizeUsername = (u: string) => u.trim().toLowerCase();

export class ApiError extends Error {
  constructor(public status: number, message: string, public waitSeconds?: number) { super(message); }
}

/* ------------------------------------------------------------ الجلسة */

type Listener = (u: User | null) => void;
const listeners = new Set<Listener>();
let me: Promise<User | null> | null = null;

interface MeRow {
  id: string; username: string; displayName: string; role: Role; buildingIds: string[] | null;
  phone: string | null; active: boolean; createdAt: string; lastLoginAt: string | null;
}

export const toUser = (m: MeRow): User => ({
  id: m.id, username: m.username, displayName: m.displayName, role: m.role,
  salt: "", hash: "", active: m.active,
  buildingIds: m.buildingIds ?? "all",
  phone: m.phone ?? undefined, createdAt: m.createdAt, lastLoginAt: m.lastLoginAt ?? undefined,
});

/** المستخدم الحالي — يُسأل عنه الخادم مرة واحدة ويُحفظ الجواب. */
export function currentMe(): Promise<User | null> {
  if (!me) {
    me = fetch("/api/auth/me", { cache: "no-store", credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((j: { user: MeRow | null }) => (j.user ? toUser(j.user) : null))
      .catch(() => null);
  }
  return me;
}

export function setSession(u: User | null) {
  me = Promise.resolve(u);
  listeners.forEach((l) => l(u));
}

export function onSession(l: Listener) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

/* ------------------------------------------------------------ الطلبات */

export async function api<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(path, {
      cache: "no-store",
      credentials: "same-origin",
      ...rest,
      headers: json !== undefined ? { "Content-Type": "application/json", ...headers } : headers,
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new ApiError(0, "تعذّر الاتصال بالخادم. تحقّق من الإنترنت.");
  }
  if (res.ok) return (res.headers.get("content-type")?.includes("json") ? res.json() : undefined) as Promise<T>;

  let body: { error?: string; waitSeconds?: number } = {};
  try { body = await res.json(); } catch {}
  if (res.status === 401 && !path.startsWith("/api/auth/")) setSession(null);
  throw new ApiError(res.status, body.error || "حدث خطأ غير متوقع.", body.waitSeconds);
}

/** رسالة الخطأ بالعربية. */
export function cloudError(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  const m = (e as { message?: string })?.message ?? String(e ?? "");
  if (/Failed to fetch|NetworkError|fetch failed/i.test(m)) return "تعذّر الاتصال بالخادم. تحقّق من الإنترنت.";
  return m || "حدث خطأ غير متوقع.";
}
