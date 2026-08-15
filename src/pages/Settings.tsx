import React, { useState } from 'react';
import { Save, RotateCcw, Database, Building2, CreditCard, Trash2, Info, FileSpreadsheet, Cloud, CloudOff, UploadCloud, DownloadCloud } from 'lucide-react';
import { useData } from '../store/useData';
import { Card, Field, Badge } from '../components/ui';
import { isValidVpa } from '../lib/upi';
import { downloadBackup } from '../lib/backup';
import { cloudEnabled, pushAll, pullAll } from '../lib/cloud';

export const Settings: React.FC = () => {
  const { settings, employees, attendance, ledger, resetAll } = useData();
  const [form, setForm] = useState(settings);
  const [saved, setSaved] = useState(false);
  const [cloudMsg, setCloudMsg] = useState('');
  const [busy, setBusy] = useState(false);

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

  const save = () => {
    if (form.admin_upi_id && !isValidVpa(form.admin_upi_id)) { alert('Business UPI ID looks invalid'); return; }
    if (!/^\d{4}$/.test(form.admin_pin || '')) { alert('Admin PIN must be exactly 4 digits'); return; }
    useData.setState({ settings: form });
    setSaved(true); setTimeout(() => setSaved(false), 1800);
  };

  const reset = () => {
    if (confirm('Reset ALL data back to the original Excel import? This wipes your changes.')) resetAll();
  };

  const wipe = () => {
    if (confirm('Delete ALL local data permanently? The app will be empty.')) {
      localStorage.removeItem('boltap-data-v2');
      location.reload();
    }
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
          <Badge tone={cloudEnabled ? 'green' : 'slate'}>{cloudEnabled ? 'Connected to Supabase' : 'Local only'}</Badge>
        </div>
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
        <Field label="Business Name">
          <input className="input" value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} />
        </Field>
        <Field label="Business UPI ID" hint="Where salary/advance payments are sent from — shown on payment screens.">
          <input className="input" value={form.admin_upi_id} onChange={(e) => setForm({ ...form, admin_upi_id: e.target.value })} placeholder="business@okaxis" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Standard Hours / Day">
            <input type="number" className="input" value={form.standard_hours} onChange={(e) => setForm({ ...form, standard_hours: Number(e.target.value) })} />
          </Field>
          <Field label="Admin PIN (4 digits)" hint="Used to log in as Admin.">
            <input inputMode="numeric" maxLength={4} className="input tracking-widest" value={form.admin_pin} onChange={(e) => setForm({ ...form, admin_pin: e.target.value.replace(/\D/g, '') })} placeholder="1234" />
          </Field>
        </div>
        <button onClick={save} className="btn-primary">
          {saved ? '✓ Saved' : <><Save size={16} /> Save Settings</>}
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
          <button onClick={wipe} className="btn-danger flex-1"><Trash2 size={16} /> Wipe All Data</button>
        </div>
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

      <p className="text-center text-xs text-slate-400 py-2">BoltAp Workforce Manager · v1.0 · Local build</p>
    </div>
  );
};
