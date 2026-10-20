import { AdminMedia } from "@/components/workspace/admin-media";
import { getCatalogMessages } from "@/lib/i18n/admin-catalog";
import { getLocalization } from "@/lib/i18n/server";
export async function generateMetadata() {
  return { title: getCatalogMessages((await getLocalization()).locale).media };
}
export default function Page() {
  return <AdminMedia />;
}
