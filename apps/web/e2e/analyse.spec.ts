import { expect, type Page, test } from "@playwright/test";
import { AGENTS } from "@wyrm/agents";

// Runs without AI keys: steps are drafted from the text with keyword rules.

// Keyboard activation: on phone sizes the sticky site header can cover the button for a robot click.
const next = (page: Page, name = "Next") =>
  page.getByRole("button", { name, exact: true }).press("Enter");

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

test("the assessment maps a process and produces a full report", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Name a task to analyse" })
    .fill("Supplier invoice processing");
  await page.getByRole("button", { name: "Analyse", exact: true }).click();
  await expect(page).toHaveURL(/\/analyse\?q=/);

  // 1 Scope (name pre-filled from the home page)
  await expect(page.getByRole("textbox", { name: "Process name" })).toHaveValue(
    "Supplier invoice processing",
  );
  await page.getByRole("spinbutton", { name: "Cases" }).fill("60");
  await next(page, "Current process →");

  // 2 Current process: draft from the example walk-through (keyword rules in tests)
  await page.getByRole("button", { name: "Use an example" }).press("Enter");
  await page.getByRole("button", { name: "Draft the step map" }).press("Enter");
  const activities = page.getByRole("textbox", { name: "Activity" });
  await expect(activities).toHaveCount(5);
  const minutes = page.getByRole("spinbutton", { name: "Hands-on time" });
  for (let i = 0; i < 5; i++) await minutes.nth(i).fill("4");
  await next(page, "Exceptions & quality →");

  // 3 Exceptions & quality
  await page
    .getByRole("combobox", { name: "Of the last 10 cases, how many left the standard path?" })
    .selectOption("1");
  await page.getByRole("checkbox", { name: /Re-keying data/ }).check();
  await next(page, "Cost & context →");

  // 4 Cost & context
  await page
    .getByRole("spinbutton", { name: "Hourly wage of the people doing this work" })
    .fill("30");
  await next(page, "Generate assessment");

  // Report
  await expect(page.getByText("Recommendation", { exact: true }).first()).toBeVisible();
  for (const title of [
    "Executive summary",
    "Key figures",
    "Current process",
    "Step assessment",
    "Opportunity matrix",
    "Findings",
    "Target design",
    "Business case",
    "Implementation roadmap",
    "Systems and access",
  ]) {
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
  }
  await expect(page.getByRole("figure", { name: /with AI agents/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save as PDF" })).toBeVisible();
});

test("the old planner address redirects to the analyser", async ({ page }) => {
  await page.goto("/planner");
  await expect(page).toHaveURL(/\/analyse$/);
});

test("unknown agents are a 404", async ({ page }) => {
  const response = await page.goto("/agents/not-a-real-agent");
  expect(response?.status()).toBe(404);
});
