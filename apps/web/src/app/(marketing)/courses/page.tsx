import { CourseCatalog } from "@/components/courses/course-catalog";
import {getCourseMessages} from "@/lib/i18n/courses";
import {getLocalization} from "@/lib/i18n/server";
import {notFound} from "next/navigation";
import {z} from "zod";
export function generateMetadata(){return {title:getCourseMessages(getLocalization().locale).courses};}
export default function Page(){return <CourseCatalog/>;}
