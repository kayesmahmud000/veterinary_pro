import { Workspace } from "@/components/workspace/workspace";
import { getLocalization } from "@/lib/i18n/server";
import { workspaceBn, workspaceEn } from "@/lib/i18n/workspace";
export function generateMetadata() {
  const { locale } = getLocalization();
  return { title: (locale === "bn" ? workspaceBn : workspaceEn).reviewTitle };
}
export default function Page({ params }: { params: { id: string } }) {
  const { locale } = getLocalization();
  return <Workspace view="review" locale={locale} id={params.id} />;
}
