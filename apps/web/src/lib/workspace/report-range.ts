import {
  platformReportQuerySchema,
  type PlatformReportQuery,
} from "@vetralink/shared-types";

export type ReportRangeField = "from" | "to" | "timezone";
export type ReportRangeIssue =
  "required" | "calendar" | "timezone" | "order" | "length" | "future";
export type ReportRangeIssues = Partial<
  Record<ReportRangeField, ReportRangeIssue>
>;

export function validateReportRange(
  draft: { from: string; to: string; timezone: string },
  now = new Date(),
):
  | { success: true; data: PlatformReportQuery }
  | { success: false; issues: ReportRangeIssues } {
  const result = platformReportQuerySchema.safeParse(draft);
  if (!result.success) {
    const issues: ReportRangeIssues = {};
    // Reuse the shared field rules so invalid calendars take precedence over
    // relation errors and changes to the contract are checked by TypeScript.
    const fields = platformReportQuerySchema.innerType().shape;
    for (const key of ["from", "to", "timezone"] as const) {
      if (!fields[key].safeParse(draft[key]).success) {
        issues[key] =
          key === "timezone"
            ? "timezone"
            : !draft[key]
              ? "required"
              : "calendar";
      }
    }
    if (!Object.keys(issues).length) {
      const days = (Date.parse(draft.to) - Date.parse(draft.from)) / 86400000;
      issues.to = days <= 0 ? "order" : days > 366 ? "length" : "calendar";
    }
    return { success: false, issues };
  }
  // Match the API's future-end rule in the selected reporting timezone.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: result.data.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const today = ["year", "month", "day"]
    .map((k) => parts.find((p) => p.type === k)!.value)
    .join("-");
  const tomorrow = new Date(Date.parse(today + "T00:00:00Z") + 86400000)
    .toISOString()
    .slice(0, 10);
  if (result.data.to > tomorrow)
    return { success: false, issues: { to: "future" } };
  return { success: true, data: result.data };
}
