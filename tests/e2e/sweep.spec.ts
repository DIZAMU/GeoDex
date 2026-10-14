/**
 * Exploratory sweep: every route, deep links, odd URLs, both languages, theme and size
 * changes, keyboard paths. Any console error or uncaught page error fails the test.
 */
import { expect, type Page, test } from "@playwright/test";
import { chooseThemeAndLocale, currentScreen, noHorizontalScroll, setUpLearner } from "./helpers";

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });
  return errors;
}

async function settled(page: Page) {
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every((a) => a.playState !== "running" || a.effect?.getTiming().iterations === Infinity),
  );
}

test("every route renders in both languages without errors", async ({ page }) => {
  test.setTimeout(180_000);
  const errors = watchErrors(page);
  await setUpLearner(page, 4);
  for (const locale of ["en", "nb"] as const) {
    await chooseThemeAndLocale(page, "atlas", locale);
    for (const [url, ready] of [
      ["/", "streak"],
      ["/atlas", "atlas-regions"],
      ["/atlas?skill=capitals", "atlas-regions"],
      ["/atlas?skill=nonsense", "atlas-regions"],
      ["/atlas/NOR", "entry-cards"],
      ["/atlas/XKX", "entry-cards"],
      ["/atlas/TUV", "entry-cards"],
      ["/stats", "stats-grid"],
      ["/settings", "theme-atlas"],
      ["/drill", "drill-empty"],
      ["/drill?region=nowhere", "drill-empty"],
      ["/drill?a=NOR&b=NOR", "drill-empty"],
    ] as const) {
      await page.goto(url);
      await expect(page.getByTestId(ready)).toBeVisible();
      await noHorizontalScroll(page);
      // No raw i18n keys leak into the page.
      expect(await page.locator("body").innerText()).not.toMatch(
        /\b[a-z]+\.[a-z][A-Za-z]+\b(?=\s|$)/,
      );
    }
  }
  expect(errors).toEqual([]);
});

test("unknown addresses and unknown countries land somewhere useful", async ({ page }) => {
  const errors = watchErrors(page);
  await setUpLearner(page, 2);
  await page.goto("/no/such/page");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("streak")).toBeVisible();
  await page.goto("/atlas/ZZZ");
  await expect(page).toHaveURL(/\/atlas$/);
  expect(errors).toEqual([]);
});

test("Atlas tabs, wheel zoom, spin, resize and theme change keep working", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = watchErrors(page);
  await setUpLearner(page, 2);
  await page.goto("/atlas");
  await expect(page.getByTestId("atlas-regions")).toBeVisible();
  await settled(page);
  for (const skill of ["capitals", "flags", "currency_language", "location"]) {
    await page.getByTestId(`skill-${skill}`).click();
    await expect(page).toHaveURL(new RegExp(`skill=${skill}`));
  }
  await expect(page.getByTestId("skill-location")).toHaveAttribute("aria-checked", "true");
  await expect(page.locator(".map-level").first()).toBeAttached();

  const map = page.getByTestId("atlas-map");
  const box = await map.boundingBox();
  if (!box) throw new Error("no map");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -400);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 200, box.y + box.height / 2 + 40, { steps: 12 });
  await page.mouse.up();
  await expect(page).toHaveURL(/\/atlas\?skill=location$/);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId("atlas-map")).toBeVisible();
  await noHorizontalScroll(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await chooseThemeAndLocale(page, "playful", "nb");
  await page.goto("/atlas");
  await expect(page.getByTestId("atlas-regions")).toBeVisible();
  expect(errors).toEqual([]);
});

test("a pair drill from the URL runs with keyboard shortcuts and the help overlay", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors = watchErrors(page);
  await setUpLearner(page, 2);
  await page.goto("/drill?a=SVK&b=SVN");
  const screen = await currentScreen(page);
  expect(screen).not.toBe("intro");
  await page.keyboard.press("?");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByTestId("prompt")).toBeVisible();
  await page.keyboard.press("Escape");
  // Nothing answered: ending a drill with no answers goes home.
  await expect(page).toHaveURL(/\/$/);
  expect(errors).toEqual([]);
});

test("back and forward between tabs keep each screen intact", async ({ page }) => {
  const errors = watchErrors(page);
  await setUpLearner(page, 2);
  await page.getByRole("link", { name: "Atlas" }).click();
  await expect(page.getByTestId("atlas-regions")).toBeVisible();
  await page.getByRole("link", { name: "Stats" }).click();
  await expect(page.getByTestId("stats-grid")).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId("atlas-regions")).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId("streak")).toBeVisible();
  await page.goForward();
  await expect(page.getByTestId("atlas-regions")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("atlas-regions")).toBeVisible();
  expect(errors).toEqual([]);
});
