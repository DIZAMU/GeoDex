/**
 * The demo video's music: an original track made by this script, dedicated to the public
 * domain (CC0). Warm and unhurried, for a film about the world: marimba patterns, a kalimba
 * melody, hand drums and a shaker over a soft pad and a round bass. Plain synthesis, no
 * samples, deterministic. Ninety seconds, fading in over its first seconds and out over its
 * last ones.
 *
 * Usage: node scripts/demo/music.ts [out.wav]   (default test-results/demo/music.wav)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const SR = 44_100;
const LENGTH = 90;
const FADE_IN = 3.5;
const FADE_OUT = 4.5;
const TAU = Math.PI * 2;

type Chord = { root: number; notes: number[] };
type Style = {
  bpm: number;
  /** Delay of every second sixteenth, as a share of a sixteenth. */
  swing: number;
  chords: Chord[];
  kick: { sound: "808" | "punch" | "soft"; steps: string };
  snare: { sound: "clap" | "rim" | "snap"; steps: string } | null;
  hats: { steps: string; rolls: boolean; open?: string; shaker?: boolean } | null;
  bass: { sound: "808" | "sub" | "pluck"; steps: string } | null;
  /** Chord instruments, each with its level. */
  keys: { sound: "epiano" | "piano" | "pad" | "arp" | "stabs"; level: number; steps?: string }[];
  lead: {
    sound: "bell" | "pluck" | "piano" | "marimba";
    base: number;
    motif: [number, number][];
  } | null;
  texture: "air" | "vinyl";
  /** How much the kick pushes the chords down, 0 to 1. */
  pump: number;
};

const ch = (root: number, ...notes: number[]): Chord => ({ root, notes });

// D major, one chord a bar: D, B minor, G, A. The melody stays on the pentatonic scale.
const STYLE: Style = {
  bpm: 96,
  swing: 0.14,
  chords: [
    ch(38, 54, 57, 62, 66),
    ch(35, 54, 59, 62, 66),
    ch(43, 55, 59, 62, 67),
    ch(45, 52, 57, 61, 64),
  ],
  kick: { sound: "soft", steps: "x.....x...x....." },
  snare: { sound: "rim", steps: "....x..x....x.x." },
  hats: { steps: "x.xxx.xxx.xxx.xx", rolls: false, shaker: true },
  bass: { sound: "pluck", steps: "x.....x...x....." },
  keys: [
    { sound: "pad", level: 0.2 },
    { sound: "arp", level: 0.26 },
  ],
  lead: {
    sound: "marimba",
    base: 74,
    motif: [
      [0, 0],
      [0.75, 2],
      [1.5, 4],
      [3, 7],
      [4, 9],
      [4.75, 7],
      [5.5, 4],
      [6.5, 2],
      [7, 4],
    ],
  },
  texture: "air",
  pump: 0.2,
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

/** A state-variable filter; returns the low-pass, band-pass and high-pass outputs. */
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

function render(style: Style): { left: Float32Array; right: Float32Array } {
  const N = Math.ceil(LENGTH * SR);
  const BEAT = 60 / style.bpm;
  const STEP = BEAT / 4;
  const BAR = BEAT * 4;
  const BARS = Math.ceil(LENGTH / BAR);
  const left = new Float32Array(N);
  const right = new Float32Array(N);
  const send = new Float32Array(N);
  const duck = new Float32Array(N).fill(1);
  let seed = 0x5eed42 + style.bpm;
  const noise = () => {
    seed = (seed * 1_664_525 + 1_013_904_223) >>> 0;
    return seed / 2 ** 31 - 1;
  };

  // Form: two quiet bars in, the beat, a two-bar breakdown past the middle, the beat, and
  // the last two bars quiet again.
  const breakAt = Math.round(BARS * 0.55);
  const quiet = (bar: number) => bar < 2 || bar >= BARS - 2;
  const breakdown = (bar: number) => bar === breakAt || bar === breakAt + 1;
  const beat = (bar: number) => !quiet(bar) && !breakdown(bar);
  const chordAt = (bar: number) => style.chords[bar % style.chords.length] as Chord;
  const stepTime = (bar: number, step: number) =>
    bar * BAR + step * STEP + (step % 2 === 1 ? style.swing * STEP : 0);

  function add(start: number, samples: Float32Array, gain: number, pan = 0, wet = 0, pump = 0) {
    const l = gain * Math.cos(((pan + 1) * Math.PI) / 4);
    const r = gain * Math.sin(((pan + 1) * Math.PI) / 4);
    for (let i = 0; i < samples.length && start + i < N; i++) {
      if (start + i < 0) continue;
      const d = pump ? 1 - pump * (1 - (duck[start + i] ?? 1)) : 1;
      const v = (samples[i] ?? 0) * d;
      left[start + i] = (left[start + i] ?? 0) + v * l;
      right[start + i] = (right[start + i] ?? 0) + v * r;
      send[start + i] = (send[start + i] ?? 0) + v * wet * gain;
    }
  }

  // Drum sounds.
  function kickSound(): Float32Array {
    const kind = style.kick.sound;
    const out = new Float32Array(at(kind === "808" ? 1.1 : 0.35));
    let phase = 0;
    for (let i = 0; i < out.length; i++) {
      const t = i / SR;
      const base = kind === "808" ? 45 : kind === "soft" ? 55 : 50;
      phase += (base + (kind === "soft" ? 70 : 140) * Math.exp(-t * 45)) / SR;
      const decay = kind === "808" ? 2.2 : kind === "soft" ? 16 : 13;
      const click = kind !== "soft" && i < 70 ? noise() * (1 - i / 70) * 0.4 : 0;
      out[i] = Math.tanh((Math.sin(TAU * phase) * Math.exp(-t * decay) + click) * 1.7);
    }
    return out;
  }
  function snareSound(kind: "clap" | "rim" | "snap"): Float32Array {
    const out = new Float32Array(at(kind === "rim" ? 0.12 : 0.4));
    const filter = svf();
    let phase = 0;
    for (let i = 0; i < out.length; i++) {
      const t = i / SR;
      if (kind === "rim") {
        phase += 820 / SR;
        out[i] =
          (Math.sin(TAU * phase) * 0.7 + filter(noise(), 3500, 1.5).band) * Math.exp(-t * 55);
        continue;
      }
      phase += (190 + 60 * Math.exp(-t * 60)) / SR;
      const tone = Math.sin(TAU * phase) * Math.exp(-t * 28) * (kind === "snap" ? 0.25 : 0.5);
      const bursts =
        kind === "clap"
          ? [0, 0.009, 0.019].reduce(
              (n, b) => n + (t >= b ? Math.exp(-(t - b) * (b === 0.019 ? 16 : 200)) : 0),
              0,
            )
          : Math.exp(-t * 30);
      out[i] = tone + filter(noise(), kind === "snap" ? 2600 : 1800, 0.9).band * bursts * 1.4;
    }
    return out;
  }
  function hatSound(open: boolean, shaker = false): Float32Array {
    const out = new Float32Array(at(open ? 0.3 : shaker ? 0.09 : 0.05));
    const hp = 1 - Math.exp((-2 * Math.PI * (shaker ? 4500 : 6500)) / SR);
    const lp = 1 - Math.exp((-2 * Math.PI * 11_000) / SR);
    let low = 0;
    let smooth = 0;
    for (let i = 0; i < out.length; i++) {
      const t = i / SR;
      const x = noise();
      low += hp * (x - low);
      smooth += lp * (x - low - smooth);
      const env = shaker
        ? Math.min(1, t * 120) * Math.exp(-t * 40)
        : Math.exp(-t * (open ? 11 : 90));
      out[i] = smooth * 1.6 * env;
    }
    return out;
  }
  function riser(seconds: number): Float32Array {
    const out = new Float32Array(at(seconds));
    const filter = svf();
    for (let i = 0; i < out.length; i++) {
      const x = i / out.length;
      out[i] = filter(noise(), 300 + 7000 * x * x, 2.5).band * x ** 2.2;
    }
    return out;
  }

  // Drums, and the duck the kick puts on the chords.
  const KICK = kickSound();
  const SNARE = style.snare ? snareSound(style.snare.sound) : null;
  const HAT = hatSound(false, style.hats?.shaker);
  const OPEN = hatSound(true);
  for (let bar = 0; bar < BARS; bar++) {
    if (!beat(bar)) continue;
    for (let s = 0; s < 16; s++) {
      const t = stepTime(bar, s);
      if (style.kick.steps[s] === "x") {
        add(
          at(t),
          KICK,
          style.kick.sound === "808" ? 0.4 : style.kick.sound === "soft" ? 0.5 : 0.55,
        );
        for (let i = 0; i < at(0.4) && at(t) + i < N; i++) {
          const x = i / at(0.4);
          duck[at(t) + i] = Math.min(duck[at(t) + i] ?? 1, 0.3 + 0.7 * x ** 1.4);
        }
      }
      if (SNARE && style.snare?.steps[s] === "x") add(at(t), SNARE, 0.45, 0.04, 0.3);
      if (style.hats) {
        const rollBeat = style.hats.rolls && bar % 2 === 1 && s >= 12;
        if (style.hats.steps[s] === "x" && !rollBeat)
          add(at(t), HAT, 0.1 + (s % 2 ? 0 : 0.025), s % 2 ? 0.3 : -0.2);
        if (style.hats.open?.[s] === "x") add(at(t), OPEN, 0.07, 0.35, 0.2);
      }
    }
    if (style.hats?.rolls && bar % 2 === 1) {
      const n = bar % 4 === 1 ? 8 : 6;
      for (let k = 0; k < n; k++)
        add(at(bar * BAR + 3 * BEAT + (k * BEAT) / n), HAT, 0.08 + 0.004 * k, 0.1);
    }
  }
  add(at(1 * BAR), riser(BAR), 0.18, 0, 0.35);
  add(at((breakAt + 1) * BAR), riser(BAR), 0.22, 0, 0.35);

  // Bass.
  if (style.bass) {
    const filter = svf();
    let phase = 0;
    const steps = style.bass.steps;
    for (let bar = 0; bar < BARS; bar++) {
      if (!beat(bar)) continue;
      const root = chordAt(bar).root;
      const next = chordAt(bar + 1).root;
      const hits = [...steps].flatMap((c, s) => (c === "x" ? [s] : []));
      hits.forEach((s, k) => {
        const end = hits[k + 1] ?? 16;
        const start = at(stepTime(bar, s));
        const length = at((end - s) * STEP);
        const up = style.bass?.sound === "808" && k === hits.length - 1 ? 12 : 0;
        const from = midi(root + up - (style.bass?.sound === "pluck" ? 0 : 12));
        const to = style.bass?.sound === "808" && k === hits.length - 1 ? midi(next - 12) : from;
        for (let i = 0; i < length && start + i < N; i++) {
          const t = i / SR;
          const x = i / length;
          const glide = to === from ? 0 : Math.min(1, Math.max(0, (x - 0.55) / 0.35));
          const freq = from * (to / from) ** glide;
          phase = (phase + freq / SR) % 1;
          const release = Math.min(1, (length - i) / at(0.04));
          let v: number;
          if (style.bass?.sound === "pluck") {
            const raw = saw(phase, freq / SR) * 0.6 + Math.sin(TAU * phase) * 0.6;
            v = filter(raw, 200 + 1200 * Math.exp(-t * 14), 0.9).low * Math.exp(-t * 4) * 0.55;
          } else if (style.bass?.sound === "808") {
            v = Math.tanh(Math.sin(TAU * phase) * 1.7) * Math.exp(-t * 0.9) * 0.27;
          } else {
            v = Math.sin(TAU * phase) * Math.min(1, t * 60) * 0.15;
          }
          v *= Math.min(1, t * 300) * release;
          left[start + i] = (left[start + i] ?? 0) + v;
          right[start + i] = (right[start + i] ?? 0) + v;
        }
      });
    }
  }

  // Chord instruments.
  function fmNote(
    note: number,
    seconds: number,
    velocity: number,
    kind: "epiano" | "piano" | "bell" | "pluck" | "marimba",
  ) {
    const out = new Float32Array(at(seconds));
    const freq = midi(note);
    const filter = svf();
    let phase = 0;
    for (let i = 0; i < out.length; i++) {
      const t = i / SR;
      const tail = Math.min(1, (out.length - i) / at(0.25));
      if (kind === "pluck") {
        phase = (phase + freq / SR) % 1;
        const tone = saw(phase, freq / SR) * 0.6 + Math.sin(TAU * phase) * 0.5;
        out[i] = filter(tone, 1500 + 3500 * Math.exp(-t * 30), 1).low * Math.exp(-t * 9) * tail;
        continue;
      }
      if (kind === "marimba") {
        // A struck wooden bar: the note, and a fourth partial that dies away at once.
        const body = Math.sin(TAU * freq * t) * Math.exp(-t * 7);
        const knock = Math.sin(TAU * freq * 4 * t) * 0.35 * Math.exp(-t * 28);
        out[i] = (body + knock) * Math.min(1, t * 900) * tail;
        continue;
      }
      if (kind === "bell") {
        const mod = Math.sin(TAU * freq * 3.5 * t) * 2.2 * Math.exp(-t * 3);
        out[i] = Math.sin(TAU * freq * t + mod) * Math.min(1, t * 400) * Math.exp(-t * 1.6) * tail;
        continue;
      }
      const piano = kind === "piano";
      const index = ((piano ? 2.2 : 1.4) * Math.exp(-t * (piano ? 7 : 5)) + 0.15) * velocity;
      const mod = Math.sin(TAU * freq * t) * index;
      const second = piano ? Math.sin(TAU * freq * 2 * t) * 0.18 * Math.exp(-t * 3) : 0;
      const env = Math.min(1, t * 250) * Math.exp(-t * (piano ? 1.6 : 1.1)) * tail;
      const trem = piano ? 1 : 0.9 + 0.1 * Math.sin(TAU * 4.5 * t);
      out[i] = (Math.sin(TAU * freq * t + mod) + second) * env * trem;
    }
    return out;
  }

  for (const layer of style.keys) {
    if (layer.sound === "pad") {
      for (const side of [-1, 1] as const) {
        const filter = svf();
        const phases = new Float64Array(15);
        for (let bar = 0; bar < BARS; bar++) {
          const chord = chordAt(bar);
          const start = at(bar * BAR);
          const len = at(BAR);
          for (let i = 0; i < len && start + i < N; i++) {
            const t = i / SR;
            let v = 0;
            chord.notes.forEach((note, k) => {
              for (let d = 0; d < 3; d++) {
                const index = k * 3 + d;
                const freq = midi(note - 12) * 2 ** (((d - 1) * 9 + side * 4) / 1200);
                phases[index] = ((phases[index] ?? 0) + freq / SR) % 1;
                v += saw(phases[index] ?? 0, freq / SR);
              }
            });
            const time = start / SR + t;
            const open = 550 + 450 * Math.sin(time * 0.35) ** 2 + (beat(bar) ? 400 : 0);
            const d = beat(bar) ? 1 - style.pump * (1 - (duck[start + i] ?? 1)) : 1;
            const out = filter(v / 12, open, 0.8).low * d * layer.level;
            if (side < 0) left[start + i] = (left[start + i] ?? 0) + out;
            else right[start + i] = (right[start + i] ?? 0) + out;
            send[start + i] = (send[start + i] ?? 0) + out * 0.5;
          }
        }
      }
      continue;
    }
    for (let bar = 0; bar < BARS; bar++) {
      const chord = chordAt(bar);
      if (layer.sound === "arp") {
        const PATTERN = [0, 1, 2, 3, 4, 3, 2, 1, 0, 2, 4, 5, 4, 2, 3, 1];
        const notes = [...chord.notes, ...chord.notes.map((n) => n + 12)];
        const level = quiet(bar) || breakdown(bar) ? layer.level * 0.7 : layer.level;
        for (let s = 0; s < 16; s++) {
          const note = (notes[PATTERN[s] ?? 0] ?? 69) + 12;
          add(
            at(stepTime(bar, s)),
            fmNote(note, 0.25, 1, "pluck"),
            level,
            s % 2 ? 0.35 : -0.35,
            0.4,
            style.pump * 0.5,
          );
        }
        continue;
      }
      const steps = layer.steps ?? "x...............";
      const hits = [...steps].flatMap((c, s) => (c === "x" ? [s] : []));
      const stab = layer.sound === "stabs";
      hits.forEach((s, k) => {
        const end = hits[k + 1] ?? 16;
        const seconds = stab ? STEP * 1.6 : Math.max(0.6, (end - s) * STEP + 0.3);
        const vel = k === 0 ? 1 : 0.7;
        chord.notes.forEach((note, n) => {
          const start = at(stepTime(bar, s) + n * (stab ? 0 : 0.016));
          const kind = layer.sound === "piano" ? "piano" : stab ? "pluck" : "epiano";
          add(
            start,
            fmNote(note, seconds, vel, kind),
            layer.level * vel,
            -0.3 + n * 0.2,
            0.45,
            style.pump * 0.6,
          );
        });
      });
    }
  }

  // A short motif over every two bars.
  if (style.lead) {
    for (let bar = 2; bar < BARS - 1; bar += 2) {
      const phrase = bar / 2;
      const level = breakdown(bar) ? 0.11 : quiet(bar) ? 0.07 : 0.085;
      for (const [b, up] of style.lead.motif) {
        const t = bar * BAR + b * BEAT;
        if (t > LENGTH - 2) continue;
        const note = style.lead.base + up + (phrase % 2 === 1 && b >= 4 ? -12 : 0);
        const kind = style.lead.sound;
        add(
          at(t),
          fmNote(note, kind === "bell" ? 2.5 : 1.2, 1, kind),
          level * (kind === "bell" ? 1 : kind === "marimba" ? 2.4 : 1.7),
          0.35,
          0.65,
        );
      }
    }
  }

  // Texture: a faint breathing hiss, or vinyl crackle.
  {
    const filter = svf();
    const bed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const hiss = filter(noise(), 3000, 0.5).band * (0.6 + 0.4 * Math.sin((i / SR) * 0.7));
      const crackle = style.texture === "vinyl" && noise() > 0.9994 ? noise() * 6 : 0;
      bed[i] = hiss + crackle;
    }
    add(0, bed, style.texture === "vinyl" ? 0.02 : 0.012);
  }

  // Reverb: four damped combs and two all-passes per side (Schroeder).
  function reverb(input: Float32Array, spread: number): Float32Array {
    const combs = [1557, 1617, 1491, 1422].map((d) => ({
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
        c.store = y * 0.6 + c.store * 0.4;
        c.buf[c.i] = x + c.store * 0.88;
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
  const wetL = reverb(send, 0);
  const wetR = reverb(send, 31);

  // Master: reverb in, gentle saturation and a soft top, the fades, then peak at -1 dBFS.
  const lp = 1 - Math.exp((-2 * Math.PI * 11_000) / SR);
  let l1 = 0;
  let l2 = 0;
  let r1 = 0;
  let r2 = 0;
  let peak = 0;
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    const fadeIn = Math.sin((Math.min(1, t / FADE_IN) * Math.PI) / 2) ** 2;
    const fadeOut = Math.sin((Math.min(1, (LENGTH - t) / FADE_OUT) * Math.PI) / 2) ** 2;
    l1 += lp * (Math.tanh(((left[i] ?? 0) + (wetL[i] ?? 0) * 0.7) * 1.15) - l1);
    r1 += lp * (Math.tanh(((right[i] ?? 0) + (wetR[i] ?? 0) * 0.7) * 1.15) - r1);
    l2 += lp * (l1 - l2);
    r2 += lp * (r1 - r2);
    left[i] = l2 * fadeIn * fadeOut;
    right[i] = r2 * fadeIn * fadeOut;
    peak = Math.max(peak, Math.abs(left[i] ?? 0), Math.abs(right[i] ?? 0));
  }
  // Peak at -5 dBFS: the music sits under the picture rather than in front of it.
  const gain = 10 ** (-5 / 20) / (peak || 1);
  for (let i = 0; i < N; i++) {
    left[i] = (left[i] ?? 0) * gain;
    right[i] = (right[i] ?? 0) * gain;
  }
  return { left, right };
}

function write(out: string, { left, right }: { left: Float32Array; right: Float32Array }) {
  const N = left.length;
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
    wav.writeInt16LE(Math.round((left[i] ?? 0) * 32_767), 44 + i * 4);
    wav.writeInt16LE(Math.round((right[i] ?? 0) * 32_767), 46 + i * 4);
  }
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, wav);
}

const out = process.argv[2] ?? "test-results/demo/music.wav";
write(out, render(STYLE));
console.log(`Wrote ${out}: ${LENGTH} s at ${STYLE.bpm} beats a minute`);
