import type Anthropic from "@anthropic-ai/sdk";
import type Groq from "groq-sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PLANNER_SYSTEM_PROMPT, planWorkflow } from "./planner";
import { resetGroqCooldowns } from "./receptionist/groq-agent";

type Step = { content: string } | { error: number };

function fakeGroq(steps: Step[]) {
  let i = 0;
  const create = vi.fn(async (_params: unknown) => {
    const step = steps[Math.min(i++, steps.length - 1)] as Step;
    if ("error" in step) throw Object.assign(new Error("failed"), { status: step.error });
    return { choices: [{ message: step }], usage: { prompt_tokens: 700, completion_tokens: 300 } };
  });
  return { client: { chat: { completions: { create } } } as unknown as Groq, create };
}

const WORKFLOW = {
  title: "Quote requests to approved quotes",
  steps: [
    { kind: "trigger", label: "Quote form submitted", detail: "From the website." },
    { kind: "agent", label: "Draft the quote", detail: "Using the price list." },
    { kind: "human", label: "Owner approves", detail: "Before anything is sent." },
    { kind: "output", label: "Quote sent", detail: "And logged in the CRM." },
  ],
  integrations: ["Gmail", "HubSpot"],
  guardrails: ["Never sends without approval", "No discounts", "Logs every quote"],
};

const noClaude = { apiKey: "" };
const noGroq = { apiKey: "" };
const LONG_TASK =
  "Customers fill in a quote form for kitchen renovations and we write each quote by hand";

describe("planWorkflow", () => {
  beforeEach(() => resetGroqCooldowns());

  it("shows a standard workflow for short, clear tasks without any model", async () => {
    const { client, create } = fakeGroq([{ content: "unused" }]);
    const outcome = await planWorkflow("answer our phones", { claude: noClaude, groq: { client } });
    expect(outcome).toMatchObject({ status: "ok", provider: "template", costCents: 0 });
    expect(create).not.toHaveBeenCalled();
  });

  it("designs a workflow with Groq and validates it", async () => {
    const { client, create } = fakeGroq([
      { content: `Here you go:\n\`\`\`json\n${JSON.stringify(WORKFLOW)}\n\`\`\`` },
    ]);
    const outcome = await planWorkflow(LONG_TASK, { claude: noClaude, groq: { client } });
    expect(outcome.status).toBe("ok");
    if (outcome.status !== "ok") return;
    expect(outcome.provider).toBe("groq");
    expect(outcome.workflow.steps).toHaveLength(4);
    const params = create.mock.calls[0]?.[0] as {
      messages: { role: string; content: string }[];
    };
    expect(params.messages[0]?.content).toBe(PLANNER_SYSTEM_PROMPT);
    expect(params.messages[1]?.content).toBe(LONG_TASK);
    expect(params).not.toHaveProperty("parallel_tool_calls");
  });

  it("tries the next model when a reply is not a valid workflow", async () => {
    const { client, create } = fakeGroq([
      { content: '{"title":"x","steps":[]}' },
      { content: JSON.stringify(WORKFLOW) },
    ]);
    const outcome = await planWorkflow(LONG_TASK, { claude: noClaude, groq: { client } });
    expect(outcome).toMatchObject({ status: "ok", provider: "groq" });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("skips a rate-limited model next time", async () => {
    const first = fakeGroq([{ error: 429 }, { content: JSON.stringify(WORKFLOW) }]);
    await planWorkflow(LONG_TASK, { claude: noClaude, groq: { client: first.client } });
    const second = fakeGroq([{ content: JSON.stringify(WORKFLOW) }]);
    await planWorkflow(LONG_TASK, { claude: noClaude, groq: { client: second.client } });
    const model = (c: unknown) => (c as { model: string } | undefined)?.model;
    expect(model(second.create.mock.calls[0]?.[0])).not.toBe(
      model(first.create.mock.calls[0]?.[0]),
    );
  });

  it("reports off-topic requests", async () => {
    const { client } = fakeGroq([{ content: '{"off_topic": true}' }]);
    const outcome = await planWorkflow("write me a poem about the sea please, a long one", {
      claude: noClaude,
      groq: { client },
    });
    expect(outcome.status).toBe("off_topic");
  });

  it("falls back to the closest standard workflow without AI", async () => {
    const outcome = await planWorkflow(
      "we spend every Monday typing supplier invoices into our accounting software",
      { claude: noClaude, groq: noGroq },
    );
    expect(outcome).toMatchObject({ status: "fallback" });
    if (outcome.status === "fallback") expect(outcome.agent?.slug).toBe("back-office-agent");
  });

  it("prefers Claude when configured", async () => {
    const create = vi.fn(async () => ({
      model: "claude-haiku-5-5",
      stop_reason: "end_turn",
      usage: { input_tokens: 700, output_tokens: 300 },
      content: [{ type: "text", text: JSON.stringify(WORKFLOW) }],
    }));
    const claude = { messages: { create } } as unknown as Anthropic;
    const { client, create: groqCreate } = fakeGroq([{ content: "unused" }]);
    const outcome = await planWorkflow(LONG_TASK, { claude: { client: claude }, groq: { client } });
    expect(outcome).toMatchObject({ status: "ok", provider: "claude" });
    expect(groqCreate).not.toHaveBeenCalled();
  });
});
