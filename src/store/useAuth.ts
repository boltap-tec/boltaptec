import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Session } from '../types';

interface AuthState {
  session: Session | null;
  loginAdmin: (name?: string) => void;
  loginEmployee: (employeeId: string, name: string) => void;
  logout: () => void;
}

// Mock auth for local development. Swap for Supabase Auth later — the Session
// shape (role + employee_id) maps directly onto row-level-security policies.
export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      session: null,
      loginAdmin: (name = 'Admin') => set({ session: { role: 'admin', employee_id: null, name } }),
      loginEmployee: (employeeId, name) =>
        set({ session: { role: 'employee', employee_id: employeeId, name } }),
      logout: () => set({ session: null }),
    }),
    { name: 'boltap-auth-v1' },
  ),
);
