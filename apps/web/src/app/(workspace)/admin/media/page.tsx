import { AdminMedia } from "@/components/workspace/admin-media";
import { getCatalogMessages } from "@/lib/i18n/admin-catalog";
import { getLocalization } from "@/lib/i18n/server";
export function generateMetadata() {
  return { title: getCatalogMessages(getLocalization().locale).media };
}
export default function Page() {
  return <AdminMedia />;
}
