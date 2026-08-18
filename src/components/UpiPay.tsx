import React from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Smartphone, Copy, Check, Phone, IndianRupee, ShieldAlert } from 'lucide-react';
import { buildUpiLink, buildGpayLink, isValidVpa } from '../lib/upi';
import { inr } from '../lib/format';

// UPI apps flag payments auto-launched from another app as a "security risk", so
// the reliable path is: pay the worker's NUMBER manually in any UPI app (a normal
// contact payment), then mark it paid. The record here is already saved.
export const UpiPay: React.FC<{ vpa: string; name: string; amount: number; note?: string; phone?: string | null; autoOpen?: boolean }> = ({
  vpa, name, amount, note, phone, autoOpen,
}) => {
  const [copied, setCopied] = React.useState<'' | 'vpa' | 'phone' | 'amount'>('');
  const valid = isValidVpa(vpa);
  const upi = buildUpiLink({ vpa, name, amount, note });
  const gpay = buildGpayLink({ vpa, name, amount, note });
  const isSalary = note?.toLowerCase().includes('salary');

  // Auto-launch the UPI app once when the payment screen appears (admin asked for
  // it to open on its own). Whether the bank then completes it is still up to UPI.
  React.useEffect(() => {
    if (autoOpen && valid) {
      const t = setTimeout(() => { try { window.location.href = upi; } catch { /* ignore */ } }, 500);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copy = (what: 'vpa' | 'phone' | 'amount', value: string) => {
    navigator.clipboard?.writeText(value); setCopied(what); setTimeout(() => setCopied(''), 1500);
  };

  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <div className="text-center text-sm font-semibold text-slate-600 mb-2">Send {inr(amount)} to {name}</div>

      {/* PRIMARY: pay this number in any UPI app */}
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <div className="text-[11px] font-semibold text-brand-500 uppercase text-center mb-2">Open any UPI app & pay this number</div>

        {phone ? (
          <button onClick={() => copy('phone', phone)} className="w-full rounded-xl bg-brand-50 hover:bg-brand-100 py-3 text-center transition">
            <div className="text-[10px] text-slate-400 font-semibold flex items-center justify-center gap-1"><Phone size={11} /> UPI NUMBER {copied === 'phone' && <span className="text-emerald-500">· copied ✓</span>}</div>
            <div className="font-extrabold text-slate-800 text-xl tracking-wide">{phone}</div>
            <div className="text-[11px] text-brand-600 font-semibold mt-0.5 flex items-center justify-center gap-1"><Copy size={11} /> tap to copy</div>
          </button>
        ) : (
          <div className="rounded-xl bg-amber-50 text-amber-700 p-3 text-sm text-center">No phone number on file for {name}. Add it on their profile.</div>
        )}

        <div className="grid grid-cols-2 gap-2 mt-2">
          <button onClick={() => copy('amount', String(amount))} className="rounded-xl bg-slate-100 hover:bg-slate-200 py-2 text-center transition">
            <div className="text-[10px] text-slate-400 font-semibold flex items-center justify-center gap-0.5"><IndianRupee size={10} /> AMOUNT {copied === 'amount' && <Check size={10} className="text-emerald-500" />}</div>
            <div className="font-bold text-slate-700">{inr(amount)}</div>
          </button>
          {valid ? (
            <button onClick={() => copy('vpa', vpa)} className="rounded-xl bg-slate-100 hover:bg-slate-200 py-2 text-center transition">
              <div className="text-[10px] text-slate-400 font-semibold flex items-center justify-center gap-0.5">UPI ID {copied === 'vpa' && <Check size={10} className="text-emerald-500" />}</div>
              <div className="font-bold text-slate-700 text-xs truncate px-1">{vpa}</div>
            </button>
          ) : <div />}
        </div>

        <ol className="mt-3 text-[12px] text-slate-500 space-y-0.5 list-decimal list-inside">
          <li>Open <b>GPay / PhonePe / Paytm</b> yourself</li>
          <li>Pay to the number above (or your saved contact)</li>
          <li>Come back and tap <b>Done</b> → mark it <b>Sent ✓</b></li>
        </ol>
      </div>

      {/* Optional: try the in-app deep link + QR (often blocked as "security risk") */}
      {valid && (
        <details className="mt-3">
          <summary className="text-[12px] text-slate-400 cursor-pointer text-center">Advanced: try launching an app / scan QR</summary>
          <div className="mt-2 flex flex-col items-center gap-2">
            <div className="grid grid-cols-2 gap-2 w-full">
              <button onClick={() => { window.location.href = gpay; }} className="btn-success text-xs"><Smartphone size={14} /> GPay</button>
              <button onClick={() => { window.location.href = upi; }} className="btn-primary text-xs"><Smartphone size={14} /> UPI app</button>
            </div>
            <div className="bg-white p-2.5 rounded-xl shadow-sm"><QRCodeCanvas value={upi} size={116} level="M" /></div>
          </div>
        </details>
      )}

      {/* Why auto-launch fails */}
      <div className="mt-3 rounded-xl bg-amber-50 text-amber-800 p-3 text-[12px] leading-relaxed flex gap-2">
        <ShieldAlert size={15} className="shrink-0 mt-0.5" />
        <div>
          <b>"Security risk / limit exceeded"?</b> UPI apps block payments auto-started by another app. That's why the buttons fail — it's not this app. <b>Pay the number above yourself</b> in any UPI app (a normal contact payment works fine).
          <div className="mt-1">This {isSalary ? 'salary' : 'advance'} is <b>already saved</b> here — after paying, tap <b>Done</b>, then mark it <b>Sent ✓</b> in the Ledger.</div>
        </div>
      </div>
    </div>
  );
};
