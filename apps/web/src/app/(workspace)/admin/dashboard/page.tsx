import { AdminDashboard } from "@/components/workspace/admin-dashboard";
import { getAdminMessages } from "@/lib/i18n/admin";
import { getLocalization } from "@/lib/i18n/server";

export async function generateMetadata() {
  return { title: getAdminMessages((await getLocalization()).locale).title };
}
export default function Page() {
  return <AdminDashboard />;
}
