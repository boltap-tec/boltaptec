import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Wallet, Receipt, TrendingUp, TrendingDown, HardHat, Plus, Trash2,
  Banknote, Pencil, Briefcase, HandCoins, ShoppingCart, BookOpen,
} from 'lucide-react';
import { useData } from '../store/useData';
import { Card, Modal, Field, Badge, EmptyState, StatCard, Avatar } from '../components/ui';
import { inr, fmtDate, today } from '../lib/format';
import { projectFinance, labourFromAttendance, LABOUR_CATEGORY_ID } from '../lib/projects';
import { confirmAction, confirmProtected } from '../lib/guard';
import { PurchaseModal } from '../components/PurchaseModal';
import type { ProjectStatus } from '../types';

const statusTone = (s: ProjectStatus) => (s === 'Completed' ? 'green' : s === 'Cancelled' ? 'red' : 'brand');

export const ProjectDetail: React.FC = () => {
  const { id } = useParams();
  const projectId = decodeURIComponent(id || '');
  const navigate = useNavigate();
  const {
    projects, projectExpenditure, projectPayments, attendance, expenditureCategories,
    updateProject, deleteProject, addExpenditure, deleteExpenditure, addPayment, deletePayment,
  } = useData();

  const project = projects.find((p) => p.project_id === projectId);
  const [payOpen, setPayOpen] = useState(false);
  const [expOpen, setExpOpen] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const [pay, setPay] = useState({ amount: '', method: 'UPI' as 'UPI' | 'Cash' | 'Bank', date: today(), remark: '' });
  const visibleCats = expenditureCategories.filter((c) => c.visible);
  const [exp, setExp] = useState({ category_id: '', amount: '', description: '', date: today(), remark: '' });

  const fin = useMemo(
    () => (project ? projectFinance(project, projectExpenditure, projectPayments, attendance) : null),
    [project, projectExpenditure, projectPayments, attendance],
  );

  const exps = useMemo(
    () => projectExpenditure.filter((e) => e.project_id === projectId).sort((a, b) => (a.date < b.date ? 1 : -1)),
    [projectExpenditure, projectId],
  );
  const pays = useMemo(
    () => projectPayments.filter((x) => x.project_id === projectId).sort((a, b) => (a.date < b.date ? 1 : -1)),
    [projectPayments, projectId],
  );
  const labourFromAtt = useMemo(() => labourFromAttendance(attendance, projectId), [attendance, projectId]);

  // Per-shift labour entries for this project (from attendance allocations).
  const labourRows = useMemo(
    () => attendance
      .filter((a) => a.status !== 'rejected' && (a.project_allocations || []).some((x) => x.project_id === projectId))
      .flatMap((a) => (a.project_allocations || []).filter((x) => x.project_id === projectId)
        .map((x) => ({ id: a.id, date: a.date, name: a.employee_name, hours: x.hours, amount: x.amount })))
      .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [attendance, projectId],
  );

  // Project ledger — every money movement (payments in, expenditure + labour out).
  const ledgerRows = useMemo(() => {
    const inflow = pays.map((p) => ({ id: 'pay_' + p.id, date: p.date, dir: 'in' as const, label: 'Payment received', sub: `${p.method || 'Cash'}${p.remark ? ` · ${p.remark}` : ''}`, amount: p.amount }));
    const outflow = exps.map((e) => ({ id: 'exp_' + e.id, date: e.date, dir: 'out' as const, label: e.category_name, sub: `${e.description || ''}${e.vendor ? ` · ${e.vendor}` : ''}`.replace(/^ · /, ''), amount: e.amount }));
    const labour = labourRows.map((r, i) => ({ id: 'lab_' + r.id + i, date: r.date, dir: 'out' as const, label: 'Labour', sub: `${r.name} · ${r.hours}h`, amount: r.amount }));
    return [...inflow, ...outflow, ...labour].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [pays, exps, labourRows]);

  if (!project || !fin) return (
    <div className="space-y-4">
      <button onClick={() => navigate('/projects')} className="flex items-center gap-1 text-sm font-semibold text-slate-400"><ArrowLeft size={15} /> Projects</button>
      <EmptyState title="Project not found" />
    </div>
  );

  const savePayment = () => {
    const amt = Number(pay.amount);
    if (!amt || amt <= 0) return;
    addPayment({ project_id: project.project_id, project_name: project.name, date: pay.date, amount: amt, method: pay.method, remark: pay.remark.trim() || null });
    setPayOpen(false); setPay({ amount: '', method: 'UPI', date: today(), remark: '' });
  };

  const saveExpenditure = () => {
    const amt = Number(exp.amount);
    const cat = visibleCats.find((c) => c.category_id === exp.category_id) || visibleCats[0];
    if (!amt || amt <= 0 || !cat) return;
    addExpenditure({
      project_id: project.project_id, project_name: project.name, date: exp.date,
      category_id: cat.category_id, category_name: cat.name,
      description: exp.description.trim() || null, amount: amt, remark: exp.remark.trim() || null,
      images: null, source: 'admin',
    });
    setExpOpen(false); setExp({ category_id: '', amount: '', description: '', date: today(), remark: '' });
  };

  return (
    <div className="space-y-4">
      <button onClick={() => navigate('/projects')} className="flex items-center gap-1 text-sm font-semibold text-slate-400"><ArrowLeft size={15} /> Projects</button>

      <Card className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-extrabold text-slate-800">{project.name}</h1>
              <Badge tone={statusTone(project.status)}>{project.status}</Badge>
            </div>
            <div className="text-sm text-slate-400 mt-0.5">{project.owner_name || '—'} · {project.address || '—'} {project.phone ? `· ${project.phone}` : ''}</div>
            <div className="text-xs text-slate-400 mt-0.5">
              {project.quote_based_on === 'Length_Breadth_Based'
                ? `${project.length}×${project.breadth} ft = ${project.total_sqft} sq.ft @ ${inr(project.rate_per_sqft || 0)}/sq.ft`
                : 'Fixed quote'} · {fmtDate(project.date)}
            </div>
          </div>
          <button onClick={() => setEditOpen(true)} className="btn-ghost px-3"><Pencil size={15} /></button>
        </div>
        {/* Status quick switch */}
        <div className="flex gap-1.5 mt-3">
          {(['Running', 'Completed', 'Cancelled'] as const).map((s) => (
            <button key={s} onClick={() => updateProject(project.project_id, { status: s })}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold ${project.status === s ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{s}</button>
          ))}
        </div>
      </Card>

      {/* Finance summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Quoted" value={inr(fin.quoted)} icon={<Briefcase size={20} />} tone="bg-brand-50 text-brand-600" />
        <StatCard label="Total Expenditure" value={inr(fin.expenditure)} sub={`Labour ${inr(fin.labour)} · Material ${inr(fin.material)}`} icon={<Receipt size={20} />} tone="bg-amber-50 text-amber-600" />
        <StatCard label="Received" value={inr(fin.received)} sub={`Pending ${inr(fin.pending)}`} icon={<Wallet size={20} />} tone="bg-emerald-50 text-emerald-600" />
        <StatCard label={fin.profit >= 0 ? 'Profit' : 'Loss'} value={inr(Math.abs(fin.profit))}
          icon={fin.profit >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
          tone={fin.profit >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => setPayOpen(true)} className="btn-success"><Banknote size={16} /> Record Payment</button>
        <button onClick={() => setExpOpen(true)} className="btn-primary"><Plus size={16} /> Add Expenditure</button>
        <button onClick={() => setPurchaseOpen(true)} className="btn-ghost col-span-2"><ShoppingCart size={16} /> Add Purchase (bill / paste table)</button>
      </div>

      {/* Project Ledger — full money-movement statement for this project */}
      <Card className="overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 font-bold text-slate-700 text-sm flex items-center justify-between">
          <span className="flex items-center gap-2"><BookOpen size={16} className="text-brand-500" /> Project Ledger</span>
          <span className="text-xs font-semibold"><span className="text-emerald-600">+{inr(fin.received)}</span> <span className="text-slate-300">/</span> <span className="text-rose-500">−{inr(fin.expenditure)}</span></span>
        </div>
        {ledgerRows.length === 0 ? (
          <div className="p-5"><EmptyState title="No transactions yet" hint="Payments received and expenditure appear here as a running history." /></div>
        ) : (
          <div className="divide-y divide-slate-50 max-h-96 overflow-y-auto">
            {ledgerRows.slice(0, 200).map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className={`h-8 w-8 rounded-lg grid place-items-center ${r.dir === 'in' ? 'bg-emerald-50 text-emerald-500' : 'bg-rose-50 text-rose-400'}`}>
                  {r.dir === 'in' ? <Wallet size={15} /> : <Receipt size={15} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-700 truncate">{r.label}</div>
                  <div className="text-xs text-slate-400 truncate">{fmtDate(r.date)}{r.sub ? ` · ${r.sub}` : ''}</div>
                </div>
                <span className={`text-sm font-bold ${r.dir === 'in' ? 'text-emerald-600' : 'text-rose-500'}`}>{r.dir === 'in' ? '+' : '−'}{inr(r.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Labour expenditure — from attendance allocated to this project */}
      <Card className="overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 font-bold text-slate-700 text-sm flex items-center justify-between">
          <span className="flex items-center gap-2"><HardHat size={16} className="text-amber-500" /> Labour Expenditure</span>
          <span className="text-slate-500">{inr(fin.labour)}</span>
        </div>
        {labourRows.length === 0 ? (
          <div className="p-4 text-sm text-slate-500">
            {labourFromAtt > 0 ? `${inr(labourFromAtt)} from attendance.` : 'No attendance linked yet.'} Mark attendance with this project (or set it as Today’s Work) and it flows in here.
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {labourRows.slice(0, 100).map((r, i) => (
              <div key={r.id + i} className="flex items-center gap-3 px-4 py-2.5">
                <Avatar name={r.name} size={30} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-700">{r.name}</div>
                  <div className="text-xs text-slate-400">{fmtDate(r.date)} · {r.hours}h</div>
                </div>
                <span className="text-sm font-bold text-slate-700">{inr(r.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Expenditure list */}
      <Card className="overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 font-bold text-slate-700 text-sm flex items-center justify-between">
          <span className="flex items-center gap-2"><Receipt size={16} className="text-brand-500" /> Expenditure</span>
          <span className="text-slate-500">{inr(fin.expenditure)}</span>
        </div>
        {exps.length === 0 ? (
          <div className="p-5"><EmptyState title="No expenditure yet" hint="Add materials, food, vehicle and other costs." /></div>
        ) : (
          <div className="divide-y divide-slate-50">
            {exps.map((e) => (
              <div key={e.id} className="flex items-center gap-3 px-4 py-2.5 group">
                <div className={`h-9 w-9 rounded-lg grid place-items-center ${e.category_id === LABOUR_CATEGORY_ID ? 'bg-amber-50 text-amber-500' : 'bg-slate-100 text-slate-400'}`}>
                  {e.category_id === LABOUR_CATEGORY_ID ? <HardHat size={16} /> : <Receipt size={16} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-700">{e.category_name}{e.description ? ` · ${e.description}` : ''}</div>
                  <div className="text-xs text-slate-400">
                    {fmtDate(e.date)}{e.source === 'worker_request' ? ' · worker request' : ''}{e.remark ? ` · ${e.remark}` : ''}
                    {e.items && e.items.length > 0 && ` · ${e.items.length} items`}{e.images && e.images.length > 0 ? ' · 🧾 bill' : ''}
                  </div>
                </div>
                <span className="text-sm font-bold text-slate-700">{inr(e.amount)}</span>
                <button onClick={() => { if (confirmAction('Delete this expenditure?')) deleteExpenditure(e.id); }} className="p-1.5 rounded-lg text-rose-300 hover:bg-rose-50 opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Payments list */}
      <Card className="overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 font-bold text-slate-700 text-sm flex items-center justify-between">
          <span className="flex items-center gap-2"><HandCoins size={16} className="text-emerald-500" /> Payments Received</span>
          <span className="text-slate-500">{inr(fin.received)}</span>
        </div>
        {pays.length === 0 ? (
          <div className="p-5"><EmptyState title="No payments recorded" /></div>
        ) : (
          <div className="divide-y divide-slate-50">
            {pays.map((x) => (
              <div key={x.id} className="flex items-center gap-3 px-4 py-2.5 group">
                <div className="h-9 w-9 rounded-lg grid place-items-center bg-emerald-50 text-emerald-500"><Wallet size={16} /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-700">{inr(x.amount)}</div>
                  <div className="text-xs text-slate-400">{fmtDate(x.date)} · {x.method || 'Cash'}{x.remark ? ` · ${x.remark}` : ''}</div>
                </div>
                <button onClick={() => { if (confirmAction('Delete this payment?')) deletePayment(x.id); }} className="p-1.5 rounded-lg text-rose-300 hover:bg-rose-50 opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <button onClick={() => { if (confirmProtected(`Delete project "${project.name}" and all its expenditure & payments?`)) { deleteProject(project.project_id); navigate('/projects'); } }}
        className="btn-danger w-full"><Trash2 size={16} /> Delete Project</button>

      {/* Record payment */}
      <Modal open={payOpen} onClose={() => setPayOpen(false)} title="Record Payment">
        <div className="space-y-3">
          <Field label="Amount received (₹)"><input className="input text-2xl font-bold text-center" inputMode="numeric" autoFocus value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} placeholder="0" /></Field>
          <Field label="Method">
            <div className="grid grid-cols-3 gap-2">
              {(['UPI', 'Cash', 'Bank'] as const).map((m) => (
                <button key={m} onClick={() => setPay({ ...pay, method: m })} className={`btn ${pay.method === m ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{m}</button>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date"><input type="date" className="input" value={pay.date} onChange={(e) => setPay({ ...pay, date: e.target.value })} /></Field>
            <Field label="Remark"><input className="input" value={pay.remark} onChange={(e) => setPay({ ...pay, remark: e.target.value })} /></Field>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={() => setPayOpen(false)} className="btn-ghost flex-1">Cancel</button>
            <button onClick={savePayment} disabled={!pay.amount} className="btn-success flex-1">Save Payment</button>
          </div>
        </div>
      </Modal>

      {/* Add expenditure */}
      <Modal open={expOpen} onClose={() => setExpOpen(false)} title="Add Expenditure">
        <div className="space-y-3">
          <Field label="Category">
            <select className="input" value={exp.category_id || visibleCats[0]?.category_id || ''} onChange={(e) => setExp({ ...exp, category_id: e.target.value })}>
              {visibleCats.map((c) => <option key={c.category_id} value={c.category_id}>{c.name}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount (₹)"><input className="input" inputMode="numeric" autoFocus value={exp.amount} onChange={(e) => setExp({ ...exp, amount: e.target.value })} placeholder="0" /></Field>
            <Field label="Date"><input type="date" className="input" value={exp.date} onChange={(e) => setExp({ ...exp, date: e.target.value })} /></Field>
          </div>
          <Field label="Description"><input className="input" value={exp.description} onChange={(e) => setExp({ ...exp, description: e.target.value })} placeholder="e.g. Switch box, Lunch…" /></Field>
          <Field label="Remark"><input className="input" value={exp.remark} onChange={(e) => setExp({ ...exp, remark: e.target.value })} /></Field>
          <div className="flex gap-2 pt-1">
            <button onClick={() => setExpOpen(false)} className="btn-ghost flex-1">Cancel</button>
            <button onClick={saveExpenditure} disabled={!exp.amount} className="btn-primary flex-1">Add Expenditure</button>
          </div>
        </div>
      </Modal>

      {/* Purchase (standard table + paste mapping) */}
      <PurchaseModal open={purchaseOpen} project={project} onClose={() => setPurchaseOpen(false)} />

      {/* Edit project */}
      <EditProject open={editOpen} onClose={() => setEditOpen(false)} />
    </div>
  );

  function EditProject({ open, onClose }: { open: boolean; onClose: () => void }) {
    const [e, setE] = useState({
      name: project!.name, owner_name: project!.owner_name || '', address: project!.address || '',
      phone: project!.phone || '', amount_quoted: String(project!.amount_quoted || ''),
      length: String(project!.length ?? ''), breadth: String(project!.breadth ?? ''), rate_per_sqft: String(project!.rate_per_sqft ?? ''),
    });
    const lb = project!.quote_based_on === 'Length_Breadth_Based';
    const save = () => {
      const length = lb ? Number(e.length) || null : project!.length;
      const breadth = lb ? Number(e.breadth) || null : project!.breadth;
      const total_sqft = lb ? Math.round((Number(e.length) || 0) * (Number(e.breadth) || 0) * 100) / 100 : project!.total_sqft;
      const rate = lb ? Number(e.rate_per_sqft) || null : project!.rate_per_sqft;
      updateProject(project!.project_id, {
        name: e.name.trim() || project!.name, owner_name: e.owner_name.trim() || null, address: e.address.trim() || null,
        phone: e.phone.trim() || null, amount_quoted: Number(e.amount_quoted) || 0,
        length, breadth, rate_per_sqft: rate, total_sqft, approximate_amount: lb ? Math.round(total_sqft * (rate || 0)) : project!.approximate_amount,
      });
      onClose();
    };
    return (
      <Modal open={open} onClose={onClose} title="Edit Project" wide>
        <div className="space-y-3">
          <Field label="Project Name"><input className="input" value={e.name} onChange={(ev) => setE({ ...e, name: ev.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Owner / Customer"><input className="input" value={e.owner_name} onChange={(ev) => setE({ ...e, owner_name: ev.target.value })} /></Field>
            <Field label="Phone"><input className="input" value={e.phone} onChange={(ev) => setE({ ...e, phone: ev.target.value })} /></Field>
          </div>
          <Field label="Address"><input className="input" value={e.address} onChange={(ev) => setE({ ...e, address: ev.target.value })} /></Field>
          {lb && (
            <div className="grid grid-cols-3 gap-3">
              <Field label="Length (ft)"><input className="input" value={e.length} onChange={(ev) => setE({ ...e, length: ev.target.value })} /></Field>
              <Field label="Breadth (ft)"><input className="input" value={e.breadth} onChange={(ev) => setE({ ...e, breadth: ev.target.value })} /></Field>
              <Field label="Rate / sq.ft"><input className="input" value={e.rate_per_sqft} onChange={(ev) => setE({ ...e, rate_per_sqft: ev.target.value })} /></Field>
            </div>
          )}
          <Field label="Amount Quoted (₹)"><input className="input" inputMode="numeric" value={e.amount_quoted} onChange={(ev) => setE({ ...e, amount_quoted: ev.target.value })} /></Field>
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="btn-ghost flex-1">Cancel</button>
            <button onClick={save} className="btn-primary flex-1">Save</button>
          </div>
        </div>
      </Modal>
    );
  }
};
