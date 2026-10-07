import { NextRequest } from "next/server";
import { handleWorkspace } from "@/lib/workspace/server";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
function handle(request: NextRequest, context: { params: { path: string[] } }) {
  return handleWorkspace(request, context.params.path);
}
export { handle as GET, handle as POST, handle as PATCH };
