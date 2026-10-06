import {
  GuideArticle,
  getGuideMetadata,
} from "@/components/marketing/guide-article";

export function generateMetadata() {
  return getGuideMetadata(0);
}
export default function AnimalRecordsPage() {
  return <GuideArticle index={0} />;
}
