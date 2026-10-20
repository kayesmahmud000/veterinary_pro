import { AdminProducts } from "@/components/workspace/admin-products";
import { getCatalogMessages } from "@/lib/i18n/admin-catalog";
import { getLocalization } from "@/lib/i18n/server";
export async function generateMetadata() {
  return { title: getCatalogMessages((await getLocalization()).locale).products };
}
export default function Page() {
  return <AdminProducts />;
}
