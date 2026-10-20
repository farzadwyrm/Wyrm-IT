/** Body of POST /api/ask. */
export interface AskRequest {
  question: string;
  /** The guide area page the visitor is on, if any. */
  areaSlug?: string;
  history?: { role: "visitor" | "assistant"; text: string }[];
}

export type AskResponse =
  | {
      /** "fallback" means the AI was unavailable and the answer comes from the guide alone. */
      status: "ok" | "fallback";
      text: string;
      provider: "instant" | "claude" | "groq" | "guide";
      source: { title: string; href: string } | null;
    }
  | { status: "error" };
