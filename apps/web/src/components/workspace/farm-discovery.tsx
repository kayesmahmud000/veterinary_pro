"use client";
import Link from "next/link";
import { farmOnboardingStatusSchema, UserRole } from "@vetralink/shared-types";
import { useAuth } from "@/components/auth/auth-provider";
import { workspaceBn, workspaceEn } from "@/lib/i18n/workspace";
import { useRemote, Notice, option } from "./workspace-ui";
import styles from "./workspace.styles";
export function FarmDiscovery() {
  const auth = useAuth(),
    t = auth.locale === "bn" ? workspaceBn : workspaceEn,
    farms = useRemote("farms", farmOnboardingStatusSchema);
  if (farms.loading) return <Notice text={t.loading} t={t} />;
  if (farms.code)
    return (
      <>
        <Notice code={farms.code} t={t} />
        <button className={styles.secondary} onClick={farms.reload}>
          {t.retry}
        </button>
      </>
    );
  if (!farms.data?.farms.length)
    return (
      <>
        <Notice text={t.membershipRequired} t={t} />
        {auth.user?.role === UserRole.FARMER && (
          <Link className={styles.primary} href="/account/farm-onboarding">
            {t.setupTitle}
          </Link>
        )}
      </>
    );
  return (
    <ul
      data-farm-discovery
      className="grid list-none grid-cols-1 gap-4 p-0 min-[768px]:grid-cols-2"
    >
      {farms.data.farms.map((farm) => (
        <li className={styles.card} key={farm.id}>
          <h2 className="break-words">{farm.name}</h2>
          <p>
            {option(t, farm.farmType)} · {option(t, farm.role)}
          </p>
          <Link className={styles.primary} href={`/app/farms/${farm.id}`}>
            {auth.locale === "bn" ? "খামার খুলুন" : "Open farm"}
          </Link>
        </li>
      ))}
    </ul>
  );
}
