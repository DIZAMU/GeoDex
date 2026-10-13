import { expect, type Page } from "@playwright/test";

export async function chooseThemeAndLocale(page: Page, theme: string, locale: string) {
  await page.goto("/settings");
  await page.getByTestId(`theme-${theme}`).click();
  await page.getByTestId(`locale-${locale}`).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
}

/** Onboarding with Norway as home, a few placement answers, then finish early. */
export async function setUpLearner(page: Page, placementAnswers = 4) {
  await page.goto("/");
  await page.getByTestId("setup").click();
  await page.getByTestId("country-search").fill("Norw");
  await page.locator('[data-country-option="NOR"]').click();
  await page.getByTestId("start-placement").click();
  await expect(page.getByTestId("placement")).toBeVisible();
  for (let i = 0; i < placementAnswers; i++) {
    await expect(page.getByTestId("prompt")).toBeVisible();
    await page.keyboard.press(String((i % 4) + 1));
    await expect(page.getByTestId("feedback")).toBeVisible();
    await page.keyboard.press("Enter");
  }
  await page.getByTestId("finish-placement").click();
  await expect(page.getByTestId("placement-result")).toBeVisible();
  await page.getByTestId("to-today").click();
  await expect(page.getByTestId("summary")).toBeVisible();
}

type Screen = "intro" | "prompt" | "feedback";

export async function currentScreen(page: Page): Promise<Screen> {
  const any = page
    .locator('[data-testid="intro"], [data-testid="prompt"], [data-testid="feedback"]')
    .first();
  await expect(any).toBeVisible();
  if (await page.getByTestId("intro").isVisible()) return "intro";
  if (await page.getByTestId("feedback").isVisible()) return "feedback";
  return "prompt";
}

/** Answers whatever the prompt asks: first option, a typed guess, or "show answer" on maps. */
export async function answerPrompt(page: Page) {
  if (await page.getByTestId("choices").isVisible()) await page.keyboard.press("1");
  else if (await page.getByTestId("flag-choices").isVisible()) await page.keyboard.press("1");
  else if (await page.getByTestId("typed-answer").isVisible()) {
    await page.getByTestId("typed-answer").fill("Sweden");
    await page.keyboard.press("Enter");
  } else {
    await page.getByTestId("give-up").click();
  }
  await expect(page.getByTestId("feedback")).toBeVisible();
}

export async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
}
