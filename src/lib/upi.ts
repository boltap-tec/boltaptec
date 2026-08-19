// UPI deep-link helpers. On a phone (and inside the packaged APK) these links
// open GPay / PhonePe / Paytm etc. On desktop we render a QR to scan.

export interface UpiParams {
  vpa: string;        // payee UPI id, e.g. name@okaxis
  name: string;       // payee name
  amount?: number;
  note?: string;
}

export const buildUpiLink = ({ vpa, name, amount, note }: UpiParams): string => {
  const p = new URLSearchParams();
  p.set('pa', vpa);
  p.set('pn', name);
  if (amount && amount > 0) p.set('am', amount.toFixed(2));
  p.set('cu', 'INR');
  if (note) p.set('tn', note);
  return `upi://pay?${p.toString()}`;
};

// App-specific intents (fall back to generic upi:// on most devices).
export const buildGpayLink = (params: UpiParams): string =>
  buildUpiLink(params).replace('upi://pay', 'tez://upi/pay');

export const buildPaytmLink = (params: UpiParams): string =>
  buildUpiLink(params).replace('upi://pay', 'paytmmp://pay');

export const buildPhonePeLink = (params: UpiParams): string =>
  buildUpiLink(params).replace('upi://pay', 'phonepe://pay');

export const isValidVpa = (vpa: string): boolean =>
  /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(vpa.trim());

// Opens the GPay app WITHOUT a payment intent (no pa/am) — so it isn't flagged
// as an "app-initiated payment". The admin pastes the copied number and pays.
export const GPAY_APP = 'tez://upi/pay';

// Copy text to clipboard (best-effort; needs a user gesture / secure context).
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy');
      document.body.removeChild(ta); return true;
    } catch { return false; }
  }
};

// Copy the worker's number, then open GPay so the admin can paste & pay.
export const copyNumberAndOpenGpay = async (phone: string): Promise<void> => {
  await copyToClipboard(phone.replace(/\s/g, ''));
  setTimeout(() => { try { window.location.href = GPAY_APP; } catch { /* ignore */ } }, 250);
};

// Public https base that hosts the /pay.html redirect. On the web it's the
// current origin; inside the APK (localhost/capacitor origin) it falls back to
// the deployed Vercel site. Change this if your Vercel domain is different.
export const PAY_BASE = (() => {
  if (typeof window !== 'undefined' && /^https?:\/\//.test(window.location.origin) && !/localhost/.test(window.location.origin)) {
    return window.location.origin;
  }
  return 'https://boltaptec.vercel.app';
})();

// A tappable https link (works in WhatsApp) that redirects to the UPI app.
// Because the UPI app is launched by the browser/WhatsApp — not by our app —
// this can avoid the "payment started by another app" security block.
export const buildPayPageLink = ({ vpa, name, amount, note }: UpiParams): string => {
  const p = new URLSearchParams();
  p.set('pa', vpa);
  if (name) p.set('pn', name);
  if (amount && amount > 0) p.set('am', amount.toFixed(2));
  if (note) p.set('tn', note);
  return `${PAY_BASE}/pay.html?${p.toString()}`;
};

// WhatsApp share link. `number` optional (E.164 without +, e.g. 9198…); omit to
// let the sender pick a chat.
export const buildWhatsAppLink = (text: string, number?: string | null): string => {
  const base = number ? `https://wa.me/${number.replace(/\D/g, '')}` : 'https://wa.me/';
  return `${base}?text=${encodeURIComponent(text)}`;
};
