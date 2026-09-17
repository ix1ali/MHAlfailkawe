import "server-only";
import type { Me } from "./session";

/**
 * الصلاحيات على مستوى الصف — تُطبَّق في الخادم على كل قراءة وكتابة،
 * فلا يستطيع أحد تجاوزها من المتصفح.
 *
 *  • المدير: كل شيء، وهو وحده من يدير المستخدمين والعمارات والإعدادات.
 *  • الحارس: كل شيء داخل العمارات المسندة إليه — الشقق والمستأجرون والعقود
 *    والمالية والوصولات والمستندات — بلا إدارة مستخدمين ولا إضافة عمارات.
 *  • المحاسب (مشاهد): اطلاع على كل شيء بما فيه المالية، بلا تعديل.
 */

type Row = Record<string, unknown>;

/** العمارات المسندة: null تعني كل العمارات. */
const inScope = (me: Me, b: unknown) =>
  me.buildingIds === null || (typeof b === "string" && me.buildingIds.includes(b));

export const sees = (me: Me, b: unknown) =>
  me.role === "admin" || me.role === "viewer" || (me.role === "guard" && inScope(me, b));

export const edits = (me: Me, b: unknown) =>
  me.role === "admin" || (me.role === "guard" && inScope(me, b));

export const seesFinance = (me: Me, b: unknown) =>
  me.role === "admin" || me.role === "viewer" || (me.role === "guard" && inScope(me, b));

/** الجداول التي تُقرأ وتُكتب عبر المزامنة العامة. */
export const SYNC_TABLES = [
  "users", "buildings", "floors", "units", "tenants", "contracts",
  "payments", "expenses", "docs", "memos", "audit_log",
] as const;
export type SyncTable = (typeof SYNC_TABLES)[number];

export function canRead(me: Me, table: string, r: Row): boolean {
  switch (table) {
    case "users": return me.role === "admin" || r.id === me.id;
    case "buildings": return sees(me, r.id);
    case "floors": case "units": case "tenants": case "contracts": case "docs":
      return sees(me, r.building_id);
    case "payments": case "expenses": return seesFinance(me, r.building_id);
    case "memos": return true;
    case "audit_log": return me.role === "admin";
    default: return false;
  }
}

export type Op = "insert" | "update" | "delete";

/**
 * هل يُسمح بالعملية؟ في التعديل تُفحص النسخة القديمة والجديدة معًا،
 * فلا يُنقل سجل من عمارة لا يملكها المستخدم أو إليها.
 * القيمة "ignore" تعني تجاهل العملية بصمت (مثل تقليم سجل العمليات محليًا).
 */
export function canWrite(me: Me, table: string, op: Op, next: Row | null, prev: Row | null): boolean | "ignore" {
  const both = (f: (b: unknown) => boolean, col: string) =>
    (!prev || f(prev[col])) && (!next || f(next[col]));

  switch (table) {
    case "users":
      if (op !== "update") return "ignore";   // الإنشاء والحذف لهما مسارات خاصة
      return me.role === "admin";
    case "buildings":
      // إضافة العمارات وتعديل بياناتها وحذفها للمدير وحده
      return me.role === "admin";
    case "floors": case "units": case "tenants": case "contracts": case "docs":
    case "payments": case "expenses":
      return both((b) => edits(me, b), "building_id");
    case "memos":
      if (op === "insert") return me.role !== "viewer";
      return me.role === "admin";
    case "audit_log":
      return op === "insert" ? true : "ignore";
    default:
      return false;
  }
}

export const canWriteSettings = (me: Me) => me.role === "admin";

/** رفع الملفات: المدير والحارس. القراءة لكل مستخدم مفعّل. */
export const canUpload = (me: Me) => me.role === "admin" || me.role === "guard";
