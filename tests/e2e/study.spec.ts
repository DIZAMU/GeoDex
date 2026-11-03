import { expect, test } from "@playwright/test";
import { answerPrompt, currentScreen, noHorizontalScroll, setUpLearner } from "./helpers";

test("setup, then a 10-question session", async ({ page }) => {
  test.setTimeout(120_000);
  await setUpLearner(page);
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
      // Every answer shows moment content (PLAN.md Phase 3 acceptance).
      await expect(page.getByTestId("explanation")).toBeVisible();
      await page.keyboard.press("Enter");
      answered++;
      // Continue moves on; wait until the feedback panel is gone or replaced.
      await expect(page.getByTestId("feedback")).toBeHidden();
    }
  }
  // The picker's default session holds 10 questions and ends on its own (PLAN.md 11.2).
  await expect(page.getByTestId("reviewed")).toContainText("10 reviews");

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
  // No placement test in 2.0: the ten answers are the only events.
  expect(reviews).toBe(10);

  // Every scheduled session review recorded the snippets it showed.
  const withSnippets = await page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const open = indexedDB.open("geodex");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const request = open.result
            .transaction("reviewEvents")
            .objectStore("reviewEvents")
            .getAll();
          request.onsuccess = () =>
            resolve(
              (request.result as { mode: string; snippetIds: string[] }[]).filter(
                (e) => e.mode !== "placement" && e.snippetIds.length > 0,
              ).length,
            );
        };
      }),
  );
  expect(withSnippets).toBe(10);
});
