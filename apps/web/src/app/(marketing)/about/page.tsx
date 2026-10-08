import Link from "next/link";
import { Sprout, BookOpen, HeartPulse } from "lucide-react";
import { getLocalization } from "@/lib/i18n/server";
import { PublicPage } from "@/components/marketing/public-page";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

export function generateMetadata() {
  const { messages } = getLocalization();
  return {
    title: messages.navigation.about,
    description: messages.publicPages.about.description,
  };
}
export default function AboutPage() {
  const { messages } = getLocalization();
  const t = messages.publicPages;
  const a = t.about;
  const icons = [Sprout, BookOpen, HeartPulse];
  return (
    <PublicPage
      title={a.title}
      description={a.description}
      eyebrow={t.aboutEyebrow}
    >
      <p className="mb-12 max-w-4xl text-lg leading-8">{a.intro}</p>
      <section className="mb-12">
        <h2 className="!text-3xl">{a.missionTitle}</h2>
        <p className="max-w-4xl">{a.missionBody}</p>
      </section>
      <section className="mb-12">
        <h2 className="!text-3xl">{a.audienceTitle}</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {a.audiences.map((item, i) => {
            const Icon = icons[i];
            return (
              <Card key={item.title}>
                <CardHeader>
                  <Icon size={30} aria-hidden="true" className="text-green" />
                  <h3 className="!mb-0">{item.title}</h3>
                </CardHeader>
                <CardContent>
                  <p className="mb-0">{item.body}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
      <div className="mb-12 grid gap-6 md:grid-cols-2">
        {[
          { title: a.todayTitle, body: a.todayBody },
          { title: a.futureTitle, body: a.futureBody },
        ].map((item) => (
          <Card key={item.title}>
            <CardHeader>
              <h2 className="!mb-0 !text-2xl">{item.title}</h2>
            </CardHeader>
            <CardContent>
              <p className="mb-0">{item.body}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <section className="mb-10">
        <h2 className="!text-3xl">{a.valuesTitle}</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {a.values.map((item) => (
            <div key={item.title} className="rounded-2xl bg-[#eff2eb] p-6">
              <h3>{item.title}</h3>
              <p className="mb-0">{item.body}</p>
            </div>
          ))}
        </div>
      </section>
      <Link href="/learning#guides" className={buttonVariants()}>
        {a.cta}
      </Link>
    </PublicPage>
  );
}
