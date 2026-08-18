import React from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Smartphone, Copy, Check, Info, Phone, IndianRupee } from 'lucide-react';
import { buildUpiLink, buildGpayLink, buildPaytmLink, buildPhonePeLink, isValidVpa } from '../lib/upi';
import { inr } from '../lib/format';

// Shown after an advance/salary is recorded. Some banks block app-initiated UPI
// "intent" payments entirely (even ₹1 fails), so the reliable path is to pay the
// person directly in the GPay app — the record here is already saved regardless.
export const UpiPay: React.FC<{ vpa: string; name: string; amount: number; note?: string; phone?: string | null }> = ({
  vpa, name, amount, note, phone,
}) => {
  const [copied, setCopied] = React.useState<'' | 'vpa' | 'phone' | 'amount'>('');
  const valid = isValidVpa(vpa);
  const p = { vpa, name, amount, note };
  const upi = buildUpiLink(p);
  const gpay = buildGpayLink(p);
  const paytm = buildPaytmLink(p);
  const phonepe = buildPhonePeLink(p);
  const isSalary = note?.toLowerCase().includes('salary');

  const copy = (what: 'vpa' | 'phone' | 'amount', value: string) => {
    navigator.clipboard?.writeText(value); setCopied(what); setTimeout(() => setCopied(''), 1500);
  };

  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <div className="text-center text-sm font-semibold text-slate-600 mb-2">Send {inr(amount)} to {name}</div>

      {/* Primary path: pay in the GPay app to their number (works when in-app links are bank-blocked) */}
      <div className="rounded-xl bg-white p-3 shadow-sm space-y-2">
        <div className="text-[11px] font-semibold text-slate-400 uppercase text-center">Pay in your GPay / PhonePe app</div>
        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => copy('amount', String(amount))} className="rounded-xl bg-slate-100 hover:bg-slate-200 py-2 text-center">
            <div className="text-[10px] text-slate-400 font-semibold flex items-center justify-center gap-0.5"><IndianRupee size={10} /> AMOUNT {copied === 'amount' && <Check size={10} className="text-emerald-500" />}</div>
            <div className="font-bold text-slate-700 text-sm">{amount}</div>
          </button>
          {phone && (
            <button onClick={() => copy('phone', phone)} className="rounded-xl bg-slate-100 hover:bg-slate-200 py-2 text-center col-span-2">
              <div className="text-[10px] text-slate-400 font-semibold flex items-center justify-center gap-0.5"><Phone size={10} /> NUMBER {copied === 'phone' && <Check size={10} className="text-emerald-500" />}</div>
              <div className="font-bold text-slate-700 text-sm truncate">{phone}</div>
            </button>
          )}
        </div>
        {valid && (
          <button onClick={() => copy('vpa', vpa)} className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-500 pt-0.5">
            {copied === 'vpa' ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />} {vpa}
          </button>
        )}
      </div>

      {/* Try the in-app deep link (works only if the bank allows app-initiated UPI) */}
      {valid && (
        <div className="mt-3">
          <div className="text-[11px] text-slate-400 text-center mb-1.5">— or try opening an app directly (see which your bank allows) —</div>
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => { window.location.href = paytm; }} className="btn-primary text-xs px-2"><Smartphone size={14} /> Paytm</button>
            <button onClick={() => { window.location.href = phonepe; }} className="btn-primary text-xs px-2 bg-indigo-600 hover:bg-indigo-700"><Smartphone size={14} /> PhonePe</button>
            <button onClick={() => { window.location.href = gpay; }} className="btn-success text-xs px-2"><Smartphone size={14} /> GPay</button>
          </div>
          <button onClick={() => { window.location.href = upi; }} className="btn-ghost w-full text-xs mt-2"><Smartphone size={14} /> Any UPI app (chooser)</button>
          <div className="bg-white p-2.5 rounded-xl inline-block shadow-sm mx-auto mt-2 w-fit block">
            <QRCodeCanvas value={upi} size={116} level="M" />
          </div>
        </div>
      )}

      {/* Why the app button may fail */}
      <div className="mt-3 rounded-xl bg-amber-50 text-amber-800 p-3 text-[12px] leading-relaxed flex gap-2">
        <Info size={15} className="shrink-0 mt-0.5" />
        <div>
          <b>Getting "exceeded bank limit" even for ₹1?</b> That's your bank blocking payments started from another app — it's not this app. It usually still works if you open <b>GPay yourself</b> and pay {phone ? <>this number <b>{phone}</b></> : <>this person</>} as your normal contact.
          <div className="mt-1">This {isSalary ? 'salary' : 'advance'} is <b>already recorded</b> here — after you pay in GPay, tap <b>Done</b>, then mark it <b>Sent via GPay ✓</b> in the Ledger.</div>
        </div>
      </div>
    </div>
  );
};
