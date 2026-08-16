import React, { useMemo, useState } from 'react';
import { Plus, Trash2, ClipboardPaste, Image as ImageIcon, ShoppingCart } from 'lucide-react';
import { useData } from '../store/useData';
import { Modal, Field } from './ui';
import { inr, today } from '../lib/format';
import { compressImage } from '../lib/image';
import { parseTable, guessMapping, toItems, itemsTotal, type StdField } from '../lib/purchase';
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
  const [items, setItems] = useState<PurchaseItem[]>([{ description: '', qty: 0, rate: 0, amount: 0 }]);
  const [bill, setBill] = useState<string | null>(null);
  const [remark, setRemark] = useState('');

  // paste + mapping
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [skipHeader, setSkipHeader] = useState(true);
  const parsed = useMemo(() => parseTable(pasteText), [pasteText]);
  const [map, setMap] = useState<Record<StdField, number>>({ description: 0, qty: 1, rate: 2, amount: 3 });
  const cols = parsed.reduce((m, r) => Math.max(m, r.length), 0);

  const reguess = (text: string) => {
    setPasteText(text);
    const rows = parseTable(text);
    if (rows.length) setMap(guessMapping(rows));
  };

  const importRows = () => {
    const imported = toItems(parsed, map, skipHeader);
    if (imported.length === 0) return;
    setItems((cur) => {
      const base = cur.filter((it) => it.description || it.amount);
      return [...base, ...imported];
    });
    setShowPaste(false); setPasteText('');
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

  const cleanItems = items.filter((it) => it.description || it.amount);
  const total = itemsTotal(cleanItems);

  const save = () => {
    const cat = visibleCats.find((c) => c.category_id === categoryId) || defaultCat;
    if (!cat || cleanItems.length === 0 || total <= 0) return;
    addExpenditure({
      project_id: project.project_id, project_name: project.name, date,
      category_id: cat.category_id, category_name: cat.name,
      description: `Purchase · ${cleanItems.length} item${cleanItems.length > 1 ? 's' : ''}`,
      amount: total, remark: remark.trim() || null,
      images: bill ? [bill] : null, items: cleanItems, source: 'admin',
    });
    // reset
    setItems([{ description: '', qty: 0, rate: 0, amount: 0 }]); setBill(null); setRemark(''); setPasteText('');
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

        {/* Standard purchase table */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="label flex items-center gap-1"><ShoppingCart size={13} /> Items</span>
            <button onClick={() => setShowPaste((s) => !s)} className="text-brand-600 text-xs font-semibold flex items-center gap-1"><ClipboardPaste size={13} /> Paste from bill</button>
          </div>

          {showPaste && (
            <div className="rounded-xl border border-brand-200 bg-brand-50/40 p-3 mb-2 space-y-2">
              <div className="text-xs text-slate-500">Paste rows copied from your bill / PDF / Excel. Then map the columns.</div>
              <textarea className="input font-mono text-xs" rows={4} value={pasteText} onChange={(e) => reguess(e.target.value)}
                placeholder={'Cement 50kg\t10\t380\t3800\nSand\t2\t1500\t3000'} />
              {parsed.length > 0 && (
                <>
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
                  <label className="flex items-center gap-2 text-xs text-slate-600">
                    <input type="checkbox" className="accent-brand-600" checked={skipHeader} onChange={(e) => setSkipHeader(e.target.checked)} /> First row is a header (skip it)
                  </label>
                  <div className="max-h-28 overflow-auto rounded-lg bg-white border border-slate-200 text-[11px]">
                    <table className="w-full">
                      <tbody>
                        {parsed.slice(0, 6).map((r, ri) => (
                          <tr key={ri} className={`${ri === 0 && skipHeader ? 'text-slate-300' : 'text-slate-600'} border-b border-slate-50`}>
                            {r.map((c, ci) => <td key={ci} className="px-2 py-1 whitespace-nowrap">{c}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button onClick={importRows} className="btn-primary w-full py-1.5 text-sm">Import {toItems(parsed, map, skipHeader).length} rows</button>
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

        <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
          <span className="text-sm font-semibold text-slate-500">Total</span>
          <span className="text-lg font-extrabold text-slate-800">{inr(total)}</span>
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
