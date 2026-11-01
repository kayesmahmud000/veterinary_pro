import { NextRequest } from "next/server";
import { handleThumbnailUpload } from "@/lib/workspace/thumbnail-upload-server";
import { withResponseDiagnostics } from "@/lib/api-diagnostics";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export function POST(request: NextRequest) {
  return withResponseDiagnostics(request, () => handleThumbnailUpload(request));
}
