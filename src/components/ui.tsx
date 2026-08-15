import React from 'react';
import { X } from 'lucide-react';
import { initials } from '../lib/format';

export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', ...p }) => (
  <div className={`card ${className}`} {...p} />
);

export const StatCard: React.FC<{
  label: string; value: string; sub?: string; icon: React.ReactNode; tone?: string;
}> = ({ label, value, sub, icon, tone = 'bg-brand-50 text-brand-600' }) => (
  <Card className="p-4 flex items-center gap-4">
    <div className={`h-12 w-12 rounded-xl grid place-items-center ${tone}`}>{icon}</div>
    <div className="min-w-0">
      <div className="text-xs font-semibold text-slate-500 truncate">{label}</div>
      <div className="text-xl font-extrabold text-slate-800 leading-tight">{value}</div>
      {sub && <div className="text-xs text-slate-400 truncate">{sub}</div>}
    </div>
  </Card>
);

const toneMap: Record<string, string> = {
  green: 'bg-emerald-50 text-emerald-700',
  red: 'bg-rose-50 text-rose-700',
  amber: 'bg-amber-50 text-amber-700',
  slate: 'bg-slate-100 text-slate-600',
  brand: 'bg-brand-50 text-brand-700',
  blue: 'bg-sky-50 text-sky-700',
};

export const Badge: React.FC<{ tone?: keyof typeof toneMap; children: React.ReactNode }> = ({
  tone = 'slate', children,
}) => <span className={`chip ${toneMap[tone]}`}>{children}</span>;

export const Avatar: React.FC<{ name: string; src?: string | null; size?: number }> = ({
  name, src, size = 40,
}) => (
  src ? (
    <img src={src} alt={name} style={{ width: size, height: size }}
      className="rounded-full object-cover ring-2 ring-white shadow-sm" />
  ) : (
    <div style={{ width: size, height: size, fontSize: size * 0.36 }}
      className="rounded-full grid place-items-center bg-gradient-to-br from-brand-400 to-brand-600 text-white font-bold ring-2 ring-white shadow-sm">
      {initials(name)}
    </div>
  )
);

export const Modal: React.FC<{
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean;
}> = ({ open, onClose, title, children, wide }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative card w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'} max-h-[92vh] overflow-y-auto rounded-b-none sm:rounded-2xl animate-[slideup_.2s_ease]`}>
        <div className="flex items-center justify-between p-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <h3 className="font-bold text-slate-800">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
            <X size={18} />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
      <style>{`@keyframes slideup{from{transform:translateY(16px);opacity:.6}to{transform:translateY(0);opacity:1}}`}</style>
    </div>
  );
};

export const EmptyState: React.FC<{ icon?: React.ReactNode; title: string; hint?: string }> = ({
  icon, title, hint,
}) => (
  <div className="text-center py-14 text-slate-400">
    {icon && <div className="mx-auto mb-3 opacity-60">{icon}</div>}
    <div className="font-semibold text-slate-500">{title}</div>
    {hint && <div className="text-sm mt-1">{hint}</div>}
  </div>
);

export const Field: React.FC<{ label: string; children: React.ReactNode; hint?: string }> = ({
  label, children, hint,
}) => (
  <div>
    <label className="label">{label}</label>
    {children}
    {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
  </div>
);

export const StatusDot: React.FC<{ active: boolean }> = ({ active }) => (
  <span className={`inline-block h-2 w-2 rounded-full ${active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
);
