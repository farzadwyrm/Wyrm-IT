import { expect, type Page, test } from "@playwright/test";

const chat = (page: Page) => page.getByRole("region", { name: "Receptionist chat" });
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

test("restart clears the conversation", async ({ page }) => {
  await page.goto("/receptionist");
  await say(page, "prices");
  await expect(conversation(page)).toContainText("€45");
  await chat(page).getByRole("button", { name: "Restart" }).click();
  await expect(conversation(page).getByRole("listitem")).toHaveCount(1);
});
