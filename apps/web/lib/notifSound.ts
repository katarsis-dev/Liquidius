'use client';

/**
 * Web Audio API notification pinger.
 * No binary asset — tone di-generate di runtime pake OscillatorNode.
 * Beda pitch per mode supaya bisa dikenali by ear.
 */

type Mode = 'DEGEN' | 'MEDIUM' | 'SAFE';

const PITCH: Record<Mode, number> = {
  DEGEN: 880, // A5 — urgency
  MEDIUM: 660, // E5 — balanced
  SAFE: 440, // A4 — chill
};

const MUTE_KEY = 'liquidius.notif.muted';
const RATELIMIT_MS = 400; // jangan bunyi lebih rapat dari ini

let ctx: AudioContext | null = null;
let lastPlay = 0;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
    } catch {
      return null;
    }
  }
  // Beberapa browser suspend context sampai user gesture — resume kalau bisa.
  if (ctx.state === 'suspended') ctx.resume().catch(() => undefined);
  return ctx;
}

export function isMuted(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setMuted(v: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(MUTE_KEY, v ? '1' : '0');
  } catch {
    /* ignore quota */
  }
}

export function playAlertSound(mode: Mode): void {
  if (isMuted()) return;
  const now = Date.now();
  if (now - lastPlay < RATELIMIT_MS) return;
  lastPlay = now;

  const audio = getCtx();
  if (!audio) return;

  const pitch = PITCH[mode];
  const t = audio.currentTime;

  // "Ping" 2 note (root + fifth) short, dgn envelope decay natural
  const notes = [pitch, pitch * 1.5];
  notes.forEach((freq, i) => {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t + i * 0.06);
    gain.gain.setValueAtTime(0, t + i * 0.06);
    gain.gain.linearRampToValueAtTime(0.18, t + i * 0.06 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.06 + 0.25);
    osc.connect(gain).connect(audio.destination);
    osc.start(t + i * 0.06);
    osc.stop(t + i * 0.06 + 0.3);
  });
}

/**
 * Priming — panggil sekali di user gesture (mis. klik tombol mute) untuk
 * meng-unlock AudioContext di browser yang butuh gesture.
 */
export function primeAudio(): void {
  const audio = getCtx();
  if (!audio) return;
  if (audio.state === 'suspended') audio.resume().catch(() => undefined);
}
