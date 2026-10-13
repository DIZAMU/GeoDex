import { expect, test } from "@playwright/test";
import { chooseThemeAndLocale } from "./helpers";

test("theme and language survive a reload without a flash", async ({ page }) => {
  await chooseThemeAndLocale(page, "playful", "nb");
  await page.reload();
  const firstPaint = await page.evaluate(() => document.documentElement.dataset.theme);
  expect(firstPaint).toBe("playful");
  await expect(page.locator("html")).toHaveAttribute("lang", "nb");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Innstillinger");
});

test("auto follows the system color scheme", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/settings");
  await page.getByTestId("theme-auto").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "minimal");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "atlas");
});
