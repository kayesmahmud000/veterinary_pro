import { AdminDirectory } from "@/components/workspace/admin-directory";
import { getDirectoryMessages } from "@/lib/i18n/admin-directory";
import { getLocalization } from "@/lib/i18n/server";
export async function generateMetadata() { return { title: getDirectoryMessages((await getLocalization()).locale).veterinarians }; }
export default function Page() { return <AdminDirectory kind="veterinarians" />; }
