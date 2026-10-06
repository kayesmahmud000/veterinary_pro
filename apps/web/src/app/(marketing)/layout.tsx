import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { getLocalization } from "@/lib/i18n/server";
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { messages } = getLocalization();
  return (
    <>
      <a className="skip-link" href="#main-content">
        {messages.navigation.skip}
      </a>
      <SiteHeader />
      {children}
      <SiteFooter />
    </>
  );
}
