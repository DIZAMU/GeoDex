import { expect, test } from "@playwright/test";
import { seed, setUpLearner } from "./helpers";

test("finishing the day offers more: Good job, keep going, a drill or a higher limit", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await setUpLearner(page);
  // One review due and no new cards: one right answer finishes the day (a wrong one would
  // bring the card back later today).
  await seed(page, [{ cardId: "NOR:flag_to_name", daysAgo: 10, rating: 3 }], true);
  await page.goto("/");
  await expect(page.getByTestId("streak-flame")).toHaveAttribute("data-tier", /none|yellow/);
  await page.goto("/session?input=mc&length=10&focus=mixed");
  await page.locator('[data-option="NOR"]').click();
  await expect(page.getByTestId("feedback")).toBeVisible();
  await expect(page.getByTestId("continue")).toHaveText("Finish");
  await page.getByTestId("continue").click();
  await page.getByRole("link", { name: "Back to today" }).click();

  // The session that finished the day hands back to "Good job!".
  const dialog = page.getByTestId("done-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Good job!");
  await expect(page.getByTestId("dialog-raise")).toHaveText("Raise the daily limit to 50");
  await expect(page.getByTestId("dialog-drill")).toBeVisible();
  await page.screenshot({
    path: `test-results/screens/done-dialog-${page.viewportSize()?.width}.png`,
  });
  await page.getByTestId("dialog-not-now").click();
  await expect(dialog).toBeHidden();
  // Not again on a reload.
  await page.reload();
  await expect(page.getByTestId("keep-going-card")).toBeVisible();
  await expect(dialog).toBeHidden();
  await page.screenshot({
    path: `test-results/screens/done-card-${page.viewportSize()?.width}.png`,
  });

  // Keep going: new cards past the day's allowance.
  await page.getByTestId("keep-going").click();
  await expect(page).toHaveURL(/more=10/);
  await expect(page.getByTestId("left")).toHaveText(/^1 of \d+$/);
  await page.getByRole("button", { name: "End session" }).click();

  // The daily limit lives in Settings: 25 by default, or 50 and 100.
  await page.goto("/settings");
  await page.getByTestId("new-limit-50").click();
  await expect(page.getByTestId("new-limit-50")).toHaveAttribute("data-state", "on");
  await expect(page.getByTestId("settings-saved")).toBeVisible();
  await page.goto("/");
  await expect(page.getByTestId("start")).toBeVisible();
});
