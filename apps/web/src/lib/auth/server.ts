import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import type { AuthTokensDto } from "@vetralink/shared-types";
import {
  readUser,
  validateCredentials,
  type AuthErrorCode,
  type AuthResult,
} from "./contracts";

const ACCESS_COOKIE = "vetralink_access";
const REFRESH_COOKIE = "vetralink_refresh";
const ACTIONS = ["login", "register", "session", "refresh", "logout"];

class AuthFailure extends Error {
  constructor(
    public code: AuthErrorCode,
    public status: number,
  ) {
    super(code);
  }
}

function reply(body: AuthResult, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
  });
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
}

function setSession(response: NextResponse, tokens: AuthTokensDto) {
  response.cookies.set(ACCESS_COOKIE, tokens.accessToken, cookieOptions());
  response.cookies.set(REFRESH_COOKIE, tokens.refreshToken, cookieOptions());
}

function clearSession(response: NextResponse) {
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE]) {
    response.cookies.set(name, "", { ...cookieOptions(), maxAge: 0 });
  }
}

function readTokens(input: unknown): AuthTokensDto {
  const result = z
    .object({
      accessToken: z.string().min(1).max(3800),
      refreshToken: z.string().min(1).max(3800),
      tokenType: z.literal("Bearer"),
      expiresIn: z.number().positive().finite(),
    })
    .safeParse(input);
  if (!result.success) throw new AuthFailure("invalid_response", 502);
  return result.data;
}

async function upstream(
  action: string,
  body?: unknown,
  accessToken?: string,
): Promise<Record<string, unknown> | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const base = new URL(
      `${(process.env.API_BASE_URL || "http://localhost:3001/api/v1").replace(/\/$/, "")}/`,
    );
    if (
      !["http:", "https:"].includes(base.protocol) ||
      base.username ||
      base.password ||
      base.search ||
      base.hash
    )
      throw new AuthFailure("unavailable", 503);
    const response = await fetch(new URL(`auth/${action}`, base), {
      method: action === "me" ? "GET" : "POST",
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const envelope: unknown = await response.json().catch(() => null);
    const record =
      envelope && typeof envelope === "object"
        ? (envelope as Record<string, unknown>)
        : null;
    if (!response.ok || record?.success === false) {
      const status = response.status;
      const message =
        typeof record?.message === "string" ? record.message.toLowerCase() : "";
      if (status === 401)
        throw new AuthFailure(
          action === "login" ? "invalid_credentials" : "session_expired",
          401,
        );
      if (status === 403)
        throw new AuthFailure(
          action === "login" ? "suspended" : "forbidden",
          403,
        );
      if (status === 409)
        throw new AuthFailure(
          message.includes("phone")
            ? "conflict_phone"
            : message.includes("email")
              ? "conflict_email"
              : "conflict",
          409,
        );
      if (status === 429) throw new AuthFailure("rate_limited", 429);
      if (status === 400 || status === 422)
        throw new AuthFailure("validation", 400);
      throw new AuthFailure("unavailable", 503);
    }
    if (record?.success !== true || !("data" in record))
      throw new AuthFailure("invalid_response", 502);
    return record.data && typeof record.data === "object"
      ? (record.data as Record<string, unknown>)
      : null;
  } catch (error) {
    if (error instanceof AuthFailure) throw error;
    throw new AuthFailure(
      controller.signal.aborted ? "timeout" : "unavailable",
      503,
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function handleAuth(
  request: NextRequest,
  action: string,
): Promise<NextResponse> {
  if (!ACTIONS.includes(action)) return new NextResponse(null, { status: 404 });
  if ((action === "session" ? "GET" : "POST") !== request.method)
    return new NextResponse(null, { status: 405 });
  if (
    request.method === "POST" &&
    (request.headers.get("origin") !== request.nextUrl.origin ||
      request.headers.get("content-type")?.split(";")[0].trim() !==
        "application/json" ||
      request.headers.get("sec-fetch-site") === "cross-site")
  )
    return reply({ user: null, code: "forbidden" }, 403);

  try {
    if (action === "login" || action === "register") {
      if (Number(request.headers.get("content-length")) > 8192)
        return reply({ user: null, code: "validation" }, 413);
      const raw = await request.text();
      if (raw.length > 8192)
        return reply({ user: null, code: "validation" }, 413);
      let input: unknown;
      try {
        input = JSON.parse(raw);
      } catch {
        return reply({ user: null, code: "validation" }, 400);
      }
      const { payload, fields } = validateCredentials(action, input);
      if (!payload)
        return reply({ user: null, code: "validation", fields }, 400);
      const data = await upstream(action, payload);
      const user = readUser(data?.user);
      const tokens = readTokens(data?.tokens);
      if (!user) throw new AuthFailure("invalid_response", 502);
      const response = reply({ user }, action === "register" ? 201 : 200);
      setSession(response, tokens);
      return response;
    }

    const access = request.cookies.get(ACCESS_COOKIE)?.value;
    const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
    if (action === "session") {
      if (!access && !refresh) return reply({ user: null });
      if (!access) throw new AuthFailure("session_expired", 401);
      const user = readUser(await upstream("me", undefined, access));
      if (!user) throw new AuthFailure("invalid_response", 502);
      return reply({ user });
    }
    if (action === "logout") {
      if (refresh) await upstream("logout", { refreshToken: refresh });
      const response = reply({ user: null });
      clearSession(response);
      return response;
    }
    if (!refresh) throw new AuthFailure("session_expired", 401);
    const data = await upstream("refresh", { refreshToken: refresh });
    const tokens = readTokens(data?.tokens);
    // Save rotated tokens even if profile retrieval is temporarily unavailable: the old refresh is already revoked.
    try {
      const user = readUser(
        await upstream("me", undefined, tokens.accessToken),
      );
      if (!user) throw new AuthFailure("invalid_response", 502);
      const response = reply({ user });
      setSession(response, tokens);
      return response;
    } catch (error) {
      if (!(error instanceof AuthFailure)) throw error;
      const response = reply({ user: null, code: error.code }, error.status);
      if (error.status === 401) clearSession(response);
      else setSession(response, tokens);
      return response;
    }
  } catch (error) {
    const failure =
      error instanceof AuthFailure
        ? error
        : new AuthFailure("unavailable", 503);
    const response = reply({ user: null, code: failure.code }, failure.status);
    if (action === "refresh" && failure.status === 401) clearSession(response);
    return response;
  }
}
