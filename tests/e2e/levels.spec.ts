import { expect, type Page, test } from "@playwright/test";
import {
  answerPrompt,
  chooseThemeAndLocale,
  currentScreen,
  noHorizontalScroll,
  seed,
  setUpLearner,
} from "./helpers";

async function xpOnToday(page: Page): Promise<number> {
  await page.goto("/");
  return Number(await page.getByTestId("xp-total").getAttribute("data-xp"));
}

test("the overview shows level, next milestone, XP, goal and the path", async ({ page }) => {
  test.setTimeout(240_000);
  await setUpLearner(page, 4);
  const overview = page.getByTestId("overview");
  await expect(overview).toBeVisible();
  await expect(page.getByTestId("level")).toHaveText("1");
  await expect(page.getByTestId("next-level")).toHaveText(/more cards? to level 2/);
  await expect(page.getByTestId("xp")).toContainText("Tourist");
  await expect(page.getByTestId("goal-ring")).toHaveAttribute("aria-label", /of \d+ minutes/);
  await expect(overview.getByTestId("level-path")).toBeVisible();

  // Country and continent levels.
  await page.goto("/atlas/NOR");
  await expect(page.getByTestId("entry-level")).toHaveAttribute("aria-label", /Memory level \d+/);
  await page.goto("/stats");
  await expect(page.getByTestId("level-europe")).toBeVisible();

  for (const locale of ["en", "nb"]) {
    for (const theme of ["atlas", "minimal", "playful"]) {
      await chooseThemeAndLocale(page, theme, locale);
      await page.goto("/");
      await expect(page.getByTestId("overview")).toBeVisible();
      await noHorizontalScroll(page);
      const width = page.viewportSize()?.width;
      await page.screenshot({
        path: `test-results/screens/overview-${theme}-${locale}-${width}.png`,
        fullPage: true,
      });
      await page.goto("/stats");
      await expect(page.getByTestId("stats-levels")).toBeVisible();
      await noHorizontalScroll(page);
      await page.getByTestId("stats-levels").screenshot({
        path: `test-results/screens/stats-levels-${theme}-${locale}-${width}.png`,
      });
    }
  }
});

test("a session that reaches a new rank celebrates it", async ({ page }) => {
  test.setTimeout(180_000);
  await setUpLearner(page, 2);
  const start = await xpOnToday(page);
  // Each seeded answer sits alone on its own day: 10 XP for the answer, 10 for the day.
  const k = Math.max(0, Math.floor((299 - start) / 20));
  const ids = ["BRA", "ARG", "CHL", "PER", "COL", "MEX", "CAN", "USA", "AUS", "NZL", "JPN"];
  const cards = Array.from({ length: k }, (_, i) => ({
    cardId: `${ids[i % ids.length]}:${i < ids.length ? "map_to_name" : "name_to_map"}`,
    daysAgo: 400 + i * 2,
    rating: 3,
  }));
  await seed(page, cards);
  const before = await xpOnToday(page);
  expect(before).toBeGreaterThanOrEqual(280);
  expect(before).toBeLessThan(300);

  // A 5-question session earns at least the day and the session bonus: 20 XP.
  await page.getByTestId("length-5").click();
  await page.getByTestId("start").click();
  for (let i = 0; i < 60; i++) {
    if (await page.getByTestId("session-summary").isVisible()) break;
    const screen = await currentScreen(page).catch(() => null);
    if (screen === "intro") await page.keyboard.press("Enter");
    else if (screen === "prompt") await answerPrompt(page);
    else if (screen === "feedback") {
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("feedback")).toBeHidden();
    }
  }
  await expect(page.getByTestId("celebration")).toContainText("New rank: Traveller");
  await expect(page.getByTestId("summary-xp")).toHaveText(/^\+\d+ XP$/);
  const width = page.viewportSize()?.width;
  await page.waitForTimeout(1500); // let the entrance and the sparks finish
  await page.screenshot({ path: `test-results/screens/celebration-${width}.png` });
});
