import { AdminContent } from "@/components/workspace/admin-communications";
export default function Page({ params }: { params: { id: string } }) {
  return <AdminContent id={params.id} />;
}
