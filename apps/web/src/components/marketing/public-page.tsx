import Link from "next/link";
import { cn } from "@/lib/ui/cn";
import siteStyles from "@/lib/ui/site.styles";
import { getLocalization } from "@/lib/i18n/server";
import { Badge } from "@/components/ui/badge";
import type { ReactNode } from "react";

export function PublicPage({
  title,
  description,
  eyebrow,
  children,
}: {
  title: string;
  description: string;
  eyebrow: string;
  children: ReactNode;
}) {
  const { messages } = getLocalization();
  return (
    <main
      id="main-content"
      className={cn(siteStyles.container, "py-8 md:py-12")}
    >
      <nav
        aria-label={messages.publicPages.home}
        className="mb-8 text-sm text-muted"
      >
        <Link
          href="/"
          className="inline-flex min-h-11 items-center hover:underline"
        >
          {messages.publicPages.home}
        </Link>
        <span aria-hidden="true" className="mx-3">
          /
        </span>
        <span>{title}</span>
      </nav>
      <div className="relative mb-10 overflow-hidden rounded-3xl border border-solid border-line bg-[#eff2eb] px-6 py-10 md:px-10 md:py-14">
        <Badge className="mb-5 bg-paper">{eyebrow}</Badge>
        <h1 className="mb-5 max-w-4xl text-[clamp(2rem,4vw,3.6rem)] font-medium leading-tight">
          {title}
        </h1>
        <p className="mb-0 max-w-3xl text-lg leading-8">{description}</p>
      </div>
      {children}
    </main>
  );
}
export function EmptyResults({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action: ReactNode;
}) {
  return (
    <div
      role="status"
      className="rounded-2xl border border-dashed border-line bg-white p-8 text-center"
    >
      <h2 className="!mb-3 !text-2xl">{title}</h2>
      <p>{body}</p>
      {action}
    </div>
  );
}
