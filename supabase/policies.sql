-- BoltAp — open access policies for the publishable/anon key.
-- Run this ONCE in the Supabase SQL editor after schema.sql.
--
-- ⚠️ DEMO SECURITY: this allows the public key to read/write every table, which
-- is what lets the app work before real Supabase Auth is added. Tighten these
-- (per-user / role-based policies) before going to production.

do $$
declare t text;
begin
  foreach t in array array[
    'employees','attendance','ledger','salary_details',
    'salary_postings','advance_requests','settings'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists boltap_all on public.%I;', t);
    execute format('create policy boltap_all on public.%I for all using (true) with check (true);', t);
  end loop;
end $$;
