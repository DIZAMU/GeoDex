import { expect, test } from "@playwright/test";
import { answerPrompt, currentScreen, noHorizontalScroll, setUpLearner } from "./helpers";

test("placement test, then a 10-card session", async ({ page }) => {
  test.setTimeout(120_000);
  await setUpLearner(page, 6);
  await noHorizontalScroll(page);

  await page.getByTestId("start").click();
  let answered = 0;
  while (answered < 10) {
    const screen = await currentScreen(page);
    if (screen === "intro") {
      await page.keyboard.press("Enter");
    } else if (screen === "prompt") {
      await noHorizontalScroll(page);
      await answerPrompt(page);
    } else {
      await page.keyboard.press("Enter");
      answered++;
      // Continue moves on; wait until the feedback panel is gone or replaced.
      await expect(page.getByTestId("feedback")).toBeHidden();
    }
  }
  await page.getByRole("button", { name: "End session" }).click();
  await expect(page.getByTestId("reviewed")).toHaveText("10 reviews");

  // Events survive a reload and today's counts reflect them.
  await page.goto("/");
  await expect(page.getByTestId("summary")).toBeVisible();
  const reviews = await page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const open = indexedDB.open("geodex");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const request = open.result
            .transaction("reviewEvents")
            .objectStore("reviewEvents")
            .count();
          request.onsuccess = () => resolve(request.result);
        };
      }),
  );
  expect(reviews).toBe(16);
});
