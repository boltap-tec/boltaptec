import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, CalendarClock, Wallet, HandCoins,
  BookOpen, Settings as SettingsIcon, LogOut, Bell, Zap, Home, History, RefreshCw, Briefcase, Receipt, ClipboardList,
} from 'lucide-react';
import { useAuth } from '../store/useAuth';
import { useData } from '../store/useData';
import { cloudEnabled, pullAll } from '../lib/cloud';
import { beep } from '../lib/alarm';
import { today } from '../lib/format';
import { usePrefs } from '../store/usePrefs';
import { useT, LANGUAGES } from '../lib/i18n';
import { Avatar } from './ui';
import { Languages, Volume2, VolumeX } from 'lucide-react';

// Per-user Preferences: language + sounds. Saved on this device only.
const PreferencesControl: React.FC = () => {
  const [open, setOpen] = React.useState(false);
  const { lang, sound, setLang, setSound } = usePrefs();
  const t = useT();
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100" title={t('pref.title')}>
        <Languages size={18} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 w-60 bg-white rounded-xl shadow-lg border border-slate-100 z-50 overflow-hidden">
            <div className="px-3 py-2 text-xs font-bold text-slate-400 border-b border-slate-50">{t('pref.title')}</div>
            <div className="p-3 space-y-3">
              <div>
                <div className="text-xs font-semibold text-slate-500 mb-1.5">{t('pref.language')}</div>
                <div className="grid grid-cols-2 gap-2">
                  {LANGUAGES.map((l) => (
                    <button key={l.code} onClick={() => setLang(l.code)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${lang === l.code ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{l.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-500 mb-1.5">{t('pref.sound')} <span className="text-slate-400 font-normal">· {t('pref.soundHint')}</span></div>
                <button onClick={() => setSound(!sound)}
                  className={`w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold ${sound ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  {sound ? <Volume2 size={16} /> : <VolumeX size={16} />} {sound ? t('pref.on') : t('pref.off')}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// "Today's Work" — admin picks the active project for the day; it becomes the
// default project for attendance and worker expense requests.
const TodayPlan: React.FC = () => {
  const [open, setOpen] = React.useState(false);
  const projects = useData((s) => s.projects);
  const settings = useData((s) => s.settings);
  const setTodayPlan = useData((s) => s.setTodayPlan);
  const running = projects.filter((p) => p.status === 'Running');
  const activeId = settings.today_plan_date === today() ? settings.today_project_id : null;
  const activeName = activeId ? settings.today_project_name : null;
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold max-w-[160px] ${activeName ? 'bg-brand-50 text-brand-700' : 'text-slate-500 hover:bg-slate-100'}`}
        title="Today's work (default project)">
        <ClipboardList size={15} className="shrink-0" />
        <span className="truncate">{activeName || "Today's work"}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 w-64 bg-white rounded-xl shadow-lg border border-slate-100 z-50 overflow-hidden">
            <div className="px-3 py-2 text-xs font-bold text-slate-400 border-b border-slate-50">Today's work — pick the project</div>
            <div className="max-h-64 overflow-y-auto">
              {running.length === 0 ? (
                <div className="px-3 py-3 text-sm text-slate-400">No running projects.</div>
              ) : running.map((p) => (
                <button key={p.project_id} onClick={() => { setTodayPlan(p.project_id); setOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 ${p.project_id === activeId ? 'text-brand-600 font-semibold' : 'text-slate-700'}`}>
                  {p.name}{p.project_id === activeId ? ' ✓' : ''}
                </button>
              ))}
            </div>
            {activeId && (
              <button onClick={() => { setTodayPlan(null); setOpen(false); }} className="w-full text-left px-3 py-2 text-sm text-rose-500 border-t border-slate-50 hover:bg-rose-50">Clear today's work</button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

// Admin bell: shows pending approvals and links straight to them.
const NotificationBell: React.FC<{ attn: number; adv: number; exp: number }> = ({ attn, adv, exp }) => {
  const [open, setOpen] = React.useState(false);
  const navigate = useNavigate();
  const total = attn + adv + exp;
  const go = (to: string) => { setOpen(false); navigate(to); };
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="relative p-2 text-slate-500 hover:bg-slate-100 rounded-lg" title="Notifications">
        <Bell size={19} />
        {total > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 bg-rose-500 text-white text-[9px] font-bold grid place-items-center rounded-full">{total}</span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 w-64 bg-white rounded-xl shadow-lg border border-slate-100 z-50 overflow-hidden">
            <div className="px-3 py-2 text-xs font-bold text-slate-400 border-b border-slate-50">Notifications</div>
            {total === 0 ? (
              <div className="px-3 py-4 text-sm text-slate-400 text-center">All clear 🎉</div>
            ) : (
              <>
                {attn > 0 && (
                  <button onClick={() => go('/attendance')} className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-slate-50 text-left text-sm">
                    <span className="h-8 w-8 rounded-lg bg-amber-100 text-amber-600 grid place-items-center"><CalendarClock size={16} /></span>
                    <span className="flex-1 text-slate-700"><b>{attn}</b> attendance to approve</span>
                  </button>
                )}
                {adv > 0 && (
                  <button onClick={() => go('/advances')} className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-slate-50 text-left text-sm">
                    <span className="h-8 w-8 rounded-lg bg-brand-100 text-brand-600 grid place-items-center"><HandCoins size={16} /></span>
                    <span className="flex-1 text-slate-700"><b>{adv}</b> advance request{adv > 1 ? 's' : ''}</span>
                  </button>
                )}
                {exp > 0 && (
                  <button onClick={() => go('/project-expense')} className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-slate-50 text-left text-sm">
                    <span className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-600 grid place-items-center"><Receipt size={16} /></span>
                    <span className="flex-1 text-slate-700"><b>{exp}</b> project expense{exp > 1 ? 's' : ''}</span>
                  </button>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};

const adminNav = [
  { to: '/', label: 'nav.dashboard', icon: LayoutDashboard },
  { to: '/employees', label: 'nav.employees', icon: Users },
  { to: '/attendance', label: 'nav.attendance', icon: CalendarClock },
  { to: '/projects', label: 'nav.projects', icon: Briefcase },
  { to: '/project-expense', label: 'nav.projectExpense', icon: Receipt },
  { to: '/salary', label: 'nav.salary', icon: Wallet },
  { to: '/advances', label: 'nav.advances', icon: HandCoins },
  { to: '/ledger', label: 'nav.ledger', icon: BookOpen },
  { to: '/settings', label: 'nav.settings', icon: SettingsIcon },
];

const workerNav = [
  { to: '/me', label: 'nav.myMoney', icon: Home },
  { to: '/project-expense', label: 'nav.projectExpense', icon: Receipt },
  { to: '/advances', label: 'nav.advances', icon: HandCoins },
  { to: '/my-history', label: 'nav.history', icon: History },
];

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const t = useT();
  const brandName = useData((s) => s.settings.business_name?.trim() || 'BoltAp');
  const logo = useData((s) => s.settings.logo || null);
  const pendingReqs = useData((s) => s.requests.filter((r) => r.status === 'Pending').length);
  const pendingAtt = useData((s) => s.attendance.filter((a) => a.status === 'pending').length);
  const pendingExp = useData((s) => s.expenditureRequests.filter((r) => r.status === 'Pending').length);
  const isAdmin = session?.role === 'admin';
  const totalAlerts = isAdmin ? pendingReqs + pendingAtt + pendingExp : 0;

  // Sound an alarm when a new approval request arrives (not on first load).
  const prevAlerts = React.useRef(0);
  const inited = React.useRef(false);
  React.useEffect(() => {
    if (isAdmin && inited.current && totalAlerts > prevAlerts.current && usePrefs.getState().sound) beep();
    inited.current = true;
    prevAlerts.current = totalAlerts;
  }, [totalAlerts, isAdmin]);

  const items = isAdmin ? adminNav : workerNav;
  const mobileItems = isAdmin ? items.slice(0, 5) : items;

  const [refreshing, setRefreshing] = React.useState(false);
  const [toast, setToast] = React.useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500); };

  // Pull the latest data from the cloud on demand (e.g. to see a worker's just-closed attendance).
  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      if (cloudEnabled) { await pullAll(); flash('✓ Data refreshed from cloud'); }
      else flash('Local mode — data is already up to date on this device');
    } catch (e: any) {
      flash('⚠️ ' + (e?.message || 'Refresh failed — check your connection'));
    } finally { setRefreshing(false); }
  };

  const doLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="min-h-full flex">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex w-64 flex-col bg-white border-r border-slate-100 fixed inset-y-0">
        <div className="h-16 flex items-center gap-2 px-5 border-b border-slate-100">
          <div className="h-9 w-9 rounded-xl bg-brand-600 grid place-items-center text-white overflow-hidden shrink-0">
            {logo ? <img src={logo} alt="" className="h-full w-full object-cover" /> : <Zap size={20} fill="white" />}
          </div>
          <div className="min-w-0">
            <div className="font-extrabold text-slate-800 leading-tight truncate">{brandName}</div>
            <div className="text-[10px] text-slate-400 font-medium">Workforce Manager</div>
          </div>
          <div className="ml-auto flex items-center gap-0.5">
            <PreferencesControl />
            {isAdmin && <NotificationBell attn={pendingAtt} adv={pendingReqs} exp={pendingExp} />}
            <button onClick={refresh} disabled={refreshing} title="Refresh data"
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-50">
              <RefreshCw size={17} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
        {isAdmin && (
          <div className="px-4 py-2 border-b border-slate-100">
            <TodayPlan />
          </div>
        )}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {items.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
                  isActive ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                }`}>
              <n.icon size={19} />
              <span>{t(n.label)}</span>
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
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-brand-600 grid place-items-center text-white overflow-hidden shrink-0">
              {logo ? <img src={logo} alt="" className="h-full w-full object-cover" /> : <Zap size={17} fill="white" />}
            </div>
            <span className="font-extrabold text-slate-800 truncate">{brandName}</span>
          </div>
          <div className="flex items-center gap-1">
            {isAdmin && <TodayPlan />}
            <PreferencesControl />
            <button onClick={refresh} disabled={refreshing} className="p-2 text-slate-500 disabled:opacity-50" title="Refresh data">
              <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
            </button>
            {isAdmin && <NotificationBell attn={pendingAtt} adv={pendingReqs} exp={pendingExp} />}
            <button onClick={doLogout} className="p-2 text-slate-500"><LogOut size={18} /></button>
          </div>
        </header>

        {toast && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 rounded-xl bg-slate-800 text-white text-sm font-semibold px-4 py-2.5 shadow-lg">
            {toast}
          </div>
        )}

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
              <span>{t(n.label)}</span>
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
