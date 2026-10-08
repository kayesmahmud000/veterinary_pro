"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuTrigger,
  NavigationMenuContent,
  NavigationMenuLink,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import { cn } from "@/lib/ui/cn";
import siteStyles from "@/lib/ui/site.styles";
import {
  isPublicNavGroupActive,
  isPublicNavItemActive,
  type PublicNavGroup,
} from "@/lib/public-navigation";
import { usePublicNavLocation } from "./use-public-nav-location";

export function DesktopNavigation({
  items,
  label,
}: {
  items: readonly PublicNavGroup[];
  label: string;
}) {
  const { pathname, hash } = usePublicNavLocation();
  const [value, setValue] = useState("");
  useEffect(() => setValue(""), [pathname]);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1280px)");
    const close = () => setValue("");
    query.addEventListener("change", close);
    return () => query.removeEventListener("change", close);
  }, []);
  return (
    <NavigationMenu
      value={value}
      onValueChange={setValue}
      aria-label={label}
      className={cn(siteStyles["desktop-nav"])}
      delayDuration={150}
    >
      <NavigationMenuList>
        {items.map((item) => (
          <NavigationMenuItem
            key={item.href}
            value={item.href}
            className="relative"
          >
            {item.children ? (
              <>
                <NavigationMenuTrigger
                  data-active={
                    isPublicNavGroupActive(item, pathname, hash)
                      ? ""
                      : undefined
                  }
                  aria-current={
                    isPublicNavGroupActive(item, pathname, hash)
                      ? "location"
                      : undefined
                  }
                >
                  {item.label}
                </NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ul className="m-0 list-none p-0">
                    {item.children.map((child) => (
                      <li key={child.href}>
                        <NavigationMenuLink
                          asChild
                          active={isPublicNavItemActive(
                            child.href,
                            pathname,
                            hash,
                          )}
                        >
                          <Link
                            href={child.href}
                            onClick={() => setValue("")}
                            aria-current={
                              isPublicNavItemActive(child.href, pathname, hash)
                                ? child.href.includes("#")
                                  ? "location"
                                  : "page"
                                : undefined
                            }
                            className="flex min-h-12 items-center rounded-lg px-4 py-3 text-sm text-ink hover:bg-[#eff2eb] focus-visible:bg-[#eff2eb] data-[active]:!text-[#a26913]"
                          >
                            {child.label}
                          </Link>
                        </NavigationMenuLink>
                      </li>
                    ))}
                  </ul>
                </NavigationMenuContent>
              </>
            ) : (
              <NavigationMenuLink
                asChild
                active={isPublicNavItemActive(item.href, pathname, hash)}
              >
                <Link
                  href={item.href}
                  className={navigationMenuTriggerStyle}
                  aria-current={
                    isPublicNavItemActive(item.href, pathname, hash)
                      ? item.href.includes("#")
                        ? "location"
                        : "page"
                      : undefined
                  }
                >
                  {item.label}
                </Link>
              </NavigationMenuLink>
            )}
          </NavigationMenuItem>
        ))}
      </NavigationMenuList>
    </NavigationMenu>
  );
}
