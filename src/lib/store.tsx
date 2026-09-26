"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { AppData } from "./types";
import { uid } from "./crypto";
import { syncUnitStatuses } from "./contracts";
import { cloudError, currentMe, onSession } from "./cloud";
import { emptyData, fetchAll, fetchRevs, fetchTables, pushDiff, type Revs } from "./cloudData";

const BKEY = "aqar:active-building";

/** كل كم ثانية يسأل الجهاز الخادمَ عمّا تغيّر. */
const POLL_MS = 5_000;
/** يتوقف السؤال بعد هذه المدة بلا أي نشاط، فتنام قاعدة البيانات وتوفّر حصتها المجانية. */
const IDLE_STOP_MS = 15 * 60_000;

/**
 * المصدر الوحيد للبيانات في النظام كله.
 *
 * البيانات مشتركة بين كل المستخدمين عبر الخادم، وكل تعديل يمرّ عبر `update`
 * فيُرسَل فرقُه إلى قاعدة البيانات، وتصل تعديلات الآخرين خلال ثوانٍ.
 */
interface StoreCtx {
  ready: boolean;
  data: AppData;
  update: (mutator: (draft: AppData) => void, audit?: { action: string; detail: string; actor?: string }) => void;
  activeBuilding: string;
  setActiveBuilding: (id: string) => void;
  exportBackup: () => void;
  importBackup: (file: File) => Promise<void>;
  /** حالة الاتصال بالخادم — تُعرض في الشريط العلوي. */
  cloud: { on: boolean; signedIn: boolean; syncing: boolean; error: string | null };
  reload: () => Promise<void>;
}

const Ctx = createContext<StoreCtx | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData | null>(null);
  const [ready, setReady] = useState(false);
  const [activeBuilding, setActive] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const latest = useRef<AppData | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const pending = useRef(0);
  const revs = useRef<Revs>({});

  useEffect(() => { latest.current = data; }, [data]);

  /* ------------------------- اختيار العقار النشط ------------------------- */
  const pickBuilding = useCallback((d: AppData) => {
    let saved: string | null = null;
    try { saved = localStorage.getItem(BKEY); } catch {}
    setActive((cur) => {
      const want = cur || saved;
      return want && d.buildings.some((b) => b.id === want) ? want : d.buildings[0]?.id ?? "";
    });
  }, []);

  /* ================================ التحميل ================================ */

  const load = useCallback(async () => {
    try {
      const { data: d, revs: r } = await fetchAll();
      revs.current = r;
      latest.current = d;
      setData(d);
      pickBuilding(d);
      setError(null);
    } catch (e) {
      setError(cloudError(e));
      setData((p) => p ?? emptyData());
    } finally {
      setReady(true);
    }
  }, [pickBuilding]);

  useEffect(() => {
    let alive = true;
    const apply = (u: unknown) => {
      if (!alive) return;
      setSignedIn(!!u);
      if (u) load();
      else { revs.current = {}; latest.current = emptyData(); setData(emptyData()); setReady(true); }
    };
    currentMe().then(apply);
    const off = onSession(apply);
    return () => { alive = false; off(); };
  }, [load]);

  /* ========================= الاستطلاع: تعديلات الآخرين ========================= */

  useEffect(() => {
    if (!signedIn) return;
    let lastActivity = Date.now();
    let busy = false;

    const poll = async () => {
      if (busy || pending.current > 0) return;
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastActivity > IDLE_STOP_MS) return;
      busy = true;
      try {
        const server = await fetchRevs();
        if (pending.current > 0) return;
        const changed = Object.keys(server).filter((t) => server[t] !== revs.current[t]);
        if (!changed.length) return;
        const { part, revs: r } = await fetchTables(changed);
        if (pending.current > 0) return;   // تعديل محلي بدأ أثناء القراءة — نعيد المحاولة لاحقًا
        changed.forEach((t) => { revs.current[t] = r[t]; });
        setData((p) => {
          if (!p) return p;
          const next = { ...p, ...part };
          latest.current = next;
          return next;
        });
        setError(null);
      } catch { /* تُعاد المحاولة في الدورة التالية */ }
      finally { busy = false; }
    };

    const touch = () => {
      const wasIdle = Date.now() - lastActivity > IDLE_STOP_MS;
      lastActivity = Date.now();
      if (wasIdle) poll();
    };
    const onVisible = () => { if (document.visibilityState === "visible") { lastActivity = Date.now(); poll(); } };

    const iv = setInterval(poll, POLL_MS);
    const evts = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    evts.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearInterval(iv);
      evts.forEach((e) => window.removeEventListener(e, touch));
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [signedIn]);

  /* ================================ التعديل ================================ */

  const update = useCallback<StoreCtx["update"]>((mutator, audit) => {
    const prev = latest.current;
    if (!prev) return;

    const draft: AppData = structuredClone(prev);
    mutator(draft);
    if (audit) {
      draft.audit = [
        { id: uid("a-"), at: new Date().toISOString(), actor: audit.actor ?? "—", action: audit.action, detail: audit.detail },
        ...draft.audit,
      ].slice(0, 400);
    }

    latest.current = draft;
    setData(draft);

    pending.current += 1;
    setSyncing(true);
    queue.current = queue.current
      .then(() => pushDiff(prev, draft))
      .then((r) => {
        // ما كتبناه بأنفسنا لا يُعاد تحميله؛ وما كتبه غيرنا قبلنا يلتقطه الاستطلاع
        Object.entries(r).forEach(([t, { before, after }]) => {
          if (revs.current[t] === before) revs.current[t] = after;
        });
        setError(null);
      })
      .catch(async (e) => {
        setError(cloudError(e));
        // الخادم هو المرجع: نعيد قراءة الحالة الصحيحة بدل ترك فرق صامت
        try {
          const { data: fresh, revs: r } = await fetchAll();
          revs.current = r;
          latest.current = fresh;
          setData(fresh);
        } catch { /* تُعالَج في المحاولة التالية */ }
      })
      .finally(() => {
        pending.current -= 1;
        if (pending.current === 0) setSyncing(false);
      });
  }, []);

  const setActiveBuilding = useCallback((id: string) => {
    setActive(id);
    try { localStorage.setItem(BKEY, id); } catch {}
  }, []);

  const reload = useCallback(async () => { await load(); }, [load]);

  const exportBackup = useCallback(() => {
    if (!data) return;
    const safe = { ...data, users: data.users.map((u) => ({ ...u, salt: "", hash: "" })) };
    const blob = new Blob([JSON.stringify(safe, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `نسخة-احتياطية-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }, [data]);

  const importBackup = useCallback(async (file: File) => {
    const text = await file.text();
    const parsed = JSON.parse(text) as AppData;
    if (!parsed.users || !parsed.buildings) throw new Error("الملف غير صالح");
    const current = latest.current ?? emptyData();
    // الحسابات لا تُستورد من ملف — تبقى كما هي على الخادم
    await pushDiff(current, { ...emptyData(), ...parsed, users: current.users, audit: current.audit });
    await load();
  }, [load]);

  const cloud = useMemo(
    () => ({ on: true, signedIn, syncing, error }),
    [signedIn, syncing, error]
  );

  // حالة الوحدات تُقرأ حسب الشهر الحالي — المستأجر القادم لا يشغل الشقة قبل شهره
  const view = useMemo(() => (data ? syncUnitStatuses(data) : null), [data]);

  const value = useMemo<StoreCtx | null>(
    () => (view
      ? { ready, data: view, update, activeBuilding, setActiveBuilding, exportBackup, importBackup, cloud, reload }
      : null),
    [view, ready, update, activeBuilding, setActiveBuilding, exportBackup, importBackup, cloud, reload]
  );

  if (!value) {
    return (
      <div className="grid min-h-dvh place-items-center bg-[var(--bg)]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-[var(--line)] border-t-[var(--primary)]" />
          <p className="text-sm text-[var(--muted)]">جاري تجهيز النظام…</p>
        </div>
      </div>
    );
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useStore must be used inside StoreProvider");
  return c;
}
