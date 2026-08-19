// Small device-local settings that shouldn't go through the cloud sync.

const WA_KEY = 'boltap-wa-number';

// Fixed WhatsApp number (admin's) that payment links / requests are sent to.
export const getWaNumber = (): string => localStorage.getItem(WA_KEY) || '';
export const setWaNumber = (n: string): void => {
  const digits = n.replace(/\D/g, '');
  if (digits) localStorage.setItem(WA_KEY, digits);
  else localStorage.removeItem(WA_KEY);
};
