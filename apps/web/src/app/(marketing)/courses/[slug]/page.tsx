import { CourseDetail } from "@/components/courses/course-detail";
import {getCourseMessages} from "@/lib/i18n/courses";
import {getLocalization} from "@/lib/i18n/server";
import {notFound} from "next/navigation";
<<<<<<< HEAD
import {z} from "zod";
export async function generateMetadata(){return {title:getCourseMessages((await getLocalization()).locale).courses};}
export default async function Page(props:{params: Promise<{slug:string}>}) {
  const params = await props.params;
  if(!z.string().min(3).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).safeParse(params.slug).success)notFound();return <CourseDetail slug={params.slug}/>;
}
=======
import {decodeCourseSlugSegment} from "@vetralink/shared-types";
export function generateMetadata(){return {title:getCourseMessages(getLocalization().locale).courses};}
export default function Page({params}:{params:{slug:string}}){const slug=decodeCourseSlugSegment(params.slug);if(slug===null)notFound();return <CourseDetail slug={slug}/>;}
>>>>>>> f0dbce1bf6a67d4b4ab0e96331522ac1cc8df952
