import {
  AnimalSpecies,
  FarmType,
  ProfessionalRole,
} from "@vetralink/shared-types";
export type Question = {
  key: string;
  type: "text" | "number" | "select" | "multiselect" | "consent";
  required: boolean;
  label: { bn: string; en: string };
  options?: string[];
  min?: number;
  max?: number;
};
const q = (
  key: string,
  type: Question["type"],
  bn: string,
  en: string,
  extra: Partial<Question> = {},
): Question => ({ key, type, required: true, label: { bn, en }, ...extra });
const location = q("district", "text", "জেলা", "District", {
  min: 2,
  max: 100,
});
const experience = q(
  "experienceYears",
  "number",
  "অভিজ্ঞতা (বছর)",
  "Experience (years)",
  { min: 0, max: 80 },
);
const species = q("species", "multiselect", "প্রাণীর ধরন", "Animal species", {
  options: Object.values(AnimalSpecies),
});
const common = [
  q("reason", "text", "কেন এই ভূমিকা চান?", "Why are you applying?", {
    min: 20,
    max: 1000,
  }),
  q(
    "consent",
    "consent",
    "দেওয়া তথ্য সঠিক বলে নিশ্চিত করছি",
    "I confirm the information is accurate",
  ),
];
export const questionnaires: Record<
  ProfessionalRole,
  { version: number; fields: Question[] }
> = {
  FARMER: {
    version: 1,
    fields: [
      q("farmName", "text", "খামারের নাম", "Farm name"),
      location,
      q("upazila", "text", "উপজেলা", "Upazila"),
      q("farmType", "select", "খামারের ধরন", "Farm type", {
        options: Object.values(FarmType),
      }),
      species,
      q(
        "animalCount",
        "number",
        "বর্তমান বা পরিকল্পিত প্রাণীর সংখ্যা",
        "Current or planned animal count",
        { min: 0, max: 100000 },
      ),
      experience,
      q(
        "description",
        "text",
        "খামার সম্পর্কে অতিরিক্ত তথ্য",
        "Additional farm information",
        { required: false, max: 1000 },
      ),
      ...common,
    ],
  },
  VET: {
    version: 1,
    fields: [
      q("professionalName", "text", "পেশাগত নাম", "Professional name"),
      q("qualification", "text", "শিক্ষাগত যোগ্যতা", "Qualification", {
        max: 200,
      }),
      q("licensingBody", "text", "নিবন্ধনকারী প্রতিষ্ঠান", "Licensing body"),
      q(
        "licenseNumber",
        "text",
        "লাইসেন্স বা নিবন্ধন নম্বর",
        "License or registration number",
      ),
      location,
      experience,
      species,
      q("specialties", "text", "বিশেষ দক্ষতা", "Specialties", { max: 500 }),
      q(
        "organization",
        "text",
        "ক্লিনিক বা প্রতিষ্ঠানের নাম",
        "Clinic or organization",
        { required: false },
      ),
      ...common,
    ],
  },
  BUYER: {
    version: 1,
    fields: [
      q("use", "select", "ব্যবহারের উদ্দেশ্য", "Intended use", {
        options: ["PERSONAL", "BUSINESS"],
      }),
      location,
      q(
        "interests",
        "text",
        "শেখা বা কেনাকাটার আগ্রহ",
        "Learning or purchase interests",
        { max: 500 },
      ),
      q("organization", "text", "প্রতিষ্ঠানের নাম", "Organization", {
        required: false,
      }),
      ...common,
    ],
  },
};
