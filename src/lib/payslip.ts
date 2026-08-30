import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Employee, LedgerEntry, Settings } from '../types';
import { advancePending } from './calc';
import { initials } from './format';

const rupee = (n: number) => 'Rs. ' + Number(n || 0).toLocaleString('en-IN');
const d = (s: string) => new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

// jsPDF's built-in Helvetica is WinAnsi-encoded — characters outside it (e.g. the
// "→" arrow) render as garbage. Normalise to safe ASCII so text stays clean.
const safe = (s: string) =>
  String(s ?? '')
    .replace(/[→➔➡]/g, ' to ')   // arrows → "to"
    .replace(/[–—]/g, '-')             // en/em dash → hyphen
    .replace(/\s+to\s+/g, ' to ')
    .trim();

// palette
const INDIGO: [number, number, number] = [79, 70, 229];
const INDIGO_D: [number, number, number] = [49, 46, 129];
const EMERALD: [number, number, number] = [16, 185, 129];
const AMBER: [number, number, number] = [217, 119, 6];
const SLATE: [number, number, number] = [51, 65, 85];
const MUTED: [number, number, number] = [120, 130, 150];

export interface PayslipPayment {
  date: string; period?: string; gross?: number; recovery?: number; net?: number; method?: string;
  from_date?: string; to_date?: string;   // when set, the payslip is scoped to this period
}

export const generatePayslip = (
  emp: Employee, ledger: LedgerEntry[], settings: Settings, payment?: PayslipPayment,
): { doc: jsPDF; filename: string } => {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40;

  // ---- Header band ----
  doc.setFillColor(...INDIGO); doc.rect(0, 0, W, 104, 'F');
  doc.setFillColor(...INDIGO_D); doc.circle(M + 22, 52, 22, 'F');
  doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
  doc.text(initials(emp.name), M + 22, 58, { align: 'center' });

  doc.setFontSize(18); doc.text(settings.business_name || 'Boltaptec', M + 58, 46);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(220, 222, 250);
  doc.text('SALARY PAYSLIP', M + 58, 66);
  doc.setFontSize(9);
  doc.text(`Generated ${d(new Date().toISOString())}`, W - M, 44, { align: 'right' });
  if (settings.admin_upi_id) doc.text(settings.admin_upi_id, W - M, 60, { align: 'right' });

  let y = 132;

  // ---- Employee row ----
  doc.setTextColor(...SLATE); doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
  doc.text(emp.name, M, y);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...MUTED);
  doc.text(`ID ${emp.employee_id}${emp.phone ? '   •   ' + emp.phone : ''}`, M, y + 16);
  doc.text(`Daily wage ${rupee(emp.daily_wage)}  (${rupee(emp.hourly_rate)}/hr)`, W - M, y + 16, { align: 'right' });
  y += 40;

  // ---- Net paid hero ----
  if (payment) {
    doc.setFillColor(236, 253, 245); doc.roundedRect(M, y, W - 2 * M, 74, 10, 10, 'F');
    doc.setDrawColor(...EMERALD); doc.setLineWidth(1); doc.roundedRect(M, y, W - 2 * M, 74, 10, 10, 'S');
    doc.setTextColor(...EMERALD); doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    doc.text('NET SALARY PAID', M + 18, y + 24);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(26);
    doc.text(rupee(payment.net || 0), M + 18, y + 52);
    // right side breakdown
    const rx = W - M - 18;
    const periodLabel = payment.from_date && payment.to_date
      ? `${d(payment.from_date)} to ${d(payment.to_date)}`
      : safe(payment.period || '-');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...MUTED);
    doc.text(`Period: ${periodLabel}`, rx, y + 20, { align: 'right' });
    doc.text(`Salary earned: ${rupee(payment.gross || 0)}`, rx, y + 36, { align: 'right' });
    doc.text(`Advance recovered: ${rupee(payment.recovery || 0)}`, rx, y + 52, { align: 'right' });
    doc.text(`Paid on ${d(payment.date)}  •  ${payment.method || 'Cash'}`, rx, y + 66, { align: 'right' });
    y += 96;
  }

  // ---- Balance cards ----
  const ap = advancePending(emp);
  const sp = Math.max(0, emp.total_salary - emp.salary_given);
  const cardW = (W - 2 * M - 24) / 3;
  const cards: [string, string, [number, number, number]][] = [
    ['Advance outstanding', rupee(ap), AMBER],
    ['Total advance repaid', rupee(emp.advance_recovered), EMERALD],
    ['Salary pending', rupee(sp), INDIGO],
  ];
  cards.forEach(([label, val, col], i) => {
    const x = M + i * (cardW + 12);
    doc.setFillColor(248, 249, 252); doc.roundedRect(x, y, cardW, 56, 8, 8, 'F');
    doc.setTextColor(...MUTED); doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.text(label.toUpperCase(), x + 12, y + 20);
    doc.setTextColor(...col); doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
    doc.text(val, x + 12, y + 42);
  });
  y += 78;

  // ---- History table ----
  // When the payslip is for a specific pay period, scope the transactions to that
  // date range so the slip matches the "from → to" it was generated for.
  const inPeriod = !!(payment?.from_date && payment?.to_date);
  doc.setTextColor(...SLATE); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
  doc.text(inPeriod
    ? `Transactions  ${d(payment!.from_date!)} to ${d(payment!.to_date!)}`
    : 'Payment & Advance History', M, y); y += 8;
  const mine = ledger
    .filter((l) => l.employee_id === emp.employee_id &&
      (!inPeriod || (l.date >= payment!.from_date! && l.date <= payment!.to_date!)))
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)); // newest first
  const rows = mine.slice(0, 55).map((l) => {
    const amt = l.total_amount_given || l.salary_payment_amount || l.advance_payment || l.advance_recovery || 0;
    const type = l.category === 'Salary' ? 'Salary paid'
      : l.category === 'Advance_Payment' ? 'Advance given' : 'Advance recovered';
    return [d(l.date), type, l.method || 'Cash', rupee(amt)];
  });
  autoTable(doc, {
    startY: y + 6,
    head: [['Date', 'Type', 'Method', 'Amount']],
    body: rows.length ? rows : [['—', 'No transactions yet', '', '']],
    theme: 'striped',
    headStyles: { fillColor: INDIGO, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [247, 248, 252] },
    columnStyles: { 3: { halign: 'right', fontStyle: 'bold' } },
    styles: { fontSize: 9, cellPadding: 5, textColor: SLATE },
    margin: { left: M, right: M },
  });

  // ---- Footer ----
  doc.setDrawColor(230, 232, 240); doc.setLineWidth(0.5);
  doc.line(M, H - 40, W - M, H - 40);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...MUTED);
  doc.text(`${settings.business_name || 'Boltaptec'} — computer-generated payslip. No signature required.`, M, H - 26);
  doc.text('Powered by Boltaptec', W - M, H - 26, { align: 'right' });

  const filename = `Payslip_${emp.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
  return { doc, filename };
};

// Open the payslip PDF in a viewer (new tab on the web; the system PDF viewer /
// share sheet inside the Android app). Never triggers a file download.
export const viewPayslip = (
  emp: Employee, ledger: LedgerEntry[], settings: Settings, payment?: PayslipPayment,
) => {
  const { doc, filename } = generatePayslip(emp, ledger, settings, payment);
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (win) { setTimeout(() => URL.revokeObjectURL(url), 60_000); return; }
  // Popup blocked or in-app WebView with no new-tab: fall back to the share sheet
  // (mobile) or jsPDF's own viewer window.
  const nav: any = navigator;
  const file = new File([blob], filename, { type: 'application/pdf' });
  if (nav.canShare && nav.canShare({ files: [file] })) {
    nav.share({ files: [file], title: filename }).catch(() => doc.output('dataurlnewwindow'));
  } else {
    doc.output('dataurlnewwindow');
  }
};

// Download the payslip, then offer to open it. On mobile the OS share sheet is the
// most reliable "save / open"; on the web we save the file and ask to open it.
export const downloadPayslip = async (
  emp: Employee, ledger: LedgerEntry[], settings: Settings, payment?: PayslipPayment,
) => {
  const { doc, filename } = generatePayslip(emp, ledger, settings, payment);
  const blob = doc.output('blob');
  const nav: any = navigator;
  const file = new File([blob], filename, { type: 'application/pdf' });
  // Mobile (Android app): the share sheet lets the worker Save to Files or Open with…
  if (nav.canShare && nav.canShare({ files: [file] })) {
    try { await nav.share({ files: [file], title: filename, text: `Payslip for ${emp.name}` }); return; }
    catch { /* cancelled → fall through to a plain download */ }
  }
  // Web: save the file, then ask whether to open it now.
  doc.save(filename);
  setTimeout(() => {
    if (confirm(`Payslip downloaded as "${filename}".\n\nOpen it now?`)) {
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    }
  }, 300);
};

// Backwards-compatible alias (older callers) → behaves like Download.
export const sharePayslip = downloadPayslip;
