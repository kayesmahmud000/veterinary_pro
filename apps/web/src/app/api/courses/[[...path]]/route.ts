import { NextRequest } from "next/server";
import { handleCourses } from "@/lib/courses/server";
import { withResponseDiagnostics } from "@/lib/api-diagnostics";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export function GET(
  request: NextRequest,
  context: { params: { path?: string[] } },
) {
  return withResponseDiagnostics(request, () =>
    handleCourses(request, context.params.path ?? []),
  );
}
