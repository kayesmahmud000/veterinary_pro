"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { LanguageSwitcher } from "@/components/marketing/language-switcher";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getAccountMessages } from "@/lib/i18n/account";
import { getWorkspaceShellMessages } from "@/lib/i18n/workspace-shell";
import { getWorkspaceNav } from "@/lib/workspace/navigation";
import { WorkspaceGate } from "./workspace-gate";
import styles from "./workspace.styles";

function Profile() {
  const auth = useAuth(),
    user = auth.user!,
    t = getAccountMessages(auth.locale),
    shell = getWorkspaceShellMessages(auth.locale),
    router = useRouter();
  const query = useSearchParams().get("section"),
    section = ["details", "access", "preferences"].includes(query ?? "")
      ? query
      : "details";
  const [pending, setPending] = useState(false),
    [error, setError] = useState(false);
  const initials = user.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => Array.from(part)[0])
    .join("");
  async function logout() {
    if (pending) return;
    setPending(true);
    setError(false);
    const result = await auth.mutate("logout");
    setPending(false);
    if (result.code) setError(true);
    else router.replace("/");
  }
  const rows = [
    [t.name, user.name],
    [t.email, user.email],
    [t.phone, user.maskedPhone || t.missing],
    [t.role, auth.messages.roles[user.role]],
    [shell.accountStatus, t.active],
    [
      t.joined,
      new Intl.DateTimeFormat(auth.locale === "bn" ? "bn-BD" : "en-GB", {
        dateStyle: "medium",
        timeZone: "Asia/Dhaka",
      }).format(new Date(user.createdAt)),
    ],
  ];
  return (
    <div data-account-profile>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div
              aria-hidden="true"
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#e7eee0] text-xl text-green"
            >
              {initials || "?"}
            </div>
            <div className="min-w-0">
              <h2 className="m-0 break-words text-xl font-medium">
                {user.name}
              </h2>
              <p className="mb-0 mt-1 text-sm text-muted">
                {auth.messages.roles[user.role]}
              </p>
            </div>
          </div>
        </CardHeader>
      </Card>
      <nav
        aria-label={shell.section}
        className="my-6 flex flex-wrap gap-x-6 gap-y-1 border-x-0 border-t-0 border-b border-solid border-line"
      >
        {(
          [
            ["details", shell.details],
            ["access", shell.permissions],
            ["preferences", shell.preferences],
          ] as const
        ).map(([value, label]) => (
          <Link
            key={value}
            href={`/account/profile?section=${value}`}
            aria-current={section === value ? "page" : undefined}
            className={`flex min-h-11 items-center text-sm font-semibold ${section === value ? "text-[#a26913]" : "text-muted"}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      <Card>
        <CardHeader>
          <h2 className="m-0 text-xl font-medium">
            {section === "access"
              ? shell.permissions
              : section === "preferences"
                ? shell.preferences
                : shell.details}
          </h2>
        </CardHeader>
        <CardContent>
          {section === "details" ? (
            <>
              <dl className="m-0 grid grid-cols-1 gap-6 min-[768px]:grid-cols-2">
                {rows.map(([label, value]) => (
                  <div key={label} className="min-w-0">
                    <dt className="text-sm text-muted">{label}</dt>
                    <dd className="m-0 mt-2 break-words font-medium">
                      {value}
                    </dd>
                    {label === t.email && (
                      <p className="mb-0 mt-2 text-xs text-muted">
                        {user.isEmailVerified ? t.verified : t.unverified}
                      </p>
                    )}
                  </div>
                ))}
              </dl>
              <p className="mb-0 mt-8 text-sm leading-7 text-muted">
                {t.readonly}
              </p>
            </>
          ) : section === "access" ? (
            <>
              <p className="mt-0 text-sm leading-7 text-muted">
                {t.accessBody}
              </p>
              <p>
                {t.role}: <strong>{auth.messages.roles[user.role]}</strong>
              </p>
              <ul className="m-0 list-none p-0">
                {getWorkspaceNav(user, auth.locale)
                  .filter((item) => item.href !== "/account/profile")
                  .map((item) => (
                    <li key={item.href}>
                      <Link
                        className="inline-flex min-h-11 items-center text-green"
                        href={item.href}
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
              </ul>
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <span>{t.language}</span>
                <LanguageSwitcher locale={auth.locale} label={t.language} />
              </div>
              <p className="my-6 text-sm leading-7 text-muted">
                {t.securityBody}
              </p>
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => void logout()}
              >
                {pending ? shell.signingOut : shell.signOut}
              </Button>
              {error && (
                <p role="alert" className="text-sm text-[#87271f]">
                  {auth.messages.errors.unavailable}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
export function AccountProfile() {
  const { locale } = useAuth();
  return (
    <main id="main-content" className={styles.shell}>
      <h1 className={styles.heading}>
        {getWorkspaceShellMessages(locale).profile}
      </h1>
      <WorkspaceGate>
        <Profile />
      </WorkspaceGate>
    </main>
  );
}
