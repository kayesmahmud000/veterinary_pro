import { cn } from "@/lib/ui/cn";
import siteStyles from "@/lib/ui/site.styles";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { SiteBrand } from "@/components/brand/site-brand";
import { getPublicNavItems } from "@/lib/public-navigation";
import { getLocalization } from "@/lib/i18n/server";
import { formatNumber } from "@/lib/i18n/locale";
export function SiteFooter() {
  const { locale, messages } = getLocalization();
  const items = getPublicNavItems(messages);
  const year = new Date().toLocaleString("en-US", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
  });
  return (
    <footer className={cn(siteStyles["site-footer"])}>
      <div className={cn(siteStyles["container"], siteStyles["footer-top"])}>
        <div>
          <SiteBrand homeLabel={messages.navigation.home} name={messages.brand.name} />
          <p>
            {messages.footer.knowledge}
            <br />
            {messages.footer.farms}
          </p>
        </div>
        <nav aria-label={messages.navigation.footer}>
          {items.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
              <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          ))}
        </nav>
      </div>
      <div className={cn(siteStyles["container"], siteStyles["footer-bottom"])}>
        <span>
          © {formatNumber(Number(year), locale, { useGrouping: false })}{" "}
          {messages.brand.name}
        </span>
        <span>{messages.footer.people}</span>
      </div>
    </footer>
  );
}
