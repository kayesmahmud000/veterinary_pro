import { AdminBilling } from "@/components/workspace/admin-billing";
import { billingKinds, type BillingKind } from "@vetralink/shared-types";
import { getBillingMessages } from "@/lib/i18n/admin-billing";
import { getLocalization } from "@/lib/i18n/server";
import { notFound } from "next/navigation";
import { z } from "zod";
function kind(value: string): BillingKind {
  if (!billingKinds.includes(value as BillingKind)) notFound();
  return value as BillingKind;
}
export function generateMetadata({ params }: { params: { kind: string } }) {
  return {
    title: getBillingMessages(getLocalization().locale)[kind(params.kind)],
  };
}
export default function Page({
  params,
}: {
  params: { kind: string; id: string };
}) {
  if (!z.string().uuid().safeParse(params.id).success) notFound();
  return <AdminBilling kind={kind(params.kind)} id={params.id} />;
}
