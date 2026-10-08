import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getLocalization } from "@/lib/i18n/server";
import { formatNumber } from "@/lib/i18n/locale";
import {
  filterBlogPosts,
  textQuery,
  type BlogTopic,
} from "@/lib/public-content";
import { PublicPage, EmptyResults } from "@/components/marketing/public-page";
import { PublicFilters } from "@/components/marketing/public-filters";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";

export function generateMetadata() {
  const { messages } = getLocalization();
  return {
    title: messages.navigation.blog,
    description: messages.publicPages.blog.description,
  };
}
export default function BlogPage({
  searchParams,
}: {
  searchParams: { q?: string | string[]; topic?: string | string[] };
}) {
  const { messages, locale } = getLocalization();
  const t = messages.publicPages;
  const posts = filterBlogPosts({ ...searchParams, locale });
  const topics = Object.keys(t.topics) as BlogTopic[];
  const topic =
    typeof searchParams.topic === "string" &&
    topics.some((k) => k === searchParams.topic)
      ? searchParams.topic
      : "";
  return (
    <PublicPage
      title={t.blog.title}
      description={t.blog.description}
      eyebrow={t.blogEyebrow}
    >
      <PublicFilters
        action="/blog"
        query={textQuery(searchParams.q)}
        queryLabel={t.blogSearch}
        placeholder={t.searchHint}
        filterName="topic"
        filterValue={topic}
        filterLabel={t.topicFilter}
        allLabel={t.all}
        options={topics.map((value) => ({ value, label: t.topics[value] }))}
      />
      <p aria-live="polite" className="mb-6 text-sm">
        {formatNumber(posts.length, locale)} {t.results}
      </p>
      {posts.length ? (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {posts.map((post) => (
            <Card key={post.slug} data-blog-card className="flex flex-col">
              <CardHeader>
                <div>
                  <Badge>{t.topics[post.topic]}</Badge>
                </div>
                <h2 className="!mb-0 !text-2xl !leading-relaxed">
                  <Link href={`/blog/${post.slug}`} className="hover:underline">
                    {post.content[locale].title}
                  </Link>
                </h2>
              </CardHeader>
              <CardContent className="flex-1">
                <p className="mb-4">{post.content[locale].summary}</p>
                <time
                  dateTime={post.publishedAt}
                  className="text-xs text-muted"
                >
                  {new Intl.DateTimeFormat(
                    locale === "bn" ? "bn-BD" : "en-BD",
                    { timeZone: "Asia/Dhaka", dateStyle: "long" },
                  ).format(new Date(post.publishedAt))}
                </time>
              </CardContent>
              <CardFooter>
                <Link
                  href={`/blog/${post.slug}`}
                  className={buttonVariants({ variant: "outline" })}
                >
                  {t.read}
                  <ArrowUpRight size={16} aria-hidden="true" />
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyResults
          title={t.noResults}
          body={t.tryAgain}
          action={
            <Link
              href="/blog"
              className={buttonVariants({ variant: "outline" })}
            >
              {t.reset}
            </Link>
          }
        />
      )}
    </PublicPage>
  );
}
