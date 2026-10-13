import { expect, test } from "@playwright/test";

test("works offline after the first load", async ({ page, context }) => {
  test.setTimeout(90_000);
  await page.goto("/");
  await expect(page.getByTestId("setup")).toBeVisible();
  // Wait until the service worker controls the page and has precached everything.
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), {
          once: true,
        }),
      );
    }
    return registration.active?.state;
  });

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId("setup")).toBeVisible();
  // Data, geometry and flags load from the cache: onboarding lists countries with flags.
  await page.getByTestId("setup").click();
  await page.getByTestId("country-search").fill("Norw");
  await page.locator('[data-country-option="NOR"]').click();
  await page.getByTestId("start-placement").click();
  await expect(page.getByTestId("prompt")).toBeVisible();
  await expect(page.locator("[data-country]").first()).toBeAttached();
  await context.setOffline(false);
});
