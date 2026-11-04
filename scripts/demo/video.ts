/**
 * Records the demo video's footage (docs/PLAN-2.0.md, "Demo video"). Needs the preview build
 * on port 4173. Writes JPEG frames with their times and the cut markers to
 * test-results/demo/takes; scripts/demo/edit.ts cuts them to the music.
 *
 * Everything on screen is the real app. Three things are added on top, all inside the page so
 * they render as crisply as the app itself: a camera (a CSS transform on the page, so zoomed
 * text is drawn again rather than enlarged), captions, and a visible cursor with a click ring.
 *
 * Usage: node scripts/demo/video.ts
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import type { CDPSession, Locator, Page } from "@playwright/test";
import type { CountriesFile } from "../../src/data/types.ts";
import { answerRight, currentCard, pointInCountry, typedAnswers } from "./answer.ts";
import { BASE, history, open, seed } from "./stage.ts";

const OUT = "test-results/demo/takes";
const WIDTH = 1440;
const HEIGHT = 810;
const BEAT = 0.5;

const countries = (JSON.parse(readFileSync("data/countries.json", "utf8")) as CountriesFile)
  .countries;
const answerFor = typedAnswers(countries);
const lockup = readFileSync("assets/brand/svg/geodex-lockup.svg", "utf8");

/** In-page helpers: camera, captions, cursor, title cards. Installed before every load. */
function overlay(lockupSvg: string) {
  type Demo = {
    camera: (x: number, y: number, scale: number, ms: number) => void;
    focus: (selector: string, scale: number, ms: number) => void;
    reset: (ms: number) => void;
    caption: (text: string | null) => void;
    title: (html: string | null, ms: number) => void;
  };
  const w = window as unknown as { demo: Demo };
  const state = { x: 0, y: 0, s: 1 };
  const font = () => getComputedStyle(document.body).fontFamily;
  const ease = "cubic-bezier(0.65, 0, 0.35, 1)";
  const layer = (id: string, css: string) => {
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement("div");
      el.id = id;
      document.documentElement.appendChild(el);
    }
    el.setAttribute("style", css);
    return el;
  };
  const apply = (ms: number) => {
    const body = document.body;
    document.documentElement.style.background = getComputedStyle(body).backgroundColor;
    document.documentElement.style.overflow = "hidden";
    body.style.transformOrigin = "0 0";
    body.style.transition = `transform ${ms}ms ${ease}`;
    body.style.transform = `translate(${state.x}px, ${state.y}px) scale(${state.s})`;
  };
  // The camera works in page coordinates, so it also frames things below the fold once the
  // page has scrolled to them: a point on the page shows at x * s + translate - scroll.
  w.demo = {
    camera(x, y, s, ms) {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const sx = window.scrollX;
      const sy = window.scrollY;
      // Layout height: unlike scrollHeight, it ignores the camera's own scale.
      const pageHeight = Math.max(vh, document.body.offsetHeight);
      state.s = s;
      state.x = Math.min(sx, Math.max(sx + vw - vw * s, vw / 2 + sx - x * s));
      state.y = Math.min(sy, Math.max(sy + vh - pageHeight * s, vh / 2 + sy - y * s));
      apply(ms);
    },
    focus(selector, s, ms) {
      const el = document.querySelector(selector);
      if (!el) return;
      const r = el.getBoundingClientRect();
      // Undo the current camera to find the element's place on the page itself.
      const x = (r.left + r.width / 2 - state.x + window.scrollX) / state.s;
      const y = (r.top + r.height / 2 - state.y + window.scrollY) / state.s;
      w.demo.camera(x, y, s, ms);
    },
    reset(ms) {
      state.x = 0;
      state.y = 0;
      state.s = 1;
      apply(ms);
    },
    caption(text) {
      const el = layer(
        "demo-caption",
        `position:fixed;left:56px;bottom:52px;z-index:2147483646;font-family:${font()};font-size:30px;font-weight:500;letter-spacing:-0.01em;padding:14px 22px;border-radius:10px;background:var(--foreground);color:var(--background);box-shadow:0 8px 30px rgb(0 0 0 / 0.18);transition:opacity 280ms cubic-bezier(0.22,1,0.36,1),transform 280ms cubic-bezier(0.22,1,0.36,1);pointer-events:none;`,
      );
      if (text) {
        el.textContent = text;
        el.style.opacity = "0";
        el.style.transform = "translateY(12px)";
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            el.style.opacity = "1";
            el.style.transform = "none";
          }),
        );
      } else {
        el.style.opacity = "0";
        el.style.transform = "translateY(6px)";
      }
    },
    title(html, ms) {
      const el = layer(
        "demo-title",
        `position:fixed;inset:0;z-index:2147483645;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:36px;background:var(--background);color:var(--foreground);font-family:${font()};transition:opacity ${ms}ms ${ease};pointer-events:none;`,
      );
      // The cursor has nothing to point at on a title card.
      const pointerEl = document.getElementById("demo-cursor");
      if (pointerEl) pointerEl.style.visibility = html ? "hidden" : "visible";
      if (html) {
        el.innerHTML = `<div style="height:132px">${lockupSvg.replace("<svg", '<svg style="height:132px;width:auto"')}</div>${html}`;
        el.style.opacity = ms === 0 ? "1" : "0";
        if (ms > 0)
          requestAnimationFrame(() => requestAnimationFrame(() => (el.style.opacity = "1")));
      } else el.style.opacity = "0";
    },
  };
  // A visible cursor and a ring on each click.
  const cursor = () =>
    layer(
      "demo-cursor",
      "position:fixed;left:0;top:0;width:30px;height:30px;z-index:2147483647;pointer-events:none;opacity:0;transition:opacity 200ms;",
    );
  window.addEventListener(
    "mousemove",
    (e) => {
      const el = cursor();
      if (!el.firstChild)
        el.innerHTML =
          '<svg viewBox="0 0 24 24" width="30" height="30"><path d="M4 2.5 L4 19 L8.6 14.9 L11.6 21.6 L14.3 20.4 L11.3 13.9 L17.5 13.6 Z" fill="#121c23" stroke="#ffffff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
      el.style.opacity = "1";
      el.style.transform = `translate(${e.clientX - 5}px, ${e.clientY - 3}px)`;
    },
    true,
  );
  window.addEventListener(
    "mousedown",
    (e) => {
      const ring = document.createElement("div");
      ring.setAttribute(
        "style",
        `position:fixed;left:${e.clientX - 22}px;top:${e.clientY - 22}px;width:44px;height:44px;border-radius:50%;border:3px solid #006495;z-index:2147483646;pointer-events:none;transition:transform 450ms cubic-bezier(0.22,1,0.36,1),opacity 450ms;`,
      );
      document.documentElement.appendChild(ring);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          ring.style.transform = "scale(1.7)";
          ring.style.opacity = "0";
        }),
      );
      setTimeout(() => ring.remove(), 600);
    },
    true,
  );
}

/** Saves every frame the compositor produces, with its time, until stopped. */
class Take {
  private frames: { file: string; t: number }[] = [];
  private markers: Record<string, number> = {};
  private cdp: CDPSession | null = null;
  private dir: string;
  private name: string;
  constructor(name: string) {
    this.name = name;
    this.dir = `${OUT}/${name}`;
    mkdirSync(this.dir, { recursive: true });
  }
  async start(page: Page) {
    this.cdp = await page.context().newCDPSession(page);
    this.cdp.on("Page.screencastFrame", (frame) => {
      const file = `${this.dir}/${String(this.frames.length).padStart(5, "0")}.jpg`;
      writeFileSync(file, Buffer.from(frame.data, "base64"));
      this.frames.push({ file, t: frame.metadata.timestamp ?? Date.now() / 1000 });
      void this.cdp
        ?.send("Page.screencastFrameAck", { sessionId: frame.sessionId })
        .catch(() => {});
    });
    await this.cdp.send("Page.startScreencast", {
      format: "jpeg",
      quality: 94,
      maxWidth: 1920,
      maxHeight: 1080,
      everyNthFrame: 1,
    });
    await page.waitForTimeout(400);
  }
  /** A cut point: now, on the same clock as the frames. */
  mark(name: string): number {
    const now = Date.now() / 1000;
    this.markers[name] = now;
    return now;
  }
  async stop() {
    await this.cdp?.send("Page.stopScreencast").catch(() => {});
    writeFileSync(
      `${this.dir}/take.json`,
      JSON.stringify({ name: this.name, frames: this.frames, markers: this.markers }, null, 1),
    );
    console.log(
      `${this.name}: ${this.frames.length} frames, markers ${Object.keys(this.markers).join(", ")}`,
    );
  }
}

/** Waits until `beats` beats after `start` (seconds on the wall clock). */
async function until(start: number, beats: number) {
  const ms = (start + beats * BEAT) * 1000 - Date.now();
  if (ms > 0) await new Promise((r) => setTimeout(r, ms));
}

const pointer = { x: WIDTH / 2, y: HEIGHT / 2 };
/** Moves the cursor along an eased path, the way a hand moves a mouse. */
async function glide(page: Page, x: number, y: number, ms = 700) {
  const from = { ...pointer };
  const steps = Math.max(8, Math.round(ms / 16));
  for (let i = 1; i <= steps; i++) {
    const k = i / steps;
    const e = k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2;
    pointer.x = from.x + (x - from.x) * e;
    pointer.y = from.y + (y - from.y) * e;
    await page.mouse.move(pointer.x, pointer.y);
    await page.waitForTimeout(ms / steps);
  }
}
async function centre(locator: Locator): Promise<[number, number]> {
  const box = await locator.boundingBox();
  if (!box) throw new Error("element not on screen");
  return [box.x + box.width / 2, box.y + box.height / 2];
}
async function glideTo(page: Page, locator: Locator, ms = 700) {
  const [x, y] = await centre(locator);
  await glide(page, x, y, ms);
}
async function tap(page: Page) {
  await page.mouse.down();
  await page.waitForTimeout(60);
  await page.mouse.up();
}
async function glideClick(page: Page, locator: Locator, ms = 700) {
  await glideTo(page, locator, ms);
  await tap(page);
}

const demo = (page: Page, call: string) => page.evaluate(`window.demo.${call}`);

async function stage(theme: "light" | "dark", withHistory: boolean) {
  const s = await open({ width: WIDTH, height: HEIGHT, scale: 4 / 3, theme });
  await s.page.addInitScript(overlay, lockup);
  await s.page.goto(`${BASE}/settings`, { waitUntil: "networkidle" });
  await s.page.getByTestId(`theme-${theme}`).click();
  if (withHistory) {
    await s.page.goto(`${BASE}/welcome`, { waitUntil: "networkidle" });
    await s.page.getByTestId("setup").click();
    await s.page.getByTestId("country-search").fill("Norw");
    await s.page.locator('[data-country-option="NOR"]').click();
    await s.page.getByTestId("start-learning").click();
    await s.page.getByTestId("tour").waitFor();
    await s.page.keyboard.press("Escape");
    await s.page.waitForTimeout(800);
    await seed(s.page, history());
  }
  return s;
}

/** Plays a session until `want` is on screen, answering everything before it right. */
async function playUntil(
  page: Page,
  want: (card: { entity: string; type: string }) => Promise<boolean>,
) {
  for (let i = 0; i < 80; i++) {
    await page.waitForTimeout(350);
    if (
      await page
        .getByTestId("intro")
        .isVisible()
        .catch(() => false)
    ) {
      await page.keyboard.press("Enter");
      continue;
    }
    if (
      await page
        .getByTestId("feedback")
        .isVisible()
        .catch(() => false)
    ) {
      await page.keyboard.press("Enter");
      continue;
    }
    if (
      await page
        .getByTestId("session-summary")
        .isVisible()
        .catch(() => false)
    ) {
      await page.getByTestId("again").click();
      continue;
    }
    const card = await currentCard(page);
    if (!card) continue;
    if (await want(card)) return card;
    await answerRight(page, answerFor);
  }
  throw new Error("the wanted question never came up");
}

/** Answers right until the session's summary shows. */
async function finish(page: Page) {
  for (let i = 0; i < 80; i++) {
    if (
      await page
        .getByTestId("session-summary")
        .isVisible()
        .catch(() => false)
    )
      return;
    if (
      (await page
        .getByTestId("intro")
        .isVisible()
        .catch(() => false)) ||
      (await page
        .getByTestId("feedback")
        .isVisible()
        .catch(() => false))
    )
      await page.keyboard.press("Enter");
    else if (await currentCard(page)) await answerRight(page, answerFor);
    await page.waitForTimeout(350);
  }
}

// Take A: the first visit, the tour, a session and its summary, and the end card.
async function takeA() {
  const { browser, page } = await stage("light", false);
  const take = new Take("a");
  await page.goto(`${BASE}/welcome`, { waitUntil: "networkidle" });
  await demo(
    page,
    `title('<p style="font-size:38px;font-weight:500;letter-spacing:-0.015em;margin:0">Every country, capital and flag, learned for good.</p>', 0)`,
  );
  await page.waitForTimeout(1500);
  await take.start(page);

  let t = take.mark("title");
  await until(t, 5.5);
  await demo(page, "title(null, 800)");
  // The title segment is four seconds; the welcome one starts where it ends.
  await until(t, 8);

  t = take.mark("welcome");
  await demo(page, `caption("Start with a real question")`);
  await demo(page, `focus('[data-testid="welcome-demo"]', 1.3, 1200)`);
  await until(t, 3);
  const italy = await pointInCountry(page, "ITA");
  if (italy) await glide(page, italy[0], italy[1], 900);
  await until(t, 6);
  await tap(page);
  await until(t, 9);
  await demo(page, "reset(900)");
  await until(t, 11);
  await demo(page, "caption(null)");
  await until(t, 12);
  await glideClick(page, page.getByTestId("setup"), 600);
  await page.getByTestId("country-search").waitFor();
  await page.waitForTimeout(700);

  t = take.mark("setup");
  await demo(page, `caption("Pick your home country")`);
  await glideClick(page, page.getByTestId("country-search"), 500);
  await until(t, 2);
  await page.getByTestId("country-search").pressSequentially("Norw", { delay: 110 });
  await until(t, 4);
  await glideClick(page, page.locator('[data-country-option="NOR"]'), 450);
  await until(t, 6);
  await glideTo(page, page.getByTestId("start-learning"), 500);
  await until(t, 7);
  await tap(page);
  await until(t, 8);
  await demo(page, "caption(null)");
  await page.getByTestId("tour").waitFor();
  await page.waitForTimeout(900);

  t = take.mark("tour");
  await demo(page, `caption("A short tour, then you are in")`);
  await glideTo(page, page.getByTestId("tour-next"), 600);
  await until(t, 1.5);
  await tap(page);
  await until(t, 4);
  await glideClick(page, page.getByTestId("tour-length-5"), 600);
  await until(t, 6);
  await glideClick(page, page.getByTestId("tour-next"), 400);
  await until(t, 8);
  await glideClick(page, page.getByTestId("tour-next"), 300);
  await until(t, 10);
  await glideClick(page, page.getByTestId("tour-next"), 300);
  await until(t, 11);
  await glideTo(page, page.getByTestId("tour-start"), 400);
  await until(t, 12);
  await demo(page, "caption(null)");
  await tap(page);
  await page.getByTestId("left").waitFor();

  // A map question answered right, with its explanation.
  await playUntil(page, async (c) => c.type === "name_to_map");
  await page.waitForTimeout(900);
  t = take.mark("map");
  await demo(page, `caption("Answer on a real map")`);
  const card = await currentCard(page);
  const point = card ? await pointInCountry(page, card.entity) : null;
  await until(t, 1);
  if (point) await glide(page, point[0], point[1], 1000);
  await until(t, 4);
  await tap(page);
  await until(t, 5);
  await demo(page, `focus('[data-testid="feedback"]', 1.35, 1100)`);
  await until(t, 11);
  await demo(page, "caption(null)");
  await until(t, 12);
  await demo(page, "reset(0)");

  // A mix-up: a wrong pick, and what tells the two apart.
  await playUntil(page, async () =>
    page
      .getByTestId("choices")
      .isVisible()
      .catch(() => false),
  );
  await page.waitForTimeout(700);
  t = take.mark("mixup");
  await demo(page, `caption("Every answer explains itself")`);
  const right = await currentCard(page);
  const expected = right ? answerFor(right.entity, right.type) : undefined;
  const options = page.locator('[data-testid="choices"] button');
  let wrong = options.first();
  for (let i = 0; i < (await options.count()); i++) {
    const option = options.nth(i);
    const id = await option.getAttribute("data-option");
    const text = (await option.innerText()).trim();
    if (id !== right?.entity && !(expected && text.includes(expected))) {
      wrong = option;
      break;
    }
  }
  await until(t, 1);
  await glideTo(page, wrong, 900);
  await until(t, 4);
  await tap(page);
  await until(t, 5);
  await demo(page, `focus('[data-testid="feedback"]', 1.35, 1100)`);
  await until(t, 11);
  await demo(page, "caption(null)");
  await until(t, 12);
  await demo(page, "reset(0)");

  // Finish the session and show the summary.
  await finish(page);
  await page.getByTestId("session-summary").waitFor({ timeout: 60_000 });
  await page.waitForTimeout(1200);
  t = take.mark("summary");
  await demo(page, `caption("See what slipped")`);
  await demo(page, `focus('[data-testid="session-summary"]', 1.6, 1400)`);
  await until(t, 8);
  await demo(page, "caption(null)");

  // The end card.
  await page.waitForTimeout(600);
  t = take.mark("outro");
  await demo(
    page,
    `title('<p style="font-size:38px;font-weight:500;letter-spacing:-0.015em;margin:0">Free, offline, no account.</p><p style="font-size:28px;margin:-14px 0 0;opacity:0.7">geodex.dilovanzm.workers.dev</p>', 700)`,
  );
  await until(t, 9);
  await take.stop();
  await browser.close();
}

// Take B: a learner six weeks in: Today's map, Stats, and Settings in Norwegian and dark.
async function takeB() {
  const { browser, page } = await stage("light", true);
  const take = new Take("b");
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await take.start(page);

  let t = take.mark("today");
  await demo(page, `caption("Your map fills in")`);
  await demo(page, `focus('[data-tour="progress"] section', 1.7, 1800)`);
  await until(t, 7);
  await demo(page, "caption(null)");
  await until(t, 8);
  await demo(page, "reset(0)");
  await glideClick(page, page.getByRole("link", { name: "Stats" }).first(), 500);
  await page.getByTestId("stats-level").waitFor();
  await page.waitForTimeout(800);

  t = take.mark("stats");
  await demo(page, `caption("Levels, XP and what is coming up")`);
  await demo(page, `focus('[data-testid="stats-level"]', 1.2, 1200)`);
  await until(t, 4);
  await demo(page, `focus('[data-testid="stats-forecast"]', 1.2, 1500)`);
  await until(t, 7);
  await demo(page, "caption(null)");
  await until(t, 8);
  await demo(page, "reset(0)");
  await glideClick(page, page.getByRole("link", { name: "Settings" }).first(), 500);
  await page.getByTestId("settings-look").waitFor();
  await page.getByTestId("settings-look").evaluate((el) => el.scrollIntoView({ block: "center" }));
  await demo(page, `focus('[data-testid="settings-look"]', 1.3, 0)`);
  await page.waitForTimeout(800);

  t = take.mark("language");
  await demo(page, `caption("English or Norwegian, light or dark")`);
  await glideTo(page, page.getByTestId("locale-nb"), 700);
  await until(t, 2);
  await tap(page);
  await until(t, 4);
  await glideTo(page, page.getByTestId("theme-dark"), 600);
  await until(t, 6);
  await tap(page);
  await until(t, 7);
  await demo(page, "caption(null)");
  await until(t, 8);
  await take.stop();
  await browser.close();
}

// Take C: the Atlas in dark mode: the globe turning, then borders over time.
async function takeC() {
  const { browser, page } = await stage("dark", true);
  const take = new Take("c");
  await page.goto(`${BASE}/atlas`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  await take.start(page);

  let t = take.mark("globe");
  await demo(page, `caption("Every country, by how well you know it")`);
  await demo(page, `focus('[data-testid="atlas-map"]', 1.15, 1500)`);
  const [gx, gy] = await centre(page.getByTestId("globe"));
  await until(t, 2);
  await glide(page, gx + 120, gy, 500);
  await page.mouse.down();
  await glide(page, gx - 160, gy + 30, 900);
  await page.mouse.up();
  await until(t, 11);
  await demo(page, "caption(null)");
  await until(t, 12);
  await demo(page, "reset(0)");
  await glideClick(page, page.getByTestId("view-time"), 500);
  await page.getByTestId("timeline-slider").waitFor();
  await page.waitForTimeout(1200);

  t = take.mark("timeline");
  await demo(page, `caption("Borders over time")`);
  const slider = page.getByTestId("timeline-slider");
  const box = await slider.boundingBox();
  if (box) {
    const min = Number(await slider.getAttribute("min"));
    const max = Number(await slider.getAttribute("max"));
    // A click on the track jumps to that year: four years, one on each second beat. The list
    // under the map changes height with the year, so the slider is measured each time.
    for (const [i, year] of [1279, 1683, 1820, 1914].entries()) {
      const now = (await slider.boundingBox()) ?? box;
      const x = now.x + 8 + ((now.width - 16) * (Math.min(max, year) - min)) / (max - min);
      await glide(page, x, now.y + now.height / 2, 350);
      await until(t, 1 + i * 2);
      await tap(page);
    }
  }
  await until(t, 7);
  await demo(page, "caption(null)");
  await until(t, 8);
  await take.stop();
  await browser.close();
}

const only = process.argv[2];
for (const name of only ? [only] : ["a", "b", "c"])
  rmSync(`${OUT}/${name}`, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
if (!only || only === "a") await takeA();
if (!only || only === "b") await takeB();
if (!only || only === "c") await takeC();
