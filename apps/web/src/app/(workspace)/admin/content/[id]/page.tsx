import { AdminContent } from "@/components/workspace/admin-communications";
export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return <AdminContent id={params.id} />;
}
