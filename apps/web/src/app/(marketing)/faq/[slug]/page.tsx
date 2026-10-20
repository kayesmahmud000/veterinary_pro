import { PublishedDetail } from "@/components/marketing/published-content";
export default async function Page(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  return <PublishedDetail kind="FAQ" slug={params.slug} />;
}
