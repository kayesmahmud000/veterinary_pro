import { CourseDetail } from "@/components/courses/course-detail";
import {getCourseMessages} from "@/lib/i18n/courses";
import {getLocalization} from "@/lib/i18n/server";
import {notFound} from "next/navigation";
import {decodeCourseSlugSegment} from "@vetralink/shared-types";
export function generateMetadata(){return {title:getCourseMessages(getLocalization().locale).courses};}
export default function Page({params}:{params:{slug:string}}){const slug=decodeCourseSlugSegment(params.slug);if(slug===null)notFound();return <CourseDetail slug={slug}/>;}
