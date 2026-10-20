import type { Metadata } from "next";
import { LandingSections } from "@/components/marketing/landing-sections";
import { getLocalization } from "@/lib/i18n/server";
import { ProtectedEntry } from "@/components/auth/protected-entry";
import { readProtectedReturnTo } from "@/lib/workspace/navigation";
export async function generateMetadata(): Promise<Metadata> {
  const { messages } = (await getLocalization());
  return {
    title: { absolute: messages.metadata.homeTitle },
    description: messages.metadata.homeDescription,
  };
}
export default async function HomePage(
  props: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
  }
) {
  const searchParams = await props.searchParams;
  const returnTo = readProtectedReturnTo(
    searchParams.auth,
    searchParams.returnTo,
  );
  return (
    <main id="main-content">
      {returnTo && <ProtectedEntry key={returnTo} returnTo={returnTo} />}
      <LandingSections />
    </main>
  );
}
