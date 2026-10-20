import type { Metadata } from "next";
import { ProductOverview } from "@/components/marketing/product-overview";
import { getLocalization } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { messages } = (await getLocalization());
  return {
    title: messages.pages.veterinary.metadataTitle,
    description: messages.pages.veterinary.metadataDescription,
  };
}

export default async function VeterinaryCarePage() {
  const { messages } = (await getLocalization());
  return <ProductOverview kind="veterinary" {...messages.pages.veterinary} />;
}
