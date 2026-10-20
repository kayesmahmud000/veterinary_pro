import { AdminReviews } from "@/components/workspace/admin-reviews";
import { getFinanceMessages } from "@/lib/i18n/admin-finance";
import { getLocalization } from "@/lib/i18n/server";
import { notFound } from "next/navigation";
import { z } from "zod";
export async function generateMetadata() {
  return { title: getFinanceMessages((await getLocalization()).locale).reviews };
}
export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!z.string().uuid().safeParse(params.id).success) notFound();
  return <AdminReviews id={params.id} />;
}
