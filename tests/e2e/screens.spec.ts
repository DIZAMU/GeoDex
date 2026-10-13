import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import {
  answerPrompt,
  chooseThemeAndLocale,
  currentScreen,
  noHorizontalScroll,
  setUpLearner,
} from "./helpers";

const THEMES = ["atlas", "minimal", "playful"] as const;
const LOCALES = ["en", "nb"] as const;

async function shot(page: Page, name: string) {
  await page.mouse.move(0, 0);
  await page.waitForTimeout(700); // let the map fly-to settle
  await page.screenshot({
    path: join(test.info().project.outputDir, "screens", `${test.info().project.name}-${name}.png`),
    animations: "disabled",
  });
}

for (const theme of THEMES) {
  for (const locale of LOCALES) {
    test(`screens in ${theme} / ${locale}`, async ({ page }) => {
      test.setTimeout(120_000);
      await chooseThemeAndLocale(page, theme, locale);
      await shot(page, `${theme}-${locale}-settings`);
      await noHorizontalScroll(page);

      // Onboarding in the chosen language, then English names are not needed for the flow.
      await chooseThemeAndLocale(page, theme, "en");
      await setUpLearner(page, 2);
      await chooseThemeAndLocale(page, theme, locale);
      await page.goto("/");
      await expect(page.getByTestId("summary")).toBeVisible();
      await shot(page, `${theme}-${locale}-today`);

      await page.getByTestId("start").click();
      let screen = await currentScreen(page);
      if (screen === "intro") {
        await shot(page, `${theme}-${locale}-intro`);
        await page.keyboard.press("Enter");
        screen = await currentScreen(page);
      }
      await shot(page, `${theme}-${locale}-prompt`);
      await noHorizontalScroll(page);
      await answerPrompt(page);
      await shot(page, `${theme}-${locale}-feedback`);
      await noHorizontalScroll(page);
    });
  }
}
