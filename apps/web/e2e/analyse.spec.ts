import { expect, type Page, test } from "@playwright/test";
import { AGENTS } from "@wyrm/agents";

// Runs without AI keys: steps are drafted from the text with keyword rules.

const next = (page: Page, name = "Next") => page.getByRole("button", { name, exact: true }).click();

test("the agents page links every agent", async ({ page }) => {
  await page.goto("/agents");
  for (const agent of AGENTS) {
    await expect(page.locator(`a[href="/agents/${agent.slug}"]`).first()).toBeVisible();
  }
});

test("an agent page shows its workflow diagram", async ({ page }) => {
  await page.goto("/agents/inbox-agent");
  const diagram = page.getByRole("figure", { name: /Workflow/ });
  await expect(diagram).toContainText("New email arrives");
  await expect(diagram).toContainText("Human check");
});

test("the analyser asks six simple questions and gives a clear result", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Name a task to analyse" })
    .fill("Entering supplier invoices");
  await page.getByRole("button", { name: "Analyse", exact: true }).click();
  await expect(page).toHaveURL(/\/analyse\?q=/);

  // 1 The task (pre-filled from the home page)
  await expect(page.getByRole("textbox", { name: "The task" })).toHaveValue(
    "Entering supplier invoices",
  );
  await next(page);

  // 2 How it starts: one click moves on
  await page.getByRole("button", { name: "An email" }).click();

  // 3 How often
  await page.getByRole("button", { name: "about 20" }).click();

  // 4 Walk-through
  await expect(page.getByText("Question 4 of 6")).toBeVisible();
  await page.getByRole("button", { name: "Show me an example" }).click();
  await next(page);

  // 5 Minutes per step (drafted without AI in tests)
  const minutes = page.getByRole("spinbutton", { name: /^Minutes for step/ });
  await expect(minutes).toHaveCount(5);
  for (let i = 0; i < 5; i++) await minutes.nth(i).fill("4");
  await next(page);

  // 6 Off-plan share and optional cost
  await page.getByRole("button", { name: "Almost never (0–1)" }).click();
  await page.getByRole("spinbutton", { name: "Cost per hour in euros" }).fill("30");
  await next(page, "See my result");

  // Result
  await expect(page.getByText(/hours a week/).first()).toBeVisible();
  await expect(page.getByText("What AI can do in each step")).toBeVisible();
  await expect(page.getByText("AI does it").first()).toBeVisible();
  await expect(page.getByRole("figure", { name: /with AI agents/ })).toBeVisible();
  await expect(page.getByText("How we worked this out")).toBeVisible();
});

test("the old planner address redirects to the analyser", async ({ page }) => {
  await page.goto("/planner");
  await expect(page).toHaveURL(/\/analyse$/);
});

test("unknown agents are a 404", async ({ page }) => {
  const response = await page.goto("/agents/not-a-real-agent");
  expect(response?.status()).toBe(404);
});
