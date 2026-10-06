import {
  GuideArticle,
  getGuideMetadata,
} from "@/components/marketing/guide-article";

export function generateMetadata() {
  return getGuideMetadata(2);
}
export default function FarmFinancesPage() {
  return <GuideArticle index={2} />;
}
