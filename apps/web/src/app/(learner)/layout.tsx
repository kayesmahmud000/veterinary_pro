import type { Metadata } from "next";
import { getLocalization } from "@/lib/i18n/server";
import { LearnerHeader } from "@/components/courses/learner-header";
import siteStyles from "@/lib/ui/site.styles";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };
export default function LearnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { messages } = getLocalization();
  return (
    <div className="min-h-screen bg-white">
      <a className={siteStyles["skip-link"]} href="#main-content">
        {messages.navigation.skip}
      </a>
      <LearnerHeader
        brand={messages.brand.name}
        home={messages.navigation.home}
        language={messages.navigation.language}
      />
      <div className="mx-auto w-11/12 min-w-0">{children}</div>
    </div>
  );
}
