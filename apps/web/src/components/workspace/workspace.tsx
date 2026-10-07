"use client";
import { cn } from "@/lib/ui/cn";
import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { UserRole } from "@vetralink/shared-types";
import { workspaceBn, workspaceEn } from "@/lib/i18n/workspace";
import { FarmDashboard, FarmOnboarding } from "./farm-workspace";
import {
  RoleApplication,
  RoleHistory,
  ReviewQueue,
  ApplicationReview,
} from "./role-workspace";
import { AdministrativeAccess } from "./administrative-access";
import { Notice, option } from "./workspace-ui";
import styles from "./workspace.styles";
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
    auth = useAuth(),
    router = useRouter();
  const roles: UserRole[] =
    view === "onboarding" || view === "farm"
      ? [UserRole.FARMER]
      : view === "application"
        ? [UserRole.LEARNER]
        : view === "queue" || view === "review"
          ? [UserRole.ADMIN, UserRole.SUPER_ADMIN]
          : view === "access"
            ? [UserRole.SUPER_ADMIN]
            : Object.values(UserRole);
  useEffect(() => {
    if (
      view === "farm" &&
      auth.user?.role === UserRole.FARMER &&
      auth.user.farmerOnboardingRequired
    )
      router.replace("/account/farm-onboarding");
  }, [view, auth.user?.role, auth.user?.farmerOnboardingRequired, router]);
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
      <nav
        className={cn(styles.navigation)}
        aria-label={locale === "bn" ? "অ্যাকাউন্টের পথ" : "Account navigation"}
      >
        <Link href="/">{t.home}</Link>
        {auth.user && (
          <>
            <Link href="/account/role-requests">{t.applicationsTitle}</Link>
            {auth.user.role === UserRole.FARMER && (
              <Link
                href={
                  auth.user.farmerOnboardingRequired
                    ? "/account/farm-onboarding"
                    : "/farm"
                }
              >
                {t.farmTitle}
              </Link>
            )}
            {[UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(
              auth.user.role,
            ) && <Link href="/admin/role-requests">{t.queueTitle}</Link>}
            {auth.user.role === UserRole.SUPER_ADMIN && (
              <Link href="/admin/administrative-access">{t.accessTitle}</Link>
            )}
          </>
        )}
      </nav>
      <h1 className={cn(styles.heading)}>{title}</h1>
      {auth.checking ? (
        <Notice text={t.loading} t={t} />
      ) : auth.error && auth.error !== "session_expired" ? (
        <>
          <Notice
            code={auth.error === "timeout" ? "TIMEOUT" : "UNAVAILABLE"}
            t={t}
          />
          <button
            className={cn(styles.secondary)}
            onClick={() => void auth.restore()}
          >
            {t.retry}
          </button>
        </>
      ) : !auth.user ? (
        <section className={cn(styles.card)}>
          <h2>{t.signInRequired}</h2>
          <p>{t.signInBody}</p>
          <button className={cn(styles.primary)} onClick={() => auth.open("login")}>
            {auth.messages.signIn}
          </button>
        </section>
      ) : !roles.includes(auth.user.role) ? (
        <Notice text={t.denied} t={t} />
      ) : view === "farm" && auth.user.farmerOnboardingRequired ? (
        <Notice text={t.loading} t={t} />
      ) : (
        <>
          <p>
            {t.currentRole}: <strong>{option(t, auth.user.role)}</strong>
          </p>
          {view === "onboarding" ? (
            <FarmOnboarding locale={locale} t={t} />
          ) : view === "farm" ? (
            <FarmDashboard t={t} />
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
      )}
    </main>
  );
}
