import { NextRequest, NextResponse } from "next/server";
import {
  authUserSchema,
  UserRole,
  UserStatus,
  courseThumbnailFileError,
  courseThumbnailUploadResultSchema,
  COURSE_THUMBNAIL_MAX_REQUEST_BYTES,
} from "@vetralink/shared-types";
import { fetchWithDiagnostics } from "../api-diagnostics";
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
  });
const safeCodes = new Set([
  "THUMBNAIL_EMPTY",
  "THUMBNAIL_TOO_LARGE",
  "THUMBNAIL_UNSUPPORTED",
  "THUMBNAIL_INVALID",
  "THUMBNAIL_UNAVAILABLE",
  "RATE_LIMITED",
  "RATE_LIMIT_UNAVAILABLE",
  "AUTHORIZATION_CHANGED",
]);
async function readBody(request: NextRequest, signal: AbortSignal) {
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader(),
    chunks: Uint8Array[] = [];
  let length = 0;
  const cancel = () => {
    void reader.cancel().catch(() => {});
  };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    for (;;) {
      if (signal.aborted) throw new Error("TIMEOUT");
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.byteLength;
      if (length > COURSE_THUMBNAIL_MAX_REQUEST_BYTES) {
        await reader.cancel();
        throw new Error("THUMBNAIL_TOO_LARGE");
      }
      chunks.push(chunk.value);
    }
    if (signal.aborted) throw new Error("TIMEOUT");
    return Buffer.concat(chunks, length);
  } finally {
    signal.removeEventListener("abort", cancel);
    reader.releaseLock();
  }
}
export async function handleThumbnailUpload(
  request: NextRequest,
): Promise<NextResponse> {
  if (request.method !== "POST") return reply({ code: "NOT_FOUND" }, 404);
  if (
    request.headers.get("origin") !== request.nextUrl.origin ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    return reply({ code: "FORBIDDEN" }, 403);
  const access = request.cookies.get("vetralink_access")?.value;
  if (!access || access.length > 3800)
    return reply({ code: "UNAUTHORIZED" }, 401);
  const expected = request.headers.get("X-Workspace-Actor");
  if (!expected) return reply({ code: "AUTHORIZATION_CHANGED" }, 403);
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^multipart\/form-data\s*;\s*boundary=/i.test(contentType))
    return reply({ code: "THUMBNAIL_UNSUPPORTED" }, 415);
  if (request.nextUrl.search) return reply({ code: "VALIDATION_FAILED" }, 422);
  if (
    Number(request.headers.get("content-length")) >
    COURSE_THUMBNAIL_MAX_REQUEST_BYTES
  )
    return reply({ code: "THUMBNAIL_TOO_LARGE" }, 413);
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 35_000);
  const abort = () => controller.abort();
  request.signal.addEventListener("abort", abort, { once: true });
  try {
    const base = new URL(
      `${(process.env.API_BASE_URL || "https://veterinary-api-mocha.vercel.app/api/v1").replace(/\/$/, "")}/`,
    );
    if (
      !["http:", "https:"].includes(base.protocol) ||
      base.username ||
      base.password ||
      base.search ||
      base.hash
    )
      return reply({ code: "UNAVAILABLE" }, 503);
    const init = {
      signal: controller.signal,
      cache: "no-store" as const,
      redirect: "error" as const,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${access}`,
      },
    };
    const identityResponse = await fetchWithDiagnostics(
      new URL("auth/me", base),
      init,
    );
    if (!identityResponse.ok)
      return reply(
        {
          code:
            identityResponse.status === 401
              ? "UNAUTHORIZED"
              : identityResponse.status === 403
                ? "FORBIDDEN"
                : "UNAVAILABLE",
        },
        [401, 403].includes(identityResponse.status)
          ? identityResponse.status
          : 503,
      );
    const envelope = await identityResponse.json(),
      identity = authUserSchema.safeParse(
        envelope?.success === true ? envelope.data : undefined,
      );
    if (!identity.success) return reply({ code: "INVALID_RESPONSE" }, 502);
    const user = identity.data;
    if (
      user.status !== UserStatus.ACTIVE ||
      ![UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(user.role)
    )
      return reply({ code: "FORBIDDEN" }, 403);
    if (expected !== `${user.id}:${user.role}:${user.roleVersion ?? 0}`)
      return reply({ code: "AUTHORIZATION_CHANGED" }, 403);
    const raw = await readBody(request, controller.signal);
    let form: FormData;
    try {
      form = await new Response(raw, {
        headers: { "Content-Type": contentType },
      }).formData();
    } catch {
      return reply({ code: "VALIDATION_FAILED" }, 422);
    }
    const entries = Array.from(form.entries());
    if (
      entries.length !== 1 ||
      entries[0][0] !== "file" ||
      typeof entries[0][1] === "string"
    )
      return reply({ code: "VALIDATION_FAILED" }, 422);
    const file = entries[0][1],
      error = courseThumbnailFileError(file);
    if (error)
      return reply(
        { code: error },
        error === "THUMBNAIL_TOO_LARGE"
          ? 413
          : error === "THUMBNAIL_UNSUPPORTED"
            ? 415
            : 422,
      );
    const body = new FormData();
    body.append("file", file, file.name);
    const response = await fetchWithDiagnostics(
      new URL("admin/courses/thumbnails", base),
      { ...init, method: "POST", body },
    );
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      const code = result?.errorDetails?.title;
      const status = [401, 403, 413, 415, 422, 429].includes(response.status)
        ? response.status
        : 503;
      return reply(
        {
          code: safeCodes.has(code)
            ? code
            : status === 401
              ? "UNAUTHORIZED"
              : status === 403
                ? "FORBIDDEN"
                : status === 429
                  ? "RATE_LIMITED"
                  : "THUMBNAIL_UNAVAILABLE",
        },
        status,
      );
    }
    const parsed = courseThumbnailUploadResultSchema.safeParse(
      result?.success === true ? result.data : undefined,
    );
    return parsed.success
      ? reply({ data: parsed.data }, 201)
      : reply({ code: "INVALID_RESPONSE" }, 502);
  } catch (error) {
    return reply(
      {
        code:
          error instanceof Error && error.message === "THUMBNAIL_TOO_LARGE"
            ? "THUMBNAIL_TOO_LARGE"
            : controller.signal.aborted
              ? "TIMEOUT"
              : "UNAVAILABLE",
      },
      error instanceof Error && error.message === "THUMBNAIL_TOO_LARGE"
        ? 413
        : 503,
    );
  } finally {
    clearTimeout(timer);
    request.signal.removeEventListener("abort", abort);
  }
}
