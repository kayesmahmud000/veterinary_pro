import type { Metadata } from "next";
import { ProductOverview } from "@/components/marketing/product-overview";
import { getLocalization } from "@/lib/i18n/server";

export function generateMetadata(): Metadata {
  const { messages } = getLocalization();
  return {
    title: messages.pages.learning.metadataTitle,
    description: messages.pages.learning.metadataDescription,
  };
}

export default function LearningPage() {
  const { messages } = getLocalization();
  return <ProductOverview {...messages.pages.learning} />;
}
