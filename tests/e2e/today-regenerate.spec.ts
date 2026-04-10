import { test, expect } from "@playwright/test";

test.describe("Today — recovery / segmented plan regenerate", () => {
  test("regenerate control is wired (visible when signed in)", async ({ page }) => {
    await page.goto("/today");
    await page.waitForLoadState("domcontentloaded");

    if (page.url().includes("/sign-in")) {
      test.skip(
        true,
        "Run while signed in (Clerk): this smoke test needs an authenticated session to reach /today."
      );
    }

    await expect(page.getByRole("heading", { name: "Today" })).toBeVisible({
      timeout: 30_000,
    });
    const btn = page.getByTestId("regenerate-plan");
    await expect(btn).toBeVisible();
    await expect(btn).toBeEnabled();
    await expect(btn).toContainText(/recovery steps/i);
  });
});
