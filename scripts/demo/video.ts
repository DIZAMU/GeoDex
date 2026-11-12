/**
 * Records the demo video's footage (docs/PLAN-2.0.md, "Demo video"). Needs the preview build
 * on port 4173, and scripts/demo/intro.ts run first. Writes JPEG frames with their times and
 * the cut markers to test-results/demo/takes; scripts/demo/edit.ts cuts them to the music.
 *
 * Everything on screen is the real app, in dark mode. It is recorded in slow motion: the
 * page's clocks, timers and animations run at a fifth of their speed, and the edit plays the
 * frames back five times as fast. A busy moment that would drop frames at full speed still
 * gets several frames for every one the video shows, so the result is smooth throughout.
 * Added on top, inside the page: a visible cursor with a click ring, a numbered caption for
 * each chapter in plain text at the bottom left, and soft fades where time is skipped.
 *
 * Usage: node scripts/demo/video.ts [story|explore]
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import type { CDPSession, Locator, Page } from "@playwright/test";
import type { CountriesFile } from "../../src/data/types.ts";
import { answerRight, currentCard, pointInCountry, typedAnswers } from "./answer.ts";
import { BASE, history, open as openBrowser, seed } from "./stage.ts";

const OUT = "test-results/demo/takes";
const WIDTH = 1440;
const HEIGHT = 810;
/** How many times slower than life the page runs while it is recorded. */
const SLOW = 5;
/** The length of a fade where time is skipped, in the video's seconds. */
const FADE = 0.35;
const NAVY = "#0E2433";

const countries = (JSON.parse(readFileSync("data/countries.json", "utf8")) as CountriesFile)
  .countries;
const answerFor = typedAnswers(countries);
/** The opening animation's last frame: the app fades in through it. */
function introEnd(): string | null {
  const dir = `${OUT}/intro`;
  if (!existsSync(dir)) return null;
  const last = readdirSync(dir)
    .filter((f) => f.endsWith(".jpg"))
    .sort()
    .at(-1);
  return last
    ? `data:image/jpeg;base64,${readFileSync(`${dir}/${last}`).toString("base64")}`
    : null;
}

type Demo = {
  rate: (slow: number) => void;
  scroll: (y: number, ms: number) => void;
  cover: (ms: number, colour?: string | null, image?: string | null) => void;
  reveal: (ms: number) => void;
  caption: (kicker: string, text: string) => void;
};

/** In-page helpers: the slow clock, wipes, scrolling, the cursor. Installed before every load. */
function overlay() {
  const w = window as unknown as { demo: Demo };
  // The slow clock. Timers wait `slow` times as long, and the time the page reads (from
  // performance.now and in animation frames) advances `slow` times as slowly. CSS animations
  // are slowed from outside, through the browser's own playback rate.
  let slow = 1;
  const real = performance.now.bind(performance);
  let realBase = real();
  let pageBase = realBase;
  const pageTime = (t: number) => pageBase + (t - realBase) / slow;
  performance.now = () => pageTime(real());
  const frame = window.requestAnimationFrame.bind(window);
  // The browser's playback rate slows the frame clock on its own scale, so frames are handed
  // the page's time instead: every animation then reads one clock.
  window.requestAnimationFrame = (callback) => frame(() => callback(performance.now()));
  const timeout = window.setTimeout.bind(window);
  const interval = window.setInterval.bind(window);
  const patched = window as unknown as {
    setTimeout: (handler: TimerHandler, ms?: number, ...args: unknown[]) => number;
    setInterval: (handler: TimerHandler, ms?: number, ...args: unknown[]) => number;
  };
  patched.setTimeout = (handler, ms, ...args) => timeout(handler, (ms ?? 0) * slow, ...args);
  patched.setInterval = (handler, ms, ...args) => interval(handler, (ms ?? 0) * slow, ...args);

  const ease = "cubic-bezier(0.65, 0, 0.35, 1)";
  const glide = (y: number, ms: number) => {
    const from = window.scrollY;
    const top = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const to = y < 0 ? top : Math.min(y, top);
    const start = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / ms);
      const e = k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2;
      window.scrollTo(0, from + (to - from) * e);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  // The browser's own smooth scrolling cannot be slowed, so the app's smooth scrolls (the
  // button back to the top) run on the slow clock instead.
  const jump = window.scrollTo.bind(window) as (x: number, y: number) => void;
  window.scrollTo = ((a?: ScrollToOptions | number, b?: number) => {
    if (typeof a === "object" && a.behavior === "smooth") glide(a.top ?? 0, 550);
    else if (typeof a === "object") jump(a.left ?? window.scrollX, a.top ?? window.scrollY);
    else jump(a ?? 0, b ?? 0);
  }) as typeof window.scrollTo;

  const make = (id: string, css: string) => {
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement("div");
      el.id = id;
      el.setAttribute("style", css);
      document.documentElement.appendChild(el);
    }
    return el;
  };
  const panel = () =>
    make(
      "demo-fade",
      "position:fixed;inset:0;z-index:2147483647;background:#0c1316 center / 100% 100% no-repeat;opacity:0;pointer-events:none;",
    );
  w.demo = {
    rate(value) {
      pageBase = performance.now();
      realBase = real();
      slow = value;
    },
    /** Scrolls to y (or the bottom, for -1) along an eased path. */
    scroll: glide,
    /** Fades the screen to a colour (the page's own by default), or to an image. */
    cover(ms, colour, image) {
      const el = panel();
      el.style.backgroundColor = colour ?? getComputedStyle(document.body).backgroundColor;
      el.style.backgroundImage = image ? `url(${image})` : "none";
      el.style.transition = ms === 0 ? "none" : `opacity ${ms}ms ${ease}`;
      void el.offsetWidth;
      el.style.opacity = "1";
    },
    reveal(ms) {
      const el = panel();
      el.style.transition = `opacity ${ms}ms ${ease}`;
      el.style.opacity = "0";
    },
    /** The chapter's caption: a numbered label and one sentence, plain, bottom left. */
    caption(kicker, text) {
      const el = make(
        "demo-caption",
        "position:fixed;left:0;bottom:0;width:980px;height:230px;z-index:2147483644;pointer-events:none;display:flex;flex-direction:column;justify-content:flex-end;gap:8px;padding:0 0 44px 56px;box-sizing:border-box;background:radial-gradient(ellipse 100% 100% at 0% 100%, rgb(8 13 16 / 0.94) 0%, rgb(8 13 16 / 0.8) 45%, transparent 72%);transition:opacity 380ms cubic-bezier(0.65,0,0.35,1);",
      );
      const show = () => {
        const font = getComputedStyle(document.body).fontFamily;
        el.innerHTML = "";
        const label = document.createElement("div");
        label.textContent = kicker;
        label.setAttribute(
          "style",
          "font:500 15px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:0.16em;color:#F4B740;",
        );
        const line = document.createElement("div");
        line.textContent = text;
        line.setAttribute(
          "style",
          `font-family:${font};font-size:31px;font-weight:500;letter-spacing:-0.01em;color:#f2f6f8;`,
        );
        el.append(label, line);
        el.style.opacity = "1";
      };
      if (el.childElementCount === 0) {
        el.style.opacity = "0";
        void el.offsetWidth;
        show();
      } else {
        el.style.opacity = "0";
        setTimeout(show, 400);
      }
    },
  };

  // A visible cursor and a ring on each click.
  const cursor = () => {
    let el = document.getElementById("demo-cursor");
    if (!el) {
      el = document.createElement("div");
      el.id = "demo-cursor";
      el.setAttribute(
        "style",
        "position:fixed;left:0;top:0;width:30px;height:30px;z-index:2147483646;pointer-events:none;opacity:0;transition:opacity 200ms;",
      );
      el.innerHTML =
        '<svg viewBox="0 0 24 24" width="30" height="30"><path d="M4 2.5 L4 19 L8.6 14.9 L11.6 21.6 L14.3 20.4 L11.3 13.9 L17.5 13.6 Z" fill="#121c23" stroke="#ffffff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
      document.documentElement.appendChild(el);
    }
    return el;
  };
  window.addEventListener(
    "mousemove",
    (e) => {
      const el = cursor();
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
        `position:fixed;left:${e.clientX - 22}px;top:${e.clientY - 22}px;width:44px;height:44px;border-radius:50%;border:3px solid #6eacd7;z-index:2147483645;pointer-events:none;transition:transform 450ms cubic-bezier(0.22,1,0.36,1),opacity 450ms;`,
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

const demo = (page: Page, call: string) => page.evaluate(`window.demo.${call}`);
const ms = (seconds: number) => Math.round(seconds * 1000);

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
  /** Slows the page down and starts saving frames. */
  async start(page: Page) {
    this.cdp = await page.context().newCDPSession(page);
    await this.cdp.send("Animation.enable");
    await this.cdp.send("Animation.setPlaybackRate", { playbackRate: 1 / SLOW });
    await demo(page, `rate(${SLOW})`);
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
      quality: 92,
      maxWidth: 1920,
      maxHeight: 1080,
      everyNthFrame: 1,
    });
    await page.waitForTimeout(600);
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
      JSON.stringify(
        { name: this.name, slow: SLOW, frames: this.frames, markers: this.markers },
        null,
        1,
      ),
    );
    console.log(
      `${this.name}: ${this.frames.length} frames, markers ${Object.keys(this.markers).join(", ")}`,
    );
  }
}

/** Waits until `seconds` of the video after `start` (a marker's time). */
async function at(start: number, seconds: number) {
  const wait = (start + seconds * SLOW) * 1000 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}
/** Waits for a length of the video's time. */
const hold = (seconds: number) => new Promise((r) => setTimeout(r, seconds * SLOW * 1000));

const pointer = { x: WIDTH / 2, y: HEIGHT * 0.6 };
/** Moves the cursor along an eased path over `seconds` of the video. */
async function glide(page: Page, x: number, y: number, seconds = 0.7) {
  const from = { ...pointer };
  const start = Date.now();
  const length = seconds * SLOW * 1000;
  for (;;) {
    const k = Math.min(1, (Date.now() - start) / length);
    const e = k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2;
    pointer.x = from.x + (x - from.x) * e;
    pointer.y = from.y + (y - from.y) * e;
    await page.mouse.move(pointer.x, pointer.y);
    if (k >= 1) return;
    await page.waitForTimeout(10);
  }
}
async function centre(locator: Locator): Promise<[number, number]> {
  await locator.waitFor({ timeout: 60_000 });
  const box = await locator.boundingBox();
  if (!box) throw new Error("element not on screen");
  return [box.x + box.width / 2, box.y + box.height / 2];
}
async function glideTo(page: Page, locator: Locator, seconds = 0.7) {
  const [x, y] = await centre(locator);
  await glide(page, x, y, seconds);
}
async function tap(page: Page) {
  await page.mouse.down();
  await page.waitForTimeout(90);
  await page.mouse.up();
}
/** Glides to an element and clicks it at `seconds` after `start`. */
async function clickAt(page: Page, locator: Locator, start: number, seconds: number, move = 0.7) {
  await at(start, seconds - move);
  await glideTo(page, locator, move);
  await at(start, seconds);
  await tap(page);
}

/**
 * A point inside a country where a click lands on that country and nothing else: small
 * neighbours and capital markers sit on top of big countries (the Vatican on Italy).
 */
async function clearPoint(page: Page, id: string): Promise<[number, number] | null> {
  return page.evaluate((id) => {
    const path = document.querySelector<SVGPathElement>(`path.map-country[data-country="${id}"]`);
    const svg = path?.ownerSVGElement;
    if (!path || !svg) return null;
    const view = svg.getBoundingClientRect();
    const box = path.getBoundingClientRect();
    const hit = (x: number, y: number) =>
      x > view.left + 12 &&
      x < view.right - 12 &&
      y > view.top + 12 &&
      y < view.bottom - 12 &&
      document.elementFromPoint(x, y) === path;
    const clear: [number, number][] = [];
    const step = Math.max(3, Math.min(box.width, box.height) / 40);
    for (let y = box.top; y < box.bottom; y += step)
      for (let x = box.left; x < box.right; x += step) {
        const ok = [0, 1, 2, 3, 4, 5, 6, 7].every((k) =>
          hit(x + 12 * Math.cos((k * Math.PI) / 4), y + 12 * Math.sin((k * Math.PI) / 4)),
        );
        if (ok && hit(x, y)) clear.push([x, y]);
      }
    if (clear.length === 0) return null;
    // Tiny countries take taps from a generous radius, so keep well away from them.
    const tiny: [number, number][] = [];
    for (const el of document.querySelectorAll<SVGGraphicsElement>("[data-country]")) {
      if (el === path) continue;
      const r = el.getBoundingClientRect();
      if (Math.max(r.width, r.height) < 16) tiny.push([r.left + r.width / 2, r.top + r.height / 2]);
    }
    const cx = clear.reduce((n, p) => n + p[0], 0) / clear.length;
    const cy = clear.reduce((n, p) => n + p[1], 0) / clear.length;
    const score = (p: [number, number]) =>
      Math.min(80, ...tiny.map((q) => Math.hypot(p[0] - q[0], p[1] - q[1]))) -
      Math.hypot(p[0] - cx, p[1] - cy) / 1000;
    return clear.reduce((best, p) => (score(p) > score(best) ? p : best));
  }, id);
}

/** A browser in dark mode with the helpers installed; optionally a learner six weeks in. */
async function stage(withHistory: boolean) {
  const s = await openBrowser({ width: WIDTH, height: HEIGHT, scale: 4 / 3, theme: "dark" });
  await s.page.addInitScript(overlay);
  await s.page.goto(`${BASE}/settings?tab=appearance`, { waitUntil: "networkidle" });
  await s.page.getByTestId("theme-dark").click();
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

const visible = (page: Page, testId: string) =>
  page
    .getByTestId(testId)
    .isVisible()
    .catch(() => false);

/** The session's position, from "3 of 5". */
async function position(page: Page): Promise<{ n: number; of: number }> {
  const text = (await page.getByTestId("left").textContent()) ?? "";
  const [n = 0, of = 0] = (text.match(/\d+/g) ?? []).map(Number);
  return { n, of };
}

/** Plays the session, off camera, until a question that `want` accepts is on screen. */
async function playUntil(
  page: Page,
  want: (card: { entity: string; type: string }, at: { n: number; of: number }) => boolean,
) {
  for (let i = 0; i < 80; i++) {
    await page.waitForTimeout(500);
    if ((await visible(page, "intro")) || (await visible(page, "feedback"))) {
      await page.keyboard.press("Enter");
      continue;
    }
    const card = await currentCard(page);
    if (!card) continue;
    if (want(card, await position(page))) return card;
    await answerRight(page, answerFor);
  }
  throw new Error("the wanted question never came up");
}

/** Answers the question on screen right, with the click at `seconds` after `start`. */
async function answer(page: Page, start: number, seconds: number) {
  const card = await currentCard(page);
  if (!card) return;
  const expected = answerFor(card.entity, card.type);
  const options = [
    page.locator(`[data-testid="choices"] [data-option="${card.entity}"]`),
    page.locator('[data-testid="choices"] button').filter({ hasText: expected ?? "\u0000" }),
    page.locator(`[data-testid="flag-choices"] [data-option="${card.entity}"]`),
  ];
  for (const option of options) {
    if (
      await option
        .first()
        .isVisible()
        .catch(() => false)
    ) {
      await clickAt(page, option.first(), start, seconds, 0.9);
      return;
    }
  }
  const typed = page.getByTestId("typed-answer");
  if ((await typed.isVisible().catch(() => false)) && expected) {
    await clickAt(page, typed, start, seconds - 1, 0.5);
    await typed.pressSequentially(expected, { delay: (700 * SLOW) / expected.length });
    await at(start, seconds);
    await page.keyboard.press("Enter");
    return;
  }
  const point = (await clearPoint(page, card.entity)) ?? (await pointInCountry(page, card.entity));
  if (!point) return;
  await at(start, seconds - 0.9);
  await glide(page, point[0], point[1], 0.9);
  await at(start, seconds);
  await tap(page);
}

const caption = (page: Page, kicker: string, text: string) =>
  demo(page, `caption(${JSON.stringify(kicker)}, ${JSON.stringify(text)})`);

// The story of a first visit, in one go: the landing page, setup, the guide, three questions
// and the results.
async function story() {
  const { browser, page } = await stage(false);
  const take = new Take("story");
  await page.goto(`${BASE}/welcome`, { waitUntil: "networkidle" });
  await page.evaluate(
    ([colour, image]) => (window as unknown as { demo: Demo }).demo.cover(0, colour, image),
    [NAVY, introEnd()] as const,
  );
  await page.waitForTimeout(1500);
  await take.start(page);

  // 20 s, unbroken. The opening dissolves into the landing page; a look down the page and
  // back; Start learning; the home country; the guide, step by step.
  const t = take.mark("start");
  await demo(page, `reveal(${ms(0.9)})`);
  await at(t, 0.7);
  await caption(page, "01  WELCOME", "Free, with nothing to sign up for");
  await at(t, 1.2);
  await demo(page, `scroll(380, ${ms(1.2)})`);
  await at(t, 2.7);
  await demo(page, `scroll(0, ${ms(1.0)})`);
  await clickAt(page, page.getByTestId("setup"), t, 4.8, 0.9);
  const search = page.getByTestId("country-search");
  await clickAt(page, search, t, 6.3, 0.8);
  await at(t, 6.8);
  await search.pressSequentially("Norw", { delay: 220 * SLOW });
  await clickAt(page, page.locator('[data-country-option="NOR"]'), t, 8.7, 0.8);
  await clickAt(page, page.getByTestId("start-learning"), t, 10.2, 0.9);
  await at(t, 10.7);
  await caption(page, "02  GUIDE", "A short guide on day one");
  await clickAt(page, page.getByTestId("tour-next"), t, 12.8, 0.9);
  await clickAt(page, page.getByTestId("tour-length-5"), t, 14.3, 0.8);
  await clickAt(page, page.getByTestId("tour-next"), t, 15.7, 0.7);
  await clickAt(page, page.getByTestId("tour-next"), t, 17.1, 0.7);
  await clickAt(page, page.getByTestId("tour-next"), t, 18.4, 0.7);
  await clickAt(page, page.getByTestId("tour-start"), t, 19.5, 0.7);
  await demo(page, `cover(${ms(FADE)})`);
  await at(t, 20.2);
  await page.getByTestId("left").waitFor({ timeout: 60_000 });
  await caption(page, "03  LEARN", "Every answer explains itself");

  // Three questions, 6.5 s each: the first, one of another kind, and the last, whose Finish
  // button leads straight into the results.
  let firstType = "";
  const wants: ((c: { type: string }, p: { n: number; of: number }) => boolean)[] = [
    () => true,
    (c, p) => p.n < p.of && (c.type !== firstType || p.n === p.of - 1),
    (_c, p) => p.n === p.of,
  ];
  for (const [i, want] of wants.entries()) {
    const card = await playUntil(page, want);
    if (i === 0) firstType = card.type;
    // The map flies to the question's region first.
    await hold(1.6);
    const q = take.mark(`q${i + 1}`);
    await demo(page, `reveal(${ms(FADE)})`);
    await answer(page, q, 2.1);
    await clickAt(page, page.getByTestId("continue"), q, 5.8, 0.9);
    if (i < 2) {
      await demo(page, `cover(${ms(FADE)})`);
      await at(q, 6.7);
    } else {
      // The results arrive and stay a while.
      await at(q, 6.1);
      await caption(page, "04  RESULTS", "See how each session went");
      await at(q, 12.5 - FADE - 0.05);
      await demo(page, `cover(${ms(FADE)})`);
      await at(q, 12.8);
    }
  }
  await take.stop();
  await browser.close();
}

// Six weeks in, in one go: Today, the Atlas, Stats with a scroll and the way back up, Settings.
async function explore() {
  const { browser, page } = await stage(true);
  const take = new Take("explore");
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await demo(page, "cover(0)");
  await page.waitForTimeout(2500);
  await take.start(page);
  const menu = page.getByRole("navigation", { name: "Main" });

  const t = take.mark("start");
  await caption(page, "05  TODAY", "Your day, planned for you");
  await demo(page, `reveal(${ms(FADE)})`);
  const [tx, ty] = await centre(page.getByTestId("today-globe"));
  await at(t, 1.2);
  await glide(page, tx, ty, 1.2);
  await clickAt(page, menu.getByRole("link", { name: "Atlas" }), t, 4.7, 1.0);

  // The Atlas: turn the globe, then borders through history.
  await caption(page, "06  ATLAS", "Your world, by how well you know it");
  // Measure the globe once the page has settled in.
  await at(t, 5.9);
  const [gx, gy] = await centre(page.getByTestId("globe"));
  await glide(page, gx + 150, gy - 10, 0.8);
  await page.mouse.down();
  await glide(page, gx - 170, gy + 30, 1.8);
  await page.mouse.up();
  await clickAt(page, page.getByTestId("view-time"), t, 10.0, 0.9);
  const slider = page.getByTestId("timeline-slider");
  await slider.waitFor({ timeout: 60_000 });
  const min = Number(await slider.getAttribute("min"));
  const max = Number(await slider.getAttribute("max"));
  for (const [year, when] of [
    [1683, 11.6],
    [1914, 12.7],
  ] as const) {
    const box = await slider.boundingBox();
    if (!box) break;
    const x = box.x + 8 + ((box.width - 16) * (Math.min(max, year) - min)) / (max - min);
    await at(t, when - 0.6);
    await glide(page, x, box.y + box.height / 2, 0.6);
    await at(t, when);
    await tap(page);
  }
  await clickAt(page, menu.getByRole("link", { name: "Stats" }), t, 14.0, 0.8);

  // Stats: down through the page, and back up with the button.
  await caption(page, "07  STATS", "Levels, ranks and what is coming up");
  await page.getByTestId("stats-level").waitFor({ timeout: 60_000 });
  await at(t, 15.6);
  await demo(page, `scroll(-1, ${ms(3.2)})`);
  await clickAt(page, page.getByTestId("back-to-top"), t, 20.0, 0.9);
  await clickAt(page, menu.getByRole("link", { name: "Settings" }), t, 22.6, 1.0);

  // Settings: the topics, then the language.
  await caption(page, "08  SETTINGS", "Choose your topics and your language");
  await clickAt(page, page.getByTestId("tab-topics"), t, 24.2, 0.8);
  await clickAt(page, page.getByTestId("module-landmarks-switch"), t, 25.4, 0.8);
  await clickAt(page, page.getByTestId("module-physical-switch"), t, 26.4, 0.7);
  await clickAt(page, page.getByTestId("module-history-switch"), t, 27.4, 0.7);
  await clickAt(page, page.getByTestId("tab-appearance"), t, 28.6, 0.8);
  await clickAt(page, page.getByTestId("locale-nb"), t, 29.8, 0.8);
  // The ending rises out of navy.
  await at(t, 31.5 - 0.6);
  await demo(page, `cover(${ms(0.55)}, ${JSON.stringify(NAVY)})`);
  await at(t, 31.8);
  await take.stop();
  await browser.close();
}

const SCENES = { story, explore } as const;
const only = process.argv[2] as keyof typeof SCENES | undefined;
mkdirSync(OUT, { recursive: true });
for (const name of only ? [only] : (Object.keys(SCENES) as (keyof typeof SCENES)[])) {
  rmSync(`${OUT}/${name}`, { recursive: true, force: true });
  await SCENES[name]();
}
