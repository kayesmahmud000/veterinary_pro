import type { Metadata } from "next";
import { ProductOverview } from "@/components/marketing/product-overview";
import { getLocalization } from "@/lib/i18n/server";
import { ResourceCatalog } from "@/components/marketing/resource-catalog";

export function generateMetadata(): Metadata {
  const { messages } = getLocalization();
  return {
    title: messages.pages.learning.metadataTitle,
    description: messages.pages.learning.metadataDescription,
  };
}

export default function LearningPage({
  searchParams,
}: {
  searchParams: { topic?: string | string[] };
}) {
  const { messages, locale } = getLocalization();
  const topic =
    typeof searchParams.topic === "string" ? searchParams.topic : undefined;
  return (
    <ProductOverview kind="learning" {...messages.pages.learning}>
      <ResourceCatalog
        copy={messages.resources}
        locale={locale}
        topic={topic}
      />
    </ProductOverview>
  );
}
