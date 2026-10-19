/**
 * Shape returned by POST /api/scan/report, shared by the route and the scan page.
 * `source` says who wrote the text: Claude ("ai") or the free rule-based summary ("basic").
 */
export type ReportResponse =
  | { status: "ok"; text: string; source: "ai" | "basic" }
  | { status: "unavailable"; reason: "too_few_answers" | "invalid_request" };
