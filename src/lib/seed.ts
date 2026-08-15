import rawEmployees from '../data/employees.json';
import rawAttendance from '../data/attendance.json';
import rawLedger from '../data/ledger.json';
import rawSalaryDetails from '../data/salary_details.json';
import rawPostings from '../data/salary_postings.json';
import type {
  Employee, Attendance, LedgerEntry, SalaryDetail, SalaryPosting,
  AdvanceRequest, Settings,
} from '../types';
import { hourlyRate } from './calc';
import { uid } from './format';

const num = (v: any): number => (v == null || v === '' ? 0 : Number(v)) || 0;

export const seedEmployees = (): Employee[] =>
  (rawEmployees as any[]).map((e) => ({
    employee_id: e.employee_id,
    name: e.name,
    address: e.address ?? null,
    phone: e.phone ? String(e.phone) : null,
    photo: null,
    daily_wage: num(e.daily_wage),
    adhar_photo: null,
    status: e.status === 'Active' ? 'Active' : 'Not_Active',
    hourly_rate: e.hourly_rate ? num(e.hourly_rate) : hourlyRate(num(e.daily_wage)),
    upi_id: null,
    pin: e.phone ? String(e.phone).slice(-4) : '1234',
    weekly_recovery: 0,
    join_date: null,
    total_salary: num(e.total_salary),
    salary_given: num(e.salary_given),
    salary_pending: num(e.salary_pending),
    total_advance_given: num(e.total_advance_given),
    advance_recovered: num(e.advance_recovered),
    advance_pending: num(e.advance_pending),
  }));

export const seedAttendance = (): Attendance[] =>
  (rawAttendance as any[])
    .filter((a) => a.employee_id)
    .map((a) => ({
      id: String(a.id ?? uid('att_')),
      date: a.date,
      employee_id: a.employee_id,
      employee_name: a.employee_name,
      time_in: a.time_in ?? null,
      time_out: a.time_out ?? null,
      total_hours: num(a.total_hours),
      salary_amount: num(a.salary_amount),
      daily_wage: num(a.daily_wage),
      ref_names: a.ref_names ?? null,
      extra_time: num(a.extra_time),
    }));

export const seedLedger = (): LedgerEntry[] =>
  (rawLedger as any[])
    .filter((l) => l.employee_id)
    .map((l) => ({
      id: String(l.id ?? uid('led_')),
      date: l.date,
      category: l.category,
      employee_id: l.employee_id,
      employee_name: l.employee_name,
      description: l.description ?? null,
      salary_payment_amount: l.salary_payment_amount != null ? num(l.salary_payment_amount) : null,
      advance_payment: l.advance_payment != null ? num(l.advance_payment) : null,
      advance_recovery: l.advance_recovery != null ? num(l.advance_recovery) : null,
      total_amount_given: l.total_amount_given != null ? num(l.total_amount_given) : null,
      salary_id: l.salary_id ?? null,
      remark: l.remark ?? null,
      old_advance: l.old_advance != null ? num(l.old_advance) : null,
      method: 'Cash',
    }));

export const seedSalaryDetails = (): SalaryDetail[] =>
  (rawSalaryDetails as any[])
    .filter((s) => s.employee_id)
    .map((s) => ({
      id: String(s.id),
      from_date: s.from_date,
      to_date: s.to_date,
      employee_id: s.employee_id,
      employee_name: s.employee_name,
      total_hours: num(s.total_hours),
      salary_amount: num(s.salary_amount),
      daily_wage: num(s.daily_wage),
      extra_time: num(s.extra_time),
      advance_recovered: num(s.advance_recovered),
      salary_given: num(s.salary_given),
      salary_pending: num(s.salary_pending),
      from_to: s.from_to,
      this_week_advance: num(s.this_week_advance),
      advance_balance: num(s.advance_balance),
    }));

export const seedPostings = (): SalaryPosting[] =>
  (rawPostings as any[]).map((p) => ({
    id: String(p.id),
    from_date: p.from_date,
    to_date: p.to_date,
    submitted: true,
    created_at: p.from_date,
  }));

// A couple of demo pending requests to showcase the approval workflow.
export const seedAdvanceRequests = (): AdvanceRequest[] => [
  {
    id: uid('req_'),
    employee_id: 'Karthi_E3',
    employee_name: 'Karthi',
    amount: 3000,
    reason: 'Family medical expense',
    status: 'Pending',
    method: 'UPI',
    created_at: new Date(Date.now() - 86400000).toISOString(),
    decided_at: null,
    decided_by: null,
    admin_note: null,
  },
  {
    id: uid('req_'),
    employee_id: 'Sanjay_E4',
    employee_name: 'Sanjay',
    amount: 1500,
    reason: 'Bike repair',
    status: 'Pending',
    method: 'Cash',
    created_at: new Date(Date.now() - 3600000).toISOString(),
    decided_at: null,
    decided_by: null,
    admin_note: null,
  },
];

export const defaultSettings = (): Settings => ({
  business_name: 'BoltAp Workforce',
  admin_upi_id: 'yourbusiness@okaxis',
  admin_pin: '1234',
  standard_hours: 8,
  week_start: 6, // Saturday, matching the sample data
});
