import React, { useState, useMemo } from 'react';
import {
  HandCoins, Plus, Check, X, Clock, Smartphone, Banknote, Send, CheckCircle2, XCircle, Pencil,
} from 'lucide-react';
import { useData } from '../store/useData';
import { useAuth } from '../store/useAuth';
import { Card, Avatar, Badge, Modal, Field, EmptyState, StatCard } from '../components/ui';
import { UpiPay } from '../components/UpiPay';
import { inr, fmtDate, today } from '../lib/format';
import { advancePending } from '../lib/calc';
import { copyNumberAndOpenGpay } from '../lib/upi';
import type { AdvanceRequest } from '../types';

export const Advances: React.FC = () => {
  const { session } = useAuth();
  const isAdmin = session?.role === 'admin';
  const { employees, requests, giveAdvance, createRequest, approveRequest, rejectRequest, updateRequest } = useData();

  const [reqModal, setReqModal] = useState(false);
  const [directModal, setDirectModal] = useState(false);
  const [approveFor, setApproveFor] = useState<AdvanceRequest | null>(null);
  const [showPay, setShowPay] = useState(false);
  const [editReq, setEditReq] = useState<AdvanceRequest | null>(null);
  const [eAmount, setEAmount] = useState('');
  const [eReason, setEReason] = useState('');
  const [eMethod, setEMethod] = useState<'Cash' | 'UPI'>('UPI');

  const openEditReq = (r: AdvanceRequest) => {
    setEditReq(r); setEAmount(String(r.amount)); setEReason(r.reason); setEMethod(r.method);
  };
  const saveEditReq = () => {
    if (!editReq) return;
    updateRequest(editReq.id, { amount: Number(eAmount) || editReq.amount, reason: eReason.trim() || editReq.reason, method: eMethod });
    setEditReq(null);
  };

  // request form
  const [empId, setEmpId] = useState(session?.employee_id || '');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [method, setMethod] = useState<'Cash' | 'UPI'>('UPI');
  const [giveDate, setGiveDate] = useState(today());

  const activeEmployees = employees.filter((e) => e.status === 'Active');

  const visibleRequests = useMemo(
    () => isAdmin ? requests : requests.filter((r) => r.employee_id === session?.employee_id),
    [requests, isAdmin, session],
  );
  const pending = visibleRequests.filter((r) => r.status === 'Pending');
  const decided = visibleRequests.filter((r) => r.status !== 'Pending');

  const myEmp = employees.find((e) => e.employee_id === (session?.employee_id || empId));

  const submitRequest = () => {
    const amt = Number(amount);
    const e = employees.find((x) => x.employee_id === empId);
    if (!e || !amt || !reason.trim()) return;
    createRequest({ employee_id: e.employee_id, employee_name: e.name, amount: amt, reason: reason.trim(), method });
    setReqModal(false); setAmount(''); setReason('');
  };

  const submitDirect = () => {
    const amt = Number(amount);
    const e = employees.find((x) => x.employee_id === empId);
    if (!e || !amt) return;
    giveAdvance(e.employee_id, amt, method, reason || 'Direct advance', undefined, giveDate);
    if (method === 'UPI') {
      setApproveFor({ employee_id: e.employee_id, employee_name: e.name, amount: amt } as any); setShowPay(true);
      if (e.phone) copyNumberAndOpenGpay(e.phone);
    } else { setDirectModal(false); setAmount(''); setReason(''); }
  };

  const doApprove = (r: AdvanceRequest) => {
    approveRequest(r.id, session?.name || 'Admin');
    const e = employees.find((x) => x.employee_id === r.employee_id);
    if (r.method === 'UPI' && e) {
      setApproveFor(r); setShowPay(true);
      // Copy the worker's number and open GPay so you can paste & pay.
      if (e.phone) copyNumberAndOpenGpay(e.phone);
    }
  };

  const totals = {
    pending: pending.reduce((s, r) => s + r.amount, 0),
    outstanding: (isAdmin ? employees : employees.filter((e) => e.employee_id === session?.employee_id))
      .reduce((s, e) => s + advancePending(e), 0),
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">Advances</h1>
          <p className="text-slate-400 text-sm">{isAdmin ? 'Approve requests & give advances' : 'Request an advance from admin'}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setEmpId(session?.employee_id || ''); setAmount(''); setReason(''); setMethod('UPI'); setReqModal(true); }} className="btn-ghost">
            <Send size={16} /> <span className="hidden sm:inline">Advance Request</span>
          </button>
          {isAdmin && (
            <button onClick={() => { setEmpId(''); setAmount(''); setReason(''); setMethod('Cash'); setGiveDate(today()); setDirectModal(true); }} className="btn-primary">
              <Plus size={16} /> <span className="hidden sm:inline">Give Advance</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Pending Requests" value={String(pending.length)} sub={inr(totals.pending)} tone="bg-amber-50 text-amber-600" icon={<Clock size={20} />} />
        <StatCard label="Advance Outstanding" value={inr(totals.outstanding)} tone="bg-rose-50 text-rose-600" icon={<HandCoins size={20} />} />
      </div>

      {/* Pending requests */}
      <div>
        <h3 className="font-bold text-slate-700 mb-2 flex items-center gap-2">
          <Clock size={17} className="text-amber-500" /> Pending Approval
          {pending.length > 0 && <Badge tone="amber">{pending.length}</Badge>}
        </h3>
        {pending.length === 0 ? (
          <Card className="p-6"><EmptyState title="No pending requests" hint={isAdmin ? 'New requests appear here for approval.' : 'Tap Request to ask for an advance.'} /></Card>
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
                        <Badge tone={r.method === 'UPI' ? 'brand' : 'slate'}>{r.method}</Badge>
                        <span className="text-xs text-slate-400">{fmtDate(r.created_at)}</span>
                      </div>
                      <div className="text-sm text-slate-500 mt-0.5">{r.reason}</div>
                      {e && advancePending(e) > 0 && <div className="text-xs text-rose-500 mt-0.5">Already owes {inr(advancePending(e))}</div>}
                    </div>
                    <div className="text-right flex items-start gap-1">
                      <div className="text-xl font-extrabold text-slate-800">{inr(r.amount)}</div>
                      <button onClick={() => openEditReq(r)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-brand-500" title="Edit request"><Pencil size={15} /></button>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
                      <button onClick={() => rejectRequest(r.id, session?.name || 'Admin')} className="btn-ghost flex-1 text-rose-600"><X size={16} /> Reject</button>
                      <button onClick={() => doApprove(r)} className="btn-success flex-1"><Check size={16} /> Approve{r.method === 'UPI' ? ' & Pay' : ''}</button>
                    </div>
                  )}
                  {!isAdmin && <div className="mt-2 text-xs text-amber-600 font-semibold">Waiting for admin approval… (you can still edit)</div>}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Decided history */}
      {decided.length > 0 && (
        <div>
          <h3 className="font-bold text-slate-700 mb-2">History</h3>
          <Card className="divide-y divide-slate-100">
            {decided.slice(0, 30).map((r) => (
              <div key={r.id} className="flex items-center gap-3 p-3">
                <Avatar name={r.employee_name} size={34} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-700">{r.employee_name}</div>
                  <div className="text-xs text-slate-400 truncate">{r.reason} · {fmtDate(r.decided_at)}</div>
                </div>
                <span className="text-sm font-bold text-slate-600">{inr(r.amount)}</span>
                {r.status === 'Approved'
                  ? <Badge tone="green"><CheckCircle2 size={12} /> Approved</Badge>
                  : <Badge tone="red"><XCircle size={12} /> Rejected</Badge>}
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* Edit request modal */}
      <Modal open={!!editReq} onClose={() => setEditReq(null)} title="Edit Advance Request">
        <div className="space-y-3">
          <Field label="Amount (₹)">
            <input type="number" inputMode="numeric" autoFocus className="input text-lg font-bold" value={eAmount} onChange={(e) => setEAmount(e.target.value)} />
          </Field>
          <Field label="Reason">
            <textarea className="input" rows={2} value={eReason} onChange={(e) => setEReason(e.target.value)} />
          </Field>
          <Field label="Method">
            <div className="grid grid-cols-2 gap-2">
              {(['UPI', 'Cash'] as const).map((m) => (
                <button key={m} onClick={() => setEMethod(m)} className={`btn ${eMethod === m ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  {m === 'Cash' ? <Banknote size={16} /> : <Smartphone size={16} />} {m}
                </button>
              ))}
            </div>
          </Field>
          <div className="flex gap-2 pt-1">
            <button onClick={() => setEditReq(null)} className="btn-ghost flex-1">Cancel</button>
            <button onClick={saveEditReq} className="btn-primary flex-1">Save Changes</button>
          </div>
        </div>
      </Modal>

      {/* Request modal */}
      <Modal open={reqModal} onClose={() => setReqModal(false)} title="Request Advance">
        <div className="space-y-3">
          {isAdmin ? (
            <Field label="Employee (active only)">
              <select className="input" value={empId} onChange={(e) => setEmpId(e.target.value)}>
                <option value="">Select employee…</option>
                {activeEmployees.map((e) => <option key={e.employee_id} value={e.employee_id}>{e.name}</option>)}
              </select>
            </Field>
          ) : (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50">
              <Avatar name={myEmp?.name || ''} src={myEmp?.photo} size={40} />
              <div><div className="font-semibold text-slate-700">{myEmp?.name}</div>
                <div className="text-xs text-rose-500">Current due: {inr(myEmp ? advancePending(myEmp) : 0)}</div></div>
            </div>
          )}
          <Field label="Amount (₹)"><input type="number" autoFocus className="input text-lg" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" /></Field>
          <Field label="Reason"><textarea className="input" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why do you need this advance?" /></Field>
          <Field label="Preferred Method">
            <div className="grid grid-cols-2 gap-2">
              {(['UPI', 'Cash'] as const).map((m) => (
                <button key={m} onClick={() => setMethod(m)} className={`btn ${method === m ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  {m === 'Cash' ? <Banknote size={16} /> : <Smartphone size={16} />} {m}
                </button>
              ))}
            </div>
          </Field>
          <div className="flex gap-2 pt-1">
            <button onClick={() => setReqModal(false)} className="btn-ghost flex-1">Cancel</button>
            <button onClick={submitRequest} disabled={!empId || !amount || !reason.trim()} className="btn-primary flex-1"><Send size={16} /> Send Request</button>
          </div>
        </div>
      </Modal>

      {/* Direct give (admin) */}
      <Modal open={directModal} onClose={() => setDirectModal(false)} title="Give Advance Directly">
        {showPay && approveFor ? null : (
          <div className="space-y-3">
            <Field label="Employee (active only)">
              <select className="input" value={empId} onChange={(e) => setEmpId(e.target.value)}>
                <option value="">Select employee…</option>
                {activeEmployees.map((e) => <option key={e.employee_id} value={e.employee_id}>{e.name}</option>)}
              </select>
            </Field>
            {empId && myEmp && <div className="text-xs text-rose-500">Current due: {inr(advancePending(myEmp))}{myEmp.upi_id ? ` · UPI: ${myEmp.upi_id}` : ' · no UPI on file'}</div>}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount (₹)"><input type="number" className="input text-lg" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" /></Field>
              <Field label="Date"><input type="date" className="input" value={giveDate} onChange={(e) => setGiveDate(e.target.value)} /></Field>
            </div>
            <Field label="Note"><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional remark" /></Field>
            <Field label="Method">
              <div className="grid grid-cols-2 gap-2">
                {(['Cash', 'UPI'] as const).map((m) => (
                  <button key={m} onClick={() => setMethod(m)} className={`btn ${method === m ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    {m === 'Cash' ? <Banknote size={16} /> : <Smartphone size={16} />} {m}
                  </button>
                ))}
              </div>
            </Field>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setDirectModal(false)} className="btn-ghost flex-1">Cancel</button>
              <button onClick={submitDirect} disabled={!empId || !amount} className="btn-primary flex-1">{method === 'UPI' ? 'Give & Pay' : 'Give Advance'}</button>
            </div>
          </div>
        )}
      </Modal>

      {/* UPI pay sheet (after approve / direct) */}
      <Modal open={showPay} onClose={() => { setShowPay(false); setApproveFor(null); setDirectModal(false); }} title="Send Payment">
        {approveFor && (() => {
          const e = employees.find((x) => x.employee_id === approveFor.employee_id);
          return (
            <div className="space-y-3">
              <div className="rounded-xl bg-emerald-50 text-emerald-700 p-3 text-sm font-semibold text-center">
                ✓ {inr(approveFor.amount)} advance recorded for {approveFor.employee_name}
              </div>
              {e?.upi_id
                ? <UpiPay vpa={e.upi_id} name={e.name} amount={approveFor.amount} note="Advance" phone={e.phone} />
                : <div className="rounded-xl bg-amber-50 text-amber-700 p-3 text-sm">No UPI ID on file. Pay by cash or add a UPI ID on their profile.</div>}
              <button onClick={() => { setShowPay(false); setApproveFor(null); setDirectModal(false); }} className="btn-ghost w-full">Done</button>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
};
