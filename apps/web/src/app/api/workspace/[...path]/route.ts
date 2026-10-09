import { NextRequest } from "next/server";
import { handleWorkspace } from "@/lib/workspace/server";
import { withResponseDiagnostics } from "@/lib/api-diagnostics";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
function handle(request: NextRequest, context: { params: { path: string[] } }) {
  return withResponseDiagnostics(request, () =>
    handleWorkspace(request, context.params.path),
  );
}
export { handle as GET, handle as POST, handle as PATCH };
