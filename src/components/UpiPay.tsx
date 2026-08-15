import React from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Smartphone, Copy, Check } from 'lucide-react';
import { buildUpiLink, buildGpayLink, isValidVpa } from '../lib/upi';
import { inr } from '../lib/format';

// Shown after an advance/salary is recorded — lets the admin actually send the
// money via GPay/UPI. On the packaged Android app these links open the UPI app;
// on desktop the QR is scanned from a phone.
export const UpiPay: React.FC<{ vpa: string; name: string; amount: number; note?: string }> = ({
  vpa, name, amount, note,
}) => {
  const [copied, setCopied] = React.useState(false);
  const valid = isValidVpa(vpa);
  const upi = buildUpiLink({ vpa, name, amount, note });
  const gpay = buildGpayLink({ vpa, name, amount, note });

  if (!valid) {
    return (
      <div className="rounded-xl bg-amber-50 text-amber-700 p-3 text-sm font-medium">
        No valid UPI ID on file for {name}. Add one on their profile to pay by GPay/UPI.
      </div>
    );
  }

  const copy = () => { navigator.clipboard?.writeText(vpa); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  return (
    <div className="rounded-2xl bg-slate-50 p-4 text-center">
      <div className="text-xs font-semibold text-slate-500 mb-2">Pay {inr(amount)} to {name}</div>
      <div className="bg-white p-3 rounded-xl inline-block shadow-sm">
        <QRCodeCanvas value={upi} size={148} level="M" />
      </div>
      <button onClick={copy} className="mx-auto mt-2 flex items-center gap-1.5 text-sm font-semibold text-slate-600">
        {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />} {vpa}
      </button>
      <div className="grid grid-cols-2 gap-2 mt-3">
        <button onClick={() => { window.location.href = gpay; }} className="btn-success text-sm"><Smartphone size={16} /> GPay</button>
        <button onClick={() => { window.location.href = upi; }} className="btn-primary text-sm"><Smartphone size={16} /> UPI App</button>
      </div>
      <a href={upi} className="block text-[11px] text-brand-600 font-semibold mt-2">Open UPI app directly →</a>
      <p className="text-[11px] text-slate-400 mt-1">On a phone this opens GPay/PhonePe/Paytm. On desktop, scan the QR.</p>
    </div>
  );
};
