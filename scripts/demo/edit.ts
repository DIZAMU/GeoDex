/**
 * Cuts the demo video (docs/PLAN-2.0.md, "Demo video") from the takes that
 * scripts/demo/video.ts recorded and the track from scripts/demo/music.ts. Every cut lands
 * on a bar line of the music: a bar is two seconds at 120 beats a minute.
 *
 * Writes docs/media/geodex-demo.mp4: 1920x1080, 30 frames a second, H.264 and AAC, kept
 * under 10 MB so it can be uploaded through the GitHub README editor.
 *
 * Usage: node scripts/demo/edit.ts
 */
import { execFileSync } from "node:child_process";
import { readFileSync, statSync, writeFileSync } from "node:fs";

const TAKES = "test-results/demo/takes";
const MUSIC = "test-results/demo/music.wav";
const OUT = "docs/media/geodex-demo.mp4";
const FPS = 30;
const BAR = 2;

/** The edit: take, marker, length in bars, and seconds to skip after the marker. */
const EDIT: [string, string, number, number?][] = [
  ["a", "title", 2],
  ["a", "welcome", 3],
  ["a", "setup", 2],
  ["a", "tour", 3],
  ["a", "map", 3],
  ["a", "mixup", 3],
  ["a", "summary", 2],
  ["b", "today", 2],
  ["c", "globe", 3],
  ["c", "timeline", 2],
  ["b", "stats", 2],
  ["b", "language", 2],
  // The end card fades in over the summary; the cut lands once it is fully in.
  ["a", "outro", 2, 0.8],
];

type Take = { frames: { file: string; t: number }[]; markers: Record<string, number> };
const takes = new Map<string, Take>();
const take = (name: string): Take => {
  let t = takes.get(name);
  if (!t) {
    t = JSON.parse(readFileSync(`${TAKES}/${name}/take.json`, "utf8")) as Take;
    takes.set(name, t);
  }
  return t;
};

/** For each output frame, the recorded frame that was on screen at that moment. */
const list: string[] = [];
let total = 0;
for (const [name, marker, bars, skip = 0] of EDIT) {
  const { frames, markers } = take(name);
  const at = markers[marker];
  if (at === undefined) throw new Error(`take ${name} has no marker ${marker}`);
  const start = at + skip;
  const count = bars * BAR * FPS;
  let k = 0;
  for (let i = 0; i < count; i++) {
    const time = start + i / FPS;
    while (k + 1 < frames.length && (frames[k + 1]?.t ?? Infinity) <= time) k++;
    const frame = frames[k];
    if (!frame) throw new Error(`take ${name} has no frames`);
    list.push(`file '${process.cwd()}/${frame.file}'\nduration ${1 / FPS}`);
  }
  total += bars * BAR;
}
// The concat demuxer needs the last file once more to hold its duration.
list.push(list.at(-1)?.split("\n")[0] ?? "");
writeFileSync(`${TAKES}/edit.txt`, `${list.join("\n")}\n`);

execFileSync(
  "ffmpeg",
  [
    "-y",
    "-loglevel",
    "error",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    `${TAKES}/edit.txt`,
    "-i",
    MUSIC,
    "-filter_complex",
    `[0:v]fps=${FPS},scale=1920:1080:flags=lanczos,format=yuv420p[v];[1:a]atrim=0:${total},afade=t=out:st=${total - 1.6}:d=1.6,loudnorm=I=-16:TP=-1.5:LRA=11[a]`,
    "-map",
    "[v]",
    "-map",
    "[a]",
    "-t",
    String(total),
    "-c:v",
    "libx264",
    "-preset",
    "slow",
    "-crf",
    process.env.CRF ?? "21",
    "-maxrate",
    "2200k",
    "-bufsize",
    "4400k",
    "-g",
    String(FPS * 2),
    "-c:a",
    "aac",
    "-ar",
    "48000",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    OUT,
  ],
  { stdio: "inherit" },
);
const mb = statSync(OUT).size / 1024 / 1024;
console.log(`Wrote ${OUT}: ${total} s, ${mb.toFixed(1)} MB`);
if (mb >= 10) console.log("Over 10 MB: raise CRF (CRF=26 node scripts/demo/edit.ts)");
