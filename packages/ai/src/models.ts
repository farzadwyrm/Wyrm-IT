/**
 * Model choices live here so demos and client work switch models in one place.
 * Public demos use the cheapest capable model; client builds pick per use case.
 */
export const MODELS = {
  /** Fast and cheap: public website demos, classification, short replies. */
  demo: "claude-haiku-5-5",
  /** Higher quality: generated assessment reports, document Q&A. */
  quality: "claude-sonnet-5-5",
} as const;

export type ModelRole = keyof typeof MODELS;
