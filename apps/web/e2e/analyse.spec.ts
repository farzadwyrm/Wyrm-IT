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

test("the analyser interviews the owner and scores every step", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Name a task to analyse" })
    .fill("Entering supplier invoices");
  await page.getByRole("button", { name: "Analyse", exact: true }).click();
  await expect(page).toHaveURL(/\/analyse\?q=/);

  // 1 Scope
  await expect(page.getByRole("textbox", { name: "What is the task?" })).toHaveValue(
    "Entering supplier invoices",
  );
  await page
    .getByRole("textbox", { name: "What you have when it's done" })
    .fill("Invoice entered in Xero and scheduled");
  await page.getByText("An email arrives").click();
  await page.getByText("Nobody, it's record-keeping").click();
  await next(page);

  // 2 Volume
  await page.getByRole("spinbutton", { name: "How many" }).fill("40");
  await next(page);

  // 3 Walk-through
  await page.getByRole("button", { name: "Use an example" }).click();
  await next(page, "Map my steps");

  // 4 Steps (drafted without AI)
  await expect(page.getByRole("status")).toContainText("without AI");
  const minutes = page.getByRole("spinbutton", { name: /^Minutes for step/ });
  await expect(minutes).toHaveCount(5);
  for (let i = 0; i < 5; i++) await minutes.nth(i).fill("4");
  await expect(page.getByText(/20 min per item × 40 a week/)).toBeVisible();
  await next(page);

  // 5 Exceptions
  await page.getByRole("spinbutton", { name: "Exceptions out of 10" }).fill("1");
  await next(page);

  // 6 Value
  await page.getByRole("spinbutton", { name: "Hourly cost" }).fill("30");
  await next(page, "Analyse");

  // Result
  await expect(page.getByRole("heading", { name: /h a week/ })).toBeVisible();
  await expect(page.getByRole("table")).toContainText("VAT into Xero");
  await expect(page.getByRole("table")).toContainText("Automate");
  await expect(page.getByText("Assumptions behind the numbers")).toBeVisible();
  await expect(page.getByRole("figure", { name: /with AI agents/ })).toBeVisible();
});

test("the old planner address redirects to the analyser", async ({ page }) => {
  await page.goto("/planner");
  await expect(page).toHaveURL(/\/analyse$/);
});

test("unknown agents are a 404", async ({ page }) => {
  const response = await page.goto("/agents/not-a-real-agent");
  expect(response?.status()).toBe(404);
});
