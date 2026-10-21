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

test("the chat endpoint rejects bad input and unknown chat pages are not found", async ({
  request,
  page,
}) => {
  const bad = await request.post("/api/chat", { data: { agentId: "nope", message: "" } });
  expect([400, 503]).toContain(bad.status());
  const response = await page.goto("/chat/00000000-0000-4000-8000-000000000000");
  expect(response?.status()).toBe(404);
});

test("the website widget script is public and unknown agents get no widget", async ({
  request,
}) => {
  const script = await request.get("/widget.js");
  expect(script.status()).toBe(200);
  expect(await script.text()).toContain("data-agent");
  const config = await request.get("/api/widget/00000000-0000-4000-8000-000000000000", {
    headers: { Origin: "https://somewhere.example" },
  });
  expect([403, 404]).toContain(config.status());
});

test("only the public chat page may be embedded in other sites", async ({ request }) => {
  const login = await request.get("/login");
  expect(login.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
});
