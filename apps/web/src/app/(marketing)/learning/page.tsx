import Link from "next/link";
import {getCourseMessages} from "@/lib/i18n/courses";
import type { Metadata } from "next";
import { ProductOverview } from "@/components/marketing/product-overview";
import { getLocalization } from "@/lib/i18n/server";
import { ResourceCatalog } from "@/components/marketing/resource-catalog";

export async function generateMetadata(): Promise<Metadata> {
  const { messages } = (await getLocalization());
  return {
    title: messages.pages.learning.metadataTitle,
    description: messages.pages.learning.metadataDescription,
  };
}

export default async function LearningPage(
  props: {
    searchParams: Promise<{ topic?: string | string[] }>;
  }
) {
  const searchParams = await props.searchParams;
  const { messages, locale } = (await getLocalization());
  const topic =
    typeof searchParams.topic === "string" ? searchParams.topic : undefined;
  return (
    <ProductOverview kind="learning" {...messages.pages.learning}>
      <p className="px-6 py-6"><Link href="/courses" className="font-semibold text-green underline underline-offset-4">{getCourseMessages(locale).browse}</Link></p>
      <ResourceCatalog
        copy={messages.resources}
        locale={locale}
        topic={topic}
      />
    </ProductOverview>
  );
}
