import type { Workflow } from "@wyrm/agents";

/** Body of POST /api/plan. */
export interface PlanRequest {
  task: string;
}

export type PlanResponse =
  | {
      status: "ok";
      workflow: Workflow;
      /** "template": a standard agent's workflow; "guide": no AI was available. */
      provider: "template" | "claude" | "groq" | "guide";
      agent: { name: string; href: string } | null;
    }
  | { status: "off_topic" }
  /** No AI and no matching standard agent. */
  | { status: "unavailable" }
  | { status: "error" };
