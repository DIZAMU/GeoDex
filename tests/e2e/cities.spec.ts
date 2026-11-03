import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { setUpLearner } from "./helpers";

async function shot(page: Page, name: string) {
  await page.waitForTimeout(700); // the map flies to the answer
  await page.screenshot({
    path: join(
      test.info().project.outputDir,
      "screens",
      `${test.info().project.name}-cities-${name}.png`,
    ),
  });
}

/** Appends review events to IndexedDB and clears the card cache, so a reload replays them. */
async function seedHistory(page: Page, cards: { cardId: string; daysAgo: number }[]) {
  await page.evaluate(
    (cards) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("geodex");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction(["reviewEvents", "cardState"], "readwrite");
          const events = tx.objectStore("reviewEvents");
          cards.forEach(({ cardId, daysAgo }, i) => {
            const reviewedAt = Date.now() - daysAgo * 86_400_000;
            events.put({
              id: `seed-${i}-${cardId}`,
              cardId,
              reviewedAt,
              rating: 3,
              mode: "mc",
              inputSetting: "mc",
              correct: true,
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
    cards,
  );
}

test("cities: a city question, a pin answer and the not-the-capital card", async ({ page }) => {
  test.setTimeout(300_000);
  await setUpLearner(page, 2);
  await page.goto("/settings");
  await page.getByTestId("module-cities-on").click();
  // Australia known for days and Sydney started yesterday: Melbourne's and Sydney's other
  // cards are new, and Sydney's not-the-capital card is seeded.
  await seedHistory(page, [
    { cardId: "AUS:map_to_name", daysAgo: 3 },
    { cardId: "AUS:name_to_map", daysAgo: 3 },
    { cardId: "Q3130:city_to_country", daysAgo: 1 },
  ]);
  await page.goto("/");
  await expect(page.getByTestId("start")).toBeVisible();
  await page.goto("/session?input=mc");

  const seen = { city: false, pin: false, capital: false };
  for (let i = 0; i < 160 && !(seen.city && seen.pin && seen.capital); i++) {
    const screen = page
      .locator('[data-testid="intro"], [data-testid="prompt"], [data-testid="feedback"]')
      .first();
    await expect(screen).toBeVisible();
    if (await page.getByTestId("intro").isVisible()) {
      await page.keyboard.press("Enter");
      continue;
    }
    if (await page.getByTestId("feedback").isVisible()) {
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("feedback")).toBeHidden();
      continue;
    }
    const prompt = (await page.getByTestId("prompt").textContent()) ?? "";
    if (/Which is the capital of Australia/.test(prompt)) {
      seen.capital = true;
      const options = page.getByTestId("choices").getByRole("button");
      await expect(options).toHaveCount(2);
      await expect(page.getByTestId("choices")).toContainText("Canberra");
      await expect(page.getByTestId("choices")).toContainText("Sydney");
      await page
        .getByTestId("choices")
        .getByRole("button", { name: /Canberra/ })
        .click();
      await expect(page.getByTestId("feedback")).toContainText("Correct");
      await shot(page, "not-capital");
      continue;
    }
    if (/Place .* on the map/.test(prompt)) {
      seen.pin = true;
      await page.waitForTimeout(800); // let the map finish flying to the region
      const map = page.locator("svg.world-map");
      const box = await map.boundingBox();
      if (!box) throw new Error("no map");
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await expect(page.getByTestId("pin-distance")).toBeVisible();
      // The view is Australia and New Zealand, so a tap in its middle lands within a few
      // thousand km, not across the world.
      const distance = Number(
        ((await page.getByTestId("pin-distance").textContent()) ?? "").replace(/[^\d]/g, ""),
      );
      expect(distance).toBeLessThan(5000);
      await expect(page.getByTestId("city-card")).toBeVisible();
      await shot(page, "pin");
      continue;
    }
    if (/Which country is .* in/.test(prompt)) {
      seen.city = true;
      await shot(page, "city-prompt");
      await page
        .getByTestId("choices")
        .getByRole("button", { name: /Australia/ })
        .click();
      await expect(page.getByTestId("city-card")).toBeVisible();
      continue;
    }
    // Any other card: take the first option or show the answer.
    if (await page.getByTestId("choices").isVisible()) await page.keyboard.press("1");
    else if (await page.getByTestId("flag-choices").isVisible()) await page.keyboard.press("1");
    else await page.getByTestId("give-up").click();
  }
  expect(seen).toEqual({ city: true, pin: true, capital: true });
});
