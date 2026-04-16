import { test, expect } from "@playwright/test";

test("user can sign up and lands on onboarding", async ({ page }) => {
  const email = `e2e-${Date.now()}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("Name").fill("E2E Owner");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("Sup3rSecret!");
  await page.getByRole("button", { name: /create account/i }).click();
  await expect(page).toHaveURL(/\/onboarding/);
});
