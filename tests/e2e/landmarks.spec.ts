import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { chooseThemeAndLocale, setUpLearner } from "./helpers";

const PHOTO = readFileSync(join(import.meta.dirname, "fixtures", "landmark.jpg"));

/** Commons photos come from a local fixture: tests never depend on Wikimedia's servers. */
async function servePhotos(context: BrowserContext, served: string[]) {
  await context.route(/^https:\/\/(upload|thumb)\.wikimedia\.org\//, (route) => {
    served.push(route.request().url());
    return route.fulfill({ status: 200, contentType: "image/jpeg", body: PHOTO });
  });
}

async function shot(page: Page, name: string) {
  await page.waitForTimeout(700); // the map flies to the answer
  await page.screenshot({
    path: join(
      test.info().project.outputDir,
      "screens",
      `${test.info().project.name}-landmarks-${name}.png`,
    ),
  });
}

/** Appends review events to IndexedDB and clears the card cache, so a reload replays them. */
async function seedHistory(page: Page, cardIds: string[], daysAgo: number) {
  await page.evaluate(
    ({ cardIds, daysAgo }) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("geodex");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction(["reviewEvents", "cardState"], "readwrite");
          const events = tx.objectStore("reviewEvents");
          cardIds.forEach((cardId, i) => {
            events.put({
              id: `seed-${i}-${cardId}`,
              cardId,
              reviewedAt: Date.now() - daysAgo * 86_400_000,
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
              synced: 0,
            });
          });
          tx.objectStore("cardState").clear();
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
      }),
    { cardIds, daysAgo },
  );
}

for (const locale of ["en", "nb"] as const) {
  test(`landmarks (${locale}): photo, country and pin cards with credits`, async ({
    page,
    context,
  }) => {
    test.setTimeout(300_000);
    const served: string[] = [];
    await servePhotos(context, served);
    await setUpLearner(page, 2);
    await chooseThemeAndLocale(page, "atlas", locale);
    await page.getByTestId("module-landmarks-on").click();
    // France known for days: its landmarks (Eiffel Tower, Mont-Saint-Michel...) can start.
    await seedHistory(page, ["FRA:map_to_name", "FRA:name_to_map"], 3);
    await page.goto("/");
    await expect(page.getByTestId("start")).toBeVisible();
    await page.goto("/session?input=mc");

    const photoRe = locale === "en" ? /What is this/ : /Hva er dette/;
    const countryRe = locale === "en" ? /Which country is .* in/ : /Hvilket land ligger .* i\?/;
    const pinRe = locale === "en" ? /Place .* on the map/ : /Plasser .* på kartet/;
    const france = locale === "en" ? /France/ : /Frankrike/;
    const seen = { photo: false, country: false, pin: false };
    for (let i = 0; i < 160 && !(seen.photo && seen.country && seen.pin); i++) {
      const screen = page
        .locator('[data-testid="intro"], [data-testid="prompt"], [data-testid="feedback"]')
        .first();
      await expect(screen).toBeVisible();
      if (await page.getByTestId("intro").isVisible()) {
        await page.keyboard.press("Enter");
        continue;
      }
      if (await page.getByTestId("feedback").isVisible()) {
        // Every photo on screen carries its credit.
        const photos = page.getByTestId("landmark-photo");
        for (const photo of await photos.all())
          await expect(photo.getByTestId("photo-credit")).toContainText(/(Photo|Foto): .+, .+/);
        await page.keyboard.press("Enter");
        await expect(page.getByTestId("feedback")).toBeHidden();
        continue;
      }
      const prompt = (await page.getByTestId("prompt").textContent()) ?? "";
      if (photoRe.test(prompt) && !seen.photo) {
        seen.photo = true;
        const photo = page.getByTestId("landmark-photo");
        await expect(photo.locator("img")).toHaveJSProperty("complete", true);
        expect(
          await photo.locator("img").evaluate((img: HTMLImageElement) => img.naturalWidth),
        ).toBe(480);
        await expect(photo.getByTestId("photo-credit")).toBeVisible();
        await expect(photo.getByTestId("photo-credit").locator("a")).toHaveAttribute(
          "href",
          /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/,
        );
        // The prompt photo's description must not give the answer away.
        const alt = (await photo.locator("img").getAttribute("alt")) ?? "";
        const options = await page.getByTestId("choices").getByRole("button").allTextContents();
        for (const o of options) expect(alt).not.toContain(o.replace(/^\d/, ""));
        await shot(page, `${locale}-photo-prompt`);
        await page.keyboard.press("1");
        await expect(page.getByTestId("landmark-card")).toBeVisible();
        await shot(page, `${locale}-photo-feedback`);
        continue;
      }
      if (countryRe.test(prompt) && !seen.country) {
        seen.country = true;
        await page.getByTestId("choices").getByRole("button", { name: france }).click();
        await expect(page.getByTestId("status")).toHaveAttribute("data-correct", "true");
        await expect(page.getByTestId("landmark-card")).toBeVisible();
        continue;
      }
      if (pinRe.test(prompt) && !seen.pin) {
        seen.pin = true;
        await page.waitForTimeout(800); // the map flies to the region
        const box = await page.locator("svg.world-map").boundingBox();
        if (!box) throw new Error("no map");
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        await expect(page.getByTestId("pin-distance")).toBeVisible();
        await expect(page.getByTestId("landmark-card")).toBeVisible();
        await shot(page, `${locale}-pin-feedback`);
        continue;
      }
      if (await page.getByTestId("choices").isVisible()) await page.keyboard.press("1");
      else if (await page.getByTestId("flag-choices").isVisible()) await page.keyboard.press("1");
      else await page.getByTestId("give-up").click();
    }
    expect(seen).toEqual({ photo: true, country: true, pin: true });
    expect(served.length).toBeGreaterThan(0);
  });
}

test("a photo seen once loads offline", async ({ page, context }) => {
  test.setTimeout(120_000);
  const served: string[] = [];
  await servePhotos(context, served);
  await page.goto("/");
  await expect(page.getByTestId("setup")).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), {
          once: true,
        }),
      );
    }
  });
  const url =
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a8/Tour_Eiffel_Wikimedia_Commons.jpg/960px-Tour_Eiffel_Wikimedia_Commons.jpg";
  const load = (src: string) =>
    page.evaluate(
      (src) =>
        new Promise<number>((resolve) => {
          const img = new Image();
          img.onload = () => resolve(img.naturalWidth);
          img.onerror = () => resolve(0);
          img.src = src;
        }),
      src,
    );
  // First view online: the service worker fetches the photo and keeps it.
  expect(await load(url)).toBe(480);
  await page.waitForFunction(async (url) => {
    const cache = await caches.open("commons-photos");
    return Boolean(await cache.match(url));
  }, url);
  // Offline, with Commons unreachable: the photo still loads, from the cache.
  await context.unroute(/^https:\/\/(upload|thumb)\.wikimedia\.org\//);
  await context.setOffline(true);
  await page.reload();
  expect(await load(url)).toBe(480);
  // A photo never seen does not.
  expect(await load(url.replace("Tour_Eiffel", "Never_Seen"))).toBe(0);
  await context.setOffline(false);
});
