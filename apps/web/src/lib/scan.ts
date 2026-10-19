/** Shape returned by POST /api/scan/report, shared by the route and the scan page. */
export type ReportResponse =
  | { status: "ok"; text: string }
  | {
      status: "unavailable";
      reason:
        | "not_configured"
        | "refused"
        | "error"
        | "empty"
        | "too_few_answers"
        | "daily_budget_exhausted"
        | "visitor_rate_limited";
    };
