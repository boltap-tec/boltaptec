// Device binding — the practical, privacy-respecting stand-in for "IMEI".
//
// Real IMEI is NOT readable from a browser, and modern Android (10+) blocks
// apps from reading it too. The standard replacement is a stable per-device
// identifier. On the web that's a random ID persisted in storage; in the
// packaged APK you swap getDeviceId() for Capacitor's Device.getId().
//
// Attendance can be marked only from the device bound to the worker's account,
// which gives the same "one worker, one registered phone" guarantee.

const KEY = 'boltap-device-id';

export const getDeviceId = (): string => {
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = 'DEV-' + (crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36)).toUpperCase().replace(/-/g, '').slice(0, 12);
    localStorage.setItem(KEY, id);
  }
  return id;
};

// Short, human-readable form to show in the UI (like a device serial).
export const shortDeviceId = (id: string): string => id.replace('DEV-', '').replace(/(.{4})/g, '$1 ').trim();
