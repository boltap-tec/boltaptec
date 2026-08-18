import React, { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Phone, MapPin, Wallet, HandCoins, TrendingDown, Clock,
  Banknote, CreditCard, Smartphone, KeyRound, Fingerprint, RotateCcw, Trash2,
} from 'lucide-react';
import { useData } from '../store/useData';
import { Card, Avatar, Badge, Modal, Field, StatCard, EmptyState, StatusDot } from '../components/ui';
import { UpiPay } from '../components/UpiPay';
import { inr, fmtDate, today } from '../lib/format';
import { advancePending } from '../lib/calc';
import { shortDeviceId } from '../lib/device';

export const EmployeeDetail: React.FC = () => {
  const { id } = useParams();
  const { employees, ledger, attendance, giveAdvance, recoverAdvance, paySalary, updateEmployee, deleteLedgerEntry } = useData();
  const emp = employees.find((e) => e.employee_id === id);

  const [modal, setModal] = useState<null | 'advance' | 'recover' | 'salary'>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'Cash' | 'UPI'>('Cash');
  const [note, setNote] = useState('');
  const [weekly, setWeekly] = useState('');
  const [payDate, setPayDate] = useState(today());
  const [showPay, setShowPay] = useState(false);
  const [showPin, setShowPin] = useState(false);

  const allMyLedger = useMemo(() => ledger.filter((l) => l.employee_id === id), [ledger, id]);
  const myLedger = useMemo(() => allMyLedger.slice(0, 40), [allMyLedger]);

  // Advance given since the last salary payment (this period's fresh advance).
  const lastSalaryDate = useMemo(
    () => allMyLedger.filter((l) => l.category === 'Salary').map((l) => l.date).sort().pop(),
    [allMyLedger],
  );
  const advSinceSalary = useMemo(
    () => allMyLedger
      .filter((l) => l.category === 'Advance_Payment' && (!lastSalaryDate || l.date >= lastSalaryDate))
      .reduce((s, l) => s + (l.advance_payment || 0), 0),
    [allMyLedger, lastSalaryDate],
  );
  const myAtt = useMemo(() => attendance.filter((a) => a.employee_id === id), [attendance, id]);

  if (!emp) return (
    <div className="text-center py-20">
      <p className="text-slate-500">Employee not found.</p>
      <Link to="/employees" className="btn-ghost mt-3">Back to Employees</Link>
    </div>
  );

  const ap = advancePending(emp);
  const sp = Math.max(0, emp.total_salary - emp.salary_given);

  const open = (m: 'advance' | 'recover' | 'salary') => {
    setModal(m); setAmount(''); setNote(''); setMethod('Cash'); setShowPay(false); setPayDate(today());
    setWeekly(String(emp.weekly_recovery || ''));
  };

  const submit = () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) return;
    if (modal === 'advance') giveAdvance(emp.employee_id, amt, method, note, Number(weekly) || 0, payDate);
    if (modal === 'recover') recoverAdvance(emp.employee_id, amt, note, payDate);
    if (modal === 'salary') paySalary(emp.employee_id, amt, null, method, payDate);
    if (method === 'UPI' && modal !== 'recover') setShowPay(true);
    else setModal(null);
  };

  return (
    <div className="space-y-4">
      <Link to="/employees" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-700">
        <ArrowLeft size={16} /> Employees
      </Link>

      <Card className="p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <Avatar name={emp.name} src={emp.photo} size={72} />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold text-slate-800">{emp.name}</h1>
              <Badge tone={emp.status === 'Active' ? 'green' : 'slate'}>
                <StatusDot active={emp.status === 'Active'} /> {emp.status === 'Active' ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500 mt-1">
              {emp.phone && <span className="flex items-center gap-1"><Phone size={14} /> {emp.phone}</span>}
              {emp.address && <span className="flex items-center gap-1"><MapPin size={14} /> {emp.address}</span>}
              <span className="flex items-center gap-1"><Wallet size={14} /> {inr(emp.daily_wage)}/day · {inr(emp.hourly_rate)}/hr</span>
            </div>
            {emp.upi_id && <div className="text-xs text-slate-400 mt-1 flex items-center gap-1"><CreditCard size={13} /> {emp.upi_id}</div>}
          </div>
          <div className="grid grid-cols-3 sm:flex gap-2 w-full sm:w-auto">
            <button onClick={() => open('advance')} className="btn-primary text-sm flex-col sm:flex-row h-auto py-2"><HandCoins size={16} /> Advance</button>
            <button onClick={() => open('recover')} className="btn-ghost text-sm flex-col sm:flex-row h-auto py-2"><TrendingDown size={16} /> Recover</button>
            <button onClick={() => open('salary')} className="btn-success text-sm flex-col sm:flex-row h-auto py-2"><Banknote size={16} /> Salary</button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Advance Pending" value={inr(ap)} tone="bg-rose-50 text-rose-600" icon={<HandCoins size={20} />} />
        <StatCard label="Salary Pending" value={inr(sp)} tone="bg-amber-50 text-amber-600" icon={<Wallet size={20} />} />
        <StatCard label="Total Advance" value={inr(emp.total_advance_given)} tone="bg-slate-100 text-slate-600" icon={<TrendingDown size={20} />} />
        <StatCard label="Total Salary" value={inr(emp.total_salary)} tone="bg-emerald-50 text-emerald-600" icon={<Banknote size={20} />} />
      </div>

      {/* Login & Device */}
      <Card className="p-4">
        <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><KeyRound size={17} className="text-brand-500" /> Login & Device</h3>
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="text-xs text-slate-400 font-semibold">LOGIN PHONE</div>
            <div className="font-bold text-slate-700">{emp.phone || '— not set —'}</div>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="text-xs text-slate-400 font-semibold">LOGIN PIN</div>
            <div className="font-bold text-slate-700 flex items-center gap-2">
              {showPin ? (emp.pin || '—') : '••••'}
              <button onClick={() => setShowPin((v) => !v)} className="text-xs text-brand-600 font-semibold">{showPin ? 'Hide' : 'Show'}</button>
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="text-xs text-slate-400 font-semibold flex items-center gap-1"><Fingerprint size={12} /> REGISTERED PHONE</div>
            {emp.device_id ? (
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700 text-sm">{shortDeviceId(emp.device_id)}</span>
                <button onClick={() => { if (confirm('Reset registered device? The worker can then mark attendance from a new phone.')) updateEmployee(emp.employee_id, { device_id: null }); }}
                  className="text-xs text-rose-600 font-semibold flex items-center gap-1"><RotateCcw size={12} /> Reset</button>
              </div>
            ) : <div className="text-sm text-slate-400">Registers on first Mark IN</div>}
          </div>
        </div>
        {(emp.weekly_recovery || 0) > 0 && (
          <div className="mt-3 text-xs text-slate-500 bg-amber-50 text-amber-700 rounded-lg px-3 py-2 flex items-center gap-2">
            <TrendingDown size={14} /> Repayment plan: {inr(emp.weekly_recovery || 0)} deducted from each payday until advance is cleared.
          </div>
        )}
      </Card>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="p-4 lg:col-span-2">
          <h3 className="font-bold text-slate-800 mb-2">Transaction History</h3>
          {myLedger.length ? (
            <div className="divide-y divide-slate-100 max-h-[28rem] overflow-y-auto -mx-1 px-1">
              {myLedger.map((l) => {
                const amt = l.total_amount_given || l.salary_payment_amount || l.advance_payment || l.advance_recovery || 0;
                const tone = l.category === 'Salary' ? 'green' : l.category === 'Advance_Recovery' ? 'blue' : 'amber';
                return (
                  <div key={l.id} className="flex items-center gap-3 py-2.5 group">
                    <div className="flex-1 min-w-0">
                      <Badge tone={tone as any}>{l.category.replace(/_/g, ' ')}</Badge>
                      <div className="text-xs text-slate-400 mt-1">{fmtDate(l.date)} · {l.method || 'Cash'}{l.remark ? ` · ${l.remark}` : ''}</div>
                    </div>
                    <span className="text-sm font-bold text-slate-700">{inr(amt)}</span>
                    <button onClick={() => { if (confirm(`Delete this ${l.category.replace(/_/g, ' ')} of ${inr(amt)}? This reverses the balance.`)) deleteLedgerEntry(l.id); }}
                      className="p-1.5 rounded-lg text-rose-300 hover:bg-rose-50 hover:text-rose-500 opacity-0 group-hover:opacity-100" title="Delete"><Trash2 size={14} /></button>
                  </div>
                );
              })}
            </div>
          ) : <EmptyState title="No transactions yet" />}
        </Card>

        <Card className="p-4">
          <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2"><Clock size={17} /> Recent Attendance</h3>
          {myAtt.length ? (
            <div className="space-y-2 max-h-[28rem] overflow-y-auto">
              {myAtt.slice(0, 20).map((a) => (
                <div key={a.id} className="flex items-center justify-between text-sm border-b border-slate-50 pb-1.5">
                  <div>
                    <div className="font-semibold text-slate-600">{fmtDate(a.date)}</div>
                    <div className="text-xs text-slate-400">{a.total_hours}h {a.extra_time > 0 && <span className="text-brand-500">+{a.extra_time} OT</span>}</div>
                  </div>
                  <span className="font-bold text-slate-700">{inr(a.salary_amount)}</span>
                </div>
              ))}
            </div>
          ) : <EmptyState title="No attendance yet" />}
        </Card>
      </div>

      <Modal open={!!modal} onClose={() => setModal(null)}
        title={modal === 'advance' ? 'Give Advance' : modal === 'recover' ? 'Recover Advance' : 'Pay Salary'}>
        {showPay && emp.upi_id ? (
          <div className="space-y-3">
            <div className="rounded-xl bg-emerald-50 text-emerald-700 p-3 text-sm font-semibold text-center">
              ✓ Recorded {inr(Number(amount))} {modal === 'advance' ? 'advance' : 'salary'} for {emp.name}
            </div>
            <UpiPay vpa={emp.upi_id} name={emp.name} amount={Number(amount)} note={modal === 'advance' ? 'Advance' : 'Salary'} phone={emp.phone} />
            <button onClick={() => setModal(null)} className="btn-ghost w-full">Done</button>
          </div>
        ) : (
          <div className="space-y-3">
            {modal === 'recover' && <div className="text-sm text-slate-500">Current advance pending: <b className="text-rose-600">{inr(ap)}</b></div>}
            {modal === 'salary' && (
              <div className="rounded-xl bg-amber-50 text-amber-700 p-3 text-sm">
                Advance given since last salary{lastSalaryDate ? ` (${fmtDate(lastSalaryDate)})` : ''}: <b>{inr(advSinceSalary)}</b>
                <div className="text-xs text-amber-600/80 mt-0.5">Total advance still due: {inr(ap)}</div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount (₹)">
                <input type="number" autoFocus className="input text-lg" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
              </Field>
              <Field label="Date">
                <input type="date" className="input" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
              </Field>
            </div>
            {modal !== 'recover' && (
              <Field label="Payment Method">
                <div className="grid grid-cols-2 gap-2">
                  {(['Cash', 'UPI'] as const).map((m) => (
                    <button key={m} onClick={() => setMethod(m)}
                      className={`btn ${method === m ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                      {m === 'Cash' ? <Banknote size={16} /> : <Smartphone size={16} />} {m}
                    </button>
                  ))}
                </div>
              </Field>
            )}
            <Field label="Note (optional)">
              <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason / remark" />
            </Field>
            {modal === 'advance' && (
              <Field label="Repay per payday (₹) — optional" hint="Auto-deducts this much from each week's salary until the advance is cleared. Worker sees a progress bar.">
                <input type="number" className="input" value={weekly} onChange={(e) => setWeekly(e.target.value)} placeholder="e.g. 500" />
              </Field>
            )}
            <div className="flex gap-2 pt-1">
              <button onClick={() => setModal(null)} className="btn-ghost flex-1">Cancel</button>
              <button onClick={submit} className="btn-primary flex-1">
                {method === 'UPI' && modal !== 'recover' ? 'Record & Pay' : 'Confirm'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
