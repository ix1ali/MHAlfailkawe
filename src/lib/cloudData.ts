"use client";

import { api } from "./cloud";
import type { AppData } from "./types";
import { COLLS, emptyData, settingsFromRow, settingsToRow } from "./tables";

export { emptyData, REALTIME_TABLES } from "./tables";

type Row = Record<string, unknown>;
export type Revs = Record<string, number>;

interface DataResponse { tables: Record<string, Row[]>; settings?: Row | null; revs: Revs }

function apply(out: Partial<AppData>, res: DataResponse) {
  for (const c of COLLS) {
    const rows = res.tables[c.table];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (rows) (out as any)[c.key] = rows.map((r) => c.fromRow(r));
  }
  if (res.settings) out.settings = settingsFromRow(res.settings);
}

/* ============================== القراءة ============================== */

/** يقرأ كل الجداول دفعة واحدة ويبني بيانات التطبيق. */
export async function fetchAll(): Promise<{ data: AppData; revs: Revs }> {
  const res = await api<DataResponse>("/api/data");
  const data = emptyData();
  apply(data, res);
  return { data, revs: res.revs };
}

/** يعيد قراءة جداول بعينها — يُستعمل حين يكشف الاستطلاع تغييرًا. */
export async function fetchTables(tables: string[]): Promise<{ part: Partial<AppData>; revs: Revs }> {
  const res = await api<DataResponse>(`/api/data?tables=${encodeURIComponent(tables.join(","))}`);
  const part: Partial<AppData> = {};
  apply(part, res);
  return { part, revs: res.revs };
}

export const fetchRevs = () => api<{ revs: Revs }>("/api/rev").then((r) => r.revs);

/* ============================== الكتابة ============================== */

const sameRow = (a: Row, b: Row) => JSON.stringify(a) === JSON.stringify(b);

/**
 * يقارن الحالة السابقة بالحالة الجديدة ويرسل الفرق فقط إلى الخادم في معاملة واحدة.
 * هذا هو الوصل الوحيد بين نموذج البيانات في الواجهة وقاعدة البيانات.
 *
 * يعيد عدّادات الجداول قبل التعديل وبعده، فلا يعيد الجهاز تحميل ما كتبه بنفسه.
 */
export async function pushDiff(prev: AppData, next: AppData): Promise<Record<string, { before: number; after: number }>> {
  const upserts: { table: string; rows: Row[] }[] = [];
  const deletes: { table: string; ids: string[] }[] = [];

  for (const c of COLLS) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const before = new Map<string, Row>(((prev as any)[c.key] as any[]).map((x) => [x.id, c.toRow(x)]));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const after = new Map<string, Row>(((next as any)[c.key] as any[]).map((x) => [x.id, c.toRow(x)]));

    const changed: Row[] = [];
    after.forEach((row, id) => {
      const old = before.get(id);
      if (!old || !sameRow(old, row)) changed.push(row);
    });
    const gone: string[] = [];
    before.forEach((_row, id) => { if (!after.has(id)) gone.push(id); });

    if (changed.length) upserts.push({ table: c.table, rows: changed });
    if (gone.length) deletes.push({ table: c.table, ids: gone });
  }

  const settingsChanged = JSON.stringify(prev.settings) !== JSON.stringify(next.settings);
  if (!upserts.length && !deletes.length && !settingsChanged) return {};

  const res = await api<{ revs: Record<string, { before: number; after: number }> }>("/api/data", {
    method: "POST",
    json: {
      // الحذف من الابن إلى الأب، والإضافة من الأب إلى الابن
      deletes: [...deletes].reverse(),
      upserts,
      settings: settingsChanged ? settingsToRow(next.settings) : undefined,
    },
  });
  return res.revs;
}
