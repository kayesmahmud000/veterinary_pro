import type { Metadata } from "next";
import { ProductOverview } from "@/components/marketing/product-overview";
import { getLocalization } from "@/lib/i18n/server";

export function generateMetadata(): Metadata {
  const { messages } = getLocalization();
  return {
    title: messages.pages.veterinary.metadataTitle,
    description: messages.pages.veterinary.metadataDescription,
  };
}

export default function VeterinaryCarePage() {
  const { messages } = getLocalization();
  return <ProductOverview {...messages.pages.veterinary} />;
}
