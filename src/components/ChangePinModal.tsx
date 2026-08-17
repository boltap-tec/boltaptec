import React from 'react';
import { useAuth } from '../store/useAuth';
import { useData } from '../store/useData';
import { Modal, Field } from './ui';

// Change your own login PIN — admin changes the Admin PIN, a worker changes their
// own PIN. Shared by the Preferences menu and the worker home screen.
export const ChangePinModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const session = useAuth((s) => s.session);
  const settings = useData((s) => s.settings);
  const employees = useData((s) => s.employees);
  const updateEmployee = useData((s) => s.updateEmployee);
  const isAdmin = session?.role === 'admin';
  const emp = employees.find((e) => e.employee_id === session?.employee_id);
  const [cur, setCur] = React.useState('');
  const [next, setNext] = React.useState('');
  const [conf, setConf] = React.useState('');
  const [err, setErr] = React.useState('');
  const [ok, setOk] = React.useState(false);
  const reset = () => { setCur(''); setNext(''); setConf(''); setErr(''); setOk(false); };
  const save = () => {
    const currentPin = isAdmin ? (settings.admin_pin || '1234') : (emp?.pin || '');
    if (cur !== currentPin) { setErr('Current PIN is wrong.'); return; }
    if (!/^\d{4}$/.test(next)) { setErr('New PIN must be exactly 4 digits.'); return; }
    if (next !== conf) { setErr("New PINs don't match."); return; }
    if (isAdmin) useData.setState({ settings: { ...useData.getState().settings, admin_pin: next } });
    else if (emp) updateEmployee(emp.employee_id, { pin: next });
    setErr(''); setOk(true);
    setTimeout(() => { reset(); onClose(); }, 1100);
  };
  const pinInput = (val: string, set: (v: string) => void) => (
    <input type="password" inputMode="numeric" maxLength={4} className="input tracking-[0.5em] text-center text-lg"
      value={val} onChange={(e) => { set(e.target.value.replace(/\D/g, '')); setErr(''); }} placeholder="••••" autoComplete="off" />
  );
  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="Change PIN">
      <div className="space-y-3">
        <div className="text-sm text-slate-500">{isAdmin ? 'Change the Admin login PIN.' : `Change your login PIN, ${emp?.name || ''}.`}</div>
        <Field label="Current PIN">{pinInput(cur, setCur)}</Field>
        <Field label="New PIN (4 digits)">{pinInput(next, setNext)}</Field>
        <Field label="Confirm New PIN">{pinInput(conf, setConf)}</Field>
        {err && <p className="text-rose-500 text-sm font-semibold">{err}</p>}
        <div className="flex gap-2 pt-1">
          <button onClick={() => { reset(); onClose(); }} className="btn-ghost flex-1">Cancel</button>
          <button onClick={save} disabled={!cur || !next || !conf} className="btn-primary flex-1">{ok ? '✓ PIN changed' : 'Save PIN'}</button>
        </div>
      </div>
    </Modal>
  );
};
