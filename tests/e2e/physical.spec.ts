import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { chooseThemeAndLocale, seed, setUpLearner, turnOn } from "./helpers";

type Feature = { id: string; kind: string; names: { en: string; nb: string } };
const FEATURES = (JSON.parse(readFileSync("data/physical.json", "utf8")) as { features: Feature[] })
  .features;

/**
 * A whole-pixel screen point where the topmost tappable feature is `id`, inside the map:
 * along the line for rivers, inside the shape for everything else. Null when there is none.
 */
async function tapPoint(page: Page, id: string): Promise<{ x: number; y: number } | null> {
  return page.evaluate((id) => {
    const path = document.querySelector<SVGPathElement>(`path.map-feature[data-feature="${id}"]`);
    if (!path) return null;
    const svg = path.ownerSVGElement as SVGSVGElement;
    const frame = svg.getBoundingClientRect();
    const topmost = (x: number, y: number) =>
      document
        .elementsFromPoint(x, y)
        .map((el) => el.getAttribute("data-feature"))
        .find((f) => f !== null);
    const ok = (x: number, y: number) =>
      x > frame.left + 4 &&
      x < frame.right - 4 &&
      y > frame.top + 4 &&
      y < frame.bottom - 4 &&
      topmost(x, y) === id;
    if (path.classList.contains("map-feature-river")) {
      const ctm = path.getScreenCTM();
      if (!ctm) return null;
      const length = path.getTotalLength();
      for (let i = 0; i <= 200; i++) {
        const p = path.getPointAtLength((length * i) / 200).matrixTransform(ctm);
        const x = Math.round(p.x);
        const y = Math.round(p.y);
        if (ok(x, y)) return { x, y };
      }
      return null;
    }
    const box = path.getBoundingClientRect();
    const step = Math.max(2, Math.min(box.width, box.height) / 40);
    for (let y = Math.ceil(box.top); y < box.bottom; y += step) {
      for (let x = Math.ceil(box.left); x < box.right; x += step) {
        const px = Math.round(x);
        const py = Math.round(y);
        if (ok(px, py) && ok(px - 2, py) && ok(px + 2, py) && ok(px, py - 2) && ok(px, py + 2))
          return { x: px, y: py };
      }
    }
    return null;
  }, id);
}

const SLICES = [
  ["oceans and seas", ["ocean", "sea"]],
  ["rivers", ["river"]],
  ["lakes, ranges and deserts", ["lake", "mountain_range", "desert"]],
] as const;

for (const [name, kinds] of SLICES) {
  test(`every feature renders and is tappable at its default zoom: ${name}`, async ({ page }) => {
    test.setTimeout(600_000);
    const features = FEATURES.filter((f) => (kinds as readonly string[]).includes(f.kind));
    await setUpLearner(page);
    await page.goto("/settings?tab=topics");
    await turnOn(page, "module-physical-switch");
    // Norway known, and every feature card of this slice due again after a miss, so the
    // session shows each one at the zoom of a new card.
    await seed(page, [
      { cardId: "NOR:map_to_name", daysAgo: 5, rating: 3 },
      { cardId: "NOR:name_to_map", daysAgo: 5, rating: 3 },
      ...features.flatMap((f) => [
        { cardId: `${f.id}:feature_to_map`, daysAgo: 2, rating: 1 },
        { cardId: `${f.id}:map_to_feature`, daysAgo: 2, rating: 1 },
      ]),
    ]);
    await page.goto("/");
    await expect(page.getByTestId("start")).toBeVisible();
    await page.goto("/session?input=mc");

    const tapped = new Set<string>();
    const shown = new Set<string>();
    const byName = new Map(features.map((f) => [f.names.en, f]));
    for (
      let i = 0;
      i < 400 && (tapped.size < features.length || shown.size < features.length);
      i++
    ) {
      const screen = page
        .locator(
          '[data-testid="intro"], [data-testid="prompt"], [data-testid="feedback"], [data-testid="session-summary"]',
        )
        .first();
      await expect(screen).toBeVisible();
      // The day's budget can split the slice over more than one session.
      if (await page.getByTestId("session-summary").isVisible()) {
        await page.goto("/session?input=mc");
        continue;
      }
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
      const tap = prompt.match(/^Tap on the map: (.+)$/);
      const feature = tap ? byName.get(tap[1] ?? "") : undefined;
      if (feature) {
        await page.waitForTimeout(700); // the map flies to the region
        const point = await tapPoint(page, feature.id);
        expect(point, `${feature.names.en} has no tappable point`).not.toBeNull();
        if (!point) continue;
        await page.mouse.click(point.x, point.y);
        await expect(page.getByTestId("status"), feature.names.en).toHaveAttribute(
          "data-correct",
          "true",
        );
        await expect(page.getByTestId("feature-card")).toBeVisible();
        tapped.add(feature.id);
        continue;
      }
      if (/^What is this .+ called\?$/.test(prompt)) {
        await page.waitForTimeout(500);
        const selected = page.getByTestId("feature-selected");
        await expect(selected).toHaveCount(1);
        const id = (await selected.getAttribute("data-feature")) ?? "";
        const box = await selected.boundingBox();
        expect(box && box.width + box.height, id).toBeGreaterThan(4);
        if (features.some((f) => f.id === id)) shown.add(id);
        await page.keyboard.press("1");
        continue;
      }
      if (await page.getByTestId("choices").isVisible()) await page.keyboard.press("1");
      else if (await page.getByTestId("flag-choices").isVisible()) await page.keyboard.press("1");
      else await page.getByTestId("give-up").click();
    }
    expect([...tapped].sort()).toEqual(features.map((f) => f.id).sort());
    expect([...shown].sort()).toEqual(features.map((f) => f.id).sort());
  });
}

test("physical cards in every theme and language", async ({ page }) => {
  test.setTimeout(300_000);
  await setUpLearner(page);
  // Each round has its own river and country: reviews from one round reschedule its cards.
  const rounds = [
    ["dark", "en", "Q3392", "EGY"],
    ["dark", "nb", "Q1653", "AUT"],
    ["light", "en", "Q584", "DEU"],
    ["light", "nb", "Q5089", "IND"],
    ["light", "en", "Q3783", "BRA"],
    ["light", "nb", "Q1497", "USA"],
  ] as const;
  for (const [theme, locale, featureId, countryId] of rounds) {
    const feature = FEATURES.find((f) => f.id === featureId) as Feature;
    await chooseThemeAndLocale(page, theme, locale);
    await turnOn(page, "module-physical-switch");
    await seed(
      page,
      [
        { cardId: `${countryId}:map_to_name`, daysAgo: 5, rating: 3 },
        { cardId: `${countryId}:name_to_map`, daysAgo: 5, rating: 3 },
        { cardId: `${feature.id}:feature_to_map`, daysAgo: 2, rating: 1 },
        { cardId: `${feature.id}:map_to_feature`, daysAgo: 2, rating: 1 },
      ],
      true,
    );
    await page.goto("/session?input=mc");
    const seen = { tap: false, name: false };
    for (let i = 0; i < 80 && !(seen.tap && seen.name); i++) {
      const screen = page
        .locator('[data-testid="intro"], [data-testid="prompt"], [data-testid="feedback"]')
        .first();
      await expect(screen).toBeVisible();
      if (!(await page.getByTestId("prompt").isVisible())) {
        await page.keyboard.press("Enter");
        await page.waitForTimeout(100);
        continue;
      }
      const prompt = (await page.getByTestId("prompt").textContent()) ?? "";
      if (prompt.endsWith(`: ${feature.names[locale]}`) && !seen.tap) {
        seen.tap = true;
        await page.waitForTimeout(700);
        await shot(page, `${theme}-${locale}-tap-prompt`);
        const point = await tapPoint(page, feature.id);
        if (!point) throw new Error(`no point on ${feature.names.en}`);
        await page.mouse.click(point.x, point.y);
        await expect(page.getByTestId("feature-card")).toBeVisible();
        await shot(page, `${theme}-${locale}-tap-feedback`);
        continue;
      }
      if (
        (await page.getByTestId("feature-selected").count()) > 0 &&
        (await page.getByTestId("feature-selected").getAttribute("data-feature")) === feature.id &&
        !seen.name
      ) {
        seen.name = true;
        await page.waitForTimeout(500);
        await shot(page, `${theme}-${locale}-name-prompt`);
        await page.keyboard.press("1");
        await expect(page.getByTestId("feature-card")).toBeVisible();
        await shot(page, `${theme}-${locale}-name-feedback`);
        continue;
      }
      if (await page.getByTestId("choices").isVisible()) await page.keyboard.press("1");
      else if (await page.getByTestId("flag-choices").isVisible()) await page.keyboard.press("1");
      else if (await page.getByTestId("give-up").isVisible())
        await page.getByTestId("give-up").click();
      else await page.keyboard.press("Enter");
    }
    expect(seen, `${theme} ${locale}`).toEqual({ tap: true, name: true });
    await page.keyboard.press("Escape");
  }
});

async function shot(page: Page, name: string) {
  await page.waitForTimeout(500);
  await page.screenshot({
    path: join(
      test.info().project.outputDir,
      "screens",
      `${test.info().project.name}-physical-${name}.png`,
    ),
  });
}
