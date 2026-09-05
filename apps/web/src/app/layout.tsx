import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "VETRALINK PRO — Farm SaaS ERP, LMS & Tele-Veterinary",
  description: "Enterprise multi-tenant AgTech platform",
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
