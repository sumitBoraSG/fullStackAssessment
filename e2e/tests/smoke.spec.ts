import { test, expect } from "@playwright/test";

test("loads the login page against the real backend + test DB", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Welcome to DocPulse" })).toBeVisible();
  await expect(page.getByPlaceholder("name@example.com")).toBeVisible();
});
