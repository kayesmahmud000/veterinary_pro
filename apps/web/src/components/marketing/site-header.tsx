import Link from "next/link";
import { Sprout } from "lucide-react";
import { AuthControls } from "@/components/auth/auth-controls";
import { getPublicNavItems } from "@/lib/public-navigation";
import { getLocalization } from "@/lib/i18n/server";
import { MobileNavigation } from "./mobile-navigation";
import { LanguageSwitcher } from "./language-switcher";
import { HeaderSurface } from "./header-surface";

export function SiteHeader() {
  const { locale, messages } = getLocalization();
  const items = getPublicNavItems(messages);
  return (
    <HeaderSurface>
      <div className="container header-inner">
        <Link href="/" className="brand" aria-label={messages.navigation.home}>
          <span className="brand-mark">
            <Sprout aria-hidden="true" />
          </span>
          <span>
            vetralink<span className="brand-pro">PRO</span>
          </span>
        </Link>
        <nav className="desktop-nav" aria-label={messages.navigation.main}>
          {items.map((item) => (
            <Link href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <AuthControls />
        <LanguageSwitcher
          locale={locale}
          label={messages.navigation.language}
        />
        <MobileNavigation items={items} labels={messages.navigation} />
      </div>
    </HeaderSurface>
  );
}
