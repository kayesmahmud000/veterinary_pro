import { farmOnboardingStatusSchema, UserRole } from "@vetralink/shared-types";
import type { z } from "zod";
import type { Locale } from "../i18n/locale";
import { getWorkspaceShellMessages } from "../i18n/workspace-shell";
import type { WorkspaceNavItem } from "./navigation";
export type FarmMembershipProjection = z.infer<
  typeof farmOnboardingStatusSchema
>["farms"][number];
export const farmWorkspaceRoles = [
  UserRole.FARMER,
  UserRole.BUYER,
  UserRole.VET,
  UserRole.ADMIN,
  UserRole.SUPER_ADMIN,
];
export function getFarmWorkspaceNav(
  farm: FarmMembershipProjection,
  locale: Locale,
): readonly WorkspaceNavItem[] {
  const t = getWorkspaceShellMessages(locale),
    base = `/app/farms/${farm.id}`;
  return [
    { label: t.overview, href: base },
    { label: t.animals, href: `${base}/animals` },
    { label: t.members, href: `${base}/members` },
  ];
}
