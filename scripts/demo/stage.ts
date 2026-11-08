/**
 * Staging for the README screenshots and the demo video: a browser on the local preview
 * build, a learner set up with Norway as home, and, when asked, about six weeks of review
 * history so the maps, levels and stats have something to show. Everything here drives the
 * real app; the history goes in through the same event table the app writes.
 */
import { type Browser, type BrowserContext, chromium, type Page } from "@playwright/test";

export const BASE = process.env.DEMO_BASE ?? "http://localhost:4173";

/** Countries with history, nearest first, the way a learner from Norway would meet them. */
const STUDIED = [
  ["NOR", "SWE", "DNK", "FIN", "ISL", "EST", "LVA", "LTU", "GBR", "IRL", "NLD", "BEL"],
  ["DEU", "FRA", "POL", "CZE", "AUT", "CHE", "LUX", "ESP", "PRT", "ITA", "SVK", "HUN"],
  ["SVN", "HRV", "GRC", "ROU", "BGR", "UKR", "BLR", "MDA", "SRB", "BIH", "MNE", "ALB"],
  ["MKD", "XKX", "MLT", "CYP", "TUR", "MAR", "DZA", "TUN", "EGY", "USA", "CAN", "JPN"],
];
const TYPES = [
  "map_to_name",
  "name_to_map",
  "country_to_capital",
  "capital_to_country",
  "flag_to_name",
  "name_to_flag",
];
const DAY = 86_400_000;

type Seeded = {
  cardId: string;
  daysAgo: number;
  rating: number;
  chosen: string | null;
};

/** Review history: each country is met, then reviewed at growing gaps, mostly right. */
export function history(days = 42): Seeded[] {
  const out: Seeded[] = [];
  STUDIED.flat().forEach((id, i) => {
    const start = days - Math.floor(i * 0.8);
    TYPES.forEach((type, t) => {
      if (start - t * 2 < 2) return;
      let day = start - t * 2;
      let gap = 1;
      let n = 0;
      while (day > 0) {
        // A few mix-ups, the same ones a learner really makes.
        const wrong = (i * 7 + t * 5 + n * 3) % 11 === 0;
        const twin: Record<string, string> = { LVA: "LTU", LTU: "LVA", SVK: "SVN", SVN: "SVK" };
        out.push({
          cardId: `${id}:${type}`,
          daysAgo: day + (i % 5) * 0.03,
          rating: wrong ? 1 : n > 2 && (i + t) % 3 === 0 ? 4 : 3,
          chosen: wrong
            ? (twin[id] ?? STUDIED.flat()[(i + 1) % STUDIED.flat().length] ?? null)
            : null,
        });
        day -= gap;
        gap = wrong ? 1 : Math.ceil(gap * 2.3);
        n++;
      }
    });
  });
  return out;
}

export async function seed(page: Page, cards: Seeded[]) {
  await page.evaluate(
    ({ cards, day }) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("geodex");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction(["reviewEvents", "cardState"], "readwrite");
          const events = tx.objectStore("reviewEvents");
          cards.forEach(({ cardId, daysAgo, rating, chosen }, i) => {
            events.put({
              id: `demo-${i}-${cardId}`,
              cardId,
              reviewedAt: Date.now() - daysAgo * day,
              rating,
              mode: "mc",
              inputSetting: "auto",
              correct: rating > 1,
              chosenAnswer: chosen,
              responseMs: 2600 + (i % 7) * 400,
              durationMs: 7000,
              snippetIds: [],
              scheduled: true,
              locale: "en",
              deviceId: "demo",
            });
          });
          tx.objectStore("cardState").clear();
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
      }),
    { cards, day: DAY },
  );
}

export type Stage = { browser: Browser; context: BrowserContext; page: Page };

export async function open(options: {
  width: number;
  height: number;
  scale?: number;
  theme?: "light" | "dark";
  locale?: "en" | "nb";
}): Promise<Stage> {
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
  });
  const context = await browser.newContext({
    viewport: { width: options.width, height: options.height },
    deviceScaleFactor: options.scale ?? 2,
    locale: options.locale === "nb" ? "nb-NO" : "en-GB",
    colorScheme: options.theme ?? "light",
    reducedMotion: "no-preference",
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.error("page error:", e.message));
  return { browser, context, page };
}

/** First visit to a learner with Norway as home and the tour done, optionally with history. */
export async function learner(page: Page, options: { history?: boolean; locale?: "en" | "nb" }) {
  await page.goto(`${BASE}/welcome`, { waitUntil: "networkidle" });
  if (options.locale) await page.getByTestId(`welcome-locale-${options.locale}`).click();
  await page.getByTestId("setup").click();
  await page.getByTestId("country-search").fill(options.locale === "nb" ? "Norg" : "Norw");
  await page.locator('[data-country-option="NOR"]').click();
  await page.getByTestId("start-learning").click();
  await page.getByTestId("tour").waitFor({ timeout: 10_000 });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(800);
  if (options.history) {
    await seed(page, history());
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  }
}

export async function theme(page: Page, value: "light" | "dark") {
  await page.goto(`${BASE}/settings?tab=appearance`, { waitUntil: "networkidle" });
  await page.getByTestId(`theme-${value}`).click();
  await page.waitForTimeout(300);
}
