import { AdminDirectory } from "@/components/workspace/admin-directory";
import { getDirectoryMessages } from "@/lib/i18n/admin-directory";
import { getLocalization } from "@/lib/i18n/server";
import { notFound } from "next/navigation";
import { z } from "zod";
export function generateMetadata() { return { title: getDirectoryMessages(getLocalization().locale).veterinarians }; }
export default function Page({ params }: {params:{id:string}}) { if(!z.string().uuid().safeParse(params.id).success) notFound(); return <AdminDirectory kind="veterinarians" id={params.id} />; }
