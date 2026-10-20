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
export async function generateMetadata(props: { params: Promise<{ kind: string }> }) {
  const params = await props.params;
  return {
    title: getBillingMessages((await getLocalization()).locale)[kind(params.kind)],
  };
}
export default async function Page(
  props: {
    params: Promise<{ kind: string; id: string }>;
  }
) {
  const params = await props.params;
  if (!z.string().uuid().safeParse(params.id).success) notFound();
  return <AdminBilling kind={kind(params.kind)} id={params.id} />;
}
