import { expect, type Page, test } from "@playwright/test";

const chat = (page: Page) => page.getByRole("region", { name: "Receptionist demo" });
const chips = (page: Page) => chat(page).getByRole("group", { name: "Suggested replies" });
const conversation = (page: Page) => chat(page).getByRole("list", { name: "Conversation" });

async function say(page: Page, text: string) {
  await chat(page).getByLabel("Your message").fill(text);
  await chat(page).getByRole("button", { name: "Send" }).click();
}

test("books an appointment using the suggested replies, only after yes", async ({ page }) => {
  await page.goto("/receptionist");
  await expect(conversation(page)).toContainText("Harbor Lane Dental");

  await chips(page).getByRole("button", { name: "Book a check-up" }).click();
  await expect(conversation(page)).toContainText("Which day suits you");
  await chips(page).getByRole("button").first().click(); // first open day
  await expect(conversation(page)).toContainText("What time would you like?");
  await chips(page).getByRole("button").first().click(); // first free time
  await expect(conversation(page)).toContainText("What name");
  await say(page, "Alex");
  await expect(conversation(page)).toContainText("Shall I book it?");
  await expect(chat(page).getByText("Appointment booked (demo)")).toHaveCount(0);

  await chips(page).getByRole("button", { name: "Yes, book it" }).click();
  await expect(chat(page).getByText("Appointment booked (demo)")).toBeVisible();
  await expect(conversation(page)).toContainText(/Your reference is HL-\d{4}/);
});

test("refuses a past day and answers a side question mid-booking", async ({ page }) => {
  await page.goto("/receptionist");
  await say(page, "I'd like a cleaning");
  await say(page, "yesterday");
  await expect(conversation(page)).toContainText("already passed");
  await say(page, "where are you?");
  await expect(conversation(page)).toContainText("12 Harbor Lane");
  await expect(conversation(page)).toContainText("Back to your booking");
});

test("without an AI key the chat explains and switches to the basic receptionist", async ({
  page,
}) => {
  await page.goto("/receptionist");
  await expect(chat(page)).toContainText("AI receptionist");
  await say(page, "prices");
  await expect(conversation(page)).toContainText("resting right now");
  await expect(conversation(page)).toContainText("€45");
  await expect(chat(page)).toContainText("basic receptionist (no AI)");
});

test("receptionist API validates input and reports fallback without a key", async ({ request }) => {
  const bad = await request.post("/api/receptionist", { data: { history: [] } });
  expect(bad.status()).toBe(400);

  const ok = await request.post("/api/receptionist", {
    data: {
      history: [{ role: "visitor", text: "hello" }],
      bookings: [],
      pending: null,
      clock: { day: "2026-10-19", minutes: 600 },
    },
  });
  expect(ok.status()).toBe(200);
  expect(await ok.json()).toEqual({ status: "fallback", reason: "not_configured" });
});

test("restart clears the conversation", async ({ page }) => {
  await page.goto("/receptionist");
  await say(page, "prices");
  await expect(conversation(page)).toContainText("€45");
  await chat(page).getByRole("button", { name: "Restart" }).click();
  await expect(conversation(page).getByRole("listitem")).toHaveCount(1);
});

test("the same receptionist runs a different business from its settings file", async ({ page }) => {
  await page.goto("/receptionist/bright-cuts-salon");
  await expect(conversation(page)).toContainText("Bright Cuts Salon");
  await say(page, "where are you?");
  await expect(conversation(page)).toContainText("48 Market Street");
  await say(page, "book a men's cut");
  await say(page, "Monday");
  await expect(conversation(page)).toContainText("closed on Mondays");
});

test("receptionist API rejects an unknown client", async ({ request }) => {
  const response = await request.post("/api/receptionist", {
    data: {
      history: [{ role: "visitor", text: "hello" }],
      bookings: [],
      pending: null,
      clock: { day: "2026-10-19", minutes: 600 },
      client: "not-a-client",
    },
  });
  expect(response.status()).toBe(400);
});
