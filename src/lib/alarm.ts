// Small attention beep for new approval requests. Uses the Web Audio API so we
// don't ship an audio file. No-ops if the browser blocks audio before any user
// gesture (the notification badge still updates visually).
let ctx: AudioContext | null = null;

export function beep(times = 2): void {
  try {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ac: AudioContext = ctx || (ctx = new AC());
    const now = ac.currentTime;
    for (let i = 0; i < times; i++) {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      const t = now + i * 0.22;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      osc.connect(gain).connect(ac.destination);
      osc.start(t);
      osc.stop(t + 0.2);
    }
    if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
  } catch { /* ignore — audio not available */ }
}

// Short, quiet UI tap sound for menu/button clicks.
export function tick(): void {
  try {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ac: AudioContext = ctx || (ctx = new AC());
    const t = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'triangle';
    osc.frequency.value = 620;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.09, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    osc.connect(gain).connect(ac.destination);
    osc.start(t);
    osc.stop(t + 0.07);
  } catch { /* ignore */ }
}
