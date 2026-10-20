import { Workspace } from "@/components/workspace/workspace";
import { getLocalization } from "@/lib/i18n/server";
import { workspaceBn, workspaceEn } from "@/lib/i18n/workspace";
export async function generateMetadata() {
  const { locale } = (await getLocalization());
  return {
    title: (locale === "bn" ? workspaceBn : workspaceEn).applicationsTitle,
  };
}
export default async function Page() {
  const { locale } = (await getLocalization());
  return <Workspace view="history" locale={locale} />;
}
