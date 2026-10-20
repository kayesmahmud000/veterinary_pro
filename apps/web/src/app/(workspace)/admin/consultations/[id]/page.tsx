import { AdminConsultations } from "@/components/workspace/admin-consultations";
import { getConsultationMessages } from "@/lib/i18n/admin-consultations";
import { getLocalization } from "@/lib/i18n/server";
import { notFound } from "next/navigation";
import { z } from "zod";
export async function generateMetadata() {
  return {
    title: getConsultationMessages((await getLocalization()).locale).consultations,
  };
}
export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!z.string().uuid().safeParse(params.id).success) notFound();
  return <AdminConsultations section="consultations" id={params.id} />;
}
