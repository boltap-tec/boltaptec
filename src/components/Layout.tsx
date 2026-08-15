import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, CalendarClock, Wallet, HandCoins,
  BookOpen, Settings as SettingsIcon, LogOut, Bell, Zap, Home, History,
} from 'lucide-react';
import { useAuth } from '../store/useAuth';
import { useData } from '../store/useData';
import { Avatar } from './ui';

const adminNav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/employees', label: 'Employees', icon: Users },
  { to: '/attendance', label: 'Attendance', icon: CalendarClock },
  { to: '/salary', label: 'Salary', icon: Wallet },
  { to: '/advances', label: 'Advances', icon: HandCoins },
  { to: '/ledger', label: 'Ledger', icon: BookOpen },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

const workerNav = [
  { to: '/me', label: 'My Money', icon: Home },
  { to: '/advances', label: 'Advances', icon: HandCoins },
  { to: '/my-history', label: 'History', icon: History },
];

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const pendingReqs = useData((s) => s.requests.filter((r) => r.status === 'Pending').length);
  const isAdmin = session?.role === 'admin';

  const items = isAdmin ? adminNav : workerNav;
  const mobileItems = isAdmin ? items.slice(0, 5) : items;

  const doLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="min-h-full flex">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex w-64 flex-col bg-white border-r border-slate-100 fixed inset-y-0">
        <div className="h-16 flex items-center gap-2 px-5 border-b border-slate-100">
          <div className="h-9 w-9 rounded-xl bg-brand-600 grid place-items-center text-white">
            <Zap size={20} fill="white" />
          </div>
          <div>
            <div className="font-extrabold text-slate-800 leading-tight">BoltAp</div>
            <div className="text-[10px] text-slate-400 font-medium">Workforce Manager</div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {items.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
                  isActive ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                }`}>
              <n.icon size={19} />
              <span>{n.label}</span>
              {isAdmin && n.to === '/advances' && pendingReqs > 0 && (
                <span className="ml-auto bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {pendingReqs}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-100">
          <div className="flex items-center gap-3 px-2 py-2">
            <Avatar name={session?.name || 'U'} size={36} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-slate-700 truncate">{session?.name}</div>
              <div className="text-[11px] text-slate-400 capitalize">{session?.role}</div>
            </div>
            <button onClick={doLogout} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500" title="Logout">
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 md:ml-64 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="md:hidden h-14 flex items-center justify-between px-4 bg-white border-b border-slate-100 sticky top-0 z-30">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-brand-600 grid place-items-center text-white">
              <Zap size={17} fill="white" />
            </div>
            <span className="font-extrabold text-slate-800">BoltAp</span>
          </div>
          <div className="flex items-center gap-1">
            <button className="relative p-2 text-slate-500">
              <Bell size={19} />
              {isAdmin && pendingReqs > 0 && (
                <span className="absolute top-1 right-1 h-4 w-4 bg-rose-500 text-white text-[9px] font-bold grid place-items-center rounded-full">
                  {pendingReqs}
                </span>
              )}
            </button>
            <button onClick={doLogout} className="p-2 text-slate-500"><LogOut size={18} /></button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 pb-24 md:pb-6 max-w-6xl w-full mx-auto">{children}</main>

        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-100 flex justify-around pb-safe z-30">
          {mobileItems.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2 px-2 flex-1 text-[10px] font-semibold relative ${
                  isActive ? 'text-brand-600' : 'text-slate-400'
                }`}>
              <n.icon size={21} />
              <span>{n.label}</span>
              {isAdmin && n.to === '/advances' && pendingReqs > 0 && (
                <span className="absolute top-1 right-1/4 h-3.5 w-3.5 bg-rose-500 text-white text-[8px] font-bold grid place-items-center rounded-full">
                  {pendingReqs}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
};
