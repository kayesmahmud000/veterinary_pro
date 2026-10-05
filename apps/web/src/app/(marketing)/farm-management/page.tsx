import type { Metadata } from "next";
import { ProductOverview } from "@/components/marketing/product-overview";
export const metadata: Metadata = {
  title: "Farm management",
  description:
    "Explore the Vetralink approach to connected animal records, milk production, health tracking and farm finances.",
};
export default function FarmManagementPage() {
  return (
    <ProductOverview
      title="Every animal. Every day. One clearer picture."
      intro="Farm management starts with knowing what happened, when it happened and which animal it belongs to. Explore an approach that connects everyday records with your farm’s bigger picture."
      sections={[
        {
          title: "A history for every animal",
          body: "Animal identity, lineage and weight records provide the foundation for a connected livestock history. The product is designed for multi-species farms, with farm-scoped records and access.",
        },
        {
          title: "The everyday, connected",
          body: "Milk production, health incidents and vaccination schedules belong alongside the animal they describe. Daily and herd-level records can bring useful context to trends and veterinary conversations.",
        },
        {
          title: "See beyond the records",
          body: "Expenses, revenue, production analytics and financial reports are designed to help owners understand farm performance. Farm membership and subscription controls support the wider workspace.",
        },
      ]}
    />
  );
}
