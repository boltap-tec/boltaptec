import { useData } from '../store/useData';

// Plain confirmation for reversible/minor deletions.
export function confirmAction(message: string): boolean {
  return window.confirm(message);
}

// Password-gated confirmation for high-impact deletions (projects, employees).
// The password is set by the admin in Settings (falls back to the admin PIN).
export function confirmProtected(message: string): boolean {
  const s = useData.getState().settings;
  const pw = (s.delete_password && s.delete_password.trim()) || s.admin_pin || '1234';
  const entered = window.prompt(`${message}\n\nEnter the delete password to confirm:`);
  if (entered === null) return false;              // cancelled
  if (entered.trim() !== pw) { window.alert('Wrong delete password — cancelled.'); return false; }
  return true;
}
