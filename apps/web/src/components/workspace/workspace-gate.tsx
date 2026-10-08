"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { UserRole, UserStatus } from "@vetralink/shared-types";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { getWorkspaceShellMessages } from "@/lib/i18n/workspace-shell";
export function WorkspaceGate({
  allowedRoles,
  requireFarmerSetupComplete = false,
  children,
}: {
  allowedRoles?: readonly UserRole[];
  requireFarmerSetupComplete?: boolean;
  children: ReactNode;
}) {
  const auth = useAuth(),
    t = getWorkspaceShellMessages(auth.locale),
    router = useRouter(),
    pathname = usePathname(),
    query = useSearchParams().toString();
  const setup =
    !auth.error &&
    requireFarmerSetupComplete &&
    auth.user?.role === UserRole.FARMER &&
    auth.user.farmerOnboardingRequired;
  const authorized =
    !!auth.user &&
    auth.user.status === UserStatus.ACTIVE &&
    (!allowedRoles || allowedRoles.includes(auth.user.role));
  const key = auth.user
    ? `${auth.user.id}:${auth.user.role}:${auth.user.roleVersion ?? 0}:${auth.user.farmerOnboardingRequired ?? false}`
    : "";
  const visible = authorized && !auth.checking && !auth.error && !setup,
    previouslyAuthorized = useRef("");
  if (visible) previouslyAuthorized.current = key;
  useEffect(() => {
    if (!auth.checking && !auth.error && setup)
      router.replace("/account/farm-onboarding");
  }, [setup, auth.checking, auth.error, router]);
  let feedback: ReactNode = null;
  if (auth.checking || setup)
    feedback = (
      <p role="status" aria-live="polite">
        {t.loading}
      </p>
    );
  else if (auth.error && auth.error !== "session_expired")
    feedback = (
      <Card>
        <CardHeader>
          <p role="alert">{t.unavailable}</p>
        </CardHeader>
        <CardContent>
          <Button onClick={() => void auth.restore()}>{t.retry}</Button>
        </CardContent>
      </Card>
    );
  else if (!auth.user)
    feedback = (
      <Card>
        <CardHeader>
          <h2>{t.signIn}</h2>
          <p>{t.signInBody}</p>
        </CardHeader>
        <CardContent>
          <Button
            data-workspace-sign-in
            onClick={() =>
              auth.open("login", query ? `${pathname}?${query}` : pathname)
            }
          >
            {auth.messages.signIn}
          </Button>
        </CardContent>
      </Card>
    );
  else if (!authorized)
    feedback = (
      <p data-workspace-denied role="alert">
        {t.denied}
      </p>
    );
  // Revalidation hides interaction and data but keeps the same account's drafts
  // mounted. Confirmed account/role/version changes discard the old subtree.
  return (
    <>
      {feedback}
      {authorized && previouslyAuthorized.current === key && (
        <div key={key} hidden={!visible}>
          {children}
        </div>
      )}
    </>
  );
}
