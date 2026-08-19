import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Employee, LedgerEntry, Settings } from '../types';
import { advancePending } from './calc';
import { initials } from './format';

const rupee = (n: number) => 'Rs. ' + Number(n || 0).toLocaleString('en-IN');
const d = (s: string) => new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

// palette
const INDIGO: [number, number, number] = [79, 70, 229];
const INDIGO_D: [number, number, number] = [49, 46, 129];
const EMERALD: [number, number, number] = [16, 185, 129];
const AMBER: [number, number, number] = [217, 119, 6];
const SLATE: [number, number, number] = [51, 65, 85];
const MUTED: [number, number, number] = [120, 130, 150];

export interface PayslipPayment {
  date: string; period?: string; gross?: number; recovery?: number; net?: number; method?: string;
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
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...MUTED);
    doc.text(`Period: ${payment.period || '-'}`, rx, y + 20, { align: 'right' });
    doc.text(`Salary earned: ${rupee(payment.gross || 0)}`, rx, y + 36, { align: 'right' });
    doc.text(`Advance recovered: ${rupee(payment.recovery || 0)}`, rx, y + 52, { align: 'right' });
    doc.text(`Paid on ${d(payment.date)} • ${payment.method || 'Cash'}`, rx, y + 66, { align: 'right' });
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
  doc.setTextColor(...SLATE); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
  doc.text('Payment & Advance History', M, y); y += 8;
  const mine = ledger
    .filter((l) => l.employee_id === emp.employee_id)
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

export const sharePayslip = async (
  emp: Employee, ledger: LedgerEntry[], settings: Settings, payment?: PayslipPayment,
) => {
  const { doc, filename } = generatePayslip(emp, ledger, settings, payment);
  const blob = doc.output('blob');
  const file = new File([blob], filename, { type: 'application/pdf' });
  const nav: any = navigator;
  if (nav.canShare && nav.canShare({ files: [file] })) {
    try { await nav.share({ files: [file], title: 'Payslip', text: `Payslip for ${emp.name}` }); return; }
    catch { /* cancelled → download */ }
  }
  doc.save(filename);
};
