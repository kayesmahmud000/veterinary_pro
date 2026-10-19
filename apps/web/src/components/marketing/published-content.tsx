import Link from "next/link";
import {
  publicEditorialSchema,
  publicEditorialListSchema,
  type PublicEditorial,
} from "@vetralink/shared-types";
import { getLocalization } from "@/lib/i18n/server";
import { communicationsMessages } from "@/lib/i18n/admin-communications";
import { publishedEntries, publishedEntry } from "@/lib/editorial";
import { EditorialText } from "./editorial-text";
import { PublicPage } from "./public-page";
import { PublicNotFound } from "./public-not-found";
import { buttonVariants } from "../ui/button";
const bases: Record<string, string> = {
  BLOG: "/blog",
  PAGE: "/pages",
  FAQ: "/faq",
  GUIDE: "/guides",
  VET: "/doctors",
};
export function PublishedArticle({ entry }: { entry: PublicEditorial }) {
  const { locale } = getLocalization(),
    t = communicationsMessages(locale);
  return (
    <PublicPage
      title={entry.content[locale].title}
      description={entry.content[locale].summary}
      eyebrow={entry.verified ? t.verifiedPublic : t.publicContent}
    >
      <EditorialText content={entry.content} locale={locale} hideHeading />
      <Link
        className={buttonVariants({ variant: "outline" })}
        href={entry.kind === "FAQ" ? "/help" : bases[entry.kind]}
      >
        {t.back}
      </Link>
    </PublicPage>
  );
}
export async function PublishedDetail({
  kind,
  slug,
}: {
  kind: string;
  slug: string;
}) {
  const r = await publishedEntry(kind, slug),
    parsed = publicEditorialSchema.safeParse(r.data),
    { locale } = getLocalization(),
    t = communicationsMessages(locale);
  if (parsed.success) return <PublishedArticle entry={parsed.data} />;
  return r.status === 404 ? (
    <PublicNotFound />
  ) : (
    <PublicPage
      title={t.publicContent}
      description={t.unavailable}
      eyebrow={t.publicContent}
    >
      <p role="alert">{t.unavailable}</p>
    </PublicPage>
  );
}
export async function PublishedCatalog({
  kind,
  search,
  cursor,
  embedded = false,
}: {
  kind: string;
  search?: string;
  cursor?: string;
  embedded?: boolean;
}) {
  const values = {
      ...(search ? { search } : {}),
      ...(cursor ? { cursor } : {}),
    },
    result = await publishedEntries(kind, values),
    parsed = publicEditorialListSchema.safeParse(result.data),
    { locale } = getLocalization(),
    t = communicationsMessages(locale);
  if (
    embedded &&
    parsed.success &&
    !parsed.data.items.length &&
    !parsed.data.nextCursor
  )
    return null;
  return (
    <section className="my-8 space-y-5" data-published-catalog={kind}>
      <h2>{t.publicContent}</h2>
      {!parsed.success ? (
        <p role="alert">{t.unavailable}</p>
      ) : (
        <>
          {!parsed.data.items.length ? (
            <p>{t.empty}</p>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {parsed.data.items.map((r) => (
                <article
                  key={r.id}
                  className="min-w-0 rounded-2xl border border-solid border-line bg-white p-6 [overflow-wrap:anywhere]"
                >
                  <h3>
                    <Link
                      href={`${bases[kind]}/${r.slug}`}
                      className="hover:underline"
                    >
                      {r.content[locale].title}
                    </Link>
                  </h3>
                  {r.verified && (
                    <p className="text-sm font-semibold text-green">
                      {t.verifiedPublic}
                    </p>
                  )}
                  <p>{r.content[locale].summary}</p>
                </article>
              ))}
            </div>
          )}
          {parsed.data.nextCursor && (
            <Link
              className={buttonVariants({ variant: "outline" })}
              href={`${kind === "FAQ" ? "/help" : bases[kind]}?${new URLSearchParams({ ...(search ? { q: search } : {}), cursor: parsed.data.nextCursor })}`}
            >
              {t.next}
            </Link>
          )}
        </>
      )}
    </section>
  );
}
