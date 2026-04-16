import { test, expect } from "@playwright/test";

test("new user signs up, creates restaurant, lands on dashboard", async ({ page }) => {
  const email = `onboard-${Date.now()}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Onboard Owner");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("Sup3rSecret!");
  await page.getByRole("button", { name: /create account/i }).click();
  await expect(page).toHaveURL(/\/onboarding/);

  await page.getByLabel("Restaurant name").fill("The Golden Fork");
  await page.getByLabel("Tax %").fill("13");
  await page.getByRole("button", { name: /create restaurant/i }).click();

  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText(/the golden fork/i)).toBeVisible();
});
