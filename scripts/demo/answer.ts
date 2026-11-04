/**
 * Answers the question on screen the way a learner who knows it would: the right option, the
 * right country on the map, or the right name typed. Used to stage screenshots and the demo.
 */
import type { Page } from "@playwright/test";

/** The card on screen: its entity and type, from the prompt's data-card. */
export async function currentCard(page: Page): Promise<{ entity: string; type: string } | null> {
  const card = await page
    .locator('[data-testid="prompt"]')
    .first()
    .getAttribute("data-card", { timeout: 5_000 })
    .catch(() => null);
  if (!card) return null;
  const [entity = "", type = ""] = card.split(":");
  return { entity, type };
}

/**
 * A point inside a country's shape on the map, in page coordinates: the middle of the part
 * that is on screen. Overseas parts (the Azores for Portugal) widen the shape's box, so the
 * box is sampled finely and only points inside the visible map count.
 */
export async function pointInCountry(page: Page, id: string): Promise<[number, number] | null> {
  return page.evaluate((id) => {
    const path = document.querySelector<SVGPathElement>(`path.map-country[data-country="${id}"]`);
    const svg = path?.ownerSVGElement;
    const matrix = path?.getScreenCTM();
    if (!path || !svg || !matrix) return null;
    const view = svg.getBoundingClientRect();
    const box = path.getBBox();
    const inside: [number, number][] = [];
    const steps = 80;
    for (let i = 0; i <= steps; i++) {
      for (let j = 0; j <= steps; j++) {
        const x = box.x + (box.width * i) / steps;
        const y = box.y + (box.height * j) / steps;
        if (!path.isPointInFill(new DOMPoint(x, y))) continue;
        const p = new DOMPoint(x, y).matrixTransform(matrix);
        if (
          p.x > view.left + 8 &&
          p.x < view.right - 8 &&
          p.y > view.top + 8 &&
          p.y < view.bottom - 8
        )
          inside.push([p.x, p.y]);
      }
    }
    if (inside.length === 0) return null;
    const cx = inside.reduce((n, p) => n + p[0], 0) / inside.length;
    const cy = inside.reduce((n, p) => n + p[1], 0) / inside.length;
    let best = inside[0] as [number, number];
    for (const p of inside) {
      if ((p[0] - cx) ** 2 + (p[1] - cy) ** 2 < (best[0] - cx) ** 2 + (best[1] - cy) ** 2) best = p;
    }
    return best;
  }, id);
}

/** Answers right when it can; returns false when it had to give up instead. */
export async function answerRight(
  page: Page,
  answerFor: (entity: string, type: string) => string | undefined,
): Promise<boolean> {
  const card = await currentCard(page);
  if (!card) return false;
  const expected = answerFor(card.entity, card.type);
  const byId = page.locator(`[data-testid="choices"] [data-option="${card.entity}"]`);
  // Capital and other options carry their own ids, so they are matched by their label.
  const byText = page
    .locator('[data-testid="choices"] button')
    .filter({ hasText: expected ?? "\u0000" });
  for (const option of [byId, byText]) {
    if (
      await option
        .first()
        .isVisible()
        .catch(() => false)
    ) {
      await option.first().click();
      return true;
    }
  }
  const flag = page.locator(`[data-testid="flag-choices"] [data-option="${card.entity}"]`);
  if (await flag.isVisible().catch(() => false)) {
    await flag.click();
    return true;
  }
  const typed = page.getByTestId("typed-answer");
  if (await typed.isVisible().catch(() => false)) {
    if (expected) {
      await typed.pressSequentially(expected, { delay: 70 });
      await page.keyboard.press("Enter");
      return true;
    }
  }
  // The map flies to the question first; aim once it has settled.
  await page.waitForTimeout(900);
  const point = await pointInCountry(page, card.entity);
  if (point) {
    await page.mouse.move(point[0], point[1], { steps: 12 });
    await page.mouse.click(point[0], point[1]);
    return true;
  }
  await page.getByTestId("give-up").first().click();
  return false;
}

/** What a typed answer should say, from the country data, in English. */
export function typedAnswers(
  countries: readonly {
    id: string;
    names: { en: string };
    capitals: { names: { en: string }; roles: string[] }[];
    currencies: { names: { en: string } }[];
    officialLanguages: { names: { en: string } }[];
  }[],
) {
  const byId = new Map(countries.map((c) => [c.id, c]));
  return (entity: string, type: string): string | undefined => {
    const c = byId.get(entity);
    if (!c) return undefined;
    if (type === "country_to_capital")
      return (c.capitals.find((x) => x.roles.includes("primary")) ?? c.capitals[0])?.names.en;
    if (type === "country_to_currency") return c.currencies[0]?.names.en;
    if (type === "country_to_language") return c.officialLanguages[0]?.names.en;
    return c.names.en;
  };
}
