import { usePrefs } from '../store/usePrefs';

// Read a File as a base64 data URL.
export const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error('Could not read the file.'));
    r.onload = () => resolve(r.result as string);
    r.readAsDataURL(file);
  });

export const hasOcrKey = (): boolean => !!usePrefs.getState().ocrKey.trim();

const base64Of = (dataUrl: string): string => (dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl);

// OCR a bill via Google Cloud Vision (DOCUMENT_TEXT_DETECTION). Images go to
// images:annotate; PDFs go to files:annotate (inline, synchronous, first pages).
// Returns the extracted text, newline-separated in reading order.
export async function ocrFile(dataUrl: string, mime: string): Promise<string> {
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
