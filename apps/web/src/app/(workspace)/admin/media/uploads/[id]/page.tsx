import { notFound } from "next/navigation";
import { z } from "zod";
import { AdminMedia } from "@/components/workspace/admin-media";
import { getCatalogMessages } from "@/lib/i18n/admin-catalog";
import { getLocalization } from "@/lib/i18n/server";

export async function generateMetadata() {
  return { title: getCatalogMessages((await getLocalization()).locale).media };
}

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!z.string().uuid().safeParse(params.id).success) notFound();
  return <AdminMedia id={params.id} />;
}
