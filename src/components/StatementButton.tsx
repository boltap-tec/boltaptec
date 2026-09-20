import React, { useState } from 'react';
import { FileText, Eye, Download, FileSpreadsheet, CalendarRange } from 'lucide-react';
import { Modal, Field } from './ui';
import { viewStatement, downloadStatement, downloadStatementExcel, kindLabel, type StatementKind } from '../lib/statement';
import type { Employee, LedgerEntry, Attendance, Settings } from '../types';

// One button that opens a chooser: pick the statement type (full / salary /
// advance / attendance) and an optional From–To date range, then View or
// download it as PDF or Excel. Used on the admin employee page and the worker's
// own portal so the behaviour is identical everywhere.
export const StatementButton: React.FC<{
  emp: Employee;
  ledger: LedgerEntry[];
  attendance: Attendance[];
  settings: Settings;
  label?: string;
  className?: string;
  iconSize?: number;
  defaultKind?: StatementKind;
}> = ({ emp, ledger, attendance, settings, label = 'Statement', className = 'btn-ghost', iconSize = 14, defaultKind = 'full' }) => {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<StatementKind>(defaultKind);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const opts = { from: from || undefined, to: to || undefined, kind };
  const kinds: StatementKind[] = ['full', 'salary', 'advance', 'attendance'];

  return (
    <>
      <button onClick={() => { setKind(defaultKind); setOpen(true); }} className={className}>
        <FileText size={iconSize} /> {label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Statement">
        <div className="space-y-3">
          <div className="rounded-xl bg-slate-50 p-3 text-sm">
            <div className="font-bold text-slate-700">{emp.name}</div>
            <div className="text-slate-500 text-xs mt-0.5">Balances + transactions, filtered by type & date range.</div>
          </div>

          <Field label="Statement type">
            <div className="grid grid-cols-2 gap-2">
              {kinds.map((k) => (
                <button key={k} onClick={() => setKind(k)}
                  className={`btn text-sm ${kind === k ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  {kindLabel[k]}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="From date"><input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
            <Field label="To date"><input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <CalendarRange size={13} /> Leave dates blank for all-time.
            {(from || to) && <button onClick={() => { setFrom(''); setTo(''); }} className="text-brand-600 font-semibold">Clear</button>}
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button onClick={() => { viewStatement(emp, ledger, attendance, settings, opts); setOpen(false); }} className="btn-ghost">
              <Eye size={16} /> View PDF
            </button>
            <button onClick={() => { downloadStatement(emp, ledger, attendance, settings, opts); setOpen(false); }} className="btn-primary">
              <Download size={16} /> PDF
            </button>
          </div>
          <button onClick={() => { downloadStatementExcel(emp, ledger, attendance, opts); setOpen(false); }} className="btn-success w-full">
            <FileSpreadsheet size={16} /> Download Excel
          </button>
          <p className="text-[11px] text-slate-400 text-center">PDF for sharing/printing · Excel opens in Sheets/Excel for your records.</p>
        </div>
      </Modal>
    </>
  );
};
