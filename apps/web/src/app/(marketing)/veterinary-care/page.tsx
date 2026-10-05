import type { Metadata } from "next";
import { ProductOverview } from "@/components/marketing/product-overview";
export const metadata: Metadata = {
  title: "Veterinary care",
  description:
    "Explore veterinary consultations connected to animal history, clinical notes and signed prescriptions.",
};
export default function VeterinaryCarePage() {
  return (
    <ProductOverview
      title="Care starts with understanding the whole story."
      intro="An animal’s history matters. Vetralink’s veterinary-care approach connects consultation intake, farm records and clinical documentation so each conversation has better context."
      sections={[
        {
          title: "Start with the right context",
          body: "The intended intake journey connects an affected animal, the farmer’s concern and supporting images or video. Triage and assignment help organize the next step in the consultation process.",
        },
        {
          title: "Bring the history together",
          body: "The clinical experience is designed around animal health records, relevant production history and private attending-vet notes, with chat and video supporting the conversation.",
        },
        {
          title: "Keep care connected",
          body: "Structured prescriptions, signing, PDF verification and withdrawal-period information form part of the clinical workflow. Treatment decisions belong to the veterinarian; this public website does not provide clinical advice or appointment booking.",
        },
      ]}
    />
  );
}
