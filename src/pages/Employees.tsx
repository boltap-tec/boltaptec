import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Phone, MapPin, Pencil, Trash2, ChevronRight } from 'lucide-react';
import { useData } from '../store/useData';
import type { Employee } from '../types';
import { Card, Avatar, Modal, Field, EmptyState, StatusDot } from '../components/ui';
import { inr } from '../lib/format';
import { advancePending } from '../lib/calc';
import { isValidVpa } from '../lib/upi';
import { confirmProtected } from '../lib/guard';

const blank = { name: '', address: '', phone: '', daily_wage: '', upi_id: '', pin: '', status: 'Active' as const };

export const Employees: React.FC = () => {
  const { employees, addEmployee, updateEmployee, deleteEmployee } = useData();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'Active' | 'Not_Active'>('all');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState<any>(blank);
  const [photo, setPhoto] = useState<string | null>(null);

  const filtered = useMemo(() => employees.filter((e) =>
    (filter === 'all' || e.status === filter) &&
    (e.name.toLowerCase().includes(q.toLowerCase()) || (e.phone || '').includes(q)),
  ), [employees, q, filter]);

  const openAdd = () => { setEditing(null); setForm(blank); setPhoto(null); setModal(true); };
  const openEdit = (e: Employee) => {
    setEditing(e);
    setForm({ name: e.name, address: e.address || '', phone: e.phone || '', daily_wage: String(e.daily_wage), upi_id: e.upi_id || '', pin: e.pin || '', status: e.status });
    setPhoto(e.photo);
    setModal(true);
  };

  const onPhoto = (f: File | null) => {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setPhoto(r.result as string);
    r.readAsDataURL(f);
  };

  const save = () => {
    if (!form.name.trim() || !form.daily_wage) return;
    if (form.upi_id && !isValidVpa(form.upi_id)) { alert('UPI ID looks invalid (e.g. name@okaxis)'); return; }
    const pin = (form.pin || '').trim() || (form.phone ? form.phone.replace(/\D/g, '').slice(-4) : '1234');
    if (!/^\d{4}$/.test(pin)) { alert('PIN must be exactly 4 digits'); return; }
    // If the phone number changed, release the old device binding so the worker
    // can log in from their new phone.
    const phoneChanged = !!editing && (editing.phone || '') !== form.phone;
    const payload: any = {
      name: form.name, address: form.address, phone: form.phone,
      daily_wage: Number(form.daily_wage), upi_id: form.upi_id || null,
      pin, status: form.status, photo,
      ...(phoneChanged ? { device_id: null } : {}),
    };
    if (editing) updateEmployee(editing.employee_id, payload);
    else addEmployee(payload as any);
    setModal(false);
  };

  const remove = (e: Employee) => {
    if (confirmProtected(`Delete ${e.name}? This cannot be undone.`)) deleteEmployee(e.employee_id);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">Employees</h1>
          <p className="text-slate-400 text-sm">{employees.length} total · {employees.filter(e => e.status === 'Active').length} active</p>
        </div>
        <button onClick={openAdd} className="btn-primary"><Plus size={18} /> <span className="hidden sm:inline">Add Employee</span></button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-10" placeholder="Search by name or phone…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
          {(['all', 'Active', 'Not_Active'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap transition ${filter === f ? 'bg-white shadow-sm text-brand-700' : 'text-slate-500'}`}>
              {f === 'all' ? 'All' : f === 'Active' ? 'Active' : 'Inactive'}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-6"><EmptyState title="No employees found" hint="Try a different search or add a new employee." /></Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((e) => {
            const ap = advancePending(e);
            return (
              <Card key={e.employee_id} className="p-4 hover:shadow-soft transition group">
                <div className="flex items-start gap-3">
                  <Avatar name={e.name} src={e.photo} size={48} />
                  <div className="flex-1 min-w-0">
                    <Link to={`/employees/${e.employee_id}`} className="font-bold text-slate-800 hover:text-brand-600 flex items-center gap-1.5 truncate">
                      {e.name}
                    </Link>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                      <StatusDot active={e.status === 'Active'} />
                      {e.status === 'Active' ? 'Active' : 'Inactive'} · {inr(e.daily_wage)}/day
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button onClick={() => openEdit(e)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><Pencil size={15} /></button>
                    <button onClick={() => remove(e)} className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-400"><Trash2 size={15} /></button>
                  </div>
                </div>
                <div className="mt-3 space-y-1 text-xs text-slate-500">
                  {e.phone && <div className="flex items-center gap-1.5"><Phone size={13} /> {e.phone}</div>}
                  {e.address && <div className="flex items-center gap-1.5"><MapPin size={13} /> {e.address}</div>}
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-slate-400 font-semibold uppercase">Advance Due</div>
                    <div className={`font-bold ${ap > 0 ? 'text-rose-600' : 'text-slate-400'}`}>{inr(ap)}</div>
                  </div>
                  <Link to={`/employees/${e.employee_id}`} className="text-brand-600 flex items-center text-sm font-semibold">
                    Details <ChevronRight size={16} />
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Employee' : 'Add Employee'}>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Avatar name={form.name || '?'} src={photo} size={56} />
            <label className="btn-ghost cursor-pointer text-sm">
              Upload Photo
              <input type="file" accept="image/*" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0] || null)} />
            </label>
          </div>
          <Field label="Full Name *">
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Ramesh" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Daily Wage (₹) *">
              <input type="number" className="input" value={form.daily_wage} onChange={(e) => setForm({ ...form, daily_wage: e.target.value })} placeholder="800" />
            </Field>
            <Field label="Phone / UPI number" hint="Their UPI-linked mobile number — used to pay them in any UPI app.">
              <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="9xxxxxxxxx" />
            </Field>
          </div>
          <Field label="Address">
            <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Town / City" />
          </Field>
          <Field label="UPI ID (GPay / PhonePe)" hint="Used to send advances & salary directly.">
            <input className="input" value={form.upi_id} onChange={(e) => setForm({ ...form, upi_id: e.target.value })} placeholder="name@okaxis" />
          </Field>
          <Field label="Login PIN (4 digits)" hint="Worker logs in with their phone number + this PIN. Leave blank to use last 4 digits of phone.">
            <input inputMode="numeric" maxLength={4} className="input tracking-widest" value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '') })} placeholder="e.g. 4321" />
          </Field>
          <Field label="Status">
            <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="Active">Active</option>
              <option value="Not_Active">Inactive</option>
            </select>
          </Field>
          {form.daily_wage && <p className="text-xs text-slate-400">Hourly rate: {inr(Number(form.daily_wage) / 8)}/hr (8h day)</p>}
          <div className="flex gap-2 pt-2">
            <button onClick={() => setModal(false)} className="btn-ghost flex-1">Cancel</button>
            <button onClick={save} className="btn-primary flex-1">{editing ? 'Save Changes' : 'Add Employee'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
