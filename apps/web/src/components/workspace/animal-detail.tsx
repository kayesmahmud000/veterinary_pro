"use client";
import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { getFarmMessages } from "@/lib/i18n/farm";
import { workspaceBn, workspaceEn } from "@/lib/i18n/workspace";
import { animalSchema } from "@/lib/workspace/farm-contracts";
import { useFarmContext } from "./farm-context";
import { useFarmAccess } from "./farm-access";
import { useRemote, Notice, option } from "./workspace-ui";
import { AnimalForm } from "./animal-form";
import styles from "./workspace.styles";
export function AnimalDetail({ id }: { id: string }) {
  const auth = useAuth(),
    t = getFarmMessages(auth.locale),
    shared = auth.locale === "bn" ? workspaceBn : workspaceEn,
    { farmId } = useFarmContext(),
    animal = useRemote(`farms/${farmId}/animals/${id}`, animalSchema),
    access = useFarmAccess(),
    [editing, setEditing] = useState(false),
    [saved, setSaved] = useState(false);
  const back = (
    <Link
      className="inline-flex min-h-11 items-center text-green"
      href={`/app/farms/${farmId}/animals`}
    >
      {t.back}
    </Link>
  );
  if (animal.loading) return <Notice text={shared.loading} t={shared} />;
  if (animal.code)
    return (
      <>
        {back}
        <Notice code={animal.code} t={shared} />
        <Button variant="outline" onClick={animal.reload}>
          {shared.retry}
        </Button>
      </>
    );
  if (!animal.data) return null;
  const data = animal.data;
  const rows = [
    [t.tag, data.tagNumber],
    [t.name, data.name],
    [shared.species, option(shared, data.species)],
    [t.gender, t.options[data.gender]],
    [t.status, t.options[data.status]],
    [t.breed, data.breed],
    [t.dob, data.dateOfBirth?.slice(0, 10)],
    [
      t.weight,
      data.weightKg === null
        ? null
        : new Intl.NumberFormat(auth.locale).format(data.weightKg),
    ],
    [t.rfid, data.rfidNumber],
  ];
  return (
    <div data-animal-detail>
      {back}
      {saved && <p role="status">{t.saved}</p>}
      {editing ? (
        <AnimalForm
          key={data.id}
          animal={data}
          onCancel={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            setSaved(true);
            animal.reload();
          }}
        />
      ) : (
        <section className={styles.card}>
          <h2 className="break-words">
            {data.tagNumber}
            {data.name && ` · ${data.name}`}
          </h2>
          <dl className="grid grid-cols-1 gap-6 min-[768px]:grid-cols-2">
            {rows.map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-sm text-muted">{label}</dt>
                <dd className="m-0 mt-2 break-words font-medium">
                  {value ?? t.missing}
                </dd>
              </div>
            ))}
          </dl>
          {access.canWrite && (
            <Button
              variant="outline"
              onClick={() => {
                setEditing(true);
                setSaved(false);
              }}
            >
              {t.edit}
            </Button>
          )}
        </section>
      )}
    </div>
  );
}
