import React, { useState, useMemo } from 'react';
import {
  Calendar, CheckCircle2, Banknote, Smartphone, FileSpreadsheet, FileDown,
  Trash2, Clock, PlayCircle,
} from 'lucide-react';
import { useData } from '../store/useData';
import { Card, Avatar, Badge, Modal, Field, EmptyState } from '../components/ui';
import { UpiPay } from '../components/UpiPay';
import { inr, today, fmtDate } from '../lib/format';
import { salaryForPeriod, advancePending } from '../lib/calc';
import { downloadBackup } from '../lib/backup';
import { sharePayslip } from '../lib/payslip';
import type { SalaryDetail } from '../types';

const weekAgo = () => { const d = new Date(); d.setDate(d.getDate() - 6); return d.toISOString().slice(0, 10); };

// Derive a row's payment status.
const rowStatus = (d: SalaryDetail): 'Paid' | 'Partial' | 'Pending' => {
  const remaining = Math.max(0, (d.salary_amount - d.advance_recovered) - d.salary_given);
  if (remaining <= 0 && (d.salary_given > 0 || d.advance_recovered > 0 || d.salary_amount === 0)) return 'Paid';
  if (d.salary_given > 0 || d.advance_recovered > 0) return 'Partial';
  return 'Pending';
};

export const Salary: React.FC = () => {
  const { employees, attendance, postings, salaryDetails, generatePayroll, paySalaryDetail, deletePosting, settings, ledger } = useData();
  const [payDate, setPayDate] = useState(today());
  const [from, setFrom] = useState(weekAgo());
  const [to, setTo] = useState(today());
  const [tab, setTab] = useState<'generate' | 'history'>('generate');
  const [backupMsg, setBackupMsg] = useState('');

  // pay modal (operates on one grid row)
  const [payRow, setPayRow] = useState<SalaryDetail | null>(null);
  const [recover, setRecover] = useState('');
  const [cashNow, setCashNow] = useState('');
  const [method, setMethod] = useState<'Cash' | 'UPI'>('Cash');
  const [paid, setPaid] = useState<any>(null);
  const [showUpi, setShowUpi] = useState(false);

  const preview = useMemo(() =>
    employees
      .map((e) => ({ ...e, ...salaryForPeriod(attendance, e.employee_id, from, to, true) }))
      .filter((r) => r.days > 0 && r.salary_amount > 0),
    [employees, attendance, from, to]);

  const previewGross = preview.reduce((s, r) => s + r.salary_amount, 0);

  const doGenerate = () => {
    const posting = generatePayroll(from, to);
    if (!posting) { setBackupMsg('No unpaid attendance in this range.'); setTimeout(() => setBackupMsg(''), 4000); return; }
    const s = useData.getState();
    const file = downloadBackup({
      employees: s.employees, attendance: s.attendance, ledger: s.ledger,
      salaryDetails: s.salaryDetails, postings: s.postings, requests: s.requests, settings: s.settings,
    }, `${from}_${to}`);
    setBackupMsg(`Payroll generated & posted ✓  Backup: ${file}`);
    setTab('history');
    setTimeout(() => setBackupMsg(''), 6000);
  };

  const openPay = (d: SalaryDetail) => {
    const emp = employees.find((e) => e.employee_id === d.employee_id)!;
    const ap = advancePending(emp);
    const remaining = Math.max(0, (d.salary_amount - d.advance_recovered) - d.salary_given);
    const suggested = Math.min(ap, (emp.weekly_recovery || 0) > 0 ? (emp.weekly_recovery as number) : 0);
    setPayRow(d);
    setRecover(String(suggested));
    setCashNow(String(Math.max(0, remaining - suggested)));
    setMethod('Cash'); setPaid(null); setShowUpi(false); setPayDate(today());
  };

  // Advance given to this worker since their last salary payment.
  const advSinceSalary = (employeeId: string) => {
    const mine = ledger.filter((l) => l.employee_id === employeeId);
    const lastSal = mine.filter((l) => l.category === 'Salary').map((l) => l.date).sort().pop();
    const amt = mine.filter((l) => l.category === 'Advance_Payment' && (!lastSal || l.date >= lastSal))
      .reduce((s, l) => s + (l.advance_payment || 0), 0);
    return { amt, lastSal };
  };

  const confirmPay = () => {
    if (!payRow) return;
    const emp = employees.find((e) => e.employee_id === payRow.employee_id)!;
    const rec = Math.max(0, Math.min(Number(recover) || 0, advancePending(emp)));
    const cash = Math.max(0, Number(cashNow) || 0);
    if (rec + cash <= 0) return;
    paySalaryDetail(payRow.id, rec, cash, method, payDate);
    const updated = useData.getState().salaryDetails.find((x) => x.id === payRow.id)!;
    setPaid({ emp: useData.getState().employees.find((e) => e.employee_id === payRow.employee_id), recovery: rec, cash, method, row: updated });
    if (method === 'UPI' && emp.upi_id) setShowUpi(true);
  };

  const doPayslip = () => {
    if (!paid?.emp) return;
    sharePayslip(paid.emp, useData.getState().ledger, settings, {
      date: today(), period: payRow?.from_to, gross: payRow?.salary_amount,
      recovery: paid.recovery, net: paid.cash, method: paid.method,
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-800">Salary</h1>
        <p className="text-slate-400 text-sm">Generate a weekly payroll, then pay each worker from the posted grid</p>
      </div>

      {backupMsg && (
        <div className="rounded-xl bg-emerald-50 text-emerald-700 px-4 py-3 text-sm font-semibold flex items-center gap-2">
          <FileSpreadsheet size={17} /> {backupMsg}
        </div>
      )}

      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        {(['generate', 'history'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold capitalize transition ${tab === t ? 'bg-white shadow-sm text-brand-700' : 'text-slate-500'}`}>
            {t === 'generate' ? 'Generate' : `Posted Payrolls${postings.length ? ` (${postings.length})` : ''}`}
          </button>
        ))}
      </div>

      {tab === 'generate' ? (
        <>
          <Card className="p-4">
            <div className="flex flex-col sm:flex-row items-end gap-3">
              <Field label="From Date"><input type="date" className="input sm:w-44" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
              <Field label="To Date"><input type="date" className="input sm:w-44" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
              <div className="flex-1" />
              <div className="text-right">
                <div className="text-xs text-slate-400 font-semibold">UNPAID PAYROLL</div>
                <div className="text-2xl font-extrabold text-brand-600">{inr(previewGross)}</div>
                <div className="text-xs text-slate-400">{preview.length} employees</div>
              </div>
            </div>
          </Card>

          {preview.length === 0 ? (
            <Card className="p-6"><EmptyState icon={<Calendar size={40} />} title="No unpaid attendance in this range" hint="Everyone in this range is already in a posted payroll." /></Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="p-3 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500">
                These workers will be added to a new posted payroll:
              </div>
              <div className="divide-y divide-slate-100">
                {preview.map((r) => (
                  <div key={r.employee_id} className="flex items-center gap-3 px-4 py-2.5">
                    <Avatar name={r.name} src={r.photo} size={32} />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-700">{r.name}</div>
                      <div className="text-xs text-slate-400">{r.days} days · {r.total_hours}h{r.extra_time > 0 ? ` · ${r.extra_time}h OT` : ''}</div>
                    </div>
                    <span className="font-bold text-slate-700">{inr(r.salary_amount)}</span>
                  </div>
                ))}
              </div>
              <div className="p-3 border-t border-slate-100 flex justify-end">
                <button onClick={doGenerate} className="btn-primary"><PlayCircle size={17} /> Generate & Post Payroll</button>
              </div>
            </Card>
          )}
        </>
      ) : (
        <div className="space-y-4">
          {postings.length === 0 ? (
            <Card className="p-6"><EmptyState title="No posted payrolls yet" hint="Generate one from the Generate tab." /></Card>
          ) : [...postings].sort((a, b) => {
            // Newest posted payroll on top — the store prepends new ones, but a
            // cloud reload returns rows unordered, so sort explicitly by post time.
            const ka = a.created_at || a.to_date || a.from_date || '';
            const kb = b.created_at || b.to_date || b.from_date || '';
            return ka < kb ? 1 : ka > kb ? -1 : 0;
          }).map((p) => {
            const rows = salaryDetails.filter((d) => d.from_date === p.from_date && d.to_date === p.to_date);
            const gross = rows.reduce((s, d) => s + d.salary_amount, 0);
            const paidSum = rows.reduce((s, d) => s + d.salary_given, 0);
            const recSum = rows.reduce((s, d) => s + d.advance_recovered, 0);
            const remaining = rows.reduce((s, d) => s + Math.max(0, (d.salary_amount - d.advance_recovered) - d.salary_given), 0);
            const allPaid = rows.every((d) => rowStatus(d) === 'Paid');
            return (
              <Card key={p.id} className="overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 font-bold text-slate-700">
                    <Calendar size={16} className="text-brand-500" /> {fmtDate(p.from_date)} → {fmtDate(p.to_date)}
                    {allPaid ? <Badge tone="green"><CheckCircle2 size={12} /> Fully Paid</Badge> : <Badge tone="amber"><Clock size={12} /> {inr(remaining)} left</Badge>}
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-slate-400">Gross <b className="text-slate-600">{inr(gross)}</b></span>
                    <span className="text-emerald-500">Paid <b>{inr(paidSum)}</b></span>
                    <span className="text-sky-500">Recovered <b>{inr(recSum)}</b></span>
                    <button onClick={() => { if (confirm('Delete this payroll? Attendance days return to unpaid and balances roll back.')) deletePosting(p.id); }}
                      className="p-1.5 rounded-lg text-rose-300 hover:bg-rose-50"><Trash2 size={14} /></button>
                  </div>
                </div>

                {/* Payment grid */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] text-slate-400 uppercase font-semibold border-b border-slate-100">
                        <th className="px-4 py-2">Employee</th>
                        <th className="px-2 py-2 text-right">Gross</th>
                        <th className="px-2 py-2 text-right">Recovered</th>
                        <th className="px-2 py-2 text-right">Paid</th>
                        <th className="px-2 py-2 text-right">Remaining</th>
                        <th className="px-4 py-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {rows.map((d) => {
                        const st = rowStatus(d);
                        const rem = Math.max(0, (d.salary_amount - d.advance_recovered) - d.salary_given);
                        return (
                          <tr key={d.id} className="hover:bg-slate-50/60">
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <Avatar name={d.employee_name} size={28} />
                                <div>
                                  <div className="font-semibold text-slate-700">{d.employee_name}</div>
                                  <div className="text-[11px]">
                                    {st === 'Paid' ? <span className="text-emerald-600 font-semibold">✓ Paid</span>
                                      : st === 'Partial' ? <span className="text-amber-600 font-semibold">◔ Partial</span>
                                      : <span className="text-slate-400">Pending</span>}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-2 py-2.5 text-right font-semibold text-slate-600">{inr(d.salary_amount)}</td>
                            <td className="px-2 py-2.5 text-right text-sky-600">{d.advance_recovered > 0 ? inr(d.advance_recovered) : '—'}</td>
                            <td className="px-2 py-2.5 text-right text-emerald-600">{d.salary_given > 0 ? inr(d.salary_given) : '—'}</td>
                            <td className="px-2 py-2.5 text-right font-bold text-slate-700">{rem > 0 ? inr(rem) : '—'}</td>
                            <td className="px-4 py-2.5 text-right whitespace-nowrap">
                              {st === 'Paid' ? (
                                <button onClick={() => doPayslipDirect(d)}
                                  className="btn-ghost text-xs px-2.5 py-1.5"><FileDown size={13} /> Slip</button>
                              ) : (
                                <button onClick={() => openPay(d)} className="btn-success text-xs px-3 py-1.5">Pay</button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pay one grid row */}
      <Modal open={!!payRow} onClose={() => { setPayRow(null); setPaid(null); }} title={`Pay · ${payRow?.employee_name || ''}`}>
        {payRow && (paid ? (
          <div className="space-y-3">
            <div className="rounded-xl bg-emerald-50 text-emerald-700 p-3 text-sm font-semibold text-center">
              ✓ Paid {inr(paid.cash)}{paid.recovery > 0 ? ` · recovered ${inr(paid.recovery)}` : ''}
              {rowStatus(paid.row) !== 'Paid' && <div className="text-amber-600 mt-1">Partial — {inr(Math.max(0, (paid.row.salary_amount - paid.row.advance_recovered) - paid.row.salary_given))} still remains (stays payable).</div>}
              {rowStatus(paid.row) === 'Paid' && <div className="text-emerald-600 mt-1">Fully settled ✓</div>}
            </div>
            {showUpi && paid.emp?.upi_id && <UpiPay vpa={paid.emp.upi_id} name={paid.emp.name} amount={paid.cash} note="Salary" />}
            <button onClick={doPayslip} className="btn-primary w-full"><FileDown size={16} /> Payslip PDF (send to {payRow.employee_name})</button>
            <button onClick={() => { setPayRow(null); setPaid(null); }} className="btn-ghost w-full">Done</button>
          </div>
        ) : (() => {
          const emp = employees.find((e) => e.employee_id === payRow.employee_id)!;
          const ap = advancePending(emp);
          const rem = Math.max(0, (payRow.salary_amount - payRow.advance_recovered) - payRow.salary_given);
          const rec = Math.max(0, Math.min(Number(recover) || 0, ap));
          const cash = Math.max(0, Number(cashNow) || 0);
          const afterRem = Math.max(0, rem - rec - cash);
          const adv = advSinceSalary(payRow.employee_id);
          return (
            <div className="space-y-3">
              <div className="rounded-xl bg-amber-50 text-amber-700 p-3 text-sm">
                Advance given since last salary{adv.lastSal ? ` (${fmtDate(adv.lastSal)})` : ''}: <b>{inr(adv.amt)}</b>
                <div className="text-xs text-amber-600/80 mt-0.5">Total advance still due: {inr(ap)}</div>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Remaining salary</span><b>{inr(rem)}</b></div>
                <div className="flex justify-between"><span className="text-slate-500">Advance recovered now</span><b className="text-rose-600">−{inr(rec)}</b></div>
                <div className="flex justify-between"><span className="text-slate-500">Paying cash now</span><b className="text-emerald-600 text-base">{inr(cash)}</b></div>
                {afterRem > 0 && <div className="flex justify-between border-t border-slate-200 pt-1.5"><span className="text-amber-600 font-semibold">Will still remain</span><b className="text-amber-600">{inr(afterRem)}</b></div>}
              </div>
              <Field label="Payment Date">
                <input type="date" className="input" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
              </Field>
              {ap > 0 && (
                <Field label={`Advance to recover — you decide (due ${inr(ap)})`} hint="How much advance to take back from this salary.">
                  <input type="number" inputMode="numeric" className="input" value={recover}
                    onChange={(e) => { const v = e.target.value; setRecover(v); const nr = Math.min(Number(v) || 0, ap); setCashNow(String(Math.max(0, rem - nr))); }} />
                </Field>
              )}
              <Field label="Salary to pay now" hint="Full remaining, or a smaller amount for a partial payment.">
                <input type="number" inputMode="numeric" className="input text-lg font-bold" value={cashNow} onChange={(e) => setCashNow(e.target.value)} />
              </Field>
              <div className="flex gap-2">
                <button onClick={() => setCashNow(String(Math.max(0, rem - rec)))} className="btn-ghost flex-1 text-xs">Full {inr(Math.max(0, rem - rec))}</button>
                <button onClick={() => setCashNow(String(Math.round(Math.max(0, rem - rec) / 2)))} className="btn-ghost flex-1 text-xs">Half</button>
              </div>
              <Field label="Payment Method">
                <div className="grid grid-cols-2 gap-2">
                  {(['Cash', 'UPI'] as const).map((m) => (
                    <button key={m} onClick={() => setMethod(m)} className={`btn ${method === m ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                      {m === 'Cash' ? <Banknote size={16} /> : <Smartphone size={16} />} {m}
                    </button>
                  ))}
                </div>
              </Field>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setPayRow(null)} className="btn-ghost flex-1">Cancel</button>
                <button onClick={confirmPay} disabled={rec + cash <= 0} className="btn-success flex-1">{method === 'UPI' ? 'Record & Pay' : 'Confirm Payment'}</button>
              </div>
            </div>
          );
        })())}
      </Modal>
    </div>
  );

  // Payslip for an already-paid row (from the grid "Slip" button).
  function doPayslipDirect(d: SalaryDetail) {
    const emp = employees.find((e) => e.employee_id === d.employee_id);
    if (!emp) return;
    setPayRow(null); setPaid(null);
    sharePayslip(emp, ledger, settings, {
      date: today(), period: d.from_to, gross: d.salary_amount,
      recovery: d.advance_recovered, net: d.salary_given, method: 'Cash',
    });
  }
};
