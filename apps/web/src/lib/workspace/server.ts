import { NextRequest, NextResponse } from "next/server";
import { fetchWithDiagnostics } from "../api-diagnostics";
import { z } from "zod";
import {
  addFarmMemberSchema,
  farmMemberSchema,
  farmOnboardingSchema,
  farmOnboardingStatusSchema,
  submitRoleRequestSchema,
  roleRequestSchema,
  roleDecisionSchema,
  privilegedRoleSchema,
  authUserSchema,
  ProfessionalRole,
} from "@vetralink/shared-types";
import {
  adminTargetSchema,
  adminUserListSchema,
  adminUserQuerySchema,
  decisionResponseSchema,
  emptyQuerySchema,
  listQuerySchema,
  memberListSchema,
  questionnaireSchema,
  requestListSchema,
  reviewDetailSchema,
  reviewQueueSchema,
} from "./contracts";
import {
  animalQuerySchema,
  animalListSchema,
  milkQuerySchema,
  milkAnalyticsSchema,
  vaccinationQuerySchema,
  vaccinationScheduleSchema,
  financeQuerySchema,
  financeSummarySchema,
  accessStatusSchema,
  quotaSchema,
  registerAnimalSchema,
  updateAnimalSchema,
  animalSchema,
} from "./farm-contracts";
type Endpoint = {
  method: string;
  upstream: string;
  response: z.ZodTypeAny;
  body?: z.ZodTypeAny;
  query?: z.ZodTypeAny;
  farmId?: string;
  membershipRequired?: boolean;
  entityId?: string;
  writeAccessRequired?: boolean;
};
const uuid = z.string().uuid();
export function resolveEndpoint(
  path: string[],
  method: string,
): Endpoint | null {
  const key = path.join("/");
  if (
    path[0] === "farms" &&
    uuid.safeParse(path[1]).success &&
    path[2] === "animals"
  ) {
    if (path.length === 3 && method === "POST")
      return {
        method,
        farmId: path[1],
        upstream: "animals",
        response: animalSchema,
        body: registerAnimalSchema,
        membershipRequired: true,
        writeAccessRequired: true,
      };
    if (
      path.length === 4 &&
      uuid.safeParse(path[3]).success &&
      ["GET", "PATCH"].includes(method)
    )
      return {
        method,
        farmId: path[1],
        entityId: path[3],
        upstream: `animals/${path[3]}`,
        response: animalSchema,
        ...(method === "PATCH"
          ? {
              body: updateAnimalSchema,
              membershipRequired: true,
              writeAccessRequired: true,
            }
          : {}),
      };
  }
  if (
    path[0] === "farms" &&
    uuid.safeParse(path[1]).success &&
    method === "GET"
  ) {
    const suffix = path.slice(2).join("/"),
      farmId = path[1]!;
    const reads: Record<string, Omit<Endpoint, "method" | "farmId">> = {
      animals: {
        upstream: "animals",
        response: animalListSchema,
        query: animalQuerySchema,
      },
      "milk/analytics": {
        upstream: "milk-logs/analytics",
        response: milkAnalyticsSchema,
        query: milkQuerySchema,
      },
      "vaccinations/schedule": {
        upstream: "clinical-health/vaccinations/schedule",
        response: vaccinationScheduleSchema,
        query: vaccinationQuerySchema,
      },
      "finance/summary": {
        upstream: "financial/profit-loss/summary",
        response: financeSummarySchema,
        query: financeQuerySchema,
      },
      "access-status": {
        upstream: `subscriptions/farm/${farmId}/access-status`,
        response: accessStatusSchema,
        membershipRequired: true,
      },
      quota: {
        upstream: `subscriptions/farm/${farmId}/quota`,
        response: quotaSchema,
        membershipRequired: true,
      },
    };
    if (Object.prototype.hasOwnProperty.call(reads, suffix))
      return { method, farmId, ...reads[suffix] };
  }
  if (
    path.length === 2 &&
    path[0] === "questionnaires" &&
    z.nativeEnum(ProfessionalRole).safeParse(path[1]).success &&
    method === "GET"
  )
    return {
      method,
      upstream: `role-requests/questionnaires/${path[1]}`,
      response: questionnaireSchema,
    };
  if (key === "me/role-requests" && method === "GET")
    return {
      method,
      upstream: "users/me/role-requests",
      response: requestListSchema,
      query: listQuerySchema,
    };
  if (key === "me/role-requests" && method === "POST")
    return {
      method,
      upstream: "users/me/role-requests",
      response: roleRequestSchema,
      body: submitRoleRequestSchema,
    };
  if (
    path.length === 3 &&
    path[0] === "me" &&
    path[1] === "role-requests" &&
    uuid.safeParse(path[2]).success &&
    method === "GET"
  )
    return {
      method,
      upstream: `users/me/role-requests/${path[2]}`,
      response: roleRequestSchema,
    };
  if (key === "farm/onboarding" && ["GET", "POST"].includes(method))
    return {
      method,
      upstream: "farms/onboarding",
      response: farmOnboardingStatusSchema,
      ...(method === "POST" ? { body: farmOnboardingSchema } : {}),
    };
  if (key === "farms" && method === "GET")
    return {
      method,
      upstream: "farms/my",
      response: farmOnboardingStatusSchema,
    };
  if (
    path.length === 3 &&
    path[0] === "farms" &&
    uuid.safeParse(path[1]).success &&
    path[2] === "members" &&
    ["GET", "POST"].includes(method)
  )
    return {
      method,
      upstream: `farms/${path[1]}/members`,
      response: method === "GET" ? memberListSchema : farmMemberSchema,
      farmId: path[1],
      ...(method === "POST"
        ? {
            body: addFarmMemberSchema,
            membershipRequired: true,
            writeAccessRequired: true,
          }
        : {}),
    };
  if (key === "admin/role-requests" && method === "GET")
    return {
      method,
      upstream: "admin/role-requests",
      response: reviewQueueSchema,
      query: listQuerySchema,
    };
  if (
    path[0] === "admin" &&
    path[1] === "role-requests" &&
    uuid.safeParse(path[2]).success
  ) {
    if (path.length === 3 && method === "GET")
      return {
        method,
        upstream: `admin/role-requests/${path[2]}`,
        response: reviewDetailSchema,
      };
    if (path.length === 4 && path[3] === "decision" && method === "POST")
      return {
        method,
        upstream: `admin/role-requests/${path[2]}/decision`,
        response: decisionResponseSchema,
        body: roleDecisionSchema,
      };
  }
  if (key === "admin/users" && method === "GET")
    return {
      method,
      upstream: "admin/users/administrative-access",
      response: adminUserListSchema,
      query: adminUserQuerySchema,
    };
  if (key === "admin/users/lookup" && method === "GET")
    return {
      method,
      upstream: "admin/users/role-access",
      response: adminTargetSchema,
      query: z
        .object({ email: z.string().trim().toLowerCase().email().max(254) })
        .strict(),
    };
  if (
    path.length === 3 &&
    path[0] === "admin" &&
    path[1] === "users" &&
    uuid.safeParse(path[2]).success &&
    ["GET", "PATCH"].includes(method)
  )
    return {
      method,
      upstream: `admin/users/${path[2]}/${method === "GET" ? "role-access" : "privileged-role"}`,
      response: method === "GET" ? adminTargetSchema : authUserSchema,
      ...(method === "PATCH" ? { body: privilegedRoleSchema } : {}),
    };
  return null;
}
const errorCodes = new Set([
  "ROLE_REQUEST_PENDING",
  "SUBMISSION_KEY_CONFLICT",
  "ROLE_REQUEST_ALREADY_DECIDED",
  "APPLICANT_INELIGIBLE",
  "VET_VERIFICATION_REQUIRED",
  "ROLE_VERSION_CONFLICT",
  "TARGET_INELIGIBLE",
  "INVALID_ROLE_TRANSITION",
  "LAST_SUPER_ADMIN",
  "SELF_ROLE_CHANGE",
  "FARM_ONBOARDING_REQUIRED",
  "ONBOARDING_ALREADY_COMPLETE",
  "RATE_LIMITED",
  "RATE_LIMIT_UNAVAILABLE",
  "AUTHORIZATION_CHANGED",
  "QUOTA_EXCEEDED",
  "PASSWORD_CONFIRMATION_FAILED",
]);
function reply(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
  });
}
export async function handleWorkspace(
  request: NextRequest,
  path: string[],
): Promise<NextResponse> {
  const endpoint = resolveEndpoint(path, request.method);
  if (!endpoint) return reply({ code: "NOT_FOUND" }, 404);
  if (
    request.headers.get("sec-fetch-site") === "cross-site" ||
    (request.method !== "GET" &&
      (request.headers.get("origin") !== request.nextUrl.origin ||
        request.headers.get("content-type")?.split(";")[0].trim() !==
          "application/json"))
  )
    return reply({ code: "FORBIDDEN" }, 403);
  const access = request.cookies.get("vetralink_access")?.value;
  if (!access) return reply({ code: "UNAUTHORIZED" }, 401);
  for (const key of Array.from(request.nextUrl.searchParams.keys()))
    if (request.nextUrl.searchParams.getAll(key).length > 1)
      return reply({ code: "VALIDATION_FAILED" }, 422);
  const query = (endpoint.query ?? emptyQuerySchema).safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  if (!query.success) return reply({ code: "VALIDATION_FAILED" }, 422);
  let body: unknown;
  if (endpoint.body) {
    if (Number(request.headers.get("content-length")) > 32768)
      return reply({ code: "VALIDATION_FAILED" }, 413);
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 32768)
      return reply({ code: "VALIDATION_FAILED" }, 413);
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return reply({ code: "VALIDATION_FAILED" }, 422);
    }
    const result = endpoint.body.safeParse(parsed);
    if (!result.success)
      return reply(
        {
          code: "VALIDATION_FAILED",
          fields: result.error.issues.map((i) => i.path.join(".")),
        },
        422,
      );
    body = result.data;
  }
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 12000);
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
      return reply({ code: "UNAVAILABLE" }, 503);
    const url = new URL(endpoint.upstream, base);
    if (endpoint.membershipRequired) {
      const discovery = await fetchWithDiagnostics(new URL("farms/my", base), {
        signal: controller.signal,
        cache: "no-store",
        redirect: "error",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${access}`,
        },
      });
      if (!discovery.ok)
        return reply(
          {
            code:
              discovery.status === 401
                ? "UNAUTHORIZED"
                : discovery.status === 403
                  ? "FORBIDDEN"
                  : "UNAVAILABLE",
          },
          [401, 403].includes(discovery.status) ? discovery.status : 503,
        );
      const envelope = await discovery.json();
      const membership = farmOnboardingStatusSchema.safeParse(
        envelope?.success === true ? envelope.data : undefined,
      );
      if (!membership.success) return reply({ code: "INVALID_RESPONSE" }, 502);
      if (!membership.data.farms.some((farm) => farm.id === endpoint.farmId))
        return reply({ code: "FORBIDDEN" }, 403);
    }
    if (endpoint.writeAccessRequired) {
      const accessResponse = await fetchWithDiagnostics(
        new URL(`subscriptions/farm/${endpoint.farmId}/access-status`, base),
        {
          signal: controller.signal,
          cache: "no-store",
          redirect: "error",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${access}`,
          },
        },
      );
      if (!accessResponse.ok)
        return reply(
          {
            code:
              accessResponse.status === 401
                ? "UNAUTHORIZED"
                : accessResponse.status === 403
                  ? "FORBIDDEN"
                  : "UNAVAILABLE",
          },
          [401, 403].includes(accessResponse.status)
            ? accessResponse.status
            : 503,
        );
      const payload = await accessResponse.json();
      const status = accessStatusSchema.safeParse(
        payload?.success === true ? payload.data : undefined,
      );
      if (!status.success || status.data.farmId !== endpoint.farmId)
        return reply({ code: "INVALID_RESPONSE" }, 502);
      if (
        !status.data.canWrite ||
        !status.data.canRead ||
        !["FULL_ACCESS", "GRACE_PERIOD"].includes(status.data.accessMode)
      )
        return reply({ code: "FORBIDDEN" }, 403);
    }
    for (const [key, value] of Object.entries(query.data))
      if (value !== undefined) url.searchParams.set(key, String(value));
    const response = await fetchWithDiagnostics(url, {
      method: endpoint.method,
      signal: controller.signal,
      cache: "no-store",
      redirect: "error",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${access}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(endpoint.farmId ? { "x-farm-id": endpoint.farmId } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const envelope: unknown = await response.json().catch(() => null);
    const record =
      envelope && typeof envelope === "object"
        ? (envelope as Record<string, unknown>)
        : null;
    if (!response.ok) {
      const problem = z
        .object({ errorDetails: z.object({ title: z.string() }) })
        .safeParse(envelope);
      const rawCode = problem.success
        ? problem.data.errorDetails.title
        : String(record?.title ?? record?.errorCode ?? "");
      const code = errorCodes.has(rawCode)
        ? rawCode
        : response.status === 401
          ? "UNAUTHORIZED"
          : response.status === 403
            ? "FORBIDDEN"
            : response.status === 404
              ? "NOT_FOUND"
              : response.status === 409
                ? "CONFLICT"
                : response.status === 429
                  ? "RATE_LIMITED"
                  : [400, 422].includes(response.status)
                    ? "VALIDATION_FAILED"
                    : "UNAVAILABLE";
      return reply({ code }, response.status >= 500 ? 503 : response.status);
    }
    const parsed = endpoint.response.safeParse(
      record?.success === true ? record.data : undefined,
    );
    if (!parsed.success) return reply({ code: "INVALID_RESPONSE" }, 502);
    if (endpoint.entityId && parsed.data.id !== endpoint.entityId)
      return reply({ code: "INVALID_RESPONSE" }, 502);
    if (endpoint.farmId) {
      const data = parsed.data as Record<string, unknown>;
      const items = (data.items ?? data.upcomingEvents ?? []) as Record<
        string,
        unknown
      >[];
      if (
        ("farmId" in data && data.farmId !== endpoint.farmId) ||
        items.some(
          (item) => "farmId" in item && item.farmId !== endpoint.farmId,
        )
      )
        return reply({ code: "INVALID_RESPONSE" }, 502);
      for (const field of ["startDate", "endDate"])
        if (
          field in data &&
          field in query.data &&
          data[field] !== query.data[field]
        )
          return reply({ code: "INVALID_RESPONSE" }, 502);
    }
    return reply({ data: parsed.data }, response.status === 201 ? 201 : 200);
  } catch {
    return reply(
      { code: controller.signal.aborted ? "TIMEOUT" : "UNAVAILABLE" },
      503,
    );
  } finally {
    clearTimeout(timer);
  }
}
