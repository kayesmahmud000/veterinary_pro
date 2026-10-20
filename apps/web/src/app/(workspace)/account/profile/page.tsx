import { AccountProfile } from "@/components/workspace/account-profile";
import { getLocalization } from "@/lib/i18n/server";
import { getWorkspaceShellMessages } from "@/lib/i18n/workspace-shell";
export async function generateMetadata() {
  return { title: getWorkspaceShellMessages((await getLocalization()).locale).profile };
}
export default function Page() {
  return <AccountProfile />;
}
