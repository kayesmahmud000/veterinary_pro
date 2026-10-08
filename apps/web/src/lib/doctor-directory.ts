import { z } from "zod";
import type { Locale } from "./i18n/locale";

export const doctorSpecialties = [
  "general",
  "dairy",
  "poultry",
  "goat_sheep",
  "pets",
] as const;
const bilingual = z
  .object({ bn: z.string().trim().min(1), en: z.string().trim().min(1) })
  .strict();
const profileSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    published: z.boolean(),
    isDemo: z.boolean(),
    name: bilingual,
    biography: bilingual,
    qualifications: bilingual,
    location: bilingual,
    specialties: z.array(z.enum(doctorSpecialties)).min(1),
    yearsExperience: z.number().int().min(0).max(80),
    languages: z.array(z.enum(["bn", "en"])).min(1),
    photo: z
      .string()
      .regex(/^\/assets\/doctors\/[a-zA-Z0-9_-]+\.(?:png|jpg|jpeg|webp)$/)
      .optional(),
  })
  .strict();
export type DoctorProfile = z.infer<typeof profileSchema>;
export function validateDoctorProfiles(input: unknown): DoctorProfile[] {
  const profiles = z.array(profileSchema).parse(input);
  if (new Set(profiles.map((p) => p.id)).size !== profiles.length)
    throw new Error("Doctor profile IDs must be unique");
  return profiles;
}
export function findDoctor(profiles: readonly DoctorProfile[], id: string) {
  return profiles.find((p) => p.published && p.id === id);
}
export function listDoctors(
  profiles: readonly DoctorProfile[],
  {
    q,
    specialty,
    locale,
  }: { q?: string | string[]; specialty?: string | string[]; locale: Locale },
) {
  const query =
    typeof q === "string"
      ? q.trim().slice(0, 200).normalize("NFC").toLocaleLowerCase(locale)
      : "";
  const area =
    typeof specialty === "string" &&
    doctorSpecialties.some((s) => s === specialty)
      ? specialty
      : undefined;
  return profiles.filter(
    (p) =>
      p.published &&
      (!area || p.specialties.some((s) => s === area)) &&
      (!query ||
        [
          p.name[locale],
          p.qualifications[locale],
          p.location[locale],
          p.biography[locale],
        ]
          .join(" ")
          .normalize("NFC")
          .toLocaleLowerCase(locale)
          .includes(query)),
  );
}
