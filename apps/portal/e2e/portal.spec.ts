import { expect, test } from "@playwright/test";

// Runs without a Supabase project: public pages work, the client area is locked.

test("the platform home is open to everyone, with all tools and a sign-in for clients", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("AI agents");
  for (const tool of [
    "Workflow analysis",
    "Live voice agent",
    "Agent catalogue",
    "Receptionist template",
  ]) {
    await expect(page.getByRole("heading", { name: tool })).toBeVisible();
  }
  await expect(page.getByRole("link", { name: "Sign in" }).first()).toBeVisible();
});

test("the client area sends signed-out visitors to sign in", async ({ page }) => {
  for (const path of ["/dashboard", "/admin"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login/);
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

test("an unknown invitation link explains it isn't valid", async ({ page }) => {
  await page.goto("/invite/not-a-real-token");
  await expect(page.getByRole("heading", { name: "Invitation not valid" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Sign in/ }).first()).toBeVisible();
});
