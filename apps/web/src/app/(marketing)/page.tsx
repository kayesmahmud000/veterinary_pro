import type { Metadata } from "next";
import { LandingSections } from "@/components/marketing/landing-sections";
import { getLocalization } from "@/lib/i18n/server";
export function generateMetadata(): Metadata {
  const { messages } = getLocalization();
  return {
    title: { absolute: messages.metadata.homeTitle },
    description: messages.metadata.homeDescription,
  };
}
export default function HomePage() {
  return (
    <main id="main-content">
      <LandingSections />
    </main>
  );
}
