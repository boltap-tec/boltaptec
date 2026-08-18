export const inr = (n: number | null | undefined): string => {
  const v = Number(n || 0);
  return '₹' + v.toLocaleString('en-IN', { maximumFractionDigits: 0 });
};

export const inr2 = (n: number | null | undefined): string => {
  const v = Number(n || 0);
  return '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const fmtDate = (d: string | Date | null | undefined): string => {
  if (!d) return '—';
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const fmtDateShort = (d: string | Date | null | undefined): string => {
  if (!d) return '—';
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

// Local calendar date (YYYY-MM-DD). Uses local time, not UTC — for IST (UTC+5:30)
// a UTC date can be a day behind, which broke early-morning open/close matching.
export const today = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const uid = (prefix = ''): string =>
  prefix + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

// Employee display name from "Pavish_E2" -> "Pavish"
export const shortName = (fullId: string, fallback?: string): string =>
  fallback || fullId.replace(/_E\d+$/, '');

export const initials = (name: string): string =>
  name.split(/[\s_]+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('');

// "Paid outside the app via GPay" is stored as a marker in the ledger remark,
// so it needs no new DB column and syncs to Supabase like any other change.
export const GPAY_SENT = '✓GPay';
export const isGpaySent = (remark?: string | null): boolean => (remark || '').includes(GPAY_SENT);
export const displayRemark = (remark?: string | null): string =>
  (remark || '').replace(GPAY_SENT, '').replace(/^[\s·|]+|[\s·|]+$/g, '').trim();

// Current time as "3:43 pm"
export const nowClock = (): string =>
  new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();

// Current time as "15:43" for <input type="time">
export const nowClock24 = (): string => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

// "9:00 am" | "09:30:00" | "15:43" -> "15:43" for <input type="time">
export const to24h = (s: string | null | undefined): string => {
  if (!s) return '';
  const m = s.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap]m)?$/i);
  if (!m) return '';
  let h = parseInt(m[1], 10);
  const min = m[2];
  const ap = m[3]?.toLowerCase();
  if (ap === 'pm' && h < 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${min}`;
};

// "15:43" -> "3:43 pm"  (leaves values already in am/pm form untouched)
export const to12h = (hhmm: string): string => {
  if (!hhmm) return hhmm;
  if (/[ap]m/i.test(hhmm)) return hhmm.toLowerCase();
  const [h, m] = hhmm.split(':').map(Number);
  if (isNaN(h)) return hhmm;
  const ap = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m || 0).padStart(2, '0')} ${ap}`;
};
