// Domain types — field names use snake_case so migration to Supabase tables is 1:1.

export type EmployeeStatus = 'Active' | 'Not_Active';

export interface Employee {
  employee_id: string;        // e.g. "Pavish_E2"
  name: string;
  address: string | null;
  phone: string | null;
  photo: string | null;       // data URL or path
  daily_wage: number;
  adhar_photo: string | null;
  status: EmployeeStatus;
  hourly_rate: number;        // derived: daily_wage / 8
  upi_id?: string | null;     // employee's UPI/GPay VPA
  pin?: string | null;        // 4-digit login PIN (local demo only)
  weekly_recovery?: number;   // planned advance deduction per payday (0 = none)
  join_date?: string | null;
  device_id?: string | null;  // bound device for attendance (IMEI stand-in)
  // rolling balances (kept in sync by the ledger)
  total_salary: number;
  salary_given: number;
  salary_pending: number;
  total_advance_given: number;
  advance_recovered: number;
  advance_pending: number;
}

export interface Attendance {
  id: string;
  date: string;               // YYYY-MM-DD
  employee_id: string;
  employee_name: string;
  time_in: string | null;
  time_out: string | null;
  total_hours: number;        // NET worked hours (after lunch deduction)
  salary_amount: number;
  daily_wage: number;
  ref_names: string | null;   // group members worked with
  extra_time: number;         // hours beyond 8
  lunch_hours?: number;       // unpaid break deducted from the shift
  paid?: boolean;             // true once salary for this day has been paid
  salary_id?: string | null;  // which salary period paid it
}

export type LedgerCategory = 'Advance_Payment' | 'Advance_Recovery' | 'Salary';

export interface LedgerEntry {
  id: string;
  date: string;
  category: LedgerCategory;
  employee_id: string;
  employee_name: string;
  description: string | null;
  salary_payment_amount: number | null;
  advance_payment: number | null;
  advance_recovery: number | null;
  total_amount_given: number | null;
  salary_id: string | null;
  remark: string | null;
  old_advance: number | null;
  method?: 'Cash' | 'UPI' | 'Bank' | null;
}

export interface SalaryDetail {
  id: string;
  from_date: string;
  to_date: string;
  employee_id: string;
  employee_name: string;
  total_hours: number;
  salary_amount: number;
  daily_wage: number;
  extra_time: number;
  advance_recovered: number;
  salary_given: number;
  salary_pending: number;
  from_to: string;
  this_week_advance?: number;
  advance_balance?: number;
}

export interface SalaryPosting {
  id: string;
  from_date: string;
  to_date: string;
  submitted: boolean;
  created_at: string;
}

export type RequestStatus = 'Pending' | 'Approved' | 'Rejected';

export interface AdvanceRequest {
  id: string;
  employee_id: string;
  employee_name: string;
  amount: number;
  reason: string;
  status: RequestStatus;
  method: 'Cash' | 'UPI';
  created_at: string;
  decided_at: string | null;
  decided_by: string | null;
  admin_note: string | null;
}

export type Role = 'admin' | 'employee';

export interface Session {
  role: Role;
  employee_id: string | null; // set when role === 'employee'
  name: string;
}

export interface Settings {
  business_name: string;
  admin_upi_id: string;       // where employees pay back / receive
  admin_pin: string;          // admin login PIN (local demo only)
  standard_hours: number;     // hours per day (8)
  lunch_hours: number;        // default unpaid break deducted per shift
  week_start: number;         // 0=Sun..6=Sat
}
