import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wallet, HandCoins, TrendingDown, Clock, Send, Banknote, Smartphone,
  ArrowRight, CheckCircle2, XCircle, Sparkles, CalendarDays,
  LogIn, LogOut, Camera, Fingerprint, FileDown, MapPin, Receipt,
} from 'lucide-react';
import { useAuth } from '../store/useAuth';
import { useData } from '../store/useData';
import { Card, Avatar, Badge, Modal, Field, EmptyState, StatCard } from '../components/ui';
import { inr, fmtDate, today } from '../lib/format';
import { advancePending, salaryForPeriod } from '../lib/calc';
import { getDeviceId, shortDeviceId } from '../lib/device';
import { compressImage } from '../lib/image';
import { sharePayslip } from '../lib/payslip';
import { getLocation } from '../lib/geo';
import { useT } from '../lib/i18n';

export const EmployeeHome: React.FC = () => {
  const { session } = useAuth();
  const navigate = useNavigate();
  const t = useT();
  const { employees, ledger, attendance, requests, createRequest, markIn, markOut, updateEmployee, settings } = useData();
  const emp = employees.find((e) => e.employee_id === session?.employee_id);

  const [reqOpen, setReqOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [method, setMethod] = useState<'UPI' | 'Cash'>('UPI');
  const [msg, setMsg] = useState('');
  const [locating, setLocating] = useState(false);
  const deviceId = getDeviceId();

  const myLedger = useMemo(() => ledger.filter((l) => l.employee_id === emp?.employee_id), [ledger, emp]);
  const myReq = useMemo(() => requests.filter((r) => r.employee_id === emp?.employee_id), [requests, emp]);
  const thisWeek = useMemo(() => {
    if (!emp) return { total_hours: 0, salary_amount: 0, days: 0 };
    const from = new Date(); from.setDate(from.getDate() - 6);
    return salaryForPeriod(attendance, emp.employee_id, from.toISOString().slice(0, 10), today());
  }, [attendance, emp]);

  if (!emp) return <EmptyState title="Account not found" hint="Ask your admin to add you." />;

  const ap = advancePending(emp);
  const sp = Math.max(0, emp.total_salary - emp.salary_given);
  const repaidPct = emp.total_advance_given > 0 ? Math.round((emp.advance_recovered / emp.total_advance_given) * 100) : 0;
  const nextPayday = Math.max(0, sp - Math.min(emp.weekly_recovery || 0, ap));
  const pendingReq = myReq.find((r) => r.status === 'Pending');

  // Today's attendance / punch state. The open punch is matched regardless of
  // date so an overnight or early-morning shift can still be closed.
  const day = today();
  const todays = attendance.filter((a) => a.employee_id === emp.employee_id && a.date === day);
  const openRow = attendance.find((a) => a.employee_id === emp.employee_id && !a.time_out && a.status !== 'rejected');
  const doneToday = todays.filter((a) => a.time_out);
  const doneHours = doneToday.reduce((s, a) => s + a.total_hours, 0);
  const deviceOk = !emp.device_id || emp.device_id === deviceId;

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3500); };

  // Capture location for a punch. When the admin has made it compulsory and we
  // can't get a fix, returns 'blocked' so the punch is refused.
  const captureLocation = async (): Promise<{ loc: { lat: number; lng: number } | null; blocked: boolean }> => {
    setLocating(true);
    try {
      const loc = await getLocation();
      if (!loc && settings.location_required) return { loc: null, blocked: true };
      return { loc, blocked: false };
    } finally { setLocating(false); }
  };

  const doIn = async () => {
    if (emp.device_id && emp.device_id !== deviceId) { flash('❌ This is not your registered phone. Ask your admin to reset your device.'); return; }
    const { loc, blocked } = await captureLocation();
    if (blocked) { flash('📍 Please enable location — your admin requires it to open attendance.'); return; }
    if (!emp.device_id) updateEmployee(emp.employee_id, { device_id: deviceId }); // bind on first use
    const r = markIn(emp.employee_id, loc);
    flash((r.ok ? '✅ ' : '⚠️ ') + r.msg + (r.ok ? ' · sent to admin for review' : ''));
  };
  const doOut = async () => {
    const { loc, blocked } = await captureLocation();
    if (blocked) { flash('📍 Please enable location — your admin requires it to close attendance.'); return; }
    const r = markOut(emp.employee_id, loc);
    flash((r.ok ? '✅ ' : '⚠️ ') + r.msg);
  };

  const onPhoto = async (f: File | null) => {
    if (!f) return;
    try { const d = await compressImage(f); updateEmployee(emp.employee_id, { photo: d }); flash('✅ Photo updated'); }
    catch (e: any) { flash('⚠️ ' + (e?.message || 'Could not use that image')); }
  };

  const submit = () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) return;
    createRequest({ employee_id: emp.employee_id, employee_name: emp.name, amount: amt, reason: reason.trim() || 'Advance request', method });
    setReqOpen(false); setAmount(''); setReason('');
  };

  return (
    <div className="space-y-4 max-w-xl mx-auto">
      {/* Greeting */}
      <div className="flex items-center gap-3">
        <label className="relative cursor-pointer shrink-0">
          <Avatar name={emp.name} src={emp.photo} size={52} />
          <span className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-brand-600 text-white grid place-items-center ring-2 ring-white"><Camera size={13} /></span>
          <input type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0] || null)} />
        </label>
        <div>
          <div className="text-slate-400 text-sm">{new Date().getHours() < 12 ? t('home.goodMorning') : new Date().getHours() < 17 ? t('home.goodAfternoon') : t('home.goodEvening')},</div>
          <div className="text-xl font-extrabold text-slate-800">{emp.name} 👋</div>
        </div>
      </div>

      {msg && <div className="rounded-xl bg-slate-800 text-white text-sm font-semibold px-4 py-2.5 text-center">{msg}</div>}

      {/* Punch in / out */}
      <Card className={`p-4 ${openRow ? 'border-l-4 border-l-emerald-500' : ''}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="font-bold text-slate-800 flex items-center gap-2"><Clock size={17} className="text-brand-500" /> {t('home.todayAttendance')}</div>
            <div className="text-sm text-slate-500 mt-0.5">
              {openRow ? <>Opened at <b className="text-emerald-600">{openRow.time_in}</b> — {t('home.workingNow')}</>
                : doneToday.length ? <>{t('home.doneForNow')} · {doneHours}h</>
                : t('home.notOpened')}
            </div>
          </div>
          {openRow
            ? <button onClick={doOut} disabled={locating} className="btn-danger"><LogOut size={18} /> {locating ? t('home.locating') : t('home.close')}</button>
            : doneToday.length > 0
              ? <span className="inline-flex items-center gap-1.5 text-emerald-600 font-bold text-sm px-3 py-2 rounded-xl bg-emerald-50"><CheckCircle2 size={16} /> Done today</span>
              : <button onClick={doIn} disabled={!deviceOk || locating} className="btn-success"><LogIn size={18} /> {locating ? t('home.locating') : t('home.open')}</button>}
        </div>
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 text-xs">
          <Fingerprint size={14} className={deviceOk ? 'text-emerald-500' : 'text-rose-500'} />
          {emp.device_id
            ? deviceOk
              ? <span className="text-slate-400">Registered phone · {shortDeviceId(emp.device_id)}</span>
              : <span className="text-rose-500 font-semibold">Different phone detected — attendance locked. Ask admin to reset.</span>
            : <span className="text-slate-400">Your phone registers automatically the first time you open attendance.</span>}
        </div>
        <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-400">
          <MapPin size={12} />
          {settings.location_required
            ? 'Location required — allow it when asked. Admin reviews & posts your attendance.'
            : 'Your open/close attendance goes to the admin to review & post.'}
        </div>
      </Card>

      {/* Quick actions: request advance / project expense */}
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => setReqOpen(true)} className="card p-4 flex flex-col items-center gap-1.5 text-center hover:shadow-soft transition">
          <div className="h-10 w-10 rounded-xl bg-brand-600 text-white grid place-items-center"><HandCoins size={20} /></div>
          <div className="font-bold text-slate-800 text-sm">Advance Request</div>
        </button>
        <button onClick={() => navigate('/project-expense?request=1')} className="card p-4 flex flex-col items-center gap-1.5 text-center hover:shadow-soft transition">
          <div className="h-10 w-10 rounded-xl bg-emerald-600 text-white grid place-items-center"><Receipt size={20} /></div>
          <div className="font-bold text-slate-800 text-sm">Expense Request</div>
        </button>
      </div>

      {/* Hero: what you'll get next payday */}
      <Card className="p-5 bg-gradient-to-br from-brand-600 to-indigo-700 text-white border-0">
        <div className="flex items-center gap-1.5 text-white/80 text-sm font-semibold"><Sparkles size={15} /> You'll receive on next payday</div>
        <div className="text-4xl font-extrabold mt-1">{inr(nextPayday)}</div>
        <div className="flex gap-4 mt-3 text-sm">
          <div><div className="text-white/60 text-xs">Salary earned</div><div className="font-bold">{inr(sp)}</div></div>
          {(emp.weekly_recovery || 0) > 0 && ap > 0 && (
            <div><div className="text-white/60 text-xs">Advance deduction</div><div className="font-bold">− {inr(Math.min(emp.weekly_recovery || 0, ap))}</div></div>
          )}
        </div>
      </Card>

      {/* Two money cards */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Salary to receive" value={inr(sp)} sub="money coming to you" tone="bg-emerald-50 text-emerald-600" icon={<Wallet size={20} />} />
        <StatCard label="Advance to repay" value={inr(ap)} sub={ap > 0 ? 'from your salary' : 'all clear 🎉'} tone="bg-amber-50 text-amber-600" icon={<HandCoins size={20} />} />
      </div>

      {/* Pending advance request status */}
      {pendingReq && (
        <Card className="p-4 border-l-4 border-l-amber-400 bg-amber-50/50">
          <div className="flex items-center gap-3">
            <Clock size={22} className="text-amber-500" />
            <div className="flex-1">
              <div className="font-bold text-slate-800">Request sent — waiting for admin</div>
              <div className="text-sm text-slate-500">{inr(pendingReq.amount)} · {pendingReq.reason}</div>
            </div>
            <Badge tone="amber">Pending</Badge>
          </div>
        </Card>
      )}

      {/* Repayment progress */}
      {emp.total_advance_given > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-slate-800 flex items-center gap-2"><TrendingDown size={17} className="text-amber-500" /> Advance Repayment</h3>
            <span className="text-sm font-bold text-slate-600">{repaidPct}% repaid</span>
          </div>
          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all" style={{ width: `${repaidPct}%` }} />
          </div>
          <div className="flex justify-between text-xs text-slate-400 mt-1.5">
            <span>Repaid {inr(emp.advance_recovered)}</span>
            <span>Total {inr(emp.total_advance_given)}</span>
          </div>
          {(emp.weekly_recovery || 0) > 0 && ap > 0 && (
            <div className="mt-2 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
              💡 {inr(emp.weekly_recovery || 0)} is deducted each payday until your advance is cleared.
            </div>
          )}
        </Card>
      )}

      {/* This week */}
      <Card className="p-4">
        <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-3"><CalendarDays size={17} className="text-brand-500" /> This Week</h3>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-slate-50 p-3"><div className="text-2xl font-extrabold text-slate-700">{thisWeek.days}</div><div className="text-xs text-slate-400 font-semibold">Days</div></div>
          <div className="rounded-xl bg-slate-50 p-3"><div className="text-2xl font-extrabold text-slate-700">{thisWeek.total_hours}</div><div className="text-xs text-slate-400 font-semibold">Hours</div></div>
          <div className="rounded-xl bg-emerald-50 p-3"><div className="text-2xl font-extrabold text-emerald-600">{inr(thisWeek.salary_amount)}</div><div className="text-xs text-slate-400 font-semibold">Earned</div></div>
        </div>
      </Card>

      {/* My requests history */}
      {myReq.filter((r) => r.status !== 'Pending').length > 0 && (
        <Card className="p-4">
          <h3 className="font-bold text-slate-800 mb-2">My Requests</h3>
          <div className="divide-y divide-slate-100">
            {myReq.slice(0, 8).map((r) => (
              <div key={r.id} className="flex items-center gap-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-700">{inr(r.amount)}</div>
                  <div className="text-xs text-slate-400 truncate">{r.reason} · {fmtDate(r.created_at)}</div>
                </div>
                {r.status === 'Approved' ? <Badge tone="green"><CheckCircle2 size={12} /> Approved</Badge>
                  : r.status === 'Rejected' ? <Badge tone="red"><XCircle size={12} /> Rejected</Badge>
                  : <Badge tone="amber"><Clock size={12} /> Pending</Badge>}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Recent money history */}
      <Card className="p-4">
        <h3 className="font-bold text-slate-800 mb-2">Recent Activity</h3>
        {myLedger.length ? (
          <div className="divide-y divide-slate-100">
            {myLedger.slice(0, 8).map((l) => {
              const amt = l.total_amount_given || l.salary_payment_amount || l.advance_payment || l.advance_recovery || 0;
              const isIn = l.category === 'Salary' || l.category === 'Advance_Payment';
              const label = l.category === 'Salary' ? 'Salary paid' : l.category === 'Advance_Payment' ? 'Advance received' : 'Advance repaid';
              return (
                <div key={l.id} className="flex items-center gap-3 py-2.5">
                  <div className={`h-9 w-9 rounded-lg grid place-items-center ${isIn ? 'bg-emerald-50 text-emerald-500' : 'bg-slate-100 text-slate-400'}`}>
                    {l.category === 'Salary' ? <Wallet size={16} /> : <HandCoins size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-700">{label}</div>
                    <div className="text-xs text-slate-400">{fmtDate(l.date)} · {l.method || 'Cash'}</div>
                  </div>
                  <span className={`text-sm font-bold ${l.category === 'Advance_Recovery' ? 'text-slate-400' : 'text-slate-700'}`}>{inr(amt)}</span>
                </div>
              );
            })}
          </div>
        ) : <EmptyState title="No activity yet" />}
      </Card>

      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => sharePayslip(emp, ledger, settings)} className="btn-primary"><FileDown size={16} /> My Payslip PDF</button>
        <button onClick={() => navigate('/my-history')} className="btn-ghost">Full history <ArrowRight size={16} /></button>
      </div>

      {/* Request modal */}
      <Modal open={reqOpen} onClose={() => setReqOpen(false)} title="Request an Advance">
        <div className="space-y-3">
          <div className="rounded-xl bg-amber-50 text-amber-700 p-3 text-sm flex items-center gap-2">
            <HandCoins size={18} /> You currently owe {inr(ap)}. The admin will review your request.
          </div>
          <Field label="How much do you need? (₹)">
            <input type="number" inputMode="numeric" autoFocus className="input text-2xl font-bold text-center" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
          </Field>
          <div className="flex gap-2">
            {[1000, 2000, 5000].map((q) => (
              <button key={q} onClick={() => setAmount(String(q))} className="btn-ghost flex-1 text-sm">{inr(q)}</button>
            ))}
          </div>
          <Field label="Reason">
            <textarea className="input" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. medical, rent, festival…" />
          </Field>
          <Field label="How do you want it?">
            <div className="grid grid-cols-2 gap-2">
              {(['UPI', 'Cash'] as const).map((m) => (
                <button key={m} onClick={() => setMethod(m)} className={`btn ${method === m ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  {m === 'Cash' ? <Banknote size={16} /> : <Smartphone size={16} />} {m}
                </button>
              ))}
            </div>
          </Field>
          <div className="flex gap-2 pt-1">
            <button onClick={() => setReqOpen(false)} className="btn-ghost flex-1">Cancel</button>
            <button onClick={submit} disabled={!amount} className="btn-primary flex-1"><Send size={16} /> Send Request</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
