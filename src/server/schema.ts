import "server-only";
import bcrypt from "bcryptjs";
import { pool, q, tx } from "./db";
import { buildSeed } from "./seed";
import { COLLS, settingsToRow } from "@/lib/tables";

/**
 * مخطط قاعدة البيانات — يُنشأ تلقائيًا عند أول طلب، فلا حاجة لتشغيل أي SQL يدويًا.
 * كل الأوامر آمنة للتكرار (if not exists).
 */
const DDL = /* sql */ `
create table if not exists users (
  id            text primary key,
  username      text unique not null check (username = lower(username)),
  display_name  text not null,
  role          text not null default 'viewer' check (role in ('admin','manager','viewer','guard')),
  phone         text,
  active        boolean not null default true,
  building_ids  text[],
  created_at    timestamptz not null default now(),
  last_login_at timestamptz,
  password_hash text not null,
  pwv           int not null default 1
);

create table if not exists buildings (
  id text primary key, name text not null, code text default '', area text default '',
  block text default '', street text default '', building_no text default '', parcel text,
  owner_name text default '', paci_no text, land_area numeric, built_area numeric, notes text,
  color text default '#1d4ed8', photo text, photo_blur text,
  created_at timestamptz not null default now()
);

create table if not exists floors (
  id text primary key,
  building_id text not null references buildings on delete cascade,
  level int not null, name text not null, sort_order int not null default 0
);

create table if not exists units (
  id text primary key,
  building_id text not null references buildings on delete cascade,
  floor_id text not null references floors on delete cascade,
  number text not null, kind text not null default 'apartment', status text not null default 'vacant',
  area numeric, rooms int, bathrooms int, balconies int, base_rent numeric not null default 0,
  meter_no text, notes text,
  flagged boolean not null default false, flag_note text, flagged_at timestamptz,
  maintenance boolean not null default false, maintenance_note text, maintenance_at timestamptz,
  created_at timestamptz not null default now(),
  unique (building_id, number)
);

create table if not exists tenants (
  id text primary key,
  building_id text references buildings on delete cascade,
  name text not null, civil_id text, phone text default '', phone2 text, nationality text,
  email text, workplace text, emergency_contact text, notes text,
  active boolean not null default true, created_at timestamptz not null default now()
);

create table if not exists contracts (
  id text primary key, no text not null,
  building_id text not null references buildings on delete cascade,
  unit_id text not null references units on delete cascade,
  tenant_id text not null references tenants on delete cascade,
  start_date date not null, end_date date not null, first_rented_at date, signed_at date,
  duration_text text, occupants int, rent numeric not null default 0, deposit numeric not null default 0,
  due_day int not null default 1, pay_method text not null default 'cash',
  status text not null default 'active', terms text, created_at timestamptz not null default now()
);

create table if not exists payments (
  id text primary key, receipt_no text not null,
  building_id text not null references buildings on delete cascade,
  unit_id text not null references units on delete cascade,
  tenant_id text not null references tenants on delete cascade,
  contract_id text references contracts on delete set null,
  period text not null, amount numeric not null, paid_at date not null,
  method text not null default 'cash', reference text, bank text, notes text,
  created_by text default '', created_at timestamptz not null default now()
);
create unique index if not exists payments_contract_period_key
  on payments (contract_id, period) where contract_id is not null;

create table if not exists expenses (
  id text primary key,
  building_id text not null references buildings on delete cascade,
  category text not null default 'other', title text not null, amount numeric not null,
  date date not null, vendor text, method text not null default 'cash', notes text,
  created_at timestamptz not null default now()
);

create table if not exists docs (
  id text primary key, owner_type text not null, owner_id text not null,
  building_id text references buildings on delete cascade,
  kind text not null default 'other', title text not null, file_name text not null,
  mime text default '', size bigint default 0, expires_at date,
  uploaded_by text default '', uploaded_at timestamptz not null default now()
);

create table if not exists memos (
  id text primary key, title text not null, body text not null default '',
  author_id text default '', author_name text default '', created_at timestamptz not null default now()
);

create table if not exists audit_log (
  id text primary key, at timestamptz not null default now(),
  actor text default '', action text not null, detail text default ''
);

create table if not exists settings (
  id int primary key default 1 check (id = 1),
  org_name text not null default '', owner_full_name text not null default '',
  currency text not null default 'KWD', session_minutes int not null default 43200,
  reminder_days_before_due int not null default 3, contract_alert_days int not null default 45,
  tracking_start_period text not null default to_char(now(), 'YYYY-MM'),
  due_day int not null default 5, late_fee numeric not null default 200,
  supervisor_fee numeric not null default 5
);

-- ملفات المستندات وصور العقارات — خاصة، لا تُقرأ إلا عبر النظام بعد تسجيل الدخول
create table if not exists files (
  id text primary key, mime text not null default 'application/octet-stream',
  size int not null default 0, data bytea not null, created_at timestamptz not null default now()
);

-- عدّاد تغيير لكل جدول — الأجهزة تسأل عنه كل بضع ثوانٍ لتعرف ما تغيّر
create table if not exists revs (table_name text primary key, rev bigint not null default 0);

-- محاولات الدخول الفاشلة لكل اسم مستخدم
create table if not exists login_attempts (
  username text primary key, fails int not null default 0, locked_until timestamptz
);

create index if not exists units_building_idx   on units (building_id);
create index if not exists tenants_building_idx on tenants (building_id);
create index if not exists contracts_unit_idx   on contracts (unit_id);
create index if not exists contracts_tenant_idx on contracts (tenant_id);
create index if not exists payments_period_idx  on payments (building_id, period);
create index if not exists expenses_date_idx    on expenses (building_id, date);
create index if not exists docs_owner_idx       on docs (owner_type, owner_id);
create index if not exists audit_at_idx         on audit_log (at desc);
`;

/** حساب المالك الأول — يُنشأ مرة واحدة فقط حين لا يوجد أي مستخدم. */
const FIRST_ADMIN = { username: "ali", displayName: "علي", password: "Aa112233@" };

const g = globalThis as unknown as { __aqarReady?: Promise<void> };

export function ensureReady(): Promise<void> {
  if (!g.__aqarReady) {
    g.__aqarReady = init().catch((e) => {
      g.__aqarReady = undefined;
      throw e;
    });
  }
  return g.__aqarReady;
}

async function init() {
  await pool().query(DDL);
  // ترقيات المخطط على قواعد أُنشئت قبلها
  await q(`alter table buildings add column if not exists photo_blur text`);
  // دور «مشرف عقار» السابق صار هو «الحارس» نفسه — تُنقل الحسابات القديمة إليه
  await q(`update users set role = 'guard' where role = 'manager'`);
  const tables = COLLS.map((c) => c.table).concat("settings");
  await q(
    `insert into revs (table_name, rev) select unnest($1::text[]), 0 on conflict do nothing`,
    [tables]
  );

  const [{ count }] = await q<{ count: number }>(`select count(*)::int as count from users`);
  if (count > 0) return;

  // قاعدة جديدة: حساب المالك + بيانات العمارتين من سجل المكتب
  await tx(async (c) => {
    const again = await c.query(`select 1 from users limit 1`);
    if (again.rowCount) return;

    await c.query(
      `insert into users (id, username, display_name, role, password_hash) values ($1,$2,$3,'admin',$4)`,
      [`u-${FIRST_ADMIN.username}`, FIRST_ADMIN.username, FIRST_ADMIN.displayName, await bcrypt.hash(FIRST_ADMIN.password, 10)]
    );

    const seed = buildSeed();
    for (const coll of COLLS) {
      if (coll.table === "users") continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = ((seed as any)[coll.key] as any[]).map((x) => coll.toRow(x));
      if (!rows.length) continue;
      const cols = Object.keys(rows[0]);
      await c.query(
        `insert into ${coll.table} (${cols.join(",")})
         select ${cols.join(",")} from json_populate_recordset(null::${coll.table}, $1::json)
         on conflict (id) do nothing`,
        [JSON.stringify(rows)]
      );
    }
    const st = settingsToRow(seed.settings);
    const cols = Object.keys(st);
    await c.query(
      `insert into settings (${cols.join(",")}) values (${cols.map((_, i) => `$${i + 1}`).join(",")})
       on conflict (id) do nothing`,
      cols.map((k) => (st as Record<string, unknown>)[k])
    );
  });
}
