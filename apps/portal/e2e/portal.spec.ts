import { expect, test } from "@playwright/test";

// Without a Supabase project every page is locked: only the sign-in page loads.

test("signed-out visitors are sent to sign in", async ({ page }) => {
  for (const path of ["/", "/admin"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
  }
});

test("the sign-in page explains when the portal isn't connected", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Portal not connected yet");
});

test("the portal is never indexed or framed", async ({ request }) => {
  const response = await request.get("/login");
  expect(response.headers()["x-robots-tag"]).toContain("noindex");
  expect(response.headers()["x-frame-options"]).toBe("DENY");
});

test("an emailed link without a valid token goes back to sign in", async ({ page }) => {
  await page.goto("/auth/confirm?token_hash=x&type=email&next=https://evil.example");
  await expect(page).toHaveURL(/\/login/);
});
