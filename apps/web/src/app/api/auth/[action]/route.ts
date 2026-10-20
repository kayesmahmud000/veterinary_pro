import { NextRequest } from "next/server";
import { handleAuth } from "@/lib/auth/server";
import { withResponseDiagnostics } from "@/lib/api-diagnostics";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest, props: { params: Promise<{ action: string }> }) {
  const params = await props.params;
  return withResponseDiagnostics(request, () =>
    handleAuth(request, params.action),
  );
}

export async function POST(request: NextRequest, props: { params: Promise<{ action: string }> }) {
  const params = await props.params;
  return withResponseDiagnostics(request, () =>
    handleAuth(request, params.action),
  );
}
