import { AdminCourses } from "@/components/workspace/admin-products";
import { getAdminCourseMessages } from "@/lib/i18n/admin-courses";
import { getLocalization } from "@/lib/i18n/server";

export function generateMetadata() {
  return { title: getAdminCourseMessages(getLocalization().locale).courses };
}

export default function Page() {
  return <AdminCourses />;
}
