/**
 * The first visit (docs/PLAN-2.0.md): a live question, what GeoDex costs and covers, setup,
 * then a five step tour that ends by starting a session. Help is one tap away everywhere.
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
  test(`a first visit answers a live question, sets up and takes the tour (${locale})`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.goto("/");
    await expect(page).toHaveURL(/\/welcome$/);
    await page.getByTestId(`welcome-locale-${locale}`).click();
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    // On a desktop the live question and the way in fit without scrolling; on a phone the
    // question comes first and the way in follows it.
    if (test.info().project.name === "desktop") await inFirstScreen(page, "setup");
    await expect(page.getByTestId("welcome-demo")).toBeVisible();
    await expect(page.getByTestId("welcome-free")).toContainText(
      locale === "en" ? "Free" : "Gratis",
    );
    await expect(page.getByTestId("welcome-topics").locator("dt")).toHaveCount(9);
    await expect(page.getByTestId("welcome-estimate")).toContainText(/\d/);

    // The sample questions: three, with feedback, then the end card.
    const demo = page.getByTestId("welcome-demo");
    for (let i = 0; i < 3; i++) {
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

    // Setup: language and home country, then Today.
    await page.getByTestId("setup").click();
    await page.getByTestId("country-search").fill(locale === "en" ? "Norw" : "Norg");
    await page.locator('[data-country-option="NOR"]').click();
    await page.getByTestId("start-learning").click();

    // The tour: five steps, the length picked in the card, and the last one starts a session.
    const tour = page.getByTestId("tour");
    await expect(tour).toBeVisible();
    const visited: string[] = [];
    for (let i = 0; i < 6; i++) {
      const step = (await tour.getAttribute("data-step")) ?? "";
      visited.push(step);
      await expect(page.getByTestId("tour-progress")).toHaveText(
        locale === "en" ? `${i + 1} of 5` : `${i + 1} av 5`,
      );
      if (step === "ready") break;
      if (step === "length") await page.getByTestId("tour-length-5").click();
      await page.getByTestId("tour-next").click();
      await expect(page.locator(`[data-testid="tour"][data-step="${step}"]`)).toHaveCount(0);
    }
    expect(visited).toEqual(["intro", "length", "input", "progress", "ready"]);
    await page.getByTestId("tour-start").click();
    await expect(page).toHaveURL(/\/session\?.*length=5/);
    await expect(page.getByTestId("left")).toHaveText(locale === "en" ? "1 of 5" : "1 av 5");

    // Help is one tap away on every screen, and shows the app map.
    const help = page.locator(
      '[data-testid="help-button"]:visible, [data-testid="nav-help"]:visible',
    );
    for (const path of ["/", "/atlas", "/stats", "/settings"]) {
      await page.goto(path);
      await expect(help).toBeVisible();
    }
    await help.click();
    // Help is a list of questions; each opens its answer.
    await expect(page.getByTestId("help-faq")).toBeVisible();
    const grading = page.getByTestId("faq-grading");
    await expect(grading.locator("p")).toBeHidden();
    await grading.locator("summary").click();
    await expect(grading.locator("p")).toContainText("You never grade yourself");
    // The tour can be replayed, and Escape ends it.
    await page.getByTestId("replay-tour").click();
    await expect(page.getByTestId("tour")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("tour")).toHaveCount(0);
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
  for (const theme of ["light", "dark"] as const) {
    for (const locale of ["en", "nb"] as const) {
      await chooseThemeAndLocale(page, theme, locale);
      await page.goto("/welcome");
      await expect(page.getByTestId("welcome-free")).toBeVisible();
      await page.waitForTimeout(800);
      await shot(`${theme}-${locale}-welcome`);
      await page.goto("/help");
      await expect(page.getByTestId("help-faq")).toBeVisible();
      await page.waitForTimeout(400);
      await shot(`${theme}-${locale}-help`);
    }
  }
});
