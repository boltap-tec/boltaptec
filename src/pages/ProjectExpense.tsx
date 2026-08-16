import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Receipt, Send, Clock, CheckCircle2, XCircle, Check, X, Pencil, Banknote, Smartphone, HandCoins,
} from 'lucide-react';
import { useData } from '../store/useData';
import { useAuth } from '../store/useAuth';
import { Card, Avatar, Badge, Modal, Field, EmptyState, StatCard } from '../components/ui';
import { UpiPay } from '../components/UpiPay';
import { inr, fmtDate, today } from '../lib/format';
import type { ExpenditureRequest } from '../types';

export const ProjectExpense: React.FC = () => {
  const { session } = useAuth();
  const isAdmin = session?.role === 'admin';
  const {
    employees, projects, expenditureCategories, expenditureRequests, settings,
    createExpenditureRequest, updateExpenditureRequest, approveExpenditureRequest, rejectExpenditureRequest,
  } = useData();

  const visibleCats = expenditureCategories.filter((c) => c.visible);
  const activeProjects = projects.filter((p) => p.status === 'Running');
  const planActive = settings.today_plan_date === today() ? settings.today_project_id : null;

  const [reqOpen, setReqOpen] = useState(false);
  const [editReq, setEditReq] = useState<ExpenditureRequest | null>(null);
  const [payFor, setPayFor] = useState<ExpenditureRequest | null>(null);
  const [payMethod, setPayMethod] = useState<'Cash' | 'UPI'>('UPI');
  const [payProject, setPayProject] = useState('');   // project admin assigns at approval

  // Worker request form — the worker doesn't pick a project; it defaults to
  // Today's Work and the admin confirms/changes it when approving.
  const blank = { category_id: visibleCats[0]?.category_id || '', amount: '', note: '' };
  const [f, setF] = useState(blank);

  const myEmp = employees.find((e) => e.employee_id === session?.employee_id);
  const visible = useMemo(
    () => (isAdmin ? expenditureRequests : expenditureRequests.filter((r) => r.employee_id === session?.employee_id)),
    [expenditureRequests, isAdmin, session],
  );
  const pending = visible.filter((r) => r.status === 'Pending');
  const decided = visible.filter((r) => r.status !== 'Pending');

  const openReq = () => { setF({ ...blank }); setReqOpen(true); };

  // Open the request modal directly when arrived via the dashboard quick action.
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get('request') === '1') {
      openReq();
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = () => {
    const amt = Number(f.amount);
    const eid = session?.employee_id || myEmp?.employee_id || '';
    const ename = myEmp?.name || session?.name || '';
    const cat = visibleCats.find((c) => c.category_id === f.category_id) || visibleCats[0];
    if (!amt || amt <= 0 || !cat || !eid) return;
    // Project defaults to Today's Work; blank if none is set (admin assigns later).
    const proj = planActive ? projects.find((p) => p.project_id === planActive) : null;
    createExpenditureRequest({
      employee_id: eid, employee_name: ename,
      project_id: proj?.project_id || '', project_name: proj?.name || '',
      category_id: cat.category_id, category_name: cat.name,
      amount: amt, note: f.note.trim() || null,
    });
    setReqOpen(false);
  };

  const openApprove = (r: ExpenditureRequest) => {
    const e = employees.find((x) => x.employee_id === r.employee_id);
    setPayFor(r);
    setPayMethod(e?.upi_id ? 'UPI' : 'Cash');
    setPayProject(r.project_id || planActive || activeProjects[0]?.project_id || '');
  };
  const doApprove = (r: ExpenditureRequest, method: 'Cash' | 'UPI') => {
    const proj = projects.find((p) => p.project_id === payProject);
    if (proj) updateExpenditureRequest(r.id, { project_id: proj.project_id, project_name: proj.name });
    approveExpenditureRequest(r.id, session?.name || 'Admin', method);
  };

  const totalPending = pending.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">Project Expenditure</h1>
          <p className="text-slate-400 text-sm">{isAdmin ? 'Approve worker expenses → added to the project' : 'Request money you spent on a project'}</p>
        </div>
        <button onClick={openReq} className="btn-primary"><Send size={16} /> <span className="hidden sm:inline">Project Request</span></button>
      </div>

      {planActive && (
        <div className="rounded-xl bg-brand-50 text-brand-700 px-4 py-2.5 text-sm font-semibold flex items-center gap-2">
          <Receipt size={15} /> Today's work: {settings.today_project_name}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Pending Requests" value={String(pending.length)} sub={inr(totalPending)} tone="bg-amber-50 text-amber-600" icon={<Clock size={20} />} />
        <StatCard label="Approved (all time)" value={String(visible.filter((r) => r.status === 'Approved').length)} tone="bg-emerald-50 text-emerald-600" icon={<CheckCircle2 size={20} />} />
      </div>

      {/* Pending */}
      <div>
        <h3 className="font-bold text-slate-700 mb-2 flex items-center gap-2">
          <Clock size={17} className="text-amber-500" /> Pending Approval
          {pending.length > 0 && <Badge tone="amber">{pending.length}</Badge>}
        </h3>
        {pending.length === 0 ? (
          <Card className="p-6"><EmptyState title="No pending requests" hint={isAdmin ? 'Worker expense requests appear here.' : 'Tap Request to ask for reimbursement.'} /></Card>
        ) : (
          <div className="space-y-2">
            {pending.map((r) => {
              const e = employees.find((x) => x.employee_id === r.employee_id);
              return (
                <Card key={r.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <Avatar name={r.employee_name} src={e?.photo} size={44} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-800">{r.employee_name}</span>
                        <Badge tone="brand">{r.category_name}</Badge>
                        <span className="text-xs text-slate-400">{fmtDate(r.created_at)}</span>
                      </div>
                      <div className="text-sm text-slate-500 mt-0.5">{r.project_name || <span className="italic text-slate-400">No project — assign on approval</span>}{r.note ? ` · ${r.note}` : ''}</div>
                    </div>
                    <div className="text-right flex items-start gap-1">
                      <div className="text-xl font-extrabold text-slate-800">{inr(r.amount)}</div>
                      {isAdmin && <button onClick={() => setEditReq(r)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-brand-500" title="Edit"><Pencil size={15} /></button>}
                    </div>
                  </div>
                  {isAdmin ? (
                    <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
                      <button onClick={() => rejectExpenditureRequest(r.id, session?.name || 'Admin')} className="btn-ghost flex-1 text-rose-600"><X size={16} /> Reject</button>
                      <button onClick={() => openApprove(r)} className="btn-success flex-1"><Check size={16} /> Approve & Pay</button>
                    </div>
                  ) : (
                    <div className="mt-2 text-xs text-amber-600 font-semibold">Waiting for admin approval…</div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* History */}
      {decided.length > 0 && (
        <div>
          <h3 className="font-bold text-slate-700 mb-2">History</h3>
          <Card className="divide-y divide-slate-100">
            {decided.slice(0, 40).map((r) => (
              <div key={r.id} className="flex items-center gap-3 p-3">
                <Avatar name={r.employee_name} size={34} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-700">{r.employee_name} · {r.category_name}</div>
                  <div className="text-xs text-slate-400 truncate">{r.project_name}{r.note ? ` · ${r.note}` : ''} · {fmtDate(r.decided_at)}</div>
                </div>
                <span className="text-sm font-bold text-slate-600">{inr(r.amount)}</span>
                {r.status === 'Approved'
                  ? <Badge tone="green"><CheckCircle2 size={12} /> Paid {r.paid_method || ''}</Badge>
                  : <Badge tone="red"><XCircle size={12} /> Rejected</Badge>}
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* Request modal */}
      <Modal open={reqOpen} onClose={() => setReqOpen(false)} title="Project Request — expense reimbursement">
        <div className="space-y-3">
          {!isAdmin && myEmp && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50">
              <Avatar name={myEmp.name} src={myEmp.photo} size={40} />
              <div className="font-semibold text-slate-700">{myEmp.name}</div>
            </div>
          )}
          <div className="rounded-xl bg-brand-50 text-brand-700 px-3 py-2 text-sm font-semibold">
            {planActive ? <>Project: {settings.today_project_name} <span className="font-normal text-brand-500">(today's work)</span></> : "The admin will assign the project when approving."}
          </div>
          <Field label="Category (what did you spend on?)">
            <select className="input" value={f.category_id} onChange={(e) => setF({ ...f, category_id: e.target.value })}>
              {visibleCats.map((c) => <option key={c.category_id} value={c.category_id}>{c.name}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount (₹)"><input className="input text-lg font-bold" inputMode="numeric" autoFocus value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} placeholder="0" /></Field>
            <Field label="Note"><input className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="e.g. Tea, Lunch" /></Field>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={() => setReqOpen(false)} className="btn-ghost flex-1">Cancel</button>
            <button onClick={submit} disabled={!f.amount} className="btn-primary flex-1"><Send size={16} /> Send Request</button>
          </div>
        </div>
      </Modal>

      {/* Edit request (admin) */}
      <Modal open={!!editReq} onClose={() => setEditReq(null)} title="Edit Request">
        {editReq && (
          <div className="space-y-3">
            <Field label="Project">
              <select className="input" value={editReq.project_id}
                onChange={(e) => { const p = projects.find((x) => x.project_id === e.target.value); setEditReq({ ...editReq, project_id: e.target.value, project_name: p?.name || editReq.project_name }); }}>
                {projects.map((p) => <option key={p.project_id} value={p.project_id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="Category">
              <select className="input" value={editReq.category_id}
                onChange={(e) => { const c = visibleCats.find((x) => x.category_id === e.target.value); setEditReq({ ...editReq, category_id: e.target.value, category_name: c?.name || editReq.category_name }); }}>
                {visibleCats.map((c) => <option key={c.category_id} value={c.category_id}>{c.name}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount (₹)"><input className="input" inputMode="numeric" value={String(editReq.amount)} onChange={(e) => setEditReq({ ...editReq, amount: Number(e.target.value) || 0 })} /></Field>
              <Field label="Note"><input className="input" value={editReq.note || ''} onChange={(e) => setEditReq({ ...editReq, note: e.target.value })} /></Field>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setEditReq(null)} className="btn-ghost flex-1">Cancel</button>
              <button onClick={() => { updateExpenditureRequest(editReq.id, { project_id: editReq.project_id, project_name: editReq.project_name, category_id: editReq.category_id, category_name: editReq.category_name, amount: editReq.amount, note: editReq.note }); setEditReq(null); }} className="btn-primary flex-1">Save</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Approve & pay (admin) */}
      <Modal open={!!payFor} onClose={() => setPayFor(null)} title="Approve & Reimburse">
        {payFor && (() => {
          const e = employees.find((x) => x.employee_id === payFor.employee_id);
          return (
            <div className="space-y-3">
              <div className="rounded-xl bg-slate-50 p-3 text-sm">
                <div className="font-bold text-slate-700">{inr(payFor.amount)} · {payFor.category_name}</div>
                <div className="text-slate-500">{payFor.note || '—'} — {payFor.employee_name}</div>
                <div className="text-xs text-slate-400 mt-1">Added to the project's expenditure (not to {payFor.employee_name}'s advances).</div>
              </div>
              <Field label="Add to project" hint={planActive ? "Defaults to today's work." : undefined}>
                <select className="input" value={payProject} onChange={(ev) => setPayProject(ev.target.value)}>
                  <option value="">Select project…</option>
                  {activeProjects.map((p) => <option key={p.project_id} value={p.project_id}>{p.name}{p.project_id === planActive ? ' (today)' : ''}</option>)}
                </select>
              </Field>
              <Field label="Reimburse the worker by">
                <div className="grid grid-cols-2 gap-2">
                  {(['UPI', 'Cash'] as const).map((m) => (
                    <button key={m} onClick={() => setPayMethod(m)} className={`btn ${payMethod === m ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                      {m === 'Cash' ? <Banknote size={16} /> : <Smartphone size={16} />} {m}
                    </button>
                  ))}
                </div>
              </Field>
              {payMethod === 'UPI' && (
                e?.upi_id
                  ? <UpiPay vpa={e.upi_id} name={e.name} amount={payFor.amount} note={`${payFor.category_name} · ${payFor.project_name}`} />
                  : <div className="rounded-xl bg-amber-50 text-amber-700 p-3 text-sm">No UPI ID on file for {payFor.employee_name}. Pay by cash or add a UPI ID on their profile.</div>
              )}
              <div className="flex gap-2 pt-1">
                <button onClick={() => setPayFor(null)} className="btn-ghost flex-1">Cancel</button>
                <button onClick={() => { doApprove(payFor, payMethod); setPayFor(null); }} disabled={!payProject} className="btn-success flex-1">
                  <HandCoins size={16} /> Approve ({payMethod})
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
};
