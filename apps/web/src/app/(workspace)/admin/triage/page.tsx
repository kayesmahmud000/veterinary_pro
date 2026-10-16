import { AdminConsultations } from "@/components/workspace/admin-consultations";
import { getConsultationMessages } from "@/lib/i18n/admin-consultations";
import { getLocalization } from "@/lib/i18n/server";
export function generateMetadata() {
  return { title: getConsultationMessages(getLocalization().locale).triage };
}
export default function Page() {
  return <AdminConsultations section="triage" />;
}
