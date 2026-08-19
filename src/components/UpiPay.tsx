import React from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Check, Phone, IndianRupee, ShieldAlert, MessageCircle, ClipboardCheck } from 'lucide-react';
import { buildUpiLink, isValidVpa, copyNumberAndOpenGpay } from '../lib/upi';
import { inr } from '../lib/format';

// The QR encodes a UPI payment. Scanning it in WhatsApp Pay / any UPI app is a
// normal user-initiated payment, so it is NOT hit by the "started by another
// app" security block. The "WhatsApp Pay" button shares the QR image to WhatsApp.
export const UpiPay: React.FC<{ vpa: string; name: string; amount: number; note?: string; phone?: string | null }> = ({
  vpa, name, amount, note, phone,
}) => {
  const [copied, setCopied] = React.useState<'' | 'vpa' | 'phone' | 'amount'>('');
  const [msg, setMsg] = React.useState('');
  const qrWrap = React.useRef<HTMLDivElement>(null);
  const valid = isValidVpa(vpa);
  const isSalary = note?.toLowerCase().includes('salary');
  const upi = buildUpiLink({ vpa, name, amount, note });

  const copy = (what: 'vpa' | 'phone' | 'amount', value: string) => {
    navigator.clipboard?.writeText(value); setCopied(what); setTimeout(() => setCopied(''), 1500);
  };

  // Turn the on-screen QR canvas into a PNG and share it (WhatsApp etc.).
  const shareQr = async () => {
    const canvas = qrWrap.current?.querySelector('canvas') as HTMLCanvasElement | null;
    if (!canvas) return;
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], `Pay_${name.replace(/\s+/g, '_')}_${amount}.png`, { type: 'image/png' });
      const text = `Pay ${inr(amount)} to ${name} — scan this QR in WhatsApp Pay or any UPI app.`;
      const nav: any = navigator;
      if (nav.canShare && nav.canShare({ files: [file] })) {
        try { await nav.share({ files: [file], text, title: 'UPI Payment QR' }); return; }
        catch { /* cancelled */ return; }
      }
      // Desktop / no share support → download the QR so it can be sent manually.
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
      setMsg('QR image downloaded — send it on WhatsApp to pay.');
      setTimeout(() => setMsg(''), 4000);
    });
  };

  if (!valid) {
    return (
      <div className="rounded-xl bg-amber-50 text-amber-700 p-3 text-sm font-medium">
        No valid UPI ID on file for {name}. Add their UPI ID on the profile to generate a payment QR.
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <div className="text-center text-sm font-semibold text-slate-600 mb-2">Pay {inr(amount)} to {name}</div>

      {msg && <div className="text-[12px] text-emerald-600 font-semibold text-center mb-2 rounded-lg bg-emerald-50 py-2 px-2">{msg}</div>}

      {/* PRIMARY: copy number & open GPay → paste & pay (no payment intent = no block) */}
      {phone && (
        <div className="mb-3">
          <button onClick={() => { copyNumberAndOpenGpay(phone); setMsg(`✓ ${phone} copied — paste it in GPay & pay ${inr(amount)}`); setTimeout(() => setMsg(''), 6000); }}
            className="btn-primary w-full">
            <ClipboardCheck size={18} /> Copy number & open GPay
          </button>
          <div className="text-[11px] text-slate-400 text-center mt-1">Copies {phone}, opens GPay → tap New payment → paste the number → pay.</div>
        </div>
      )}

      {/* Payment QR — scan in WhatsApp Pay / any UPI app */}
      <div ref={qrWrap} className="bg-white p-3 rounded-xl shadow-sm w-fit mx-auto">
        <QRCodeCanvas value={upi} size={168} level="M" includeMargin />
      </div>

      {/* WhatsApp Pay — send the QR */}
      <button onClick={shareQr} className="btn w-full text-white text-sm mt-3" style={{ background: '#25D366' }}>
        <MessageCircle size={17} /> WhatsApp Pay — send QR
      </button>

      {/* Manual details */}
      <div className="grid grid-cols-3 gap-2 mt-3">
        <button onClick={() => copy('amount', String(amount))} className="rounded-xl bg-white shadow-sm py-2 text-center">
          <div className="text-[10px] text-slate-400 font-semibold flex items-center justify-center gap-0.5"><IndianRupee size={10} /> AMOUNT {copied === 'amount' && <Check size={10} className="text-emerald-500" />}</div>
          <div className="font-bold text-slate-700 text-sm">{amount}</div>
        </button>
        {phone ? (
          <button onClick={() => copy('phone', phone)} className="rounded-xl bg-white shadow-sm py-2 text-center col-span-2">
            <div className="text-[10px] text-slate-400 font-semibold flex items-center justify-center gap-0.5"><Phone size={10} /> NUMBER {copied === 'phone' && <Check size={10} className="text-emerald-500" />}</div>
            <div className="font-bold text-slate-700 text-sm truncate">{phone}</div>
          </button>
        ) : (
          <button onClick={() => copy('vpa', vpa)} className="rounded-xl bg-white shadow-sm py-2 text-center col-span-2">
            <div className="text-[10px] text-slate-400 font-semibold flex items-center justify-center gap-0.5">UPI ID {copied === 'vpa' && <Check size={10} className="text-emerald-500" />}</div>
            <div className="font-bold text-slate-700 text-xs truncate px-1">{vpa}</div>
          </button>
        )}
      </div>

      <div className="mt-3 rounded-xl bg-emerald-50 text-emerald-800 p-3 text-[12px] leading-relaxed flex gap-2">
        <ShieldAlert size={15} className="shrink-0 mt-0.5" />
        <div>
          Tap <b>WhatsApp Pay — send QR</b> to share this QR to WhatsApp, then <b>scan it in WhatsApp Pay</b> (or any UPI app) to pay. Scanning a QR is a normal payment, so it isn't blocked.
          <div className="mt-1">This {isSalary ? 'salary' : 'advance'} is <b>already recorded</b> — after paying, tap <b>Done</b> and mark it <b>Sent ✓</b> in the Ledger.</div>
        </div>
      </div>
    </div>
  );
};
