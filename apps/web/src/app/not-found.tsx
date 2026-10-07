import { cn } from "@/lib/ui/cn";
import siteStyles from "@/lib/ui/site.styles";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { getLocalization } from "@/lib/i18n/server";
import { formatNumber } from "@/lib/i18n/locale";
export default function NotFound() {
  const { locale, messages } = getLocalization();
  return (
    <>
      <a className={cn(siteStyles["skip-link"])} href="#main-content">
        {messages.navigation.skip}
      </a>
      <SiteHeader />
      <main id="main-content" className={cn(siteStyles["container"], siteStyles["not-found"])}>
        <div className={cn(siteStyles["eyebrow"])}>
          {formatNumber(404, locale)} / {messages.notFound.eyebrow}
        </div>
        <h1>{messages.notFound.heading}</h1>
        <p>{messages.notFound.body}</p>
        <Link className={cn(siteStyles["button"])} href="/">
          <ArrowLeft size={18} aria-hidden="true" /> {messages.actions.home}
        </Link>
      </main>
      <SiteFooter />
    </>
  );
}
