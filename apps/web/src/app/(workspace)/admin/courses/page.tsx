import { AdminCourses } from "@/components/workspace/admin-products";
import { getAdminCourseMessages } from "@/lib/i18n/admin-courses";
import { getLocalization } from "@/lib/i18n/server";

export async function generateMetadata() {
  return { title: getAdminCourseMessages((await getLocalization()).locale).courses };
}

export default function Page() {
  return <AdminCourses />;
}
