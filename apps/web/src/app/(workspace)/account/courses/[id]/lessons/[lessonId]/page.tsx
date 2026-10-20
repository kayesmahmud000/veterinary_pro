import { CoursePlayer } from "@/components/courses/course-player";
import {getCourseMessages} from "@/lib/i18n/courses";
import {getLocalization} from "@/lib/i18n/server";
import {notFound} from "next/navigation";
import {z} from "zod";
export async function generateMetadata(){return {title:getCourseMessages((await getLocalization()).locale).courses};}
export default async function Page(props:{params: Promise<{id:string;lessonId:string}>}) {
  const params = await props.params;
  if(!z.string().uuid().safeParse(params.id).success||!z.string().uuid().safeParse(params.lessonId).success)notFound();return <CoursePlayer id={params.id} lessonId={params.lessonId}/>;
}
