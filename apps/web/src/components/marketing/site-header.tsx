import { cn } from "@/lib/ui/cn";
import siteStyles from "@/lib/ui/site.styles";
import Link from "next/link";
import { SiteBrand } from "@/components/brand/site-brand";
import { AuthControls } from "@/components/auth/auth-controls";
import { getPublicNavGroups, getPublicNavItems } from "@/lib/public-navigation";
import { getLocalization } from "@/lib/i18n/server";
import { MobileNavigation } from "./mobile-navigation";
import { LanguageSwitcher } from "./language-switcher";
import { HeaderSurface } from "./header-surface";
import { DesktopNavigation } from "./desktop-navigation";

export function SiteHeader() {
  const { locale, messages } = getLocalization();
  const items = getPublicNavGroups(messages);
  return (
    <HeaderSurface>
      <div className={cn(siteStyles["container"], siteStyles["header-inner"])}>
        <SiteBrand
          homeLabel={messages.navigation.home}
          name={messages.brand.name}
        />
        <DesktopNavigation items={items} label={messages.navigation.main} />
        <div className="flex shrink-0 items-center gap-3 max-[1000.01px]:gap-2">
          <LanguageSwitcher
            locale={locale}
            label={messages.navigation.language}
          />
          <AuthControls />
        </div>
        <MobileNavigation items={items} labels={messages.navigation} />
      </div>
      <noscript>
        <nav
          aria-label={messages.navigation.main}
          className="grid grid-cols-2 gap-2 border-x-0 border-t border-b-0 border-solid border-line bg-white px-6 py-4 text-ink md:grid-cols-3"
        >
          {getPublicNavItems(messages).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex min-h-11 items-center text-sm"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </noscript>
    </HeaderSurface>
  );
}
