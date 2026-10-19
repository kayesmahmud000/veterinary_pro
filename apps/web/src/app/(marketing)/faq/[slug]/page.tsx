import { PublishedDetail } from "@/components/marketing/published-content";
export default function Page({ params }: { params: { slug: string } }) {
  return <PublishedDetail kind="FAQ" slug={params.slug} />;
}
