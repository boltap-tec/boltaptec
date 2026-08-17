import * as XLSX from 'xlsx';
import type {
  Employee, Attendance, LedgerEntry, SalaryDetail, SalaryPosting,
  AdvanceRequest, Settings,
} from '../types';

export interface BackupData {
  employees: Employee[];
  attendance: Attendance[];
  ledger: LedgerEntry[];
  salaryDetails: SalaryDetail[];
  postings: SalaryPosting[];
  requests: AdvanceRequest[];
  settings: Settings;
}

// Build one workbook with every table on its own sheet. .xlsx imports directly
// into Google Sheets (File → Import → Upload), so this doubles as the
// "Google Sheet backup". When the Google Sheets API is wired up later, the same
// rows can be pushed straight to a live sheet instead of downloaded.
export const buildWorkbook = (d: BackupData): XLSX.WorkBook => {
  const wb = XLSX.utils.book_new();
  const add = (name: string, rows: any[]) =>
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{}]), name);

  add('Employees', d.employees);
  add('Attendance', d.attendance);
  add('Ledger', d.ledger);
  add('Salary_Details', d.salaryDetails);
  add('Salary_Postings', d.postings);
  add('Advance_Requests', d.requests);
  add('Settings', [d.settings]);

  // A quick human-readable summary sheet up front.
  const summary = [
    { Metric: 'Backup taken', Value: new Date().toLocaleString('en-IN') },
    { Metric: 'Business', Value: d.settings.business_name },
    { Metric: 'Employees', Value: d.employees.length },
    { Metric: 'Attendance records', Value: d.attendance.length },
    { Metric: 'Ledger entries', Value: d.ledger.length },
    { Metric: 'Salary postings', Value: d.postings.length },
    { Metric: 'Advance requests', Value: d.requests.length },
    { Metric: 'Total advance outstanding', Value: d.employees.reduce((s, e) => s + Math.max(0, e.total_advance_given - e.advance_recovered), 0) },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), 'Summary');
  // move Summary to the front
  wb.SheetNames = ['Summary', ...wb.SheetNames.filter((n) => n !== 'Summary')];
  return wb;
};

export const backupFileName = (label = ''): string => {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return `Boltaptec_Backup${label ? '_' + label.replace(/[^\w-]/g, '') : ''}_${stamp}.xlsx`;
};

export const downloadBackup = (d: BackupData, label = ''): string => {
  const wb = buildWorkbook(d);
  const name = backupFileName(label);
  XLSX.writeFile(wb, name);
  return name;
};

// The backup workbook as a base64 string — used to POST it to the Google Drive
// Apps Script endpoint (which decodes it and writes an .xlsx into the folder).
export const workbookBase64 = (d: BackupData): string =>
  XLSX.write(buildWorkbook(d), { bookType: 'xlsx', type: 'base64' }) as string;
