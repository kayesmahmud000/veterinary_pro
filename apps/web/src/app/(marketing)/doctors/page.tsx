import Link from "next/link";
import { getLocalization } from "@/lib/i18n/server";
import { doctorProfiles } from "@/lib/doctor-data";
import { doctorSpecialties, listDoctors } from "@/lib/doctor-directory";
import { textQuery } from "@/lib/public-content";
import { formatNumber } from "@/lib/i18n/locale";
import { PublicPage, EmptyResults } from "@/components/marketing/public-page";
import { PublicFilters } from "@/components/marketing/public-filters";
import { DoctorCard } from "@/components/marketing/doctor-card";
import { buttonVariants } from "@/components/ui/button";

export function generateMetadata() {
  const { messages } = getLocalization();
  return {
    title: messages.navigation.doctors,
    description: messages.publicPages.doctors.description,
  };
}
export default function DoctorsPage({
  searchParams,
}: {
  searchParams: { q?: string | string[]; specialty?: string | string[] };
}) {
  const { locale, messages } = getLocalization();
  const t = messages.publicPages;
  const profiles = listDoctors(doctorProfiles, { ...searchParams, locale });
  const total = doctorProfiles.filter((p) => p.published).length;
  const specialty =
    typeof searchParams.specialty === "string" &&
    doctorSpecialties.some((s) => s === searchParams.specialty)
      ? searchParams.specialty
      : "";
  return (
    <PublicPage
      title={t.doctors.title}
      description={t.doctors.description}
      eyebrow={t.doctorsEyebrow}
    >
      {doctorProfiles.some((p) => p.published && p.isDemo) && (
        <p className="mb-8 rounded-xl border border-solid border-[#e6d69f] bg-[#fff5d6] p-5 text-sm leading-7">
          {t.demoNote}
        </p>
      )}
      <PublicFilters
        action="/doctors"
        query={textQuery(searchParams.q)}
        queryLabel={t.doctorSearch}
        placeholder={t.doctorHint}
        filterName="specialty"
        filterValue={specialty}
        filterLabel={t.specialtyFilter}
        allLabel={t.allSpecialties}
        options={doctorSpecialties.map((value) => ({
          value,
          label: t.areas[value],
        }))}
      />
      <p className="mb-6 text-sm" aria-live="polite">
        {formatNumber(profiles.length, locale)} {t.results}
      </p>
      {profiles.length ? (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {profiles.map((profile) => (
            <DoctorCard
              key={profile.id}
              profile={profile}
              locale={locale}
              t={t}
            />
          ))}
        </div>
      ) : (
        <EmptyResults
          title={total ? t.noResults : t.emptyDoctors}
          body={total ? t.tryAgain : t.doctors.description}
          action={
            <Link
              href={total ? "/doctors" : "/veterinary-care"}
              className={buttonVariants({ variant: "outline" })}
            >
              {total ? t.reset : t.doctorEmptyAction}
            </Link>
          }
        />
      )}
    </PublicPage>
  );
}
