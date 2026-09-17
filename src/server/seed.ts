import type { AppData, Building, Contract, Floor, Tenant, Unit } from "@/lib/types";
import { localISO } from "@/lib/format";
import { DEFAULT_SETTINGS, emptyData } from "@/lib/tables";
import { BUILDINGS, OWNER_NAME } from "@/lib/alfailakawiData";

const iso = localISO;

/** معرّف لاتيني للوحدة: المحل ← shop، السرداب ← basement، ملحق 1 ← annex1. */
const slug = (n: string) =>
  n === "المحل" ? "shop" : n === "السرداب" ? "basement" : n.startsWith("ملحق") ? `annex${n.replace(/\D/g, "")}` : n;

const addYears = (d: Date, n: number) => {
  const x = new Date(d);
  x.setFullYear(x.getFullYear() + n);
  return x;
};

/**
 * يبني بيانات النظام من سجلّي المكتب الفعليين (حولي والمنقف).
 *
 * لا تُختلق أي بيانات مالية: سجل المكتب لا يحتوي على دفعات، فيبدأ النظام
 * بسجل تحصيل فارغ، وتُحتسب المتأخرات ابتداءً من settings.trackingStartPeriod فقط.
 */
export function buildSeed(): AppData {
  const now = new Date();
  const nowIso = now.toISOString();
  const out = emptyData();
  let cSeq = 0;
  let imported = 0;

  for (const spec of BUILDINGS) {
    const BID = spec.id;
    const building: Building = {
      id: BID, name: spec.name, code: spec.code, area: spec.area, block: spec.block,
      street: spec.street, buildingNo: "", parcel: spec.parcel, ownerName: OWNER_NAME,
      color: spec.color, notes: spec.notes, createdAt: nowIso,
    };
    out.buildings.push(building);

    /* --------------------------- الأدوار والوحدات --------------------------- */
    const units: Unit[] = [];
    spec.floors.forEach((f, i) => {
      const fid = `${BID}-f${f.level}`;
      const floor: Floor = { id: fid, buildingId: BID, level: f.level, name: f.name, order: i };
      out.floors.push(floor);
      for (const u of f.units) {
        units.push({
          id: `${BID}-u-${slug(u.number)}`, buildingId: BID, floorId: fid, number: u.number,
          kind: u.kind, status: "vacant", baseRent: 0, flagged: false, createdAt: nowIso,
        });
      }
    });
    const unitByNumber = new Map(units.map((u) => [u.number, u]));

    /* ---------------------- المستأجرون والعقود من السجل ---------------------- */
    const tenants: Tenant[] = [];
    const contracts: Contract[] = [];

    for (const r of spec.records) {
      const unit = unitByNumber.get(r.unit);
      if (!unit) continue;

      const tenantId = `t-${spec.code.toLowerCase()}-${r.seq}`;
      tenants.push({
        id: tenantId, buildingId: BID, name: r.name, civilId: r.civilId, phone: r.phone,
        nationality: r.nationality, workplace: r.job, active: true, createdAt: nowIso,
      });

      unit.status = "occupied";
      unit.baseRent = r.rent;

      // العقد يتجدد سنويًا تلقائيًا وفق نصّه، فنعرض الدورة السارية حاليًا
      let start = r.start ? new Date(`${r.start}T00:00:00`) : new Date(now.getFullYear(), now.getMonth(), 1);
      let end = r.end ? new Date(`${r.end}T00:00:00`) : addYears(start, 1);
      const review: string[] = [];

      if (r.note) review.push(r.note);
      if (!r.start) review.push("بيانات العقد غير مكتملة في سجل المكتب — يرجى استكمالها");
      else if (!r.end || end <= start) {
        if (r.end) review.push("تاريخ انتهاء العقد المسجّل سابق لتاريخ بدايته — يرجى مراجعته");
        end = new Date(addYears(start, 1).getTime() - 86_400_000);
      }

      while (end <= now) {
        start = addYears(start, 1);
        end = addYears(end, 1);
      }

      contracts.push({
        id: `c-${spec.code.toLowerCase()}-${r.seq}`,
        no: `ع-${String(++cSeq).padStart(4, "0")}`,
        buildingId: BID, unitId: unit.id, tenantId,
        startDate: iso(start), endDate: iso(end),
        firstRentedAt: r.start || undefined,
        signedAt: r.signed || undefined,
        durationText: "سنة",
        rent: r.rent, deposit: r.rent, dueDay: 5,
        payMethod: r.pay, status: "active", createdAt: nowIso,
      });

      if (review.length) {
        unit.flagged = true;
        unit.flagNote = review.join(" · ");
        unit.flaggedAt = nowIso;
      }
      imported++;
    }

    // الوحدات الشاغرة: يُقترح لها متوسط إيجار دورها حتى يحدّده المالك
    const rented = units.filter((u) => u.status === "occupied" && u.kind === "apartment");
    const avgAll = rented.length ? Math.round(rented.reduce((a, u) => a + u.baseRent, 0) / rented.length) : 150;
    const byFloor = new Map<string, number[]>();
    rented.forEach((u) => byFloor.set(u.floorId, [...(byFloor.get(u.floorId) ?? []), u.baseRent]));
    units.forEach((u) => {
      if (u.baseRent) return;
      const list = byFloor.get(u.floorId) ?? [];
      u.baseRent = list.length ? Math.round(list.reduce((a, b) => a + b, 0) / list.length) : avgAll;
    });

    out.units.push(...units);
    out.tenants.push(...tenants);
    out.contracts.push(...contracts);
  }

  out.memos = [{
    id: "m-1",
    title: "بدء العمل بالنظام الجديد",
    body: "تم استيراد سجل مستأجري عمارة حولي وعمارة المنقف من برنامج المكتب السابق. يرجى مراجعة الوحدات التي عليها ملاحظة حمراء واستكمال بياناتها، وتسجيل الدفعات أولًا بأول ليظهر التحصيل والمتأخرات بشكل صحيح.",
    authorId: "u-ali",
    authorName: "علي",
    createdAt: nowIso,
  }];
  out.audit = [{
    id: "a0", at: nowIso, actor: "النظام", action: "استيراد بيانات",
    detail: `تم استيراد ${imported} مستأجرًا من سجلّي المكتب (حولي والمنقف)`,
  }];
  out.settings = {
    ...DEFAULT_SETTINGS,
    ownerFullName: OWNER_NAME,
    trackingStartPeriod: iso(now).slice(0, 7),
  };
  return out;
}
