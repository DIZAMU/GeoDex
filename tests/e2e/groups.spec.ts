import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { chooseThemeAndLocale, setUpLearner } from "./helpers";

async function shot(page: Page, name: string) {
  await page.waitForTimeout(700); // the map flies to the answer
  await page.screenshot({
    path: join(
      test.info().project.outputDir,
      "screens",
      `${test.info().project.name}-groups-${name}.png`,
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

/** A whole-pixel point inside a country's shape, clear of every marker's tap target. */
async function pointIn(page: Page, id: string): Promise<{ x: number; y: number }> {
  return page.evaluate((id) => {
    const path = document.querySelector<SVGPathElement>(`path.map-country[data-country="${id}"]`);
    if (!path) throw new Error(`no path for ${id}`);
    const svg = path.ownerSVGElement as SVGSVGElement;
    const rect = svg.getBoundingClientRect();
    const box = path.getBoundingClientRect();
    const markers = [...svg.querySelectorAll<SVGGElement>("g[data-marker]")].map((g) => ({
      x: Number(g.dataset.x),
      y: Number(g.dataset.y),
    }));
    const inside = (x: number, y: number) =>
      [-2, 0, 2].every((ox) =>
        [-2, 0, 2].every((oy) => document.elementsFromPoint(x + ox, y + oy).includes(path)),
      );
    for (let y = Math.ceil(box.top); y < box.bottom; y += 2) {
      for (let x = Math.ceil(box.left); x < box.right; x += 2) {
        if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) continue;
        if (!inside(x, y)) continue;
        const sx = x - rect.left;
        const sy = y - rect.top;
        if (markers.some((m) => Math.hypot(m.x - sx, m.y - sy) < 24)) continue;
        return { x, y };
      }
    }
    throw new Error(`no clear point in ${id}`);
  }, id);
}

for (const locale of ["en", "nb"] as const) {
  test(`groups (${locale}): tap Scandinavia, name a group, pick a member`, async ({ page }) => {
    test.setTimeout(300_000);
    await setUpLearner(page, 2);
    await chooseThemeAndLocale(page, "dark", locale);
    await page.getByTestId("module-groups-on").click();
    // Norway and Sweden known for days: Scandinavia (half its members) can start.
    await seedHistory(
      page,
      ["NOR", "SWE"].flatMap((id) => [`${id}:map_to_name`, `${id}:name_to_map`]),
      3,
    );
    await page.goto("/");
    await expect(page.getByTestId("start")).toBeVisible();
    await page.goto("/session?input=mc");

    const tapRe =
      locale === "en"
        ? /Tap every country that is in Scandinavia/
        : /Trykk på alle land som er i Skandinavia/;
    const nameRe =
      locale === "en" ? /Which group of countries is highlighted/ : /Hvilken landgruppe er markert/;
    const memberRe =
      locale === "en"
        ? /Which of these is in Scandinavia/
        : /Hvilket av disse landene er i Skandinavia/;
    const seen = { taps: false, name: false, member: false };
    for (let i = 0; i < 160 && !(seen.taps && seen.name && seen.member); i++) {
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
      if (tapRe.test(prompt)) {
        seen.taps = true;
        await page.waitForTimeout(800); // the map flies to the region
        await expect(page.getByTestId("tap-check")).toBeDisabled();
        for (const id of ["NOR", "SWE", "DNK", "EST"]) {
          const p = await pointIn(page, id);
          await page.mouse.click(p.x, p.y);
        }
        await expect(page.locator('[data-testid="map-selected"]')).toHaveCount(4);
        // A second tap removes a country.
        const est = await pointIn(page, "EST");
        await page.mouse.click(est.x, est.y);
        await expect(page.getByTestId("tap-count")).toContainText("3");
        await shot(page, `${locale}-taps-prompt`);
        await page.keyboard.press("Enter");
        await expect(page.getByTestId("status")).toHaveAttribute("data-correct", "true");
        await expect(page.getByTestId("group-card")).toBeVisible();
        await expect(page.getByTestId("group-sometimes")).toBeVisible();
        await expect(page.locator('[data-testid="map-target"]')).toHaveCount(3);
        await shot(page, `${locale}-taps-feedback`);
        continue;
      }
      if (nameRe.test(prompt) && (await page.getByTestId("choices").isVisible())) {
        if (await page.locator('[data-testid="map-selected"]').count()) {
          const ids = await page
            .locator('[data-testid="map-selected"]')
            .evaluateAll((els) => els.map((e) => e.getAttribute("data-id")).sort());
          if (ids.join() === "DNK,NOR,SWE") {
            seen.name = true;
            await shot(page, `${locale}-name-prompt`);
            await page
              .getByTestId("choices")
              .getByRole("button", { name: locale === "en" ? /Scandinavia/ : /Skandinavia/ })
              .click();
            await expect(page.getByTestId("status")).toHaveAttribute("data-correct", "true");
            continue;
          }
        }
      }
      if (memberRe.test(prompt)) {
        seen.member = true;
        const options = page.getByTestId("choices").getByRole("button");
        await expect(options).toHaveCount(4);
        const labels = await options.allTextContents();
        const members =
          locale === "en" ? ["Norway", "Sweden", "Denmark"] : ["Norge", "Sverige", "Danmark"];
        const others = locale === "en" ? ["Finland", "Iceland"] : ["Finland", "Island"];
        expect(labels.filter((l) => members.some((m) => l.includes(m)))).toHaveLength(1);
        expect(labels.some((l) => others.some((o) => l.endsWith(o)))).toBe(false);
        await shot(page, `${locale}-member-prompt`);
        // Pick a wrong one on purpose: the feedback names it and the group card shows.
        const wrong = labels.findIndex((l) => !members.some((m) => l.includes(m)));
        await page.keyboard.press(String(wrong + 1));
        await expect(page.getByTestId("status")).toHaveAttribute("data-correct", "false");
        await expect(page.getByTestId("group-members")).toBeVisible();
        await shot(page, `${locale}-member-feedback`);
        continue;
      }
      if (await page.getByTestId("choices").isVisible()) await page.keyboard.press("1");
      else if (await page.getByTestId("flag-choices").isVisible()) await page.keyboard.press("1");
      else await page.getByTestId("give-up").click();
    }
    expect(seen).toEqual({ taps: true, name: true, member: true });
  });
}
