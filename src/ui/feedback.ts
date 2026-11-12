/**
 * Answer feedback by sound and vibration. Both are on by default and each
 * has its own switch in Settings. Tones are generated in the browser with the Web Audio API,
 * so there are no audio files and nothing to license. Browsers only allow sound after a tap,
 * and an answer is always one, so the audio context starts on the first answer.
 */

export type FeedbackKind = "right" | "wrong" | "finish";

export type FeedbackPrefs = { soundOn?: boolean | null; vibrationOn?: boolean | null };

type Note = { freq: number; at: number; length: number; type: OscillatorType; gain: number };

/** Short and quiet: a light rising chime, a low soft tone, a small three-note close. */
export const TONES: Record<FeedbackKind, Note[]> = {
  right: [
    { freq: 659.25, at: 0, length: 0.09, type: "sine", gain: 0.07 },
    { freq: 880, at: 0.07, length: 0.14, type: "sine", gain: 0.07 },
  ],
  wrong: [
    { freq: 233.08, at: 0, length: 0.12, type: "triangle", gain: 0.08 },
    { freq: 196, at: 0.1, length: 0.2, type: "triangle", gain: 0.08 },
  ],
  finish: [
    { freq: 523.25, at: 0, length: 0.12, type: "sine", gain: 0.06 },
    { freq: 659.25, at: 0.09, length: 0.12, type: "sine", gain: 0.06 },
    { freq: 783.99, at: 0.18, length: 0.24, type: "sine", gain: 0.06 },
  ],
};

/** Vibration patterns in milliseconds; a phone that cannot vibrate ignores them. */
export const VIBRATIONS: Record<FeedbackKind, number | number[]> = {
  right: 12,
  wrong: [24, 60, 24],
  finish: [16, 50, 16],
};

let context: AudioContext | null = null;

function audio(): AudioContext | null {
  if (context) return context;
  const Ctor =
    typeof window === "undefined"
      ? undefined
      : (window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
  if (!Ctor) return null;
  try {
    context = new Ctor();
  } catch {
    return null;
  }
  return context;
}

export function playTone(kind: FeedbackKind): void {
  const ctx = audio();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();
  const start = ctx.currentTime + 0.01;
  for (const note of TONES[kind]) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = note.type;
    osc.frequency.value = note.freq;
    // A short attack and an exponential release, so notes never click.
    const t0 = start + note.at;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(note.gain, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + note.length);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + note.length + 0.02);
  }
}

export function vibrate(kind: FeedbackKind): void {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(VIBRATIONS[kind]);
  } catch {
    // Some browsers throw when vibration is blocked; feedback is optional.
  }
}

/** Plays the tone and the vibration the learner has switched on (both on when unset). */
export function feedback(kind: FeedbackKind, prefs: FeedbackPrefs): void {
  if (prefs.soundOn !== false) playTone(kind);
  if (prefs.vibrationOn !== false) vibrate(kind);
}

/** For tests: forget the audio context so the next call creates a new one. */
export function resetFeedbackForTests(): void {
  context = null;
}
