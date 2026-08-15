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
  extra_time    numeric default 0
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
  id             int primary key default 1,
  business_name  text,
  admin_upi_id   text,
  admin_pin      text,
  standard_hours numeric default 8,
  week_start     int default 6
);

-- Enable Row Level Security later and add policies before going to production.
-- alter table employees enable row level security;  -- etc.
