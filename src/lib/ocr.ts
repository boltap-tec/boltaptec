import { usePrefs } from '../store/usePrefs';

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
