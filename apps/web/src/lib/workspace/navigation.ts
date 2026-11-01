import {
  adminSettlementQuerySchema,
  adminReviewQuerySchema,
  adminConsultationQuerySchema,
  authUserSchema,
  UserRole,
  UserStatus,
  type AuthUserSummary,
} from "@vetralink/shared-types";
import type { Locale } from "../i18n/locale";
import { getWorkspaceShellMessages } from "../i18n/workspace-shell";

export type WorkspaceNavItem = {
  label: string;
  href: string;
  section?: string;
};
export function isAdministrativeRole(role: UserRole): boolean {
  return role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN;
}
export function canAccessAdminPath(role: UserRole, pathname: string): boolean {
  if (!/^\/admin(?:\/|$)/.test(pathname)) return true;
  if (/^\/admin\/(?:administrative-access|settings|system)(?:\/|$)/.test(pathname))
    return role === UserRole.SUPER_ADMIN;
  return isAdministrativeRole(role);
}
export function isProtectedWorkspacePath(pathname: string): boolean {
  return /^\/(?:dashboard|account|admin|app\/farms|farm)(?:\/|$)/.test(
    pathname,
  );
}
export function protectedEntryUrl(destination: string): string {
  const returnTo =
    validateWorkspaceReturnTo(destination) ??
    validateWorkspaceReturnTo(destination.split("?")[0]) ??
    "/dashboard";
  return `/?${new URLSearchParams({ auth: "required", returnTo })}`;
}
export function readProtectedReturnTo(
  auth: unknown,
  returnTo: unknown,
): string | null {
  return auth === "required" && typeof returnTo === "string"
    ? validateWorkspaceReturnTo(returnTo)
    : null;
}
const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const released = new RegExp(
  `^/(?:dashboard|farm|app/farms/${uuid}(?:/members|/animals(?:/new|/${uuid})?)?|account/(?:support(?:/${uuid})?|courses(?:/${uuid}/lessons/${uuid})?|profile|farm-onboarding|role-requests(?:/new|/${uuid})?)|admin(?:/(?:settings(?:/integrations)?|system|metrics|reports|notifications|(?:content|support)(?:/${uuid})?|dashboard|administrative-access|settlements(?:/vets/${uuid}|/${uuid})?|reviews(?:/${uuid})?|courses(?:/new|/${uuid})?|(?:triage|consultations)(?:/${uuid})?|(?:orders|subscriptions|plans|dunning)(?:/${uuid})?|products(?:/new|/${uuid}(?:/edit|/curriculum)?)?|media(?:/uploads/${uuid})?|(?:users|veterinarians|farms|audit)(?:/${uuid})?|role-requests(?:/${uuid})?))?)$`,
  "i",
);
export function validateWorkspaceReturnTo(
  value: string | undefined,
): string | null {
  if (
    !value ||
    value.length > 1500 ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\s\u0000-\u001f\u007f]/.test(value)
  )
    return null;
  try {
    let decoded = value;
    for (let i = 0; i < 3; i++) {
      decoded = decodeURIComponent(decoded);
      if (/[\\\u0000-\u001f\u007f]/.test(decoded) || decoded.startsWith("//"))
        return null;
    }
    const url = new URL(value, "https://workspace.invalid");
    if (
      url.origin !== "https://workspace.invalid" ||
      !released.test(url.pathname) ||
      url.hash ||
      url.pathname !== value.split("?")[0]
    )
      return null;
    const allowed = /^\/admin\/settlements(?:\/vets\/[^/]+)?$/.test(
      url.pathname,
    )
      ? ["limit", "cursor", "search", "status", "vetId", "currency"]
      : url.pathname === "/admin/reviews"
        ? ["limit", "cursor", "search", "status", "vetId", "rating"]
        : /^\/admin\/(?:triage|consultations)$/.test(url.pathname)
          ? ["limit", "cursor", "search", "status", "type"]
          : url.pathname === "/admin/media"
            ? ["productId"]
            : url.pathname === "/account/profile"
              ? ["section"]
              : url.pathname.endsWith("role-requests")
                ? ["status", "targetRole", "limit", "cursor"]
                : url.pathname.endsWith("/animals")
                  ? [
                      "page",
                      "limit",
                      "search",
                      "species",
                      "gender",
                      "status",
                      "sortBy",
                      "sortOrder",
                    ]
                  : [];
    for (const key of Array.from(url.searchParams.keys()))
      if (!allowed.includes(key) || url.searchParams.getAll(key).length > 1)
        return null;
    if (
      /^\/admin\/settlements(?:\/vets\/[^/]+)?$/.test(url.pathname) ||
      url.pathname === "/admin/reviews"
    ) {
      const filters = Object.fromEntries(url.searchParams);
      const fixedVet = /^\/admin\/settlements\/vets\/([^/]+)$/.exec(
        url.pathname,
      )?.[1];
      if (fixedVet && filters.vetId && filters.vetId !== fixedVet) return null;
      if (
        !(
          url.pathname === "/admin/reviews"
            ? adminReviewQuerySchema
            : adminSettlementQuerySchema
        ).safeParse(filters).success
      )
        return null;
    }
    if (/^\/admin\/(?:triage|consultations)$/.test(url.pathname)) {
      const filters = Object.fromEntries(url.searchParams);
      if (filters.status === "") delete filters.status;
      if (!adminConsultationQuerySchema.safeParse(filters).success) return null;
    }
    return url.pathname + url.search;
  } catch {
    return null;
  }
}
function activeUser(user: unknown): AuthUserSummary | null {
  const result = authUserSchema.safeParse(user);
  return result.success && result.data.status === UserStatus.ACTIVE
    ? result.data
    : null;
}
export function getPostLoginDestination(
  user: AuthUserSummary,
  returnTo?: string,
): string {
  const identity = activeUser(user);
  if (!identity) throw new Error("An active identity is required");
  if (identity.role === UserRole.FARMER && identity.farmerOnboardingRequired)
    return "/account/farm-onboarding";
  const validated = validateWorkspaceReturnTo(returnTo);
  const destination =
    validated && canAccessAdminPath(identity.role, validated.split("?")[0])
      ? validated
      : null;
  if (isAdministrativeRole(identity.role))
    return destination && !["/admin", "/dashboard"].includes(destination)
      ? destination
      : "/admin/dashboard";
  if (identity.role === UserRole.LEARNER)
    return destination && destination !== "/dashboard" ? destination : "/";
  return destination ?? "/dashboard";
}
export function getWorkspaceNav(
  user: AuthUserSummary,
  locale: Locale,
): readonly WorkspaceNavItem[] {
  const identity = activeUser(user);
  if (!identity) return [];
  const t = getWorkspaceShellMessages(locale);
  if (isAdministrativeRole(identity.role))
    return [
      {
        label: t.dashboard,
        href: "/admin/dashboard",
        section: t.adminOverview,
      },
      {
        label: t.reviews,
        href: "/admin/role-requests",
        section: t.adminPeople,
      },
      ...(["users", "veterinarians", "farms", "audit"] as const).map(
        (kind) => ({
          label: t[kind],
          href: `/admin/${kind}`,
          section: kind === "audit" ? t.adminPlatform : t.adminPeople,
        }),
      ),
      {
        label: t.adminCourses,
        href: "/admin/courses",
        section: t.adminPlatform,
      },
      ...(["products", "media"] as const).map((kind) => ({
        label: t[kind],
        href: `/admin/${kind}`,
        section: t.adminPlatform,
      })),
      ...(["content", "notifications", "support"] as const).map((kind) => ({ label: t[kind], href: `/admin/${kind}`, section: t.adminPlatform })),
      ...(["metrics", "reports"] as const).map(kind => ({ label: t[kind], href: `/admin/${kind}`, section: t.adminPlatform })),
      ...(identity.role === UserRole.SUPER_ADMIN ? (["settings", "system"] as const).map(kind => ({ label: t[kind], href: `/admin/${kind}`, section: t.adminPlatform })) : []),
      {
        label: t.triage,
        href: "/admin/triage",
        section: t.consultationOperations,
      },
      {
        label: t.consultations,
        href: "/admin/consultations",
        section: t.consultationOperations,
      },
      ...(["orders", "subscriptions", "plans", "dunning"] as const).map(
        (kind) => ({
          label: t[kind],
          href: `/admin/${kind}`,
          section: t.billing,
        }),
      ),
      { label: t.settlements, href: "/admin/settlements", section: t.billing },
      {
        label: t.moderation,
        href: "/admin/reviews",
        section: t.consultationOperations,
      },
      ...(identity.role === UserRole.SUPER_ADMIN
        ? [
            {
              label: t.access,
              href: "/admin/administrative-access",
              section: t.adminPlatform,
            },
          ]
        : []),
    ];
  const items: WorkspaceNavItem[] =
    identity.role === UserRole.LEARNER
      ? []
      : [{ label: t.dashboard, href: "/dashboard" }];
  if (identity.role === UserRole.FARMER)
    items.push({
      label: identity.farmerOnboardingRequired ? t.setup : t.farm,
      href: identity.farmerOnboardingRequired
        ? "/account/farm-onboarding"
        : "/farm",
    });
  if ([UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(identity.role))
    items.push({ label: t.reviews, href: "/admin/role-requests" });
  if (identity.role === UserRole.SUPER_ADMIN)
    items.push({ label: t.access, href: "/admin/administrative-access" });
  items.push(
    { label: t.courses, href: "/account/courses" },
    { label: t.support, href: "/account/support" },
    { label: t.profile, href: "/account/profile" },
    { label: t.applications, href: "/account/role-requests" },
  );
  if (identity.role === UserRole.LEARNER)
    items.push({ label: t.apply, href: "/account/role-requests/new" });
  return items;
}
export function isWorkspaceNavActive(href: string, pathname: string) {
  // The application form has its own entry; it must not also select history.
  if (href === "/account/role-requests")
    return (
      pathname === href ||
      (pathname.startsWith(`${href}/`) && pathname !== `${href}/new`)
    );
  return pathname === href || pathname.startsWith(`${href}/`);
}
