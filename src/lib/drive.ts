import { useData } from '../store/useData';
import { workbookBase64, backupFileName, type BackupData } from './backup';

// The shared Google Drive folder backups land in (boltap_Vercel_Backup).
// The Apps Script also defaults to this, but we pass it so one script can serve
// several folders if needed.
export const DRIVE_FOLDER_ID = '1FZKaziDD_5Cztb5q1jOIXPGQqFo_QIlx';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Snapshot every table the backup workbook needs, straight from the live store.
export const currentBackupData = (): BackupData => {
  const s = useData.getState();
  return {
    employees: s.employees,
    attendance: s.attendance,
    ledger: s.ledger,
    salaryDetails: s.salaryDetails,
    postings: s.postings,
    requests: s.requests,
    settings: s.settings,
  };
};

export interface DriveResult { ok: boolean; msg: string; fileName?: string; url?: string }

// POST the backup workbook to the user's Google Apps Script web-app, which saves
// it into the Drive folder as an .xlsx. We send Content-Type text/plain so the
// request stays a CORS "simple request" (no preflight — Apps Script can't answer
// an OPTIONS preflight). The script echoes JSON we can read back.
export async function uploadBackupToDrive(label = ''): Promise<DriveResult> {
  const settings = useData.getState().settings;
  const url = (settings.drive_backup_url || '').trim();
  if (!url) return { ok: false, msg: 'No Google Drive backup URL set in Settings.' };
  if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(url)) {
    return { ok: false, msg: 'That does not look like a Google Apps Script web-app URL.' };
  }

  const fileName = backupFileName(label);
  const dataBase64 = workbookBase64(currentBackupData());
  const body = JSON.stringify({
    filename: fileName,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    folderId: DRIVE_FOLDER_ID,
    business: settings.business_name,
    dataBase64,
  });

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body,
      redirect: 'follow',
    });
    let json: any = null;
    try { json = await res.json(); } catch { /* opaque / non-JSON response */ }
    if (json && json.ok === false) return { ok: false, msg: json.error || 'Apps Script reported an error.' };
    if (!res.ok && !json) return { ok: false, msg: `Upload failed (HTTP ${res.status}).` };

    // Success — stamp the time so the weekly scheduler waits another 7 days.
    const now = new Date().toISOString();
    useData.setState({ settings: { ...useData.getState().settings, last_drive_backup: now } });
    return { ok: true, msg: 'Backup uploaded to Google Drive.', fileName, url: json?.url };
  } catch (e: any) {
    return { ok: false, msg: e?.message || 'Network error uploading to Drive.' };
  }
}

// Called once on app start. If auto-backup is on and it's been ≥ 7 days (or
// never), quietly push a backup to Drive. Never throws.
export async function maybeWeeklyBackup(): Promise<void> {
  try {
    const s = useData.getState().settings;
    if (!s.drive_backup_enabled || !s.drive_backup_url) return;
    const last = s.last_drive_backup ? new Date(s.last_drive_backup).getTime() : 0;
    if (Date.now() - last < WEEK_MS) return;
    const r = await uploadBackupToDrive('weekly');
    if (!r.ok) console.warn('[drive] weekly backup skipped:', r.msg);
    else console.info('[drive] weekly backup uploaded:', r.fileName);
  } catch (e) {
    console.warn('[drive] weekly backup error:', e);
  }
}
