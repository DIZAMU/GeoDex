import { expect, type Page, test } from "@playwright/test";
import { answerPrompt, currentScreen, noHorizontalScroll, setUpLearner } from "./helpers";

async function study(page: Page, url: string, answers: number) {
  await page.goto(url);
  let answered = 0;
  while (answered < answers) {
    const screen = await currentScreen(page);
    if (screen === "intro") await page.keyboard.press("Enter");
    else if (screen === "prompt") await answerPrompt(page);
    else {
      await page.keyboard.press("Enter");
      answered++;
      await expect(page.getByTestId("feedback")).toBeHidden();
    }
  }
  await page.getByRole("button", { name: "End session" }).click();
  await expect(page.getByTestId("session-summary")).toBeVisible();
}

function idb<T>(page: Page, store: string, op: "count" | "clear" | "getAll"): Promise<T> {
  return page.evaluate(
    ([store, op]) =>
      new Promise<T>((resolve, reject) => {
        const open = indexedDB.open("geodex");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction(store, op === "clear" ? "readwrite" : "readonly");
          const request = tx.objectStore(store)[op]();
          request.onsuccess = () => resolve(request.result as T);
          request.onerror = () => reject(request.error);
        };
      }),
    [store, op] as const,
  );
}

/** Visible text of every progress screen, for a before/after comparison. */
async function capture(page: Page): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const [name, url, ready] of [
    ["today", "/", "streak"],
    ["atlas", "/atlas", "atlas-regions"],
    ["atlas-flags", "/atlas?skill=flags", "atlas-regions"],
    ["entry", "/atlas/SWE", "entry-cards"],
    ["stats", "/stats", "stats-grid"],
  ] as const) {
    await page.goto(url);
    await expect(page.getByTestId(ready)).toBeVisible();
    // Maps draw (with their labels) once they have measured their box; read the text after.
    await page.waitForFunction(() =>
      [...document.querySelectorAll("svg.world-map")].every((svg) => svg.querySelector("path")),
    );
    await noHorizontalScroll(page);
    out[name] = await page.locator("main").innerText();
  }
  return out;
}

test("progress screens are identical after the card cache is deleted", async ({ page }) => {
  test.setTimeout(180_000);
  await setUpLearner(page, 6);
  await study(page, "/session?input=mc", 8);
  await expect(page.getByTestId("summary-tomorrow")).toBeVisible();

  const before = await capture(page);
  expect(await idb<number>(page, "cardState", "count")).toBeGreaterThan(0);
  await idb(page, "cardState", "clear");
  expect(await idb<number>(page, "cardState", "count")).toBe(0);
  await page.reload();
  const after = await capture(page);
  expect(after).toEqual(before);
  expect(await idb<number>(page, "cardState", "count")).toBeGreaterThan(0);
});

test("a drill logs unscheduled events and leaves card state alone", async ({ page }) => {
  test.setTimeout(120_000);
  await setUpLearner(page, 4);
  const states = await idb<unknown[]>(page, "cardState", "getAll");

  await page.goto("/atlas");
  await page.getByTestId("region-154").getByRole("link").click();
  await expect(page).toHaveURL(/\/drill\?region=154/);
  await study(page, "/drill?region=154", 3);
  await expect(page.getByTestId("summary-tomorrow")).toBeHidden();

  const events = await idb<{ scheduled: boolean; mode: string }[]>(page, "reviewEvents", "getAll");
  const drill = events.filter((e) => e.mode !== "placement");
  expect(drill).toHaveLength(3);
  expect(drill.every((e) => !e.scheduled)).toBe(true);
  expect(await idb<unknown[]>(page, "cardState", "getAll")).toEqual(states);
});
