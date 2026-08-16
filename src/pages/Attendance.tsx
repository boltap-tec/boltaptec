import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Clock, Trash2, Calendar, Users, Search, CheckCircle2, Zap, Pencil, MapPin, Send, Hourglass, XCircle, ClipboardCheck } from 'lucide-react';
import { useData } from '../store/useData';
import { Card, Avatar, Modal, Field, EmptyState, Badge } from '../components/ui';
import { inr, today, fmtDate, nowClock24, to12h, to24h } from '../lib/format';
import { hoursBetween, computeAttendanceSalary, STANDARD_HOURS, hourlyRate } from '../lib/calc';
import { hasCoords, mapsLink, fmtCoords } from '../lib/geo';
import { confirmAction } from '../lib/guard';
import type { Attendance as AttRow } from '../types';

// A tappable location pill that opens the punch spot in Google Maps.
const LocPin: React.FC<{ label: string; lat?: number | null; lng?: number | null }> = ({ label, lat, lng }) =>
  hasCoords(lat, lng) ? (
    <a href={mapsLink(lat as number, lng as number)} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded-lg bg-brand-50 text-brand-700 px-2 py-0.5 text-[11px] font-semibold hover:bg-brand-100"
      title={fmtCoords(lat as number, lng as number)}>
      <MapPin size={11} /> {label}
    </a>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 text-slate-400 px-2 py-0.5 text-[11px] font-semibold" title="No location captured">
      <MapPin size={11} /> {label}: —
    </span>
  );

interface MarkedSummary { name: string; hours: number; ot: number; salary: number; shifts: number; }

export const Attendance: React.FC = () => {
  const { employees, attendance, addAttendance, updateAttendance, deleteAttendance, postAttendance, rejectAttendance, projects, settings } = useData();
  const [view, setView] = useState<'ledger' | 'approval'>('ledger');
  const [apprTab, setApprTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const activeProjects = projects.filter((p) => p.status === 'Running');
  const planProject = settings.today_plan_date === today() ? settings.today_project_id : null;

  // Land on the Approval queue when workers have punches waiting (so self-punches
  // are never missed on the default Ledger view). Runs once on open.
  useEffect(() => {
    if (attendance.some((a) => a.status === 'pending')) setView('approval');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [modal, setModal] = useState(false);
  const [date, setDate] = useState(today());
  const [ids, setIds] = useState<string[]>([]);
  const [timeIn, setTimeIn] = useState('09:30');   // 24h for <input type="time">
  const [timeOut, setTimeOut] = useState('18:30');
  const [lunch, setLunch] = useState(settings.lunch_hours ?? 1);
  const [markProject, setMarkProject] = useState('');   // project for this batch's labour expenditure
  const [filterDate, setFilterDate] = useState('');
  const [q, setQ] = useState('');
  const [summary, setSummary] = useState<MarkedSummary[] | null>(null);
  const [editRow, setEditRow] = useState<AttRow | null>(null);
  const [eDate, setEDate] = useState('');
  const [eIn, setEIn] = useState('');
  const [eOut, setEOut] = useState('');
  const [eLunch, setELunch] = useState(0);
  const [eAllocs, setEAllocs] = useState<{ project_id: string; hours: number }[]>([]);

  const openEdit = (a: AttRow) => {
    setEditRow(a); setEDate(a.date); setEIn(to24h(a.time_in)); setEOut(to24h(a.time_out)); setELunch(a.lunch_hours ?? 0);
    const existing = (a.project_allocations || []).map((x) => ({ project_id: x.project_id, hours: x.hours }));
    setEAllocs(existing.length ? existing : (planProject ? [{ project_id: planProject, hours: a.total_hours || 0 }] : []));
  };
  const saveEdit = () => {
    if (!editRow) return;
    const allocs = eAllocs
      .filter((x) => x.project_id && x.hours > 0)
      .slice(0, 2)
      .map((x) => {
        const p = projects.find((pp) => pp.project_id === x.project_id)!;
        return { project_id: p.project_id, project_name: p.name, hours: x.hours, amount: Math.round(x.hours * hourlyRate(editRow.daily_wage)) };
      });
    updateAttendance(editRow.id, {
      date: eDate, time_in: to12h(eIn), time_out: eOut ? to12h(eOut) : editRow.time_out || '',
      lunch_hours: Number(eLunch) || 0, project_allocations: allocs.length ? allocs : null,
    });
    setEditRow(null);
  };
  const eGross = eIn && eOut ? hoursBetween(eIn, eOut) : 0;
  const eHours = Math.max(0, eGross - (Number(eLunch) || 0));

  const grossHours = hoursBetween(timeIn, timeOut);
  const hours = Math.max(0, grossHours - (Number(lunch) || 0)); // net paid hours

  // Employees already marked on the chosen date — hidden from the picker so
  // nobody gets marked twice in one day.
  const markedOnDate = useMemo(
    () => new Set(attendance.filter((a) => a.date === date).map((a) => a.employee_id)),
    [attendance, date],
  );
  const active = employees.filter((e) => e.status === 'Active');
  const selectable = active.filter((e) => !markedOnDate.has(e.employee_id));
  const alreadyDone = active.filter((e) => markedOnDate.has(e.employee_id));

  const byDateDesc = (a: AttRow, b: AttRow) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0);
  // Worker self-punches, split by approval state for the Approval screen.
  const pending = useMemo(() => attendance.filter((a) => a.status === 'pending').sort(byDateDesc), [attendance]);
  const approved = useMemo(() => attendance.filter((a) => a.source === 'employee' && a.status === 'posted').sort(byDateDesc).slice(0, 100), [attendance]);
  const rejected = useMemo(() => attendance.filter((a) => a.status === 'rejected').sort(byDateDesc).slice(0, 100), [attendance]);

  // The ledger shows confirmed records only (approved self-punches + admin entries).
  const rows = useMemo(() => attendance.filter((a) =>
    a.status !== 'pending' && a.status !== 'rejected' &&
    (!filterDate || a.date === filterDate) &&
    (!q || a.employee_name.toLowerCase().includes(q.toLowerCase())),
  ).slice(0, 200), [attendance, filterDate, q]);

  const reject = (a: AttRow) => {
    const reason = prompt(`Reject ${a.employee_name}'s attendance on ${fmtDate(a.date)}?\nOptional reason:`, '');
    if (reason === null) return; // cancelled
    rejectAttendance(a.id, reason.trim() || undefined);
  };

  const grouped = useMemo(() => {
    const m = new Map<string, typeof rows>();
    rows.forEach((r) => { const k = r.date; if (!m.has(k)) m.set(k, [] as any); (m.get(k) as any).push(r); });
    return [...m.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [rows]);

  const toggle = (id: string) =>
    setIds((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);

  const save = () => {
    if (ids.length === 0 || hours <= 0) return;
    const tIn = to12h(timeIn);
    const tOut = to12h(timeOut);
    const refNames = ids.join(' , ');
    const result: MarkedSummary[] = [];
    const proj = markProject ? projects.find((p) => p.project_id === markProject) : null;
    ids.forEach((id) => {
      const e = employees.find((x) => x.employee_id === id)!;
      const { salary_amount, extra_time } = computeAttendanceSalary(hours, e.daily_wage);
      const project_allocations = proj
        ? [{ project_id: proj.project_id, project_name: proj.name, hours, amount: Math.round(hours * hourlyRate(e.daily_wage)) }]
        : null;
      addAttendance({
        date, employee_id: id, employee_name: e.name,
        time_in: tIn, time_out: tOut, total_hours: hours,
        salary_amount, daily_wage: e.daily_wage, ref_names: refNames, extra_time,
        lunch_hours: Number(lunch) || 0, project_allocations,
      });
      const shifts = attendance.filter((a) => a.employee_id === id && a.date === date).length + 1;
      result.push({ name: e.name, hours, ot: extra_time, salary: salary_amount, shifts });
    });
    setModal(false); setIds([]);
    setSummary(result); // show confirmation recap
  };

  const setNow = (which: 'in' | 'out') =>
    which === 'in' ? setTimeIn(nowClock24()) : setTimeOut(nowClock24());

  // One row in the Approval screen (pending / approved / rejected all share this).
  const apprRow = (a: AttRow) => {
    const closed = !!a.time_out;
    return (
      <div key={a.id} className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar name={a.employee_name} size={34} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-slate-700">{a.employee_name}</div>
            <div className="text-xs text-slate-400">
              {fmtDate(a.date)} · {a.time_in || '—'}{closed ? ` – ${a.time_out} · ${a.total_hours}h` : ' · open, not closed yet'}
            </div>
            {a.project_allocations && a.project_allocations.length > 0 && (
              <div className="text-[11px] text-brand-600 font-semibold truncate">🏗 {a.project_allocations.map((x) => `${x.project_name} (${x.hours}h)`).join(' · ')}</div>
            )}
            {a.status === 'rejected' && a.reject_reason && <div className="text-xs text-rose-500 mt-0.5">Reason: {a.reject_reason}</div>}
          </div>
          {closed && <span className="text-sm font-bold text-slate-700">{inr(a.salary_amount)}</span>}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <LocPin label="Open" lat={a.open_lat} lng={a.open_lng} />
          <LocPin label="Close" lat={a.close_lat} lng={a.close_lng} />
          <div className="flex-1" />
          {a.status === 'pending' && (
            <>
              <button onClick={() => openEdit(a)} className="btn-ghost px-2.5 py-1 text-xs"><Pencil size={13} /> Correct</button>
              {closed
                ? <button onClick={() => postAttendance(a.id)} className="btn-success px-2.5 py-1 text-xs"><CheckCircle2 size={13} /> Approve</button>
                : <span className="text-[11px] text-slate-400 font-semibold px-1">Waiting for worker to close</span>}
              <button onClick={() => reject(a)} className="btn-ghost px-2.5 py-1 text-xs text-rose-500"><XCircle size={13} /> Reject</button>
            </>
          )}
          {a.status === 'rejected' && (
            <button onClick={() => postAttendance(a.id)} className="btn-ghost px-2.5 py-1 text-xs text-emerald-600"><CheckCircle2 size={13} /> Approve instead</button>
          )}
          {a.status === 'posted' && <span className="text-[11px] text-emerald-600 font-semibold px-1 inline-flex items-center gap-1"><CheckCircle2 size={12} /> In ledger</span>}
          <button onClick={() => { if (confirmAction(`Delete ${a.employee_name}'s attendance?`)) deleteAttendance(a.id); }} className="p-1.5 rounded-lg text-rose-300 hover:bg-rose-50"><Trash2 size={14} /></button>
        </div>
      </div>
    );
  };
  const apprList = apprTab === 'pending' ? pending : apprTab === 'approved' ? approved : rejected;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">Attendance</h1>
          <p className="text-slate-400 text-sm">{attendance.length} records · hours auto-calculate salary</p>
        </div>
        <button onClick={() => { setModal(true); setDate(today()); setIds([]); setLunch(settings.lunch_hours ?? 1); setMarkProject(planProject || ''); }} className="btn-primary">
          <Plus size={18} /> <span className="hidden sm:inline">Mark</span>
        </button>
      </div>

      {/* Switch between the confirmed ledger and the worker approval queue */}
      <div className="flex gap-2">
        <button onClick={() => setView('ledger')}
          className={`px-4 py-2 rounded-xl text-sm font-bold inline-flex items-center gap-1.5 ${view === 'ledger' ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>
          <Calendar size={15} /> Attendance Ledger
        </button>
        <button onClick={() => setView('approval')}
          className={`px-4 py-2 rounded-xl text-sm font-bold inline-flex items-center gap-1.5 ${view === 'approval' ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>
          <ClipboardCheck size={15} /> Approval
          {pending.length > 0 && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${view === 'approval' ? 'bg-white/25' : 'bg-rose-500 text-white'}`}>{pending.length}</span>}
        </button>
      </div>

      {view === 'approval' && (
        <Card className="overflow-hidden">
          <div className="flex border-b border-slate-100">
            {(['pending', 'approved', 'rejected'] as const).map((t) => {
              const n = t === 'pending' ? pending.length : t === 'approved' ? approved.length : rejected.length;
              return (
                <button key={t} onClick={() => setApprTab(t)}
                  className={`flex-1 py-2.5 text-sm font-bold capitalize transition ${apprTab === t ? 'text-brand-600 border-b-2 border-brand-600' : 'text-slate-400'}`}>
                  {t}{n > 0 ? ` (${n})` : ''}
                </button>
              );
            })}
          </div>
          {apprList.length === 0 ? (
            <div className="p-6"><EmptyState icon={<Hourglass size={36} />} title={`No ${apprTab} attendance`}
              hint={apprTab === 'pending' ? 'Worker open/close punches appear here for you to approve.' : undefined} /></div>
          ) : (
            <div className="divide-y divide-slate-50">{apprList.map(apprRow)}</div>
          )}
        </Card>
      )}

      {view === 'ledger' && (
      <>
      {pending.length > 0 && (
        <button onClick={() => setView('approval')}
          className="w-full flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 px-4 py-2.5 text-sm font-semibold">
          <Hourglass size={16} /> {pending.length} worker punch{pending.length > 1 ? 'es' : ''} waiting for approval — tap to review
        </button>
      )}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-10" placeholder="Search employee…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <input type="date" className="input sm:w-48" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
        {filterDate && <button onClick={() => setFilterDate('')} className="btn-ghost">Clear</button>}
      </div>

      {grouped.length === 0 ? (
        <Card className="p-6"><EmptyState icon={<Clock size={40} />} title="No attendance records" hint="Mark attendance to auto-calculate daily salary." /></Card>
      ) : (
        <div className="space-y-4">
          {grouped.map(([d, list]) => {
            const total = list.reduce((s, r) => s + r.salary_amount, 0);
            return (
              <Card key={d} className="overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                  <div className="flex items-center gap-2 font-bold text-slate-700 text-sm">
                    <Calendar size={16} className="text-brand-500" /> {fmtDate(d)}
                    <Badge tone="brand">{list.length}</Badge>
                  </div>
                  <span className="text-sm font-bold text-slate-600">{inr(total)}</span>
                </div>
                <div className="divide-y divide-slate-50">
                  {list.map((a) => (
                    <div key={a.id} className="flex items-center gap-3 px-4 py-2.5 group">
                      <Avatar name={a.employee_name} size={34} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-slate-700">{a.employee_name}</div>
                        <div className="text-xs text-slate-400">{a.time_in} – {a.time_out} · {a.total_hours}h {a.extra_time > 0 && <span className="text-brand-500 font-semibold">+{a.extra_time} OT</span>}</div>
                        {a.project_allocations && a.project_allocations.length > 0 && (
                          <div className="text-[11px] text-brand-600 font-semibold truncate">🏗 {a.project_allocations.map((x) => `${x.project_name} (${x.hours}h)`).join(' · ')}</div>
                        )}
                        {(hasCoords(a.open_lat, a.open_lng) || hasCoords(a.close_lat, a.close_lng)) && (
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            <LocPin label="Open" lat={a.open_lat} lng={a.open_lng} />
                            <LocPin label="Close" lat={a.close_lat} lng={a.close_lng} />
                          </div>
                        )}
                      </div>
                      <span className="text-sm font-bold text-slate-700">{inr(a.salary_amount)}</span>
                      <button onClick={() => openEdit(a)} className="p-1.5 rounded-lg text-slate-300 hover:bg-slate-100 hover:text-brand-500 opacity-0 group-hover:opacity-100">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => { if (confirmAction(`Delete ${a.employee_name}'s attendance?`)) deleteAttendance(a.id); }} className="p-1.5 rounded-lg text-rose-300 hover:bg-rose-50 opacity-0 group-hover:opacity-100">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}
      </>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Mark Attendance" wide>
        <div className="space-y-3">
          <Field label="Date"><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Time In">
              <div className="flex gap-1.5">
                <input type="time" className="input" value={timeIn} onChange={(e) => setTimeIn(e.target.value)} />
                <button type="button" onClick={() => setNow('in')} className="btn-ghost px-2.5 shrink-0" title="Use current time"><Zap size={15} /> Now</button>
              </div>
            </Field>
            <Field label="Time Out">
              <div className="flex gap-1.5">
                <input type="time" className="input" value={timeOut} onChange={(e) => setTimeOut(e.target.value)} />
                <button type="button" onClick={() => setNow('out')} className="btn-ghost px-2.5 shrink-0" title="Use current time"><Zap size={15} /> Now</button>
              </div>
            </Field>
          </div>
          <Field label="Lunch / Break (hours) — deducted from shift">
            <input type="number" step="0.5" min="0" className="input" value={lunch} onChange={(e) => setLunch(Number(e.target.value))} />
          </Field>
          <Field label="Project (labour expenditure)" hint={planProject ? "Defaults to today's work." : 'Optional — links these hours to a project.'}>
            <select className="input" value={markProject} onChange={(e) => setMarkProject(e.target.value)}>
              <option value="">No project</option>
              {activeProjects.map((p) => <option key={p.project_id} value={p.project_id}>{p.name}{p.project_id === planProject ? ' (today)' : ''}</option>)}
            </select>
          </Field>
          <div className="rounded-xl bg-brand-50 text-brand-700 px-3 py-2 text-sm font-semibold flex items-center justify-between flex-wrap gap-1">
            <span className="flex items-center gap-1.5">
              <Clock size={15} /> {grossHours > 0 ? `${grossHours}h − ${Number(lunch) || 0}h lunch = ${hours}h paid` : 'Enter valid times'}
            </span>
            {hours > STANDARD_HOURS && <span>OT: {(hours - STANDARD_HOURS).toFixed(1)}h</span>}
          </div>
          <div>
            <label className="label flex items-center justify-between">
              <span className="flex items-center gap-1"><Users size={13} /> Select Employees ({selectable.length} available)</span>
              {selectable.length > 0 && (
                <button onClick={() => setIds(ids.length === selectable.length ? [] : selectable.map((e) => e.employee_id))}
                  className="text-brand-600 font-semibold">{ids.length === selectable.length ? 'Clear' : 'Select all'}</button>
              )}
            </label>
            {selectable.length === 0 ? (
              <div className="rounded-xl bg-emerald-50 text-emerald-700 px-3 py-4 text-sm font-semibold text-center">
                ✓ Everyone is already marked for {fmtDate(date)}.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto">
                {selectable.map((e) => {
                  const sel = ids.includes(e.employee_id);
                  const sal = hours > 0 ? computeAttendanceSalary(hours, e.daily_wage).salary_amount : 0;
                  return (
                    <button key={e.employee_id} onClick={() => toggle(e.employee_id)}
                      className={`flex items-center gap-2 p-2 rounded-xl border text-left transition ${sel ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-slate-300'}`}>
                      <Avatar name={e.name} src={e.photo} size={30} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-slate-700 truncate">{e.name}</div>
                        {sel && sal > 0 && <div className="text-xs text-brand-600 font-semibold">{inr(sal)}</div>}
                      </div>
                      <div className={`h-4 w-4 rounded-md border-2 ${sel ? 'bg-brand-600 border-brand-600' : 'border-slate-300'}`} />
                    </button>
                  );
                })}
              </div>
            )}
            {alreadyDone.length > 0 && (
              <div className="mt-2 text-xs text-slate-400">
                Already marked today: {alreadyDone.map((e) => e.name).join(', ')}
              </div>
            )}
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={() => setModal(false)} className="btn-ghost flex-1">Cancel</button>
            <button onClick={save} disabled={ids.length === 0 || hours <= 0} className="btn-primary flex-1">
              Mark {ids.length > 0 ? `(${ids.length})` : ''}
            </button>
          </div>
        </div>
      </Modal>

      {/* Confirmation recap: shifts + OT per employee */}
      <Modal open={!!summary} onClose={() => setSummary(null)} title="Attendance Marked ✓">
        <div className="space-y-3">
          <div className="rounded-xl bg-emerald-50 text-emerald-700 p-3 text-sm font-semibold text-center">
            {summary?.length} employee{summary && summary.length > 1 ? 's' : ''} marked for {fmtDate(date)}
          </div>
          <div className="divide-y divide-slate-100">
            {summary?.map((s, i) => (
              <div key={i} className="flex items-center gap-3 py-2.5">
                <Avatar name={s.name} size={34} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-slate-700">{s.name}</div>
                  <div className="flex gap-1.5 mt-0.5">
                    <Badge tone="brand">{s.shifts} shift{s.shifts > 1 ? 's' : ''}</Badge>
                    <Badge tone="slate">{s.hours}h</Badge>
                    {s.ot > 0 ? <Badge tone="amber">{s.ot}h OT</Badge> : <Badge tone="green">No OT</Badge>}
                  </div>
                </div>
                <span className="font-bold text-slate-700">{inr(s.salary)}</span>
              </div>
            ))}
          </div>
          <div className="rounded-xl bg-slate-50 p-3 flex items-center justify-between text-sm">
            <span className="font-semibold text-slate-500">Total OT hours</span>
            <span className="font-bold text-amber-600">{summary?.reduce((a, s) => a + s.ot, 0)}h</span>
          </div>
          <button onClick={() => setSummary(null)} className="btn-primary w-full"><CheckCircle2 size={17} /> Done</button>
        </div>
      </Modal>

      {/* Edit a single attendance record */}
      <Modal open={!!editRow} onClose={() => setEditRow(null)} title={`Edit · ${editRow?.employee_name || ''}`}>
        <div className="space-y-3">
          <Field label="Date"><input type="date" className="input" value={eDate} onChange={(e) => setEDate(e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Time In">
              <div className="flex gap-1.5">
                <input type="time" className="input" value={eIn} onChange={(e) => setEIn(e.target.value)} />
                <button type="button" onClick={() => setEIn(nowClock24())} className="btn-ghost px-2.5 shrink-0"><Zap size={15} /></button>
              </div>
            </Field>
            <Field label="Time Out">
              <div className="flex gap-1.5">
                <input type="time" className="input" value={eOut} onChange={(e) => setEOut(e.target.value)} />
                <button type="button" onClick={() => setEOut(nowClock24())} className="btn-ghost px-2.5 shrink-0"><Zap size={15} /></button>
              </div>
            </Field>
          </div>
          <Field label="Lunch / Break (hours)">
            <input type="number" step="0.5" min="0" className="input" value={eLunch} onChange={(e) => setELunch(Number(e.target.value))} />
          </Field>
          <div className="rounded-xl bg-brand-50 text-brand-700 px-3 py-2 text-sm font-semibold flex items-center justify-between flex-wrap gap-1">
            <span className="flex items-center gap-1.5"><Clock size={15} /> {eGross > 0 ? `${eGross}h − ${Number(eLunch) || 0}h = ${eHours}h paid` : 'Enter valid times'}</span>
            {eHours > STANDARD_HOURS && <span>OT: {(eHours - STANDARD_HOURS).toFixed(1)}h</span>}
          </div>
          {editRow && eHours > 0 && (
            <div className="text-xs text-slate-400">New salary: {inr(computeAttendanceSalary(eHours, editRow.daily_wage).salary_amount)} (was {inr(editRow.salary_amount)})</div>
          )}
          {/* Project allocation → labour expenditure (split up to 2 projects) */}
          <div className="rounded-xl border border-slate-200 p-3 space-y-2">
            <div className="text-xs font-bold text-slate-500 flex items-center justify-between">
              <span>Project(s) — labour expenditure</span>
              {eAllocs.length < 2 && activeProjects.length > 0 && (
                <button onClick={() => setEAllocs([...eAllocs, { project_id: '', hours: 0 }])} className="text-brand-600 font-semibold">+ Add project</button>
              )}
            </div>
            {eAllocs.length === 0 && <div className="text-xs text-slate-400">No project linked. Add one to record labour cost.</div>}
            {eAllocs.map((al, i) => (
              <div key={i} className="flex gap-2 items-center">
                <select className="input flex-1" value={al.project_id}
                  onChange={(e) => setEAllocs(eAllocs.map((x, j) => (j === i ? { ...x, project_id: e.target.value } : x)))}>
                  <option value="">Select project…</option>
                  {activeProjects.map((p) => <option key={p.project_id} value={p.project_id}>{p.name}{p.project_id === planProject ? ' (today)' : ''}</option>)}
                </select>
                <input type="number" step="0.5" min="0" className="input w-24" placeholder="hrs" value={al.hours || ''}
                  onChange={(e) => setEAllocs(eAllocs.map((x, j) => (j === i ? { ...x, hours: Number(e.target.value) || 0 } : x)))} />
                <button onClick={() => setEAllocs(eAllocs.filter((_, j) => j !== i))} className="p-1.5 rounded-lg text-rose-300 hover:bg-rose-50"><Trash2 size={14} /></button>
              </div>
            ))}
            {eAllocs.length > 0 && (
              <div className="text-[11px] text-slate-400">
                Allocated {eAllocs.reduce((s, x) => s + (x.hours || 0), 0)}h of {eHours}h paid.
              </div>
            )}
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={() => { if (editRow && confirm('Delete this record?')) { deleteAttendance(editRow.id); setEditRow(null); } }} className="btn-danger px-3"><Trash2 size={16} /></button>
            <button onClick={() => setEditRow(null)} className="btn-ghost flex-1">Cancel</button>
            {editRow?.status === 'pending'
              ? <button onClick={() => { const id = editRow.id; saveEdit(); postAttendance(id); }} disabled={!eOut} className="btn-success flex-1"><Send size={15} /> Save & Approve</button>
              : <button onClick={saveEdit} className="btn-primary flex-1">Save</button>}
          </div>
        </div>
      </Modal>
    </div>
  );
};
