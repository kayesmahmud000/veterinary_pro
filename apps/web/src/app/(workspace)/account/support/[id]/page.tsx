import { SupportWorkspace } from "@/components/workspace/admin-communications";
export default function Page({ params }: { params: { id: string } }) {
  return <SupportWorkspace own id={params.id} />;
}
