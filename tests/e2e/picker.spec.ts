import { expect, test } from "@playwright/test";
import { answerPrompt, chooseThemeAndLocale, currentScreen, setUpLearner } from "./helpers";

/** Answers until the summary shows; returns how many questions were answered. */
async function finishSession(page: import("@playwright/test").Page): Promise<number> {
  let answered = 0;
  for (let i = 0; i < 80; i++) {
    if (await page.getByTestId("session-summary").isVisible()) return answered;
    const screen = await currentScreen(page).catch(() => null);
    if (screen === null) continue;
    if (screen === "intro") await page.keyboard.press("Enter");
    else if (screen === "prompt") await answerPrompt(page);
    else {
      await page.keyboard.press("Enter");
      answered++;
      await expect(page.getByTestId("feedback")).toBeHidden();
    }
  }
  return answered;
}

test("a 5-question session holds exactly 5 and shows its position", async ({ page }) => {
  test.setTimeout(120_000);
  await setUpLearner(page, 6);
  await page.getByTestId("length-5").click();
  await expect(page.getByTestId("start")).toHaveText(/Start 5 questions/);
  await page.getByTestId("start").click();
  await expect(page.getByTestId("left")).toHaveText("1 of 5");
  await expect(page).toHaveURL(/length=5/);

  // Position moves only when the learner continues past feedback.
  await answerPrompt(page);
  await expect(page.getByTestId("left")).toHaveText("1 of 5");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("left")).toHaveText("2 of 5");

  expect(await finishSession(page)).toBe(4);
  await expect(page.getByTestId("reviewed")).toHaveText("5 reviews");

  // Another round in the same length starts a fresh session.
  await expect(page.getByTestId("again")).toBeVisible();
  await page.getByTestId("again").click();
  await expect(page.getByTestId("left")).toHaveText("1 of 5");

  // The length is remembered on Today.
  await page.goto("/");
  await expect(page.getByTestId("length-5")).toHaveAttribute("data-state", "on");
});

test("a focused session asks only that skill", async ({ page }) => {
  test.setTimeout(120_000);
  await setUpLearner(page, 6);
  const focus = page.getByTestId("focus");
  await focus.selectOption("skill:location");
  await expect(focus).toHaveValue("skill:location");
  await page.getByTestId("start").click();
  await expect(page).toHaveURL(/focus=skill%3Alocation/);
  for (let i = 0; i < 4; i++) {
    const screen = await currentScreen(page);
    if (screen === "intro") {
      await page.keyboard.press("Enter");
      continue;
    }
    if (screen === "feedback") {
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("feedback")).toBeHidden();
      continue;
    }
    // Every prompt in a map focus is a map card.
    const card = (await page.getByTestId("prompt").getAttribute("data-card")) ?? "";
    expect(card).toMatch(/:(map_to_name|name_to_map)$/);
    await answerPrompt(page);
  }
});

test("the picker fits and reads well on phone, in both languages", async ({ page }) => {
  test.setTimeout(120_000);
  await setUpLearner(page, 6);
  for (const locale of ["en", "nb"]) {
    for (const theme of ["atlas", "minimal", "playful"]) {
      await chooseThemeAndLocale(page, theme, locale);
      await page.goto("/");
      await expect(page.getByTestId("picker")).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBe(0);
      await page.screenshot({
        path: `test-results/screens/picker-${theme}-${locale}-${page.viewportSize()?.width}.png`,
        fullPage: true,
      });
    }
  }
});
