import type { Metadata } from "next";
import { ProductOverview } from "@/components/marketing/product-overview";
import { getLocalization } from "@/lib/i18n/server";

export function generateMetadata(): Metadata {
  const { messages } = getLocalization();
  return {
    title: messages.pages.farm.metadataTitle,
    description: messages.pages.farm.metadataDescription,
  };
}

export default function FarmManagementPage() {
  const { messages } = getLocalization();
  return <ProductOverview {...messages.pages.farm} />;
}
