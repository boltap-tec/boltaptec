// Fingerprint / biometric unlock via the WebAuthn platform authenticator
// (Windows Hello, Android fingerprint, Touch ID). Used as a device-unlock gate
// that replaces typing the PIN for an already-identified user.
//
// On the packaged Android APK you can swap this for a native biometric plugin;
// the calling code (Login) stays the same.

const KEY_PREFIX = 'boltap-bio-';

export const biometricSupported = async (): Promise<boolean> => {
  try {
    // @ts-ignore
    if (!window.PublicKeyCredential) return false;
    // @ts-ignore
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch { return false; }
};

const rand = () => crypto.getRandomValues(new Uint8Array(32));

// Enroll (first time) then verify the fingerprint for a given userId.
export const biometricUnlock = async (userId: string, label: string): Promise<boolean> => {
  const supported = await biometricSupported();
  if (!supported) throw new Error('No fingerprint hardware on this device.');
  const storeKey = KEY_PREFIX + userId;
  const existing = localStorage.getItem(storeKey);
  try {
    if (!existing) {
      // Register a platform credential bound to this device + user.
      const cred: any = await navigator.credentials.create({
        publicKey: {
          challenge: rand(),
          rp: { name: 'Boltaptec' },
          user: { id: new TextEncoder().encode(userId), name: label, displayName: label },
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
          authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
          timeout: 60000,
        },
      });
      if (!cred) return false;
      const id = btoa(String.fromCharCode(...new Uint8Array(cred.rawId)));
      localStorage.setItem(storeKey, id);
      return true; // registration already required a fingerprint
    }
    // Verify against the stored credential.
    const raw = Uint8Array.from(atob(existing), (c) => c.charCodeAt(0));
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: rand(),
        allowCredentials: [{ type: 'public-key', id: raw }],
        userVerification: 'required',
        timeout: 60000,
      },
    });
    return !!assertion;
  } catch (e: any) {
    if (e?.name === 'NotAllowedError') return false; // user cancelled
    throw e;
  }
};
