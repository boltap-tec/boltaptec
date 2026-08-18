import React from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Smartphone, Copy, Check, Info, Phone } from 'lucide-react';
import { buildUpiLink, buildGpayLink, isValidVpa } from '../lib/upi';
import { inr } from '../lib/format';

// Shown after an advance/salary is recorded — lets the admin actually send the
// money via GPay/UPI. The record is saved regardless of how the money moves, so
// if the bank blocks the deep-link amount, they can pay in GPay and tap Done.
export const UpiPay: React.FC<{ vpa: string; name: string; amount: number; note?: string; phone?: string | null }> = ({
  vpa, name, amount, note, phone,
}) => {
  const [copied, setCopied] = React.useState<'' | 'vpa' | 'phone'>('');
  const valid = isValidVpa(vpa);
  const upi = buildUpiLink({ vpa, name, amount, note });
  const gpay = buildGpayLink({ vpa, name, amount, note });
  const upiNoAmount = buildUpiLink({ vpa, name, note });   // let user type amount in GPay (saved-contact limit)
  const large = amount > 5000;

  const copy = (what: 'vpa' | 'phone', value: string) => {
    navigator.clipboard?.writeText(value); setCopied(what); setTimeout(() => setCopied(''), 1500);
  };

  if (!valid) {
    return (
      <div className="rounded-xl bg-amber-50 text-amber-700 p-3 text-sm font-medium">
        No valid UPI ID on file for {name}. Add one on their profile to pay by GPay/UPI.
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <div className="text-xs font-semibold text-slate-500 mb-2 text-center">Pay {inr(amount)} to {name}</div>
      <div className="bg-white p-3 rounded-xl inline-block shadow-sm mx-auto block w-fit">
        <QRCodeCanvas value={upi} size={140} level="M" />
      </div>

      {/* Copy chips */}
      <div className="flex flex-col items-center gap-1 mt-2">
        <button onClick={() => copy('vpa', vpa)} className="flex items-center gap-1.5 text-sm font-semibold text-slate-600">
          {copied === 'vpa' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />} {vpa}
        </button>
        {phone && (
          <button onClick={() => copy('phone', phone)} className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            {copied === 'phone' ? <Check size={13} className="text-emerald-500" /> : <Phone size={13} />} {phone}
          </button>
        )}
      </div>

      {/* Primary: pay with amount */}
      <div className="grid grid-cols-2 gap-2 mt-3">
        <button onClick={() => { window.location.href = gpay; }} className="btn-success text-sm"><Smartphone size={16} /> GPay</button>
        <button onClick={() => { window.location.href = upi; }} className="btn-primary text-sm"><Smartphone size={16} /> UPI App</button>
      </div>

      {/* Workaround: pay without preset amount (uses saved-contact limit) */}
      <button onClick={() => { window.location.href = upiNoAmount; }} className="btn-ghost w-full text-sm mt-2">
        Open GPay & enter amount myself
      </button>

      {/* Bank-limit help */}
      <div className="mt-3 rounded-xl bg-amber-50 text-amber-800 p-3 text-[12px] leading-relaxed flex gap-2">
        <Info size={15} className="shrink-0 mt-0.5" />
        <div>
          <b>Bank limit / "exceeded limit" error?</b> UPI caps first-time payments to a new UPI ID (about ₹2,000–5,000 in the first 24h).
          {large && <> This amount is above that, so it may be blocked.</>}
          <div className="mt-1">Just open your <b>GPay app</b> and pay {phone ? <>this number <b>{phone}</b></> : <>this UPI ID <b>{vpa}</b></>} (your saved contact has a higher limit){large ? ', or split it into smaller payments' : ''}. This {note?.toLowerCase().includes('salary') ? 'salary' : 'advance'} is <b>already recorded</b> here — tap <b>Done</b> after you pay.</div>
        </div>
      </div>
      <p className="text-[11px] text-slate-400 mt-2 text-center">On a phone the buttons open GPay/PhonePe/Paytm. On desktop, scan the QR.</p>
    </div>
  );
};
