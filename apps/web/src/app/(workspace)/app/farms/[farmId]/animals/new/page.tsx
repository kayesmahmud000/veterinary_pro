import { FarmPage } from "@/components/workspace/farm-page";
import { getLocalization } from "@/lib/i18n/server";
import { getFarmMessages } from "@/lib/i18n/farm";
export function generateMetadata() {
  return { title: getFarmMessages(getLocalization().locale).newTitle };
}
export default function Page() {
  return <FarmPage view="new" />;
}
