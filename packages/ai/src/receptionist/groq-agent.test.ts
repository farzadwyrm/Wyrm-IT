import type Anthropic from "@anthropic-ai/sdk";
import { type Answers, QUESTIONS, scoreAssessment } from "@wyrm/assessment";
import { formatTime, freeTimes, SERVICES, type Service } from "@wyrm/receptionist";
import type Groq from "groq-sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { writeReadinessReportWithGroq } from "../readiness-report";
import { type ChatMessage, stateContext } from "./agent";
import { compactToolResult } from "./compact";
import {
  GROQ_MODELS,
  resetGroqCooldowns,
  runGroqReceptionistTurn,
  stripReasoning,
} from "./groq-agent";
import { runReceptionist } from "./providers";
import { executeTool } from "./tools";

const NOW = new Date(2026, 9, 19, 10, 0); // Monday 10:00
const CHECKUP = SERVICES.find((s) => s.id === "checkup") as Service;
const THURSDAY = "2026-10-22";
const FIRST_FREE = freeTimes(THURSDAY, CHECKUP, NOW, [])[0] as number;
const hhmm = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

type FakeMessage = {
  content: string | null;
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
};
type Step = FakeMessage | { error: number; retryAfter?: string };

/** A fake Groq client that plays back scripted steps and records the model of each call. */
function fakeGroq(steps: Step[]) {
  const models: string[] = [];
  let i = 0;
  const create = vi.fn(async (params: { model: string }) => {
    models.push(params.model);
    const step = steps[Math.min(i++, steps.length - 1)] as Step;
    if ("error" in step) {
      throw Object.assign(new Error("rate limited"), {
        status: step.error,
        headers: { get: (n: string) => (n === "retry-after" ? (step.retryAfter ?? null) : null) },
      });
    }
    return { choices: [{ message: step }] };
  });
  return { client: { chat: { completions: { create } } } as unknown as Groq, models, create };
}

const call = (id: string, name: string, args: unknown) => ({
  id,
  type: "function" as const,
  function: { name, arguments: JSON.stringify(args) },
});

const history = (...texts: string[]): ChatMessage[] =>
  texts.map((text, i) => ({ role: i % 2 === 0 ? "visitor" : "receptionist", text }));

const input = (
  texts: string[],
  extra: Partial<Parameters<typeof runGroqReceptionistTurn>[0]> = {},
) => ({
  history: history(...texts),
  bookings: [],
  pending: null,
  now: NOW,
  ...extra,
});

beforeEach(() => resetGroqCooldowns());

describe("stripReasoning", () => {
  it("removes leaked <think> blocks", () => {
    expect(stripReasoning("<think>let me plan</think>Hello there!")).toBe("Hello there!");
    expect(stripReasoning("<think>unfinished reasoning")).toBe("");
  });
});

describe("runGroqReceptionistTurn", () => {
  it("is unavailable without a Groq key", async () => {
    expect(await runGroqReceptionistTurn(input(["hi"]), { apiKey: "" })).toMatchObject({
      status: "unavailable",
      reason: "not_configured",
    });
  });

  it("answers with the first free model, runs tools, costs nothing", async () => {
    const { client, models } = fakeGroq([
      {
        content: "Let me have a look.",
        tool_calls: [
          call("c1", "check_availability", {
            service_id: "checkup",
            day: THURSDAY,
            part_of_day: "any",
          }),
        ],
      },
      { content: "On Thursday I have 9 am or 2 pm. Would either suit you?" },
    ]);
    const outcome = await runGroqReceptionistTurn(input(["check-up thursday?"]), { client });
    expect(outcome).toMatchObject({
      status: "ok",
      provider: "groq",
      costCents: 0,
      text: "Let me have a look. On Thursday I have 9 am or 2 pm. Would either suit you?",
    });
    expect(models.every((m) => m === GROQ_MODELS[0]?.id)).toBe(true);
  });

  it("moves to the next free model when one is rate-limited, and rests the limited one", async () => {
    let now = 1_000_000;
    const clock = () => now;
    const first = fakeGroq([
      { error: 429, retryAfter: "30" },
      { content: "Hello from the second model." },
    ]);
    const outcome = await runGroqReceptionistTurn(input(["hi"]), { client: first.client, clock });
    expect(outcome).toMatchObject({ status: "ok", text: "Hello from the second model." });
    expect(first.models).toEqual([GROQ_MODELS[0]?.id, GROQ_MODELS[1]?.id]);

    // While the first model rests, it is skipped.
    const second = fakeGroq([{ content: "Still the second model." }]);
    await runGroqReceptionistTurn(input(["hi"]), { client: second.client, clock });
    expect(second.models).toEqual([GROQ_MODELS[1]?.id]);

    // After the retry-after window, the first model is used again.
    now += 31_000;
    const third = fakeGroq([{ content: "Back to the first model." }]);
    await runGroqReceptionistTurn(input(["hi"]), { client: third.client, clock });
    expect(third.models).toEqual([GROQ_MODELS[0]?.id]);
  });

  it("waits for a short per-minute limit to refill, then answers", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    let now = 5_000_000;
    const slept: number[] = [];
    const { client, models } = fakeGroq([
      { error: 429, retryAfter: "3" },
      { error: 429, retryAfter: "5" },
      { error: 429, retryAfter: "6" },
      { content: "Thanks for waiting! We open at 9 am." },
    ]);
    const outcome = await runGroqReceptionistTurn(input(["when do you open?"]), {
      client,
      clock: () => now,
      sleep: async (ms) => {
        slept.push(ms);
        now += ms;
      },
    });
    expect(outcome).toMatchObject({ status: "ok", text: "Thanks for waiting! We open at 9 am." });
    expect(slept).toHaveLength(1);
    expect(slept[0]).toBeLessThanOrEqual(3_500);
    expect(models).toEqual([...GROQ_MODELS.map((m) => m.id), GROQ_MODELS[0]?.id]);
    warn.mockRestore();
  });

  it("does not make the visitor wait for a long (daily) limit", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const slept: number[] = [];
    const { client } = fakeGroq([{ error: 429, retryAfter: "600" }]);
    const outcome = await runGroqReceptionistTurn(input(["hi"]), {
      client,
      sleep: async (ms) => {
        slept.push(ms);
      },
    });
    expect(outcome).toMatchObject({ status: "unavailable" });
    expect(slept).toHaveLength(0);
    warn.mockRestore();
  });

  it("is unavailable when every free model is limited", async () => {
    const { client } = fakeGroq([{ error: 429 }]);
    expect(await runGroqReceptionistTurn(input(["hi"]), { client })).toMatchObject({
      status: "unavailable",
    });
  });

  it("cannot book in the same turn it proposed (same guardrails as Claude)", async () => {
    const proposal = executeTool(
      "propose_booking",
      { service_id: "checkup", day: THURSDAY, time: hhmm(FIRST_FREE), name: "Alex" },
      { now: NOW, bookings: [], pendingFromEarlierTurn: null, latestVisitorMessage: "" },
    );
    const id = proposal.event?.type === "proposed" ? proposal.event.proposal.id : "";
    const { client } = fakeGroq([
      {
        content: null,
        tool_calls: [
          call("c1", "propose_booking", {
            service_id: "checkup",
            day: THURSDAY,
            time: hhmm(FIRST_FREE),
            name: "Alex",
          }),
        ],
      },
      { content: null, tool_calls: [call("c2", "book_appointment", { proposal_id: id })] },
      { content: "Booked!" },
    ]);
    const outcome = await runGroqReceptionistTurn(
      input(["yes book a check-up thursday for Alex"]),
      { client },
    );
    if (outcome.status !== "ok") throw new Error("expected ok");
    expect(outcome.events.map((e) => e.type)).toEqual(["proposed"]);
  });

  it("survives malformed tool arguments", async () => {
    const { client } = fakeGroq([
      {
        content: null,
        tool_calls: [
          {
            id: "c1",
            type: "function",
            function: { name: "check_availability", arguments: "{not json" },
          },
        ],
      },
      { content: "Sorry, which day would you like?" },
    ]);
    expect(await runGroqReceptionistTurn(input(["hi"]), { client })).toMatchObject({
      status: "ok",
      text: "Sorry, which day would you like?",
    });
  });
});

describe("runReceptionist provider chain", () => {
  const claudeDown = {
    client: {
      messages: {
        create: vi.fn(async () => {
          throw new Error("down");
        }),
      },
    } as unknown as Anthropic,
  };

  it("uses Groq when Claude has no key", async () => {
    const { client } = fakeGroq([{ content: "Hello!" }]);
    const outcome = await runReceptionist(input(["hi"]), {
      claude: { apiKey: "" },
      groq: { client },
    });
    expect(outcome).toMatchObject({ status: "ok", provider: "groq" });
  });

  it("falls through to Groq when Claude fails", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = fakeGroq([{ content: "Hello from Groq." }]);
    const outcome = await runReceptionist(input(["hi"]), { claude: claudeDown, groq: { client } });
    expect(outcome).toMatchObject({ status: "ok", provider: "groq" });
    spy.mockRestore();
  });

  it("reports not_configured when neither key exists", async () => {
    const outcome = await runReceptionist(input(["hi"]), {
      claude: { apiKey: "" },
      groq: { apiKey: "" },
    });
    expect(outcome).toMatchObject({ status: "unavailable", reason: "not_configured" });
  });
});

describe("writeReadinessReportWithGroq", () => {
  const result = scoreAssessment(
    QUESTIONS,
    Object.fromEntries(QUESTIONS.map((q) => [q.id, "gap"])) as Answers,
  );

  it("writes the summary for free and strips reasoning", async () => {
    const { client } = fakeGroq([
      { content: "<think>plan</think>Based on your answers, start with backups." },
    ]);
    expect(await writeReadinessReportWithGroq(result, { client })).toEqual({
      status: "ok",
      text: "Based on your answers, start with backups.",
      costCents: 0,
    });
  });

  it("tries the next model when one fails", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client, models } = fakeGroq([{ error: 429 }, { content: "Summary." }]);
    expect(await writeReadinessReportWithGroq(result, { client })).toMatchObject({ status: "ok" });
    expect(models.length).toBe(2);
    spy.mockRestore();
  });
});

describe("deterministic booking on a clear yes (live bug 2026-10-19)", () => {
  const proposal = () => {
    const out = executeTool(
      "propose_booking",
      { service_id: "checkup", day: THURSDAY, time: hhmm(FIRST_FREE), name: "Sam" },
      { now: NOW, bookings: [], pendingFromEarlierTurn: null, latestVisitorMessage: "" },
    );
    if (out.event?.type !== "proposed") throw new Error("expected a proposal");
    return out.event.proposal;
  };
  const readBack = (p: { time: number }) =>
    `So that's a check-up on Thursday the 22nd of October at ${formatTime(p.time)} for Sam. Is that right?`;

  it("books even when the model re-reads the details instead of booking", async () => {
    const p = proposal();
    const { client, create } = fakeGroq([
      // The model ignores the yes and proposes again (what gpt-oss did live).
      {
        content: null,
        tool_calls: [
          call("c1", "propose_booking", {
            service_id: "checkup",
            day: THURSDAY,
            time: hhmm(FIRST_FREE),
            name: "Sam",
          }),
        ],
      },
      { content: "You're all set, Sam!" },
    ]);
    const outcome = await runGroqReceptionistTurn(
      input(["check-up thursday", readBack(p), "yes that's right"], { pending: p }),
      { client },
    );
    if (outcome.status !== "ok") throw new Error("expected ok");
    expect(outcome.events.filter((e) => e.type === "booked")).toHaveLength(1);
    // The model was told it is booked, with the reference.
    const firstRequest = create.mock.calls[0]?.[0] as unknown as
      | { messages: unknown[] }
      | undefined;
    const system = JSON.stringify(
      firstRequest?.messages.filter((m) => (m as { role: string }).role === "user"),
    );
    expect(system).toMatch(/Just booked because they said yes: HL-\d{4}/);
  });

  it("never books twice when the model also calls book_appointment", async () => {
    const p = proposal();
    const { client } = fakeGroq([
      { content: null, tool_calls: [call("c1", "book_appointment", { proposal_id: p.id })] },
      { content: "Booked!" },
    ]);
    const outcome = await runGroqReceptionistTurn(
      input(["check-up thursday", readBack(p), "yes please"], { pending: p }),
      { client },
    );
    if (outcome.status !== "ok") throw new Error("expected ok");
    expect(outcome.events.filter((e) => e.type === "booked")).toHaveLength(1);
  });

  it("does not auto-book a yes that answers a different question", async () => {
    const p = proposal();
    const { client } = fakeGroq([{ content: "Great, I'll let the team know." }]);
    const outcome = await runGroqReceptionistTurn(
      input(["check-up thursday", "Would you like me to pass a message to the team?", "yes"], {
        pending: p,
      }),
      { client },
    );
    if (outcome.status !== "ok") throw new Error("expected ok");
    expect(outcome.events.filter((e) => e.type === "booked")).toHaveLength(0);
  });

  it("does not auto-book a yes with a change in it", async () => {
    const p = proposal();
    const { client } = fakeGroq([{ content: "Sure, let me check 4 pm." }]);
    const outcome = await runGroqReceptionistTurn(
      input(["check-up thursday", readBack(p), "yes but make it 4pm"], { pending: p }),
      { client },
    );
    if (outcome.status !== "ok") throw new Error("expected ok");
    expect(outcome.events.filter((e) => e.type === "booked")).toHaveLength(0);
  });

  it("tells the model never to claim a booking that doesn't exist", () => {
    const text = stateContext(NOW, "voice", [], proposal());
    expect(text).toContain(
      "Only say an appointment is booked or confirmed if it appears under bookings",
    );
    expect(text).toContain("call book_appointment with that proposal_id");
  });
});

describe("reply guard in the loop (live bug 2026-10-19, turns 3 and 4)", () => {
  const twelve = () => {
    const out = executeTool(
      "propose_booking",
      { service_id: "checkup", day: THURSDAY, time: hhmm(FIRST_FREE), name: "Sam" },
      { now: NOW, bookings: [], pendingFromEarlierTurn: null, latestVisitorMessage: "" },
    );
    if (out.event?.type !== "proposed") throw new Error("expected a proposal");
    return out.event.proposal;
  };
  const four = freeTimes(THURSDAY, CHECKUP, NOW, []).find((t) => t >= 15 * 60) as number;

  it("makes the model propose before reading back a new time", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { client } = fakeGroq([
      { content: `Sure, ${formatTime(four)} on Thursday the 22nd works. Is that right?` },
      {
        content: null,
        tool_calls: [
          call("c1", "propose_booking", {
            service_id: "checkup",
            day: THURSDAY,
            time: hhmm(four),
            name: "Sam",
          }),
        ],
      },
      {
        content: `So that's a check-up on Thursday the 22nd at ${formatTime(four)} for Sam. Is that right?`,
      },
    ]);
    const outcome = await runGroqReceptionistTurn(
      input(["check-up thursday", "That's 12 pm. Is that right?", "ok what about four instead"], {
        pending: twelve(),
      }),
      { client },
    );
    if (outcome.status !== "ok") throw new Error("expected ok");
    expect(outcome.events.map((e) => e.type)).toEqual(["proposed"]);
    expect(outcome.text).toContain("Is that right?");
    warn.mockRestore();
  });

  it("never lets a false 'booked' claim through; falls back to an honest line", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { client } = fakeGroq([
      {
        content:
          "All done, your check-up is booked for Thursday at 4 pm, reference P-20261022-1600-checkup.",
      },
      { content: "Great, you're all set for Thursday at 4 pm!" },
    ]);
    const outcome = await runGroqReceptionistTurn(
      input(["check-up thursday", "Sure, 4 pm works. Is that right?", "yes that's right"], {
        pending: twelve(),
      }),
      { client },
    );
    if (outcome.status !== "ok") throw new Error("expected ok");
    expect(outcome.events.filter((e) => e.type === "booked")).toHaveLength(0);
    expect(outcome.text).toMatch(/^Just to be sure, nothing is booked yet/);
    warn.mockRestore();
  });
});

describe("token savings", () => {
  it("answers a plain question instantly without calling any model", async () => {
    const { client, create } = fakeGroq([{ content: "should not be used" }]);
    const outcome = await runReceptionist(input(["what are your opening hours?"]), {
      claude: { apiKey: "" },
      groq: { client },
    });
    expect(outcome).toMatchObject({ status: "ok", provider: "instant", costCents: 0 });
    expect(create).not.toHaveBeenCalled();
  });

  it("keeps the system prompt fixed and puts the changing state in the last message", async () => {
    const { client, create } = fakeGroq([{ content: "Hello!" }]);
    await runGroqReceptionistTurn(input(["hi", "Hello, how can I help?", "do you do cleanings"]), {
      client,
    });
    const request = create.mock.calls[0]?.[0] as unknown as {
      messages: { role: string; content: string }[];
    };
    const messages = request.messages;
    expect(messages[0]?.role).toBe("system");
    expect(messages[0]?.content).not.toContain("Current local time");
    expect(messages.at(-1)?.content).toMatch(
      /^\[Booking system note[\s\S]*Current local time[\s\S]*\[The visitor says\]\ndo you do cleanings$/,
    );
    // Earlier history is sent unchanged, so the cached prefix keeps matching across turns.
    expect(messages[1]?.content).toBe("hi");
  });

  it("compacts tool results to plain times", () => {
    const full = executeTool(
      "check_availability",
      { service_id: "checkup", day: THURSDAY, part_of_day: "any" },
      { now: NOW, bookings: [], pendingFromEarlierTurn: null, latestVisitorMessage: "" },
    ).content;
    const slim = compactToolResult(full);
    expect(slim.length).toBeLessThan(full.length / 2);
    expect(JSON.parse(slim).free_times[0]).toMatch(/^\d{2}:\d{2}$/);
  });
});
