import { usePrefs } from '../store/usePrefs';
import type { PurchaseItem } from '../types';

// Structured result from an invoice-AI provider (Mindee).
export interface OcrStructured {
  vendor: string | null;
  date: string | null;
  items: PurchaseItem[];
  cgst: number;
  sgst: number;
  igst: number;
}

// Mindee Invoice OCR (free tier 250/month) → structured vendor, GST, line items.
// CORS-open, so it works in the web app and the APK.
export async function ocrMindee(file: File): Promise<OcrStructured> {
  const key = usePrefs.getState().ocrKey.trim();
  if (!key) throw new Error('Add your Mindee API key in Settings → Bill Scanning first.');
  const fd = new FormData();
  fd.append('document', file, file.name || 'bill');
  let res: Response;
  try {
    res = await fetch('https://api.mindee.net/v1/products/mindee/invoices/v4/predict', {
      method: 'POST', headers: { Authorization: `Token ${key}` }, body: fd,
    });
  } catch { throw new Error('Could not reach Mindee — check your internet connection.'); }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.api_request?.error?.message || `Mindee error (${res.status}). Check your API key.`);
  const pred = data?.document?.inference?.prediction;
  if (!pred) throw new Error('Mindee returned no data for that bill.');
  const val = (f: any) => (f && f.value != null ? f.value : null);

  const taxes: any[] = pred.taxes || [];
  let cgst = 0, sgst = 0, igst = 0;
  for (const t of taxes) {
    const code = String(t.code || '').toLowerCase();
    const v = Number(t.value) || 0;
    if (code.includes('cgst')) cgst += v;
    else if (code.includes('sgst') || code.includes('utgst')) sgst += v;
    else if (code.includes('igst')) igst += v;
  }
  // Uncoded taxes: two equal amounts → CGST+SGST; a single one → IGST.
  if (!cgst && !sgst && !igst && taxes.length) {
    const a = Number(taxes[0]?.value) || 0, b = Number(taxes[1]?.value) || 0;
    if (taxes.length >= 2 && Math.abs(a - b) < 0.5) { cgst = a; sgst = b; }
    else if (taxes.length === 1) igst = a;
  }

  const items: PurchaseItem[] = (pred.line_items || []).map((li: any) => {
    const qty = Number(li.quantity) || 0;
    const rate = Number(li.unit_price) || 0;
    const amount = Number(li.total_amount) || Math.round(qty * rate);
    return { description: String(li.description || '').trim().replace(/\s+/g, ' '), qty, rate, amount };
  }).filter((it: PurchaseItem) => it.description || it.amount);

  return { vendor: val(pred.supplier_name), date: val(pred.date), items, cgst, sgst, igst };
}

// Read a File as a base64 data URL.
export const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error('Could not read the file.'));
    r.onload = () => resolve(r.result as string);
    r.readAsDataURL(file);
  });

// OCR.space works out of the box (free), so a key is only required for Vision.
export const ocrReady = (): boolean => {
  const { ocrProvider, ocrKey } = usePrefs.getState();
  return ocrProvider === 'ocrspace' || !!ocrKey.trim();
};
// Back-compat alias.
export const hasOcrKey = ocrReady;

const base64Of = (dataUrl: string): string => (dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl);

// Route to the configured provider.
export async function ocrFile(dataUrl: string, mime: string): Promise<string> {
  return usePrefs.getState().ocrProvider === 'vision' ? ocrVision(dataUrl, mime) : ocrSpace(dataUrl, mime);
}

// OCR.space — free (25k/month), works in web and the APK, reads photos & PDFs.
// isTable=true keeps column alignment so rows map cleanly. Falls back to the
// shared demo key when the admin hasn't set their own.
async function ocrSpace(dataUrl: string, mime: string): Promise<string> {
  const ownKey = usePrefs.getState().ocrKey.trim();
  const key = ownKey || 'helloworld';
  const usingShared = !ownKey;
  const addKeyHint = ' Add your own free OCR.space key in Settings → Bill Scanning (the shared demo key is heavily rate-limited).';
  // apikey goes in the body (not a header) so this stays a simple CORS request.
  const form = new URLSearchParams();
  form.set('apikey', key);
  form.set('base64Image', dataUrl);
  form.set('isTable', 'true');
  form.set('scale', 'true');
  form.set('language', 'eng');
  // Tell OCR.space it's a PDF from the mime OR the data-URL prefix (phones often
  // report an empty MIME for picked PDFs, which otherwise fails to process).
  if (mime === 'application/pdf' || /^data:application\/pdf/i.test(dataUrl)) form.set('filetype', 'PDF');

  let res: Response;
  try {
    res = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form.toString(),
    });
  } catch {
    throw new Error('Could not reach the OCR service — check your internet connection.');
  }
  const raw = await res.text();
  let data: any;
  try { data = JSON.parse(raw); }
  catch {
    if (res.status === 403 || res.status === 429) throw new Error('OCR limit reached.' + (usingShared ? addKeyHint : ''));
    throw new Error(`OCR service error (${res.status}).`);
  }
  if (data.IsErroredOnProcessing) {
    const m = Array.isArray(data.ErrorMessage) ? data.ErrorMessage.join(' ') : (data.ErrorMessage || 'OCR failed');
    throw new Error(m + (usingShared && /rate|limit|timed|expired|invalid|key/i.test(m) ? addKeyHint : ''));
  }
  const text = (data.ParsedResults || []).map((r: any) => r.ParsedText || '').join('\n').trim();
  if (!text) {
    const perr = data.ParsedResults?.[0]?.ErrorMessage;
    throw new Error((perr || 'No text was returned by the OCR service.') + (usingShared ? addKeyHint : ' Try a clearer photo.'));
  }
  return text;
}

// OCR via Google Cloud Vision (DOCUMENT_TEXT_DETECTION). Images → images:annotate;
// PDFs → files:annotate (inline, synchronous, first pages).
async function ocrVision(dataUrl: string, mime: string): Promise<string> {
  const key = usePrefs.getState().ocrKey.trim();
  if (!key) throw new Error('Add your Google Vision API key in Settings → Bill Scanning first.');
  const content = base64Of(dataUrl);

  if (mime === 'application/pdf') {
    const res = await fetch(`https://vision.googleapis.com/v1/files:annotate?key=${encodeURIComponent(key)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{
          inputConfig: { mimeType: 'application/pdf', content },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
          pages: [1, 2, 3, 4, 5],
        }],
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || 'OCR failed');
    const inner = data.responses?.[0]?.responses || [];
    if (data.responses?.[0]?.error) throw new Error(data.responses[0].error.message);
    return inner.map((r: any) => r.fullTextAnnotation?.text || '').join('\n').trim();
  }

  const res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(key)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: [{ image: { content }, features: [{ type: 'DOCUMENT_TEXT_DETECTION' }] }] }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || 'OCR failed');
  if (data.responses?.[0]?.error) throw new Error(data.responses[0].error.message);
  return (data.responses?.[0]?.fullTextAnnotation?.text || '').trim();
}
