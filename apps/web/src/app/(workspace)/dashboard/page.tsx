import { DashboardHome } from "@/components/workspace/dashboard-home";
import { getLocalization } from "@/lib/i18n/server";
import { getWorkspaceShellMessages } from "@/lib/i18n/workspace-shell";
export function generateMetadata() {
  return {
    title: getWorkspaceShellMessages(getLocalization().locale).dashboard,
  };
}
export default function Page() {
  return <DashboardHome />;
}
