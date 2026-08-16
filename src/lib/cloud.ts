import { supabase, isSupabaseConfigured } from './supabase';
import { useData } from '../store/useData';
import type { Settings } from '../types';

// One place that maps the zustand store slices to Supabase tables.
const TABLES = [
  { slice: 'employees', table: 'employees', key: 'employee_id' },
  { slice: 'attendance', table: 'attendance', key: 'id' },
  { slice: 'ledger', table: 'ledger', key: 'id' },
  { slice: 'salaryDetails', table: 'salary_details', key: 'id' },
  { slice: 'postings', table: 'salary_postings', key: 'id' },
  { slice: 'requests', table: 'advance_requests', key: 'id' },
  { slice: 'projects', table: 'projects', key: 'project_id' },
  { slice: 'expenditureCategories', table: 'expenditure_categories', key: 'category_id' },
  { slice: 'projectExpenditure', table: 'project_expenditure', key: 'id' },
  { slice: 'projectPayments', table: 'project_payments', key: 'id' },
  { slice: 'expenditureRequests', table: 'expenditure_requests', key: 'id' },
] as const;

export const cloudEnabled = isSupabaseConfigured;

// Live status the UI can read (set by initCloud). Not reactive, but the app
// gates rendering on initCloud finishing, so it's accurate by first paint.
export const cloudState: { mode: 'cloud' | 'local' | 'connecting'; error: string } = {
  mode: cloudEnabled ? 'connecting' : 'local',
  error: '',
};

type AnyRow = Record<string, any>;

// Upsert that heals over schema lag: if the cloud table is missing a column the
// row carries (e.g. a new field before its migration is run), drop that column
// and retry so the rest of the row still syncs instead of the whole call failing.
async function upsertRows(table: string, rows: AnyRow[], key: string): Promise<void> {
  let payload = rows;
  for (let attempt = 0; attempt < 8; attempt++) {
    const { error } = await supabase!.from(table).upsert(payload, { onConflict: key });
    if (!error) return;
    const m = /Could not find the '(\w+)' column/.exec(error.message || '');
    if (m && m[1]) {
      const col = m[1];
      payload = payload.map((r) => { const { [col]: _omit, ...rest } = r; void _omit; return rest; });
      console.warn(`[cloud] ${table}: '${col}' column not in cloud yet — syncing without it (run schema.sql to keep it)`);
      continue;
    }
    throw error;
  }
}

async function fetchAll() {
  const out: Record<string, any[]> = {};
  const present = new Set<string>();
  for (const t of TABLES) {
    const { data, error } = await supabase!.from(t.table).select('*');
    // A missing table (new slice, migration not run yet) is skipped rather than
    // fatal — the rest of the app keeps syncing and local data is preserved.
    if (error) { console.warn('[cloud] table not available yet:', t.table, error.message); continue; }
    out[t.slice] = data || [];
    present.add(t.slice);
  }
  const { data: s } = await supabase!.from('settings').select('*').eq('id', 1).maybeSingle();
  return { slices: out, settings: s as (Settings & { id?: number }) | null, present };
}

// Push the entire local state up (used to seed an empty cloud DB).
export async function pushAll() {
  const st: AnyRow = useData.getState();
  for (const t of TABLES) {
    const rows = st[t.slice] as AnyRow[];
    if (rows && rows.length) {
      try { await upsertRows(t.table, rows, t.key); }
      catch (e: any) { console.warn('[cloud] pushAll skipped', t.table, e?.message || e); }
    }
  }
  await supabase!.from('settings').upsert({ id: 1, ...st.settings }, { onConflict: 'id' });
}

// Merge cloud state into the local store. Skips tables that don't exist yet and
// never overwrites a non-empty local slice with an empty cloud one (so freshly
// seeded project data survives until it has been pushed up).
export async function pullAll() {
  const { slices, settings, present } = await fetchAll();
  const st: AnyRow = useData.getState();
  const patch: Record<string, any> = {};
  for (const t of TABLES) {
    if (!present.has(t.slice)) continue;
    const cloudRows = (slices[t.slice] || []) as any[];
    const localRows = (st[t.slice] || []) as any[];
    if (cloudRows.length === 0 && localRows.length > 0) continue;
    patch[t.slice] = cloudRows;
  }
  if (settings) patch.settings = stripId(settings);
  useData.setState(patch);
}

const stripId = (s: any): Settings => {
  const { id, ...rest } = s;
  void id;
  return rest as Settings;
};

const snapshot = () => {
  const st: AnyRow = useData.getState();
  const s: Record<string, any[]> = {};
  TABLES.forEach((t) => { s[t.slice] = [...(st[t.slice] as any[])]; });
  return { slices: s, settings: st.settings };
};

// Diff two row arrays by key → what changed / what was removed.
function diff(prev: AnyRow[], next: AnyRow[], key: string) {
  const prevMap = new Map(prev.map((r) => [r[key], r]));
  const nextMap = new Map(next.map((r) => [r[key], r]));
  const changed = next.filter((r) => JSON.stringify(prevMap.get(r[key])) !== JSON.stringify(r));
  const removed = prev.filter((r) => !nextMap.has(r[key])).map((r) => r[key]);
  return { changed, removed };
}

let prev = snapshot();
let timer: any;
let applyingRealtime = false;
let started = false; // guard: set up sync/realtime only once (StrictMode calls init twice)

async function flush() {
  const next = snapshot();
  // Each table syncs independently so a not-yet-migrated table (e.g. projects)
  // can't block the others from syncing.
  for (const t of TABLES) {
    try {
      const { changed, removed } = diff(prev.slices[t.slice] || [], next.slices[t.slice] || [], t.key);
      if (changed.length) await upsertRows(t.table, changed, t.key);
      if (removed.length) {
        const { error } = await supabase!.from(t.table).delete().in(t.key, removed);
        if (error) throw error;
      }
    } catch (e: any) {
      console.warn('[cloud] sync skipped for', t.table, e?.message || e);
    }
  }
  try {
    if (JSON.stringify(prev.settings) !== JSON.stringify(next.settings)) {
      await supabase!.from('settings').upsert({ id: 1, ...next.settings }, { onConflict: 'id' });
    }
  } catch (e: any) { console.warn('[cloud] settings sync skipped', e?.message || e); }
  prev = next;
}

function startSync() {
  prev = snapshot();
  useData.subscribe(() => {
    // Changes we applied from a realtime event must not be pushed back.
    if (applyingRealtime) { prev = snapshot(); return; }
    clearTimeout(timer);
    timer = setTimeout(flush, 700); // debounce bursts (e.g. generating payroll)
  });
}

// Merge a single row change coming from another device into the local store.
function applyRealtime(table: string, evt: string, row: AnyRow | null, oldRow: AnyRow | null) {
  applyingRealtime = true;
  try {
    if (table === 'settings') {
      if (row) useData.setState({ settings: stripId(row) as any });
      return;
    }
    const cfg = TABLES.find((t) => t.table === table);
    if (!cfg) return;
    const key = cfg.key;
    const cur = (useData.getState() as any)[cfg.slice] as AnyRow[];
    if (evt === 'DELETE') {
      const id = oldRow?.[key];
      useData.setState({ [cfg.slice]: cur.filter((r) => r[key] !== id) } as any);
    } else {
      const exists = cur.some((r) => r[key] === row![key]);
      const next = exists ? cur.map((r) => (r[key] === row![key] ? row! : r)) : [row!, ...cur];
      useData.setState({ [cfg.slice]: next } as any);
    }
  } finally {
    applyingRealtime = false;
  }
}

// Live sync: push other devices' inserts/updates/deletes into this app instantly.
function startRealtime() {
  supabase!.removeAllChannels(); // avoid duplicate channel on re-init
  const ch = supabase!.channel('boltap-live');
  ['employees', 'attendance', 'ledger', 'salary_details', 'salary_postings', 'advance_requests',
    'projects', 'expenditure_categories', 'project_expenditure', 'project_payments',
    'expenditure_requests', 'settings']
    .forEach((table) => {
      ch.on('postgres_changes' as any, { event: '*', schema: 'public', table }, (p: any) => {
        try { applyRealtime(table, p.eventType, p.new, p.old); }
        catch (e) { console.error('[cloud] realtime apply failed:', e); }
      });
    });
  ch.subscribe();
}

// Called once at app start. Returns when the store reflects the cloud (or
// immediately in local-only mode). Never throws — falls back to local data.
export async function initCloud(): Promise<{ mode: 'cloud' | 'local'; error?: string }> {
  if (!cloudEnabled || !supabase) return { mode: 'local' };
  try {
    const { slices } = await fetchAll();
    const empty = TABLES.every((t) => (slices[t.slice] || []).length === 0);
    if (empty) {
      await pushAll();          // first run: seed cloud from the local/demo data
    } else {
      await pullAll();          // returning: load cloud data into the app
    }
    if (!started) {
      started = true;
      startSync();
      try { startRealtime(); } catch (e) { console.error('[cloud] realtime setup failed (sync still works):', e); }
    }
    cloudState.mode = 'cloud';
    return { mode: 'cloud' };
  } catch (e: any) {
    console.error('[cloud] init failed, staying local:', e);
    cloudState.mode = 'local';
    cloudState.error = e?.message || String(e);
    return { mode: 'local', error: cloudState.error };
  }
}
