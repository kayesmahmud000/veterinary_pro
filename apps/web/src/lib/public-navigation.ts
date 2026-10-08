import type { Messages } from "./i18n/en";

export type PublicNavItem = { label: string; href: string };
export type PublicNavGroup = PublicNavItem & {
  children?: readonly PublicNavItem[];
};
export function isPublicNavItemActive(
  href: string,
  pathname: string,
  hash: string,
) {
  const [path, fragment] = href.split("#");
  if (fragment !== undefined)
    return pathname === path && hash === `#${fragment}`;
  return (
    (pathname === path && !hash) ||
    (path !== "/" && pathname.startsWith(`${path}/`))
  );
}
export function isPublicNavGroupActive(
  item: PublicNavGroup,
  pathname: string,
  hash: string,
) {
  return item.children
    ? item.children.some((child) =>
        isPublicNavItemActive(child.href, pathname, hash),
      )
    : isPublicNavItemActive(item.href, pathname, hash);
}
export function getPublicNavGroups(
  messages: Messages,
): readonly PublicNavGroup[] {
  const t = messages.navigation;
  return [
    {
      label: t.farm,
      href: "/farm-management",
      children: [
        { label: t.farm, href: "/farm-management" },
        { label: t.demo, href: "/#farm-demo" },
      ],
    },
    {
      label: t.learning,
      href: "/learning",
      children: [
        { label: t.learning, href: "/learning" },
        { label: t.guides, href: "/learning#guides" },
      ],
    },
    { label: t.courses, href: "/learning#courses" },
    {
      label: t.veterinary,
      href: "/veterinary-care",
      children: [
        { label: t.veterinary, href: "/veterinary-care" },
        { label: t.doctors, href: "/doctors" },
      ],
    },
    { label: t.blog, href: "/blog" },
    { label: t.about, href: "/about" },
    { label: t.help, href: "/help" },
  ];
}
/** Flatten the same destination contract for footer and no-JavaScript access. */
export function getPublicNavItems(
  messages: Messages,
): readonly PublicNavItem[] {
  return getPublicNavGroups(messages).flatMap(
    (group) => group.children ?? [{ label: group.label, href: group.href }],
  );
}
