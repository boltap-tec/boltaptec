import React, { useState, useMemo } from 'react';
import { Plus, Clock, Trash2, Calendar, Users, Search, CheckCircle2, Zap, Pencil, MapPin, Send, Hourglass } from 'lucide-react';
import { useData } from '../store/useData';
import { Card, Avatar, Modal, Field, EmptyState, Badge } from '../components/ui';
import { inr, today, fmtDate, nowClock24, to12h, to24h } from '../lib/format';
import { hoursBetween, computeAttendanceSalary, STANDARD_HOURS } from '../lib/calc';
import { hasCoords, mapsLink, fmtCoords } from '../lib/geo';
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
  const { employees, attendance, addAttendance, updateAttendance, deleteAttendance, postAttendance, settings } = useData();
  const [modal, setModal] = useState(false);
  const [date, setDate] = useState(today());
  const [ids, setIds] = useState<string[]>([]);
  const [timeIn, setTimeIn] = useState('09:00');   // 24h for <input type="time">
  const [timeOut, setTimeOut] = useState('18:00');
  const [lunch, setLunch] = useState(settings.lunch_hours ?? 1);
  const [filterDate, setFilterDate] = useState('');
  const [q, setQ] = useState('');
  const [summary, setSummary] = useState<MarkedSummary[] | null>(null);
  const [editRow, setEditRow] = useState<AttRow | null>(null);
  const [eDate, setEDate] = useState('');
  const [eIn, setEIn] = useState('');
  const [eOut, setEOut] = useState('');
  const [eLunch, setELunch] = useState(0);

  const openEdit = (a: AttRow) => {
    setEditRow(a); setEDate(a.date); setEIn(to24h(a.time_in)); setEOut(to24h(a.time_out)); setELunch(a.lunch_hours ?? 0);
  };
  const saveEdit = () => {
    if (!editRow) return;
    updateAttendance(editRow.id, { date: eDate, time_in: to12h(eIn), time_out: eOut ? to12h(eOut) : editRow.time_out || '', lunch_hours: Number(eLunch) || 0 });
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

  // Worker self-punches awaiting admin review (newest first). Kept out of the
  // posted list below so a record shows in exactly one place.
  const pending = useMemo(
    () => attendance.filter((a) => a.status === 'pending')
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [attendance],
  );

  const rows = useMemo(() => attendance.filter((a) =>
    a.status !== 'pending' &&
    (!filterDate || a.date === filterDate) &&
    (!q || a.employee_name.toLowerCase().includes(q.toLowerCase())),
  ).slice(0, 200), [attendance, filterDate, q]);

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
    ids.forEach((id) => {
      const e = employees.find((x) => x.employee_id === id)!;
      const { salary_amount, extra_time } = computeAttendanceSalary(hours, e.daily_wage);
      addAttendance({
        date, employee_id: id, employee_name: e.name,
        time_in: tIn, time_out: tOut, total_hours: hours,
        salary_amount, daily_wage: e.daily_wage, ref_names: refNames, extra_time,
        lunch_hours: Number(lunch) || 0,
      });
      const shifts = attendance.filter((a) => a.employee_id === id && a.date === date).length + 1;
      result.push({ name: e.name, hours, ot: extra_time, salary: salary_amount, shifts });
    });
    setModal(false); setIds([]);
    setSummary(result); // show confirmation recap
  };

  const setNow = (which: 'in' | 'out') =>
    which === 'in' ? setTimeIn(nowClock24()) : setTimeOut(nowClock24());

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">Attendance</h1>
          <p className="text-slate-400 text-sm">{attendance.length} records · hours auto-calculate salary</p>
        </div>
        <button onClick={() => { setModal(true); setDate(today()); setIds([]); setLunch(settings.lunch_hours ?? 1); }} className="btn-primary">
          <Plus size={18} /> <span className="hidden sm:inline">Mark</span>
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-10" placeholder="Search employee…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <input type="date" className="input sm:w-48" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
        {filterDate && <button onClick={() => setFilterDate('')} className="btn-ghost">Clear</button>}
      </div>

      {/* Worker self-punches waiting for the admin to correct & post */}
      {pending.length > 0 && (
        <Card className="overflow-hidden border-l-4 border-l-amber-400">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border-b border-amber-100 font-bold text-amber-700 text-sm">
            <Hourglass size={16} /> Pending Review · from workers
            <Badge tone="amber">{pending.length}</Badge>
          </div>
          <div className="divide-y divide-slate-50">
            {pending.map((a) => {
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
                    </div>
                    {closed && <span className="text-sm font-bold text-slate-700">{inr(a.salary_amount)}</span>}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <LocPin label="Open" lat={a.open_lat} lng={a.open_lng} />
                    <LocPin label="Close" lat={a.close_lat} lng={a.close_lng} />
                    <div className="flex-1" />
                    <button onClick={() => openEdit(a)} className="btn-ghost px-2.5 py-1 text-xs"><Pencil size={13} /> Correct</button>
                    {closed ? (
                      <button onClick={() => postAttendance(a.id)} className="btn-success px-2.5 py-1 text-xs"><Send size={13} /> Post</button>
                    ) : (
                      <span className="text-[11px] text-slate-400 font-semibold px-1">Waiting for worker to close</span>
                    )}
                    <button onClick={() => deleteAttendance(a.id)} className="p-1.5 rounded-lg text-rose-300 hover:bg-rose-50"><Trash2 size={14} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

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
                      <button onClick={() => deleteAttendance(a.id)} className="p-1.5 rounded-lg text-rose-300 hover:bg-rose-50 opacity-0 group-hover:opacity-100">
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
          <div className="flex gap-2 pt-1">
            <button onClick={() => { if (editRow && confirm('Delete this record?')) { deleteAttendance(editRow.id); setEditRow(null); } }} className="btn-danger px-3"><Trash2 size={16} /></button>
            <button onClick={() => setEditRow(null)} className="btn-ghost flex-1">Cancel</button>
            {editRow?.status === 'pending'
              ? <button onClick={() => { const id = editRow.id; saveEdit(); postAttendance(id); }} disabled={!eOut} className="btn-success flex-1"><Send size={15} /> Save & Post</button>
              : <button onClick={saveEdit} className="btn-primary flex-1">Save</button>}
          </div>
        </div>
      </Modal>
    </div>
  );
};
