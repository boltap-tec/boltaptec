import type { Project, ProjectExpenditure, ProjectPayment, Attendance } from '../types';

export const LABOUR_CATEGORY_ID = 'Labour_C1';

export interface ProjectFinance {
  labour: number;        // labour cost (attendance allocations + Labour-category expenditure)
  material: number;      // all non-labour expenditure
  expenditure: number;   // labour + material (Total_Expenditure)
  received: number;      // payments received
  quoted: number;        // amount quoted
  pending: number;       // quoted − received
  profit: number;        // quoted − expenditure
}

// Sum a shift's project allocations (Phase 3) into per-project labour cost.
export const labourFromAttendance = (attendance: Attendance[], projectId: string): number =>
  attendance.reduce((sum, a) => {
    if (a.status === 'rejected') return sum;
    const allocs = a.project_allocations || [];
    return sum + allocs.filter((x) => x.project_id === projectId).reduce((s, x) => s + (x.amount || 0), 0);
  }, 0);

export function projectFinance(
  p: Project,
  expenditure: ProjectExpenditure[],
  payments: ProjectPayment[],
  attendance: Attendance[],
): ProjectFinance {
  const exp = expenditure.filter((e) => e.project_id === p.project_id);
  const labourExp = exp.filter((e) => e.category_id === LABOUR_CATEGORY_ID).reduce((s, e) => s + e.amount, 0);
  const material = exp.filter((e) => e.category_id !== LABOUR_CATEGORY_ID).reduce((s, e) => s + e.amount, 0);
  const labour = labourExp + labourFromAttendance(attendance, p.project_id);
  const received = payments.filter((x) => x.project_id === p.project_id).reduce((s, x) => s + x.amount, 0);
  const expenditureTotal = labour + material;
  return {
    labour,
    material,
    expenditure: expenditureTotal,
    received,
    quoted: p.amount_quoted,
    pending: Math.max(0, p.amount_quoted - received),
    profit: p.amount_quoted - expenditureTotal,
  };
}

// Derive square feet + approximate amount from length/breadth/rate.
export const computeSqft = (length: number | null, breadth: number | null): number =>
  Math.round(((length || 0) * (breadth || 0)) * 100) / 100;

export const computeApprox = (sqft: number, rate: number | null): number =>
  Math.round(sqft * (rate || 0));
