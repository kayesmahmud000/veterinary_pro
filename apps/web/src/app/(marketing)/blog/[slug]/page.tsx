import Link from "next/link";
import { PublicNotFound } from "@/components/marketing/public-not-found";
import { ArrowLeft } from "lucide-react";
import { getLocalization } from "@/lib/i18n/server";
import { blogPosts, findBlogPost } from "@/lib/public-content";
import { PublicPage } from "@/components/marketing/public-page";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";

export function generateMetadata({ params }: { params: { slug: string } }) {
  const post = findBlogPost(params.slug);
  const { locale, messages } = getLocalization();
  if (!post)
    return {
      title: messages.notFound.title,
      description: messages.notFound.body,
      robots: { index: false, follow: true },
    };
  return {
    title: post.content[locale].title,
    description: post.content[locale].summary,
  };
}
export default function BlogArticlePage({
  params,
}: {
  params: { slug: string };
}) {
  const post = findBlogPost(params.slug);
  if (!post) return <PublicNotFound />;
  const { locale, messages } = getLocalization();
  const t = messages.publicPages;
  const article = post.content[locale];
  return (
    <PublicPage
      title={article.title}
      description={article.summary}
      eyebrow={t.topics[post.topic]}
    >
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_280px]">
        <article className="min-w-0">
          <div className="mb-8 flex flex-wrap gap-3 text-sm">
            <Badge>
              {t.author}: {post.author[locale]}
            </Badge>
            <Badge>
              {t.published}:{" "}
              <time dateTime={post.publishedAt} className="ml-1">
                {new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-BD", {
                  timeZone: "Asia/Dhaka",
                  dateStyle: "long",
                }).format(new Date(post.publishedAt))}
              </time>
            </Badge>
          </div>
          {article.sections.map((section) => (
            <section key={section.title} className="mb-9 max-w-4xl">
              <h2 className="!mb-4 !text-2xl !leading-relaxed">
                {section.title}
              </h2>
              <p className="text-lg leading-8">{section.body}</p>
            </section>
          ))}
          <Link href="/blog" className={buttonVariants({ variant: "outline" })}>
            <ArrowLeft size={16} aria-hidden="true" />
            {t.backBlog}
          </Link>
        </article>
        <aside className="self-start rounded-2xl border border-solid border-line bg-white p-6">
          <nav aria-label={t.related}>
            <h2 className="!mb-5 !text-xl">{t.related}</h2>
            {blogPosts
              .filter((p) => p.slug !== post.slug)
              .map((p) => (
                <Link
                  key={p.slug}
                  href={`/blog/${p.slug}`}
                  className="mb-3 block rounded-lg bg-paper p-4 text-sm leading-6 hover:underline"
                >
                  {p.content[locale].title}
                </Link>
              ))}
          </nav>
        </aside>
      </div>
    </PublicPage>
  );
}
