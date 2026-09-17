import type { PoolClient } from "pg";
import { q, tx } from "@/server/db";
import { HttpError, handle, requireUser, type Me } from "@/server/session";
import { SYNC_TABLES, canRead, canWrite, canWriteSettings, type SyncTable } from "@/server/access";

export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;

const ORDER: Record<SyncTable, string> = {
  users: "created_at asc", buildings: "created_at asc", floors: "sort_order asc", units: "number asc",
  tenants: "name asc", contracts: "created_at asc", payments: "created_at desc", expenses: "date desc",
  docs: "uploaded_at desc", memos: "created_at desc", audit_log: "at desc",
};

const USER_COLS = "id, username, display_name, role, phone, active, building_ids, created_at, last_login_at";

/* ------------------------------------------------------------ أعمدة كل جدول */

interface ColInfo { name: string; type: string }
const g = globalThis as unknown as { __aqarCols?: Map<string, ColInfo[]> };

/** يستعمل اتصال المعاملة نفسه — طلب اتصال ثانٍ من داخل المعاملة قد يعلق. */
async function columns(c: PoolClient, table: string): Promise<ColInfo[]> {
  g.__aqarCols ??= new Map();
  if (!g.__aqarCols.has(table)) {
    const { rows } = await c.query<{ column_name: string; data_type: string }>(
      `select column_name, data_type from information_schema.columns
        where table_schema = current_schema() and table_name = $1`,
      [table]
    );
    g.__aqarCols.set(table, rows.map((r) => ({ name: r.column_name, type: r.data_type })));
  }
  return g.__aqarCols.get(table)!;
}

const isSync = (t: string): t is SyncTable => (SYNC_TABLES as readonly string[]).includes(t);

/* ================================================================== القراءة */

async function readTable(me: Me, t: SyncTable) {
  const cols = t === "users" ? USER_COLS : "*";
  const limit = t === "audit_log" ? " limit 500" : "";
  if (t === "audit_log" && me.role !== "admin") return [];
  const rows = await q(`select ${cols} from ${t} order by ${ORDER[t]}${limit}`);
  return rows.filter((r) => canRead(me, t, r));
}

async function readSettings() {
  const [st] = await q(`select * from settings where id = 1`);
  return st ?? null;
}

async function readRevs(): Promise<Record<string, number>> {
  const rows = await q<{ table_name: string; rev: number }>(`select table_name, rev from revs`);
  return Object.fromEntries(rows.map((r) => [r.table_name, Number(r.rev)]));
}

/** GET /api/data?tables=units,tenants — بلا tables يعيد كل شيء. */
export function GET(req: Request) {
  return handle(async () => {
    const me = await requireUser();
    const wanted = new URL(req.url).searchParams.get("tables");
    const list = wanted ? wanted.split(",") : [...SYNC_TABLES, "settings"];

    // العدّاد يُقرأ قبل البيانات: أي تغيير أثناء القراءة يُلتقط في الاستطلاع التالي
    const revs = await readRevs();
    const tables: Record<string, Row[]> = {};
    let settings: Row | null | undefined;
    await Promise.all(
      list.map(async (t) => {
        if (t === "settings") settings = await readSettings();
        else if (isSync(t)) tables[t] = await readTable(me, t);
      })
    );
    return Response.json({ tables, settings, revs });
  });
}

/* ================================================================== الكتابة */

interface Body {
  upserts?: { table: string; rows: Row[] }[];
  deletes?: { table: string; ids: string[] }[];
  settings?: Row;
}

const DENIED = "لا تملك صلاحية لهذه العملية.";

/** تنظيف القيم قبل الكتابة: النص الفارغ في حقل تاريخ يصير null. */
function clean(row: Row, cols: ColInfo[]): Row {
  const out: Row = {};
  for (const c of cols) {
    if (!(c.name in row)) continue;
    let v = row[c.name];
    if (v === "" && /date|timestamp|numeric|integer|bigint/.test(c.type)) v = null;
    out[c.name] = v;
  }
  return out;
}

async function bump(c: PoolClient, tables: string[]) {
  if (!tables.length) return {} as Record<string, { before: number; after: number }>;
  const r = await c.query<{ table_name: string; rev: string }>(
    `update revs set rev = rev + 1 where table_name = any($1::text[]) returning table_name, rev`,
    [tables]
  );
  return Object.fromEntries(
    r.rows.map((x) => [x.table_name, { before: Number(x.rev) - 1, after: Number(x.rev) }])
  );
}

export function POST(req: Request) {
  return handle(async () => {
    const me = await requireUser();
    const body = (await req.json()) as Body;
    const touched = new Set<string>();

    const result = await tx(async (c) => {
      // الحذف من الابن إلى الأب
      for (const d of body.deletes ?? []) {
        if (!isSync(d.table) || !Array.isArray(d.ids) || !d.ids.length) continue;
        const prev = await c.query(`select * from ${d.table} where id = any($1::text[])`, [d.ids]);
        const allowed: string[] = [];
        for (const r of prev.rows) {
          const ok = canWrite(me, d.table, "delete", null, r);
          if (ok === "ignore") continue;
          if (!ok) throw new HttpError(403, DENIED);
          allowed.push(String(r.id));
        }
        if (!allowed.length) continue;
        await c.query(`delete from ${d.table} where id = any($1::text[])`, [allowed]);
        touched.add(d.table);
      }

      // الإضافة والتعديل من الأب إلى الابن
      for (const u of body.upserts ?? []) {
        if (!isSync(u.table) || !Array.isArray(u.rows) || !u.rows.length) continue;
        const info = (await columns(c, u.table)).filter(
          (x) => !(u.table === "users" && (x.name === "password_hash" || x.name === "pwv"))
        );
        const rows = u.rows.map((r) => clean(r, info));
        const ids = rows.map((r) => String(r.id ?? ""));
        const prevRes = await c.query(`select * from ${u.table} where id = any($1::text[])`, [ids]);
        const prev = new Map(prevRes.rows.map((r) => [String(r.id), r as Row]));

        const inserts: Row[] = [];
        const updates: Row[] = [];
        for (const r of rows) {
          if (!r.id) throw new HttpError(400, "سجل بلا معرّف.");
          const old = prev.get(String(r.id)) ?? null;
          const op = old ? "update" : "insert";
          const ok = canWrite(me, u.table, op, r, old);
          if (ok === "ignore") continue;
          if (!ok) throw new HttpError(403, DENIED);
          (old ? updates : inserts).push(r);
        }

        if (inserts.length) {
          const cols = info.map((x) => x.name).filter((n) => n in inserts[0]);
          await c.query(
            `insert into ${u.table} (${cols.join(",")})
             select ${cols.join(",")} from json_populate_recordset(null::${u.table}, $1::json)`,
            [JSON.stringify(inserts)]
          );
          touched.add(u.table);
        }
        if (updates.length) {
          const cols = info.map((x) => x.name).filter((n) => n !== "id" && n in updates[0]);
          if (cols.length) {
            await c.query(
              `update ${u.table} t set ${cols.map((n) => `${n} = x.${n}`).join(", ")}
                 from json_populate_recordset(null::${u.table}, $1::json) x
                where t.id = x.id`,
              [JSON.stringify(updates)]
            );
            touched.add(u.table);
          }
        }

        if (u.table === "users") {
          const admins = await c.query(`select 1 from users where role = 'admin' and active limit 1`);
          if (!admins.rowCount) throw new HttpError(400, "يجب بقاء مدير واحد مفعّل على الأقل.");
        }
      }

      if (body.settings) {
        if (!canWriteSettings(me)) throw new HttpError(403, DENIED);
        const info = await columns(c, "settings");
        const row = clean({ ...body.settings, id: 1 }, info);
        const cols = Object.keys(row);
        await c.query(
          `insert into settings (${cols.join(",")})
           select ${cols.join(",")} from json_populate_record(null::settings, $1::json)
           on conflict (id) do update set ${cols.filter((n) => n !== "id").map((n) => `${n} = excluded.${n}`).join(", ")}`,
          [JSON.stringify(row)]
        );
        touched.add("settings");
      }

      return bump(c, [...touched]);
    });

    return Response.json({ revs: result });
  });
}
