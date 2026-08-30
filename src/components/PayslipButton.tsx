import React, { useState } from 'react';
import { FileText, Eye, Download } from 'lucide-react';
import { Modal } from './ui';
import { viewPayslip, downloadPayslip, type PayslipPayment } from '../lib/payslip';
import type { Employee, LedgerEntry, Settings } from '../types';

// One button that opens a small chooser: View the payslip PDF, or Download it
// (which then offers to open it). Used on the Salary grid, pay-success and the
// worker's My Money page so the behaviour is identical everywhere.
export const PayslipButton: React.FC<{
  emp: Employee;
  ledger: LedgerEntry[];
  settings: Settings;
  payment?: PayslipPayment;
  label?: string;
  className?: string;
  iconSize?: number;
}> = ({ emp, ledger, settings, payment, label = 'Payslip', className = 'btn-ghost', iconSize = 14 }) => {
  const [open, setOpen] = useState(false);
  const periodText = payment?.from_date && payment?.to_date
    ? `${payment.from_date} to ${payment.to_date}`
    : (payment?.period || '').replace(/[→➔➡]/g, 'to');

  return (
    <>
      <button onClick={() => setOpen(true)} className={className}>
        <FileText size={iconSize} /> {label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Payslip PDF">
        <div className="space-y-3">
          <div className="rounded-xl bg-slate-50 p-3 text-sm">
            <div className="font-bold text-slate-700">{emp.name}</div>
            {periodText && <div className="text-slate-500 text-xs mt-0.5">Period: {periodText}</div>}
            {payment?.net != null && <div className="text-emerald-600 font-semibold mt-1">Net paid: Rs. {Number(payment.net).toLocaleString('en-IN')}</div>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => { viewPayslip(emp, ledger, settings, payment); setOpen(false); }} className="btn-ghost">
              <Eye size={16} /> View PDF
            </button>
            <button onClick={() => { downloadPayslip(emp, ledger, settings, payment); setOpen(false); }} className="btn-primary">
              <Download size={16} /> Download
            </button>
          </div>
          <p className="text-[11px] text-slate-400 text-center">Download saves the PDF, then asks to open it — on both phone and web.</p>
        </div>
      </Modal>
    </>
  );
};
