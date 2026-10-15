import { notFound } from "next/navigation";
import { z } from "zod";
import { AdminCourseCurriculum } from "@/components/workspace/admin-course-curriculum";
import { getAdminCourseMessages } from "@/lib/i18n/admin-courses";
import { getLocalization } from "@/lib/i18n/server";

export function generateMetadata() {
  return { title: getAdminCourseMessages(getLocalization().locale).heading };
}

export default function Page({ params }: { params: { id: string } }) {
  if (!z.string().uuid().safeParse(params.id).success) notFound();
  return <AdminCourseCurriculum id={params.id} courseWorkspace />;
}
