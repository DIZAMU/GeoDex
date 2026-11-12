/**
 * Cuts the demo video from the opening and closing animations
 * (scripts/demo/intro.ts), the takes that scripts/demo/video.ts recorded, and the track from
 * scripts/demo/music.ts. The takes were recorded in slow motion; each one says how slow, and
 * the cut plays it back at full speed. The track has its own fade in and fade out.
 *
 * Writes docs/media/geodex-demo.mp4: 1920x1080, 60 frames a second, H.264 and AAC, kept
 * under 10 MB so it can be uploaded through the GitHub README editor.
 *
 * Usage: node scripts/demo/edit.ts
 */
import { execFileSync } from "node:child_process";
import { readFileSync, statSync, writeFileSync } from "node:fs";

const TAKES = "test-results/demo/takes";
const MUSIC = "test-results/demo/music.wav";
const OUT = "docs/media/geodex-demo.mp4";
const FPS = 60;

/** The edit: take, marker, and length in seconds. 90 seconds in all. */
const EDIT: [string, string, number][] = [
  ["intro", "intro", 6.5],
  ["story", "start", 20],
  ["story", "q1", 6.5],
  ["story", "q2", 6.5],
  ["story", "q3", 12.5],
  ["explore", "start", 31.5],
  ["outro", "outro", 6.5],
];

type Take = {
  slow?: number;
  frames: { file: string; t: number }[];
  markers: Record<string, number>;
};
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
for (const [name, marker, seconds] of EDIT) {
  const { frames, markers, slow = 1 } = take(name);
  const start = markers[marker];
  if (start === undefined) throw new Error(`take ${name} has no marker ${marker}`);
  const count = Math.round(seconds * FPS);
  let k = 0;
  for (let i = 0; i < count; i++) {
    const time = start + (i / FPS) * slow;
    while (k + 1 < frames.length && (frames[k + 1]?.t ?? Infinity) <= time) k++;
    const frame = frames[k];
    if (!frame) throw new Error(`take ${name} has no frames`);
    list.push(`file '${process.cwd()}/${frame.file}'\nduration ${1 / FPS}`);
  }
  total += seconds;
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
    `[0:v]fps=${FPS},scale=1920:1080:flags=lanczos,format=yuv420p[v];[1:a]atrim=0:${total}[a]`,
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
    process.env.CRF ?? "23",
    "-maxrate",
    "2000k",
    "-bufsize",
    "4000k",
    "-g",
    String(FPS * 4),
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
