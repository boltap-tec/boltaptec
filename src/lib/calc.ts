import type { Attendance, Employee } from '../types';

export const STANDARD_HOURS = 8;

export const hourlyRate = (dailyWage: number): number => dailyWage / STANDARD_HOURS;

// Given hours worked + daily wage, compute earned salary and overtime hours.
export const computeAttendanceSalary = (hours: number, dailyWage: number) => {
  const rate = hourlyRate(dailyWage);
  const salary = Math.round(hours * rate);
  const extra = Math.max(0, hours - STANDARD_HOURS);
  return { salary_amount: salary, extra_time: extra, hourly_rate: rate };
};

// Parse "10:33 am" / "1:55 pm" style strings into minutes from midnight.
export const parseClock = (s: string | null | undefined): number | null => {
  if (!s) return null;
  const m = s.trim().replace(/ /g, ' ').match(/^(\d{1,2}):(\d{2})\s*([ap]m)?$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const ap = m[3]?.toLowerCase();
  if (ap === 'pm' && h < 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  return h * 60 + min;
};

// Hours between time-in and time-out; handles overnight shifts (out < in).
export const hoursBetween = (timeIn: string, timeOut: string): number => {
  const a = parseClock(timeIn);
  const b = parseClock(timeOut);
  if (a == null || b == null) return 0;
  let diff = b - a;
  if (diff < 0) diff += 24 * 60; // crossed midnight
  return Math.round((diff / 60) * 100) / 100;
};

export const advancePending = (e: Pick<Employee, 'total_advance_given' | 'advance_recovered'>) =>
  Math.max(0, (e.total_advance_given || 0) - (e.advance_recovered || 0));

export const salaryPending = (e: Pick<Employee, 'total_salary' | 'salary_given'>) =>
  Math.max(0, (e.total_salary || 0) - (e.salary_given || 0));

// Sum attendance rows for one employee within a date range (inclusive).
// When onlyUnpaid is true, rows already paid in a prior payroll are excluded —
// this prevents paying the same days twice when the date range overlaps.
export const salaryForPeriod = (
  rows: Attendance[],
  employeeId: string,
  from: string,
  to: string,
  onlyUnpaid = false,
) => {
  const inRange = rows.filter(
    r => r.employee_id === employeeId && r.date >= from && r.date <= to &&
      (!onlyUnpaid || !r.paid),
  );
  const total_hours = inRange.reduce((s, r) => s + (r.total_hours || 0), 0);
  const salary_amount = inRange.reduce((s, r) => s + (r.salary_amount || 0), 0);
  const extra_time = inRange.reduce((s, r) => s + (r.extra_time || 0), 0);
  const days = inRange.length;
  return { total_hours, salary_amount, extra_time, days };
};
