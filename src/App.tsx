import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './store/useAuth';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Employees } from './pages/Employees';
import { EmployeeDetail } from './pages/EmployeeDetail';
import { Attendance } from './pages/Attendance';
import { Salary } from './pages/Salary';
import { Advances } from './pages/Advances';
import { Ledger } from './pages/Ledger';
import { Settings } from './pages/Settings';
import { EmployeeHome } from './pages/EmployeeHome';
import { EmployeeHistory } from './pages/EmployeeHistory';
import type { JSX } from 'react';

function Protected({ children, adminOnly }: { children: JSX.Element; adminOnly?: boolean }) {
  const session = useAuth((s) => s.session);
  if (!session) return <Navigate to="/login" replace />;
  if (adminOnly && session.role !== 'admin') return <Navigate to="/me" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  const session = useAuth((s) => s.session);
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={session ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/" element={<Protected adminOnly><Dashboard /></Protected>} />
        <Route path="/employees" element={<Protected adminOnly><Employees /></Protected>} />
        <Route path="/employees/:id" element={<Protected adminOnly><EmployeeDetail /></Protected>} />
        <Route path="/attendance" element={<Protected adminOnly><Attendance /></Protected>} />
        <Route path="/salary" element={<Protected adminOnly><Salary /></Protected>} />
        <Route path="/advances" element={<Protected><Advances /></Protected>} />
        <Route path="/me" element={<Protected><EmployeeHome /></Protected>} />
        <Route path="/my-history" element={<Protected><EmployeeHistory /></Protected>} />
        <Route path="/ledger" element={<Protected adminOnly><Ledger /></Protected>} />
        <Route path="/settings" element={<Protected adminOnly><Settings /></Protected>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
