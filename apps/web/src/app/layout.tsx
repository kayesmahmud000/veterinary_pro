import type { Metadata } from "next";
import { getLocalization } from "@/lib/i18n/server";
import { AuthProvider } from "@/components/auth/auth-provider";
import "./globals.css";
export function generateMetadata(): Metadata {
  const { messages } = getLocalization();
  return {
    title: {
      default: messages.metadata.siteTitle,
      template: "%s | Vetralink Pro",
    },
    description: messages.metadata.siteDescription,
  };
}
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { locale, messages } = getLocalization();
  return (
    <html lang={locale}>
      <body>
        <AuthProvider messages={messages.auth}>{children}</AuthProvider>
      </body>
    </html>
  );
}
