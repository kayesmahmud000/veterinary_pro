"use client";
import { useAuth } from "@/components/auth/auth-provider";
import { getFarmMessages } from "@/lib/i18n/farm";
import {
  accessStatusSchema,
  quotaSchema,
} from "@/lib/workspace/farm-contracts";
import { useFarmContext } from "./farm-context";
import { useRemote } from "./workspace-ui";
import { Button } from "@/components/ui/button";
export function useFarmAccess() {
  const { farmId } = useFarmContext(),
    access = useRemote(`farms/${farmId}/access-status`, accessStatusSchema),
    quota = useRemote(`farms/${farmId}/quota`, quotaSchema);
  return {
    access,
    quota,
    canWrite: !access.loading && !access.code && access.data?.canWrite === true,
    canRegister:
      !access.loading &&
      !quota.loading &&
      !access.code &&
      !quota.code &&
      access.data?.canWrite === true &&
      quota.data?.quotas.animals.canAccommodate === true,
    canAddMember:
      !access.loading &&
      !quota.loading &&
      !access.code &&
      !quota.code &&
      access.data?.canWrite === true &&
      quota.data?.quotas.staff.canAccommodate === true,
    reload: () => {
      access.reload();
      quota.reload();
    },
  };
}
export function FarmWriteNotice({
  allowed,
  loading,
  quotaBlocked = false,
  staff = false,
  onRetry,
}: {
  allowed: boolean;
  loading: boolean;
  quotaBlocked?: boolean;
  staff?: boolean;
  onRetry: () => void;
}) {
  const { locale } = useAuth(),
    t = getFarmMessages(locale);
  if (allowed) return null;
  return (
    <div
      className="my-4 rounded-lg border border-solid border-line p-4"
      role="status"
    >
      <p className="mt-0 text-sm">
        {loading
          ? locale === "bn"
            ? "অ্যাক্সেস যাচাই হচ্ছে…"
            : "Checking access…"
          : quotaBlocked
            ? staff
              ? t.staffQuotaBlocked
              : t.quotaBlocked
            : t.writeBlocked}
      </p>
      <Button
        type="button"
        variant="outline"
        onClick={onRetry}
        disabled={loading}
      >
        {t.refresh}
      </Button>
    </div>
  );
}
