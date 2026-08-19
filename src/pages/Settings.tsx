import React, { useState } from 'react';
import { Save, RotateCcw, Database, Building2, CreditCard, Trash2, Info, FileSpreadsheet, Cloud, CloudOff, UploadCloud, DownloadCloud, MapPin, Image as ImageIcon, ScanText, LayoutGrid, HardDrive, AlertTriangle } from 'lucide-react';
import { useData } from '../store/useData';
import { usePrefs } from '../store/usePrefs';
import { Card, Field, Badge, Modal } from '../components/ui';
import { isValidVpa } from '../lib/upi';
import { downloadBackup } from '../lib/backup';
import { compressImage } from '../lib/image';
import { cloudEnabled, cloudState, pushAll, pullAll, wipeAllCloud } from '../lib/cloud';
import { uploadBackupToDrive, DRIVE_FOLDER_ID } from '../lib/drive';

export const Settings: React.FC = () => {
  const { settings, employees, attendance, ledger, resetAll } = useData();
  const { ocrKey, setOcrKey, ocrProvider, setOcrProvider } = usePrefs();
  const [form, setForm] = useState({
    ...settings,
    quick_menu: settings.quick_menu?.length ? settings.quick_menu : ['/', '/employees', '/attendance', '/projects', '/project-expense'],
  });
  const [saved, setSaved] = useState(false);
  const [cloudMsg, setCloudMsg] = useState('');
  const [busy, setBusy] = useState(false);

  // Google Drive backup
  const [driveMsg, setDriveMsg] = useState('');
  const [driveBusy, setDriveBusy] = useState(false);
  const [driveSaved, setDriveSaved] = useState(false);

  // Wipe-all flow (PIN protected)
  const [wipeOpen, setWipeOpen] = useState(false);
  const [wipePin, setWipePin] = useState('');
  const [wipeErr, setWipeErr] = useState('');
  const [wiping, setWiping] = useState(false);
  // Bill Scanning is a draft until saved (so choosing the API + key is deliberate).
  const [ocrDraft, setOcrDraft] = useState({ provider: ocrProvider, key: ocrKey });
  const [ocrSaved, setOcrSaved] = useState(false);
  const saveOcr = () => {
    setOcrProvider(ocrDraft.provider);
    setOcrKey(ocrDraft.key.trim());
    setOcrSaved(true); setTimeout(() => setOcrSaved(false), 1800);
  };

  // Quick menu (phone bottom bar) configuration.
  const [quickSaved, setQuickSaved] = useState(false);
  const toggleQuick = (to: string) => setForm((f) => {
    const cur = f.quick_menu || [];
    return { ...f, quick_menu: cur.includes(to) ? cur.filter((x) => x !== to) : [...cur, to] };
  });
  const saveQuick = () => {
    useData.setState({ settings: { ...useData.getState().settings, quick_menu: form.quick_menu } });
    setQuickSaved(true); setTimeout(() => setQuickSaved(false), 1800);
  };

  const cloudPush = async () => {
    setBusy(true); setCloudMsg('');
    try { await pushAll(); setCloudMsg('✓ Local data uploaded to Supabase.'); }
    catch (e: any) { setCloudMsg('⚠️ ' + (e?.message || 'Upload failed')); }
    finally { setBusy(false); }
  };
  const cloudPull = async () => {
    setBusy(true); setCloudMsg('');
    try { await pullAll(); setCloudMsg('✓ Loaded latest data from Supabase.'); }
    catch (e: any) { setCloudMsg('⚠️ ' + (e?.message || 'Download failed')); }
    finally { setBusy(false); }
  };

  const onLogo = async (file: File | null) => {
    if (!file) return;
    try { const d = await compressImage(file, 60 * 1024, 256); setForm((s) => ({ ...s, logo: d })); }
    catch { alert('Could not use that image'); }
  };

  const save = () => {
    if (form.admin_upi_id && !isValidVpa(form.admin_upi_id)) { alert('Business UPI ID looks invalid'); return; }
    if (!/^\d{4}$/.test(form.admin_pin || '')) { alert('Admin PIN must be exactly 4 digits'); return; }
    useData.setState({ settings: form });
    setSaved(true); setTimeout(() => setSaved(false), 1800);
  };

  const reset = () => {
    if (confirm('Reset ALL data back to the original Excel import? This wipes your changes.')) resetAll();
  };

  // Save the Drive backup config (URL + auto toggle) into settings.
  const saveDrive = () => {
    const url = (form.drive_backup_url || '').trim();
    if (url && !/^https:\/\/script\.google(usercontent)?\.com\//.test(url)) {
      setDriveMsg('⚠️ That URL should start with https://script.google.com/…'); return;
    }
    useData.setState({ settings: {
      ...useData.getState().settings,
      drive_backup_url: url || null,
      drive_backup_enabled: !!form.drive_backup_enabled,
    } });
    setDriveMsg(''); setDriveSaved(true); setTimeout(() => setDriveSaved(false), 1800);
  };

  const driveBackupNow = async () => {
    // Persist the latest URL/toggle first so a just-typed URL is used.
    useData.setState({ settings: {
      ...useData.getState().settings,
      drive_backup_url: (form.drive_backup_url || '').trim() || null,
      drive_backup_enabled: !!form.drive_backup_enabled,
    } });
    setDriveBusy(true); setDriveMsg('');
    const r = await uploadBackupToDrive('manual');
    setDriveMsg((r.ok ? '✓ ' : '⚠️ ') + r.msg);
    setDriveBusy(false);
  };

  // PIN-validated hard wipe: clears cloud (so it can't re-sync) + local storage.
  const doWipe = async () => {
    if (wipePin !== settings.admin_pin) { setWipeErr('Wrong admin PIN. Data was NOT deleted.'); return; }
    setWiping(true); setWipeErr('');
    try { await wipeAllCloud(); } catch { /* best effort — carry on with local wipe */ }
    localStorage.removeItem('boltap-data-v2');
    location.reload();
  };

  const backupNow = () => {
    const s = useData.getState();
    downloadBackup({
      employees: s.employees, attendance: s.attendance, ledger: s.ledger,
      salaryDetails: s.salaryDetails, postings: s.postings, requests: s.requests, settings: s.settings,
    }, 'manual');
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-800">Settings</h1>
        <p className="text-slate-400 text-sm">Business profile, payments & data</p>
      </div>

      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-700 flex items-center gap-2">
            {cloudEnabled ? <Cloud size={18} className="text-emerald-500" /> : <CloudOff size={18} className="text-slate-400" />} Cloud Sync
          </h3>
          <Badge tone={cloudState.mode === 'cloud' ? 'green' : cloudEnabled ? 'amber' : 'slate'}>
            {cloudState.mode === 'cloud' ? 'Connected to Supabase' : cloudEnabled ? 'Configured — not connected' : 'Local only'}
          </Badge>
        </div>
        {cloudEnabled && cloudState.mode !== 'cloud' && cloudState.error && (
          <div className="rounded-xl bg-rose-50 text-rose-700 p-3 text-sm">
            Connection error: {cloudState.error}. Run <code>supabase/policies.sql</code> in the Supabase SQL editor, then reload.
          </div>
        )}
        {cloudEnabled ? (
          <>
            <p className="text-sm text-slate-500">Data syncs automatically to your Supabase cloud on every change, across all phones.</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <button onClick={cloudPush} disabled={busy} className="btn-ghost flex-1"><UploadCloud size={16} /> Push local → cloud</button>
              <button onClick={cloudPull} disabled={busy} className="btn-ghost flex-1"><DownloadCloud size={16} /> Pull cloud → local</button>
            </div>
          </>
        ) : (
          <div className="rounded-xl bg-slate-50 text-slate-500 p-3 text-sm">
            Not connected. Add <code className="text-brand-600">VITE_SUPABASE_URL</code> and <code className="text-brand-600">VITE_SUPABASE_ANON_KEY</code> to a <code>.env</code> file (and run <code>supabase/schema.sql</code>) to turn on cloud sync, then restart the app.
          </div>
        )}
        {cloudMsg && <div className="text-sm font-semibold text-slate-600">{cloudMsg}</div>}
      </Card>

      <Card className="p-5 space-y-3">
        <h3 className="font-bold text-slate-700 flex items-center gap-2"><Building2 size={18} className="text-brand-500" /> Business Profile</h3>
        <div className="flex items-center gap-3">
          <label className="relative cursor-pointer shrink-0">
            <div className="h-16 w-16 rounded-2xl bg-slate-100 grid place-items-center overflow-hidden ring-1 ring-slate-200">
              {form.logo ? <img src={form.logo} alt="logo" className="h-full w-full object-cover" /> : <ImageIcon size={24} className="text-slate-300" />}
            </div>
            <span className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-brand-600 text-white grid place-items-center ring-2 ring-white"><ImageIcon size={12} /></span>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => onLogo(e.target.files?.[0] || null)} />
          </label>
          <div className="text-sm text-slate-500">
            <div className="font-semibold text-slate-700">Company Logo</div>
            <div className="text-xs">Tap to upload — shown next to the app name.</div>
            {form.logo && <button onClick={() => setForm({ ...form, logo: null })} className="text-xs text-rose-500 font-semibold mt-1">Remove logo</button>}
          </div>
        </div>
        <Field label="Business Name" hint="Shown next to the logo across the app.">
          <input className="input" value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} />
        </Field>
        <Field label="Business UPI ID" hint="Where salary/advance payments are sent from — shown on payment screens.">
          <input className="input" value={form.admin_upi_id} onChange={(e) => setForm({ ...form, admin_upi_id: e.target.value })} placeholder="business@okaxis" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Standard Hours / Day">
            <input type="number" className="input" value={form.standard_hours} onChange={(e) => setForm({ ...form, standard_hours: Number(e.target.value) })} />
          </Field>
          <Field label="Lunch / Break Hours" hint="Unpaid break auto-deducted from each shift (editable per entry).">
            <input type="number" step="0.5" className="input" value={form.lunch_hours} onChange={(e) => setForm({ ...form, lunch_hours: Number(e.target.value) })} />
          </Field>
          <Field label="Admin PIN (4 digits)" hint="Used to log in as Admin.">
            <input inputMode="numeric" maxLength={4} className="input tracking-widest" value={form.admin_pin} onChange={(e) => setForm({ ...form, admin_pin: e.target.value.replace(/\D/g, '') })} placeholder="1234" />
          </Field>
          <Field label="Delete Password" hint="Required to delete a project or an employee.">
            <input className="input tracking-widest" value={form.delete_password || ''} onChange={(e) => setForm({ ...form, delete_password: e.target.value })} placeholder="1234" />
          </Field>
        </div>
        <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 cursor-pointer">
          <input type="checkbox" className="mt-1 h-4 w-4 accent-brand-600" checked={!!form.location_required}
            onChange={(e) => setForm({ ...form, location_required: e.target.checked })} />
          <span className="flex items-center gap-2">
            <MapPin size={16} className="text-brand-500 shrink-0" />
            <span>
              <span className="block font-semibold text-slate-700 text-sm">Require location for attendance</span>
              <span className="block text-xs text-slate-400">When on, workers must share their location to open/close attendance. When off, it's optional.</span>
            </span>
          </span>
        </label>
        <button onClick={save} className="btn-primary">
          {saved ? '✓ Saved' : <><Save size={16} /> Save Settings</>}
        </button>
      </Card>

      <Card className="p-5 space-y-3">
        <h3 className="font-bold text-slate-700 flex items-center gap-2"><ScanText size={18} className="text-brand-500" /> Bill Scanning (OCR)</h3>
        <p className="text-sm text-slate-500">Auto-read purchase bills (photos or PDFs) on the Add Purchase screen.</p>
        <Field label="Service — choose one, then Save">
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => setOcrDraft({ ...ocrDraft, provider: 'mindee' })} className={`btn text-sm ${ocrDraft.provider === 'mindee' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}`}>Mindee</button>
            <button onClick={() => setOcrDraft({ ...ocrDraft, provider: 'ocrspace' })} className={`btn text-sm ${ocrDraft.provider === 'ocrspace' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}`}>OCR.space</button>
            <button onClick={() => setOcrDraft({ ...ocrDraft, provider: 'vision' })} className={`btn text-sm ${ocrDraft.provider === 'vision' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}`}>Vision</button>
          </div>
        </Field>
        {ocrDraft.provider === 'mindee' ? (
          <>
            <Field label="Mindee API Key" hint="Stored on THIS device only.">
              <input className="input" type="password" value={ocrDraft.key} onChange={(e) => setOcrDraft({ ...ocrDraft, key: e.target.value })} placeholder="your Mindee API key" autoComplete="off" />
            </Field>
            <div className="rounded-xl bg-amber-50 text-amber-700 p-3 text-xs flex gap-2">
              <Info size={14} className="shrink-0 mt-0.5" />
              <span><b>Most accurate</b> — auto-fills vendor, CGST/SGST/IGST and line items. But Mindee is a <b>14-day free trial, then paid</b> (from ~$44/mo). For free forever, use OCR.space.</span>
            </div>
          </>
        ) : ocrDraft.provider === 'ocrspace' ? (
          <>
            <Field label="OCR.space API Key (optional)" hint="Works without a key using the free shared one. For reliability, get your own free key — stored on THIS device only.">
              <input className="input" type="password" value={ocrDraft.key} onChange={(e) => setOcrDraft({ ...ocrDraft, key: e.target.value })} placeholder="leave blank to use the free key" autoComplete="off" />
            </Field>
            <div className="rounded-xl bg-emerald-50 text-emerald-700 p-3 text-xs flex gap-2">
              <Info size={14} className="shrink-0 mt-0.5" />
              <span>Free (25,000 scans/month), works in the app and the web. Get a free key at <b>ocr.space/ocrapi</b>. OCR pre-fills the purchase table — always review the rows before saving.</span>
            </div>
          </>
        ) : (
          <>
            <Field label="Google Vision API Key" hint="Stored on THIS device only. Restrict the key to the Vision API in Google Cloud.">
              <input className="input" type="password" value={ocrDraft.key} onChange={(e) => setOcrDraft({ ...ocrDraft, key: e.target.value })} placeholder="AIza…" autoComplete="off" />
            </Field>
            <div className="rounded-xl bg-sky-50 text-sky-700 p-3 text-xs flex gap-2">
              <Info size={14} className="shrink-0 mt-0.5" />
              <span>Get a key at console.cloud.google.com → enable Cloud Vision API → Credentials → API key. Free 1,000/month, then paid.</span>
            </div>
          </>
        )}
        <button onClick={saveOcr} className="btn-primary w-full">
          {ocrSaved ? '✓ Bill scanning saved' : <><Save size={16} /> Save Bill Scanning</>}
        </button>
      </Card>

      <Card className="p-5 space-y-3">
        <h3 className="font-bold text-slate-700 flex items-center gap-2"><Database size={18} className="text-brand-500" /> Data</h3>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl bg-slate-50 p-3"><div className="text-2xl font-extrabold text-slate-700">{employees.length}</div><div className="text-xs text-slate-400 font-semibold">Employees</div></div>
          <div className="rounded-xl bg-slate-50 p-3"><div className="text-2xl font-extrabold text-slate-700">{attendance.length}</div><div className="text-xs text-slate-400 font-semibold">Attendance</div></div>
          <div className="rounded-xl bg-slate-50 p-3"><div className="text-2xl font-extrabold text-slate-700">{ledger.length}</div><div className="text-xs text-slate-400 font-semibold">Ledger</div></div>
        </div>
        <div className="rounded-xl bg-sky-50 text-sky-700 p-3 text-sm flex gap-2">
          <Info size={16} className="shrink-0 mt-0.5" />
          <span>Data is stored locally in your browser. A full backup (.xlsx, opens in Google Sheets) is auto-saved every time you post weekly payroll. Later this connects to Supabase for cloud sync.</span>
        </div>
        <button onClick={backupNow} className="btn-success w-full"><FileSpreadsheet size={16} /> Backup All Data now (Excel / Google Sheets)</button>
        <div className="flex flex-col sm:flex-row gap-2">
          <button onClick={reset} className="btn-ghost flex-1"><RotateCcw size={16} /> Reset to Excel Import</button>
          <button onClick={() => { setWipePin(''); setWipeErr(''); setWipeOpen(true); }} className="btn-danger flex-1"><Trash2 size={16} /> Wipe All Data</button>
        </div>
      </Card>

      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-700 flex items-center gap-2"><HardDrive size={18} className="text-brand-500" /> Google Drive Backup</h3>
          <Badge tone={settings.drive_backup_enabled && settings.drive_backup_url ? 'green' : 'slate'}>
            {settings.drive_backup_enabled && settings.drive_backup_url ? 'Auto weekly ON' : 'Off'}
          </Badge>
        </div>
        <p className="text-sm text-slate-500">Automatically saves a full backup (.xlsx) into your shared Drive folder <b>boltap_Vercel_Backup</b> once a week — and any time you tap the button below.</p>
        <Field label="Apps Script Web-App URL" hint="Paste the /exec URL from your deployed Google Apps Script (see setup steps below).">
          <input className="input" value={form.drive_backup_url || ''} onChange={(e) => setForm({ ...form, drive_backup_url: e.target.value })} placeholder="https://script.google.com/macros/s/…/exec" autoComplete="off" />
        </Field>
        <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 cursor-pointer">
          <input type="checkbox" className="mt-1 h-4 w-4 accent-brand-600" checked={!!form.drive_backup_enabled}
            onChange={(e) => setForm({ ...form, drive_backup_enabled: e.target.checked })} />
          <span>
            <span className="block font-semibold text-slate-700 text-sm">Auto-backup to Drive every week</span>
            <span className="block text-xs text-slate-400">Runs on app open if 7+ days have passed since the last upload.</span>
          </span>
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <button onClick={saveDrive} className="btn-ghost flex-1">{driveSaved ? '✓ Saved' : <><Save size={16} /> Save Drive Settings</>}</button>
          <button onClick={driveBackupNow} disabled={driveBusy} className="btn-success flex-1"><HardDrive size={16} /> {driveBusy ? 'Uploading…' : 'Backup to Drive now'}</button>
        </div>
        {driveMsg && <div className="text-sm font-semibold text-slate-600">{driveMsg}</div>}
        {settings.last_drive_backup && (
          <div className="text-xs text-slate-400">Last Drive backup: {new Date(settings.last_drive_backup).toLocaleString('en-IN')}</div>
        )}
        <details className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
          <summary className="font-semibold text-slate-600 cursor-pointer">One-time setup (≈2 min) — how to connect Drive</summary>
          <ol className="list-decimal ml-4 mt-2 space-y-1">
            <li>Open <b>script.google.com</b> → <b>New project</b>.</li>
            <li>Delete the sample code, paste the Boltaptec backup script (given to you), and Save.</li>
            <li>Click <b>Deploy → New deployment → Web app</b>. Set <b>Execute as: Me</b> and <b>Who has access: Anyone</b>. Deploy &amp; authorize.</li>
            <li>Copy the <b>Web app URL</b> (ends in <code>/exec</code>) and paste it above, then Save.</li>
            <li>Backups land in folder ID <code>{DRIVE_FOLDER_ID}</code>.</li>
          </ol>
        </details>
      </Card>

      <Card className="p-5">
        <h3 className="font-bold text-slate-700 flex items-center gap-2 mb-2"><CreditCard size={18} className="text-brand-500" /> Integrations</h3>
        <div className="space-y-2 text-sm">
          {[
            ['GitHub', 'Version control & CI', true],
            ['Supabase', 'Cloud database + auth', cloudEnabled],
            ['Vercel', 'Web hosting', false],
            ['Capacitor', 'Android APK build', false],
            ['UPI / GPay', 'Payments', true],
          ].map(([n, d, on]) => (
            <div key={n as string} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
              <div><div className="font-semibold text-slate-700">{n}</div><div className="text-xs text-slate-400">{d}</div></div>
              <Badge tone={on ? 'green' : 'slate'}>{on ? 'Ready' : 'Pending setup'}</Badge>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5 space-y-3">
        <h3 className="font-bold text-slate-700 flex items-center gap-2"><LayoutGrid size={18} className="text-brand-500" /> Quick Menu (phone bottom bar)</h3>
        <p className="text-sm text-slate-500">Choose which menus show in the bottom quick bar on phones — pick up to 5. (On the web, all menus are in the top ☰ menu.)</p>
        <div className="grid grid-cols-2 gap-2">
          {ADMIN_MENUS.map((m) => {
            const sel = (form.quick_menu || []).includes(m.to);
            return (
              <button key={m.to} onClick={() => toggleQuick(m.to)}
                className={`flex items-center gap-2 p-2.5 rounded-xl border text-left text-sm transition ${sel ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-slate-300'}`}>
                <div className={`h-4 w-4 rounded-md border-2 shrink-0 ${sel ? 'bg-brand-600 border-brand-600' : 'border-slate-300'}`} />
                <span className="font-semibold text-slate-700 truncate">{m.label}</span>
              </button>
            );
          })}
        </div>
        <div className="text-xs text-slate-400">{(form.quick_menu || []).length} selected {(form.quick_menu || []).length > 5 ? '· more than 5 may look crowded' : ''}</div>
        <button onClick={saveQuick} className="btn-primary w-full">{quickSaved ? '✓ Quick menu saved' : <><Save size={16} /> Save Quick Menu</>}</button>
      </Card>

      <p className="text-center text-xs text-slate-400 py-2">Boltaptec Workforce Manager · v1.0 · Local build</p>

      <Modal open={wipeOpen} onClose={() => !wiping && setWipeOpen(false)} title="Wipe All Data">
        <div className="space-y-4">
          <div className="rounded-xl bg-rose-50 text-rose-700 p-3 text-sm flex gap-2">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <div>
              <b>This permanently deletes everything</b> — {employees.length} employees, {attendance.length} attendance records, {ledger.length} ledger entries, all projects, salaries and settings{cloudEnabled ? ', on this device AND in the cloud' : ''}. This cannot be undone.
            </div>
          </div>
          <p className="text-sm text-slate-500">Consider a <b>Backup</b> or a <b>Drive backup</b> first. To continue, enter the Admin PIN.</p>
          <Field label="Admin PIN">
            <input inputMode="numeric" maxLength={4} autoFocus
              className="input tracking-[0.5em] text-center text-lg"
              value={wipePin}
              onChange={(e) => { setWipePin(e.target.value.replace(/\D/g, '')); setWipeErr(''); }}
              placeholder="••••" />
          </Field>
          {wipeErr && <div className="text-sm font-semibold text-rose-600">{wipeErr}</div>}
          <div className="flex gap-2 pt-1">
            <button onClick={() => setWipeOpen(false)} disabled={wiping} className="btn-ghost flex-1">Cancel</button>
            <button onClick={doWipe} disabled={wiping || wipePin.length !== 4} className="btn-danger flex-1">
              <Trash2 size={16} /> {wiping ? 'Wiping…' : 'Delete Everything'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

const ADMIN_MENUS = [
  { to: '/', label: 'Dashboard' },
  { to: '/employees', label: 'Employees' },
  { to: '/attendance', label: 'Attendance' },
  { to: '/projects', label: 'Projects' },
  { to: '/project-expense', label: 'Project Expense' },
  { to: '/salary', label: 'Salary' },
  { to: '/advances', label: 'Advances' },
  { to: '/ledger', label: 'Ledger' },
  { to: '/settings', label: 'Settings' },
];
