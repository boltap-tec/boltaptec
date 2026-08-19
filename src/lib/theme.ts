// Light / dark theme preference, stored per-device and persisted until changed.
export type Theme = 'light' | 'dark';

const KEY = 'boltap-theme';

export const getTheme = (): Theme => (localStorage.getItem(KEY) === 'light' ? 'light' : 'dark');

export const applyTheme = (t: Theme): void => {
  document.documentElement.setAttribute('data-theme', t);
};

export const setTheme = (t: Theme): void => {
  localStorage.setItem(KEY, t);
  applyTheme(t);
};

// Call once at startup (before render) so there's no flash of the wrong theme.
export const initTheme = (): void => applyTheme(getTheme());
