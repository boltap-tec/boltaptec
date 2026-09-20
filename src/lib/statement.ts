import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import type { Employee, LedgerEntry, Attendance, Settings } from '../types';
import { advancePending } from './calc';
import { initials } from './format';

const rupee = (n: number) => 'Rs. ' + Number(n || 0).toLocaleString('en-IN');
const d = (s: string) => new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const byDateAsc = (a: { date: string }, b: { date: string }) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

// palette (shared look with the payslip)
const INDIGO: [number, number, number] = [79, 70, 229];
const INDIGO_D: [number, number, number] = [49, 46, 129];
const EMERALD: [number, number, number] = [16, 185, 129];
const AMBER: [number, number, number] = [217, 119, 6];
const SLATE: [number, number, number] = [51, 65, 85];
const MUTED: [number, number, number] = [120, 130, 150];

export type StatementKind = 'full' | 'salary' | 'advance' | 'attendance';
export interface StatementOptions { from?: string; to?: string; kind?: StatementKind }

const KIND_TITLE: Record<StatementKind, string> = {
  full: 'ACCOUNT STATEMENT',
  salary: 'SALARY STATEMENT',
  advance: 'ADVANCE STATEMENT',
  attendance: 'ATTENDANCE STATEMENT',
};
export const kindLabel: Record<StatementKind, string> = {
  full: 'Full statement', salary: 'Salary', advance: 'Advance history', attendance: 'Attendance',
};

// A human label + the "money in / money out" split for one ledger row.
const rowMoney = (l: LedgerEntry) => {
  if (l.category === 'Salary') return { type: 'Salary paid', inn: l.salary_payment_amount || 0, out: 0 };
  if (l.category === 'Advance_Payment') return { type: 'Advance given', inn: l.advance_payment || 0, out: 0 };
  return { type: 'Advance recovered', inn: 0, out: l.advance_recovery || 0 };
};

// Which ledger categories belong in a given statement kind.
const kindCats = (kind: StatementKind): string[] =>
  kind === 'salary' ? ['Salary']
    : kind === 'advance' ? ['Advance_Payment', 'Advance_Recovery']
    : kind === 'attendance' ? []
    : ['Salary', 'Advance_Payment', 'Advance_Recovery'];

export const generateStatement = (
  emp: Employee, ledger: LedgerEntry[], attendance: Attendance[], settings: Settings,
  opts: StatementOptions = {},
): { doc: jsPDF; filename: string } => {
  const kind: StatementKind = opts.kind || 'full';
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40;

  const inRange = (dt: string) => (!opts.from || dt >= opts.from) && (!opts.to || dt <= opts.to);
  const cats = kindCats(kind);
  const mine = ledger.filter((l) => l.employee_id === emp.employee_id && inRange(l.date) && cats.includes(l.category)).slice().sort(byDateAsc);
  const att = attendance.filter((a) => a.employee_id === emp.employee_id && inRange(a.date)).slice().sort(byDateAsc);

  // ---- Header band ----
  doc.setFillColor(...INDIGO); doc.rect(0, 0, W, 104, 'F');
  doc.setFillColor(...INDIGO_D); doc.circle(M + 22, 52, 22, 'F');
  doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
  doc.text(initials(emp.name), M + 22, 58, { align: 'center' });
  doc.setFontSize(18); doc.text(settings.business_name || 'Boltaptec', M + 58, 46);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(220, 222, 250);
  doc.text(KIND_TITLE[kind], M + 58, 66);
  doc.setFontSize(9);
  doc.text(`Generated ${d(new Date().toISOString())}`, W - M, 44, { align: 'right' });
  const periodLabel = (opts.from || opts.to) ? `Period: ${opts.from ? d(opts.from) : 'start'} to ${opts.to ? d(opts.to) : 'today'}` : 'Period: all time';
  doc.text(periodLabel, W - M, 60, { align: 'right' });

  let y = 132;

  // ---- Employee row ----
  doc.setTextColor(...SLATE); doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
  doc.text(emp.name, M, y);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...MUTED);
  doc.text(`ID ${emp.employee_id}${emp.phone ? '   •   ' + emp.phone : ''}`, M, y + 16);
  doc.text(`Daily wage ${rupee(emp.daily_wage)}  (${rupee(emp.hourly_rate)}/hr)`, W - M, y + 16, { align: 'right' });
  y += 40;

  // ---- Balance cards (tailored to the kind) ----
  const ap = advancePending(emp);
  const sp = Math.max(0, emp.total_salary - emp.salary_given);
  const salaryCards: [string, string, [number, number, number]][] = [
    ['Total salary earned', rupee(emp.total_salary), INDIGO],
    ['Salary paid', rupee(emp.salary_given), EMERALD],
    ['Salary pending', rupee(sp), AMBER],
  ];
  const advanceCards: [string, string, [number, number, number]][] = [
    ['Total advance given', rupee(emp.total_advance_given), INDIGO],
    ['Advance recovered', rupee(emp.advance_recovered), EMERALD],
    ['Advance outstanding', rupee(ap), AMBER],
  ];
  const cards = kind === 'salary' ? salaryCards
    : kind === 'advance' ? advanceCards
    : kind === 'attendance' ? salaryCards
    : [...salaryCards, ...advanceCards];
  const cardW = (W - 2 * M - 24) / 3;
  cards.forEach(([label, val, col], i) => {
    const x = M + (i % 3) * (cardW + 12);
    const cy = y + Math.floor(i / 3) * 62;
    doc.setFillColor(248, 249, 252); doc.roundedRect(x, cy, cardW, 54, 8, 8, 'F');
    doc.setTextColor(...MUTED); doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.text(label.toUpperCase(), x + 12, cy + 20);
    doc.setTextColor(...col); doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
    doc.text(val, x + 12, cy + 40);
  });
  y += 62 * Math.ceil(cards.length / 3) + 10;

  if (kind === 'attendance') {
    // ---- Detailed attendance table ----
    doc.setTextColor(...SLATE); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.text('Attendance', M, y);
    const rows = att.map((a) => [d(a.date), a.time_in || '—', a.time_out || '—', `${a.total_hours} h`, a.extra_time ? `${a.extra_time} h` : '—', rupee(a.salary_amount)]);
    autoTable(doc, {
      startY: y + 8,
      head: [['Date', 'In', 'Out', 'Hours', 'OT', 'Earned']],
      body: rows.length ? rows : [['—', 'No attendance', '', '', '', '']],
      theme: 'striped', headStyles: { fillColor: EMERALD, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [247, 248, 252] },
      columnStyles: { 5: { halign: 'right', fontStyle: 'bold' } },
      styles: { fontSize: 9, cellPadding: 5, textColor: SLATE },
      margin: { left: M, right: M },
      foot: [['Total', '', '', `${att.reduce((s, a) => s + a.total_hours, 0)} h`, '', rupee(att.reduce((s, a) => s + a.salary_amount, 0))]],
      footStyles: { fillColor: [237, 242, 247], textColor: SLATE, fontStyle: 'bold' },
    });
  } else {
    // ---- Transactions table with running advance balance ----
    doc.setTextColor(...SLATE); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.text('Transactions', M, y); y += 6;
    let runAdv = 0;
    const txRows = mine.map((l) => {
      const { type, inn, out } = rowMoney(l);
      if (l.category === 'Advance_Payment') runAdv += inn;
      if (l.category === 'Advance_Recovery') runAdv = Math.max(0, runAdv - out);
      const amt = l.category === 'Advance_Recovery' ? out : inn;
      return [d(l.date), type, l.method || 'Cash', rupee(amt), rupee(runAdv)];
    });
    autoTable(doc, {
      startY: y + 6,
      head: [['Date', 'Type', 'Method', 'Amount', 'Adv. balance']],
      body: txRows.length ? txRows : [['—', 'No transactions', '', '', '']],
      theme: 'striped', headStyles: { fillColor: INDIGO, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [247, 248, 252] },
      columnStyles: { 3: { halign: 'right', fontStyle: 'bold' }, 4: { halign: 'right', textColor: AMBER } },
      styles: { fontSize: 9, cellPadding: 5, textColor: SLATE },
      margin: { left: M, right: M },
    });

    // ---- Attendance summary (full & salary statements) ----
    if (kind === 'full' || kind === 'salary') {
      const afterTx = (doc as any).lastAutoTable?.finalY || y + 40;
      doc.setTextColor(...SLATE); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
      doc.text('Attendance summary', M, afterTx + 26);
      autoTable(doc, {
        startY: afterTx + 32,
        head: [['Days worked', 'Total hours', 'Salary earned']],
        body: [[String(att.length), `${att.reduce((s, a) => s + a.total_hours, 0)} h`, rupee(att.reduce((s, a) => s + a.salary_amount, 0))]],
        theme: 'grid', headStyles: { fillColor: EMERALD, fontStyle: 'bold' },
        columnStyles: { 2: { halign: 'right', fontStyle: 'bold' } },
        styles: { fontSize: 9, cellPadding: 5, textColor: SLATE },
        margin: { left: M, right: M },
      });
    }
  }

  // ---- Footer ----
  doc.setDrawColor(230, 232, 240); doc.setLineWidth(0.5);
  doc.line(M, H - 40, W - M, H - 40);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...MUTED);
  doc.text(`${settings.business_name || 'Boltaptec'} — computer-generated statement. No signature required.`, M, H - 26);
  doc.text('Powered by Boltaptec', W - M, H - 26, { align: 'right' });

  const filename = `${kind === 'full' ? 'Statement' : KIND_TITLE[kind].split(' ')[0]}_${emp.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
  return { doc, filename };
};

export const viewStatement = (emp: Employee, ledger: LedgerEntry[], attendance: Attendance[], settings: Settings, opts?: StatementOptions) => {
  const { doc, filename } = generateStatement(emp, ledger, attendance, settings, opts);
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (win) { setTimeout(() => URL.revokeObjectURL(url), 60_000); return; }
  const nav: any = navigator;
  const file = new File([blob], filename, { type: 'application/pdf' });
  if (nav.canShare && nav.canShare({ files: [file] })) nav.share({ files: [file], title: filename }).catch(() => doc.output('dataurlnewwindow'));
  else doc.output('dataurlnewwindow');
};

export const downloadStatement = async (emp: Employee, ledger: LedgerEntry[], attendance: Attendance[], settings: Settings, opts?: StatementOptions) => {
  const { doc, filename } = generateStatement(emp, ledger, attendance, settings, opts);
  const blob = doc.output('blob');
  const nav: any = navigator;
  const file = new File([blob], filename, { type: 'application/pdf' });
  if (nav.canShare && nav.canShare({ files: [file] })) {
    try { await nav.share({ files: [file], title: filename, text: `${kindLabel[opts?.kind || 'full']} for ${emp.name}` }); return; }
    catch { /* cancelled → plain download */ }
  }
  doc.save(filename);
};

// Excel statement — sheets tailored to the kind (Summary always).
export const downloadStatementExcel = (emp: Employee, ledger: LedgerEntry[], attendance: Attendance[], opts: StatementOptions = {}): string => {
  const kind: StatementKind = opts.kind || 'full';
  const inRange = (dt: string) => (!opts.from || dt >= opts.from) && (!opts.to || dt <= opts.to);
  const cats = kindCats(kind);
  const mine = ledger.filter((l) => l.employee_id === emp.employee_id && inRange(l.date) && cats.includes(l.category)).slice().sort(byDateAsc);
  const att = attendance.filter((a) => a.employee_id === emp.employee_id && inRange(a.date)).slice().sort(byDateAsc);
  const ap = advancePending(emp);
  const sp = Math.max(0, emp.total_salary - emp.salary_given);

  const summary = [
    { Field: 'Name', Value: emp.name },
    { Field: 'Employee ID', Value: emp.employee_id },
    { Field: 'Phone', Value: emp.phone || '' },
    { Field: 'Statement', Value: kindLabel[kind] },
    { Field: 'Period', Value: (opts.from || opts.to) ? `${opts.from || 'start'} to ${opts.to || 'today'}` : 'All time' },
    { Field: 'Daily wage', Value: emp.daily_wage },
    { Field: 'Total salary earned', Value: emp.total_salary },
    { Field: 'Salary paid', Value: emp.salary_given },
    { Field: 'Salary pending', Value: sp },
    { Field: 'Total advance given', Value: emp.total_advance_given },
    { Field: 'Advance recovered', Value: emp.advance_recovered },
    { Field: 'Advance outstanding', Value: ap },
    { Field: 'Generated', Value: new Date().toLocaleString('en-IN') },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), 'Summary');

  if (kind !== 'attendance') {
    let runAdv = 0;
    const txns = mine.map((l) => {
      const { type, inn, out } = rowMoney(l);
      if (l.category === 'Advance_Payment') runAdv += inn;
      if (l.category === 'Advance_Recovery') runAdv = Math.max(0, runAdv - out);
      return {
        Date: l.date, Type: type, Method: l.method || 'Cash',
        'Salary paid': l.category === 'Salary' ? inn : '',
        'Advance given': l.category === 'Advance_Payment' ? inn : '',
        'Advance recovered': l.category === 'Advance_Recovery' ? out : '',
        'Advance balance': runAdv,
        Remark: (l.remark || '').replace(/✓GPay/g, '').trim(),
      };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(txns.length ? txns : [{}]), 'Transactions');
  }

  if (kind === 'full' || kind === 'attendance') {
    const attn = att.map((a) => ({
      Date: a.date, 'In': a.time_in || '', 'Out': a.time_out || '',
      Hours: a.total_hours, 'OT hours': a.extra_time, 'Salary earned': a.salary_amount,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(attn.length ? attn : [{}]), 'Attendance');
  }

  const tag = kind === 'full' ? 'Statement' : KIND_TITLE[kind].split(' ')[0];
  const name = `${tag}_${emp.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, name);
  return name;
};
