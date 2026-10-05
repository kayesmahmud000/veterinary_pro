import Link from "next/link";
import { Sprout, ArrowUpRight } from "lucide-react";
import { PUBLIC_NAV_ITEMS } from "@/lib/public-navigation";
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-top">
        <div>
          <Link className="brand" href="/">
            <Sprout aria-hidden="true" /> vetralink
            <span className="brand-pro">PRO</span>
          </Link>
          <p>
            Connected knowledge.
            <br />
            Healthier animals. Stronger farms.
          </p>
        </div>
        <nav aria-label="Footer navigation">
          {PUBLIC_NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
              <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          ))}
        </nav>
      </div>
      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} Vetralink Pro</span>
        <span>Built around the people who care for animals.</span>
      </div>
    </footer>
  );
}
