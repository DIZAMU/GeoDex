/**
 * Phase 11.1 acceptance: a first-time visitor learns what GeoDex is, that it is free, what
 * they can learn, and how to start, then gets a tour; Help is one tap away everywhere.
 */
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { chooseThemeAndLocale } from "./helpers";

async function inFirstScreen(page: Page, testId: string) {
  const box = await page.getByTestId(testId).boundingBox();
  const viewport = page.viewportSize();
  expect(box, testId).not.toBeNull();
  expect((box?.y ?? 0) + (box?.height ?? 0), testId).toBeLessThanOrEqual(viewport?.height ?? 0);
}

for (const locale of ["en", "nb"] as const) {
  test(`a first visit explains GeoDex, starts setup and gives a tour (${locale})`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.goto("/");
    await expect(page).toHaveURL(/\/welcome$/);
    await page.getByTestId(`welcome-locale-${locale}`).click();
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    // What it is, that it is free, and what you can learn, without scrolling.
    await inFirstScreen(page, "welcome-free");
    await expect(page.getByTestId("welcome-free")).toContainText(
      locale === "en" ? "Free." : "Gratis.",
    );
    await inFirstScreen(page, "welcome-topic-pills");
    await expect(page.getByTestId("welcome-topic-pills").locator("li")).toHaveCount(9);
    await expect(page.getByTestId("welcome-topics").locator("li")).toHaveCount(9);
    await expect(page.getByTestId("welcome-estimate")).toContainText(/\d/);

    // The sample questions: three, with feedback, then the end card.
    await page.getByTestId("welcome-try").click();
    for (let i = 0; i < 3; i++) {
      const demo = page.getByTestId("welcome-demo");
      if (await demo.getByTestId("choices").isVisible()) {
        await demo.getByTestId("choices").locator("button").first().click();
      } else {
        // The map question: tap Italy (its middle is land, near Rome).
        await demo.locator('path.map-country[data-country="ITA"]').click({ force: true });
      }
      await expect(demo.getByTestId("demo-feedback")).toBeVisible();
      await demo.getByTestId("demo-next").click();
    }
    await expect(page.getByTestId("demo-done")).toBeVisible();

    // Start: home country, then the placement choice. Start from zero goes to Today.
    await page.getByTestId("setup").click();
    await page.getByTestId("country-search").fill("Norw");
    await page.locator('[data-country-option="NOR"]').click();
    await expect(page.getByTestId("placement-offer")).toBeVisible();
    await page.getByTestId("start-from-zero").click();

    // The tour visits every main screen's entry point, then ends.
    const tour = page.getByTestId("tour");
    await expect(tour).toBeVisible();
    const visited: string[] = [];
    for (let i = 0; i < 10 && (await tour.count()) > 0; i++) {
      const step = (await tour.getAttribute("data-step")) ?? "";
      visited.push(step);
      await page.getByTestId("tour-next").click();
      // Wait for the next step, or for the tour to close after the last one.
      await expect(page.locator(`[data-testid="tour"][data-step="${step}"]`)).toHaveCount(0);
    }
    expect(visited).toEqual([
      "start",
      "input",
      "overview",
      "map",
      "atlas",
      "stats",
      "settings",
      "help",
    ]);
    await expect(page.getByTestId("infobox")).toHaveAttribute("data-open", "true");

    // Help is one tap away on every screen, and shows the app map.
    for (const path of ["/", "/atlas", "/stats", "/settings"]) {
      await page.goto(path);
      await expect(page.getByTestId("help-button")).toBeVisible();
    }
    await page.getByTestId("help-button").click();
    await expect(page.getByTestId("app-map")).toBeVisible();
    for (const id of ["welcome", "today", "session", "atlas", "stats", "settings"])
      await expect(page.getByTestId(`appmap-${id}`)).toBeVisible();
    // The tour can be replayed.
    await page.getByTestId("replay-tour").click();
    await expect(page.getByTestId("tour")).toBeVisible();
  });
}

test("welcome, Today with the tour, and Help in every theme and language", async ({ page }) => {
  test.setTimeout(240_000);
  const shot = (name: string) =>
    page.screenshot({
      path: join(
        test.info().project.outputDir,
        "screens",
        `${test.info().project.name}-guidance-${name}.png`,
      ),
    });
  for (const theme of ["atlas", "minimal", "playful"] as const) {
    for (const locale of ["en", "nb"] as const) {
      await chooseThemeAndLocale(page, theme, locale);
      await page.goto("/welcome");
      await expect(page.getByTestId("welcome-free")).toBeVisible();
      await page.waitForTimeout(800);
      await shot(`${theme}-${locale}-welcome`);
      await page.goto("/help");
      await expect(page.getByTestId("app-map")).toBeVisible();
      await page.waitForTimeout(400);
      await shot(`${theme}-${locale}-help`);
    }
  }
});
