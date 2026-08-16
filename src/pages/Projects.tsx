import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Briefcase, TrendingUp, TrendingDown, Wallet, Receipt, ArrowRight, Search } from 'lucide-react';
import { useData } from '../store/useData';
import { Card, Modal, Field, Badge, EmptyState, StatCard } from '../components/ui';
import { inr, today } from '../lib/format';
import { projectFinance, computeSqft, computeApprox } from '../lib/projects';
import type { ProjectStatus, QuoteBasis } from '../types';

const statusTone = (s: ProjectStatus) => (s === 'Completed' ? 'green' : s === 'Cancelled' ? 'red' : 'brand');

export const Projects: React.FC = () => {
  const { projects, projectExpenditure, projectPayments, attendance, addProject } = useData();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'Running' | 'Completed' | 'All'>('Running');
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(false);

  // New-project form
  const [f, setF] = useState({
    name: '', owner_name: '', address: '', phone: '',
    quote_based_on: 'Other' as QuoteBasis, length: '', breadth: '', rate_per_sqft: '',
    amount_quoted: '', date: today(), status: 'Running' as ProjectStatus,
  });
  const sqft = computeSqft(Number(f.length) || 0, Number(f.breadth) || 0);
  const approx = computeApprox(sqft, Number(f.rate_per_sqft) || 0);

  const fin = useMemo(() => {
    const m = new Map<string, ReturnType<typeof projectFinance>>();
    projects.forEach((p) => m.set(p.project_id, projectFinance(p, projectExpenditure, projectPayments, attendance)));
    return m;
  }, [projects, projectExpenditure, projectPayments, attendance]);

  const totals = useMemo(() => {
    let quoted = 0, expenditure = 0, received = 0, profit = 0;
    projects.forEach((p) => {
      const x = fin.get(p.project_id)!;
      quoted += x.quoted; expenditure += x.expenditure; received += x.received; profit += x.profit;
    });
    return { quoted, expenditure, received, profit };
  }, [projects, fin]);

  const list = useMemo(() => projects.filter((p) =>
    (filter === 'All' || p.status === filter) &&
    (!q || p.name.toLowerCase().includes(q.toLowerCase()) || (p.owner_name || '').toLowerCase().includes(q.toLowerCase())),
  ), [projects, filter, q]);

  const save = () => {
    if (!f.name.trim()) return;
    const p = addProject({
      name: f.name, owner_name: f.owner_name.trim() || null, address: f.address.trim() || null,
      phone: f.phone.trim() || null, quote_based_on: f.quote_based_on,
      length: f.quote_based_on === 'Length_Breadth_Based' ? Number(f.length) || null : null,
      breadth: f.quote_based_on === 'Length_Breadth_Based' ? Number(f.breadth) || null : null,
      rate_per_sqft: f.quote_based_on === 'Length_Breadth_Based' ? Number(f.rate_per_sqft) || null : null,
      total_sqft: f.quote_based_on === 'Length_Breadth_Based' ? sqft : 0,
      approximate_amount: f.quote_based_on === 'Length_Breadth_Based' ? approx : 0,
      amount_quoted: Number(f.amount_quoted) || 0, date: f.date, status: f.status,
    });
    setModal(false);
    setF({ name: '', owner_name: '', address: '', phone: '', quote_based_on: 'Other', length: '', breadth: '', rate_per_sqft: '', amount_quoted: '', date: today(), status: 'Running' });
    navigate(`/projects/${encodeURIComponent(p.project_id)}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">Projects</h1>
          <p className="text-slate-400 text-sm">{projects.length} projects · quotation, expenditure & profit</p>
        </div>
        <button onClick={() => setModal(true)} className="btn-primary"><Plus size={18} /> <span className="hidden sm:inline">New</span></button>
      </div>

      {/* Overall summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Quoted" value={inr(totals.quoted)} icon={<Briefcase size={20} />} tone="bg-brand-50 text-brand-600" />
        <StatCard label="Total Expenditure" value={inr(totals.expenditure)} icon={<Receipt size={20} />} tone="bg-amber-50 text-amber-600" />
        <StatCard label="Received" value={inr(totals.received)} icon={<Wallet size={20} />} tone="bg-emerald-50 text-emerald-600" />
        <StatCard label={totals.profit >= 0 ? 'Total Profit' : 'Total Loss'} value={inr(Math.abs(totals.profit))}
          icon={totals.profit >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
          tone={totals.profit >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'} />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-10" placeholder="Search project or owner…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex gap-1.5">
          {(['Running', 'Completed', 'All'] as const).map((s) => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-2 rounded-xl text-sm font-bold ${filter === s ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>{s}</button>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <Card className="p-6"><EmptyState icon={<Briefcase size={40} />} title="No projects" hint="Create a project to track quotation, expenditure and profit." /></Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {list.map((p) => {
            const x = fin.get(p.project_id)!;
            return (
              <button key={p.project_id} onClick={() => navigate(`/projects/${encodeURIComponent(p.project_id)}`)}
                className="card p-4 text-left hover:shadow-soft transition group">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-slate-800 truncate">{p.name}</div>
                    <div className="text-xs text-slate-400 truncate">{p.owner_name || '—'} · {p.address || '—'}</div>
                  </div>
                  <Badge tone={statusTone(p.status)}>{p.status}</Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                  <div className="rounded-lg bg-slate-50 p-2">
                    <div className="text-sm font-bold text-slate-700">{inr(x.quoted)}</div>
                    <div className="text-[10px] text-slate-400 font-semibold">Quoted</div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2">
                    <div className="text-sm font-bold text-slate-700">{inr(x.expenditure)}</div>
                    <div className="text-[10px] text-slate-400 font-semibold">Spent</div>
                  </div>
                  <div className={`rounded-lg p-2 ${x.profit >= 0 ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                    <div className={`text-sm font-bold ${x.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{inr(Math.abs(x.profit))}</div>
                    <div className="text-[10px] text-slate-400 font-semibold">{x.profit >= 0 ? 'Profit' : 'Loss'}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2 text-xs text-slate-400">
                  <span>Received {inr(x.received)} · Pending {inr(x.pending)}</span>
                  <ArrowRight size={15} className="group-hover:translate-x-1 transition" />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* New project */}
      <Modal open={modal} onClose={() => setModal(false)} title="New Project" wide>
        <div className="space-y-3">
          <Field label="Project Name"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Malar Shed work" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Owner / Customer"><input className="input" value={f.owner_name} onChange={(e) => setF({ ...f, owner_name: e.target.value })} /></Field>
            <Field label="Phone"><input className="input" inputMode="numeric" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
          </div>
          <Field label="Address"><input className="input" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field>
          <Field label="Quote based on">
            <div className="flex gap-2">
              {(['Other', 'Length_Breadth_Based'] as const).map((b) => (
                <button key={b} onClick={() => setF({ ...f, quote_based_on: b })}
                  className={`btn flex-1 ${f.quote_based_on === b ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  {b === 'Other' ? 'Fixed / Other' : 'Length × Breadth'}
                </button>
              ))}
            </div>
          </Field>
          {f.quote_based_on === 'Length_Breadth_Based' && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Length (ft)"><input className="input" inputMode="decimal" value={f.length} onChange={(e) => setF({ ...f, length: e.target.value })} /></Field>
                <Field label="Breadth (ft)"><input className="input" inputMode="decimal" value={f.breadth} onChange={(e) => setF({ ...f, breadth: e.target.value })} /></Field>
                <Field label="Rate / sq.ft"><input className="input" inputMode="decimal" value={f.rate_per_sqft} onChange={(e) => setF({ ...f, rate_per_sqft: e.target.value })} /></Field>
              </div>
              <div className="rounded-xl bg-brand-50 text-brand-700 px-3 py-2 text-sm font-semibold">
                {sqft} sq.ft · approx {inr(approx)}
              </div>
            </>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount Quoted (₹)"><input className="input" inputMode="numeric" value={f.amount_quoted} onChange={(e) => setF({ ...f, amount_quoted: e.target.value })} /></Field>
            <Field label="Date"><input type="date" className="input" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={() => setModal(false)} className="btn-ghost flex-1">Cancel</button>
            <button onClick={save} disabled={!f.name.trim()} className="btn-primary flex-1">Create Project</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
