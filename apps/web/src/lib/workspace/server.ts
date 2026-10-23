import { NextRequest, NextResponse } from "next/server";
import { fetchWithDiagnostics } from "../api-diagnostics";
import { z } from "zod";
import {
  platformSettingsSchema, platformSettingsSaveSchema, platformIntegrationsSchema, platformSystemSchema,
  platformDiagnosticSchema, platformDiagnosticResultSchema, platformReportQuerySchema, platformReportSchema,
  platformReportExportSchema, platformReportExportResultSchema, platformAuditExportSchema, platformAuditExportResultSchema,
  editorialQuerySchema, editorialListSchema, editorialCreateSchema, editorialDetailSchema, editorialSaveSchema, editorialActionSchema,
  notificationQuerySchema, notificationListSchema, notificationRetrySchema, notificationRowSchema,
  supportQuerySchema, supportListSchema, supportDetailSchema, supportCreateSchema, supportReplySchema, supportActionSchema,
} from "@vetralink/shared-types";
import {
  adminSettlementQuerySchema,
  adminSettlementSummaryQuerySchema,
  adminSettlementListSchema,
  adminSettlementSummarySchema,
  adminSettlementDetailSchema,
  adminSettlementPreviewSchema,
  adminSettlementReconcileSchema,
  adminSettlementBulkSchema,
  adminSettlementBulkResultSchema,
  adminReviewQuerySchema,
  adminReviewListSchema,
  adminReviewDetailSchema,
  adminReviewModerateSchema,
  adminConsultationQuerySchema,
  adminConsultationListSchema,
  adminConsultationDetailSchema,
  adminConsultationCandidatesSchema,
  adminConsultationActionSchema,
  billingKinds,
  billingQueries,
  billingLists,
  billingDetails,
  billingSubscriptionActionSchema,
  billingPlanEditSchema,
  courseLibrarySchema,
  courseLibraryQuerySchema,
  courseEnrollmentSchema,
  myCourseSchema,
  coursePlaybackSchema,
  addFarmMemberSchema,
  farmMemberSchema,
  farmOnboardingSchema,
  farmOnboardingStatusSchema,
  submitRoleRequestSchema,
  roleRequestSchema,
  roleDecisionSchema,
  privilegedRoleSchema,
  adminCurriculumSchema,
  adminCurriculumWriteSchema,
  authUserSchema,
  ProfessionalRole,
  UserRole,
  UserStatus,
  adminProductCreateSchema,
  adminProductEditSchema,
  adminProductActionSchema,
  adminProductSchema,
  adminProductListSchema,
  adminProductQuerySchema,
  adminAssetAttachSchema,
  adminUploadCreateSchema,
  adminUploadQuerySchema,
  adminUploadSchema,
  adminUploadListSchema,
  adminPartSchema,
  adminPartUrlSchema,
  adminCompleteSchema,
  directoryKinds,
  directoryQueries,
  directoryLists,
  directoryDetails,
  accountActionSchema,
  accountActionResultSchema,
} from "@vetralink/shared-types";
import {
  adminTargetSchema,
  adminOverviewSchema,
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
  consultationId?: string;
  productId?: string;
  lessonId?: string;
  writeAccessRequired?: boolean;
  bodyLimit?: number;
};
const uuid = z.string().uuid();
export function resolveEndpoint(
  path: string[],
  method: string,
): Endpoint | null {
  const key = path.join("/");
  if (path[0] === "admin" && path[1] === "platform") {
    if (path.length === 3 && method === "GET") {
      const response = path[2] === "settings" ? platformSettingsSchema : path[2] === "integrations" ? platformIntegrationsSchema : path[2] === "system" ? platformSystemSchema : path[2] === "reports" ? platformReportSchema : undefined;
      if (response) return { method, upstream: key, response, ...(path[2] === "reports" ? { query: platformReportQuerySchema } : {}) };
    }
    if (method === "POST") {
      if (path.length === 3 && path[2] === "settings") return { method, upstream: key, body: platformSettingsSaveSchema, response: platformSettingsSchema, bodyLimit: 16384 };
      if (path.length === 3 && path[2] === "diagnostics") return { method, upstream: key, body: platformDiagnosticSchema, response: platformDiagnosticResultSchema, bodyLimit: 16384 };
      if (path.length === 3 && path[2] === "audit-export") return { method, upstream: key, body: platformAuditExportSchema, response: platformAuditExportResultSchema, bodyLimit: 16384 };
      if (path.length === 4 && path[2] === "reports" && path[3] === "export") return { method, upstream: key, body: platformReportExportSchema, response: platformReportExportResultSchema, bodyLimit: 16384 };
    }
    return null;
  }
  if (path[0] === "admin" && path[1] === "content") {
    if (path.length === 2 && method === "GET") return { method, upstream: key, query: editorialQuerySchema, response: editorialListSchema };
    if (path.length === 2 && method === "POST") return { method, upstream: key, body: editorialCreateSchema, response: editorialDetailSchema, bodyLimit: 262144 };
    if (uuid.safeParse(path[2]).success) {
      if (path.length === 3 && method === "GET") return { method, upstream: key, entityId: path[2], response: editorialDetailSchema };
      if (path.length === 4 && method === "POST" && ["save", "actions"].includes(path[3])) return { method, upstream: key, entityId: path[2], response: editorialDetailSchema, body: path[3] === "save" ? editorialSaveSchema : editorialActionSchema, bodyLimit: path[3] === "save" ? 262144 : 16384 };
    }
  }
  if (path[0] === "admin" && path[1] === "notifications") {
    if (path.length === 2 && method === "GET") return { method, upstream: key, query: notificationQuerySchema, response: notificationListSchema };
    if (path.length === 4 && uuid.safeParse(path[2]).success && path[3] === "retry" && method === "POST") return { method, upstream: key, entityId: path[2], body: notificationRetrySchema, response: notificationRowSchema, bodyLimit: 16384 };
  }
  const ownSupport = path[0] === "support" && path[1] === "tickets";
  if ((path[0] === "admin" && path[1] === "support") || ownSupport) {
    if (path.length === 2 && method === "GET") return { method, upstream: key, query: supportQuerySchema, response: supportListSchema };
    if (path.length === 2 && method === "POST" && ownSupport) return { method, upstream: key, body: supportCreateSchema, response: supportDetailSchema };
    if (uuid.safeParse(path[2]).success) {
      if (path.length === 3 && method === "GET") return { method, upstream: key, entityId: path[2], response: supportDetailSchema };
      if (path.length === 4 && method === "POST" && path[3] === (ownSupport ? "messages" : "actions")) return { method, upstream: key, entityId: path[2], body: ownSupport ? supportReplySchema : supportActionSchema, response: supportDetailSchema };
    }
  }
  if (path[0] === "admin" && path[1] === "settlements") {
    if (path.length === 2 && method === "GET")
      return {
        method,
        upstream: key,
        response: adminSettlementListSchema,
        query: adminSettlementQuerySchema,
      };
    if (path.length === 3 && path[2] === "summary" && method === "GET")
      return {
        method,
        upstream: key,
        response: adminSettlementSummarySchema,
        query: adminSettlementSummaryQuerySchema,
      };
    if (path.length === 3 && path[2] === "bulk-reconcile" && method === "POST")
      return {
        method,
        upstream: key,
        response: adminSettlementBulkResultSchema,
        body: adminSettlementBulkSchema,
        bodyLimit: 32768,
      };
    if (uuid.safeParse(path[2]).success) {
      if (path.length === 3 && method === "GET")
        return {
          method,
          upstream: key,
          entityId: path[2],
          response: adminSettlementDetailSchema,
        };
      if (path.length === 4 && path[3] === "preview" && method === "GET")
        return {
          method,
          upstream: key,
          entityId: path[2],
          response: adminSettlementPreviewSchema,
        };
      if (path.length === 4 && path[3] === "reconcile" && method === "POST")
        return {
          method,
          upstream: key,
          entityId: path[2],
          response: adminSettlementDetailSchema,
          body: adminSettlementReconcileSchema,
          bodyLimit: 16384,
        };
    }
  }
  if (path[0] === "admin" && path[1] === "reviews") {
    if (path.length === 2 && method === "GET")
      return {
        method,
        upstream: key,
        response: adminReviewListSchema,
        query: adminReviewQuerySchema,
      };
    if (uuid.safeParse(path[2]).success) {
      if (path.length === 3 && method === "GET")
        return {
          method,
          upstream: key,
          entityId: path[2],
          response: adminReviewDetailSchema,
        };
      if (path.length === 4 && path[3] === "moderate" && method === "POST")
        return {
          method,
          upstream: key,
          entityId: path[2],
          response: adminReviewDetailSchema,
          body: adminReviewModerateSchema,
          bodyLimit: 16384,
        };
    }
  }
  if (path[0] === "admin" && path[1] === "consultations") {
    if (path.length === 2 && method === "GET")
      return {
        method,
        upstream: key,
        response: adminConsultationListSchema,
        query: adminConsultationQuerySchema,
      };
    if (uuid.safeParse(path[2]).success) {
      if (path.length === 3 && method === "GET")
        return {
          method,
          upstream: key,
          entityId: path[2],
          response: adminConsultationDetailSchema,
        };
      if (path.length === 4 && path[3] === "candidates" && method === "GET")
        return {
          method,
          upstream: key,
          consultationId: path[2],
          response: adminConsultationCandidatesSchema,
        };
      if (path.length === 4 && path[3] === "actions" && method === "POST")
        return {
          method,
          upstream: key,
          entityId: path[2],
          response: adminConsultationDetailSchema,
          body: adminConsultationActionSchema,
          bodyLimit: 16384,
        };
    }
  }
  if (
    path[0] === "admin" &&
    path[1] === "billing" &&
    billingKinds.includes(path[2] as (typeof billingKinds)[number])
  ) {
    const kind = path[2] as (typeof billingKinds)[number];
    if (path.length === 3 && method === "GET")
      return {
        method,
        upstream: key,
        response: billingLists[kind],
        query: billingQueries[kind],
      };
    if (uuid.safeParse(path[3]).success) {
      if (path.length === 4 && method === "GET")
        return {
          method,
          upstream: key,
          entityId: path[3],
          response: billingDetails[kind],
        };
      if (path.length === 4 && kind === "plans" && method === "PATCH")
        return {
          method,
          upstream: key,
          entityId: path[3],
          response: billingDetails.plans,
          body: billingPlanEditSchema,
          bodyLimit: 16384,
        };
      if (
        path.length === 5 &&
        kind === "subscriptions" &&
        path[4] === "actions" &&
        method === "POST"
      )
        return {
          method,
          upstream: key,
          entityId: path[3],
          response: billingDetails.subscriptions,
          body: billingSubscriptionActionSchema,
          bodyLimit: 16384,
        };
    }
  }
  if (key === "me/courses" && method === "GET")
    return {
      method,
      upstream: key,
      response: courseLibrarySchema,
      query: courseLibraryQuerySchema,
    };
  if (
    path[0] === "me" &&
    path[1] === "courses" &&
    uuid.safeParse(path[2]).success
  ) {
    if (path.length === 3 && method === "GET")
      return {
        method,
        upstream: key,
        response: myCourseSchema,
        entityId: path[2],
      };
    if (path.length === 4 && path[3] === "enrollment" && method === "POST")
      return {
        method,
        upstream: key,
        response: courseEnrollmentSchema,
        body: emptyQuerySchema,
        productId: path[2],
      };
    if (
      path.length === 6 &&
      path[3] === "lessons" &&
      uuid.safeParse(path[4]).success &&
      path[5] === "playback" &&
      method === "GET"
    )
      return {
        method,
        upstream: key,
        response: coursePlaybackSchema,
        productId: path[2],
        lessonId: path[4],
      };
  }

  if (key === "admin/products" && ["GET", "POST"].includes(method))
    return {
      method,
      upstream: key,
      response: method === "GET" ? adminProductListSchema : adminProductSchema,
      ...(method === "GET"
        ? { query: adminProductQuerySchema }
        : { body: adminProductCreateSchema }),
    };
  if (
    path[0] === "admin" &&
    path[1] === "products" &&
    uuid.safeParse(path[2]).success
  ) {
    if (path.length === 3 && ["GET", "PATCH"].includes(method))
      return {
        method,
        upstream: key,
        entityId: path[2],
        response: adminProductSchema,
        ...(method === "PATCH" ? { body: adminProductEditSchema } : {}),
      };
    if (
      path.length === 4 &&
      path[3] === "curriculum" &&
      ["GET", "PUT"].includes(method)
    )
      return {
        method,
        upstream: key,
        productId: path[2],
        response: adminCurriculumSchema,
        ...(method === "PUT"
          ? { body: adminCurriculumWriteSchema, bodyLimit: 524288 }
          : {}),
      };
    if (
      path.length === 4 &&
      method === "POST" &&
      ["actions", "asset"].includes(path[3])
    )
      return {
        method,
        upstream: key,
        entityId: path[2],
        response: adminProductSchema,
        body:
          path[3] === "actions"
            ? adminProductActionSchema
            : adminAssetAttachSchema,
      };
  }
  if (key === "admin/media" && method === "GET")
    return {
      method,
      upstream: key,
      response: adminUploadListSchema,
      query: adminUploadQuerySchema,
    };
  if (key === "admin/media/uploads" && method === "POST")
    return {
      method,
      upstream: key,
      response: adminUploadSchema,
      body: adminUploadCreateSchema,
    };
  if (
    path[0] === "admin" &&
    path[1] === "media" &&
    path[2] === "uploads" &&
    uuid.safeParse(path[3]).success
  ) {
    if (path.length === 4 && method === "GET")
      return {
        method,
        upstream: key,
        entityId: path[3],
        response: adminUploadSchema,
      };
    if (
      path.length === 5 &&
      method === "POST" &&
      ["part-url", "complete", "abort", "process"].includes(path[4])
    )
      return {
        method,
        upstream: key,
        ...(path[4] !== "part-url" ? { entityId: path[3] } : {}),
        response:
          path[4] === "part-url" ? adminPartUrlSchema : adminUploadSchema,
        body:
          path[4] === "part-url"
            ? adminPartSchema
            : path[4] === "complete"
              ? adminCompleteSchema
              : emptyQuerySchema,
        ...(path[4] === "complete" ? { bodyLimit: 524288 } : {}),
      };
  }
  if (
    path[0] === "admin" &&
    path[1] === "directory" &&
    directoryKinds.includes(path[2] as (typeof directoryKinds)[number])
  ) {
    const kind = path[2] as (typeof directoryKinds)[number];
    if (path.length === 3 && method === "GET")
      return {
        method,
        upstream: key,
        response: directoryLists[kind],
        query: directoryQueries[kind],
      };
    if (
      path.length === 4 &&
      uuid.safeParse(path[3]).success &&
      method === "GET"
    )
      return {
        method,
        upstream: key,
        entityId: path[3],
        response: directoryDetails[kind],
      };
    if (
      kind === "users" &&
      path.length === 5 &&
      uuid.safeParse(path[3]).success &&
      path[4] === "actions" &&
      method === "POST"
    )
      return {
        method,
        upstream: key,
        entityId: path[3],
        response: accountActionResultSchema,
        body: accountActionSchema,
      };
  }
  if (key === "admin/overview" && method === "GET")
    return {
      method,
      upstream: "subscriptions/metrics/summary",
      response: adminOverviewSchema,
    };
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
  "SETTINGS_CONFLICT",
  "SETTLEMENT_VERSION_CONFLICT",
  "SETTLEMENT_ACTION_UNAVAILABLE",
  "REVIEW_VERSION_CONFLICT",
  "REVIEW_ACTION_UNAVAILABLE",
  "CONSULTATION_VERSION_CONFLICT",
  "CONSULTATION_ACTION_UNAVAILABLE",
  "BILLING_VERSION_CONFLICT",
  "BILLING_ACTION_UNAVAILABLE",
  "CONTENT_PROVIDER_MISMATCH",
  "COURSE_MUST_BE_UNPUBLISHED",
  "INVALID_CURRICULUM",
  "INVALID_YOUTUBE_PRICING",
  "COURSE_ENROLLMENT_REQUIRED",
  "ACCOUNT_VERSION_CONFLICT",
  "INVALID_ACCOUNT_TRANSITION",
  "ACCOUNT_ACTION_FORBIDDEN",
  "PRODUCT_VERSION_CONFLICT",
  "PAID_COURSE_NOT_ENABLED",
  "ASSET_NOT_READY",
  "UPLOAD_STATE_CONFLICT",
  "UPLOAD_BUSY",
  "UPLOAD_REQUEST_CONFLICT",
  "UPLOAD_VERIFICATION_FAILED",
  "INVALID_UPLOAD",
  "MEDIA_UNAVAILABLE",
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
  "COMMUNICATION_CONFLICT", "CONTENT_INCOMPLETE", "CONTENT_RESERVED_SLUG", "SUPPORT_LINK_FORBIDDEN",
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
  const platformRoute = path[0] === "admin" && path[1] === "platform";
  const communicationsRoute = (path[0] === "admin" && ["content", "notifications", "support"].includes(path[1])) || (path[0] === "support" && path[1] === "tickets");
  const financeRoute =
    path[0] === "admin" && ["settlements", "reviews"].includes(path[1]);
  if (financeRoute || communicationsRoute)
    path = path.map((value) =>
      uuid.safeParse(value).success ? value.toLowerCase() : value,
    );
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
  if (!access || access.length > 3800)
    return reply({ code: "UNAUTHORIZED" }, 401);
  for (const key of Array.from(request.nextUrl.searchParams.keys()))
    if (request.nextUrl.searchParams.getAll(key).length > 1)
      return reply({ code: "VALIDATION_FAILED" }, 422);
  const query = (endpoint.query ?? emptyQuerySchema).safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  if (!query.success) return reply({ code: "VALIDATION_FAILED" }, 422);
  if (financeRoute) {
    const values = query.data as Record<string, unknown>;
    for (const key of ["vetId", "cursor"])
      if (typeof values[key] === "string")
        values[key] = (values[key] as string).toLowerCase();
  }
  let body: unknown;
  if (endpoint.body) {
    if (
      Number(request.headers.get("content-length")) >
      (endpoint.bodyLimit ?? 32768)
    )
      return reply({ code: "VALIDATION_FAILED" }, 413);
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > (endpoint.bodyLimit ?? 32768))
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
    if (financeRoute) {
      const values = body as { vetId?: string; items?: Array<{ id: string }> };
      if (values.vetId) values.vetId = values.vetId.toLowerCase();
      values.items?.forEach((item) => {
        item.id = item.id.toLowerCase();
      });
      if (
        values.items &&
        new Set(values.items.map((item) => item.id)).size !==
          values.items.length
      )
        return reply({ code: "VALIDATION_FAILED" }, 422);
    }
  }
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 12000);
  let currentUserId: string | undefined;
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
    if (path[0] === "admin" || communicationsRoute || (path[0] === "me" && path[1] === "courses")) {
      const identityResponse = await fetchWithDiagnostics(
        new URL("auth/me", base),
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
      if (!identityResponse.ok) {
        const status = [401, 403].includes(identityResponse.status)
          ? identityResponse.status
          : 503;
        return reply(
          {
            code:
              status === 401
                ? "UNAUTHORIZED"
                : status === 403
                  ? "FORBIDDEN"
                  : "UNAVAILABLE",
          },
          status,
        );
      }
      const envelope = await identityResponse.json().catch(() => null);
      const identity = authUserSchema.safeParse(
        envelope?.success === true ? envelope.data : undefined,
      );
      if (!identity.success) return reply({ code: "INVALID_RESPONSE" }, 502);
      const expectedActor = request.headers.get("X-Workspace-Actor");
      if ((communicationsRoute || platformRoute) && request.method !== "GET" && expectedActor === null) return reply({ code: "AUTHORIZATION_CHANGED" }, 403);
      currentUserId = identity.data.id;
      if (
        expectedActor !== null &&
        expectedActor !==
          `${identity.data.id}:${identity.data.role}:${identity.data.roleVersion ?? 0}`
      )
        return reply({ code: "AUTHORIZATION_CHANGED" }, 403);
      const roles =
        path[0] === "me" || path[0] === "support"
          ? Object.values(UserRole)
          : path[1] === "users" || (platformRoute && !["reports", "audit-export"].includes(path[2]))
            ? [UserRole.SUPER_ADMIN]
            : [UserRole.ADMIN, UserRole.SUPER_ADMIN];
      if (
        identity.data.status !== UserStatus.ACTIVE ||
        !roles.includes(identity.data.role)
      )
        return reply({ code: "FORBIDDEN" }, 403);
    }
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
    if (platformRoute) {
      const data = parsed.data;
      const input = body as Record<string, any> | undefined;
      if (path[2] === "settings" && input && (data.version !== input.expectedVersion + 1 || ["organizationBn", "organizationEn", "supportEmail", "reportTimezone"].some(k => data[k] !== input[k]))) return reply({ code: "INVALID_RESPONSE" }, 502);
      if (path[2] === "diagnostics" && data.requestId !== input?.requestId) return reply({ code: "INVALID_RESPONSE" }, 502);
      if (path[2] === "reports") {
        const expected = input?.query ?? query.data;
        const range = (input ? data.report : data).range;
        const offset = expected.timezone === "Asia/Dhaka" ? "+06:00" : "Z";
        if (["from", "to", "timezone"].some(k => range[k] !== expected[k]) || Date.parse(range.startInstant) !== Date.parse(expected.from + "T00:00:00" + offset) || Date.parse(range.endInstant) !== Date.parse(expected.to + "T00:00:00" + offset)) return reply({ code: "INVALID_RESPONSE" }, 502);
      }
      if (path[2] === "audit-export") {
        const expected = input!.query;
        if (Object.keys(expected).some(k => data.query[k] !== expected[k]) || new Set(data.items.map((r: { id: string }) => r.id)).size !== data.items.length || data.items.some((r: Record<string, string>) => (expected.cursor && r.id <= expected.cursor) || (expected.actorId && r.actorId !== expected.actorId) || (expected.action && r.action !== expected.action) || (expected.entityId && r.entityId !== expected.entityId) || (expected.entityType && r.entityType !== expected.entityType))) return reply({ code: "INVALID_RESPONSE" }, 502);
        const offset = expected.timezone === "Asia/Dhaka" ? "+06:00" : "Z";
        if (data.items.some((r: { createdAt: string }) => Date.parse(r.createdAt) < Date.parse(expected.from + "T00:00:00" + offset) || Date.parse(r.createdAt) >= Date.parse(expected.to + "T00:00:00" + offset))) return reply({ code: "INVALID_RESPONSE" }, 502);
      }
    }
    if (communicationsRoute) {
      const data = parsed.data as Record<string, any>;
      const input = body as Record<string, any> | undefined;
      const rows = (data.items ?? [data]) as Array<Record<string, any>>;
      const filters = query.data as Record<string, unknown>;
      if (data.items && (rows.length > Number(filters.limit ?? 20) || new Set(rows.map((r) => r.id)).size !== rows.length || rows.some((r) => (filters.cursor && r.id <= String(filters.cursor)) || (filters.kind && r.kind !== filters.kind) || (filters.status && r.status !== filters.status) || (filters.source && r.source !== filters.source)))) return reply({ code: "INVALID_RESPONSE" }, 502);
      if (path[0] === "support" && rows.some((r) => r.requester?.id !== currentUserId || r.messages?.some((m: { internal: boolean }) => m.internal) || r.events?.length)) return reply({ code: "INVALID_RESPONSE" }, 502);
      if (request.method === "POST" && input) {
        if (input.id && data.id !== input.id) return reply({ code: "INVALID_RESPONSE" }, 502);
        if (input.expectedVersion && data.version !== input.expectedVersion + 1) return reply({ code: "INVALID_RESPONSE" }, 502);
        if (input.expectedGeneration !== undefined && (data.generation !== input.expectedGeneration + 1 || data.status !== "PENDING" || data.canRetry || data.source !== "ROLE_EMAIL")) return reply({ code: "INVALID_RESPONSE" }, 502);
        if (path[1] === "content" && ((input.action === "PUBLISH" && (!data.published || !data.publishedAt)) || (input.action === "UNPUBLISH" && (data.published !== null || data.publishedAt !== null)))) return reply({ code: "INVALID_RESPONSE" }, 502);
      }
    }
    if (
      endpoint.consultationId &&
      parsed.data.consultationId !== endpoint.consultationId
    )
      return reply({ code: "INVALID_RESPONSE" }, 502);
    if (endpoint.lessonId && parsed.data.lessonId !== endpoint.lessonId)
      return reply({ code: "INVALID_RESPONSE" }, 502);
    if (endpoint.productId && parsed.data.productId !== endpoint.productId)
      return reply({ code: "INVALID_RESPONSE" }, 502);
    if (endpoint.entityId && parsed.data.id !== endpoint.entityId)
      return reply({ code: "INVALID_RESPONSE" }, 502);
    if (path[0] === "admin" && ["settlements", "reviews"].includes(path[1])) {
      const data = parsed.data as Record<string, any>;
      const filters = query.data as Record<string, unknown>;
      const items = (data.items ?? []) as Array<Record<string, any>>;
      const isSettlement = path[1] === "settlements";
      const isSummary = path[2] === "summary";
      const details = data.items ?? [data];
      // Detail context belongs to this ledger/review, even when both IDs are valid.
      if (
        details.some(
          (item: Record<string, any>) =>
            item.consultation && item.consultation.id !== item.consultationId,
        )
      )
        return reply({ code: "INVALID_RESPONSE" }, 502);
      if (
        items.some(
          (item) =>
            (filters.vetId &&
              !isSummary &&
              item.vet !== null &&
              item.vet.id !== filters.vetId) ||
            (filters.currency && item.currency !== filters.currency) ||
            (filters.status &&
              !isSummary &&
              (item.status ?? item.moderationStatus) !== filters.status) ||
            (filters.rating && item.rating !== filters.rating),
        )
      )
        return reply({ code: "INVALID_RESPONSE" }, 502);
      if (isSettlement && request.method === "POST") {
        const input = body as {
          items?: Array<{ id: string }>;
          vetId?: string;
          currency?: string;
          payoutReference: string;
          payoutBatchId?: string;
        };
        const reconciled = path[2] === "bulk-reconcile" ? items : [data];
        if (
          reconciled.some(
            (item) =>
              item.status !== "PAID" ||
              item.canReconcile ||
              !item.processedAt ||
              item.payoutReference !== input.payoutReference ||
              (input.payoutBatchId !== undefined &&
                item.payoutBatchId !== input.payoutBatchId),
          )
        )
          return reply({ code: "INVALID_RESPONSE" }, 502);
        if (
          input.items &&
          (items.length !== input.items.length ||
            new Set(items.map((item) => item.id)).size !== items.length ||
            items.some(
              (item) =>
                !input.items!.some((expected) => expected.id === item.id) ||
                item.vet?.id !== input.vetId ||
                item.currency !== input.currency,
            ))
        )
          return reply({ code: "INVALID_RESPONSE" }, 502);
      }
      if (
        !isSettlement &&
        request.method === "POST" &&
        (data.moderationStatus !== (body as { status: string }).status ||
          !data.moderatedAt)
      )
        return reply({ code: "INVALID_RESPONSE" }, 502);
    }
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
