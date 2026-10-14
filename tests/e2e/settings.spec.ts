import { expect, test } from "@playwright/test";
import { chooseThemeAndLocale, setUpLearner } from "./helpers";

test("theme and language survive a reload without a flash", async ({ page }) => {
  await chooseThemeAndLocale(page, "playful", "nb");
  await page.reload();
  const firstPaint = await page.evaluate(() => document.documentElement.dataset.theme);
  expect(firstPaint).toBe("playful");
  await expect(page.locator("html")).toHaveAttribute("lang", "nb");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Innstillinger");
});

test("auto follows the system color scheme", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/settings");
  await page.getByTestId("theme-auto").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "minimal");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "atlas");
});

test("reset progress starts over but keeps every review in the export", async ({ page }) => {
  await setUpLearner(page, 4);
  const before = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const open = indexedDB.open("geodex");
        open.onsuccess = () => {
          const count = open.result.transaction("reviewEvents").objectStore("reviewEvents").count();
          count.onsuccess = () => resolve(count.result);
        };
      }),
  );
  expect(before).toBeGreaterThan(0);
  await page.goto("/settings");
  await page.getByTestId("reset-start").click();
  await page.getByTestId("reset-cancel").click();
  await expect(page.getByTestId("reset-confirm")).toHaveCount(0);
  await page.getByTestId("reset-start").click();
  await page.getByTestId("reset-confirm").click();
  // Back on Today with the placement test offered again and nothing started.
  await expect(page.getByTestId("setup")).toBeVisible();
  const after = await page.evaluate(
    () =>
      new Promise<{ events: number; states: number }>((resolve) => {
        const open = indexedDB.open("geodex");
        open.onsuccess = () => {
          const tx = open.result.transaction(["reviewEvents", "cardState"]);
          const events = tx.objectStore("reviewEvents").count();
          const states = tx.objectStore("cardState").count();
          tx.oncomplete = () => resolve({ events: events.result, states: states.result });
        };
      }),
  );
  expect(after).toEqual({ events: before, states: 0 });
});
