import { FarmPage } from "@/components/workspace/farm-page";
import { getLocalization } from "@/lib/i18n/server";
import { getWorkspaceShellMessages } from "@/lib/i18n/workspace-shell";
export function generateMetadata() {
  return { title: getWorkspaceShellMessages(getLocalization().locale).animals };
}
export default function Page() {
  return <FarmPage view="animals" />;
}
