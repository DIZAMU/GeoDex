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
  await setUpLearner(page);
  const overview = page.getByTestId("overview");
  await expect(overview).toBeVisible();
  await expect(page.getByTestId("level")).toHaveText("1");
  await expect(page.getByTestId("next-level")).toHaveText(/more cards? to level 2/);
  await expect(page.getByTestId("xp")).toContainText("Tourist");
  await expect(page.getByTestId("goal-ring")).toHaveText(/of \d+ minutes studied/);

  // The way to the next level switches between cards and a percentage, and is remembered.
  await page.getByTestId("next-level").click();
  await expect(page.getByTestId("next-level")).toHaveText(/^\d+% of the way to level 2$/);
  await page.reload();
  await expect(page.getByTestId("next-level")).toHaveAttribute("data-show", "percent");
  await page.goto("/settings?tab=appearance");
  await page.getByTestId("level-progress-cards").click();
  // Saved before the next page load, which would otherwise cut the write.
  await expect(page.getByTestId("level-progress-cards")).toHaveAttribute("data-state", "on");
  await page.goto("/");
  await expect(page.getByTestId("next-level")).toHaveText(/more cards? to level 2/);

  // Country and continent levels.
  await page.goto("/atlas/NOR");
  await expect(page.getByTestId("entry-level")).toHaveAttribute("aria-label", /Memory level \d+/);
  // Stats carries the full picture: the path to level 10, XP, and a level per continent.
  await page.goto("/stats");
  await expect(page.getByTestId("level-path")).toBeVisible();
  await expect(page.getByTestId("stats-xp")).toContainText("Tourist");
  await expect(page.getByTestId("level-europe")).toBeVisible();

  for (const locale of ["en", "nb"]) {
    for (const theme of ["light", "dark"]) {
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
  await setUpLearner(page);
  const start = await xpOnToday(page);
  // Traveller starts at 50,000 XP. Each seeded answer sits alone on its own day, two days
  // after the last one on the same card: 10 XP for the answer and 10 for the day, too soon for
  // a memory milestone.
  const k = Math.max(0, Math.floor((49_999 - start) / 20));
  const cards = Array.from({ length: k }, (_, i) => ({
    cardId: "BRA:map_to_name",
    daysAgo: 400 + i * 2,
    rating: 3,
  }));
  await seed(page, cards);
  const before = await xpOnToday(page);
  expect(before).toBeGreaterThanOrEqual(49_980);
  expect(before).toBeLessThan(50_000);

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
