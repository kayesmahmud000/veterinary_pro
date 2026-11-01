import { notFound } from "next/navigation";
import { z } from "zod";
import { CourseLearningLayout } from "@/components/courses/course-learning-layout";
export default function Layout({
  params,
  children,
}: {
  params: { id: string };
  children: React.ReactNode;
}) {
  if (!z.string().uuid().safeParse(params.id).success) notFound();
  return <CourseLearningLayout id={params.id}>{children}</CourseLearningLayout>;
}
