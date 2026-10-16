import { AdminConsultations } from "@/components/workspace/admin-consultations";
import { getConsultationMessages } from "@/lib/i18n/admin-consultations";
import { getLocalization } from "@/lib/i18n/server";
import { notFound } from "next/navigation";
import { z } from "zod";
export function generateMetadata() {
  return {
    title: getConsultationMessages(getLocalization().locale).consultations,
  };
}
export default function Page({ params }: { params: { id: string } }) {
  if (!z.string().uuid().safeParse(params.id).success) notFound();
  return <AdminConsultations section="consultations" id={params.id} />;
}
