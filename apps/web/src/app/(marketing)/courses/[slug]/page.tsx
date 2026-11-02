import { CourseDetail } from "@/components/courses/course-detail";
import {getCourseMessages} from "@/lib/i18n/courses";
import {getLocalization} from "@/lib/i18n/server";
import {notFound} from "next/navigation";
import {decodeCourseSlugSegment} from "@vetralink/shared-types";
export async function generateMetadata(){return {title:getCourseMessages((await getLocalization()).locale).courses};}
export default async function Page(props:{params: Promise<{slug:string}>}) {
  const params = await props.params;
  const slug = decodeCourseSlugSegment(params.slug);
  if(slug === null)notFound();return <CourseDetail slug={slug}/>;
}
