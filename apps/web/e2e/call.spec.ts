import { expect, type Page, test } from "@playwright/test";
import { installFakeSpeech, say, spokenTexts } from "./fake-speech";

// Chromium-only fakes (fake microphone device + scripted speech).
test.skip(({ browserName }) => browserName !== "chromium", "fake microphone is Chromium-only");

const demo = (page: Page) => page.getByRole("region", { name: "Receptionist demo" });
const status = (page: Page) => demo(page).getByRole("status");

async function openCall(page: Page) {
  await page.goto("/receptionist");
  await demo(page).getByRole("button", { name: "Call", exact: true }).click();
}

/** Waits until the receptionist has said something matching `pattern`; returns that line. */
async function heard(page: Page, pattern: RegExp): Promise<string> {
  let line = "";
  await expect
    .poll(async () => {
      line = (await spokenTexts(page)).find((t) => pattern.test(t)) ?? "";
      return line;
    })
    .not.toBe("");
  return line;
}

test("a spoken call books an appointment only after the caller says yes", async ({ page }) => {
  await installFakeSpeech(page);
  await openCall(page);
  await demo(page).getByRole("button", { name: "Start call" }).click();

  // Greeting is spoken, then it listens.
  await heard(page, /Harbor Lane Dental/);
  await expect(status(page)).toContainText("Listening");

  // No API key in tests: the call switches to the basic receptionist and still answers aloud,
  // with prices spoken naturally.
  await say(page, "how much is a check-up");
  await heard(page, /45 euros/);
  await expect(demo(page)).toContainText("basic receptionist (no AI)");

  await say(page, "I'd like to book a check-up");
  const dayLine = await heard(page, /free times are/);
  const day = dayLine.match(/free times are (\w+ the \d+\w{2} of \w+)/)?.[1] ?? "";
  expect(day, dayLine).not.toBe("");

  await say(page, day);
  const timeLine = await heard(page, /What time would you like/);
  const time = timeLine.match(/I have (\d{1,2}(?::\d{2})? [ap]m)/)?.[1] ?? "";
  expect(time, timeLine).not.toBe("");

  await say(page, time);
  await heard(page, /What name/);
  await say(page, "Alex");
  await heard(page, /Shall I book it/);
  await expect(demo(page).getByText("Appointment booked (demo)")).toHaveCount(0);

  await say(page, "yes");
  await heard(page, /You're booked/);
  await expect(demo(page).getByText("Appointment booked (demo)").first()).toBeVisible();
  // References are read out letter by letter, never as "HL-1234".
  expect((await spokenTexts(page)).join(" ")).not.toMatch(/HL-\d/);

  await demo(page).getByRole("button", { name: "End call" }).click();
  await expect(status(page)).toContainText("Call ended");
  await expect(demo(page).getByRole("region", { name: "Call summary" })).toContainText(
    "Appointment booked (demo)",
  );

  // The same conversation is visible in the chat view.
  await demo(page).getByRole("button", { name: "Chat", exact: true }).click();
  await expect(demo(page).getByRole("list", { name: "Conversation" })).toContainText("Alex");
});

test("mute pauses listening and is announced", async ({ page }) => {
  await installFakeSpeech(page);
  await openCall(page);
  await demo(page).getByRole("button", { name: "Start call" }).click();
  await expect(status(page)).toContainText("Listening");

  const mute = demo(page).getByRole("button", { name: "Mute" });
  await mute.click();
  await expect(demo(page).getByRole("button", { name: "Unmute" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(status(page)).toContainText("You're muted");

  await demo(page).getByRole("button", { name: "Unmute" }).click();
  await expect(status(page)).toContainText("Listening");
  await demo(page).getByRole("button", { name: "End call" }).click();
  await expect(status(page)).toContainText("Call ended");
});

test("browsers without speech recognition are pointed to the chat", async ({ page }) => {
  await installFakeSpeech(page, { recognition: false });
  await openCall(page);
  await expect(status(page)).toContainText("Voice calls need Chrome, Edge or Safari");
  await demo(page).getByRole("button", { name: "Use the chat instead" }).click();
  await expect(demo(page).getByLabel("Your message")).toBeVisible();
});

test("the call view fits a phone screen and still shows state with reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installFakeSpeech(page);
  await openCall(page);
  await demo(page).getByRole("button", { name: "Start call" }).click();
  await expect(status(page)).toContainText("Listening");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
