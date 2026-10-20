import { expect, test } from "@playwright/test";
import { AREAS } from "@wyrm/guide";
import { POSTS } from "../src/lib/posts";
import { STATIC_ROUTES } from "../src/lib/site";

const ROUTES = [
  ...STATIC_ROUTES,
  ...POSTS.map((post) => `/blog/${post.slug}`),
  ...AREAS.map((area) => `/guide/${area.slug}`),
];

for (const route of ROUTES) {
  test(`${route} renders with one h1 and no horizontal scroll`, async ({ page }) => {
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, "page is wider than the viewport").toBeLessThanOrEqual(0);
  });
}

test("unknown blog post returns 404", async ({ page }) => {
  const response = await page.goto("/blog/does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("wandered off");
});

test("header navigation reaches the services page", async ({ page, isMobile }) => {
  await page.goto("/");
  if (isMobile) await page.getByText("Menu", { exact: true }).click();
  await page.getByRole("link", { name: "Services" }).first().click();
  await expect(page).toHaveURL(/\/services$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("contact page never shows a dead booking link", async ({ page }) => {
  await page.goto("/contact");
  const booking = page.getByRole("complementary", { name: "Booking" });
  const link = booking.getByRole("link", { name: "Open booking calendar" });
  if ((await link.count()) > 0) {
    await expect(link).toHaveAttribute("href", /^https:\/\//);
  } else {
    await expect(booking).toContainText("Online booking opens soon");
  }
});
