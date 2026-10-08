"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  farmOnboardingStatusSchema,
  UserStatus,
} from "@vetralink/shared-types";
import { useAuth } from "@/components/auth/auth-provider";
import { getWorkspaceShellMessages } from "@/lib/i18n/workspace-shell";
import { workspaceBn, workspaceEn } from "@/lib/i18n/workspace";
import {
  farmWorkspaceRoles,
  type FarmMembershipProjection,
} from "@/lib/workspace/farm-navigation";
import { useRemote, Notice } from "./workspace-ui";
import styles from "./workspace.styles";
import { useNavigationGuard } from "./navigation-guard";

type FarmContextValue = {
  farmId: string;
  farm?: FarmMembershipProjection;
  farms: FarmMembershipProjection[];
  loading: boolean;
  code?: string;
  reload: () => void;
  setDirty: (value: boolean) => void;
  dirty: boolean;
};
const FarmContext = createContext<FarmContextValue | null>(null);
export function useFarmContext() {
  const value = useContext(FarmContext);
  if (!value) throw new Error("FarmContextProvider is required");
  return value;
}
export function FarmContextProvider({ children }: { children: ReactNode }) {
  const auth = useAuth(),
    pathname = usePathname(),
    farmId = pathname.match(/^\/app\/farms\/([^/]+)/)?.[1] ?? "";
  const identity =
    auth.user &&
    auth.user.status === UserStatus.ACTIVE &&
    farmWorkspaceRoles.includes(auth.user.role)
      ? auth.user
      : null;
  const scope =
    identity && farmId
      ? `${identity.id}:${identity.role}:${identity.roleVersion ?? 0}:${identity.farmerOnboardingRequired ?? false}:${farmId}`
      : "";
  return (
    <FarmSession key={scope} farmId={farmId} enabled={!!scope}>
      {children}
    </FarmSession>
  );
}
function FarmSession({
  farmId,
  enabled,
  children,
}: {
  farmId: string;
  enabled: boolean;
  children: ReactNode;
}) {
  const auth = useAuth(),
    remote = useRemote(enabled ? "farms" : null, farmOnboardingStatusSchema),
    [dirty, updateDirty] = useState(false),
    dirtyRef = useRef(false);
  const setDirty = useCallback((value: boolean) => {
    dirtyRef.current = value;
    updateDirty(value);
  }, []);
  const registerGuard = useNavigationGuard();
  useEffect(() => {
    if (!dirty) return;
    const source = location.href,
      state = history.state;
    const navigation = (
      window as Window & { navigation?: { currentEntry?: { index: number } } }
    ).navigation;
    const sourceIndex = navigation?.currentEntry?.index;
    let restoring = false;
    const confirm = () =>
      window.confirm(
        auth.locale === "bn"
          ? "অসমাপ্ত তথ্য হারাবে। এই পাতা ছেড়ে যাবেন?"
          : "Leave this page and discard unsaved changes?",
      );
    const click = (event: MouseEvent) => {
      if (
        !dirtyRef.current ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link = (event.target as Element).closest?.(
        "a[href]",
      ) as HTMLAnchorElement | null;
      if (
        !link ||
        link.target === "_blank" ||
        link.hasAttribute("download") ||
        link.href === source
      )
        return;
      const target = new URL(link.href);
      if (
        target.pathname === location.pathname &&
        target.search === location.search
      )
        return;
      if (confirm()) setDirty(false);
      else {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const pop = (event: PopStateEvent) => {
      if (restoring) {
        event.stopImmediatePropagation();
        restoring = false;
        return;
      }
      if (!dirtyRef.current || location.href === source) return;
      if (confirm()) {
        setDirty(false);
        return;
      }
      event.stopImmediatePropagation();
      const destinationIndex = navigation?.currentEntry?.index;
      if (
        sourceIndex !== undefined &&
        destinationIndex !== undefined &&
        sourceIndex !== destinationIndex
      ) {
        restoring = true;
        history.go(sourceIndex - destinationIndex);
      } else history.pushState(state, "", source);
    };
    const before = (event: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    document.addEventListener("click", click, true);
    const unregister = registerGuard(pop);
    window.addEventListener("beforeunload", before);
    return () => {
      document.removeEventListener("click", click, true);
      unregister();
      window.removeEventListener("beforeunload", before);
    };
  }, [dirty, auth.locale, setDirty, registerGuard]);
  const farms = remote.data?.farms ?? [],
    farm = farms.find((item) => item.id === farmId);
  return (
    <FarmContext.Provider
      value={{
        farmId,
        farm,
        farms,
        loading: remote.loading,
        code: remote.code,
        reload: remote.reload,
        dirty,
        setDirty,
      }}
    >
      {children}
    </FarmContext.Provider>
  );
}
export function useFarmDirty(dirty: boolean) {
  const { setDirty } = useFarmContext();
  useEffect(() => {
    setDirty(dirty);
    return () => setDirty(false);
  }, [dirty, setDirty]);
}
export function FarmBoundary({ children }: { children: ReactNode }) {
  const context = useFarmContext(),
    auth = useAuth(),
    t = auth.locale === "bn" ? workspaceBn : workspaceEn;
  if (context.loading) return <Notice text={t.loading} t={t} />;
  if (context.code)
    return (
      <>
        <Notice code={context.code} t={t} />
        <button className={styles.secondary} onClick={context.reload}>
          {t.retry}
        </button>
      </>
    );
  if (!context.farm)
    return (
      <p data-farm-denied role="alert">
        {t.membershipRequired}
      </p>
    );
  return (
    <div
      key={`${auth.user!.id}:${auth.user!.roleVersion ?? 0}:${context.farmId}`}
      data-selected-farm={context.farmId}
      data-farm-dirty={context.dirty ? "true" : undefined}
    >
      <FarmSelector />
      {children}
    </div>
  );
}
function FarmSelector() {
  const { farm, farms, dirty } = useFarmContext(),
    auth = useAuth(),
    router = useRouter(),
    path = usePathname(),
    t = getWorkspaceShellMessages(auth.locale);
  return (
    <div className="mb-6 grid gap-2">
      <label htmlFor="active-farm" className="text-sm text-muted">
        {t.selectFarm}
      </label>
      <select
        id="active-farm"
        value={farm!.id}
        className="min-h-11 w-full max-w-lg rounded-lg border border-solid border-line bg-white p-3 text-ink"
        onChange={(event) => {
          const next = event.target.value;
          if (next === farm!.id) return;
          if (
            dirty &&
            !window.confirm(
              auth.locale === "bn"
                ? "খামার বদলালে অসমাপ্ত তথ্য হারাবে। এগিয়ে যাবেন?"
                : "Switch farms and discard unsaved changes?",
            )
          )
            return;
          const suffix = path.slice(`/app/farms/${farm!.id}`.length);
          router.push(
            `/app/farms/${next}${suffix.startsWith("/animals/") ? "/animals" : suffix}`,
          );
        }}
      >
        {farms.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
    </div>
  );
}
