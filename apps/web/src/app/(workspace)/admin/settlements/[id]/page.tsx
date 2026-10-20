import { AdminSettlements } from "@/components/workspace/admin-settlements";
import { getFinanceMessages } from "@/lib/i18n/admin-finance";
import { getLocalization } from "@/lib/i18n/server";
import { notFound } from "next/navigation";
import { z } from "zod";
export async function generateMetadata() {
  return { title: getFinanceMessages((await getLocalization()).locale).settlements };
}
export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!z.string().uuid().safeParse(params.id).success) notFound();
  return <AdminSettlements id={params.id} />;
}
