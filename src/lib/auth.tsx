"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useStore } from "./store";
import type { Role, User } from "./types";
import { can, type Perm } from "./permissions";
import { ApiError, api, cloudError, currentMe, normalizeUsername, onSession, setSession, toUser } from "./cloud";

const IDLE_KEY = "aqar:last-activity";
const IDLE_MINUTES = 720;   // 12 ساعة — لا نطرد المستخدم أثناء العمل

export type AuthResult = { ok: true } | { ok: false; message: string; waitSeconds?: number };

export interface NewUser {
  username: string;
  displayName: string;
  role: Role;
  phone?: string;
  password: string;
  /** العقارات المسندة — "all" لكل العقارات، أو قائمة معرّفات لمشرف عقار. */
  buildingIds?: string[] | "all";
}

interface AuthCtx {
  user: User | null;
  role: Role | undefined;
  loading: boolean;
  login: (username: string, password: string) => Promise<AuthResult>;
  logout: (reason?: string) => void;
  allow: (perm: Perm) => boolean;
  changePassword: (userId: string, current: string | null, next: string) => Promise<AuthResult>;
  lockInfo: (username: string) => { locked: boolean; waitSeconds: number; remaining: number };
  notice: string | null;
  clearNotice: () => void;
  createUser: (u: NewUser) => Promise<AuthResult>;
  saveUser: (id: string, patch: Partial<Pick<User, "displayName" | "role" | "phone" | "username" | "active" | "buildingIds">>) => Promise<AuthResult>;
  removeUser: (id: string) => Promise<AuthResult>;
  /** هل يمكن تغيير اسم المستخدم بعد الإنشاء؟ لا — هو هوية الحساب. */
  canRenameUsers: boolean;
}

const Ctx = createContext<AuthCtx | null>(null);

const fail = (e: unknown): AuthResult => ({
  ok: false,
  message: cloudError(e),
  waitSeconds: e instanceof ApiError ? e.waitSeconds : undefined,
});

/** خمول المستخدم: خروج تلقائي بعد طول انقطاع. */
function useIdleLogout(active: boolean, onExpire: (reason: string) => void) {
  useEffect(() => {
    if (!active) return;
    const touch = () => { try { localStorage.setItem(IDLE_KEY, String(Date.now())); } catch {} };
    touch();
    const evts = ["pointerdown", "keydown", "scroll", "visibilitychange"] as const;
    evts.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    const iv = setInterval(() => {
      let idle = 0;
      try { idle = Number(localStorage.getItem(IDLE_KEY) || 0); } catch {}
      if (idle && Date.now() - idle > IDLE_MINUTES * 60_000) onExpire("تم تسجيل خروجك تلقائيًا لعدم النشاط.");
    }, 30_000);
    return () => {
      evts.forEach((e) => window.removeEventListener(e, touch));
      clearInterval(iv);
    };
  }, [active, onExpire]);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data, update } = useStore();
  const [profile, setProfile] = useState<User | null>(null);
  const [booted, setBooted] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // متابعة الجلسة: الخادم هو المرجع، وأي رد 401 يُنهيها هنا
  useEffect(() => {
    let alive = true;
    let had = false;
    const apply = (u: User | null) => {
      if (!alive) return;
      if (!u && had) setNotice((n) => n ?? "انتهت الجلسة، سجّل الدخول مرة أخرى.");
      had = !!u;
      setProfile(u);
      setBooted(true);
    };
    currentMe().then(apply);
    const off = onSession(apply);
    return () => { alive = false; off(); };
  }, []);

  const signOut = useCallback(async (reason?: string) => {
    try { await api("/api/auth/logout", { method: "POST" }); } catch {}
    if (reason) setNotice(reason);
    setSession(null);
  }, []);

  // يبقى ملف المستخدم محدّثًا إذا غيّر مديرٌ آخر دوره أو أوقف حسابه
  useEffect(() => {
    if (!profile) return;
    const fresh = data.users.find((u) => u.id === profile.id);
    if (!fresh) return;
    if (!fresh.active) { signOut("تم إيقاف حسابك."); return; }
    setProfile((p) => (p && JSON.stringify({ ...p, lastLoginAt: "" }) === JSON.stringify({ ...fresh, lastLoginAt: "" }) ? p : fresh));
  }, [data.users, profile, signOut]);

  const onExpire = useCallback((reason: string) => { signOut(reason); }, [signOut]);
  useIdleLogout(!!profile, onExpire);

  const login = useCallback<AuthCtx["login"]>(async (username, password) => {
    const uname = normalizeUsername(username);
    if (!uname || !password) return { ok: false, message: "أدخل اسم المستخدم وكلمة المرور." };
    try {
      const res = await api<{ user: Parameters<typeof toUser>[0] }>("/api/auth/login", {
        method: "POST", json: { username: uname, password },
      });
      setNotice(null);
      try { localStorage.setItem(IDLE_KEY, String(Date.now())); } catch {}
      setSession(toUser(res.user));
      return { ok: true };
    } catch (e) {
      return fail(e);
    }
  }, []);

  const logout = useCallback((reason?: string) => { signOut(reason); }, [signOut]);

  const changePassword = useCallback<AuthCtx["changePassword"]>(async (userId, current, next) => {
    if (next.length < 8) return { ok: false, message: "كلمة المرور يجب ألا تقل عن ٨ أحرف." };
    try {
      await api("/api/auth/password", { method: "POST", json: { userId, current, next } });
      return { ok: true };
    } catch (e) {
      return fail(e);
    }
  }, []);

  const createUser = useCallback<AuthCtx["createUser"]>(async (u) => {
    try {
      await api("/api/users", {
        method: "POST",
        json: {
          username: normalizeUsername(u.username), password: u.password, displayName: u.displayName.trim(),
          role: u.role, phone: u.phone || null,
          buildingIds: !u.buildingIds || u.buildingIds === "all" ? null : u.buildingIds,
        },
      });
      return { ok: true };
    } catch (e) {
      return fail(e);
    }
  }, []);

  const saveUser = useCallback<AuthCtx["saveUser"]>(async (id, patch) => {
    update((d) => {
      const t = d.users.find((x) => x.id === id);
      if (!t) return;
      if (patch.displayName !== undefined) t.displayName = patch.displayName;
      if (patch.role !== undefined) t.role = patch.role;
      if (patch.phone !== undefined) t.phone = patch.phone;
      if (patch.active !== undefined) t.active = patch.active;
      if (patch.buildingIds !== undefined) t.buildingIds = patch.buildingIds;
    }, { action: "تعديل مستخدم", detail: id, actor: profile?.username });
    return { ok: true };
  }, [update, profile?.username]);

  const removeUser = useCallback<AuthCtx["removeUser"]>(async (id) => {
    try {
      await api(`/api/users?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      return { ok: true };
    } catch (e) {
      return fail(e);
    }
  }, []);

  // الإيقاف بعد المحاولات الفاشلة يُطبَّق في الخادم، والرسالة تصل مع رد الدخول
  const lockInfo = useCallback(() => ({ locked: false, waitSeconds: 0, remaining: 5 }), []);

  const allow = useCallback((perm: Perm) => can(profile?.role, perm), [profile?.role]);

  const value = useMemo<AuthCtx>(() => ({
    user: profile,
    role: profile?.role,
    loading: !booted,
    login, logout, allow, changePassword, lockInfo,
    notice, clearNotice: () => setNotice(null),
    createUser, saveUser, removeUser,
    canRenameUsers: false,
  }), [profile, booted, login, logout, allow, changePassword, lockInfo, notice, createUser, saveUser, removeUser]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used inside AuthProvider");
  return c;
}
