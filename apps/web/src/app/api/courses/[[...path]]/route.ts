import { NextRequest } from "next/server";
import { handleCourses } from "@/lib/courses/server";
import { withResponseDiagnostics } from "@/lib/api-diagnostics";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  const { path = [] } = await context.params;
  return withResponseDiagnostics(request, () =>
    handleCourses(request, path),
  );
}
