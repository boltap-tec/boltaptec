import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Wallet, HandCoins, TrendingDown, Clock, CalendarRange } from 'lucide-react';
import { useAuth } from '../store/useAuth';
import { useData } from '../store/useData';
import { Card, Badge, EmptyState } from '../components/ui';
import { inr, fmtDate, fmtDateShort } from '../lib/format';

// Monday-based week key for grouping.
const weekKey = (dateStr: string) => {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = (d.getDay() + 6) % 7; // 0=Mon
  const monday = new Date(d); monday.setDate(d.getDate() - day);
  return monday.toISOString().slice(0, 10);
};
const byDateDesc = (a: { date: string }, b: { date: string }) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0);

export const EmployeeHistory: React.FC = () => {
  const { session } = useAuth();
  const navigate = useNavigate();
  const { ledger, attendance } = useData();
  const [tab, setTab] = useState<'weekly' | 'money' | 'attendance'>('weekly');

  const id = session?.employee_id;
  const myLedger = useMemo(() => ledger.filter((l) => l.employee_id === id).slice().sort(byDateDesc), [ledger, id]);
  const myAtt = useMemo(() => attendance.filter((a) => a.employee_id === id).slice().sort(byDateDesc), [attendance, id]);

  // Week-wise roll-up of salary earned, days, advance taken & repaid.
  const weeks = useMemo(() => {
    const map = new Map<string, { earned: number; days: number; hours: number; advance: number; salaryPaid: number; recovered: number }>();
    const get = (k: string) => { if (!map.has(k)) map.set(k, { earned: 0, days: 0, hours: 0, advance: 0, salaryPaid: 0, recovered: 0 }); return map.get(k)!; };
    myAtt.forEach((a) => { const w = get(weekKey(a.date)); w.earned += a.salary_amount; w.days += 1; w.hours += a.total_hours; });
    myLedger.forEach((l) => {
      const w = get(weekKey(l.date));
      if (l.category === 'Advance_Payment') w.advance += l.advance_payment || 0;
      else if (l.category === 'Salary') w.salaryPaid += l.salary_payment_amount || 0;
      else if (l.category === 'Advance_Recovery') w.recovered += l.advance_recovery || 0;
    });
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [myAtt, myLedger]);

  return (
    <div className="space-y-4 max-w-xl mx-auto">
      <button onClick={() => navigate('/me')} className="flex items-center gap-1 text-sm font-semibold text-slate-500"><ArrowLeft size={16} /> My Money</button>
      <h1 className="text-2xl font-extrabold text-slate-800">My History</h1>

      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        {(['weekly', 'money', 'attendance'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold capitalize transition ${tab === t ? 'bg-white shadow-sm text-brand-700' : 'text-slate-500'}`}>
            {t === 'weekly' ? 'Week-wise' : t === 'money' ? 'Payments' : 'Attendance'}
          </button>
        ))}
      </div>

      {tab === 'weekly' ? (
        weeks.length ? (
          <div className="space-y-2">
            {weeks.map(([wk, w]) => {
              const end = new Date(wk); end.setDate(end.getDate() + 6);
              return (
                <Card key={wk} className="p-4">
                  <div className="flex items-center gap-2 font-bold text-slate-700 mb-2">
                    <CalendarRange size={16} className="text-brand-500" /> {fmtDateShort(wk)} – {fmtDateShort(end.toISOString().slice(0, 10))}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-lg bg-emerald-50 p-2"><div className="text-[11px] text-slate-400 font-semibold">EARNED</div><div className="font-bold text-emerald-600">{inr(w.earned)}</div><div className="text-[11px] text-slate-400">{w.days}d · {w.hours}h</div></div>
                    <div className="rounded-lg bg-emerald-50/60 p-2"><div className="text-[11px] text-slate-400 font-semibold">SALARY PAID</div><div className="font-bold text-emerald-600">{inr(w.salaryPaid)}</div></div>
                    <div className="rounded-lg bg-amber-50 p-2"><div className="text-[11px] text-slate-400 font-semibold">ADVANCE TAKEN</div><div className="font-bold text-amber-600">{inr(w.advance)}</div></div>
                    <div className="rounded-lg bg-sky-50 p-2"><div className="text-[11px] text-slate-400 font-semibold">ADVANCE REPAID</div><div className="font-bold text-sky-600">{inr(w.recovered)}</div></div>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : <Card className="p-6"><EmptyState title="No weekly data yet" /></Card>
      ) : tab === 'money' ? (
        myLedger.length ? (
          <Card className="divide-y divide-slate-100">
            {myLedger.map((l) => {
              const amt = l.total_amount_given || l.salary_payment_amount || l.advance_payment || l.advance_recovery || 0;
              const label = l.category === 'Salary' ? 'Salary paid' : l.category === 'Advance_Payment' ? 'Advance received' : 'Advance repaid';
              const tone = l.category === 'Salary' ? 'green' : l.category === 'Advance_Recovery' ? 'blue' : 'amber';
              return (
                <div key={l.id} className="flex items-center gap-3 p-3">
                  <div className="h-9 w-9 rounded-lg bg-slate-100 grid place-items-center text-slate-500">
                    {l.category === 'Salary' ? <Wallet size={16} /> : l.category === 'Advance_Recovery' ? <TrendingDown size={16} /> : <HandCoins size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-700">{label}</div>
                    <div className="text-xs text-slate-400">{fmtDate(l.date)} · {l.method || 'Cash'}{l.remark ? ` · ${l.remark}` : ''}</div>
                  </div>
                  <Badge tone={tone as any}>{inr(amt)}</Badge>
                </div>
              );
            })}
          </Card>
        ) : <Card className="p-6"><EmptyState title="No payments yet" /></Card>
      ) : (
        myAtt.length ? (
          <Card className="divide-y divide-slate-100">
            {myAtt.slice(0, 100).map((a) => (
              <div key={a.id} className="flex items-center gap-3 p-3">
                <div className="h-9 w-9 rounded-lg bg-slate-100 grid place-items-center text-slate-500"><Clock size={16} /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-700">{fmtDate(a.date)}</div>
                  <div className="text-xs text-slate-400">{a.time_in} – {a.time_out} · {a.total_hours}h {a.extra_time > 0 && <span className="text-brand-500 font-semibold">+{a.extra_time} OT</span>}</div>
                </div>
                <span className="font-bold text-slate-700">{inr(a.salary_amount)}</span>
              </div>
            ))}
          </Card>
        ) : <Card className="p-6"><EmptyState title="No attendance yet" /></Card>
      )}
    </div>
  );
};
