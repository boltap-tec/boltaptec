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

// GPay-specific intent (falls back to generic upi:// on most devices)
export const buildGpayLink = (params: UpiParams): string =>
  buildUpiLink(params).replace('upi://pay', 'tez://upi/pay');

export const isValidVpa = (vpa: string): boolean =>
  /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(vpa.trim());
