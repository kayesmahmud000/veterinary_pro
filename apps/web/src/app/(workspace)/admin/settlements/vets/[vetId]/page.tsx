import { AdminSettlements } from "@/components/workspace/admin-settlements";
import {getFinanceMessages} from "@/lib/i18n/admin-finance";
import {getLocalization} from "@/lib/i18n/server";
import {notFound} from "next/navigation";
import {z} from "zod";
export function generateMetadata(){return {title:getFinanceMessages(getLocalization().locale).settlements};}
export default function Page({params}:{params:{vetId:string}}){if(!z.string().uuid().safeParse(params.vetId).success)notFound();return <AdminSettlements vetId={params.vetId}/>;}
