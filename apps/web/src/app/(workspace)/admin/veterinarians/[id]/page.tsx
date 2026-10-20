import { AdminDirectory } from "@/components/workspace/admin-directory";
import { getDirectoryMessages } from "@/lib/i18n/admin-directory";
import { getLocalization } from "@/lib/i18n/server";
import { notFound } from "next/navigation";
import { z } from "zod";
export async function generateMetadata() { return { title: getDirectoryMessages((await getLocalization()).locale).veterinarians }; }
export default async function Page(props: {params: Promise<{id:string}>}) {
  const params = await props.params;
  if(!z.string().uuid().safeParse(params.id).success) notFound();return <AdminDirectory kind="veterinarians" id={params.id} />;
}
