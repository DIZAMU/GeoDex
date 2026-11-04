/**
 * README screenshots (docs/media). Needs the preview build on port 4173:
 * `pnpm build && pnpm preview`, then `node scripts/demo/screens.ts`.
 */
import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import type { CountriesFile } from "../../src/data/types.ts";
import { answerRight, typedAnswers } from "./answer.ts";
import { BASE, learner, open, theme } from "./stage.ts";

const OUT = "docs/media";
const countries = (JSON.parse(readFileSync("data/countries.json", "utf8")) as CountriesFile)
  .countries;
const answerFor = typedAnswers(countries);

/** Plays a session until a map question has been answered right, and stops on its feedback. */
async function mapFeedback(page: Page) {
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.getByTestId("start").click();
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(500);
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
    const card = await page
      .getByTestId("prompt")
      .first()
      .getAttribute("data-card")
      .catch(() => null);
    if (!card) continue;
    const onMap = /:(name_to_map|map_to_name)$/.test(card);
    await answerRight(page, answerFor);
    if (onMap) {
      await page.getByTestId("feedback").waitFor();
      await page.waitForTimeout(1500);
      return;
    }
  }
  throw new Error("no map question came up");
}

async function desktop() {
  const { browser, page } = await open({ width: 1280, height: 800 });
  await learner(page, { history: true });

  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/today.png` });

  await mapFeedback(page);
  await page.screenshot({ path: `${OUT}/session.png` });

  await page.goto(`${BASE}/stats`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/stats.png` });

  await page.goto(`${BASE}/atlas?view=time&year=1820`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/timeline.png` });

  await theme(page, "dark");
  await page.goto(`${BASE}/atlas`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/atlas-dark.png` });
  await browser.close();
}

async function phone() {
  const { browser, page } = await open({ width: 390, height: 844, locale: "nb" });
  await learner(page, { history: true, locale: "nb" });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/phone-today.png` });
  await theme(page, "dark");
  await mapFeedback(page);
  await page.screenshot({ path: `${OUT}/phone-session-dark.png` });
  await browser.close();
}

await desktop();
await phone();
console.log("Wrote screenshots to docs/media");
