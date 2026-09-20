import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, Wallet, HandCoins, TrendingUp, ArrowUpRight, Clock, Calendar, TrendingDown, Banknote,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { useData } from '../store/useData';
import { StatCard, Card, Badge, Avatar, EmptyState } from '../components/ui';
import { inr, fmtDate, fmtDateShort, byDateDesc } from '../lib/format';
import { advancePending } from '../lib/calc';

export const Dashboard: React.FC = () => {
  const { employees, attendance, ledger, requests } = useData();

  const stats = useMemo(() => {
    const active = employees.filter((e) => e.status === 'Active').length;
    const advPending = employees.reduce((s, e) => s + advancePending(e), 0);
    const salPending = employees.reduce((s, e) => s + Math.max(0, e.total_salary - e.salary_given), 0);
    const totalPaid = ledger.reduce((s, l) => s + (l.total_amount_given || l.salary_payment_amount || 0), 0);
    return { active, advPending, salPending, totalPaid };
  }, [employees, ledger]);

  const pending = requests.filter((r) => r.status === 'Pending');

  // last 8 weeks of salary earned from attendance
  const weekly = useMemo(() => {
    const map = new Map<string, number>();
    attendance.forEach((a) => {
      const d = new Date(a.date);
      if (isNaN(d.getTime())) return;
      const wk = new Date(d); wk.setDate(d.getDate() - d.getDay());
      const key = wk.toISOString().slice(0, 10);
      map.set(key, (map.get(key) || 0) + a.salary_amount);
    });
    return [...map.entries()].sort().slice(-8).map(([k, v]) => ({ week: fmtDateShort(k), amount: Math.round(v) }));
  }, [attendance]);

  const topAdvance = useMemo(
    () => [...employees].map((e) => ({ ...e, ap: advancePending(e) }))
      .filter((e) => e.ap > 0).sort((a, b) => b.ap - a.ap).slice(0, 5),
    [employees],
  );

  // Group ledger rows by date (newest day on top), like the Attendance ledger.
  const groupByDate = (rows: typeof ledger) => {
    const m = new Map<string, typeof ledger>();
    rows.forEach((l) => { if (!m.has(l.date)) m.set(l.date, [] as any); (m.get(l.date) as any).push(l); });
    return [...m.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 6);
  };
  // Advances (given + recovered) and Salary each get their own date-grouped card.
  const advGroups = useMemo(() => groupByDate([...ledger].filter((l) => l.category !== 'Salary').sort(byDateDesc)), [ledger]);
  const salGroups = useMemo(() => groupByDate([...ledger].filter((l) => l.category === 'Salary').sort(byDateDesc)), [ledger]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">Dashboard</h1>
          <p className="text-slate-400 text-sm">Overview of your workforce & finances</p>
        </div>
        <Link to="/attendance" className="btn-primary hidden sm:inline-flex">
          <Clock size={17} /> Mark Attendance
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Employees" value={String(employees.length)} sub={`${stats.active} active`}
          icon={<Users size={22} />} />
        <StatCard label="Salary Pending" value={inr(stats.salPending)} tone="bg-amber-50 text-amber-600"
          icon={<Wallet size={22} />} />
        <StatCard label="Advance Pending" value={inr(stats.advPending)} tone="bg-rose-50 text-rose-600"
          icon={<HandCoins size={22} />} />
        <StatCard label="Total Paid Out" value={inr(stats.totalPaid)} tone="bg-emerald-50 text-emerald-600"
          icon={<TrendingUp size={22} />} />
      </div>

      {pending.length > 0 && (
        <Card className="p-4 border-l-4 border-l-rose-500 bg-rose-50/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-rose-100 text-rose-600 grid place-items-center">
                <HandCoins size={20} />
              </div>
              <div>
                <div className="font-bold text-slate-800">{pending.length} advance request{pending.length > 1 ? 's' : ''} awaiting approval</div>
                <div className="text-sm text-slate-500">{inr(pending.reduce((s, r) => s + r.amount, 0))} total requested</div>
              </div>
            </div>
            <Link to="/advances" className="btn-danger text-sm">Review <ArrowUpRight size={16} /></Link>
          </div>
        </Card>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="p-4 lg:col-span-2">
          <h3 className="font-bold text-slate-800 mb-3">Weekly Salary Earned</h3>
          <div className="h-56">
            {weekly.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weekly} margin={{ left: -18, right: 8, top: 4 }}>
                  <defs>
                    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef0f6" vertical={false} />
                  <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => `${v / 1000}k`} />
                  <Tooltip formatter={(v: any) => inr(Number(v))} contentStyle={{ borderRadius: 12, border: '1px solid #eef0f6', fontSize: 12 }} />
                  <Area type="monotone" dataKey="amount" stroke="#6366f1" strokeWidth={2.5} fill="url(#g)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : <EmptyState title="No attendance data yet" />}
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-bold text-slate-800 mb-3">Highest Advance Pending</h3>
          {topAdvance.length ? (
            <div className="space-y-3">
              {topAdvance.map((e) => (
                <Link to={`/employees/${e.employee_id}`} key={e.employee_id} className="flex items-center gap-3 group">
                  <Avatar name={e.name} src={e.photo} size={36} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-700 truncate group-hover:text-brand-600">{e.name}</div>
                    <div className="h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
                      <div className="h-full bg-rose-400 rounded-full"
                        style={{ width: `${Math.min(100, (e.ap / topAdvance[0].ap) * 100)}%` }} />
                    </div>
                  </div>
                  <span className="text-sm font-bold text-rose-600">{inr(e.ap)}</span>
                </Link>
              ))}
            </div>
          ) : <EmptyState title="No pending advances" />}
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Advances given & recovered — date-grouped */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-slate-800 flex items-center gap-2"><HandCoins size={17} className="text-amber-500" /> Advances</h3>
            <Link to="/advances" className="text-sm font-semibold text-brand-600">View all</Link>
          </div>
          {advGroups.length ? (
            <div className="space-y-4">
              {advGroups.map(([d, list]) => {
                const given = list.reduce((s, l) => s + (l.category === 'Advance_Payment' ? (l.advance_payment || 0) : 0), 0);
                const recovered = list.reduce((s, l) => s + (l.category === 'Advance_Recovery' ? (l.advance_recovery || 0) : 0), 0);
                const net = given - recovered;
                return (
                  <Card key={d} className="overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                      <div className="flex items-center gap-2 font-bold text-slate-700 text-sm">
                        <Calendar size={16} className="text-brand-500" /> {fmtDate(d)}
                        <Badge tone="brand">{list.length}</Badge>
                      </div>
                      <span className={`text-sm font-bold ${net < 0 ? 'text-sky-600' : 'text-amber-600'}`}>{net < 0 ? `− ${inr(-net)}` : inr(net)}</span>
                    </div>
                    <div className="divide-y divide-slate-50">
                      {list.map((l) => {
                        const isGiven = l.category === 'Advance_Payment';
                        const amt = isGiven ? (l.advance_payment || 0) : (l.advance_recovery || 0);
                        return (
                          <div key={l.id} className="flex items-center gap-3 px-4 py-2.5">
                            <div className={`h-9 w-9 rounded-lg grid place-items-center ${isGiven ? 'bg-amber-50 text-amber-500' : 'bg-sky-50 text-sky-500'}`}>
                              {isGiven ? <HandCoins size={16} /> : <TrendingDown size={16} />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-slate-700 truncate">{l.employee_name}</div>
                              <div className="text-xs text-slate-400">{isGiven ? 'Advance given' : 'Recovered'} · {l.method || 'Cash'}</div>
                            </div>
                            <span className={`text-sm font-bold ${isGiven ? 'text-amber-600' : 'text-sky-600'}`}>{isGiven ? '' : '− '}{inr(amt)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : <Card className="p-4"><EmptyState title="No advances yet" /></Card>}
        </div>

        {/* Salary paid — date-grouped */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-slate-800 flex items-center gap-2"><Banknote size={17} className="text-emerald-500" /> Salary Paid</h3>
            <Link to="/ledger" className="text-sm font-semibold text-brand-600">View all</Link>
          </div>
          {salGroups.length ? (
            <div className="space-y-4">
              {salGroups.map(([d, list]) => {
                const total = list.reduce((s, l) => s + (l.salary_payment_amount || 0), 0);
                return (
                  <Card key={d} className="overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                      <div className="flex items-center gap-2 font-bold text-slate-700 text-sm">
                        <Calendar size={16} className="text-brand-500" /> {fmtDate(d)}
                        <Badge tone="brand">{list.length}</Badge>
                      </div>
                      <span className="text-sm font-bold text-emerald-600">{inr(total)}</span>
                    </div>
                    <div className="divide-y divide-slate-50">
                      {list.map((l) => (
                        <div key={l.id} className="flex items-center gap-3 px-4 py-2.5">
                          <div className="h-9 w-9 rounded-lg bg-emerald-50 text-emerald-500 grid place-items-center"><Banknote size={16} /></div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-slate-700 truncate">{l.employee_name}</div>
                            <div className="text-xs text-slate-400">Salary · {l.method || 'Cash'}</div>
                          </div>
                          <span className="text-sm font-bold text-emerald-600">{inr(l.salary_payment_amount || 0)}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : <Card className="p-4"><EmptyState title="No salary paid yet" /></Card>}
        </div>
      </div>
    </div>
  );
};
