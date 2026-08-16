-- BoltAp — Supabase schema. Field names match the TypeScript types 1:1,
-- so the migration from the local store is a straight swap.
-- Run this in the Supabase SQL editor.

create table if not exists employees (
  employee_id           text primary key,
  name                  text not null,
  address               text,
  phone                 text,
  photo                 text,
  daily_wage            numeric not null default 0,
  adhar_photo           text,
  status                text not null default 'Active',
  hourly_rate           numeric not null default 0,
  upi_id                text,
  pin                   text,               -- login PIN (use Supabase Auth in production)
  weekly_recovery       numeric default 0,  -- advance deduction per payday
  join_date             date,
  device_id             text,               -- bound device for attendance (IMEI stand-in)
  total_salary          numeric not null default 0,
  salary_given          numeric not null default 0,
  salary_pending        numeric not null default 0,
  total_advance_given   numeric not null default 0,
  advance_recovered     numeric not null default 0,
  advance_pending       numeric not null default 0,
  created_at            timestamptz default now()
);

create table if not exists attendance (
  id            text primary key,
  date          date not null,
  employee_id   text references employees(employee_id) on delete cascade,
  employee_name text,
  time_in       text,
  time_out      text,
  total_hours   numeric default 0,
  salary_amount numeric default 0,
  daily_wage    numeric default 0,
  ref_names     text,
  extra_time    numeric default 0,
  lunch_hours   numeric default 0,       -- unpaid break deducted from the shift
  paid          boolean default false,   -- true once this day's salary is paid
  salary_id     text,                    -- which posting settled it
  source        text,                    -- 'employee' (self-punch) | 'admin'
  status        text,                    -- 'pending' (awaiting admin post) | 'posted'
  open_lat      numeric,                 -- location when the worker opened attendance
  open_lng      numeric,
  close_lat     numeric,                 -- location when the worker closed attendance
  close_lng     numeric
);
create index if not exists attendance_emp_date on attendance(employee_id, date);

create table if not exists ledger (
  id                    text primary key,
  date                  date not null,
  category              text not null,       -- Salary | Advance_Payment | Advance_Recovery
  employee_id           text references employees(employee_id) on delete cascade,
  employee_name         text,
  description           text,
  salary_payment_amount numeric,
  advance_payment       numeric,
  advance_recovery      numeric,
  total_amount_given    numeric,
  salary_id             text,
  remark                text,
  old_advance           numeric,
  method                text default 'Cash'  -- Cash | UPI | Bank
);

create table if not exists salary_postings (
  id         text primary key,
  from_date  date not null,
  to_date    date not null,
  submitted  boolean default true,
  created_at timestamptz default now()
);

create table if not exists salary_details (
  id                text primary key,
  from_date         date,
  to_date           date,
  employee_id       text references employees(employee_id) on delete cascade,
  employee_name     text,
  total_hours       numeric default 0,
  salary_amount     numeric default 0,
  daily_wage        numeric default 0,
  extra_time        numeric default 0,
  advance_recovered numeric default 0,
  salary_given      numeric default 0,
  salary_pending    numeric default 0,
  from_to           text,
  this_week_advance numeric default 0,
  advance_balance   numeric default 0
);

create table if not exists advance_requests (
  id            text primary key,
  employee_id   text references employees(employee_id) on delete cascade,
  employee_name text,
  amount        numeric not null,
  reason        text,
  status        text not null default 'Pending', -- Pending | Approved | Rejected
  method        text default 'UPI',
  created_at    timestamptz default now(),
  decided_at    timestamptz,
  decided_by    text,
  admin_note    text
);

create table if not exists settings (
  id                int primary key default 1,
  business_name     text,
  logo              text,
  admin_upi_id      text,
  admin_pin         text,
  standard_hours    numeric default 8,
  lunch_hours       numeric default 1,
  delete_password   text,
  week_start        int default 6,
  location_required boolean default false
);

-- Additive migration for databases created before these columns existed.
alter table attendance add column if not exists lunch_hours numeric default 0;  -- REQUIRED for worker Close Attendance to sync
alter table attendance add column if not exists source    text;
alter table attendance add column if not exists status    text;
alter table attendance add column if not exists open_lat  numeric;
alter table attendance add column if not exists open_lng  numeric;
alter table attendance add column if not exists close_lat numeric;
alter table attendance add column if not exists close_lng numeric;
alter table attendance add column if not exists project_allocations jsonb;  -- Phase 3: per-project hours split
alter table settings   add column if not exists lunch_hours       numeric default 1;
alter table settings   add column if not exists location_required boolean default false;
alter table settings   add column if not exists today_project_id   text;
alter table settings   add column if not exists today_project_name text;
alter table settings   add column if not exists today_plan_date    text;
alter table settings   add column if not exists logo               text;
alter table settings   add column if not exists delete_password    text;

-- ── Projects module ─────────────────────────────────────────────────────────
create table if not exists projects (
  project_id         text primary key,
  name               text not null,
  date               date,
  owner_name         text,
  address            text,
  phone              text,
  quote_based_on     text,                 -- Other | Length_Breadth_Based
  length             numeric,
  breadth            numeric,
  rate_per_sqft      numeric,
  total_sqft         numeric default 0,
  approximate_amount numeric default 0,
  amount_quoted      numeric default 0,
  discount           numeric,
  status             text default 'Running',  -- Running | Completed | Cancelled
  images             jsonb,
  created_at         timestamptz default now()
);

create table if not exists expenditure_categories (
  category_id text primary key,
  name        text not null,
  visible     boolean default true
);

create table if not exists project_expenditure (
  id            text primary key,
  project_id    text references projects(project_id) on delete cascade,
  project_name  text,
  date          date,
  category_id   text,
  category_name text,
  description   text,
  amount        numeric not null default 0,
  remark        text,
  images        jsonb,
  items         jsonb,                    -- purchase line items
  vendor        text,                     -- "bought from"
  cgst          numeric,
  sgst          numeric,
  igst          numeric,
  source        text default 'admin'      -- admin | worker_request
);
create index if not exists project_exp_pid on project_expenditure(project_id);
alter table project_expenditure add column if not exists items  jsonb;
alter table project_expenditure add column if not exists vendor text;
alter table project_expenditure add column if not exists cgst   numeric;
alter table project_expenditure add column if not exists sgst   numeric;
alter table project_expenditure add column if not exists igst   numeric;

create table if not exists project_payments (
  id           text primary key,
  project_id   text references projects(project_id) on delete cascade,
  project_name text,
  date         date,
  amount       numeric not null default 0,
  method       text,
  remark       text
);
create index if not exists project_pay_pid on project_payments(project_id);

create table if not exists expenditure_requests (
  id            text primary key,
  employee_id   text,
  employee_name text,
  project_id    text,
  project_name  text,
  category_id   text,
  category_name text,
  amount        numeric not null default 0,
  note          text,
  status        text not null default 'Pending',  -- Pending | Approved | Rejected
  created_at    timestamptz default now(),
  decided_at    timestamptz,
  decided_by    text,
  admin_note    text,
  paid_method   text                                -- Cash | UPI
);

-- Grant the app's publishable/anon key full access (DEMO — see policies.sql).
-- ⚠️ tighten with RLS + real auth before production.
do $$
declare t text;
begin
  foreach t in array array[
    'employees','attendance','ledger','salary_details',
    'salary_postings','advance_requests','settings',
    'projects','expenditure_categories','project_expenditure','project_payments',
    'expenditure_requests'
  ]
  loop
    execute format('alter table public.%I disable row level security;', t);
    execute format('grant all privileges on public.%I to anon, authenticated;', t);
  end loop;
end $$;
grant usage on schema public to anon, authenticated;
