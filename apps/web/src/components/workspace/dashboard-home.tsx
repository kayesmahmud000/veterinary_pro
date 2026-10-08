"use client";
import Link from "next/link";
import {
  ArrowUpRight,
  BookOpen,
  Sprout,
  UserRound,
  Stethoscope,
  ClipboardList,
  CircleHelp,
} from "lucide-react";
import { UserRole } from "@vetralink/shared-types";
import { useAuth } from "@/components/auth/auth-provider";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getAccountMessages } from "@/lib/i18n/account";
import { getWorkspaceShellMessages } from "@/lib/i18n/workspace-shell";
import { WorkspaceGate } from "./workspace-gate";
import styles from "./workspace.styles";
import { farmWorkspaceRoles } from "@/lib/workspace/farm-navigation";
import { FarmDiscovery } from "./farm-discovery";

function Overview() {
  const auth = useAuth(),
    user = auth.user!,
    t = getAccountMessages(auth.locale),
    shell = getWorkspaceShellMessages(auth.locale);
  const actions = [
    { title: t.learn, body: t.learnBody, href: "/learning", icon: BookOpen },
    ...(user.role === UserRole.LEARNER
      ? [
          {
            title: t.apply,
            body: t.applyBody,
            href: "/account/role-requests/new",
            icon: ClipboardList,
          },
        ]
      : []),
    ...(user.role === UserRole.FARMER
      ? [
          {
            title: t.farm,
            body: t.farmBody,
            href: user.farmerOnboardingRequired
              ? "/account/farm-onboarding"
              : "/farm",
            icon: Sprout,
          },
        ]
      : []),
    ...([UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(user.role)
      ? [
          {
            title: t.review,
            body: t.reviewBody,
            href: "/admin/role-requests",
            icon: ClipboardList,
          },
        ]
      : []),
    ...([UserRole.BUYER, UserRole.VET].includes(user.role)
      ? [
          {
            title: t.doctors,
            body: t.doctorsBody,
            href: "/doctors",
            icon: Stethoscope,
          },
        ]
      : []),
    { title: t.help, body: t.helpBody, href: "/help", icon: CircleHelp },
  ];
  return (
    <div data-dashboard-role={user.role}>
      <p className="mt-0 text-muted">{t.intro}</p>
      <Card className="mb-8 bg-[#f1f5ed]">
        <CardHeader>
          <div className="flex items-center gap-3">
            <UserRound aria-hidden="true" />
            <h2 className="m-0 break-words text-xl font-medium">
              {t.welcome}, {user.name}
            </h2>
          </div>
        </CardHeader>
        <CardContent>
          <p className="mt-0 text-sm">
            {t.role}: <strong>{auth.messages.roles[user.role]}</strong>
          </p>
          <p className="break-words text-sm text-muted">
            {t.email}: {user.email} ·{" "}
            {user.isEmailVerified ? t.verified : t.unverified}
          </p>
          <p className="text-sm text-muted">
            {t.phone}: {user.maskedPhone ?? t.missing}
          </p>
          <Link
            href="/account/profile"
            className="inline-flex min-h-11 items-center gap-2 font-semibold text-green"
          >
            {shell.profile}
            <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
        </CardContent>
      </Card>
      {farmWorkspaceRoles.includes(user.role) &&
        !user.farmerOnboardingRequired && (
          <section className="mb-8">
            <h2 className="text-xl font-medium">{t.farm}</h2>
            <FarmDiscovery />
          </section>
        )}
      <h2 className="mb-5 text-xl font-medium">{t.start}</h2>
      <div className="grid grid-cols-1 gap-5 min-[768px]:grid-cols-2">
        {actions.map(({ title, body, href, icon: Icon }) => (
          <Card key={href}>
            <CardHeader>
              <Icon className="text-green" size={25} aria-hidden="true" />
              <h3 className="m-0 text-lg font-semibold">{title}</h3>
              <p className="m-0 text-sm leading-7 text-muted">{body}</p>
            </CardHeader>
            <CardContent>
              <Link
                className="inline-flex min-h-11 items-center gap-2 font-semibold text-green"
                href={href}
              >
                {title}
                <ArrowUpRight size={18} aria-hidden="true" />
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
export function DashboardHome() {
  const { locale } = useAuth();
  return (
    <main id="main-content" className={styles.shell}>
      <h1 className={styles.heading}>
        {getWorkspaceShellMessages(locale).dashboard}
      </h1>
      <WorkspaceGate>
        <Overview />
      </WorkspaceGate>
    </main>
  );
}
