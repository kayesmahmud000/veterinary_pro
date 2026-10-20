import { AdminProducts } from "@/components/workspace/admin-products";
import { getCatalogMessages } from "@/lib/i18n/admin-catalog";
import { getLocalization } from "@/lib/i18n/server";
import { notFound } from "next/navigation";
import { z } from "zod";
export async function generateMetadata() {
  return { title: getCatalogMessages((await getLocalization()).locale).products };
}
export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!z.string().uuid().safeParse(params.id).success) notFound();
  return <AdminProducts view="detail" id={params.id} />;
}
