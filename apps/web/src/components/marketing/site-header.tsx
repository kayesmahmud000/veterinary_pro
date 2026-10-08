import { cn } from "@/lib/ui/cn";
import siteStyles from "@/lib/ui/site.styles";
import Link from "next/link";
import { SiteBrand } from "@/components/brand/site-brand";
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
      <div className={cn(siteStyles["container"], siteStyles["header-inner"])}>
        <SiteBrand homeLabel={messages.navigation.home} name={messages.brand.name} />
        <nav className={cn(siteStyles["desktop-nav"])} aria-label={messages.navigation.main}>
          {items.map((item) => (
            <Link href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-3 max-[1000.01px]:gap-2">
          <LanguageSwitcher
            locale={locale}
            label={messages.navigation.language}
          />
          <AuthControls />
        </div>
        <MobileNavigation items={items} labels={messages.navigation} />
      </div>
    </HeaderSurface>
  );
}
