import Link from "next/link";
import { PublicNotFound } from "@/components/marketing/public-not-found";
import { ArrowLeft, MapPin } from "lucide-react";
import { getLocalization } from "@/lib/i18n/server";
import { formatNumber } from "@/lib/i18n/locale";
import { doctorProfiles } from "@/lib/doctor-data";
import { findDoctor } from "@/lib/doctor-directory";
import { PublicPage } from "@/components/marketing/public-page";
import { DoctorCard, DoctorPortrait } from "@/components/marketing/doctor-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

export function generateMetadata({ params }: { params: { id: string } }) {
  const p = findDoctor(doctorProfiles, params.id);
  const { locale, messages } = getLocalization();
  if (!p)
    return {
      title: messages.notFound.title,
      description: messages.notFound.body,
      robots: { index: false, follow: true },
    };
  return {
    title: p.name[locale],
    description: p.biography[locale],
    ...(p.isDemo ? { robots: { index: false, follow: true } } : {}),
  };
}
export default function DoctorPage({ params }: { params: { id: string } }) {
  const p = findDoctor(doctorProfiles, params.id);
  if (!p) return <PublicNotFound />;
  const { locale, messages } = getLocalization();
  const t = messages.publicPages;
  const others = doctorProfiles.filter(
    (other) => other.published && other.id !== p.id,
  );
  return (
    <PublicPage
      title={p.name[locale]}
      description={p.qualifications[locale]}
      eyebrow={p.isDemo ? t.demo : messages.navigation.doctors}
    >
      {p.isDemo && (
        <p className="mb-8 rounded-xl border border-solid border-[#e6d69f] bg-[#fff5d6] p-5 text-sm leading-7">
          {t.demoNote}
        </p>
      )}
      <div className="grid gap-8 lg:grid-cols-[300px_minmax(0,1fr)]">
        <Card className="self-start">
          <CardHeader>
            <DoctorPortrait profile={p} size="large" />
            <p className="!mb-0 flex items-center gap-2">
              <MapPin size={16} aria-hidden="true" />
              {p.location[locale]}
            </p>
          </CardHeader>
          <CardContent>
            <dl className="m-0 space-y-5">
              <div>
                <dt className="mb-1 text-sm text-muted">{t.experience}</dt>
                <dd className="m-0 font-semibold">
                  {formatNumber(p.yearsExperience, locale)} {t.years}
                </dd>
              </div>
              <div>
                <dt className="mb-1 text-sm text-muted">{t.languages}</dt>
                <dd className="m-0">
                  {p.languages
                    .map((l) => (l === "bn" ? t.bengali : t.english))
                    .join(" · ")}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
        <div>
          <section className="mb-8">
            <h2 className="!text-2xl">{t.biography}</h2>
            <p className="max-w-4xl text-lg leading-8">{p.biography[locale]}</p>
          </section>
          <section className="mb-8">
            <h2 className="!text-2xl">{t.qualifications}</h2>
            <p>{p.qualifications[locale]}</p>
          </section>
          <section className="mb-8">
            <h2 className="!text-2xl">{t.specialties}</h2>
            <div className="flex flex-wrap gap-2">
              {p.specialties.map((s) => (
                <Badge key={s}>{t.areas[s]}</Badge>
              ))}
            </div>
          </section>
          <Link
            href="/doctors"
            className={buttonVariants({ variant: "outline" })}
          >
            <ArrowLeft size={16} aria-hidden="true" />
            {t.backDoctors}
          </Link>
        </div>
      </div>
      {others.length > 0 && (
        <section className="mt-14">
          <h2 className="!text-2xl">{t.relatedDoctors}</h2>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {others.map((profile) => (
              <DoctorCard
                key={profile.id}
                profile={profile}
                locale={locale}
                t={t}
              />
            ))}
          </div>
        </section>
      )}
    </PublicPage>
  );
}
