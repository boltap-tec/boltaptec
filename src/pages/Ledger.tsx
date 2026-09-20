import React, { useState, useMemo } from 'react';
import { BookOpen, Search, Download, HandCoins, Banknote, TrendingDown, Trash2, CheckCircle2, Send, Calendar, History, ShieldAlert } from 'lucide-react';
import { useData } from '../store/useData';
import { Card, Avatar, Badge, EmptyState } from '../components/ui';
import { inr, fmtDate, isGpaySent, displayRemark, byDateDesc } from '../lib/format';
import type { LedgerCategory } from '../types';

const catMeta: Record<LedgerCategory, { tone: any; icon: React.ReactNode; label: string }> = {
  Salary: { tone: 'green', icon: <Banknote size={15} />, label: 'Salary' },
  Advance_Payment: { tone: 'amber', icon: <HandCoins size={15} />, label: 'Advance' },
  Advance_Recovery: { tone: 'blue', icon: <TrendingDown size={15} />, label: 'Recovery' },
};

export const Ledger: React.FC = () => {
  const { ledger, deleteLedgerEntry, setLedgerSent, activityLog, clearActivityLog } = useData();

  const removeEntry = (l: any) => {
    const amt = l.total_amount_given || l.salary_payment_amount || l.advance_payment || l.advance_recovery || 0;
    if (confirm(`Delete this ${l.category.replace(/_/g, ' ')} of ₹${amt} for ${l.employee_name}?\n\nThis removes it from the ledger and reverses the balance.`)) {
      deleteLedgerEntry(l.id);
    }
  };
  const [tab, setTab] = useState<'txns' | 'activity'>('txns');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<'all' | LedgerCategory>('all');

  const rows = useMemo(() => ledger.filter((l) =>
    (cat === 'all' || l.category === cat) &&
    (!q || l.employee_name.toLowerCase().includes(q.toLowerCase())),
  ).slice().sort(byDateDesc), [ledger, q, cat]);

  // Group the transactions by date (newest day on top) like the Attendance ledger.
  const grouped = useMemo(() => {
    const m = new Map<string, typeof rows>();
    rows.forEach((l) => { if (!m.has(l.date)) m.set(l.date, [] as any); (m.get(l.date) as any).push(l); });
    return [...m.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 120);
  }, [rows]);

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

      {/* Transactions vs. Activity Log (deletion audit) */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        <button onClick={() => setTab('txns')}
          className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition inline-flex items-center gap-1.5 ${tab === 'txns' ? 'bg-white shadow-sm text-brand-700' : 'text-slate-500'}`}>
          <BookOpen size={15} /> Transactions
        </button>
        <button onClick={() => setTab('activity')}
          className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition inline-flex items-center gap-1.5 ${tab === 'activity' ? 'bg-white shadow-sm text-brand-700' : 'text-slate-500'}`}>
          <History size={15} /> Activity Log{activityLog.length > 0 ? ` (${activityLog.length})` : ''}
        </button>
      </div>

      {tab === 'txns' ? (
        <>
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

          {grouped.length === 0 ? (
            <Card className="p-6"><EmptyState icon={<BookOpen size={40} />} title="No transactions found" /></Card>
          ) : (
            <div className="space-y-4">
              {grouped.map(([day, list]) => {
                const paidOut = list.reduce((s, l) => s + ((l.salary_payment_amount || 0) + (l.advance_payment || 0)), 0);
                return (
                  <Card key={day} className="overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                      <div className="flex items-center gap-2 font-bold text-slate-700 text-sm">
                        <Calendar size={16} className="text-brand-500" /> {fmtDate(day)}
                        <Badge tone="brand">{list.length}</Badge>
                      </div>
                      <span className="text-sm font-bold text-slate-600">{inr(paidOut)}</span>
                    </div>
                    <div className="divide-y divide-slate-50">
                      {list.map((l) => {
                        const m = catMeta[l.category];
                        const amt = l.total_amount_given || l.salary_payment_amount || l.advance_payment || l.advance_recovery || 0;
                        const sent = isGpaySent(l.remark);
                        const rem = displayRemark(l.remark);
                        const isPayout = l.category !== 'Advance_Recovery';
                        return (
                          <div key={l.id} className="flex items-center gap-3 px-4 py-2.5">
                            <Avatar name={l.employee_name} size={34} />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                                {l.employee_name}
                                {sent && <Badge tone="green"><CheckCircle2 size={11} /> Sent via GPay</Badge>}
                              </div>
                              <div className="text-xs text-slate-400">{l.method || 'Cash'}{rem ? ` · ${rem}` : ''}</div>
                            </div>
                            <Badge tone={m.tone}>{m.icon} {m.label}</Badge>
                            <span className={`text-sm font-bold w-24 text-right ${l.category === 'Advance_Recovery' ? 'text-sky-600' : l.category === 'Salary' ? 'text-emerald-600' : 'text-amber-600'}`}>{inr(amt)}</span>
                            {isPayout && (
                              <button onClick={() => setLedgerSent(l.id, !sent)}
                                className={`p-1.5 rounded-lg ${sent ? 'text-emerald-500 hover:bg-emerald-50' : 'text-slate-300 hover:bg-slate-100 hover:text-emerald-500'}`}
                                title={sent ? 'Sent via GPay — tap to unmark' : 'Mark as paid via GPay'}>
                                {sent ? <CheckCircle2 size={16} /> : <Send size={15} />}
                              </button>
                            )}
                            <button onClick={() => removeEntry(l)} className="p-1.5 rounded-lg text-rose-300 hover:bg-rose-50 hover:text-rose-500" title="Delete transaction"><Trash2 size={15} /></button>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500 flex items-center gap-1.5"><ShieldAlert size={15} className="text-amber-500" /> Deleted salary, advance & attendance records are recorded here.</p>
            {activityLog.length > 0 && (
              <button onClick={() => { if (confirm('Clear the entire activity log? This cannot be undone.')) clearActivityLog(); }}
                className="btn-ghost text-xs text-rose-500 px-2.5 py-1.5"><Trash2 size={13} /> Clear log</button>
            )}
          </div>
          {activityLog.length === 0 ? (
            <Card className="p-6"><EmptyState icon={<History size={40} />} title="No activity yet" hint="Deletions will appear here for the owner to review." /></Card>
          ) : (
            <Card className="divide-y divide-slate-100">
              {activityLog.slice(0, 300).map((a) => (
                <div key={a.id} className="flex items-start gap-3 p-3">
                  <div className="h-9 w-9 rounded-lg bg-rose-50 text-rose-500 grid place-items-center shrink-0"><Trash2 size={16} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-700">{a.detail}</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      by {a.actor} · {new Date(a.at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </div>
                  </div>
                  <Badge tone="slate">{a.entity}</Badge>
                </div>
              ))}
            </Card>
          )}
        </div>
      )}
    </div>
  );
};
