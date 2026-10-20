import type { Metadata } from "next";
import { ProductOverview } from "@/components/marketing/product-overview";
import { getLocalization } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { messages } = (await getLocalization());
  return {
    title: messages.pages.farm.metadataTitle,
    description: messages.pages.farm.metadataDescription,
  };
}

export default async function FarmManagementPage() {
  const { messages } = (await getLocalization());
  return <ProductOverview kind="farm" {...messages.pages.farm} />;
}
