import type Anthropic from "@anthropic-ai/sdk";
import type Groq from "groq-sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EXTRACT_SYSTEM_PROMPT, extractSteps } from "./extract-steps";
import { resetGroqCooldowns } from "./receptionist/groq-agent";

type Reply = { content: string } | { error: number };

function fakeGroq(replies: Reply[]) {
  let i = 0;
  const create = vi.fn(async (_params: unknown) => {
    const r = replies[Math.min(i++, replies.length - 1)] as Reply;
    if ("error" in r) throw Object.assign(new Error("failed"), { status: r.error });
    return { choices: [{ message: r }], usage: { prompt_tokens: 600, completion_tokens: 300 } };
  });
  return { client: { chat: { completions: { create } } } as unknown as Groq, create };
}

const STEPS = {
  steps: [
    {
      name: "Open the supplier email",
      actorType: "owner",
      tools: ["Gmail"],
      inputFormat: "document",
      rekeying: false,
      decisionType: "none",
      impactFlags: [],
    },
    {
      name: "Type the invoice into Xero",
      actorType: "owner",
      tools: ["Xero"],
      inputFormat: "document",
      rekeying: true,
      decisionType: "fixed_rule",
      impactFlags: [],
    },
  ],
};

const INPUT = {
  walkthrough: "I opened the supplier email and typed the invoice into Xero.",
  outcome: "Invoice entered",
  trigger: "email",
};
const noClaude = { apiKey: "" };

describe("extractSteps", () => {
  beforeEach(() => resetGroqCooldowns());

  it("drafts steps with Groq after the fixed prompt", async () => {
    const { client, create } = fakeGroq([
      { content: `\`\`\`json\n${JSON.stringify(STEPS)}\n\`\`\`` },
    ]);
    const out = await extractSteps(INPUT, { claude: noClaude, groq: { client } });
    expect(out).toMatchObject({ provider: "groq", costCents: 0 });
    expect(out.steps).toHaveLength(2);
    const params = create.mock.calls[0]?.[0] as { messages: { content: string }[] };
    expect(params.messages[0]?.content).toBe(EXTRACT_SYSTEM_PROMPT);
    expect(params.messages[1]?.content).toContain(INPUT.walkthrough);
    expect(params).not.toHaveProperty("parallel_tool_calls");
  });

  it("tries the next model on invalid output, then skips rate-limited ones", async () => {
    const first = fakeGroq([
      { error: 429 },
      { content: "not json" },
      { content: JSON.stringify(STEPS) },
    ]);
    const out = await extractSteps(INPUT, { claude: noClaude, groq: { client: first.client } });
    expect(out.provider).toBe("groq");
    expect(first.create).toHaveBeenCalledTimes(3);
    const second = fakeGroq([{ content: JSON.stringify(STEPS) }]);
    await extractSteps(INPUT, { claude: noClaude, groq: { client: second.client } });
    const model = (c: unknown) => (c as { model: string } | undefined)?.model;
    expect(model(second.create.mock.calls[0]?.[0])).not.toBe(
      model(first.create.mock.calls[0]?.[0]),
    );
  });

  it("falls back to keyword rules on the text without AI", async () => {
    const out = await extractSteps(
      {
        ...INPUT,
        walkthrough: "I open the email.\nI type the invoice into Xero.\nI pay the supplier.",
      },
      { claude: noClaude, groq: { apiKey: "" } },
    );
    expect(out.provider).toBe("text");
    expect(out.steps.map((s) => s.name)).toEqual([
      "I open the email",
      "I type the invoice into Xero",
      "I pay the supplier",
    ]);
  });

  it("prefers Claude when configured", async () => {
    const create = vi.fn(async () => ({
      model: "claude-haiku-5-5",
      stop_reason: "end_turn",
      usage: { input_tokens: 600, output_tokens: 300 },
      content: [{ type: "text", text: JSON.stringify(STEPS) }],
    }));
    const { client, create: groqCreate } = fakeGroq([{ content: "unused" }]);
    const out = await extractSteps(INPUT, {
      claude: { client: { messages: { create } } as unknown as Anthropic },
      groq: { client },
    });
    expect(out.provider).toBe("claude");
    expect(groqCreate).not.toHaveBeenCalled();
  });
});
