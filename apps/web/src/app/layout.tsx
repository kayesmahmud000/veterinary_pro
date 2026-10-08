import type { Metadata } from "next";
import { getLocalization } from "@/lib/i18n/server";
import { AuthProvider } from "@/components/auth/auth-provider";
import siteStyles from "@/lib/ui/site.styles";
import "./globals.css";
export function generateMetadata(): Metadata {
  const { messages } = getLocalization();
  return {
    title: {
      default: messages.metadata.siteTitle,
      template: `%s | ${messages.brand.name}`,
    },
    description: messages.metadata.siteDescription,
    icons: { icon: "/assets/brand/logo-green.jpeg", apple: "/assets/brand/logo-green.jpeg" },
  };
}
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { locale, messages } = getLocalization();
  return (
    <html lang={locale} className={siteStyles.document}>
      <body className={siteStyles.body}>
        <AuthProvider messages={messages.auth}>{children}</AuthProvider>
      </body>
    </html>
  );
}
