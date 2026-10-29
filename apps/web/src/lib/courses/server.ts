import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  courseQuerySchema,
  decodeCourseSlugSegment,
  courseListSchema,
  courseSchema,
  coursePlaybackSchema,
} from "@vetralink/shared-types";
import { fetchWithDiagnostics } from "../api-diagnostics";
const uuid = z.string().uuid();
export function resolvePublicCourse(path: string[]): {
  upstream: string;
  schema: z.ZodTypeAny;
  query?: z.ZodTypeAny;
  productId?: string;
  lessonId?: string;
  slug?: string;
} | null {
  if (!path.length)
    return {
      upstream: "courses",
      schema: courseListSchema,
      query: courseQuerySchema,
    };
  const requestedSlug =
    path.length === 2 && path[0] === "slug"
      ? decodeCourseSlugSegment(path[1])
      : null;
  if (requestedSlug !== null)
    return {
      upstream: `courses/slug/${encodeURIComponent(requestedSlug)}`,
      schema: courseSchema,
      slug: requestedSlug,
    };
  if (
    path.length === 4 &&
    uuid.safeParse(path[0]).success &&
    path[1] === "lessons" &&
    uuid.safeParse(path[2]).success &&
    path[3] === "demo-playback"
  )
    return {
      upstream: `courses/${path.join("/")}`,
      schema: coursePlaybackSchema,
      productId: path[0],
      lessonId: path[2],
    };
  return null;
}
const reply = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
export async function handleCourses(request: NextRequest, path: string[] = []) {
  const endpoint = resolvePublicCourse(path);
  if (!endpoint || request.method !== "GET")
    return reply({ code: "NOT_FOUND" }, 404);
  if (
    Array.from(request.nextUrl.searchParams.keys()).some(
      (key) => request.nextUrl.searchParams.getAll(key).length > 1,
    )
  )
    return reply({ code: "VALIDATION_FAILED" }, 422);
  const query = (endpoint.query ?? z.object({}).strict()).safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  if (!query.success) return reply({ code: "VALIDATION_FAILED" }, 422);
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 12000);
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
    const url = new URL(endpoint.upstream, base);
    Object.entries(query.data).forEach(([key, value]) => {
      if (value !== undefined) url.searchParams.set(key, String(value));
    });
    const response = await fetchWithDiagnostics(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok)
      return reply(
        { code: response.status === 404 ? "NOT_FOUND" : "UNAVAILABLE" },
        response.status === 404 ? 404 : 503,
      );
    const envelope = await response.json(),
      parsed = endpoint.schema.safeParse(
        envelope?.success === true ? envelope.data : undefined,
      );
    if (
      !parsed.success ||
      (endpoint.slug && parsed.data.slug !== endpoint.slug) ||
      (endpoint.productId && parsed.data.productId !== endpoint.productId) ||
      (endpoint.lessonId && parsed.data.lessonId !== endpoint.lessonId)
    )
      return reply({ code: "INVALID_RESPONSE" }, 502);
    return reply({ data: parsed.data });
  } catch {
    return reply({ code: "UNAVAILABLE" }, 503);
  } finally {
    clearTimeout(timer);
  }
}
