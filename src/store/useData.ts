import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Employee, Attendance, LedgerEntry, SalaryDetail, SalaryPosting,
  AdvanceRequest, Settings, Project, ExpenditureCategory, ProjectExpenditure, ProjectPayment,
  ExpenditureRequest,
} from '../types';
import {
  seedEmployees, seedAttendance, seedLedger, seedSalaryDetails,
  seedPostings, seedAdvanceRequests, defaultSettings,
  seedProjects, seedExpenditureCategories, seedProjectExpenditure, seedProjectPayments,
} from '../lib/seed';
import { advancePending, hourlyRate, computeAttendanceSalary, hoursBetween } from '../lib/calc';
import { uid, today, fmtDate } from '../lib/format';

interface DataState {
  employees: Employee[];
  attendance: Attendance[];
  ledger: LedgerEntry[];
  salaryDetails: SalaryDetail[];
  postings: SalaryPosting[];
  requests: AdvanceRequest[];
  projects: Project[];
  expenditureCategories: ExpenditureCategory[];
  projectExpenditure: ProjectExpenditure[];
  projectPayments: ProjectPayment[];
  expenditureRequests: ExpenditureRequest[];
  settings: Settings;

  // projects
  addProject: (p: Partial<Project> & { name: string }) => Project;
  updateProject: (id: string, patch: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  addExpenditure: (e: Omit<ProjectExpenditure, 'id'>) => void;
  deleteExpenditure: (id: string) => void;
  addPayment: (p: Omit<ProjectPayment, 'id'>) => void;
  deletePayment: (id: string) => void;
  addCategory: (name: string) => void;
  setTodayPlan: (projectId: string | null) => void;

  // worker project-expense requests
  createExpenditureRequest: (r: Omit<ExpenditureRequest, 'id' | 'status' | 'created_at' | 'decided_at' | 'decided_by' | 'admin_note' | 'paid_method'>) => void;
  updateExpenditureRequest: (id: string, patch: Partial<Pick<ExpenditureRequest, 'amount' | 'category_id' | 'category_name' | 'project_id' | 'project_name' | 'note'>>) => void;
  approveExpenditureRequest: (id: string, decidedBy: string, paidMethod: 'Cash' | 'UPI', note?: string) => void;
  rejectExpenditureRequest: (id: string, decidedBy: string, note?: string) => void;

  // employees
  addEmployee: (e: Partial<Employee> & { name: string; daily_wage: number }) => Employee;
  updateEmployee: (id: string, patch: Partial<Employee>) => void;
  deleteEmployee: (id: string) => void;

  // attendance
  addAttendance: (a: Omit<Attendance, 'id'>) => void;
  updateAttendance: (id: string, patch: { date?: string; time_in?: string; time_out?: string; lunch_hours?: number; project_allocations?: import('../types').ProjectAllocation[] | null }) => void;
  deleteAttendance: (id: string) => void;
  markIn: (employeeId: string, loc?: { lat: number; lng: number } | null) => { ok: boolean; msg: string };
  markOut: (employeeId: string, loc?: { lat: number; lng: number } | null) => { ok: boolean; msg: string };
  // Admin approves an employee self-punch → posted (enters the attendance ledger).
  postAttendance: (id: string, decidedBy?: string) => void;
  // Admin rejects a self-punch → kept as 'rejected' (visible in the Rejected tab).
  rejectAttendance: (id: string, reason?: string, decidedBy?: string) => void;

  // advances
  giveAdvance: (employeeId: string, amount: number, method: 'Cash' | 'UPI', note?: string, weeklyRecovery?: number, date?: string) => void;
  recoverAdvance: (employeeId: string, amount: number, note?: string, date?: string) => void;
  deleteLedgerEntry: (id: string) => void;

  // advance requests
  createRequest: (r: Omit<AdvanceRequest, 'id' | 'status' | 'created_at' | 'decided_at' | 'decided_by' | 'admin_note'>) => void;
  approveRequest: (id: string, decidedBy: string, note?: string) => void;
  rejectRequest: (id: string, decidedBy: string, note?: string) => void;

  // advance request edit
  updateRequest: (id: string, patch: Partial<Pick<AdvanceRequest, 'amount' | 'reason' | 'method'>>) => void;

  // salary
  paySalary: (employeeId: string, amount: number, salaryId: string | null, method: 'Cash' | 'UPI', date?: string) => void;
  // Generate a payroll for a period → creates a posting + a payment-grid row per
  // employee (from their UNPAID attendance days), claims those days, and posts it.
  generatePayroll: (from: string, to: string) => SalaryPosting | null;
  // Pay one grid row (recover advance + salary cash, full or partial). The row
  // stays payable until fully settled.
  paySalaryDetail: (detailId: string, recovery: number, cash: number, method: 'Cash' | 'UPI', date?: string) => void;
  deletePosting: (postingId: string) => void;

  resetAll: () => void;
}

const recomputeEmployee = (e: Employee): Employee => ({
  ...e,
  hourly_rate: hourlyRate(e.daily_wage),
  advance_pending: advancePending(e),
  salary_pending: Math.max(0, e.total_salary - e.salary_given),
});

export const useData = create<DataState>()(
  persist(
    (set, get) => ({
      employees: [],
      attendance: [],
      ledger: [],
      salaryDetails: [],
      postings: [],
      requests: [],
      projects: [],
      expenditureCategories: [],
      projectExpenditure: [],
      projectPayments: [],
      expenditureRequests: [],
      settings: defaultSettings(),

      addProject: (p) => {
        const n = get().projects.length + 1;
        const clean = p.name.trim().replace(/\s+/g, ' ');
        const project: Project = {
          project_id: p.project_id || `${clean.replace(/\s+/g, '_')}_P${n}`,
          name: clean,
          date: p.date || today(),
          owner_name: p.owner_name ?? null,
          address: p.address ?? null,
          phone: p.phone ?? null,
          quote_based_on: p.quote_based_on || 'Other',
          length: p.length ?? null,
          breadth: p.breadth ?? null,
          rate_per_sqft: p.rate_per_sqft ?? null,
          total_sqft: p.total_sqft ?? 0,
          approximate_amount: p.approximate_amount ?? 0,
          amount_quoted: p.amount_quoted ?? 0,
          discount: p.discount ?? null,
          status: p.status || 'Running',
          images: p.images ?? null,
        };
        set({ projects: [project, ...get().projects] });
        return project;
      },

      updateProject: (id, patch) =>
        set({ projects: get().projects.map((p) => (p.project_id === id ? { ...p, ...patch } : p)) }),

      deleteProject: (id) =>
        set({
          projects: get().projects.filter((p) => p.project_id !== id),
          projectExpenditure: get().projectExpenditure.filter((e) => e.project_id !== id),
          projectPayments: get().projectPayments.filter((x) => x.project_id !== id),
        }),

      addExpenditure: (e) =>
        set({ projectExpenditure: [{ ...e, id: uid('exp_') }, ...get().projectExpenditure] }),

      deleteExpenditure: (id) =>
        set({ projectExpenditure: get().projectExpenditure.filter((e) => e.id !== id) }),

      addPayment: (p) =>
        set({ projectPayments: [{ ...p, id: uid('pay_') }, ...get().projectPayments] }),

      deletePayment: (id) =>
        set({ projectPayments: get().projectPayments.filter((x) => x.id !== id) }),

      addCategory: (name) => {
        const clean = name.trim();
        if (!clean) return;
        const n = get().expenditureCategories.length + 1;
        set({
          expenditureCategories: [
            ...get().expenditureCategories,
            { category_id: `${clean.replace(/\s+/g, '_')}_C${n}`, name: clean, visible: true },
          ],
        });
      },

      // "Today's Work" — the active project for the day (used as the default when
      // marking attendance or requesting a project expense).
      setTodayPlan: (projectId) => {
        const p = projectId ? get().projects.find((x) => x.project_id === projectId) : null;
        set({
          settings: {
            ...get().settings,
            today_project_id: p ? p.project_id : null,
            today_project_name: p ? p.name : null,
            today_plan_date: p ? today() : null,
          },
        });
      },

      createExpenditureRequest: (r) =>
        set({
          expenditureRequests: [
            {
              ...r, id: uid('exr_'), status: 'Pending',
              created_at: new Date().toISOString(),
              decided_at: null, decided_by: null, admin_note: null, paid_method: null,
            },
            ...get().expenditureRequests,
          ],
        }),

      updateExpenditureRequest: (id, patch) =>
        set({
          expenditureRequests: get().expenditureRequests.map((r) =>
            r.id === id && r.status === 'Pending' ? { ...r, ...patch } : r,
          ),
        }),

      // Approve → record it as a project expenditure (NOT an employee advance),
      // mark how the worker was reimbursed, and close the request.
      approveExpenditureRequest: (id, decidedBy, paidMethod, note) => {
        const req = get().expenditureRequests.find((r) => r.id === id);
        if (!req || req.status !== 'Pending') return;
        get().addExpenditure({
          project_id: req.project_id, project_name: req.project_name, date: today(),
          category_id: req.category_id, category_name: req.category_name,
          description: req.note || `${req.employee_name} expense`, amount: req.amount,
          remark: `Reimbursed to ${req.employee_name} (${paidMethod})`, images: null, source: 'worker_request',
        });
        set({
          expenditureRequests: get().expenditureRequests.map((r) =>
            r.id === id
              ? { ...r, status: 'Approved', decided_at: new Date().toISOString(), decided_by: decidedBy, admin_note: note ?? null, paid_method: paidMethod }
              : r,
          ),
        });
      },

      rejectExpenditureRequest: (id, decidedBy, note) =>
        set({
          expenditureRequests: get().expenditureRequests.map((r) =>
            r.id === id && r.status === 'Pending'
              ? { ...r, status: 'Rejected', decided_at: new Date().toISOString(), decided_by: decidedBy, admin_note: note ?? null }
              : r,
          ),
        }),

      addEmployee: (e) => {
        const emps = get().employees;
        const n = emps.length + 1;
        const cleanName = e.name.trim().replace(/\s+/g, '');
        const employee_id = e.employee_id || `${cleanName}_E${n}`;
        const emp: Employee = recomputeEmployee({
          employee_id,
          name: e.name.trim(),
          address: e.address ?? null,
          phone: e.phone ?? null,
          photo: e.photo ?? null,
          daily_wage: Number(e.daily_wage),
          adhar_photo: e.adhar_photo ?? null,
          status: e.status ?? 'Active',
          hourly_rate: hourlyRate(Number(e.daily_wage)),
          upi_id: e.upi_id ?? null,
          pin: e.pin ?? '1234',
          weekly_recovery: e.weekly_recovery ?? 0,
          join_date: e.join_date ?? today(),
          total_salary: 0, salary_given: 0, salary_pending: 0,
          total_advance_given: 0, advance_recovered: 0, advance_pending: 0,
        });
        set({ employees: [...emps, emp] });
        return emp;
      },

      updateEmployee: (id, patch) =>
        set({
          employees: get().employees.map((e) =>
            e.employee_id === id ? recomputeEmployee({ ...e, ...patch }) : e,
          ),
        }),

      deleteEmployee: (id) =>
        set({ employees: get().employees.filter((e) => e.employee_id !== id) }),

      addAttendance: (a) => {
        const { salary_amount, extra_time } = computeAttendanceSalary(a.total_hours, a.daily_wage);
        // Admin-entered rows are posted immediately; self-punch rows pass source/status in.
        const row: Attendance = { source: 'admin', status: 'posted', ...a, id: uid('att_'), salary_amount, extra_time };
        set({ attendance: [row, ...get().attendance] });
      },

      updateAttendance: (id, patch) =>
        set({
          attendance: get().attendance.map((a) => {
            if (a.id !== id) return a;
            const time_in = patch.time_in ?? a.time_in;
            const time_out = patch.time_out ?? a.time_out;
            const lunch = patch.lunch_hours ?? a.lunch_hours ?? 0;
            const gross = time_in && time_out ? hoursBetween(time_in, time_out) : a.total_hours + (a.lunch_hours || 0);
            const net = Math.max(0, gross - lunch);
            const { salary_amount, extra_time } = computeAttendanceSalary(net, a.daily_wage);
            const project_allocations = patch.project_allocations !== undefined ? patch.project_allocations : a.project_allocations;
            return { ...a, date: patch.date ?? a.date, time_in, time_out, total_hours: net, salary_amount, extra_time, lunch_hours: lunch, project_allocations };
          }),
        }),

      deleteAttendance: (id) =>
        set({ attendance: get().attendance.filter((a) => a.id !== id) }),

      // Worker self-service Open Attendance. Creates an open row (no time-out yet)
      // in 'pending' state — the admin reviews & posts it later.
      markIn: (employeeId, loc) => {
        const emp = get().employees.find((e) => e.employee_id === employeeId);
        if (!emp) return { ok: false, msg: 'Employee not found' };
        const day = today();
        // Any still-open punch (any date) blocks a new open — close it first.
        const open = get().attendance.find(
          (a) => a.employee_id === employeeId && !a.time_out && a.status !== 'rejected',
        );
        if (open) return { ok: false, msg: 'You already have an open attendance — close it first.' };
        // One attendance per day: if today's shift is already recorded, no more.
        const todays = get().attendance.find(
          (a) => a.employee_id === employeeId && a.date === day && a.status !== 'rejected',
        );
        if (todays) return { ok: false, msg: 'Attendance is already recorded for today.' };
        const now = new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
        const row: Attendance = {
          id: uid('att_'), date: day, employee_id: employeeId, employee_name: emp.name,
          time_in: now, time_out: null, total_hours: 0, salary_amount: 0,
          daily_wage: emp.daily_wage, ref_names: emp.employee_id, extra_time: 0,
          source: 'employee', status: 'pending',
          open_lat: loc?.lat ?? null, open_lng: loc?.lng ?? null,
        };
        set({ attendance: [row, ...get().attendance] });
        return { ok: true, msg: `Opened attendance at ${now}` };
      },

      // Worker self-service Close Attendance. Closes the most recent open row
      // (any date, so overnight/early-morning shifts still close correctly).
      markOut: (employeeId, loc) => {
        const open = get().attendance
          .filter((a) => a.employee_id === employeeId && !a.time_out && a.status !== 'rejected')
          .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))[0];
        if (!open) return { ok: false, msg: 'You have not opened attendance yet.' };
        const now = new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
        const gross = hoursBetween(open.time_in || now, now);
        const lunch = get().settings.lunch_hours || 0;
        const hrs = Math.round(Math.max(0, gross - lunch) * 100) / 100;
        const { salary_amount, extra_time } = computeAttendanceSalary(hrs, open.daily_wage);
        set({
          attendance: get().attendance.map((a) =>
            a.id === open.id
              ? {
                  ...a, time_out: now, total_hours: hrs, salary_amount, extra_time, lunch_hours: lunch,
                  close_lat: loc?.lat ?? a.close_lat ?? null, close_lng: loc?.lng ?? a.close_lng ?? null,
                }
              : a,
          ),
        });
        return { ok: true, msg: `Closed attendance at ${now} · ${hrs}h (−${lunch}h lunch)` };
      },

      // Admin approves a worker's self-punch → posted (counts for payroll & projects).
      postAttendance: (id, decidedBy) =>
        set({
          attendance: get().attendance.map((a) =>
            a.id === id ? { ...a, status: 'posted', decided_by: decidedBy ?? 'Admin', decided_at: new Date().toISOString(), reject_reason: null } : a,
          ),
        }),

      // Admin rejects a worker's self-punch → kept for the record, never paid.
      rejectAttendance: (id, reason, decidedBy) =>
        set({
          attendance: get().attendance.map((a) =>
            a.id === id ? { ...a, status: 'rejected', reject_reason: reason ?? null, decided_by: decidedBy ?? 'Admin', decided_at: new Date().toISOString() } : a,
          ),
        }),

      giveAdvance: (employeeId, amount, method, note, weeklyRecovery, date) => {
        const emp = get().employees.find((e) => e.employee_id === employeeId);
        if (!emp) return;
        const entry: LedgerEntry = {
          id: uid('led_'), date: date || today(), category: 'Advance_Payment',
          employee_id: employeeId, employee_name: emp.name,
          description: 'Advance_Payment', salary_payment_amount: null,
          advance_payment: amount, advance_recovery: null,
          total_amount_given: amount, salary_id: null,
          remark: note ?? null, old_advance: emp.advance_pending, method,
        };
        set({ ledger: [entry, ...get().ledger] });
        get().updateEmployee(employeeId, {
          total_advance_given: emp.total_advance_given + amount,
          ...(weeklyRecovery != null ? { weekly_recovery: weeklyRecovery } : {}),
        });
      },

      recoverAdvance: (employeeId, amount, note, date) => {
        const emp = get().employees.find((e) => e.employee_id === employeeId);
        if (!emp) return;
        const entry: LedgerEntry = {
          id: uid('led_'), date: date || today(), category: 'Advance_Recovery',
          employee_id: employeeId, employee_name: emp.name,
          description: 'Advance_Recovery', salary_payment_amount: null,
          advance_payment: null, advance_recovery: amount,
          total_amount_given: null, salary_id: null,
          remark: note ?? null, old_advance: emp.advance_pending, method: 'Cash',
        };
        set({ ledger: [entry, ...get().ledger] });
        get().updateEmployee(employeeId, {
          advance_recovered: emp.advance_recovered + amount,
        });
      },

      // Delete a transaction and reverse its effect on the employee's balances.
      deleteLedgerEntry: (id) => {
        const l = get().ledger.find((x) => x.id === id);
        if (!l) return;
        const emp = get().employees.find((e) => e.employee_id === l.employee_id);
        if (emp) {
          if (l.category === 'Advance_Payment') {
            get().updateEmployee(emp.employee_id, { total_advance_given: Math.max(0, emp.total_advance_given - (l.advance_payment || 0)) });
          } else if (l.category === 'Advance_Recovery') {
            get().updateEmployee(emp.employee_id, { advance_recovered: Math.max(0, emp.advance_recovered - (l.advance_recovery || 0)) });
          } else if (l.category === 'Salary') {
            get().updateEmployee(emp.employee_id, { salary_given: Math.max(0, emp.salary_given - (l.salary_payment_amount || 0)) });
          }
        }
        set({ ledger: get().ledger.filter((x) => x.id !== id) });
      },

      createRequest: (r) =>
        set({
          requests: [
            {
              ...r, id: uid('req_'), status: 'Pending',
              created_at: new Date().toISOString(),
              decided_at: null, decided_by: null, admin_note: null,
            },
            ...get().requests,
          ],
        }),

      approveRequest: (id, decidedBy, note) => {
        const req = get().requests.find((r) => r.id === id);
        if (!req || req.status !== 'Pending') return;
        set({
          requests: get().requests.map((r) =>
            r.id === id
              ? { ...r, status: 'Approved', decided_at: new Date().toISOString(), decided_by: decidedBy, admin_note: note ?? null }
              : r,
          ),
        });
        get().giveAdvance(req.employee_id, req.amount, req.method, `Approved request: ${req.reason}`);
      },

      rejectRequest: (id, decidedBy, note) =>
        set({
          requests: get().requests.map((r) =>
            r.id === id
              ? { ...r, status: 'Rejected', decided_at: new Date().toISOString(), decided_by: decidedBy, admin_note: note ?? null }
              : r,
          ),
        }),

      paySalary: (employeeId, amount, salaryId, method, date) => {
        const emp = get().employees.find((e) => e.employee_id === employeeId);
        if (!emp) return;
        const entry: LedgerEntry = {
          id: uid('led_'), date: date || today(), category: 'Salary',
          employee_id: employeeId, employee_name: emp.name,
          description: 'Salary', salary_payment_amount: amount,
          advance_payment: null, advance_recovery: null,
          total_amount_given: amount, salary_id: salaryId,
          remark: null, old_advance: null, method,
        };
        set({ ledger: [entry, ...get().ledger] });
        get().updateEmployee(employeeId, { salary_given: emp.salary_given + amount });
      },

      updateRequest: (id, patch) =>
        set({
          requests: get().requests.map((r) =>
            r.id === id && r.status === 'Pending' ? { ...r, ...patch } : r,
          ),
        }),

      generatePayroll: (from, to) => {
        const attendance = get().attendance;
        const details: SalaryDetail[] = [];
        const claimed = new Set<string>();
        get().employees.forEach((e) => {
          const rows = attendance.filter(
            (a) => a.employee_id === e.employee_id && a.date >= from && a.date <= to && !a.paid &&
              a.status !== 'pending' && a.status !== 'rejected', // only approved/legacy days are payable
          );
          const gross = rows.reduce((s, a) => s + a.salary_amount, 0);
          if (rows.length === 0 || gross <= 0) return;
          rows.forEach((a) => claimed.add(a.id));
          details.push({
            id: `${from}_${to}_${e.employee_id}_${uid()}`,
            from_date: from, to_date: to, employee_id: e.employee_id, employee_name: e.name,
            total_hours: rows.reduce((s, a) => s + a.total_hours, 0),
            salary_amount: gross, daily_wage: e.daily_wage,
            extra_time: rows.reduce((s, a) => s + a.extra_time, 0),
            advance_recovered: 0, salary_given: 0, salary_pending: gross,
            from_to: `${fmtDate(from)} → ${fmtDate(to)}`,
          });
        });
        if (details.length === 0) return null;
        const posting: SalaryPosting = {
          id: uid('sp_'), from_date: from, to_date: to, submitted: true, created_at: new Date().toISOString(),
        };
        set({
          attendance: get().attendance.map((a) =>
            claimed.has(a.id) ? { ...a, paid: true, salary_id: posting.id } : a,
          ),
          postings: [posting, ...get().postings],
          salaryDetails: [...details, ...get().salaryDetails],
        });
        // Recognise the earned salary on each employee (paid amount catches up as rows are paid).
        details.forEach((d) => {
          const emp = get().employees.find((e) => e.employee_id === d.employee_id);
          if (emp) get().updateEmployee(d.employee_id, { total_salary: emp.total_salary + d.salary_amount });
        });
        return posting;
      },

      paySalaryDetail: (detailId, recovery, cash, method, payDate) => {
        const d = get().salaryDetails.find((x) => x.id === detailId);
        if (!d) return;
        const emp = get().employees.find((e) => e.employee_id === d.employee_id);
        if (!emp) return;
        const rec = Math.max(0, Math.min(recovery, advancePending(emp)));
        const c = Math.max(0, cash);
        if (rec + c <= 0) return;
        const date = payDate || today();
        const salaryId = `${d.from_date}_${d.to_date}`;
        const entries: LedgerEntry[] = [];
        if (c > 0) entries.push({
          id: uid('led_'), date, category: 'Salary', employee_id: d.employee_id, employee_name: emp.name,
          description: 'Salary', salary_payment_amount: c, advance_payment: null, advance_recovery: null,
          total_amount_given: c, salary_id: salaryId, remark: d.from_to, old_advance: null, method,
        });
        if (rec > 0) entries.push({
          id: uid('led_'), date, category: 'Advance_Recovery', employee_id: d.employee_id, employee_name: emp.name,
          description: 'Advance_Recovery', salary_payment_amount: null, advance_payment: null, advance_recovery: rec,
          total_amount_given: null, salary_id: salaryId, remark: 'Recovered from salary', old_advance: emp.advance_pending, method: 'Cash',
        });
        const newRecovered = d.advance_recovered + rec;
        const newPaid = d.salary_given + c;
        const remaining = Math.max(0, (d.salary_amount - newRecovered) - newPaid);
        set({
          salaryDetails: get().salaryDetails.map((x) =>
            x.id === detailId ? { ...x, advance_recovered: newRecovered, salary_given: newPaid, salary_pending: remaining } : x,
          ),
          ledger: [...entries, ...get().ledger],
        });
        get().updateEmployee(d.employee_id, {
          salary_given: emp.salary_given + c + rec,
          advance_recovered: emp.advance_recovered + rec,
        });
      },

      deletePosting: (postingId) => {
        const details = get().salaryDetails.filter((d) => {
          const p = get().postings.find((x) => x.id === postingId);
          return p && d.from_date === p.from_date && d.to_date === p.to_date;
        });
        const empIds = new Set(details.map((d) => d.employee_id));
        // Release the claimed attendance days back to unpaid.
        set({
          attendance: get().attendance.map((a) => (a.salary_id === postingId ? { ...a, paid: false, salary_id: null } : a)),
          postings: get().postings.filter((p) => p.id !== postingId),
          salaryDetails: get().salaryDetails.filter((d) => !details.includes(d)),
        });
        // Roll back employee totals for this posting.
        details.forEach((d) => {
          const emp = get().employees.find((e) => e.employee_id === d.employee_id);
          if (emp) get().updateEmployee(d.employee_id, {
            total_salary: Math.max(0, emp.total_salary - d.salary_amount),
            salary_given: Math.max(0, emp.salary_given - d.salary_given - d.advance_recovered),
            advance_recovered: Math.max(0, emp.advance_recovered - d.advance_recovered),
          });
        });
        void empIds;
      },

      resetAll: () =>
        set({
          employees: seedEmployees(),
          attendance: seedAttendance(),
          ledger: seedLedger(),
          salaryDetails: seedSalaryDetails(),
          postings: seedPostings(),
          requests: seedAdvanceRequests(),
          projects: seedProjects(),
          expenditureCategories: seedExpenditureCategories(),
          projectExpenditure: seedProjectExpenditure(),
          projectPayments: seedProjectPayments(),
          expenditureRequests: [],
          settings: defaultSettings(),
        }),
    }),
    {
      name: 'boltap-data-v2',
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // First run: hydrate everything from the bundled Excel export.
        if (state.employees.length === 0) { state.resetAll(); return; }
        // Existing install without the projects module yet: seed just those slices.
        if (!state.projects || state.projects.length === 0) {
          state.projects = seedProjects();
          state.expenditureCategories = seedExpenditureCategories();
          state.projectExpenditure = seedProjectExpenditure();
          state.projectPayments = state.projectPayments || seedProjectPayments();
        }
        if (!state.expenditureRequests) state.expenditureRequests = [];
      },
    },
  ),
);
