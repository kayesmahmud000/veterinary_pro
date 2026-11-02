import { notFound } from "next/navigation";
import { z } from "zod";
import { CourseLearningLayout } from "@/components/courses/course-learning-layout";
export default async function Layout({
  params: pendingParams,
  children,
}: {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}) {
  const params = await pendingParams;
  if (!z.string().uuid().safeParse(params.id).success) notFound();
  return <CourseLearningLayout id={params.id}>{children}</CourseLearningLayout>;
}
