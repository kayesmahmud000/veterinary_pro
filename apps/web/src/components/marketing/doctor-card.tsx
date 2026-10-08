import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, MapPin, UserRound } from "lucide-react";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import type { DoctorProfile } from "@/lib/doctor-directory";
import type { Messages } from "@/lib/i18n/en";
import { formatNumber, type Locale } from "@/lib/i18n/locale";

export function DoctorPortrait({
  profile,
  size = "small",
}: {
  profile: DoctorProfile;
  size?: "small" | "large";
}) {
  return (
    <div
      className={
        size === "large"
          ? "flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-3xl bg-[#e8eee2]"
          : "flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#e8eee2]"
      }
    >
      {profile.photo ? (
        <Image
          src={profile.photo}
          alt=""
          width={160}
          height={160}
          className="h-full w-full object-cover"
        />
      ) : (
        <UserRound
          size={size === "large" ? 64 : 40}
          className="text-green"
          aria-hidden="true"
        />
      )}
    </div>
  );
}
export function DoctorCard({
  profile,
  locale,
  t,
}: {
  profile: DoctorProfile;
  locale: Locale;
  t: Messages["publicPages"];
}) {
  return (
    <Card data-doctor-card className="flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <DoctorPortrait profile={profile} />
          {profile.isDemo && <Badge className="bg-[#fff5d6]">{t.demo}</Badge>}
        </div>
        <h2 className="!mb-0 !text-2xl">
          <Link href={`/doctors/${profile.id}`} className="hover:underline">
            {profile.name[locale]}
          </Link>
        </h2>
        <p className="!mb-0 text-sm">{profile.qualifications[locale]}</p>
      </CardHeader>
      <CardContent className="flex-1">
        <div className="mb-4 flex flex-wrap gap-2">
          {profile.specialties.map((area) => (
            <Badge key={area}>{t.areas[area]}</Badge>
          ))}
        </div>
        <p className="mb-3 flex items-center gap-2 text-sm">
          <MapPin size={16} aria-hidden="true" />
          {profile.location[locale]}
        </p>
        <p className="mb-0 text-sm">
          {t.experience}: {formatNumber(profile.yearsExperience, locale)}{" "}
          {t.years}
        </p>
      </CardContent>
      <CardFooter>
        <Link
          href={`/doctors/${profile.id}`}
          className={buttonVariants({ variant: "outline" })}
        >
          {t.profile}
          <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </CardFooter>
    </Card>
  );
}
