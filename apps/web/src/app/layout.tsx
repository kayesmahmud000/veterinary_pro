import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "Vetralink Pro — Connected care for your farm",
    template: "%s | Vetralink Pro",
  },
  description:
    "Discover connected livestock records, practical learning and veterinary care with Vetralink Pro.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
