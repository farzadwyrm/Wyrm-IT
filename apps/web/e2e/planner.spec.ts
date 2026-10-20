import { expect, test } from "@playwright/test";
import { AGENTS } from "@wyrm/agents";

// Runs without AI keys: the planner shows standard agent workflows.

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

test("the planner draws a workflow for an example task", async ({ page }) => {
  await page.goto("/planner");
  await page
    .getByRole("button", { name: "We miss phone calls while we're with customers" })
    .click();
  await expect(page.getByRole("figure", { name: /Workflow/ })).toContainText("Call comes in");
});

test("the home page task box opens the planner with the task", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Describe a task to automate" })
    .fill("Every Monday we type supplier invoices into Xero");
  await page.getByRole("button", { name: "Design", exact: true }).click();
  await expect(page).toHaveURL(/\/planner\?q=/);
  await expect(page.getByRole("figure", { name: /Workflow/ })).toContainText("Invoice received");
});

test("unknown agents are a 404", async ({ page }) => {
  const response = await page.goto("/agents/not-a-real-agent");
  expect(response?.status()).toBe(404);
});
