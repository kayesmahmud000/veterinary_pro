import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <SiteHeader />
      {children}
      <SiteFooter />
    </>
  );
}
