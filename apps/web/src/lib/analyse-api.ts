import type { StepDraft } from "@wyrm/agents";

/** Body of POST /api/analyse/steps. */
export interface StepsRequest {
  walkthrough: string;
  outcome: string;
  trigger: string;
}

export type StepsResponse =
  | { status: "ok"; steps: StepDraft[]; provider: "claude" | "groq" | "text" }
  | { status: "error" };
