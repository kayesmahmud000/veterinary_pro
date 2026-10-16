import { AdminSettlements } from "@/components/workspace/admin-settlements";
import {getFinanceMessages} from "@/lib/i18n/admin-finance";
import {getLocalization} from "@/lib/i18n/server";
export function generateMetadata(){return {title:getFinanceMessages(getLocalization().locale).settlements};}
export default function Page(){return <AdminSettlements/>;}
