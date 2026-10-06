import {
  GuideArticle,
  getGuideMetadata,
} from "@/components/marketing/guide-article";

export function generateMetadata() {
  return getGuideMetadata(1);
}
export default function DailyMilkLogPage() {
  return <GuideArticle index={1} />;
}
