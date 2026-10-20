import { AdminReviews } from "@/components/workspace/admin-reviews";
import { getFinanceMessages } from "@/lib/i18n/admin-finance";
import { getLocalization } from "@/lib/i18n/server";
export async function generateMetadata() {
  return { title: getFinanceMessages((await getLocalization()).locale).reviews };
}
export default function Page() {
  return <AdminReviews />;
}
