import Link from "next/link";
import { Sprout, ArrowUpRight } from "lucide-react";
import { PUBLIC_NAV_ITEMS } from "@/lib/public-navigation";
import { MobileNavigation } from "./mobile-navigation";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link href="/" className="brand" aria-label="Vetralink Pro home">
          <span className="brand-mark">
            <Sprout aria-hidden="true" />
          </span>
          <span>
            vetralink<span className="brand-pro">PRO</span>
          </span>
        </Link>
        <nav className="desktop-nav" aria-label="Main navigation">
          {PUBLIC_NAV_ITEMS.map((item) => (
            <Link href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <Link
          className="button button-small header-cta"
          href="/farm-management"
        >
          Explore farm tools <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
        <MobileNavigation items={PUBLIC_NAV_ITEMS} />
      </div>
    </header>
  );
}
