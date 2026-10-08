import {
  authUserSchema,
  UserRole,
  UserStatus,
  type AuthUserSummary,
} from "@vetralink/shared-types";
import type { Locale } from "../i18n/locale";
import { getWorkspaceShellMessages } from "../i18n/workspace-shell";

export type WorkspaceNavItem = { label: string; href: string };
const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const released = new RegExp(
  `^/(?:dashboard|farm|app/farms/${uuid}(?:/members|/animals(?:/new|/${uuid})?)?|account/(?:profile|farm-onboarding|role-requests(?:/new|/${uuid})?)|admin/(?:administrative-access|role-requests(?:/${uuid})?))$`,
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
    const allowed =
      url.pathname === "/account/profile"
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
  return validateWorkspaceReturnTo(returnTo) ?? "/dashboard";
}
export function getWorkspaceNav(
  user: AuthUserSummary,
  locale: Locale,
): readonly WorkspaceNavItem[] {
  const identity = activeUser(user);
  if (!identity) return [];
  const t = getWorkspaceShellMessages(locale);
  const items: WorkspaceNavItem[] = [
    { label: t.dashboard, href: "/dashboard" },
  ];
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
