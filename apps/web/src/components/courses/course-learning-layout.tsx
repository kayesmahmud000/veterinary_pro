"use client";
import { createContext, useContext, type ReactNode } from "react";
import { myCourseSchema } from "@vetralink/shared-types";
import { z } from "zod";
import { useAuth } from "@/components/auth/auth-provider";
import { useRemote } from "@/components/workspace/workspace-ui";
import { WorkspaceGate } from "@/components/workspace/workspace-gate";
import { CourseError, CourseLoading } from "./course-ui";
import styles from "./course.styles";
const LearningContext = createContext<{
  course: z.infer<typeof myCourseSchema>;
  reload: () => void;
} | null>(null);
export function useLearningCourse() {
  const value = useContext(LearningContext);
  if (!value) throw new Error("Course learning layout required");
  return value;
}
function CourseOutline({ id, children }: { id: string; children: ReactNode }) {
  const data = useRemote(`me/courses/${id}`, myCourseSchema);
  if (data.loading) return <CourseLoading />;
  if (data.code || !data.data)
    return <CourseError code={data.code ?? "NOT_FOUND"} retry={data.reload} />;
  return (
    <LearningContext.Provider
      value={{ course: data.data, reload: data.reload }}
    >
      {children}
    </LearningContext.Provider>
  );
}
export function CourseLearningLayout({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  const auth = useAuth();
  return (
    <main id="main-content" className={styles.shell}>
      <WorkspaceGate>
        <CourseOutline
          key={`${id}:${auth.user?.id}:${auth.user?.roleVersion}`}
          id={id}
        >
          {children}
        </CourseOutline>
      </WorkspaceGate>
    </main>
  );
}
