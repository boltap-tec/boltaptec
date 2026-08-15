-- BoltAp — enable live sync (Supabase Realtime) on all tables so changes
-- (e.g. a worker's advance request) reach the admin instantly, no reload.
-- Run this ONCE in the Supabase SQL editor. Safe to re-run (ignores duplicates).

do $$
declare t text;
begin
  foreach t in array array[
    'employees','attendance','ledger','salary_details',
    'salary_postings','advance_requests','settings'
  ]
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I;', t);
    exception
      when duplicate_object then null;  -- already added
      when others then null;            -- ignore, keep going
    end;
  end loop;
end $$;
