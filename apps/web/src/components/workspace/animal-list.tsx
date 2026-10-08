"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AnimalSpecies, AnimalStatus } from "@vetralink/shared-types";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { getFarmMessages } from "@/lib/i18n/farm";
import { workspaceBn, workspaceEn } from "@/lib/i18n/workspace";
import {
  animalListSchema,
  animalQuerySchema,
} from "@/lib/workspace/farm-contracts";
import { useFarmContext } from "./farm-context";
import { useFarmAccess } from "./farm-access";
import { useRemote, Notice, option, Field } from "./workspace-ui";
import styles from "./workspace.styles";
export function AnimalList() {
  const auth = useAuth(),
    t = getFarmMessages(auth.locale),
    shared = auth.locale === "bn" ? workspaceBn : workspaceEn,
    { farmId } = useFarmContext(),
    params = useSearchParams(),
    parsed = animalQuerySchema.safeParse(Object.fromEntries(params)),
    query = params.toString(),
    base = `/app/farms/${farmId}/animals`,
    remote = useRemote(
      parsed.success
        ? `farms/${farmId}/animals${query ? "?" + query : ""}`
        : null,
      animalListSchema,
    ),
    access = useFarmAccess();
  const pageLink = (page: number) => {
    const next = new URLSearchParams(query);
    next.set("page", String(page));
    return `${base}?${next}`;
  };
  return (
    <>
      <div className="mb-5 flex flex-wrap gap-3">
        {access.canRegister && (
          <Button asChild>
            <Link href={`${base}/new`}>{t.register}</Link>
          </Button>
        )}
      </div>
      <form
        key={query}
        action={base}
        method="get"
        className={`${styles.card} mb-6`}
      >
        <div className="grid grid-cols-1 gap-4 min-[768px]:grid-cols-3">
          <Field name="search" label={t.search}>
            <input
              id="search"
              name="search"
              maxLength={100}
              defaultValue={params.get("search") ?? ""}
            />
          </Field>
          <Field name="filter-species" label={shared.species}>
            <select
              id="filter-species"
              name="species"
              defaultValue={params.get("species") ?? ""}
            >
              <option value="">{t.all}</option>
              {Object.values(AnimalSpecies).map((value) => (
                <option key={value} value={value}>
                  {option(shared, value)}
                </option>
              ))}
            </select>
          </Field>
          <Field name="filter-status" label={t.status}>
            <select
              id="filter-status"
              name="status"
              defaultValue={params.get("status") ?? ""}
            >
              <option value="">{t.all}</option>
              {Object.values(AnimalStatus).map((value) => (
                <option key={value} value={value}>
                  {t.options[value]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Button type="submit" variant="outline" className="mt-5">
          {t.filter}
        </Button>
      </form>
      {!parsed.success ? (
        <Notice code="VALIDATION_FAILED" t={shared} />
      ) : remote.loading ? (
        <Notice text={shared.loading} t={shared} />
      ) : remote.code ? (
        <>
          <Notice code={remote.code} t={shared} />
          <Button variant="outline" onClick={remote.reload}>
            {shared.retry}
          </Button>
        </>
      ) : (
        remote.data && (
          <div data-animal-list>
            <p className="text-sm text-muted">
              {t.total}:{" "}
              {new Intl.NumberFormat(auth.locale).format(
                remote.data.meta.total,
              )}
            </p>
            {!remote.data.items.length ? (
              <p>{t.noAnimals}</p>
            ) : (
              <ul className="grid list-none grid-cols-1 gap-4 p-0 min-[768px]:grid-cols-2">
                {remote.data.items.map((animal) => (
                  <li key={animal.id} className={styles.card}>
                    <h3 className="mt-0 text-xl">
                      <Link
                        className="text-green"
                        href={`${base}/${animal.id}`}
                      >
                        {animal.tagNumber}
                      </Link>
                    </h3>
                    <p className="break-words">{animal.name ?? t.missing}</p>
                    <p className="text-sm text-muted">
                      {option(shared, animal.species)} ·{" "}
                      {t.options[animal.gender]} · {t.options[animal.status]}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <nav
              aria-label={
                auth.locale === "bn" ? "পশুর তালিকার পাতা" : "Animal list pages"
              }
              className="mt-6 flex flex-wrap items-center gap-6"
            >
              {remote.data.meta.page > 1 && (
                <Link
                  className="inline-flex min-h-11 items-center text-green"
                  href={pageLink(remote.data.meta.page - 1)}
                >
                  {t.previous}
                </Link>
              )}
              <span>
                {remote.data.meta.page} /{" "}
                {Math.max(1, remote.data.meta.totalPages)}
              </span>
              {remote.data.meta.page < remote.data.meta.totalPages && (
                <Link
                  className="inline-flex min-h-11 items-center text-green"
                  href={pageLink(remote.data.meta.page + 1)}
                >
                  {t.next}
                </Link>
              )}
            </nav>
          </div>
        )
      )}
    </>
  );
}
