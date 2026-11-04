/**
 * The demo video's music: an original upbeat track, made by this script, dedicated to the
 * public domain (CC0). 120 beats a minute, so a bar is two seconds and the video's cuts land
 * on bar lines. Plain synthesis, no samples: drums from noise and sine sweeps, a bass, a pad,
 * a plucked arpeggio and a small reverb. Deterministic: the same file every run.
 *
 * Usage: node scripts/demo/music.ts [out.wav]   (default test-results/demo/music.wav)
 *
 * Form, in bars: 0 to 1 intro (pad and a filtered arpeggio, a riser into bar 2), 2 to 15 the
 * groove, 16 to 17 a lighter break with a riser, 18 to 28 the groove again, 29 to 30 the end
 * (drums stop, the last chord rings).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const SR = 44_100;
const BPM = 120;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const BARS = 31;
const LENGTH = BARS * BAR + 3;
const N = Math.ceil(LENGTH * SR);

const left = new Float32Array(N);
const right = new Float32Array(N);
const reverbSend = new Float32Array(N);
const sidechain = new Float32Array(N).fill(1);

// Seeded noise, so every run writes the same file.
let seed = 0x2f6a4f;
const noise = () => {
  seed = (seed * 1_664_525 + 1_013_904_223) >>> 0;
  return seed / 2 ** 31 - 1;
};

const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);
const at = (seconds: number) => Math.floor(seconds * SR);

/** A sawtooth with polyBLEP smoothing, so high notes do not alias. */
function saw(phase: number, dt: number): number {
  let v = 2 * phase - 1;
  if (phase < dt) {
    const t = phase / dt;
    v -= t + t - t * t - 1;
  } else if (phase > 1 - dt) {
    const t = (phase - 1) / dt;
    v -= t * t + t + t + 1;
  }
  return v;
}

/** A state-variable filter; returns the low-pass and band-pass outputs. */
function svf() {
  let low = 0;
  let band = 0;
  return (input: number, cutoff: number, q = 0.7) => {
    const f = 2 * Math.sin((Math.PI * Math.min(cutoff, SR / 6)) / SR);
    low += f * band;
    const high = input - low - band / q;
    band += f * high;
    return { low, band, high };
  };
}

function add(start: number, samples: Float32Array, gain: number, pan = 0, send = 0) {
  const l = gain * Math.cos(((pan + 1) * Math.PI) / 4);
  const r = gain * Math.sin(((pan + 1) * Math.PI) / 4);
  for (let i = 0; i < samples.length && start + i < N; i++) {
    const v = samples[i] ?? 0;
    left[start + i] = (left[start + i] ?? 0) + v * l;
    right[start + i] = (right[start + i] ?? 0) + v * r;
    reverbSend[start + i] = (reverbSend[start + i] ?? 0) + v * send * gain;
  }
}

// Drums.

function kick(): Float32Array {
  const len = at(0.45);
  const out = new Float32Array(len);
  let phase = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const freq = 52 + 120 * Math.exp(-t * 38);
    phase += freq / SR;
    const body = Math.sin(2 * Math.PI * phase) * Math.exp(-t * 6.5);
    const click = i < 90 ? noise() * (1 - i / 90) * 0.35 : 0;
    out[i] = Math.tanh((body + click) * 1.6);
  }
  return out;
}

function clap(): Float32Array {
  const len = at(0.32);
  const out = new Float32Array(len);
  const filter = svf();
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const bursts = [0, 0.011, 0.022].reduce(
      (n, b) => n + (t >= b ? Math.exp(-(t - b) * (b === 0.022 ? 22 : 180)) : 0),
      0,
    );
    out[i] = filter(noise(), 1500, 1.2).band * bursts * 1.6;
  }
  return out;
}

function hat(open: boolean): Float32Array {
  const len = at(open ? 0.28 : 0.06);
  const out = new Float32Array(len);
  // Noise between two one-pole filters: above 5 kHz, rolled off past 9 kHz.
  const hp = 1 - Math.exp((-2 * Math.PI * 5000) / SR);
  const lp = 1 - Math.exp((-2 * Math.PI * 9000) / SR);
  let low = 0;
  let smooth = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const x = noise();
    low += hp * (x - low);
    smooth += lp * (x - low - smooth);
    out[i] = smooth * 1.6 * Math.exp(-t * (open ? 14 : 70));
  }
  return out;
}

/** White noise rising in pitch and level over a bar: the lift into a drop. */
function riser(seconds: number): Float32Array {
  const len = at(seconds);
  const out = new Float32Array(len);
  const filter = svf();
  for (let i = 0; i < len; i++) {
    const x = i / len;
    out[i] = filter(noise(), 400 + 9000 * x * x, 2).band * x * x;
  }
  return out;
}

const KICK = kick();
const CLAP = clap();
const HAT = hat(false);
const OPEN_HAT = hat(true);

// Harmony: A, E, F sharp minor, D, one bar each.
const CHORDS = [
  { root: 45, voices: [57, 61, 64] },
  { root: 40, voices: [59, 64, 68] },
  { root: 42, voices: [57, 61, 66] },
  { root: 38, voices: [57, 62, 66] },
];
const chordAt = (bar: number) => CHORDS[bar % 4] as (typeof CHORDS)[number];

const groove = (bar: number) => (bar >= 2 && bar <= 15) || (bar >= 18 && bar <= 28);
const lightBreak = (bar: number) => bar === 16 || bar === 17;

// Drums and sidechain.
for (let bar = 0; bar < BARS; bar++) {
  const t0 = bar * BAR;
  for (let beat = 0; beat < 4; beat++) {
    const t = t0 + beat * BEAT;
    if (groove(bar) || (bar === 16 && beat < 2)) {
      add(at(t), KICK, 0.95);
      // The kick ducks the bass and the pad, so the groove breathes.
      for (let i = 0; i < at(0.32) && at(t) + i < N; i++) {
        const x = i / at(0.32);
        sidechain[at(t) + i] = Math.min(sidechain[at(t) + i] ?? 1, 0.25 + 0.75 * x ** 1.6);
      }
    }
    if (groove(bar) && (beat === 1 || beat === 3)) add(at(t), CLAP, 0.42, 0.05, 0.25);
    if (groove(bar) || lightBreak(bar) || bar === 1) {
      add(at(t + BEAT / 2), OPEN_HAT, groove(bar) ? 0.1 : 0.06, 0.25);
      for (const s of [0, 0.25, 0.75]) add(at(t + s * BEAT), HAT, groove(bar) ? 0.07 : 0.04, -0.3);
    }
  }
}
add(at(1 * BAR), riser(BAR), 0.22, 0, 0.3);
add(at(17 * BAR), riser(BAR), 0.26, 0, 0.3);

// Bass: eighths on the root, an octave jump on the last eighth of each beat pair.
{
  const filter = svf();
  let phase = 0;
  for (let bar = 2; bar < 29; bar++) {
    if (lightBreak(bar)) continue;
    const chord = chordAt(bar);
    for (let e = 0; e < 8; e++) {
      const note = chord.root + (e % 4 === 3 ? 12 : 0);
      const start = at(bar * BAR + (e * BEAT) / 2);
      const len = at(BEAT / 2 - 0.02);
      const freq = midi(note);
      for (let i = 0; i < len && start + i < N; i++) {
        const t = i / SR;
        phase = (phase + freq / SR) % 1;
        const env = Math.min(1, t * 400) * Math.exp(-t * 3);
        const raw = saw(phase, freq / SR) * 0.6 + Math.sin(2 * Math.PI * phase) * 0.6;
        const v = filter(raw, 220 + 900 * Math.exp(-t * 18), 0.9).low * env;
        const duck = sidechain[start + i] ?? 1;
        left[start + i] = (left[start + i] ?? 0) + v * 0.42 * duck;
        right[start + i] = (right[start + i] ?? 0) + v * 0.42 * duck;
      }
    }
  }
}

// Pad: detuned saws, held for each bar, through a low-pass that opens in the groove.
for (const side of [-1, 1] as const) {
  const filter = svf();
  const phases = new Float64Array(9);
  for (let bar = 0; bar < BARS; bar++) {
    const chord = chordAt(bar);
    const start = at(bar * BAR);
    const len = at(bar === BARS - 1 ? BAR + 3 : BAR);
    for (let i = 0; i < len && start + i < N; i++) {
      const t = i / SR;
      let v = 0;
      chord.voices.forEach((note, k) => {
        for (let d = 0; d < 3; d++) {
          const index = k * 3 + d;
          const freq = midi(note) * 2 ** (((d - 1) * 7 + side * 3) / 1200);
          phases[index] = ((phases[index] ?? 0) + freq / SR) % 1;
          v += saw(phases[index] ?? 0, freq / SR);
        }
      });
      const open = groove(bar) ? 2200 : bar < 2 ? 700 + 900 * (t / BAR + bar) : 1400;
      const attack = bar === 0 ? Math.min(1, t / 1.5) : 1;
      const tail = bar === BARS - 1 ? Math.exp(-Math.max(0, t - BAR) * 1.6) : 1;
      const duck = groove(bar) ? (sidechain[start + i] ?? 1) : 1;
      const out = filter(v / 9, open, 0.8).low * attack * tail * duck * 0.5;
      if (side < 0) left[start + i] = (left[start + i] ?? 0) + out;
      else right[start + i] = (right[start + i] ?? 0) + out;
      reverbSend[start + i] = (reverbSend[start + i] ?? 0) + out * 0.35;
    }
  }
}

// Plucked arpeggio: sixteenths over the chord and an octave above, with a dotted echo.
{
  const filter = svf();
  const PATTERN = [0, 1, 2, 3, 4, 3, 2, 1, 0, 2, 4, 5, 4, 2, 3, 1];
  for (let bar = 0; bar < BARS - 1; bar++) {
    const chord = chordAt(bar);
    const notes = [...chord.voices, ...chord.voices.map((n) => n + 12)];
    const level = bar < 2 ? 0.16 + 0.06 * bar : lightBreak(bar) ? 0.2 : groove(bar) ? 0.24 : 0.18;
    for (let s = 0; s < 16; s++) {
      const note = (notes[PATTERN[s] ?? 0] ?? 69) + 12;
      const freq = midi(note);
      const len = at(0.22);
      const pluck = new Float32Array(len);
      let phase = 0;
      for (let i = 0; i < len; i++) {
        const t = i / SR;
        phase = (phase + freq / SR) % 1;
        // Saw plus a sine an octave down: bright enough, and nothing that aliases.
        const tone = saw(phase, freq / SR) * 0.6 + Math.sin(Math.PI * 2 * phase) * 0.5;
        const cutoff = (bar < 2 ? 900 + bar * 700 : 1800) + 3500 * Math.exp(-t * 30);
        pluck[i] = filter(tone, cutoff, 1).low * Math.exp(-t * 16);
      }
      const t = bar * BAR + (s * BEAT) / 4;
      add(at(t), pluck, level, s % 2 === 0 ? -0.35 : 0.35, 0.4);
      add(at(t + (BEAT * 3) / 4), pluck, level * 0.35, s % 2 === 0 ? 0.6 : -0.6, 0.5);
    }
  }
}

// Reverb: four damped combs and two all-passes per side (Schroeder), fed by the sends.
function reverb(input: Float32Array, spread: number): Float32Array {
  const combs = [1116, 1188, 1277, 1356].map((d) => ({
    buf: new Float32Array(d + spread),
    i: 0,
    store: 0,
  }));
  const passes = [556, 441].map((d) => ({ buf: new Float32Array(d + spread), i: 0 }));
  const out = new Float32Array(input.length);
  for (let n = 0; n < input.length; n++) {
    const x = (input[n] ?? 0) * 0.3;
    let sum = 0;
    for (const c of combs) {
      const y = c.buf[c.i] ?? 0;
      c.store = y * 0.75 + c.store * 0.25;
      c.buf[c.i] = x + c.store * 0.86;
      c.i = (c.i + 1) % c.buf.length;
      sum += y;
    }
    for (const a of passes) {
      const y = a.buf[a.i] ?? 0;
      a.buf[a.i] = sum + y * 0.5;
      a.i = (a.i + 1) % a.buf.length;
      sum = y - sum * 0.5;
    }
    out[n] = sum;
  }
  return out;
}
const wetL = reverb(reverbSend, 0);
const wetR = reverb(reverbSend, 23);

// Master: reverb in, a gentle saturation, a fade at the very end, then peak at -1 dBFS.
const mixL = new Float32Array(N);
const mixR = new Float32Array(N);
let peak = 0;
// Two gentle one-pole low-passes at 12 kHz take the edge off the very top.
const lp = 1 - Math.exp((-2 * Math.PI * 12_000) / SR);
let l1 = 0;
let l2 = 0;
let r1 = 0;
let r2 = 0;
for (let i = 0; i < N; i++) {
  const fade = Math.min(1, (N - i) / at(1.5));
  l1 += lp * (Math.tanh(((left[i] ?? 0) + (wetL[i] ?? 0) * 0.6) * 1.1) - l1);
  r1 += lp * (Math.tanh(((right[i] ?? 0) + (wetR[i] ?? 0) * 0.6) * 1.1) - r1);
  l2 += lp * (l1 - l2);
  r2 += lp * (r1 - r2);
  mixL[i] = l2 * fade;
  mixR[i] = r2 * fade;
  peak = Math.max(peak, Math.abs(mixL[i] ?? 0), Math.abs(mixR[i] ?? 0));
}
const gain = 10 ** (-1 / 20) / (peak || 1);

const out = process.argv[2] ?? "test-results/demo/music.wav";
const wav = Buffer.alloc(44 + N * 4);
wav.write("RIFF", 0);
wav.writeUInt32LE(36 + N * 4, 4);
wav.write("WAVEfmt ", 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(2, 22);
wav.writeUInt32LE(SR, 24);
wav.writeUInt32LE(SR * 4, 28);
wav.writeUInt16LE(4, 32);
wav.writeUInt16LE(16, 34);
wav.write("data", 36);
wav.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  wav.writeInt16LE(Math.round((mixL[i] ?? 0) * gain * 32_767), 44 + i * 4);
  wav.writeInt16LE(Math.round((mixR[i] ?? 0) * gain * 32_767), 46 + i * 4);
}
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, wav);
console.log(`Wrote ${out}: ${LENGTH.toFixed(1)} s at ${BPM} beats a minute`);
