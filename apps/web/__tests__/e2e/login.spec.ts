import { test, expect } from "@playwright/test";

test("user can log in with previously created account", async ({ page }) => {
  const email = `login-${Date.now()}@example.com`;
  // Sign up first
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Login Test");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("Sup3rSecret!");
  await page.getByRole("button", { name: /create account/i }).click();
  await expect(page).toHaveURL(/\/onboarding/);

  // Log out
  await page.context().clearCookies();

  // Log in
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("Sup3rSecret!");
  await page.getByRole("button", { name: /log in/i }).click();
  await expect(page).toHaveURL(/\/(onboarding|dashboard)/);
});
