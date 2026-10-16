"use client";

import Link from "next/link";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { UserRole } from "@vetralink/shared-types";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { getAdminMessages } from "@/lib/i18n/admin";
import { getAdminCourseMessages } from "@/lib/i18n/admin-courses";
import { getConsultationMessages } from "@/lib/i18n/admin-consultations";
import { getBillingMessages } from "@/lib/i18n/admin-billing";
import {
  adminOverviewSchema,
  reviewQueueSchema,
} from "@/lib/workspace/contracts";
import { WorkspaceGate } from "./workspace-gate";
import { useRemote } from "./workspace-ui";
import styles from "./workspace.styles";

const roles = [UserRole.ADMIN, UserRole.SUPER_ADMIN];
const linkClass =
  "inline-flex min-h-11 items-center gap-2 font-semibold text-green [overflow-wrap:anywhere]";

function SectionError({ retry }: { retry: () => void }) {
  const t = getAdminMessages(useAuth().locale);
  return (
    <div>
      <p role="alert" className="text-sm text-muted">
        {t.unavailable}
      </p>
      <Button data-admin-retry variant="outline" onClick={retry}>
        {t.retry}
      </Button>
    </div>
  );
}

function Overview() {
  const auth = useAuth(),
    t = getAdminMessages(auth.locale),
    courses = getAdminCourseMessages(auth.locale),
    billing = getBillingMessages(auth.locale),
    consultations = getConsultationMessages(auth.locale);
  const overview = useRemote("admin/overview", adminOverviewSchema);
  const applications = useRemote(
    "admin/role-requests?status=PENDING&limit=5",
    reviewQueueSchema,
  );
  const locale = auth.locale === "bn" ? "bn-BD" : "en-GB";
  const number = new Intl.NumberFormat(locale);
  const date = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Dhaka",
  });
  return (
    <div
      data-admin-dashboard
      data-dashboard-role={auth.user!.role}
      className="space-y-8"
    >
      <p className="mt-0 text-muted">{t.intro}</p>
      <Card data-admin-course-shortcut className="flex flex-wrap items-center justify-between gap-5 p-5">
        <div className="min-w-0">
          <h2 className="m-0 text-xl font-semibold">{courses.courses}</h2>
          <p className="mb-0 mt-2 text-sm text-muted">{courses.intro}</p>
        </div>
        <Link className={styles.primary} href="/admin/courses">{courses.createAndContinue}</Link>
      </Card>
      <Card data-admin-billing-shortcut className="flex flex-wrap items-center justify-between gap-5 p-5">
        <div className="min-w-0"><h2 className="m-0 text-xl font-semibold">{billing.billing}</h2><p className="mb-0 mt-2 text-sm text-muted">{billing.intro}</p></div>
        <Link className={styles.primary} href="/admin/orders">{billing.details}</Link>
      </Card>
      <Card data-admin-consultations-shortcut className="flex flex-wrap items-center justify-between gap-5 p-5">
        <div className="min-w-0"><h2 className="m-0 text-xl font-semibold">{consultations.operations}</h2><p className="mb-0 mt-2 text-sm text-muted">{consultations.intro}</p></div>
        <Link className={styles.primary} href="/admin/triage">{consultations.triage}</Link>
      </Card>
      <section
        data-admin-overview
        aria-labelledby="admin-overview-title"
        aria-busy={overview.loading}
      >
        <h2 id="admin-overview-title" className="text-xl font-semibold">
          {t.overview}
        </h2>
        {overview.loading ? (
          <p role="status">{t.loading}</p>
        ) : !overview.data ? (
          <SectionError retry={overview.reload} />
        ) : (
          <>
            <p className="text-sm text-muted">
              {t.snapshot}:{" "}
              <time dateTime={overview.data.asOfDate}>
                {date.format(new Date(overview.data.asOfDate))}
              </time>
            </p>
            <dl className="m-0 grid grid-cols-1 gap-4 min-[540px]:grid-cols-2 min-[1280px]:grid-cols-4">
              {(Object.keys(t.counts) as (keyof typeof t.counts)[]).map(
                (key) => (
                  <Card key={key} className="min-w-0 p-5">
                    <dt className="text-sm text-muted">{t.counts[key]}</dt>
                    <dd
                      data-admin-count={key}
                      className="m-0 mt-3 break-all text-3xl font-semibold tabular-nums text-green"
                    >
                      {number.format(overview.data![key])}
                    </dd>
                  </Card>
                ),
              )}
            </dl>
          </>
        )}
      </section>
      <section
        data-admin-applications
        aria-labelledby="admin-applications-title"
        aria-busy={applications.loading}
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <div>
            <h2
              id="admin-applications-title"
              className="mb-2 text-xl font-semibold"
            >
              {t.recent}
            </h2>
            <p className="m-0 text-sm text-muted">{t.recentBody}</p>
          </div>
          <Link
            href="/admin/role-requests?status=PENDING"
            className={linkClass}
          >
            {t.pending}
            <ArrowUpRight size={18} className="shrink-0" aria-hidden="true" />
          </Link>
        </div>
        {applications.loading ? (
          <p role="status">{t.loading}</p>
        ) : !applications.data ? (
          <SectionError retry={applications.reload} />
        ) : applications.data.requests.length === 0 ? (
          <Card className="p-6">
            <p data-admin-empty className="m-0 text-muted">
              {t.empty}
            </p>
          </Card>
        ) : (
          <ul className="m-0 list-none space-y-3 p-0">
            {applications.data.requests.slice(0, 5).map((request) => (
              <li key={request.id}>
                <Card className="flex min-w-0 flex-wrap items-center justify-between gap-4 p-5">
                  <div className="min-w-0 [overflow-wrap:anywhere]">
                    <h3 className="m-0 text-base font-semibold">
                      {request.applicant.name}
                    </h3>
                    <p className="mb-0 mt-2 text-sm text-muted">
                      {auth.messages.roles[request.targetRole]} ·{" "}
                      <time dateTime={request.submittedAt}>
                        {date.format(new Date(request.submittedAt))}
                      </time>
                    </p>
                  </div>
                  <Link
                    data-review-link
                    href={`/admin/role-requests/${request.id}`}
                    className={linkClass}
                    aria-label={`${t.review}: ${request.applicant.name}`}
                  >
                    {t.review}
                    <ArrowUpRight
                      size={18}
                      className="shrink-0"
                      aria-hidden="true"
                    />
                  </Link>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
      {auth.user!.role === UserRole.SUPER_ADMIN && (
        <section aria-labelledby="admin-tools-title">
          <h2 id="admin-tools-title" className="text-xl font-semibold">
            {t.tools}
          </h2>
          <Card>
            <CardHeader>
              <ShieldCheck className="text-green" aria-hidden="true" />
              <h3 className="m-0 text-lg font-semibold">{t.access}</h3>
              <p className="m-0 text-sm text-muted">{t.accessBody}</p>
            </CardHeader>
            <CardContent>
              <Link href="/admin/administrative-access" className={linkClass}>
                {t.access}
                <ArrowUpRight size={18} aria-hidden="true" />
              </Link>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}

export function AdminDashboard() {
  const auth = useAuth(),
    t = getAdminMessages(auth.locale);
  return (
    <main id="main-content" className={styles.shell}>
      <h1 className={styles.heading}>
        {auth.user?.role === UserRole.SUPER_ADMIN ? t.superTitle : t.title}
      </h1>
      <WorkspaceGate allowedRoles={roles}>
        <Overview />
      </WorkspaceGate>
    </main>
  );
}
