import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getLocalization } from "@/lib/i18n/server";
import { formatNumber } from "@/lib/i18n/locale";
import siteStyles from "@/lib/ui/site.styles";
import { cn } from "@/lib/ui/cn";
import { buttonVariants } from "@/components/ui/button";

// Nested routes already receive the marketing header/footer from their layout.
export function PublicNotFound() {
  const { locale, messages } = getLocalization();
  return (
    <main
      id="main-content"
      className={cn(siteStyles.container, siteStyles["not-found"])}
    >
      <div className={siteStyles.eyebrow}>
        {formatNumber(404, locale)} / {messages.notFound.eyebrow}
      </div>
      <h1>{messages.notFound.heading}</h1>
      <p>{messages.notFound.body}</p>
      <Link href="/" className={buttonVariants()}>
        <ArrowLeft size={16} aria-hidden="true" />
        {messages.actions.home}
      </Link>
    </main>
  );
}
