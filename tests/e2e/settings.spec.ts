import { expect, test } from "@playwright/test";
import { chooseThemeAndLocale, setUpLearner, studyAFew } from "./helpers";

test("theme and language survive a reload without a flash", async ({ page }) => {
  await chooseThemeAndLocale(page, "dark", "nb");
  await page.reload();
  const firstPaint = await page.evaluate(() => document.documentElement.dataset.theme);
  expect(firstPaint).toBe("dark");
  await expect(page.locator("html")).toHaveAttribute("lang", "nb");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Innstillinger");
});

test("light is the default and Match device follows the system", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/settings");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByTestId("theme-auto").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("a 1.0 theme in storage opens in its 2.0 mode before first paint", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("geodex.theme", "atlas"));
  await page.goto("/settings");
  const firstPaint = await page.evaluate(() => document.documentElement.dataset.theme);
  expect(firstPaint).toBe("dark");
});

const countEvents = (page: import("@playwright/test").Page) =>
  page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const open = indexedDB.open("geodex");
        open.onsuccess = () => {
          const names = [...open.result.objectStoreNames];
          if (!names.includes("reviewEvents")) return resolve(0);
          const count = open.result.transaction("reviewEvents").objectStore("reviewEvents").count();
          count.onsuccess = () => resolve(count.result);
        };
      }),
  );

test("a backup file moves progress to a fresh browser, with no account", async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  await setUpLearner(page);
  await studyAFew(page);
  const before = await countEvents(page);
  expect(before).toBeGreaterThan(0);
  await page.goto("/settings");
  await expect(page.getByTestId("last-backup")).toHaveText("No backup made in this browser yet");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download backup" }).click();
  const file = await (await download).path();
  await expect(page.getByTestId("last-backup")).toHaveText(/^Last backup: /);

  // Another browser starts from a blank slate and gets everything back from the file.
  const other = await browser.newContext();
  const fresh = await other.newPage();
  await fresh.goto("/settings");
  expect(await countEvents(fresh)).toBe(0);
  await fresh.getByTestId("import-file").setInputFiles(file);
  await expect(fresh.getByRole("status")).toContainText(`Restored ${before} answers`);
  expect(await countEvents(fresh)).toBe(before);
  await other.close();
});

test("reset progress starts over but keeps every review in the export", async ({ page }) => {
  test.setTimeout(120_000);
  await setUpLearner(page);
  await studyAFew(page);
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
  // Back on Today with nothing started.
  await expect(page.getByTestId("summary")).toBeVisible();
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

test("goal settings reach Today: sessions goal, session defaults and the tour", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await setUpLearner(page);
  await page.goto("/settings");
  // Each choice is saved before the next page load, which would otherwise cut the write.
  await page.getByTestId("goal-sessions").click();
  await expect(page.getByTestId("goal-sessions")).toHaveAttribute("data-state", "on");
  await page.getByTestId("goal-sessions-2").click();
  await expect(page.getByTestId("goal-sessions-2")).toHaveAttribute("data-state", "on");
  await page.getByTestId("default-length-20").click();
  await expect(page.getByTestId("default-length-20")).toHaveAttribute("data-state", "on");
  await page.getByTestId("default-focus").selectOption("region:europe");
  await expect(page.getByTestId("default-focus")).toHaveValue("region:europe");
  await page.screenshot({
    path: `test-results/screens/settings-goals-${page.viewportSize()?.width}.png`,
    fullPage: true,
  });

  await page.goto("/");
  await expect(page.getByTestId("goal-ring")).toHaveText("0 of 2 sessions done today");
  await expect(page.getByTestId("length-20")).toHaveAttribute("data-state", "on");
  await expect(page.getByTestId("focus")).toHaveValue("region:europe");

  // Back to minutes: the ring follows the daily time.
  await page.goto("/settings");
  await page.getByTestId("goal-minutes").click();
  await expect(page.getByTestId("goal-minutes")).toHaveAttribute("data-state", "on");
  await page.getByTestId("minutes-30").click();
  await expect(page.getByTestId("minutes-30")).toHaveAttribute("data-state", "on");
  await page.goto("/");
  await expect(page.getByTestId("goal-ring")).toHaveText(/of 30 minutes/);

  // The tour can be replayed from Settings.
  await page.goto("/settings");
  await page.getByTestId("tour-again").click();
  await expect(page.getByTestId("tour")).toBeVisible();
});
