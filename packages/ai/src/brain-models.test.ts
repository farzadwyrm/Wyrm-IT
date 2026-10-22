import { beforeEach, describe, expect, it } from "vitest";
import {
  answerAsAgent,
  answerFromDocuments,
  brainClassifiers,
  draftProfileFromPages,
  expandQuestion,
  firstJson,
  judgeReply,
  type ModelClients,
  planLookup,
} from "./brain-models";
import { resetGroqCooldowns } from "./receptionist/groq-agent";

// Fake clients only: no network, no keys.
function fakeAnthropic(reply: string | Error) {
  return {
    messages: {
      create: async () => {
        if (reply instanceof Error) throw reply;
        return {
          content: [{ type: "text", text: reply }],
          usage: { input_tokens: 200, output_tokens: 20 },
        };
      },
    },
  } as unknown as NonNullable<ModelClients["anthropic"]>;
}

function fakeGroq(replies: (string | Error)[]) {
  let i = 0;
  return {
    chat: {
      completions: {
        create: async () => {
          const r = replies[Math.min(i++, replies.length - 1)];
          if (r instanceof Error) throw r;
          return {
            choices: [{ message: { content: r } }],
            usage: { prompt_tokens: 150, completion_tokens: 15 },
          };
        },
      },
    },
  } as unknown as NonNullable<ModelClients["groq"]>;
}

const knowledge = {
  businessName: "Bright Smile Dental",
  agentName: "Front desk",
  businessFacts: "Open Mon-Fri 9-17. Cleaning costs 60 EUR.",
  taught: [{ topic: "parking", answer: "Free parking behind the building." }],
};

beforeEach(() => resetGroqCooldowns());

describe("classifiers", () => {
  it("parse Haiku's JSON and price it in USD millionths", async () => {
    const [haiku] = brainClassifiers({
      anthropic: fakeAnthropic('{"intent": "booking", "confidence": 0.9}'),
    });
    const r = await haiku?.classify("Can I book a cleaning?", ["booking", "other"]);
    expect(r).toMatchObject({ intent: "booking", confidence: 0.9, provider: "anthropic" });
    expect(r?.costMicros).toBe(30); // 200 x $0.10 + 20 x $0.50 per million tokens
  });

  it("return null on bad output or errors, so the brain falls back", async () => {
    const [bad] = brainClassifiers({ anthropic: fakeAnthropic("I think booking") });
    expect(await bad?.classify("x", ["booking"])).toBeNull();
    const [broken] = brainClassifiers({ anthropic: fakeAnthropic(new Error("timeout")) });
    expect(await broken?.classify("x", ["booking"])).toBeNull();
  });

  it("offer Haiku (paid) and Groq (free) separately, Groq costing nothing", async () => {
    const list = brainClassifiers({
      anthropic: fakeAnthropic("{}"),
      groq: fakeGroq(['```json\n{"intent":"quote","confidence":0.8}\n```']),
    });
    expect(list.map((c) => [c.provider, c.paid])).toEqual([
      ["anthropic", true],
      ["groq", false],
    ]);
    const r = await list[1]?.classify("price?", ["quote"]);
    expect(r).toMatchObject({ intent: "quote", provider: "groq", costMicros: 0 });
  });

  it("move to the next Groq model after a rate limit", async () => {
    const limited = Object.assign(new Error("rate"), { status: 429, headers: { get: () => "30" } });
    const [groq] = brainClassifiers({
      groq: fakeGroq([limited, '{"intent":"booking","confidence":0.7}']),
    });
    const r = await groq?.classify("book", ["booking"]);
    expect(r?.intent).toBe("booking");
    expect(r?.model).not.toBe("openai/gpt-oss-120b");
  });
});

describe("answerAsAgent", () => {
  it("returns the reply with answered/topic/lead flags", async () => {
    const a = await answerAsAgent(
      {
        anthropic: fakeAnthropic(
          '{"reply":"Yes, free parking behind the building.","answered":true,"topic":"Parking","lead":false}',
        ),
      },
      knowledge,
      [{ role: "customer", text: "Is there parking?" }],
      { allowPaid: true },
    );
    expect(a).toMatchObject({
      reply: "Yes, free parking behind the building.",
      answered: true,
      topic: "parking",
      lead: false,
    });
  });

  it("skips the paid model when not allowed and uses the free one", async () => {
    const a = await answerAsAgent(
      {
        anthropic: fakeAnthropic(new Error("should not be called")),
        groq: fakeGroq(['{"reply":"We open at 9.","answered":true}']),
      },
      knowledge,
      [{ role: "customer", text: "When do you open?" }],
      { allowPaid: false },
    );
    expect(a).toMatchObject({ provider: "groq", reply: "We open at 9." });
  });

  it("returns null when no model answers", async () => {
    expect(
      await answerAsAgent({}, knowledge, [{ role: "customer", text: "hi" }], { allowPaid: true }),
    ).toBeNull();
  });
});

describe("firstJson", () => {
  it("finds JSON inside text and ignores junk", () => {
    expect(firstJson('Sure! {"a": 1} done')).toEqual({ a: 1 });
    expect(firstJson("no json")).toBeNull();
    expect(firstJson("{broken")).toBeNull();
  });
});

describe("answerAsAgent with Studio instructions", () => {
  it("uses the instructions and returns only the requested details", async () => {
    let system = "";
    const anthropic = {
      messages: {
        create: async (req: { system: string }) => {
          system = req.system;
          return {
            content: [
              {
                type: "text",
                text: '{"reply":"Thursday at 10:00, Ana. Shall I send that to the team?","answered":true,"fields":{"name":"Ana Example","date":"2026-10-22","password":"x"},"confirmed":false}',
              },
            ],
            usage: { input_tokens: 300, output_tokens: 30 },
          };
        },
      },
    } as unknown as NonNullable<ModelClients["anthropic"]>;
    const a = await answerAsAgent(
      { anthropic },
      { ...knowledge, instructions: "SAFETY: rules first", collect: ["name", "date", "time"] },
      [{ role: "customer", text: "Ana Example, Thursday please" }],
      { allowPaid: true },
    );
    expect(system).toContain("SAFETY: rules first");
    expect(system).not.toContain("Open Mon-Fri 9-17"); // free-text facts replaced by instructions
    expect(a?.fields).toEqual({ name: "Ana Example", date: "2026-10-22" });
    expect(a?.confirmed).toBe(false);
  });
});

describe("judgeReply", () => {
  it("uses only the free model and returns pass/fail with a reason", async () => {
    const r = await judgeReply(
      {
        anthropic: fakeAnthropic(new Error("must not be called")),
        groq: fakeGroq(['{"pass": false, "reason": "It promised a booking."}']),
      },
      "Never says it is booked",
      [
        { role: "customer", text: "Book me" },
        { role: "agent", text: "You're booked!" },
      ],
    );
    expect(r).toEqual({ pass: false, reason: "It promised a booking." });
  });

  it("returns null when no model is available", async () => {
    expect(await judgeReply({ anthropic: fakeAnthropic('{"pass":true}') }, "x", [])).toBeNull();
  });
});

describe("draftProfileFromPages", () => {
  it("returns the model's JSON draft using the free model only", async () => {
    const draft = await draftProfileFromPages(
      {
        anthropic: fakeAnthropic(new Error("must not be called")),
        groq: fakeGroq([
          '{"summary":"Family dentist.","services":[{"name":"Check-up","price":"65 EUR"}]}',
        ]),
      },
      [{ url: "https://brightsmile.example", text: "Family dentist. Check-up 65 EUR." }],
    );
    expect(draft).toEqual({
      summary: "Family dentist.",
      services: [{ name: "Check-up", price: "65 EUR" }],
    });
  });
});

describe("documents", () => {
  const input = {
    question: "How many holiday days?",
    history: [],
    passages: [
      { n: 1, source: "Handbook", heading: "Holidays", text: "Staff get 25 days a year." },
      { n: 2, source: "Handbook", heading: "Expenses", text: "Submit receipts in 30 days." },
    ],
    rules: ["Never share salaries."],
    tone: "friendly",
  };

  it("collects citations from the list and the text, on the free model", async () => {
    const a = await answerFromDocuments(
      {
        anthropic: fakeAnthropic(new Error("should not be called")),
        groq: fakeGroq(['{"reply":"You get 25 days [1].","cited":[],"answered":true}']),
      },
      input,
      { allowPaid: false },
    );
    expect(a).toMatchObject({ reply: "You get 25 days [1].", cited: [1], answered: true });
  });

  it("passes on 'not found' and returns null with no model", async () => {
    const a = await answerFromDocuments(
      {
        groq: fakeGroq(['{"reply":"Not in your documents.","cited":[],"answered":false}']),
      },
      input,
      { allowPaid: false },
    );
    expect(a?.answered).toBe(false);
    expect(await answerFromDocuments({}, input, { allowPaid: true })).toBeNull();
  });

  it("widens search words, ignoring junk", async () => {
    const w = await expandQuestion(
      { groq: fakeGroq(['{"words":["holiday","leave",3,"vacation"]}']) },
      "time off?",
    );
    expect(w?.words).toEqual(["holiday", "leave", "vacation"]);
    expect(await expandQuestion({}, "time off?")).toBeNull();
  });
});

describe("planLookup", () => {
  const lookups = [
    {
      n: 1,
      name: "Order status",
      description: "Where an order is",
      params: [{ name: "order_no", label: "Order number", type: "text" }],
    },
  ];

  it("chooses a lookup only with every value, and ignores unknown ones", async () => {
    const yes = await planLookup(
      {
        groq: fakeGroq([
          '{"words":["order"],"lookup":1,"params":{"order_no":"A-1001","evil":"x"}}',
        ]),
      },
      "Where is order A-1001?",
      lookups,
    );
    expect(yes?.lookup).toEqual({ n: 1, params: { order_no: "A-1001" } });
    const missing = await planLookup(
      { groq: fakeGroq(['{"words":["order"],"lookup":1,"params":{}}']) },
      "Where is my order?",
      lookups,
    );
    expect(missing?.lookup).toBeNull();
    const unknown = await planLookup(
      { groq: fakeGroq(['{"words":[],"lookup":7,"params":{"order_no":"A"}}']) },
      "x",
      lookups,
    );
    expect(unknown?.lookup).toBeNull();
  });
});
