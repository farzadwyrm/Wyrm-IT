import { expect, test } from "@playwright/test";
import { QUESTIONS } from "@wyrm/assessment";

test("completing the scan shows a score, areas and top fixes", async ({ page }) => {
  await page.goto("/scan");
  await page.getByRole("button", { name: "Start the scan" }).click();

  // Answer every area: everything "Partly", which scores exactly 50%.
  for (;;) {
    const next = page.getByRole("button", { name: /Next area|See my results/ });
    await expect(next).toBeDisabled();
    const options = page.getByText("Partly", { exact: true });
    const count = await options.count();
    for (let i = 0; i < count; i++) await options.nth(i).click();
    await expect(next).toBeEnabled();
    const label = await next.textContent();
    await next.click();
    if (label?.includes("See my results")) break;
  }

  await expect(page.getByRole("heading", { name: "Your results" })).toBeFocused();
  await expect(page.getByRole("region", { name: "Overall score" })).toContainText("50%");
  await expect(page.getByRole("region", { name: "Overall score" })).toContainText("Nearly ready");
  await expect(page.getByText("Partly in place").first()).toBeVisible();

  // Without an API key the free rule-based summary is shown.
  await page.getByRole("button", { name: "Write my summary" }).click();
  const summary = page.getByRole("region", { name: "Your personalised summary" });
  await expect(summary).toContainText("Based on your answers, your overall score is 50%");
  await expect(summary).toContainText("Fix these first.");
  await expect(summary).toContainText("Generated instantly from your answers.");
});

test("report API re-validates answers and refuses thin input", async ({ request }) => {
  const tooFew = await request.post("/api/scan/report", {
    data: { answers: { "made.up": "gap", "id.mfa-everywhere": "gap" } },
  });
  expect(tooFew.status()).toBe(400);
  expect(await tooFew.json()).toEqual({ status: "unavailable", reason: "too_few_answers" });

  const full = await request.post("/api/scan/report", {
    data: { answers: Object.fromEntries(QUESTIONS.map((q) => [q.id, "gap"])) },
  });
  expect(full.status()).toBe(200);
  expect(await full.json()).toMatchObject({ status: "ok", source: "basic" });
});

test("report API rejects a body that is not JSON", async ({ request }) => {
  const response = await request.post("/api/scan/report", {
    headers: { "content-type": "application/json" },
    data: "not json",
  });
  expect(response.status()).toBe(400);
});
