import { FarmPage } from "@/components/workspace/farm-page";
import { getLocalization } from "@/lib/i18n/server";
import { getFarmMessages } from "@/lib/i18n/farm";
export async function generateMetadata() {
  return { title: getFarmMessages((await getLocalization()).locale).detailTitle };
}
export default async function Page(props: { params: Promise<{ animalId: string }> }) {
  const params = await props.params;
  return <FarmPage view="detail" id={params.animalId} />;
}
