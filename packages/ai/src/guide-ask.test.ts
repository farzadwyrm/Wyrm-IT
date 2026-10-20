import type Anthropic from "@anthropic-ai/sdk";
import type Groq from "groq-sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { askGuide, cleanAnswer, GUIDE_SYSTEM_PROMPT, guideSystem } from "./guide-ask";
import { resetGroqCooldowns } from "./receptionist/groq-agent";

type Step = { content: string } | { error: number };

function fakeGroq(steps: Step[]) {
  let i = 0;
  const create = vi.fn(async (_params: unknown) => {
    const step = steps[Math.min(i++, steps.length - 1)] as Step;
    if ("error" in step) throw Object.assign(new Error("failed"), { status: step.error });
    return { choices: [{ message: step }], usage: { prompt_tokens: 900, completion_tokens: 80 } };
  });
  return { client: { chat: { completions: { create } } } as unknown as Groq, create };
}

const noClaude = { apiKey: "" };
const noGroq = { apiKey: "" };

describe("askGuide", () => {
  beforeEach(() => resetGroqCooldowns());

  it("answers clear questions from the guide without any model", async () => {
    const { client, create } = fakeGroq([{ content: "unused" }]);
    const outcome = await askGuide(
      { question: "quick wins for backups" },
      { claude: noClaude, groq: { client } },
    );
    expect(outcome).toMatchObject({ status: "ok", provider: "instant", costCents: 0 });
    expect(outcome.area?.slug).toBe("backup-recovery");
    expect(create).not.toHaveBeenCalled();
  });

  it("asks Groq with only the matched area's notes, after the fixed prompt", async () => {
    const { client, create } = fakeGroq([{ content: "Test a restore **every month**." }]);
    const outcome = await askGuide(
      { question: "We have 12 staff and one NAS. How should we back it up?" },
      { claude: noClaude, groq: { client } },
    );
    expect(outcome).toMatchObject({
      status: "ok",
      provider: "groq",
      text: "Test a restore every month.",
    });
    const params = create.mock.calls[0]?.[0] as { messages: { role: string; content: string }[] };
    const system = params.messages[0]?.content ?? "";
    expect(system.startsWith(GUIDE_SYSTEM_PROMPT)).toBe(true);
    expect(system).toContain("AREA: Backups and recovery");
    expect(system).not.toContain("AREA: Network and internet");
    expect(params).not.toHaveProperty("parallel_tool_calls");
  });

  it("gives the same prompt prefix for every question on the same page", async () => {
    const area = { areaSlug: "network" };
    const { client, create } = fakeGroq([{ content: "a" }]);
    await askGuide(
      { question: "how long does it take to set this up?", ...area },
      { claude: noClaude, groq: { client } },
    );
    await askGuide(
      { question: "is this expensive?", ...area },
      { claude: noClaude, groq: { client } },
    );
    const systems = create.mock.calls.map(
      (c) => (c[0] as { messages: { content: string }[] }).messages[0]?.content,
    );
    expect(systems[0]).toBe(systems[1]);
  });

  it("tries the next free model when one fails", async () => {
    const { client, create } = fakeGroq([{ error: 429 }, { content: "Here is how." }]);
    const outcome = await askGuide(
      { question: "is our firewall setup normal for a 20 person office?" },
      { claude: noClaude, groq: { client } },
    );
    expect(outcome).toMatchObject({ status: "ok", provider: "groq" });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("falls back to the guide when no AI is available", async () => {
    const outcome = await askGuide(
      { question: "how should a small firm handle ransomware?" },
      { claude: noClaude, groq: noGroq },
    );
    expect(outcome.status).toBe("fallback");
    expect(outcome.text).toContain("Quick wins");
  });

  it("prefers Claude when configured", async () => {
    const create = vi.fn(async () => ({
      model: "claude-haiku-5-5",
      stop_reason: "end_turn",
      usage: { input_tokens: 800, output_tokens: 60 },
      content: [{ type: "text", text: "Start with two-step login." }],
    }));
    const claude = { messages: { create } } as unknown as Anthropic;
    const { client: groq, create: groqCreate } = fakeGroq([{ content: "unused" }]);
    const outcome = await askGuide(
      { question: "where should a ten person company start with security?" },
      { claude: { client: claude }, groq: { client: groq } },
    );
    expect(outcome).toMatchObject({ status: "ok", provider: "claude" });
    expect(groqCreate).not.toHaveBeenCalled();
  });

  it("sends follow-ups to the AI with recent history only", async () => {
    const { client, create } = fakeGroq([{ content: "ok" }]);
    const history = Array.from({ length: 10 }, (_, i) => ({
      role: i % 2 === 0 ? ("visitor" as const) : ("assistant" as const),
      text: `turn ${i}`,
    }));
    await askGuide(
      { question: "quick wins?", areaSlug: "network", history },
      { claude: noClaude, groq: { client } },
    );
    const params = create.mock.calls[0]?.[0] as { messages: unknown[] };
    // system + 4 history turns + question
    expect(params.messages).toHaveLength(6);
  });
});

describe("rate limits", () => {
  beforeEach(() => resetGroqCooldowns());

  it("skips a rate-limited model on the next question", async () => {
    const first = fakeGroq([{ error: 429 }, { content: "ok" }]);
    await askGuide(
      { question: "is our firewall setup normal for a small office?" },
      { claude: noClaude, groq: { client: first.client } },
    );
    const second = fakeGroq([{ content: "ok" }]);
    await askGuide(
      { question: "is our firewall setup normal for a big office?" },
      { claude: noClaude, groq: { client: second.client } },
    );
    const firstModel = (first.create.mock.calls[0]?.[0] as { model: string } | undefined)?.model;
    const used = (second.create.mock.calls[0]?.[0] as { model: string } | undefined)?.model;
    expect(used).not.toBe(firstModel);
  });
});

describe("guideSystem and cleanAnswer", () => {
  it("lists all areas when the question matches none", () => {
    expect(guideSystem(null)).toContain("Backups and recovery (/guide/backup-recovery)");
  });

  it("strips external links and markdown", () => {
    expect(cleanAnswer("See [this](https://evil.example) and **bold** https://x.y/z")).toBe(
      "See this and bold",
    );
  });
});
