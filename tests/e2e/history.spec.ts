import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { chooseThemeAndLocale, seed, setUpLearner, turnOn } from "./helpers";

type Outlined = {
  id: string;
  kind: "dissolved_state" | "empire";
  names: { en: string; nb: string };
  period: [number, number];
  outline: { snapshotYear: number; approximate: boolean };
};
const OUTLINED = (
  JSON.parse(readFileSync("data/history.json", "utf8")) as {
    entities: (Outlined | { kind: "former_name" })[];
  }
).entities.filter((e): e is Outlined => e.kind !== "former_name");

const yearText = (year: number) => (year < 0 ? `${-year} BCE` : String(year));

// Acceptance (PLAN.md Phase 9): every outline shows its snapshot year, and "approximate"
// where it applies.
test("every outline shows its snapshot year and an approximate label where it applies", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await setUpLearner(page);
  for (const e of OUTLINED) {
    await page.goto(`/atlas?view=time&year=${e.outline.snapshotYear}`);
    const outline = page.locator(`[data-testid="history-outline"][data-history="${e.id}"]`);
    await expect(outline).toHaveCount(1);
    expect((await outline.getAttribute("d"))?.length ?? 0, e.names.en).toBeGreaterThan(20);
    const row = page.locator(`[data-testid="timeline-list"] [data-history="${e.id}"]`);
    await expect(row.getByTestId("outline-year")).toHaveText(
      `Borders in ${yearText(e.outline.snapshotYear)}`,
    );
    await expect(row.getByTestId("outline-approximate")).toHaveCount(e.outline.approximate ? 1 : 0);
  }
  // The outline cards carry the same caption in a session. The module goes on first: the
  // settings screen writes the whole settings row, which would undo the seeded settings.
  await page.goto("/settings");
  await turnOn(page, "module-history-switch");
  await seed(
    page,
    OUTLINED.map((e) => ({
      cardId: `${e.id}:${e.kind === "empire" ? "map_to_empire" : "map_to_dissolved_state"}`,
      daysAgo: 3,
      rating: 1,
    })),
    true,
  );
  await page.goto("/session?input=mc");
  const seen = new Set<string>();
  for (let i = 0; i < 300 && seen.size < OUTLINED.length; i++) {
    await expect(
      page
        .locator(
          '[data-testid="prompt"], [data-testid="feedback"], [data-testid="session-summary"], [data-testid="streak"]',
        )
        .first(),
    ).toBeVisible();
    if (!(await page.locator('[data-testid="prompt"], [data-testid="feedback"]').count())) break;
    if (await page.getByTestId("feedback").isVisible()) {
      await page.keyboard.press("Enter");
      // The next card replaces the feedback; until then a key press would land on it again.
      await expect(page.getByTestId("feedback")).toHaveCount(0);
      continue;
    }
    // An outline card's caption renders with its map; wait for it before reading.
    if ((await page.getByTestId("prompt").count()) === 0) continue;
    const card = (await page.getByTestId("prompt").getAttribute("data-card")) ?? "";
    if (/:map_to_(empire|dissolved_state)$/.test(card)) {
      await expect(
        page.locator(`[data-testid="outline-caption"][data-history="${card.split(":")[0]}"]`),
      ).toBeVisible();
    }
    // Read the caption in one step: the next card can replace it between two reads.
    const asked = card.split(":")[0] ?? "";
    const caption = await page.evaluate((asked) => {
      const el = document.querySelector(`[data-testid="outline-caption"][data-history="${asked}"]`);
      return el
        ? {
            id: el.getAttribute("data-history") ?? "",
            year: el.querySelector('[data-testid="outline-year"]')?.textContent ?? "",
            approximate: el.querySelector('[data-testid="outline-approximate"]') !== null,
            // Answer right in the same step, so the card does not come back this session.
            answered: (() => {
              const button = document.querySelector<HTMLButtonElement>(
                `[data-option="${el.getAttribute("data-history")}"]`,
              );
              button?.click();
              return button !== null;
            })(),
          }
        : null;
    }, asked);
    if (caption) {
      const e = OUTLINED.find((o) => o.id === caption.id);
      if (!e) throw new Error(`unknown outline ${caption.id}`);
      expect(caption.year, e.names.en).toBe(`Borders in ${yearText(e.outline.snapshotYear)}`);
      expect(caption.approximate, e.names.en).toBe(e.outline.approximate);
      seen.add(caption.id);
      if (caption.answered) {
        await expect(page.getByTestId("feedback")).toBeVisible();
        continue;
      }
    }
    if (await page.getByTestId("choices").isVisible()) await page.keyboard.press("1");
    else if (await page.getByTestId("give-up").isVisible())
      await page.getByTestId("give-up").click();
    else await page.keyboard.press("Enter");
  }
  expect([...seen].sort()).toEqual(OUTLINED.map((e) => e.id).sort());
});

test("history cards and the timeline in every theme and language", async ({ page }) => {
  test.setTimeout(300_000);
  await setUpLearner(page);
  // Each round has its own entities: reviews from one round reschedule its cards.
  const rounds = [
    ["dark", "en", ["Q2277:map_to_empire", "Q503623:former_name_to_country"], 117],
    ["dark", "nb", ["Q12560:empire_to_era", "Q28513:map_to_dissolved_state"], 1683],
    ["light", "en", ["Q33946:dissolved_state_member", "Q8733:map_to_empire"], 1820],
    ["light", "nb", ["Q28573:map_to_empire", "former-persia:former_name_to_country"], 1525],
    ["light", "en", ["Q15180:map_to_dissolved_state", "Q12557:empire_to_era"], 1279],
    ["light", "nb", ["Q16957:map_to_dissolved_state", "Q1081620:former_name_to_country"], 1989],
  ] as const;
  for (const [theme, locale, cards, year] of rounds) {
    await chooseThemeAndLocale(page, theme, locale);
    await turnOn(page, "module-history-switch");
    await seed(
      page,
      cards.map((cardId) => ({ cardId, daysAgo: 2, rating: 1 })),
      true,
    );
    await page.goto("/session?input=mc");
    const left = new Set<string>(cards);
    for (let i = 0; i < 40 && left.size > 0; i++) {
      await expect(
        page.locator('[data-testid="prompt"], [data-testid="feedback"]').first(),
      ).toBeVisible();
      if (await page.getByTestId("feedback").isVisible()) {
        await page.keyboard.press("Enter");
        await expect(page.getByTestId("feedback")).toHaveCount(0);
        continue;
      }
      const card = await page.evaluate(() =>
        document.querySelector("[data-card]")?.getAttribute("data-card"),
      );
      const current = cards.find((c) => c === card) ?? null;
      if (current) {
        left.delete(current);
        const tag = current.split(":")[1];
        await page.waitForTimeout(600);
        await shot(page, `${theme}-${locale}-${tag}-prompt`);
        await page.keyboard.press("2");
        await expect(page.getByTestId("history-card")).toBeVisible();
        await shot(page, `${theme}-${locale}-${tag}-feedback`);
        continue;
      }
      if (await page.getByTestId("choices").isVisible()) await page.keyboard.press("1");
      else if (await page.getByTestId("give-up").isVisible())
        await page.getByTestId("give-up").click();
      else await page.keyboard.press("Enter");
    }
    expect([...left], `${theme} ${locale}`).toEqual([]);
    await page.goto(`/atlas?view=time&year=${year}`);
    await expect(page.getByTestId("timeline-list")).toBeVisible();
    await page.waitForTimeout(600);
    await shot(page, `${theme}-${locale}-timeline`);
  }
});

async function shot(page: Page, name: string) {
  await page.waitForTimeout(400);
  await page.screenshot({
    path: join(
      test.info().project.outputDir,
      "screens",
      `${test.info().project.name}-history-${name}.png`,
    ),
  });
}
