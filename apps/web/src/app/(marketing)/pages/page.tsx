import { PublishedCatalog } from "@/components/marketing/published-content";
import { PublicPage } from "@/components/marketing/public-page";
import { getLocalization } from "@/lib/i18n/server";
import { communicationsMessages } from "@/lib/i18n/admin-communications";
export default function Page({
  searchParams,
}: {
  searchParams: { q?: string; cursor?: string };
}) {
  const { locale } = getLocalization();
  const t = communicationsMessages(locale);
  return (
    <PublicPage
      title={t.publicContent}
      description=""
      eyebrow={t.publicContent}
    >
      <PublishedCatalog
        kind="PAGE"
        search={searchParams.q}
        cursor={searchParams.cursor}
      />
    </PublicPage>
  );
}
