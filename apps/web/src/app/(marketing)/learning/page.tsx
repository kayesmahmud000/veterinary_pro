import type { Metadata } from "next";
import { ProductOverview } from "@/components/marketing/product-overview";
export const metadata: Metadata = {
  title: "Learning and resources",
  description:
    "Discover the vision for practical farming courses, digital guides and downloadable tools in Vetralink Pro.",
};
export default function LearningPage() {
  return (
    <ProductOverview
      title="Practical knowledge. For life on the farm."
      intro="Explore a learning experience designed to bring educational courses, useful guides and farm planning tools into the same ecosystem as your everyday work."
      sections={[
        {
          title: "Learn with context",
          body: "The product vision includes educational video courses covering livestock and farm management. A searchable catalog will help learners discover relevant resources before making a purchase.",
        },
        {
          title: "Keep useful resources close",
          body: "Digital guides, eBooks and spreadsheet tools are part of the planned marketplace. Authorized downloads and a buyer library are intended to keep purchased resources accessible.",
        },
        {
          title: "A connected learning journey",
          body: "The intended journey runs from discovering a resource to checkout and authorized access. The planned experience includes secure playback and watermarked downloads, with purchased resources collected in a personal library.",
        },
      ]}
    />
  );
}
