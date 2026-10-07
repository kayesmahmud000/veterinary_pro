import { NextRequest } from "next/server";
import { handleAuth } from "@/lib/auth/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(
  request: NextRequest,
  { params }: { params: { action: string } },
) {
  return handleAuth(request, params.action);
}

export function POST(
  request: NextRequest,
  { params }: { params: { action: string } },
) {
  return handleAuth(request, params.action);
}
