import type { Messages } from "./i18n/en";

export type PublicNavItem = { label: string; href: string };
export function getPublicNavItems(
  messages: Messages,
): readonly PublicNavItem[] {
  return [
    { label: messages.navigation.farm, href: "/farm-management" },
    { label: messages.navigation.learning, href: "/learning" },
    { label: messages.navigation.veterinary, href: "/veterinary-care" },
  ];
}
