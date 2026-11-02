import { notFound } from "next/navigation";
import { z } from "zod";
import { AdminCourseEnrollments } from "@/components/workspace/admin-course-enrollments";
import { getLocalization } from "@/lib/i18n/server";
import { getEnrollmentMessages } from "@/lib/i18n/admin-course-enrollments";
export async function generateMetadata() {
  return {
    title: getEnrollmentMessages((await getLocalization()).locale).title,
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  return (
    <main id="main-content" className="w-full min-w-0 p-4 sm:p-6">
      <AdminCourseEnrollments courseId={id} />
    </main>
  );
}
