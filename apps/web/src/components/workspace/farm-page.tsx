"use client";
import { useAuth } from "@/components/auth/auth-provider";
import { workspaceBn, workspaceEn } from "@/lib/i18n/workspace";
import { getWorkspaceShellMessages } from "@/lib/i18n/workspace-shell";
import { farmWorkspaceRoles } from "@/lib/workspace/farm-navigation";
import { FarmBoundary, useFarmContext } from "./farm-context";
import { FarmMembers } from "./farm-members";
import { WorkspaceGate } from "./workspace-gate";
import { option } from "./workspace-ui";
import { FarmOverview } from "./farm-overview";
import { AnimalList } from "./animal-list";
import { AnimalForm } from "./animal-form";
import { AnimalDetail } from "./animal-detail";
import { getFarmMessages } from "@/lib/i18n/farm";
import styles from "./workspace.styles";
type FarmView = "overview" | "members" | "animals" | "new" | "detail";
function Content({ view, id }: { view: FarmView; id?: string }) {
  const auth = useAuth(),
    { farm } = useFarmContext(),
    t = auth.locale === "bn" ? workspaceBn : workspaceEn;
  return (
    <>
      <section className="mb-6">
        <h2 className="break-words text-2xl font-medium">{farm!.name}</h2>
        <p className="text-sm text-muted">
          {option(t, farm!.farmType)} · {t.farmRole}: {option(t, farm!.role)}
        </p>
      </section>
      {view === "members" ? (
        <FarmMembers t={t} />
      ) : view === "animals" ? (
        <AnimalList />
      ) : view === "new" ? (
        <AnimalForm />
      ) : view === "detail" ? (
        <AnimalDetail key={id} id={id!} />
      ) : (
        <FarmOverview />
      )}
    </>
  );
}
export function FarmPage({ view, id }: { view: FarmView; id?: string }) {
  const auth = useAuth(),
    t = getWorkspaceShellMessages(auth.locale),
    animals = getFarmMessages(auth.locale);
  return (
    <main id="main-content" className={styles.shell}>
      <h1 className={styles.heading}>
        {view === "members"
          ? t.members
          : view === "animals"
            ? t.animals
            : view === "new"
              ? animals.newTitle
              : view === "detail"
                ? animals.detailTitle
                : t.overview}
      </h1>
      <WorkspaceGate
        allowedRoles={farmWorkspaceRoles}
        requireFarmerSetupComplete
      >
        <FarmBoundary>
          <Content view={view} id={id} />
        </FarmBoundary>
      </WorkspaceGate>
    </main>
  );
}
