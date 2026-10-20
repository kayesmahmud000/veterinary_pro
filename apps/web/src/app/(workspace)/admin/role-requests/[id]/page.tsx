import { Workspace } from "@/components/workspace/workspace";
import { getLocalization } from "@/lib/i18n/server";
import { workspaceBn, workspaceEn } from "@/lib/i18n/workspace";
export async function generateMetadata() {
  const { locale } = (await getLocalization());
  return { title: (locale === "bn" ? workspaceBn : workspaceEn).reviewTitle };
}
export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { locale } = (await getLocalization());
  return <Workspace view="review" locale={locale} id={params.id} />;
}
