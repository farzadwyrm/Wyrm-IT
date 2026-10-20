import { getProfile } from "@wyrm/receptionist";
import type Groq from "groq-sdk";
import { describe, expect, it, vi } from "vitest";
import { receptionistSystemPrompt, stateContext } from "./agent";
import { compactSystemPrompt, compactTools } from "./compact";
import { resetGroqCooldowns, runGroqReceptionistTurn } from "./groq-agent";
import { executeTool, receptionistTools } from "./tools";

const salon = getProfile("bright-cuts-salon");
if (!salon) throw new Error("salon profile missing");
const NOW = new Date(2026, 9, 19, 10, 0); // Monday

describe("a client's settings drive the AI receptionist", () => {
  it("builds the prompt from the salon's facts and rules, with no dental leftovers", () => {
    for (const prompt of [receptionistSystemPrompt(salon), compactSystemPrompt(salon)]) {
      expect(prompt).toContain("Bright Cuts Salon");
      expect(prompt).toContain("patch test");
      expect(prompt).toContain("Closed on Mondays and Sundays");
      expect(prompt).not.toMatch(/dent|tooth|clinic/i);
    }
  });

  it("drops demo wording for a real client", () => {
    const real = { ...salon, demo: false };
    expect(receptionistSystemPrompt(real)).not.toMatch(/demo|fictional|made-up/i);
    expect(compactSystemPrompt(real)).not.toMatch(/demo|fictional|made-up/i);
  });

  it("offers only the salon's services to the model", () => {
    const schema = JSON.stringify(receptionistTools(salon)) + JSON.stringify(compactTools(salon));
    expect(schema).toContain("mens_cut");
    expect(schema).not.toContain("whitening");
  });

  it("checks the salon's calendar and books with its reference prefix", () => {
    const ctx = {
      now: NOW,
      bookings: [],
      pendingFromEarlierTurn: null,
      latestVisitorMessage: "",
      profile: salon,
    };
    const monday = JSON.parse(
      executeTool(
        "check_availability",
        { service_id: "mens_cut", day: "2026-10-26", part_of_day: "any" },
        ctx,
      ).content,
    );
    expect(monday.status).toBe("closed");
    const proposal = {
      id: "P-1",
      serviceId: "mens_cut",
      day: "2026-10-21",
      time: 0,
      name: "Sam",
    };
    const wednesday = JSON.parse(
      executeTool(
        "check_availability",
        { service_id: "mens_cut", day: "2026-10-21", part_of_day: "any" },
        ctx,
      ).content,
    );
    const [h, m] = (wednesday.free_times[0].time as string).split(":").map(Number);
    proposal.time = (h ?? 0) * 60 + (m ?? 0);
    const booked = executeTool(
      "book_appointment",
      { proposal_id: "P-1" },
      {
        ...ctx,
        pendingFromEarlierTurn: proposal,
        latestVisitorMessage: "yes please",
      },
    );
    expect(booked.event?.type).toBe("booked");
    expect(JSON.parse(booked.content).reference).toMatch(/^BC-\d{4}$/);
  });

  it("describes bookings with the salon's service names", () => {
    const text = stateContext(
      NOW,
      "chat",
      [],
      { id: "P", serviceId: "colour", day: "2026-10-21", time: 600, name: "Ana" },
      null,
      10,
      salon,
    );
    expect(text).toContain("Colour and cut");
  });

  it("sends the salon's prompt and tools to Groq", async () => {
    resetGroqCooldowns();
    const create = vi.fn(async (_p: unknown) => ({
      choices: [{ message: { content: "Hi! How can I help you at Bright Cuts?" } }],
    }));
    const client = { chat: { completions: { create } } } as unknown as Groq;
    const out = await runGroqReceptionistTurn(
      {
        history: [{ role: "visitor", text: "hello, can I book a haircut" }],
        bookings: [],
        pending: null,
        now: NOW,
        profile: salon,
      },
      { client },
    );
    expect(out.status).toBe("ok");
    const params = create.mock.calls[0]?.[0] as { messages: { content: string }[]; tools: unknown };
    expect(params.messages[0]?.content).toContain("Bright Cuts Salon");
    expect(JSON.stringify(params.tools)).toContain("womens_cut");
  });
});
