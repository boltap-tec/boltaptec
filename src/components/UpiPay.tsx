import React from 'react';
import { ClipboardCheck, Smartphone } from 'lucide-react';
import { copyNumberAndOpenGpay } from '../lib/upi';
import { inr } from '../lib/format';

// After a UPI advance/salary is recorded: copy the worker's number and open
// GPay. No payment intent is passed to GPay, so it isn't hit by the "started by
// another app" security block — the admin pastes the number and pays.
export const UpiPay: React.FC<{ vpa?: string; name: string; amount: number; note?: string; phone?: string | null }> = ({
  name, amount, phone,
}) => {
  const [msg, setMsg] = React.useState('');

  const go = () => {
    if (!phone) return;
    copyNumberAndOpenGpay(phone);
    setMsg(`✓ ${phone} copied — paste it in GPay and pay ${inr(amount)}`);
    setTimeout(() => setMsg(''), 8000);
  };

  if (!phone) {
    return (
      <div className="rounded-xl bg-amber-50 text-amber-700 p-3 text-sm font-medium">
        No phone number on file for {name}. Add their number on the profile to pay via GPay.
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-slate-50 p-4 text-center">
      <div className="text-sm font-semibold text-slate-600">Pay {inr(amount)} to {name}</div>
      <div className="text-2xl font-extrabold text-slate-800 tracking-wide mt-1">{phone}</div>

      <button onClick={go} className="btn-primary w-full mt-3">
        <ClipboardCheck size={18} /> Copy number & open GPay
      </button>

      {msg
        ? <div className="text-[12px] text-emerald-600 font-semibold mt-2">{msg}</div>
        : <div className="text-[11px] text-slate-400 mt-2 flex items-center justify-center gap-1"><Smartphone size={12} /> Opens GPay → New payment → paste the number → pay.</div>}
    </div>
  );
};
