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
        // A tap on a visible dot means that dot's country, so never pick one.
        if (nearest <= 10) continue;
        const near = nearest < 22;
        if (near) return { x, y, contested: true, nearest };
        fallback ??= { x, y };
      }
    }
    if (!fallback) throw new Error(`no visible point in ${id}`);
    return { ...fallback, contested: false };
  }, id);
}

test("on the flat map, a tap on a country wins over small neighbors' tap targets", async ({
  page,
}) => {
  await setUpLearner(page, 2);
  await page.goto("/atlas?view=flat");
  await expect(page.getByTestId("atlas-regions")).toBeVisible();
  // Measure after the entry animation, or the map moves between measuring and clicking.
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every((a) => a.playState !== "running" || a.effect?.getTiming().iterations === Infinity),
  );
  if (test.info().project.name === "phone") {
    // At phone size Norway is a few pixels wide; zoom in on it the way a learner would.
    const box = await page.locator('path.map-country[data-country="NOR"]').boundingBox();
    if (!box) throw new Error("no Norway");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -500);
    await page.waitForTimeout(300);
  }
  const point = await pointIn(page, "NOR");
  // Part of Norway lies under other countries' tap targets: the case that used to open
  // Estonia or Denmark.
  expect(point.contested).toBe(true);
  await page.mouse.click(point.x, point.y);
  await expect(page).toHaveURL(/\/atlas\/NOR$/);
});

async function globeState(page: Page) {
  const globe = page.getByTestId("globe");
  return {
    lambda: Number(await globe.getAttribute("data-lambda")),
    phi: Number(await globe.getAttribute("data-phi")),
    zoom: Number(await globe.getAttribute("data-zoom")),
  };
}

test("the globe faces the home country and a tap on it opens the country", async ({ page }) => {
  await setUpLearner(page, 2);
  await page.goto("/atlas");
  const globe = page.getByTestId("globe");
  await expect(globe).toHaveAttribute("data-lambda", /.+/);
  // Onboarding picks Norway: the globe starts facing it, tilted toward the north.
  const { lambda, phi } = await globeState(page);
  expect(lambda).toBeLessThan(0);
  expect(phi).toBeLessThan(-30);
  // Norway sits above the center; find a pixel in it from the projected centroid.
  const box = await globe.boundingBox();
  if (!box) throw new Error("no globe");
  const radius = Math.min(box.width, box.height) / 2 - 12;
  const toRad = Math.PI / 180;
  // Central Norway (14.5E, 66N), clear of neighbors' dots, projected like the globe does.
  const [lon, lat] = [14.5 * toRad, 66 * toRad];
  const [l0, p0] = [-lambda * toRad, -phi * toRad];
  const x = Math.cos(lat) * Math.sin(lon - l0);
  const y = Math.cos(p0) * Math.sin(lat) - Math.sin(p0) * Math.cos(lat) * Math.cos(lon - l0);
  await page.mouse.click(box.x + box.width / 2 + x * radius, box.y + box.height / 2 - y * radius);
  await expect(page).toHaveURL(/\/atlas\/NOR$/);
});

test("dragging turns the globe in both directions and keeps spinning briefly", async ({ page }) => {
  await setUpLearner(page, 2);
  await page.goto("/atlas");
  const globe = page.getByTestId("globe");
  await expect(globe).toHaveAttribute("data-lambda", /.+/);
  const before = await globeState(page);
  const box = await globe.boundingBox();
  if (!box) throw new Error("no globe");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(x + i * 12, y + i * 4);
  await page.mouse.up();
  const released = await globeState(page);
  await expect(page).toHaveURL(/\/atlas$/);
  expect(released.lambda).not.toBe(before.lambda);
  expect(released.phi).not.toBe(before.phi);
  // Inertia carries the turn on after release.
  await expect.poll(async () => (await globeState(page)).lambda).not.toBe(released.lambda);

  // Wheel zooms in.
  await page.mouse.move(x, y);
  await page.mouse.wheel(0, -400);
  await expect.poll(async () => (await globeState(page)).zoom).toBeGreaterThan(1);
});

test("the flat map is one toggle away and remembered in the address", async ({ page }) => {
  await setUpLearner(page, 2);
  await page.goto("/atlas");
  await page.getByTestId("view-flat").click();
  await expect(page).toHaveURL(/view=flat/);
  await expect(page.locator("svg.world-map")).toBeVisible();
  await page.getByTestId("view-globe").click();
  await expect(page.getByTestId("globe")).toBeVisible();
});
