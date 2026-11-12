/**
 * The demo video's opening and closing animations, drawn frame by frame so they are perfectly
 * smooth. Flat colours only: the brand navy, a lighter sea and land, and the mark's yellow.
 *
 *   intro  A navy globe spins in, every capital lights up, routes draw from Oslo, and the
 *          globe shrinks into the GeoDex mark while Oslo lands as its yellow dot.
 *   outro  The world rises like a horizon under the logo, every capital lit.
 *
 * Writes JPEG frames and a take.json to test-results/demo/takes/<name>, in the same shape as
 * scripts/demo/video.ts, so scripts/demo/edit.ts cuts them like any take. Run it before
 * video.ts: the app fades in through the opening's last frame.
 *
 * Usage: node scripts/demo/intro.ts [intro|outro]   (default: both)
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import {
  type GeoPermissibleObjects,
  geoDistance,
  geoGraticule10,
  geoInterpolate,
  geoOrthographic,
  geoPath,
} from "d3-geo";
import { feature } from "topojson-client";
import type { GeometryObject, Topology } from "topojson-specification";
import type { CountriesFile } from "../../src/data/types.ts";

const OUT = "test-results/demo/takes";
const W = 1920;
const H = 1080;
const FPS = 60;
const SECONDS = 6;

const NAVY = "#0E2433";
const YELLOW = "#F4B740";
const SEA = "#163b54";
const LAND = "#2b5a7a";

const topo = JSON.parse(readFileSync("data/geo/countries-50m.json", "utf8")) as Topology;
const land = feature(topo, topo.objects.land as GeometryObject) as GeoPermissibleObjects;
const countries = (JSON.parse(readFileSync("data/countries.json", "utf8")) as CountriesFile)
  .countries;
const capitals = countries.flatMap((c) => {
  const cap = c.capitals.find((x) => x.roles.includes("primary")) ?? c.capitals[0];
  return cap ? [{ id: c.id, lon: cap.lon, lat: cap.lat }] : [];
});
const capitalOf = (id: string) => {
  const c = capitals.find((x) => x.id === id);
  if (!c) throw new Error(`no capital for ${id}`);
  return [c.lon, c.lat] as [number, number];
};
const OSLO = capitalOf("NOR");

// Seeded randomness, so every run draws the same frames.
let seed = 0x6e0d3;
const rand = () => {
  seed = (seed * 1_664_525 + 1_013_904_223) >>> 0;
  return seed / 2 ** 32;
};
// Each capital lights up as a wave from west to east passes it, a little out of step.
const lights = capitals.map((c) => ({
  ...c,
  at: 0.75 + 1.9 * ((c.lon + 180) / 360) + 0.45 * rand(),
}));
const ROUTES: [string, string, number][] = [
  ["NOR", "EGY", 2.0],
  ["NOR", "IND", 2.2],
  ["NOR", "ISL", 2.35],
  ["EGY", "KEN", 2.55],
  ["ESP", "SEN", 2.7],
  ["NOR", "JPN", 2.9],
];

/** The lockup in one colour scheme, split into the mark (without its dot) and the wordmark. */
function lockupParts(file: string) {
  const svg = readFileSync(file, "utf8");
  const mark = /<g transform="translate\(-4 -4\)">([\s\S]*?)<\/g>/.exec(svg)?.[1] ?? "";
  const word = /<path fill="#[0-9A-Fa-f]{6}" transform="translate\(118 67\)"[^>]*\/>/.exec(
    svg,
  )?.[0];
  if (!mark || !word) throw new Error(`${file} is not as expected`);
  return { mark: mark.replace(/<circle[^>]*\/>/, ""), word };
}
const ON_DARK = lockupParts("assets/brand/svg/geodex-lockup-on-dark.svg");
const LOCKUP_W = 336.697;
const LOCKUP_H = 92;

const font = readFileSync(
  "node_modules/@fontsource-variable/schibsted-grotesk/files/schibsted-grotesk-latin-wght-normal.woff2",
).toString("base64");

const clamp = (x: number) => Math.min(1, Math.max(0, x));
const span = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
const easeOut = (x: number) => 1 - (1 - x) ** 3;
const easeInOut = (x: number) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2);
const mix = (a: number, b: number, x: number) => a + (b - a) * x;
const f = (n: number) => n.toFixed(2);

const fill = (colour: string) => `<rect width="${W}" height="${H}" fill="${colour}"/>`;

function text(
  x: number,
  y: number,
  size: number,
  body: string,
  opacity: number,
  colour: string,
  extra = "",
) {
  return `<text x="${f(x)}" y="${f(y)}" font-size="${size}" text-anchor="middle" fill="${colour}" opacity="${f(opacity)}" ${extra}>${body}</text>`;
}

/**
 * The lockup with its top left at (x, y) and scale s. The wordmark wipes in from the mark's
 * edge as `wipe` goes from 0 to 1; the dot is drawn by the caller.
 */
function lockup(
  parts: { mark: string; word: string },
  x: number,
  y: number,
  s: number,
  markOpacity: number,
  wipe: number,
  id: string,
) {
  const w = easeOut(wipe);
  return `<g transform="translate(${f(x)} ${f(y)}) scale(${s})">
    <clipPath id="${id}"><rect x="104" y="-10" width="${f(Math.max(0, (LOCKUP_W - 100) * w))}" height="${LOCKUP_H + 20}"/></clipPath>
    <g transform="translate(-4 -4)" opacity="${f(markOpacity)}">${parts.mark}</g>
    <g clip-path="url(#${id})"><g transform="translate(${f(-40 * (1 - w))} 0)" opacity="${f(clamp(wipe * 1.5))}">${parts.word}</g></g>
  </g>`;
}

/** A flat globe: sea, graticule, land and the capitals that have lit up by time t. */
function globe(options: {
  cx: number;
  cy: number;
  r: number;
  rotate: [number, number];
  t: number;
  capitalsOpacity: number;
  routes: boolean;
  skip?: string;
}): string {
  const { cx, cy, r, rotate, t } = options;
  const projection = geoOrthographic()
    .translate([cx, cy])
    .scale(r)
    .rotate([rotate[0], rotate[1], 0])
    .clipAngle(90)
    .precision(0.3);
  const path = geoPath(projection);
  const centre: [number, number] = [-rotate[0], -rotate[1]];
  let svg = `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="${SEA}"/>`;
  svg += `<path d="${path(geoGraticule10())}" fill="none" stroke="#ffffff" stroke-opacity="0.06" stroke-width="1"/>`;
  svg += `<path d="${path(land)}" fill="${LAND}" stroke="#3f7091" stroke-width="0.7"/>`;
  if (options.routes) {
    for (const [a, b, start] of ROUTES) {
      const p = easeInOut(span(t, start, start + 0.9));
      if (p <= 0) continue;
      const line = geoInterpolate(capitalOf(a), capitalOf(b));
      const points = Array.from({ length: 41 }, (_, i) => line((i / 40) * p));
      const d = path({ type: "LineString", coordinates: points });
      if (d)
        svg += `<path d="${d}" fill="none" stroke="#9fd2ee" stroke-width="2" stroke-linecap="round" opacity="${f(0.8 * (1 - span(t, 3.7, 4.2)))}"/>`;
    }
  }
  for (const c of lights) {
    if (c.id === options.skip) continue;
    const since = t - c.at;
    if (since < 0) continue;
    const angle = geoDistance([c.lon, c.lat], centre);
    if (angle > Math.PI / 2 - 0.02) continue;
    const p = projection([c.lon, c.lat]);
    if (!p) continue;
    const o = options.capitalsOpacity * clamp((Math.PI / 2 - angle) / 0.25);
    const dot = Math.min(4.5, Math.max(1.6, (r / 330) * 3.2)) * easeOut(clamp(since / 0.25));
    if (since < 0.7) {
      const k = since / 0.7;
      svg += `<circle cx="${f(p[0])}" cy="${f(p[1])}" r="${f(3 + 13 * easeOut(k))}" fill="none" stroke="${YELLOW}" stroke-width="1.5" opacity="${f(0.7 * (1 - k) * o)}"/>`;
    }
    svg += `<circle cx="${f(p[0])}" cy="${f(p[1])}" r="${f(dot)}" fill="${YELLOW}" opacity="${f(o)}"/>`;
  }
  return svg;
}

const TAGLINE = "Every country, capital and flag, learned for good";
const ENDING = "Free to use, works offline, no account needed";

/** The final lockup placement shared by the intros: centred, a little above the middle. */
function introLayout(scale = 2.2) {
  const lx = W / 2 - (LOCKUP_W * scale) / 2;
  const ly = H / 2 - (LOCKUP_H * scale) / 2 - 40;
  return {
    s: scale,
    lx,
    ly,
    mark: { x: lx + 46 * scale, y: ly + 46 * scale, r: 46 * scale },
    dot: { x: lx + 53 * scale, y: ly + 46 * scale, r: 6.5 * scale },
  };
}

function introA(t: number): string {
  const L = introLayout();
  const grow = easeOut(span(t, 0.1, 1.3));
  const shrink = easeInOut(span(t, 3.55, 4.6));
  const r = mix(mix(60, 330, grow), L.mark.r, shrink);
  const cx = mix(W / 2, L.mark.x, shrink);
  const cy = mix(H / 2 + 10, L.mark.y, shrink);
  // Spins in fast and settles with Oslo facing the camera.
  const spin = easeOut(span(t, 0, 4.6));
  const rotate: [number, number] = [
    mix(-OSLO[0] + 230, -OSLO[0], spin),
    mix(-15, -OSLO[1] + 8, spin),
  ];
  let svg = fill(NAVY);
  const globeOpacity = span(t, 0.05, 0.6) * (1 - span(t, 4.15, 4.6));
  svg += `<g opacity="${f(globeOpacity)}">${globe({
    cx,
    cy,
    r,
    rotate,
    t,
    capitalsOpacity: 1 - span(t, 3.6, 4.1),
    routes: true,
    skip: "NOR",
  })}</g>`;
  // Oslo lights up first, then flies into the mark as its dot.
  const projection = geoOrthographic()
    .translate([cx, cy])
    .scale(r)
    .rotate([rotate[0], rotate[1], 0]);
  const p = projection(OSLO) ?? [cx, cy];
  const land = easeInOut(span(t, 3.9, 4.75));
  const ox = mix(p[0], L.dot.x, land);
  const oy = mix(p[1], L.dot.y, land);
  const or = mix(5, L.dot.r, land);
  const oslo = span(t, 0.55, 0.85);
  if (oslo > 0) {
    const ring = span(t, 0.55, 1.6);
    svg += `<circle cx="${f(ox)}" cy="${f(oy)}" r="${f(5 + 30 * easeOut(ring))}" fill="none" stroke="${YELLOW}" stroke-width="2" opacity="${f(0.9 * (1 - ring))}"/>`;
  }
  svg += lockup(ON_DARK, L.lx, L.ly, L.s, span(t, 4.15, 4.6), span(t, 4.55, 5.3), "wa");
  if (oslo > 0)
    svg += `<circle cx="${f(ox)}" cy="${f(oy)}" r="${f(or * easeOut(oslo))}" fill="${YELLOW}"/>`;
  const line = easeOut(span(t, 5.0, 5.6));
  svg += text(
    W / 2,
    L.ly + LOCKUP_H * L.s + 92 + 14 * (1 - line),
    40,
    TAGLINE,
    line * 0.9,
    "#dce6ec",
  );
  return svg;
}

/** The line under the ending's logo. */
function endingText(t: number, y: number, colour: string) {
  const a = easeOut(span(t, 1.3, 2.0));
  return text(W / 2, y + 12 * (1 - a), 44, ENDING, a, colour);
}

function outro1(t: number): string {
  // The world rises like a horizon, every capital lit: the map you end up with.
  const r = 900;
  const cy = H + r - mix(-120, 330, easeOut(span(t, 0, 2.2)));
  let svg = fill(NAVY);
  svg += `<g opacity="${f(span(t, 0, 0.6))}">${globe({
    cx: W / 2,
    cy,
    r,
    rotate: [-12 - 6 * t, 38],
    t: t + 10,
    capitalsOpacity: 1,
    routes: false,
  })}</g>`;
  const S = 1.75;
  const lx = W / 2 - (LOCKUP_W * S) / 2;
  const ly = 250 - 10 * (1 - easeOut(span(t, 0.3, 1.2)));
  svg += lockup(ON_DARK, lx, ly, S, span(t, 0.3, 0.9), span(t, 0.5, 1.3), "w1");
  svg += `<circle cx="${f(lx + 53 * S)}" cy="${f(ly + 46 * S)}" r="${f(6.5 * S * easeOut(span(t, 0.6, 1.0)))}" fill="${YELLOW}"/>`;
  svg += endingText(t, 250 + LOCKUP_H * S + 104, "#dce6ec");
  svg += `<rect width="${W}" height="${H}" fill="${NAVY}" opacity="${f(easeInOut(span(t, 4.8, 6)))}"/>`;
  return svg;
}

const ANIMATIONS: Record<string, (t: number) => string> = {
  intro: introA,
  outro: outro1,
};

async function render(name: string, draw: (t: number) => string) {
  const dir = `${OUT}/${name}`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
  });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><html><head><style>
    @font-face{font-family:"Schibsted Grotesk";src:url(data:font/woff2;base64,${font}) format("woff2");font-weight:100 900}
    html,body{margin:0;background:${NAVY}}
    svg{display:block;font-family:"Schibsted Grotesk",sans-serif;font-weight:450}
  </style></head><body><svg id="s" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"></svg></body></html>`);
  await page.evaluate(() => document.fonts.ready);
  const frames: { file: string; t: number }[] = [];
  for (let i = 0; i < SECONDS * FPS + 12; i++) {
    const t = i / FPS;
    const markup = draw(t);
    await page.evaluate((m) => {
      const s = document.getElementById("s");
      if (s) s.innerHTML = m;
    }, markup);
    const file = `${dir}/${String(i).padStart(5, "0")}.jpg`;
    await page.screenshot({ path: file, type: "jpeg", quality: 93 });
    frames.push({ file, t });
  }
  writeFileSync(
    `${dir}/take.json`,
    JSON.stringify({ name, frames, markers: { [name]: 0 } }, null, 1),
  );
  await browser.close();
  console.log(`${name}: ${frames.length} frames`);
}

const asked = process.argv.slice(2);
for (const name of asked.length ? asked : Object.keys(ANIMATIONS)) {
  const draw = ANIMATIONS[name];
  if (!draw) throw new Error(`no animation "${name}"; try ${Object.keys(ANIMATIONS).join(", ")}`);
  await render(name, draw);
}
