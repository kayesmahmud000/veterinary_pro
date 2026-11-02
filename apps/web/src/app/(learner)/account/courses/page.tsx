import { CourseLibrary } from "@/components/courses/course-library";
import { getCourseMessages } from "@/lib/i18n/courses";
import { getLocalization } from "@/lib/i18n/server";
import { notFound } from "next/navigation";
import { z } from "zod";
export async function generateMetadata() {
  return { title: getCourseMessages((await getLocalization()).locale).library };
}
export default function Page() {
  return <CourseLibrary />;
}
