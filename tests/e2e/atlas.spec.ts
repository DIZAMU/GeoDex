import { expect, type Page, test } from "@playwright/test";
import { setUpLearner } from "./helpers";

/** A point inside a country's shape, preferring one under another country's tap target. */
async function pointIn(
  page: Page,
  id: string,
): Promise<{ x: number; y: number; contested: boolean; nearest?: number }> {
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
    let fallback: { x: number; y: number } | null = null;
    // Whole pixels, clear of the coastline: clicks report integer coordinates.
    const inside = (x: number, y: number) =>
      [-1, 0, 1].every((ox) =>
        [-1, 0, 1].every((oy) => document.elementsFromPoint(x + ox, y + oy).includes(path)),
      );
    for (let y = Math.ceil(box.top); y < box.bottom; y += 1) {
      for (let x = Math.ceil(box.left); x < box.right; x += 1) {
        if (!inside(x, y)) continue;
        const sx = x - rect.left;
        const sy = y - rect.top;
        // Inside another country's tap target, but clear of its visible dot.
        const nearest = Math.min(...markers.map((m) => Math.hypot(m.x - sx, m.y - sy)));
        const near = nearest > 10 && nearest < 22;
        if (near) return { x, y, contested: true, nearest };
        fallback ??= { x, y };
      }
    }
    if (!fallback) throw new Error(`no visible point in ${id}`);
    return { ...fallback, contested: false };
  }, id);
}

test("a tap on a country opens it, even next to small neighbors' tap targets", async ({ page }) => {
  await setUpLearner(page, 2);
  await page.goto("/atlas");
  await expect(page.getByTestId("atlas-regions")).toBeVisible();
  // Measure after the entry animation, or the map moves between measuring and clicking.
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every((a) => a.playState !== "running" || a.effect?.getTiming().iterations === Infinity),
  );
  const point = await pointIn(page, "NOR");
  // At laptop size, part of Norway lies under other countries' tap targets: the case that
  // used to open Estonia or Denmark. On a phone the world view is too small for that.
  if (test.info().project.name === "desktop") expect(point.contested).toBe(true);
  await page.mouse.click(point.x, point.y);
  await expect(page).toHaveURL(/\/atlas\/NOR$/);
});

test("dragging sideways turns the globe without opening a country", async ({ page }) => {
  await setUpLearner(page, 2);
  await page.goto("/atlas");
  const map = page.getByTestId("atlas-map");
  await expect(map).toBeVisible();
  const before = await page.locator('path.map-country[data-country="BRA"]').getAttribute("d");
  const box = await map.boundingBox();
  if (!box) throw new Error("no map box");
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width * 0.3, y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(box.x + box.width * (0.3 + i * 0.03), y);
  await page.mouse.up();
  await expect(page).toHaveURL(/\/atlas$/);
  await expect(page.locator("svg.world-map")).not.toHaveAttribute("data-turning", "true");
  const after = await page.locator('path.map-country[data-country="BRA"]').getAttribute("d");
  expect(after).not.toBe(before);
});
