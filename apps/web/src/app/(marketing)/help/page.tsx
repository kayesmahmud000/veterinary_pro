import Link from "next/link";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import { getLocalization } from "@/lib/i18n/server";
import { PublicPage } from "@/components/marketing/public-page";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

export function generateMetadata() {
  const { messages } = getLocalization();
  return {
    title: messages.navigation.help,
    description: messages.publicPages.help.description,
  };
}
export default function HelpPage() {
  const { messages } = getLocalization();
  const t = messages.publicPages;
  const h = t.help;
  const destinations = ["/#farm-demo", "/learning#guides", "/"];
  return (
    <PublicPage
      title={h.title}
      description={h.description}
      eyebrow={t.helpEyebrow}
    >
      <p className="mb-8 text-lg">{h.intro}</p>
      <div className="mb-12 grid gap-6 md:grid-cols-3">
        {h.steps.map((step, i) => (
          <Card key={step.title} className="flex flex-col">
            <CardHeader>
              <h2 className="!mb-0 !text-2xl">{step.title}</h2>
            </CardHeader>
            <CardContent className="flex-1">
              <p className="mb-0">{step.body}</p>
            </CardContent>
            <CardFooter>
              <Link
                href={destinations[i]}
                className={buttonVariants({ variant: "outline" })}
              >
                {step.action}
                <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            </CardFooter>
          </Card>
        ))}
      </div>
      <section className="mb-12 max-w-4xl">
        <h2 className="!text-3xl">{h.faqTitle}</h2>
        <div className="space-y-3">
          {messages.landing.faq.items.map((item) => (
            <details
              key={item.question}
              className="group rounded-xl border border-solid border-line bg-white p-5"
            >
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
                {item.question}
                <ChevronDown
                  size={18}
                  aria-hidden="true"
                  className="shrink-0 transition-transform group-open:rotate-180"
                />
              </summary>
              <p className="mb-0 mt-4">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>
      <section className="rounded-2xl bg-[#eff2eb] p-8">
        <h2 className="!text-2xl">{h.contactTitle}</h2>
        <p className="max-w-3xl">{h.contactBody}</p>
        <Link href="/" className={buttonVariants()}>
          {h.contactAction}
        </Link>
      </section>
    </PublicPage>
  );
}
