import { notFound } from "next/navigation";
import { z } from "zod";
import { AdminCourseWizard } from "@/components/workspace/admin-course-wizard";
import { getAdminCourseMessages } from "@/lib/i18n/admin-courses";
import { getLocalization } from "@/lib/i18n/server";

export async function generateMetadata() {
  return { title: getAdminCourseMessages((await getLocalization()).locale).heading };
}

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!z.string().uuid().safeParse(params.id).success) notFound();
  return <AdminCourseWizard id={params.id} />;
}
