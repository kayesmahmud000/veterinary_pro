import { cn } from "@/lib/ui/cn";
import siteStyles from "@/lib/ui/site.styles";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/marketing/site-header";
import { getLocalization } from "@/lib/i18n/server";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };
export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { messages } = getLocalization();
  return (
    <>
      <a className={cn(siteStyles["skip-link"])} href="#main-content">
        {messages.navigation.skip}
      </a>
      <SiteHeader />
      {children}
    </>
  );
}
