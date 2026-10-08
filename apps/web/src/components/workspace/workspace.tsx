"use client";
import { cn } from "@/lib/ui/cn";
import { useAuth } from "@/components/auth/auth-provider";
import { UserRole } from "@vetralink/shared-types";
import { workspaceBn, workspaceEn } from "@/lib/i18n/workspace";
import { FarmOnboarding } from "./farm-workspace";
import {
  RoleApplication,
  RoleHistory,
  ReviewQueue,
  ApplicationReview,
} from "./role-workspace";
import { AdministrativeAccess } from "./administrative-access";
import { option } from "./workspace-ui";
import { FarmDiscovery } from "./farm-discovery";
import { farmWorkspaceRoles } from "@/lib/workspace/farm-navigation";
import styles from "./workspace.styles";
import { WorkspaceGate } from "./workspace-gate";
export type WorkspaceView =
  | "onboarding"
  | "farm"
  | "application"
  | "history"
  | "request"
  | "queue"
  | "review"
  | "access";
export function Workspace({
  view,
  locale,
  id,
}: {
  view: WorkspaceView;
  locale: "bn" | "en";
  id?: string;
}) {
  const t = locale === "bn" ? workspaceBn : workspaceEn,
    auth = useAuth();
  const roles: UserRole[] =
    view === "farm"
      ? farmWorkspaceRoles
      : view === "onboarding"
        ? [UserRole.FARMER]
        : view === "application"
          ? [UserRole.LEARNER]
          : view === "queue" || view === "review"
            ? [UserRole.ADMIN, UserRole.SUPER_ADMIN]
            : view === "access"
              ? [UserRole.SUPER_ADMIN]
              : Object.values(UserRole);
  const title = {
    onboarding: t.setupTitle,
    farm: t.farmTitle,
    application: t.applicationTitle,
    history: t.applicationsTitle,
    request: t.applicationsTitle,
    queue: t.queueTitle,
    review: t.reviewTitle,
    access: t.accessTitle,
  }[view];
  return (
    <main id="main-content" className={cn(styles.shell)}>
      <h1 className={cn(styles.heading)}>{title}</h1>
      <WorkspaceGate
        allowedRoles={roles}
        requireFarmerSetupComplete={view === "farm"}
      >
        <>
          <p>
            {t.currentRole}:{" "}
            <strong>{auth.user && option(t, auth.user.role)}</strong>
          </p>
          {view === "onboarding" ? (
            <FarmOnboarding locale={locale} t={t} />
          ) : view === "farm" ? (
            <FarmDiscovery />
          ) : view === "application" ? (
            <RoleApplication locale={locale} t={t} />
          ) : view === "history" || view === "request" ? (
            <RoleHistory
              locale={locale}
              t={t}
              id={view === "request" ? id : undefined}
            />
          ) : view === "queue" ? (
            <ReviewQueue locale={locale} t={t} />
          ) : view === "review" ? (
            <ApplicationReview id={id!} t={t} />
          ) : (
            <AdministrativeAccess t={t} />
          )}
        </>
      </WorkspaceGate>
    </main>
  );
}
