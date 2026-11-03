import { expect, type Page } from "@playwright/test";

export async function chooseThemeAndLocale(page: Page, theme: string, locale: string) {
  await page.goto("/settings");
  await page.getByTestId(`theme-${theme}`).click();
  await page.getByTestId(`locale-${locale}`).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
}

/** Welcome page, onboarding with Norway as home, a few placement answers, then finish early. */
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
  await skipTour(page);
}

/** Closes the guided tour that opens once after setup (PLAN.md 11.1). */
export async function skipTour(page: Page) {
  const tour = page.getByTestId("tour");
  await tour.waitFor({ state: "visible", timeout: 10_000 }).catch(() => undefined);
  if (await tour.isVisible()) {
    await page.keyboard.press("Escape");
    await expect(tour).toHaveCount(0);
  }
  // The tour closes at once and stores "done" a moment later; a full page load before that
  // write lands would abort it and bring the tour back.
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise<boolean>((resolve) => {
            const open = indexedDB.open("geodex");
            open.onsuccess = () => {
              const request = open.result
                .transaction("deviceSettings")
                .objectStore("deviceSettings")
                .getAll();
              request.onsuccess = () =>
                resolve(
                  (request.result as { tourDoneAt?: number | null }[]).some(
                    (row) => row.tourDoneAt != null,
                  ),
                );
            };
          }),
      ),
    )
    .toBe(true);
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

/** Appends review events to IndexedDB and clears the card cache, so a reload replays them. */
export async function seed(
  page: Page,
  cards: { cardId: string; daysAgo: number; rating: number }[],
  noNewCards = false,
) {
  await page.evaluate(
    ({ cards, noNewCards }) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("geodex");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction(
            ["reviewEvents", "cardState", "settings"],
            "readwrite",
          );
          if (noNewCards) {
            // Only the seeded cards come up (no new cards today), and all of them fit.
            const settings = tx.objectStore("settings");
            const get = settings.get("user");
            get.onsuccess = () =>
              settings.put({ ...get.result, newPerDayOverride: 0, dailyMinutes: 60 });
          }
          const events = tx.objectStore("reviewEvents");
          cards.forEach(({ cardId, daysAgo, rating }, i) => {
            events.put({
              id: `seed-${i}-${cardId}`,
              cardId,
              reviewedAt: Date.now() - daysAgo * 86_400_000,
              rating,
              mode: "mc",
              inputSetting: "mc",
              correct: rating > 1,
              chosenAnswer: null,
              responseMs: 3000,
              durationMs: 8000,
              snippetIds: [],
              scheduled: true,
              locale: "en",
              deviceId: "seed",
            });
          });
          tx.objectStore("cardState").clear();
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
      }),
    { cards, noNewCards },
  );
}
