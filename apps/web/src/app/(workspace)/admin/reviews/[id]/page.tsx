import { AdminReviews } from "@/components/workspace/admin-reviews";
import {getFinanceMessages} from "@/lib/i18n/admin-finance";
import {getLocalization} from "@/lib/i18n/server";
import {notFound} from "next/navigation";
import {z} from "zod";
export function generateMetadata(){return {title:getFinanceMessages(getLocalization().locale).reviews};}
export default function Page({params}:{params:{id:string}}){if(!z.string().uuid().safeParse(params.id).success)notFound();return <AdminReviews id={params.id}/>;}
