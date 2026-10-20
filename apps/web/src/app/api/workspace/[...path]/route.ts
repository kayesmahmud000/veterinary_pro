import { NextRequest } from "next/server";
import { handleWorkspace } from "@/lib/workspace/server";
import { withResponseDiagnostics } from "@/lib/api-diagnostics";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
async function handle(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return withResponseDiagnostics(request, () =>
    handleWorkspace(request, path),
  );
}
export { handle as GET, handle as POST, handle as PUT, handle as PATCH };
