import React, { useState } from 'react';
import { HandCoins, TrendingDown, Banknote, Smartphone } from 'lucide-react';
import { useData } from '../store/useData';
import { Modal, Field } from './ui';
import { UpiPay } from './UpiPay';
import { inr, today } from '../lib/format';
import { advancePending } from '../lib/calc';
import type { Employee } from '../types';

// Compact "Advance / Recover / Salary" actions with the same record + UPI-pay
// flow as the employee detail page — usable straight from an employee card.
export const QuickPayActions: React.FC<{ emp: Employee }> = ({ emp }) => {
  const { employees, giveAdvance, recoverAdvance, paySalary } = useData();
  // Read the freshest employee so balances update live after an action.
  const e = employees.find((x) => x.employee_id === emp.employee_id) || emp;

  const [modal, setModal] = useState<null | 'advance' | 'recover' | 'salary'>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'Cash' | 'UPI'>('Cash');
  const [note, setNote] = useState('');
  const [weekly, setWeekly] = useState('');
  const [payDate, setPayDate] = useState(today());
  const [showPay, setShowPay] = useState(false);

  const ap = advancePending(e);

  const open = (m: 'advance' | 'recover' | 'salary') => {
    setModal(m); setAmount(''); setNote(''); setMethod('Cash'); setShowPay(false); setPayDate(today());
    setWeekly(String(e.weekly_recovery || ''));
  };
  const submit = () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) return;
    if (modal === 'advance') giveAdvance(e.employee_id, amt, method, note, Number(weekly) || 0, payDate);
    if (modal === 'recover') recoverAdvance(e.employee_id, amt, note, payDate);
    if (modal === 'salary') paySalary(e.employee_id, amt, null, method, payDate);
    if (method === 'UPI' && modal !== 'recover') setShowPay(true);
    else setModal(null);
  };

  const stop = (fn: () => void) => (ev: React.MouseEvent) => { ev.preventDefault(); ev.stopPropagation(); fn(); };

  return (
    <>
      <div className="mt-3 grid grid-cols-3 gap-1.5">
        <button onClick={stop(() => open('advance'))} className="flex items-center justify-center gap-1 rounded-lg bg-brand-50 text-brand-700 hover:bg-brand-100 text-xs font-semibold py-1.5 transition">
          <HandCoins size={14} /> Advance
        </button>
        <button onClick={stop(() => open('recover'))} className="flex items-center justify-center gap-1 rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100 text-xs font-semibold py-1.5 transition">
          <TrendingDown size={14} /> Recover
        </button>
        <button onClick={stop(() => open('salary'))} className="flex items-center justify-center gap-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold py-1.5 transition">
          <Banknote size={14} /> Salary
        </button>
      </div>

      <Modal open={!!modal} onClose={() => setModal(null)}
        title={modal === 'advance' ? `Give Advance · ${e.name}` : modal === 'recover' ? `Recover Advance · ${e.name}` : `Pay Salary · ${e.name}`}>
        {showPay && e.upi_id ? (
          <div className="space-y-3">
            <div className="rounded-xl bg-emerald-50 text-emerald-700 p-3 text-sm font-semibold text-center">
              ✓ Recorded {inr(Number(amount))} {modal === 'advance' ? 'advance' : 'salary'} for {e.name}
            </div>
            <UpiPay vpa={e.upi_id} name={e.name} amount={Number(amount)} note={modal === 'advance' ? 'Advance' : 'Salary'} phone={e.phone} />
            <button onClick={() => setModal(null)} className="btn-ghost w-full">Done</button>
          </div>
        ) : (
          <div className="space-y-3">
            {modal === 'recover' && <div className="text-sm text-slate-500">Current advance pending: <b className="text-rose-600">{inr(ap)}</b></div>}
            {modal === 'salary' && (
              <div className="rounded-xl bg-amber-50 text-amber-700 p-3 text-sm">
                Salary pending: <b>{inr(Math.max(0, e.total_salary - e.salary_given))}</b>
                <div className="text-xs text-amber-600/80 mt-0.5">Advance still due: {inr(ap)}</div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount (₹)">
                <input type="number" autoFocus className="input text-lg" value={amount} onChange={(ev) => setAmount(ev.target.value)} placeholder="0" />
              </Field>
              <Field label="Date">
                <input type="date" className="input" value={payDate} onChange={(ev) => setPayDate(ev.target.value)} />
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
              <input className="input" value={note} onChange={(ev) => setNote(ev.target.value)} placeholder="Reason / remark" />
            </Field>
            {modal === 'advance' && (
              <Field label="Repay per payday (₹) — optional" hint="Auto-deducts this much from each week's salary until the advance is cleared.">
                <input type="number" className="input" value={weekly} onChange={(ev) => setWeekly(ev.target.value)} placeholder="e.g. 500" />
              </Field>
            )}
            <div className="flex gap-2 pt-1">
              <button onClick={() => setModal(null)} className="btn-ghost flex-1">Cancel</button>
              <button onClick={submit} className="btn-primary flex-1">
                {method === 'UPI' && modal !== 'recover' ? 'Record & Pay' : 'Confirm'}
              </button>
            </div>
            {modal === 'advance' && e.upi_id == null && method === 'UPI' && (
              <p className="text-[11px] text-amber-600 text-center">No UPI ID on file — add one on their profile to pay via UPI.</p>
            )}
          </div>
        )}
      </Modal>
    </>
  );
};
