// Geolocation helper for attendance open/close.
export interface Coords { lat: number; lng: number; }

// Ask the browser/device for the current position. Resolves to null when
// permission is denied, unavailable, or times out — the caller decides whether
// location is compulsory (see Settings.location_required).
export function getLocation(timeoutMs = 8000): Promise<Coords | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        lat: Math.round(pos.coords.latitude * 1e6) / 1e6,
        lng: Math.round(pos.coords.longitude * 1e6) / 1e6,
      }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60000 },
    );
  });
}

export const hasCoords = (lat?: number | null, lng?: number | null): boolean =>
  typeof lat === 'number' && typeof lng === 'number' && !(lat === 0 && lng === 0);

// A Google Maps link for the admin to view where a punch happened.
export const mapsLink = (lat: number, lng: number): string =>
  `https://www.google.com/maps?q=${lat},${lng}`;

export const fmtCoords = (lat: number, lng: number): string =>
  `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
