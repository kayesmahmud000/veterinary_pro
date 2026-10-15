import { notFound } from "next/navigation";
import { z } from "zod";
import { AdminMedia } from "@/components/workspace/admin-media";
import { getCatalogMessages } from "@/lib/i18n/admin-catalog";
import { getLocalization } from "@/lib/i18n/server";

export function generateMetadata() {
  return { title: getCatalogMessages(getLocalization().locale).media };
}

export default function Page({ params }: { params: { id: string } }) {
  if (!z.string().uuid().safeParse(params.id).success) notFound();
  return <AdminMedia id={params.id} />;
}
