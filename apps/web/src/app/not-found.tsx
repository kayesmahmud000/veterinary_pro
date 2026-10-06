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
      <a className="skip-link" href="#main-content">
        {messages.navigation.skip}
      </a>
      <SiteHeader />
      <main id="main-content" className="container not-found">
        <div className="eyebrow">
          {formatNumber(404, locale)} / {messages.notFound.eyebrow}
        </div>
        <h1>{messages.notFound.heading}</h1>
        <p>{messages.notFound.body}</p>
        <Link className="button" href="/">
          <ArrowLeft size={18} aria-hidden="true" /> {messages.actions.home}
        </Link>
      </main>
      <SiteFooter />
    </>
  );
}
