import { AdminProducts } from "@/components/workspace/admin-products";
import { getCatalogMessages } from "@/lib/i18n/admin-catalog";
import { getLocalization } from "@/lib/i18n/server";
export function generateMetadata() {
  return { title: getCatalogMessages(getLocalization().locale).products };
}
export default function Page() {
  return <AdminProducts />;
}
