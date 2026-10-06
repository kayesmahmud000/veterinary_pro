import Link from "next/link";
import { Sprout, ArrowUpRight } from "lucide-react";
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
    <footer className="site-footer">
      <div className="container footer-top">
        <div>
          <Link
            className="brand"
            href="/"
            aria-label={messages.navigation.home}
          >
            <Sprout aria-hidden="true" /> vetralink
            <span className="brand-pro">PRO</span>
          </Link>
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
      <div className="container footer-bottom">
        <span>
          © {formatNumber(Number(year), locale, { useGrouping: false })}{" "}
          Vetralink Pro
        </span>
        <span>{messages.footer.people}</span>
      </div>
    </footer>
  );
}
