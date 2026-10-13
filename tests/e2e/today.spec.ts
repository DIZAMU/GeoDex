import { join } from "node:path";
import { expect, test } from "@playwright/test";

const THEMES = ["atlas", "minimal", "playful"] as const;
const LOCALES = [
  { id: "en", heading: "Today" },
  { id: "nb", heading: "I dag" },
] as const;

for (const theme of THEMES) {
  for (const locale of LOCALES) {
    test(`Today renders in ${theme} / ${locale.id}`, async ({ page }, testInfo) => {
      await page.goto("/");
      await page.getByTestId(`theme-${theme}`).click();
      await page.getByTestId(`locale-${locale.id}`).click();

      const html = page.locator("html");
      await expect(html).toHaveAttribute("data-theme", theme);
      await expect(html).toHaveAttribute("lang", locale.id);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(locale.heading);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBe(0);

      await page.mouse.move(0, 0);
      await page.screenshot({
        animations: "disabled",
        path: join(
          testInfo.project.outputDir,
          "screens",
          `${testInfo.project.name}-${theme}-${locale.id}.png`,
        ),
        fullPage: true,
      });
    });
  }
}

test("theme and language survive a reload without a flash", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("theme-playful").click();
  await page.getByTestId("locale-nb").click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("I dag");

  await page.reload();
  const firstPaint = await page.evaluate(() => document.documentElement.dataset.theme);
  expect(firstPaint).toBe("playful");
  await expect(page.locator("html")).toHaveAttribute("lang", "nb");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("I dag");
});

test("auto follows the system color scheme", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await page.getByTestId("theme-auto").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "minimal");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "atlas");
});
