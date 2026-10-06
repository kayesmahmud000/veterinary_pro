import type { Metadata } from "next";
import { LandingSections } from "@/components/marketing/landing-sections";
export const metadata: Metadata = {
  title: "Vetralink Pro — Connected care for your farm",
  description:
    "A clearer picture of your farm. Explore connected livestock management, practical learning and veterinary care.",
};
export default function HomePage() {
  return (
    <main id="main-content">
      <LandingSections />
    </main>
  );
}
