import { expect, test } from "@playwright/test";
import { AREAS } from "@wyrm/guide";

// Runs without AI keys: answers come from the guide itself (instant or fallback).

test("the guide index links every area", async ({ page }) => {
  await page.goto("/guide");
  for (const area of AREAS) {
    await expect(page.locator(`a[href="/guide/${area.slug}"]`).first()).toBeVisible();
  }
});

test("an area page answers a starter question from the guide", async ({ page }) => {
  await page.goto("/guide/backup-recovery");
  await page.getByRole("button", { name: "What should we do first?" }).click();
  const log = page.getByRole("log");
  await expect(log).toContainText("What should we do first?");
  await expect(log).toContainText("Test a real restore");
});

test("the home ask bar opens the guide and answers there", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Ask a question about IT" })
    .fill("quick wins for backups");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(page).toHaveURL(/\/guide\?q=/);
  await expect(page.getByRole("log")).toContainText("Test a real restore");
});

test("a typed question still gets a useful answer without AI", async ({ page }) => {
  await page.goto("/guide/network");
  await page
    .getByRole("textbox", { name: "Your question" })
    .fill("how long would it take a small office to set this up?");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(page.getByRole("log")).toContainText("Quick wins");
});

test("unknown areas are a 404", async ({ page }) => {
  const response = await page.goto("/guide/not-a-real-area");
  expect(response?.status()).toBe(404);
});
