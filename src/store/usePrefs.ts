import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Lang = 'en' | 'ta';

// Per-user, per-device preferences. NOT synced to the cloud — each person
// (admin or a worker on their own phone) picks what's comfortable for them.
interface PrefsState {
  lang: Lang;
  sound: boolean;        // UI click + notification sounds
  ocrKey: string;        // Google Vision API key — stored on THIS device only
  setLang: (l: Lang) => void;
  setSound: (s: boolean) => void;
  setOcrKey: (k: string) => void;
}

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      lang: 'en',
      sound: true,
      ocrKey: '',
      setLang: (lang) => set({ lang }),
      setSound: (sound) => set({ sound }),
      setOcrKey: (ocrKey) => set({ ocrKey }),
    }),
    { name: 'boltap-prefs-v1' },
  ),
);
