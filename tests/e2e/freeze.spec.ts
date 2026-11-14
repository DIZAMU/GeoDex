import { expect, type Page, test } from "@playwright/test";
import { chooseThemeAndLocale, seed, setUpLearner } from "./helpers";

/** One card reviewed on each listed day: every due card is done, so each day counts. */
function days(list: number[]) {
  return list.map((daysAgo) => ({ cardId: "NOR:map_to_name", daysAgo, rating: 3 }));
}

async function shot(page: Page, name: string) {
  await page.screenshot({
    path: `test-results/screens/freeze-${name}-${page.viewportSize()?.width}.png`,
  });
}

test("a missed day that used a freeze says so once, with what is left", async ({ page }) => {
  await setUpLearner(page);
  // Seven days in a row earn a freeze; three days ago was missed; the last two days count.
  await seed(page, days([10, 9, 8, 7, 6, 5, 4, 2, 1]));
  await page.goto("/");
  const notice = page.getByTestId("freeze-notice");
  await expect(notice).toBeVisible();
  await expect(notice).toHaveAttribute("data-kind", "used");
  await expect(notice).toContainText("A freeze saved your streak");
  await expect(notice).toContainText("You have no freezes left.");
  await expect(notice).toContainText("after 5 more days of practice");
  await shot(page, "used");
  await page.getByTestId("freeze-ok").click();
  await expect(notice).toBeHidden();
  // The streak went on through the missed day.
  await expect(page.getByTestId("streak")).toContainText("9-day streak");
  await page.reload();
  await expect(page.getByTestId("streak")).toBeVisible();
  await expect(notice).toBeHidden();
});

test("the first freeze earned is announced once, in both languages", async ({ page }) => {
  await setUpLearner(page);
  await seed(page, days([7, 6, 5, 4, 3, 2, 1]));
  await chooseThemeAndLocale(page, "dark", "nb");
  await page.goto("/");
  const notice = page.getByTestId("freeze-notice");
  await expect(notice).toBeVisible();
  await expect(notice).toHaveAttribute("data-kind", "first");
  await expect(notice).toContainText("Du har fått en fridag");
  await shot(page, "first");
  await page.keyboard.press("Escape");
  await expect(notice).toBeHidden();
  await page.reload();
  await expect(page.getByTestId("streak")).toBeVisible();
  await expect(notice).toBeHidden();
});
