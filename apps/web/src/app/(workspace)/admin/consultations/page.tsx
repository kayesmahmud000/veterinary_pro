import { AdminConsultations } from "@/components/workspace/admin-consultations";
import { getConsultationMessages } from "@/lib/i18n/admin-consultations";
import { getLocalization } from "@/lib/i18n/server";
export async function generateMetadata() {
  return {
    title: getConsultationMessages((await getLocalization()).locale).consultations,
  };
}
export default function Page() {
  return <AdminConsultations section="consultations" />;
}
