import type { PurchaseItem } from '../types';

export type StdField = 'description' | 'qty' | 'rate' | 'amount';

// Parse pasted table text into a grid of cells. Detects the delimiter:
// tabs (Excel/Sheets copy) → commas (CSV) → runs of 2+ spaces (PDF copy).
export function parseTable(text: string): string[][] {
  const lines = text.replace(/\r/g, '').split('\n').map((l) => l.trimEnd()).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const hasTab = lines.some((l) => l.includes('\t'));
  // Prefer runs of 2+ spaces (PDF copy) over commas — Indian number commas like
  // ₹1,250 must not be mistaken for CSV separators.
  const multiSpaceLines = lines.filter((l) => /\S\s{2,}\S/.test(l)).length;
  const useMultiSpace = !hasTab && multiSpaceLines >= Math.ceil(lines.length / 2);
  const hasComma = !hasTab && !useMultiSpace && lines.some((l) => l.includes(','));
  const split = (l: string): string[] =>
    hasTab ? l.split('\t')
      : useMultiSpace ? l.trim().split(/\s{2,}/)
        : hasComma ? l.split(',')
          : l.trim().split(/\s+/);
  return lines.map((l) => split(l).map((c) => c.trim()));
}

// A default guess for column → field, based on position and header words.
export function guessMapping(rows: string[][]): Record<StdField, number> {
  const cols = rows.reduce((m, r) => Math.max(m, r.length), 0);
  const header = rows[0]?.map((c) => c.toLowerCase()) || [];
  const find = (words: string[]) => header.findIndex((h) => words.some((w) => h.includes(w)));
  const map: Record<StdField, number> = {
    description: find(['desc', 'item', 'particular', 'material', 'name', 'product']),
    qty: find(['qty', 'quant', 'nos', 'unit']),
    rate: find(['rate', 'price', 'mrp', 'per']),
    amount: find(['amount', 'total', 'value']),
  };
  // Fall back to positional defaults for anything not found by header.
  if (map.description < 0) map.description = 0;
  if (map.qty < 0) map.qty = cols > 1 ? 1 : -1;
  if (map.rate < 0) map.rate = cols > 2 ? 2 : -1;
  if (map.amount < 0) map.amount = cols > 3 ? 3 : (cols > 1 && map.qty < 0 && map.rate < 0 ? 1 : -1);
  return map;
}

const num = (s: string | undefined): number => {
  if (!s) return 0;
  const n = Number(s.replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? 0 : n;
};

// Turn parsed rows + a column mapping into purchase line items.
export function toItems(rows: string[][], map: Record<StdField, number>, skipHeader: boolean): PurchaseItem[] {
  const body = skipHeader ? rows.slice(1) : rows;
  return body
    .map((r) => {
      const description = map.description >= 0 ? (r[map.description] || '').trim() : '';
      const qty = map.qty >= 0 ? num(r[map.qty]) : 0;
      const rate = map.rate >= 0 ? num(r[map.rate]) : 0;
      let amount = map.amount >= 0 ? num(r[map.amount]) : 0;
      if (!amount && qty && rate) amount = Math.round(qty * rate);
      return { description, qty, rate, amount };
    })
    .filter((it) => it.description || it.amount);
}

export const itemsTotal = (items: PurchaseItem[]): number => items.reduce((s, it) => s + (it.amount || 0), 0);

// Best-effort read of the CGST/SGST/IGST total from a bill's text. Looks for the
// summary line ("CGST 5,555.50" / "CGST @ 9% 2,159.91") — a value with 2 decimals
// on the same line as the label — and takes the largest such match per tax.
export function detectGst(text: string): { cgst: number; sgst: number; igst: number } {
  const grab = (label: string): number => {
    let best = 0;
    const re = new RegExp(`${label}\\b[^\\n]*?([0-9][0-9,]*\\.[0-9]{2})`, 'gi');
    for (const m of text.matchAll(re)) {
      const v = Number(m[1].replace(/,/g, '')) || 0;
      if (v > best) best = v;   // the total is larger than any per-HSN split
    }
    return best;
  };
  return { cgst: grab('CGST'), sgst: grab('SGST'), igst: grab('IGST') };
}
