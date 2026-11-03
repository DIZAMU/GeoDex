/**
 * Records the README demo (PLAN.md Phase 10). Skipped unless DEMO=1:
 * `pnpm docs:demo` saves frames, then ffmpeg turns them into docs/media/demo.gif.
 */
import { mkdirSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { setUpLearner } from "./helpers";

test.skip(!process.env.DEMO, "records the README demo only when DEMO=1");

test("demo", async ({ browser }) => {
  test.setTimeout(240_000);
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    colorScheme: "dark",
  });
  const page = await context.newPage();
  await setUpLearner(page);
  mkdirSync("test-results/demo", { recursive: true });
  let frame = 0;
  /** Waits while saving frames, about 8 a second. */
  const hold = async (p: Page, ms: number) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      const name = String(frame++).padStart(4, "0");
      await p.screenshot({ path: `test-results/demo/frame${name}.png` });
      await p.waitForTimeout(60);
    }
  };
  await page.goto("/");
  await hold(page, 1500);
  await page.getByTestId("start").click();
  for (let i = 0; i < 7; i++) {
    const screen = page
      .locator('[data-testid="intro"], [data-testid="prompt"], [data-testid="feedback"]')
      .first();
    await expect(screen).toBeVisible();
    await hold(page, 1300);
    if (await page.getByTestId("intro").isVisible()) await page.keyboard.press("Enter");
    else if (await page.getByTestId("feedback").isVisible()) {
      await hold(page, 1200);
      await page.keyboard.press("Enter");
    } else if (await page.getByTestId("choices").isVisible()) await page.keyboard.press("2");
    else if (await page.getByTestId("give-up").isVisible())
      await page.getByTestId("give-up").click();
    else await page.keyboard.press("Enter");
  }
  await page.goto("/atlas?view=time&year=117");
  await expect(page.getByTestId("timeline-list")).toBeVisible();
  await hold(page, 1500);
  for (const year of [800, 1279, 1683, 1914]) {
    await page.getByTestId("timeline-slider").fill(String(year));
    await hold(page, 1100);
  }
  await page.goto("/atlas/NOR");
  await expect(page.getByTestId("entry-cards")).toBeVisible();
  await hold(page, 1800);
  await context.close();
});

test("readme screenshots", async ({ browser }) => {
  test.setTimeout(240_000);
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await setUpLearner(page);
  for (const theme of ["light", "dark"] as const) {
    await page.goto("/settings");
    await page.getByTestId(`theme-${theme}`).click();
    await page.goto("/session?input=mc");
    // The first card that shows a map answer at feedback.
    for (let i = 0; i < 12; i++) {
      await expect(
        page
          .locator('[data-testid="intro"], [data-testid="prompt"], [data-testid="feedback"]')
          .first(),
      ).toBeVisible();
      if (await page.getByTestId("feedback").isVisible()) {
        if ((await page.getByTestId("explanation").count()) > 0) break;
        await page.keyboard.press("Enter");
        await expect(page.getByTestId("feedback")).toHaveCount(0);
        continue;
      }
      if (await page.getByTestId("intro").isVisible()) await page.keyboard.press("Enter");
      else if (await page.getByTestId("choices").isVisible()) await page.keyboard.press("1");
      else if (await page.getByTestId("give-up").isVisible())
        await page.getByTestId("give-up").click();
      else await page.keyboard.press("Enter");
    }
    await page.mouse.move(0, 0);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `docs/media/${theme}-session.png` });
    await page.goto("/atlas?view=flat");
    await expect(page.getByTestId("atlas-regions")).toBeVisible();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `docs/media/${theme}-atlas.png` });
  }
  await page.goto("/atlas?view=time&year=1279");
  await expect(page.getByTestId("timeline-list")).toBeVisible();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "docs/media/timeline.png" });
  await context.close();
});
