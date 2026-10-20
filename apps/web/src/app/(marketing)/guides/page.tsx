import { PublishedCatalog } from "@/components/marketing/published-content";
import { PublicPage } from "@/components/marketing/public-page";
import { getLocalization } from "@/lib/i18n/server";
import { communicationsMessages } from "@/lib/i18n/admin-communications";
export default async function Page(
  props: {
    searchParams: Promise<{ q?: string; cursor?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const { locale } = (await getLocalization());
  const t = communicationsMessages(locale);
  return (
    <PublicPage
      title={t.publicContent}
      description=""
      eyebrow={t.publicContent}
    >
      <PublishedCatalog
        kind="GUIDE"
        search={searchParams.q}
        cursor={searchParams.cursor}
      />
    </PublicPage>
  );
}
