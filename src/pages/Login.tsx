import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Shield, User, Delete, ArrowLeft } from 'lucide-react';
import { useAuth } from '../store/useAuth';
import { useData } from '../store/useData';

const Keypad: React.FC<{ onKey: (k: string) => void; onBack: () => void }> = ({ onKey, onBack }) => (
  <div className="grid grid-cols-3 gap-2.5 mt-4">
    {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((n) => (
      <button key={n} onClick={() => onKey(n)}
        className="h-14 rounded-2xl bg-white text-2xl font-bold text-slate-700 shadow-sm active:scale-95 active:bg-slate-100 transition">
        {n}
      </button>
    ))}
    <div />
    <button onClick={() => onKey('0')}
      className="h-14 rounded-2xl bg-white text-2xl font-bold text-slate-700 shadow-sm active:scale-95 active:bg-slate-100 transition">0</button>
    <button onClick={onBack}
      className="h-14 rounded-2xl bg-slate-100 grid place-items-center text-slate-500 active:scale-95 transition">
      <Delete size={22} />
    </button>
  </div>
);

const Dots: React.FC<{ len: number; total?: number }> = ({ len, total = 4 }) => (
  <div className="flex justify-center gap-3">
    {Array.from({ length: total }).map((_, i) => (
      <div key={i} className={`h-3.5 w-3.5 rounded-full transition ${i < len ? 'bg-brand-600 scale-110' : 'bg-slate-200'}`} />
    ))}
  </div>
);

export const Login: React.FC = () => {
  const { loginAdmin, loginEmployee } = useAuth();
  const employees = useData((s) => s.employees);
  const settings = useData((s) => s.settings);
  const navigate = useNavigate();

  const [mode, setMode] = useState<'choose' | 'admin' | 'worker'>('choose');
  const [step, setStep] = useState<'phone' | 'pin'>('phone');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [worker, setWorker] = useState<ReturnType<typeof matchPhone>>(null);
  const [error, setError] = useState('');

  function matchPhone(p: string) {
    return employees.find((e) => (e.phone || '').replace(/\D/g, '').endsWith(p.replace(/\D/g, ''))) || null;
  }

  const reset = () => { setStep('phone'); setPhone(''); setPin(''); setWorker(null); setError(''); };

  const onPhoneKey = (k: string) => {
    setError('');
    if (phone.length >= 10) return;
    setPhone(phone + k);
  };

  const continuePhone = () => {
    const w = matchPhone(phone);
    if (!w) { setError('No worker found with that number. Ask your admin.'); return; }
    setWorker(w); setStep('pin'); setPin('');
  };

  const onPinKey = (k: string) => {
    if (pin.length >= 4) return;
    const next = pin + k;
    setPin(next);
    if (next.length === 4) setTimeout(() => submitPin(next), 120);
  };

  const submitPin = (value: string) => {
    if (mode === 'admin') {
      if (value === (settings.admin_pin || '1234')) { loginAdmin(settings.business_name ? 'Admin' : 'Admin'); navigate('/'); }
      else { setError('Wrong PIN'); setPin(''); }
      return;
    }
    if (worker && value === (worker.pin || '')) {
      loginEmployee(worker.employee_id, worker.name); navigate('/me');
    } else { setError('Wrong PIN'); setPin(''); }
  };

  return (
    <div className="min-h-full grid place-items-center p-4 bg-gradient-to-br from-brand-600 via-brand-700 to-indigo-900">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6 text-white">
          <div className="h-16 w-16 rounded-2xl bg-white/15 backdrop-blur grid place-items-center mx-auto mb-3 ring-1 ring-white/20">
            <Zap size={34} fill="white" />
          </div>
          <h1 className="text-2xl font-extrabold">BoltAp</h1>
          <p className="text-white/70 text-sm">Salary & Advance, made simple</p>
        </div>

        <div className="card p-5">
          {mode === 'choose' && (
            <div className="space-y-3">
              <p className="text-center text-sm font-semibold text-slate-400 mb-1">Who's logging in?</p>
              <button onClick={() => { setMode('worker'); reset(); }}
                className="w-full flex items-center gap-3 p-4 rounded-2xl border-2 border-slate-100 hover:border-brand-300 hover:bg-brand-50/40 transition text-left">
                <div className="h-11 w-11 rounded-xl bg-emerald-100 text-emerald-600 grid place-items-center"><User size={22} /></div>
                <div>
                  <div className="font-bold text-slate-800">I'm a Worker</div>
                  <div className="text-xs text-slate-400">See my salary & request advance</div>
                </div>
              </button>
              <button onClick={() => { setMode('admin'); reset(); }}
                className="w-full flex items-center gap-3 p-4 rounded-2xl border-2 border-slate-100 hover:border-brand-300 hover:bg-brand-50/40 transition text-left">
                <div className="h-11 w-11 rounded-xl bg-brand-100 text-brand-600 grid place-items-center"><Shield size={22} /></div>
                <div>
                  <div className="font-bold text-slate-800">I'm the Admin</div>
                  <div className="text-xs text-slate-400">Manage everyone & approve advances</div>
                </div>
              </button>
            </div>
          )}

          {mode === 'admin' && (
            <div>
              <button onClick={() => setMode('choose')} className="flex items-center gap-1 text-sm font-semibold text-slate-400 mb-4"><ArrowLeft size={15} /> Back</button>
              <div className="text-center mb-4">
                <div className="h-12 w-12 rounded-xl bg-brand-100 text-brand-600 grid place-items-center mx-auto mb-2"><Shield size={24} /></div>
                <div className="font-bold text-slate-800">Enter Admin PIN</div>
                <div className="text-xs text-slate-400">Default is 1234 — change it in Settings</div>
              </div>
              <Dots len={pin.length} />
              {error && <p className="text-center text-rose-500 text-sm font-semibold mt-2">{error}</p>}
              <Keypad onKey={onPinKey} onBack={() => { setPin(pin.slice(0, -1)); setError(''); }} />
            </div>
          )}

          {mode === 'worker' && step === 'phone' && (
            <div>
              <button onClick={() => setMode('choose')} className="flex items-center gap-1 text-sm font-semibold text-slate-400 mb-4"><ArrowLeft size={15} /> Back</button>
              <div className="text-center mb-3">
                <div className="h-12 w-12 rounded-xl bg-emerald-100 text-emerald-600 grid place-items-center mx-auto mb-2"><User size={24} /></div>
                <div className="font-bold text-slate-800">Your Phone Number</div>
                <div className="text-xs text-slate-400">The number your admin registered</div>
              </div>
              <div className="text-center text-2xl font-extrabold tracking-widest text-slate-700 h-9">{phone || <span className="text-slate-300">••••••••••</span>}</div>
              {error && <p className="text-center text-rose-500 text-sm font-semibold mt-1">{error}</p>}
              <Keypad onKey={onPhoneKey} onBack={() => { setPhone(phone.slice(0, -1)); setError(''); }} />
              <button onClick={continuePhone} disabled={phone.length < 4} className="btn-success w-full mt-3">Continue</button>
            </div>
          )}

          {mode === 'worker' && step === 'pin' && worker && (
            <div>
              <button onClick={() => { setStep('phone'); setPin(''); setError(''); }} className="flex items-center gap-1 text-sm font-semibold text-slate-400 mb-4"><ArrowLeft size={15} /> Back</button>
              <div className="text-center mb-4">
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 grid place-items-center mx-auto mb-2 text-white font-bold text-lg">{worker.name[0]}</div>
                <div className="font-bold text-slate-800">Hi {worker.name} 👋</div>
                <div className="text-xs text-slate-400">Enter your 4-digit PIN</div>
              </div>
              <Dots len={pin.length} />
              {error && <p className="text-center text-rose-500 text-sm font-semibold mt-2">{error}</p>}
              <Keypad onKey={onPinKey} onBack={() => { setPin(pin.slice(0, -1)); setError(''); }} />
            </div>
          )}
        </div>
        <p className="text-center text-white/50 text-xs mt-4">Local demo · your data stays on this device</p>
      </div>
    </div>
  );
};
