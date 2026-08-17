import React, { useMemo, useState } from 'react';
import { Plus, Trash2, ClipboardPaste, Image as ImageIcon, ShoppingCart, ScanText, Loader2 } from 'lucide-react';
import { useData } from '../store/useData';
import { Modal, Field } from './ui';
import { inr, today } from '../lib/format';
import { compressImage } from '../lib/image';
import { parseTable, guessMapping, toItems, itemsTotal, type StdField } from '../lib/purchase';
import { ocrFile, ocrMindee, fileToDataUrl, ocrReady } from '../lib/ocr';
import { usePrefs } from '../store/usePrefs';
import type { Project, PurchaseItem } from '../types';

const FIELDS: { key: StdField; label: string }[] = [
  { key: 'description', label: 'Description' },
  { key: 'qty', label: 'Qty' },
  { key: 'rate', label: 'Rate' },
  { key: 'amount', label: 'Amount' },
];

export const PurchaseModal: React.FC<{ open: boolean; project: Project; onClose: () => void }> = ({ open, project, onClose }) => {
  const { expenditureCategories, addExpenditure } = useData();
  const visibleCats = expenditureCategories.filter((c) => c.visible);
  const defaultCat = visibleCats.find((c) => /material/i.test(c.name)) || visibleCats[0];

  const [categoryId, setCategoryId] = useState(defaultCat?.category_id || '');
  const [date, setDate] = useState(today());
  const [vendor, setVendor] = useState('');
  const [items, setItems] = useState<PurchaseItem[]>([{ description: '', qty: 0, rate: 0, amount: 0 }]);
  const [cgst, setCgst] = useState('');
  const [sgst, setSgst] = useState('');
  const [igst, setIgst] = useState('');
  const [gstMode, setGstMode] = useState<'amount' | 'percent'>('amount');  // bill shows ₹ or %
  const [bill, setBill] = useState<string | null>(null);
  const [remark, setRemark] = useState('');

  // paste + mapping
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState('');
  // Item-table region: only rows fromRow..toRow (1-based, inclusive) are imported,
  // so the header/address/GST/footer text is left out. Different bills → adjust.
  const [fromRow, setFromRow] = useState(1);
  const [toRow, setToRow] = useState(0);
  const parsed = useMemo(() => parseTable(pasteText), [pasteText]);
  const [map, setMap] = useState<Record<StdField, number>>({ description: 0, qty: 1, rate: 2, amount: 3 });
  const cols = parsed.reduce((m, r) => Math.max(m, r.length), 0);
  const clampFrom = Math.min(Math.max(1, fromRow), Math.max(1, parsed.length));
  const clampTo = Math.min(Math.max(clampFrom, toRow), parsed.length);
  const region = parsed.slice(clampFrom - 1, clampTo);
  const previewItems = toItems(region, map, false);

  const reguess = (text: string) => {
    setPasteText(text);
    const rows = parseTable(text);
    if (rows.length) setMap(guessMapping(rows));
    // Default the range to a plausible item block: skip the first header line.
    setFromRow(rows.length > 1 ? 2 : 1);
    setToRow(rows.length);
  };

  const importRows = () => {
    if (previewItems.length === 0) return;
    setItems((cur) => {
      const base = cur.filter((it) => it.description || it.amount);
      return [...base, ...previewItems];
    });
    setShowPaste(false); setPasteText('');
  };

  // Tap a preview row to set the item-table start/end (nearest boundary moves).
  const onRowClick = (n: number) => {
    if (n < clampFrom) setFromRow(n);
    else if (n > clampTo) setToRow(n);
    else if (n - clampFrom <= clampTo - n) setFromRow(n);
    else setToRow(n);
  };

  const setItem = (i: number, patch: Partial<PurchaseItem>) =>
    setItems((cur) => cur.map((it, j) => {
      if (j !== i) return it;
      const next = { ...it, ...patch };
      // keep amount = qty×rate unless the amount itself was edited
      if (patch.amount === undefined && (patch.qty !== undefined || patch.rate !== undefined)) next.amount = Math.round(next.qty * next.rate);
      return next;
    }));

  const onBill = async (file: File | null) => {
    if (!file) return;
    try { const d = await compressImage(file, 120 * 1024, 900); setBill(d); }
    catch { alert('Could not use that image (use a JPG/PNG photo of the bill).'); }
  };

  // Scan a bill (photo or PDF) with cloud OCR → fill the paste box + guess columns.
  const [scanning, setScanning] = useState(false);
  const onScan = async (file: File | null) => {
    if (!file) return;
    if (!ocrReady()) { alert('Set up bill scanning in Settings → Bill Scanning first.'); return; }
    setScanning(true);
    try {
      const name = file.name || '';
      const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(name);
      const isImg = !isPdf && (file.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif|bmp)$/i.test(name));

      if (usePrefs.getState().ocrProvider === 'mindee') {
        // Invoice-AI: fills the table + vendor + GST directly, structured.
        const s = await ocrMindee(file);
        if (s.items.length) setItems(s.items);
        if (s.vendor) setVendor(s.vendor);
        if (s.date) setDate(s.date);
        if (s.cgst) setCgst(String(s.cgst));
        if (s.sgst) setSgst(String(s.sgst));
        if (s.igst) setIgst(String(s.igst));
        if (isImg) { try { setBill(await compressImage(file, 120 * 1024, 900)); } catch { /* keep going */ } }
        if (!s.items.length && !s.vendor) alert('Mindee could not read line items from this bill — check the rows.');
        return;
      }

      // Text OCR (OCR.space / Vision) → paste box + column mapping.
      let dataUrl: string;
      if (isImg) {
        try { dataUrl = await compressImage(file, 900 * 1024, 1600); }
        catch { dataUrl = await fileToDataUrl(file); }
      } else {
        dataUrl = await fileToDataUrl(file);
      }
      const text = await ocrFile(dataUrl, isPdf ? 'application/pdf' : (isImg ? 'image/jpeg' : file.type));
      setShowPaste(true);
      reguess(text);
      if (isImg) { try { setBill(await compressImage(file, 120 * 1024, 900)); } catch { /* keep going */ } }
    } catch (e: any) {
      alert('Scan failed: ' + (e?.message || 'OCR error'));
    } finally { setScanning(false); }
  };

  const cleanItems = items.filter((it) => it.description || it.amount);
  const subtotal = itemsTotal(cleanItems);
  // A GST field can be a rupee amount or a % of the subtotal (per the bill).
  const gstAmt = (v: string) => (gstMode === 'percent' ? Math.round(subtotal * (Number(v) || 0) / 100) : (Number(v) || 0));
  const cgstAmt = gstAmt(cgst), sgstAmt = gstAmt(sgst), igstAmt = gstAmt(igst);
  const gst = cgstAmt + sgstAmt + igstAmt;
  const total = subtotal + gst;

  const save = () => {
    const cat = visibleCats.find((c) => c.category_id === categoryId) || defaultCat;
    if (!cat || cleanItems.length === 0 || total <= 0) return;
    addExpenditure({
      project_id: project.project_id, project_name: project.name, date,
      category_id: cat.category_id, category_name: cat.name,
      description: `Purchase · ${cleanItems.length} item${cleanItems.length > 1 ? 's' : ''}${vendor.trim() ? ` · ${vendor.trim()}` : ''}`,
      amount: total, remark: remark.trim() || null,
      images: bill ? [bill] : null, items: cleanItems, source: 'admin',
      vendor: vendor.trim() || null,
      cgst: cgstAmt || null, sgst: sgstAmt || null, igst: igstAmt || null,
    });
    // reset
    setItems([{ description: '', qty: 0, rate: 0, amount: 0 }]); setBill(null); setRemark(''); setPasteText('');
    setVendor(''); setCgst(''); setSgst(''); setIgst('');
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Add Purchase" wide>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {visibleCats.map((c) => <option key={c.category_id} value={c.category_id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Date"><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>
        <Field label="Bought from (vendor / shop)"><input className="input" value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="e.g. Sri Balaji Traders" /></Field>

        {/* Standard purchase table */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="label flex items-center gap-1"><ShoppingCart size={13} /> Items</span>
            <div className="flex items-center gap-3">
              <label className={`text-brand-600 text-xs font-semibold flex items-center gap-1 cursor-pointer ${scanning ? 'opacity-60' : ''}`}>
                {scanning ? <Loader2 size={13} className="animate-spin" /> : <ScanText size={13} />} {scanning ? 'Scanning…' : 'Scan bill (OCR)'}
                <input type="file" accept="image/*,application/pdf" className="hidden" disabled={scanning} onChange={(e) => { onScan(e.target.files?.[0] || null); e.target.value = ''; }} />
              </label>
              <button onClick={() => setShowPaste((s) => !s)} className="text-brand-600 text-xs font-semibold flex items-center gap-1"><ClipboardPaste size={13} /> Paste from bill</button>
            </div>
          </div>

          {showPaste && (
            <div className="rounded-xl border border-brand-200 bg-brand-50/40 p-3 mb-2 space-y-2">
              <div className="text-xs text-slate-500">Paste rows from your bill (or use Scan). Then pick where the item table <b>starts</b> and <b>ends</b> and map the columns.</div>
              <textarea className="input font-mono text-xs" rows={4} value={pasteText} onChange={(e) => reguess(e.target.value)}
                placeholder={'Cement 50kg\t10\t380\t3800\nSand\t2\t1500\t3000'} />
              {parsed.length > 0 && (
                <>
                  {/* Item-table region */}
                  <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
                    <span className="font-semibold">Item rows</span>
                    <label className="flex items-center gap-1">from
                      <input type="number" min={1} max={parsed.length} className="input py-1 w-14 text-xs" value={clampFrom} onChange={(e) => setFromRow(Number(e.target.value) || 1)} />
                    </label>
                    <label className="flex items-center gap-1">to
                      <input type="number" min={clampFrom} max={parsed.length} className="input py-1 w-14 text-xs" value={clampTo} onChange={(e) => setToRow(Number(e.target.value) || parsed.length)} />
                    </label>
                    <span className="text-slate-400">of {parsed.length} · tap rows below</span>
                  </div>
                  <div className="max-h-40 overflow-auto rounded-lg bg-white border border-slate-200 text-[11px]">
                    <table className="w-full">
                      <tbody>
                        {parsed.map((r, ri) => {
                          const n = ri + 1;
                          const inRange = n >= clampFrom && n <= clampTo;
                          return (
                            <tr key={ri} onClick={() => onRowClick(n)}
                              className={`cursor-pointer border-b border-slate-50 ${inRange ? 'bg-brand-50 text-slate-700' : 'text-slate-300 hover:bg-slate-50'}`}>
                              <td className="px-1.5 py-1 text-right text-slate-300 select-none">{n}</td>
                              {r.map((c, ci) => <td key={ci} className="px-2 py-1 whitespace-nowrap">{c}</td>)}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {/* Column mapping */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {FIELDS.map((f) => (
                      <label key={f.key} className="text-xs">
                        <span className="block font-semibold text-slate-500 mb-0.5">{f.label}</span>
                        <select className="input py-1.5 text-xs" value={map[f.key]} onChange={(e) => setMap({ ...map, [f.key]: Number(e.target.value) })}>
                          <option value={-1}>— none —</option>
                          {Array.from({ length: cols }).map((_, i) => <option key={i} value={i}>Column {i + 1}</option>)}
                        </select>
                      </label>
                    ))}
                  </div>
                  <button onClick={importRows} disabled={previewItems.length === 0} className="btn-primary w-full py-1.5 text-sm">Import {previewItems.length} rows</button>
                </>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <div className="grid grid-cols-[1fr_3rem_4rem_5rem_1.5rem] gap-1.5 text-[11px] font-semibold text-slate-400 px-1">
              <span>Description</span><span>Qty</span><span>Rate</span><span>Amount</span><span />
            </div>
            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-[1fr_3rem_4rem_5rem_1.5rem] gap-1.5 items-center">
                <input className="input py-1.5 text-sm" value={it.description} onChange={(e) => setItem(i, { description: e.target.value })} placeholder="Item" />
                <input className="input py-1.5 text-sm px-1.5" inputMode="decimal" value={it.qty || ''} onChange={(e) => setItem(i, { qty: Number(e.target.value) || 0 })} />
                <input className="input py-1.5 text-sm px-1.5" inputMode="decimal" value={it.rate || ''} onChange={(e) => setItem(i, { rate: Number(e.target.value) || 0 })} />
                <input className="input py-1.5 text-sm px-1.5" inputMode="decimal" value={it.amount || ''} onChange={(e) => setItem(i, { amount: Number(e.target.value) || 0 })} />
                <button onClick={() => setItems(items.filter((_, j) => j !== i))} className="text-rose-300 hover:text-rose-500"><Trash2 size={14} /></button>
              </div>
            ))}
            <button onClick={() => setItems([...items, { description: '', qty: 0, rate: 0, amount: 0 }])} className="btn-ghost w-full py-1.5 text-sm"><Plus size={14} /> Add row</button>
          </div>
        </div>

        {/* GST — optional. Fill only what the bill shows (₹ or %); leave blank if none. */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="label mb-0">GST <span className="font-normal text-slate-400">— optional, fill what the bill shows</span></span>
            <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs font-bold">
              {(['amount', 'percent'] as const).map((m) => (
                <button key={m} onClick={() => setGstMode(m)} className={`px-2 py-0.5 rounded-md ${gstMode === m ? 'bg-white shadow-sm text-brand-600' : 'text-slate-500'}`}>{m === 'amount' ? '₹' : '%'}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {([['CGST', cgst, setCgst, cgstAmt], ['SGST', sgst, setSgst, sgstAmt], ['IGST', igst, setIgst, igstAmt]] as const).map(([label, val, set, amt]) => (
              <label key={label} className="text-xs">
                <span className="block text-slate-400 font-semibold mb-0.5">{label} {gstMode === 'amount' ? '₹' : '%'}</span>
                <input className="input py-1.5 text-sm" inputMode="decimal" value={val} onChange={(e) => set(e.target.value)} placeholder="0" />
                {gstMode === 'percent' && Number(val) > 0 && <span className="block text-[10px] text-slate-400 mt-0.5">= {inr(amt)}</span>}
              </label>
            ))}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Intra-state → CGST + SGST · Inter-state → IGST · No GST → leave all blank.</div>
        </div>

        <div className="rounded-xl bg-slate-50 px-3 py-2 space-y-1">
          <div className="flex items-center justify-between text-sm text-slate-500"><span>Subtotal</span><span>{inr(subtotal)}</span></div>
          {gst > 0 && <div className="flex items-center justify-between text-sm text-slate-500"><span>GST</span><span>{inr(gst)}</span></div>}
          <div className="flex items-center justify-between border-t border-slate-200 pt-1"><span className="text-sm font-semibold text-slate-600">Grand Total</span><span className="text-lg font-extrabold text-slate-800">{inr(total)}</span></div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="btn-ghost cursor-pointer justify-center">
            <ImageIcon size={16} /> {bill ? 'Bill attached ✓' : 'Attach bill'}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => onBill(e.target.files?.[0] || null)} />
          </label>
          <input className="input" value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="Remark (optional)" />
        </div>
        {bill && <img src={bill} alt="bill" className="max-h-32 rounded-lg border border-slate-200" />}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="btn-ghost flex-1">Cancel</button>
          <button onClick={save} disabled={cleanItems.length === 0 || total <= 0} className="btn-primary flex-1">Save Purchase ({inr(total)})</button>
        </div>
      </div>
    </Modal>
  );
};
