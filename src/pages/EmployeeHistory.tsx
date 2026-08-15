import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Wallet, HandCoins, TrendingDown, Clock } from 'lucide-react';
import { useAuth } from '../store/useAuth';
import { useData } from '../store/useData';
import { Card, Badge, EmptyState } from '../components/ui';
import { inr, fmtDate } from '../lib/format';

export const EmployeeHistory: React.FC = () => {
  const { session } = useAuth();
  const navigate = useNavigate();
  const { ledger, attendance } = useData();
  const [tab, setTab] = useState<'money' | 'attendance'>('money');

  const id = session?.employee_id;
  const myLedger = useMemo(() => ledger.filter((l) => l.employee_id === id), [ledger, id]);
  const myAtt = useMemo(() => attendance.filter((a) => a.employee_id === id), [attendance, id]);

  return (
    <div className="space-y-4 max-w-xl mx-auto">
      <button onClick={() => navigate('/me')} className="flex items-center gap-1 text-sm font-semibold text-slate-500"><ArrowLeft size={16} /> My Money</button>
      <h1 className="text-2xl font-extrabold text-slate-800">My History</h1>

      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        {(['money', 'attendance'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold capitalize transition ${tab === t ? 'bg-white shadow-sm text-brand-700' : 'text-slate-500'}`}>
            {t === 'money' ? 'Payments' : 'Attendance'}
          </button>
        ))}
      </div>

      {tab === 'money' ? (
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
