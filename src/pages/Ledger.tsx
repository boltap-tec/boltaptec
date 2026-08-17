import React, { useState, useMemo } from 'react';
import { BookOpen, Search, Download, HandCoins, Banknote, TrendingDown, Trash2 } from 'lucide-react';
import { useData } from '../store/useData';
import { Card, Avatar, Badge, EmptyState } from '../components/ui';
import { inr, fmtDate } from '../lib/format';
import type { LedgerCategory } from '../types';

const catMeta: Record<LedgerCategory, { tone: any; icon: React.ReactNode; label: string }> = {
  Salary: { tone: 'green', icon: <Banknote size={15} />, label: 'Salary' },
  Advance_Payment: { tone: 'amber', icon: <HandCoins size={15} />, label: 'Advance' },
  Advance_Recovery: { tone: 'blue', icon: <TrendingDown size={15} />, label: 'Recovery' },
};

export const Ledger: React.FC = () => {
  const { ledger, deleteLedgerEntry } = useData();

  const removeEntry = (l: any) => {
    const amt = l.total_amount_given || l.salary_payment_amount || l.advance_payment || l.advance_recovery || 0;
    if (confirm(`Delete this ${l.category.replace(/_/g, ' ')} of ₹${amt} for ${l.employee_name}?\n\nThis removes it from the ledger and reverses the balance.`)) {
      deleteLedgerEntry(l.id);
    }
  };
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<'all' | LedgerCategory>('all');

  const rows = useMemo(() => ledger.filter((l) =>
    (cat === 'all' || l.category === cat) &&
    (!q || l.employee_name.toLowerCase().includes(q.toLowerCase())),
  ), [ledger, q, cat]);

  const totals = useMemo(() => ({
    salary: ledger.filter((l) => l.category === 'Salary').reduce((s, l) => s + (l.salary_payment_amount || 0), 0),
    advance: ledger.filter((l) => l.category === 'Advance_Payment').reduce((s, l) => s + (l.advance_payment || 0), 0),
    recovery: ledger.filter((l) => l.category === 'Advance_Recovery').reduce((s, l) => s + (l.advance_recovery || 0), 0),
  }), [ledger]);

  const exportCsv = () => {
    const head = ['Date', 'Employee', 'Category', 'Amount', 'Method', 'Remark'];
    const lines = rows.map((l) => [
      l.date, l.employee_name, l.category,
      l.total_amount_given || l.salary_payment_amount || l.advance_payment || l.advance_recovery || 0,
      l.method || 'Cash', (l.remark || '').replace(/,/g, ' '),
    ].join(','));
    const blob = new Blob([[head.join(','), ...lines].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'boltaptec-ledger.csv'; a.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">Ledger</h1>
          <p className="text-slate-400 text-sm">{ledger.length} transactions</p>
        </div>
        <button onClick={exportCsv} className="btn-ghost"><Download size={16} /> <span className="hidden sm:inline">Export CSV</span></button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3 text-center"><div className="text-xs text-slate-400 font-semibold">SALARY PAID</div><div className="font-extrabold text-emerald-600">{inr(totals.salary)}</div></Card>
        <Card className="p-3 text-center"><div className="text-xs text-slate-400 font-semibold">ADVANCES GIVEN</div><div className="font-extrabold text-amber-600">{inr(totals.advance)}</div></Card>
        <Card className="p-3 text-center"><div className="text-xs text-slate-400 font-semibold">RECOVERED</div><div className="font-extrabold text-sky-600">{inr(totals.recovery)}</div></Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-10" placeholder="Search employee…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto">
          {(['all', 'Salary', 'Advance_Payment', 'Advance_Recovery'] as const).map((c) => (
            <button key={c} onClick={() => setCat(c)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap transition ${cat === c ? 'bg-white shadow-sm text-brand-700' : 'text-slate-500'}`}>
              {c === 'all' ? 'All' : catMeta[c as LedgerCategory].label}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <Card className="p-6"><EmptyState icon={<BookOpen size={40} />} title="No transactions found" /></Card>
      ) : (
        <Card className="divide-y divide-slate-100">
          {rows.slice(0, 300).map((l) => {
            const m = catMeta[l.category];
            const amt = l.total_amount_given || l.salary_payment_amount || l.advance_payment || l.advance_recovery || 0;
            return (
              <div key={l.id} className="flex items-center gap-3 p-3">
                <Avatar name={l.employee_name} size={36} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-700">{l.employee_name}</div>
                  <div className="text-xs text-slate-400">{fmtDate(l.date)} · {l.method || 'Cash'}{l.remark ? ` · ${l.remark}` : ''}</div>
                </div>
                <Badge tone={m.tone}>{m.icon} {m.label}</Badge>
                <span className={`text-sm font-bold w-24 text-right ${l.category === 'Advance_Recovery' ? 'text-sky-600' : l.category === 'Salary' ? 'text-emerald-600' : 'text-amber-600'}`}>{inr(amt)}</span>
                <button onClick={() => removeEntry(l)} className="p-1.5 rounded-lg text-rose-300 hover:bg-rose-50 hover:text-rose-500" title="Delete transaction"><Trash2 size={15} /></button>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
};
