import type Anthropic from "@anthropic-ai/sdk";
import { freeTimes, SERVICES, type Service } from "@wyrm/receptionist";
import { describe, expect, it, vi } from "vitest";
import { type ChatMessage, runReceptionistTurn, stateContext } from "./agent";
import { calendarContext, executeTool, type Proposal, type ToolContext } from "./tools";

// Monday 19 October 2026, 10:00 local time.
const NOW = new Date(2026, 9, 19, 10, 0);
const CHECKUP = SERVICES.find((s) => s.id === "checkup") as Service;
const THURSDAY = "2026-10-22";
const FREE = freeTimes(THURSDAY, CHECKUP, NOW, []);
const FIRST_FREE = FREE[0] as number;
const hhmm = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

const ctx = (overrides: Partial<ToolContext> = {}): ToolContext => ({
  now: NOW,
  bookings: [],
  pendingFromEarlierTurn: null,
  latestVisitorMessage: "",
  ...overrides,
});

const parse = (content: string) => JSON.parse(content) as Record<string, unknown>;

function proposeOk(): Proposal {
  const out = executeTool(
    "propose_booking",
    { service_id: "checkup", day: THURSDAY, time: hhmm(FIRST_FREE), name: "Alex" },
    ctx(),
  );
  if (out.event?.type !== "proposed") throw new Error("expected a proposal");
  return out.event.proposal;
}

describe("tools", () => {
  it("check_availability returns only free times and explains closed days", () => {
    const open = parse(
      executeTool("check_availability", { service_id: "checkup", day: THURSDAY }, ctx()).content,
    );
    expect(open.status).toBe("available");
    const slots = open.free_times as { time: string; say: string }[];
    expect(slots.map((t) => t.time)).toEqual(FREE.map(hhmm));
    expect(slots[0]?.say).toMatch(/(am|pm)$/);

    const sunday = parse(
      executeTool("check_availability", { service_id: "checkup", day: "2026-10-25" }, ctx())
        .content,
    );
    expect(sunday.status).toBe("closed");
    expect(sunday.free_times).toEqual([]);

    const past = parse(
      executeTool("check_availability", { service_id: "checkup", day: "2026-10-01" }, ctx())
        .content,
    );
    expect(past.status).toBe("past");
  });

  it("find_next_available_days never starts in the past", () => {
    const out = parse(
      executeTool(
        "find_next_available_days",
        { service_id: "urgent", from_day: "2020-01-01" },
        ctx(),
      ).content,
    );
    const days = out.days as { day: string }[];
    expect(days.length).toBe(3);
    for (const d of days) expect(d.day >= "2026-10-19").toBe(true);
  });

  it("propose_booking refuses a taken or invalid time and a missing name", () => {
    const taken = Array.from({ length: 16 }, (_, i) => 540 + i * 30).find((t) => !FREE.includes(t));
    expect(
      executeTool(
        "propose_booking",
        { service_id: "checkup", day: THURSDAY, time: hhmm(taken as number), name: "Alex" },
        ctx(),
      ).isError,
    ).toBe(true);
    expect(
      executeTool(
        "propose_booking",
        { service_id: "checkup", day: THURSDAY, time: "25:00", name: "Alex" },
        ctx(),
      ).isError,
    ).toBe(true);
    expect(
      executeTool(
        "propose_booking",
        { service_id: "checkup", day: THURSDAY, time: hhmm(FIRST_FREE), name: "" },
        ctx(),
      ).isError,
    ).toBe(true);
  });

  it("book_appointment needs a proposal from an earlier turn AND a clear yes", () => {
    const proposal = proposeOk();
    const book = (c: Partial<ToolContext>, id = proposal.id) =>
      executeTool("book_appointment", { proposal_id: id }, ctx(c));

    expect(book({ latestVisitorMessage: "yes" }).isError).toBe(true); // no earlier proposal
    expect(
      book({ pendingFromEarlierTurn: proposal, latestVisitorMessage: "hmm, maybe" }).isError,
    ).toBe(true);
    expect(
      book({ pendingFromEarlierTurn: proposal, latestVisitorMessage: "yes but 11am" }).isError,
    ).toBe(true);
    expect(
      book({ pendingFromEarlierTurn: proposal, latestVisitorMessage: "yes" }, "P-made-up").isError,
    ).toBe(true);

    const ok = book({ pendingFromEarlierTurn: proposal, latestVisitorMessage: "Yes please" });
    expect(ok.isError).toBeUndefined();
    expect(ok.event?.type).toBe("booked");
  });

  it("book_appointment re-checks that the slot is still free", () => {
    const proposal = proposeOk();
    const clash = {
      reference: "HL-1",
      serviceId: "checkup",
      day: THURSDAY,
      time: FIRST_FREE,
      name: "Sam",
    };
    const out = executeTool(
      "book_appointment",
      { proposal_id: proposal.id },
      ctx({ pendingFromEarlierTurn: proposal, latestVisitorMessage: "yes", bookings: [clash] }),
    );
    expect(out.isError).toBe(true);
  });

  it("cancel_appointment needs the reference and a clear yes", () => {
    const booking = {
      reference: "HL-1234",
      serviceId: "checkup",
      day: THURSDAY,
      time: FIRST_FREE,
      name: "Alex",
    };
    expect(
      executeTool(
        "cancel_appointment",
        { reference: "HL-1234" },
        ctx({ bookings: [booking], latestVisitorMessage: "cancel?" }),
      ).isError,
    ).toBe(true);
    expect(
      executeTool(
        "cancel_appointment",
        { reference: "HL-9" },
        ctx({ bookings: [booking], latestVisitorMessage: "yes" }),
      ).isError,
    ).toBe(true);
    expect(
      executeTool(
        "cancel_appointment",
        { reference: "hl-1234" },
        ctx({ bookings: [booking], latestVisitorMessage: "yes cancel it" }),
      ).event?.type,
    ).toBe("cancelled");
  });

  it("filters by part of day and spreads suggested times", () => {
    const pm = parse(
      executeTool(
        "check_availability",
        { service_id: "checkup", day: THURSDAY, part_of_day: "afternoon" },
        ctx(),
      ).content,
    );
    for (const t of pm.free_times as { time: string }[]) expect(t.time >= "12:00").toBe(true);
    const next = parse(
      executeTool(
        "find_next_available_days",
        { service_id: "checkup", from_day: THURSDAY, part_of_day: "morning" },
        ctx(),
      ).content,
    );
    const days = next.days as { times: { time: string }[] }[];
    expect(days.length).toBeGreaterThan(0);
    for (const day of days) {
      expect(day.times.length).toBeGreaterThan(0);
      expect(day.times.length).toBeLessThanOrEqual(4);
      for (const t of day.times) expect(t.time < "12:00").toBe(true);
    }
  });

  it("refuses to book on speech-style changes that have no question mark", () => {
    const proposal = proposeOk();
    for (const message of ["ok what about friday", "sure thing three pm works better"]) {
      const out = executeTool(
        "book_appointment",
        { proposal_id: proposal.id },
        ctx({ pendingFromEarlierTurn: proposal, latestVisitorMessage: message }),
      );
      expect(out.isError, message).toBe(true);
    }
  });

  it("calendar context lists three weeks with weekday names", () => {
    const text = calendarContext(NOW);
    expect(text).toContain("Monday 19 October = 2026-10-19");
    expect(text).toContain("Thursday 22 October = 2026-10-22");
    expect(text.split("\n").filter((l) => l.includes(" = ")).length).toBe(21);
  });

  it("describes the waiting proposal in words, with the channel", () => {
    const text = stateContext(NOW, "voice", [], proposeOk());
    expect(text).toContain("Channel: voice.");
    expect(text).toMatch(
      /Waiting for a yes on: Check-up, Thursday the 22nd of October at .+ for Alex/,
    );
  });
});

// ---------------------------------------------------------------- the loop

type FakeBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown };

/** A fake Claude that plays back scripted responses and records every request. */
function scriptedClient(script: FakeBlock[][]) {
  const requests: Anthropic.MessageCreateParams[] = [];
  let i = 0;
  const create = vi.fn(async (params: Anthropic.MessageCreateParams) => {
    requests.push(structuredClone(params));
    const content = script[Math.min(i++, script.length - 1)] ?? [];
    return {
      model: "claude-haiku-5-5",
      stop_reason: content.some((b) => b.type === "tool_use") ? "tool_use" : "end_turn",
      usage: { input_tokens: 2000, output_tokens: 100 },
      content,
    };
  });
  return { client: { messages: { create } } as unknown as Anthropic, requests, create };
}

const history = (...texts: string[]): ChatMessage[] => [
  { role: "receptionist", text: "Hello, how can I help?" },
  ...texts.map(
    (text, i): ChatMessage => ({ role: i % 2 === 0 ? "visitor" : "receptionist", text }),
  ),
];

describe("runReceptionistTurn", () => {
  it("is unavailable without an API key", async () => {
    const outcome = await runReceptionistTurn(
      { history: history("hi"), bookings: [], pending: null, now: NOW },
      { apiKey: "" },
    );
    expect(outcome).toMatchObject({ status: "unavailable", reason: "not_configured" });
  });

  it("runs tools, returns the reply and a proposal event", async () => {
    const { client, requests } = scriptedClient([
      [
        {
          type: "tool_use",
          id: "t1",
          name: "check_availability",
          input: { service_id: "checkup", day: THURSDAY },
        },
      ],
      [
        {
          type: "tool_use",
          id: "t2",
          name: "propose_booking",
          input: { service_id: "checkup", day: THURSDAY, time: hhmm(FIRST_FREE), name: "Alex" },
        },
      ],
      [{ type: "text", text: "Check-up on Thursday at 9, for Alex. Shall I book it?" }],
    ]);
    const outcome = await runReceptionistTurn(
      {
        history: history("check-up thursday first thing, I'm Alex"),
        bookings: [],
        pending: null,
        now: NOW,
      },
      { client },
    );
    expect(outcome.status).toBe("ok");
    if (outcome.status !== "ok") return;
    expect(outcome.events.map((e) => e.type)).toEqual(["proposed"]);
    expect(outcome.costCents).toBeGreaterThan(0);
    // The conversation sent to Claude starts with the visitor, and tool results follow tool calls.
    expect(requests[0]?.messages[0]?.role).toBe("user");
    expect(requests[2]?.messages.length).toBe(5);
  });

  it("keeps text written alongside a tool call (an aside answer, a holding phrase)", async () => {
    const { client } = scriptedClient([
      [
        { type: "text", text: "There's free parking behind the building." },
        {
          type: "tool_use",
          id: "t1",
          name: "check_availability",
          input: { service_id: "checkup", day: THURSDAY, part_of_day: "afternoon" },
        },
      ],
      [{ type: "text", text: "On Thursday afternoon I have 2 pm or 4 pm." }],
    ]);
    const outcome = await runReceptionistTurn(
      {
        history: history("check-up thursday afternoon? and is there parking"),
        bookings: [],
        pending: null,
        now: NOW,
      },
      { client },
    );
    if (outcome.status !== "ok") throw new Error("expected ok");
    expect(outcome.text).toBe(
      "There's free parking behind the building. On Thursday afternoon I have 2 pm or 4 pm.",
    );
  });

  it("sends the voice channel instructions on phone calls", async () => {
    const { client, requests } = scriptedClient([[{ type: "text", text: "Hello!" }]]);
    await runReceptionistTurn(
      { history: history("hi"), bookings: [], pending: null, now: NOW, channel: "voice" },
      { client },
    );
    const system = JSON.stringify(requests[0]?.system);
    expect(system).toContain("You're on a phone call");
    expect(system).toContain("Channel: voice.");
  });

  it("cannot book in the same turn it proposed, even if the model tries", async () => {
    const { client } = scriptedClient([
      [
        {
          type: "tool_use",
          id: "t1",
          name: "propose_booking",
          input: { service_id: "checkup", day: THURSDAY, time: hhmm(FIRST_FREE), name: "Alex" },
        },
      ],
      [
        {
          type: "tool_use",
          id: "t2",
          name: "book_appointment",
          input: { proposal_id: proposeOk().id },
        },
      ],
      [{ type: "text", text: "Booked!" }],
    ]);
    const outcome = await runReceptionistTurn(
      {
        history: history("yes book a check-up thursday for Alex"),
        bookings: [],
        pending: null,
        now: NOW,
      },
      { client },
    );
    if (outcome.status !== "ok") throw new Error("expected ok");
    expect(outcome.events.some((e) => e.type === "booked")).toBe(false);
  });

  it("books a proposal from the previous turn after a clear yes", async () => {
    const proposal = proposeOk();
    const { client } = scriptedClient([
      [
        {
          type: "tool_use",
          id: "t1",
          name: "book_appointment",
          input: { proposal_id: proposal.id },
        },
      ],
      [{ type: "text", text: "You're booked." }],
    ]);
    const outcome = await runReceptionistTurn(
      {
        history: history("book a check-up", "Shall I book it?", "yes please"),
        bookings: [],
        pending: proposal,
        now: NOW,
      },
      { client },
    );
    if (outcome.status !== "ok") throw new Error("expected ok");
    expect(outcome.events.map((e) => e.type)).toEqual(["booked"]);
  });

  it("stops after a bounded number of tool rounds", async () => {
    const loop: FakeBlock[] = [
      {
        type: "tool_use",
        id: "x",
        name: "check_availability",
        input: { service_id: "checkup", day: THURSDAY },
      },
    ];
    const { client, create } = scriptedClient([loop]);
    const outcome = await runReceptionistTurn(
      { history: history("hi"), bookings: [], pending: null, now: NOW },
      { client },
    );
    expect(outcome).toMatchObject({ status: "unavailable", reason: "error" });
    expect(create).toHaveBeenCalledTimes(6);
  });

  it("never throws when the API fails", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const client = {
      messages: {
        create: vi.fn(async () => {
          throw new Error("down");
        }),
      },
    } as unknown as Anthropic;
    await expect(
      runReceptionistTurn(
        { history: history("hi"), bookings: [], pending: null, now: NOW },
        { client },
      ),
    ).resolves.toMatchObject({ status: "unavailable", reason: "error" });
    spy.mockRestore();
  });
});
