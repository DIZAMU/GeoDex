/**
 * Accessibility pass (PLAN.md Phase 10, docs/PLAN-2.0.md): axe with the WCAG 2.2 AA rules on
 * every screen in both themes, the tour included, and the list alternative to map answers
 * driven by keyboard alone.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { chooseThemeAndLocale, seed, setUpLearner } from "./helpers";

const SCREENS = [
  ["/welcome", "setup"],
  ["/onboarding", "country-search"],
  ["/", "streak"],
  ["/atlas", "atlas-regions"],
  ["/atlas?view=time&year=1820", "timeline-list"],
  ["/atlas/NOR", "entry-cards"],
  ["/stats", "stats-grid"],
  ["/settings", "default-length-10"],
  ["/settings?tab=topics", "module-cities-switch"],
  ["/settings?tab=appearance", "theme-light"],
  ["/settings?tab=backup", "reset-start"],
  ["/help", "help-faq"],
  ["/session?input=mc", "left"],
] as const;

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

for (const theme of ["light", "dark"] as const) {
  test(`no serious accessibility violations in the ${theme} theme`, async ({ page }) => {
    test.setTimeout(180_000);
    await setUpLearner(page);
    await chooseThemeAndLocale(page, theme, "en");
    const found: string[] = [];
    for (const [url, ready] of SCREENS) {
      await page.goto(url);
      await expect(page.getByTestId(ready)).toBeVisible({ timeout: 15_000 });
      await page.waitForTimeout(800);
      const result = await new AxeBuilder({ page }).withTags(TAGS).analyze();
      for (const v of result.violations) {
        if (v.impact !== "serious" && v.impact !== "critical") continue;
        found.push(
          `${url}: ${v.id} (${v.impact}) ${v.nodes
            .slice(0, 3)
            .map((n) => n.target.join(" "))
            .join(" | ")}`,
        );
      }
    }
    // The tour, open over Today.
    await page.goto("/settings");
    await page.getByTestId("tour-again").click();
    await expect(page.getByTestId("tour")).toBeVisible();
    await page.waitForTimeout(800);
    const tour = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    for (const v of tour.violations) {
      if (v.impact === "serious" || v.impact === "critical") found.push(`tour: ${v.id}`);
    }
    expect(found).toEqual([]);
  });
}

test("a map answer can be given from the list with the keyboard alone", async ({ page }) => {
  await setUpLearner(page);
  await seed(page, [{ cardId: "NOR:name_to_map", daysAgo: 2, rating: 1 }], true);
  await page.goto("/session?input=auto");
  await expect(page.getByTestId("prompt")).toHaveAttribute("data-card", "NOR:name_to_map");
  await page.getByTestId("list-answer-toggle").focus();
  await page.keyboard.press("Enter");
  await page.keyboard.type("Norw");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("feedback")).toBeVisible();
  await expect(page.getByTestId("feedback")).toContainText("Correct");
});
