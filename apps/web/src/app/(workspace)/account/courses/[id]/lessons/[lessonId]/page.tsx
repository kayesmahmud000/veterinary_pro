import { CoursePlayer } from "@/components/courses/course-player";
import {getCourseMessages} from "@/lib/i18n/courses";
import {getLocalization} from "@/lib/i18n/server";
import {notFound} from "next/navigation";
import {z} from "zod";
export function generateMetadata(){return {title:getCourseMessages(getLocalization().locale).courses};}
export default function Page({params}:{params:{id:string;lessonId:string}}){if(!z.string().uuid().safeParse(params.id).success||!z.string().uuid().safeParse(params.lessonId).success)notFound();return <CoursePlayer id={params.id} lessonId={params.lessonId}/>;}
