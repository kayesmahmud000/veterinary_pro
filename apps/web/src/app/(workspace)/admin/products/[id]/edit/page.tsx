import { AdminProducts } from "@/components/workspace/admin-products";
import { getCatalogMessages } from "@/lib/i18n/admin-catalog";
import { getLocalization } from "@/lib/i18n/server";
import { notFound } from "next/navigation";
import { z } from "zod";
export function generateMetadata() {
  return { title: getCatalogMessages(getLocalization().locale).edit };
}
export default function Page({ params }: { params: { id: string } }) {
  if (!z.string().uuid().safeParse(params.id).success) notFound();
  return <AdminProducts view="edit" id={params.id} />;
}
