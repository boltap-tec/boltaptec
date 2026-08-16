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
  source?: 'employee' | 'admin';   // who created the row (default admin)
  // employee self-punch starts 'pending'; admin approves → 'posted' (ledger) or rejects → 'rejected'
  status?: 'pending' | 'posted' | 'rejected';
  reject_reason?: string | null;
  decided_by?: string | null;
  decided_at?: string | null;
  open_lat?: number | null;   // location captured when the worker opened attendance
  open_lng?: number | null;
  close_lat?: number | null;  // location captured when the worker closed attendance
  close_lng?: number | null;
  // which project(s) this shift's hours were worked on (up to 2). Feeds the
  // project's labour expenditure. Set by admin while marking/approving.
  project_allocations?: ProjectAllocation[] | null;
}

export interface ProjectAllocation {
  project_id: string;
  project_name: string;
  hours: number;
  amount: number;   // hours × hourly_rate for this shift
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

export type ProjectStatus = 'Running' | 'Completed' | 'Cancelled';
export type QuoteBasis = 'Other' | 'Length_Breadth_Based';

export interface Project {
  project_id: string;
  name: string;
  date: string;
  owner_name: string | null;
  address: string | null;
  phone: string | null;
  quote_based_on: QuoteBasis;
  length: number | null;
  breadth: number | null;
  rate_per_sqft: number | null;
  total_sqft: number;          // length × breadth
  approximate_amount: number;  // total_sqft × rate_per_sqft
  amount_quoted: number;       // the price quoted to the customer
  discount: number | null;
  status: ProjectStatus;
  images?: string[] | null;
}

export interface ExpenditureCategory {
  category_id: string;
  name: string;
  visible: boolean;            // shown in the manual expenditure picker (Labour is hidden/auto)
}

export interface PurchaseItem {
  description: string;
  qty: number;
  rate: number;
  amount: number;
}

export interface ProjectExpenditure {
  id: string;
  project_id: string;
  project_name: string;
  date: string;
  category_id: string;
  category_name: string;
  description: string | null;
  amount: number;
  remark?: string | null;
  images?: string[] | null;    // bill photos
  items?: PurchaseItem[] | null;  // line items for a purchase (from paste/mapping or manual)
  vendor?: string | null;      // "bought from" — supplier on the bill
  cgst?: number | null;        // GST components on a purchase bill
  sgst?: number | null;
  igst?: number | null;
  source?: 'admin' | 'worker_request';
}

export interface ProjectPayment {
  id: string;
  project_id: string;
  project_name: string;
  date: string;
  amount: number;
  method?: 'Cash' | 'UPI' | 'Bank' | null;
  remark?: string | null;
}

export type ExpenditureRequestStatus = 'Pending' | 'Approved' | 'Rejected';

// A worker's request to be reimbursed for money spent on a project (tea, food…).
// On approval it becomes a project expenditure and the admin pays the worker.
export interface ExpenditureRequest {
  id: string;
  employee_id: string;
  employee_name: string;
  project_id: string;
  project_name: string;
  category_id: string;
  category_name: string;
  amount: number;
  note: string | null;
  status: ExpenditureRequestStatus;
  created_at: string;
  decided_at: string | null;
  decided_by: string | null;
  admin_note: string | null;
  paid_method: 'Cash' | 'UPI' | null;   // how the worker was reimbursed
}

export interface Settings {
  business_name: string;
  logo?: string | null;       // company logo (data URL) shown by the app name
  admin_upi_id: string;       // where employees pay back / receive
  admin_pin: string;          // admin login PIN (local demo only)
  standard_hours: number;     // hours per day (8)
  lunch_hours: number;        // default unpaid break deducted per shift
  delete_password?: string;   // required to delete a project or an employee
  week_start: number;         // 0=Sun..6=Sat
  location_required: boolean; // if true, workers must share location to open/close attendance
  today_project_id?: string | null;    // "Today's Plan" — default project for attendance/expense
  today_project_name?: string | null;
  today_plan_date?: string | null;     // the date the plan was set for
}
