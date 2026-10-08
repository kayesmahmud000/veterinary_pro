"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  AnimalGender,
  AnimalSpecies,
  AnimalStatus,
} from "@vetralink/shared-types";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { getFarmMessages } from "@/lib/i18n/farm";
import { workspaceBn, workspaceEn } from "@/lib/i18n/workspace";
import {
  animalSchema,
  registerAnimalSchema,
  updateAnimalSchema,
  type Animal,
} from "@/lib/workspace/farm-contracts";
import { workspaceRequest } from "@/lib/workspace/client";
import { useFarmContext, useFarmDirty } from "./farm-context";
import { useFarmAccess, FarmWriteNotice } from "./farm-access";
import { Field, option } from "./workspace-ui";
import { buildAnimalWritePayload } from "@/lib/workspace/farm-data";
import styles from "./workspace.styles";
export function AnimalForm({
  animal,
  onCancel,
  onSaved,
}: {
  animal?: Animal;
  onCancel?: () => void;
  onSaved?: () => void;
}) {
  const auth = useAuth(),
    t = getFarmMessages(auth.locale),
    shared = auth.locale === "bn" ? workspaceBn : workspaceEn,
    { farmId } = useFarmContext(),
    access = useFarmAccess(),
    router = useRouter();
  const initial = {
    tagNumber: animal?.tagNumber ?? "",
    name: animal?.name ?? "",
    rfidNumber: animal?.rfidNumber ?? "",
    species: animal?.species ?? "",
    breed: animal?.breed ?? "",
    gender: animal?.gender ?? "",
    dateOfBirth: animal?.dateOfBirth?.slice(0, 10) ?? "",
    weightKg: animal?.weightKg?.toString() ?? "",
    status: animal?.status ?? AnimalStatus.ACTIVE,
  };
  const [values, setValues] = useState(initial),
    [issues, setIssues] = useState<Record<string, string>>({}),
    [pending, setPending] = useState(false),
    [code, setCode] = useState<string>();
  const busy = useRef(false),
    alive = useRef(true),
    feedback = useRef<HTMLDivElement>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useFarmDirty(JSON.stringify(values) !== JSON.stringify(initial));
  const allowed = animal ? access.canWrite : access.canRegister;
  function change(name: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
    setIssues((current) => ({ ...current, [name]: "" }));
    setCode(undefined);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy.current || !allowed) return;
    const input = buildAnimalWritePayload(values, animal ? initial : undefined);
    if (animal && !Object.keys(input).length) return;
    const parsed = (
      animal ? updateAnimalSchema : registerAnimalSchema
    ).safeParse(input);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues)
        next[issue.path[0] as string] = t.invalid;
      setIssues(next);
      requestAnimationFrame(() =>
        document.getElementById(Object.keys(next)[0])?.focus(),
      );
      return;
    }
    busy.current = true;
    setPending(true);
    setCode(undefined);
    setIssues({});
    const result = await workspaceRequest(
      `farms/${farmId}/animals${animal ? "/" + animal.id : ""}`,
      animalSchema,
      animal ? "PATCH" : "POST",
      parsed.data,
    );
    if (!alive.current) return;
    busy.current = false;
    setPending(false);
    if (result.data) {
      if (animal) onSaved?.();
      else router.replace(`/app/farms/${farmId}/animals/${result.data.id}`);
    } else {
      setCode(result.code);
      if (result.fields) {
        const next: Record<string, string> = {};
        for (const name of result.fields) next[name] = t.invalid;
        setIssues(next);
      }
      requestAnimationFrame(() => feedback.current?.focus());
    }
  }
  const fields = [
    { name: "tagNumber", label: t.tag, max: 50, required: true },
    { name: "name", label: t.name, max: 100 },
    { name: "rfidNumber", label: t.rfid, max: 50 },
    { name: "breed", label: t.breed, max: 100 },
    { name: "dateOfBirth", label: t.dob, type: "date", hint: t.dateHint },
    {
      name: "weightKg",
      label: t.weight,
      type: "number",
      hint: "0.01–9999.99 kg",
    },
  ] as const;
  return (
    <form
      data-animal-form
      onSubmit={submit}
      noValidate
      className={styles.card}
      aria-busy={pending}
    >
      <FarmWriteNotice
        allowed={allowed}
        loading={access.access.loading || (!animal && access.quota.loading)}
        quotaBlocked={
          !animal && access.quota.data?.quotas.animals.canAccommodate === false
        }
        onRetry={access.reload}
      />
      {code && (
        <div
          ref={feedback}
          tabIndex={-1}
          role="alert"
          className="mb-5 text-sm text-[#87271f]"
        >
          {code === "CONFLICT"
            ? t.conflict
            : ["TIMEOUT", "UNAVAILABLE"].includes(code)
              ? t.writeTimeout
              : ((shared.errors as Record<string, string>)[code] ??
                shared.errors.DEFAULT)}
        </div>
      )}
      <fieldset disabled={pending} className={styles.formFields}>
        <div className={styles.grid}>
          {fields.map((field) => (
            <Field
              key={field.name}
              name={field.name}
              label={
                field.label +
                ("required" in field && field.required ? " *" : "")
              }
              error={issues[field.name]}
              hint={"hint" in field ? field.hint : undefined}
            >
              <input
                id={field.name}
                name={field.name}
                type={"type" in field ? field.type : "text"}
                value={values[field.name]}
                onChange={(event) => change(field.name, event.target.value)}
                required={"required" in field && field.required}
                maxLength={"max" in field ? field.max : undefined}
                min={field.name === "weightKg" ? "0.01" : undefined}
                max={
                  field.name === "weightKg"
                    ? "9999.99"
                    : field.name === "dateOfBirth"
                      ? new Date().toISOString().slice(0, 10)
                      : undefined
                }
                step={field.name === "weightKg" ? "0.01" : undefined}
                aria-invalid={!!issues[field.name]}
                aria-describedby={
                  issues[field.name]
                    ? `${field.name}-error`
                    : "hint" in field
                      ? `${field.name}-hint`
                      : undefined
                }
              />
            </Field>
          ))}
          {(
            [
              {
                name: "species",
                label: shared.species,
                options: Object.values(AnimalSpecies),
              },
              {
                name: "gender",
                label: t.gender,
                options: Object.values(AnimalGender),
              },
              {
                name: "status",
                label: t.status,
                options: Object.values(AnimalStatus),
              },
            ] as const
          ).map((field) => (
            <Field
              key={field.name}
              name={field.name}
              label={`${field.label} *`}
              error={issues[field.name]}
            >
              <select
                id={field.name}
                name={field.name}
                value={values[field.name]}
                onChange={(event) => change(field.name, event.target.value)}
                required
                aria-invalid={!!issues[field.name]}
                aria-describedby={
                  issues[field.name] ? `${field.name}-error` : undefined
                }
              >
                <option value="">—</option>
                {field.options.map((value) => (
                  <option key={value} value={value}>
                    {(t.options as Record<string, string>)[value] ??
                      option(shared, value)}
                  </option>
                ))}
              </select>
            </Field>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            type="submit"
            disabled={
              pending ||
              !allowed ||
              (!!animal &&
                !Object.keys(buildAnimalWritePayload(values, initial)).length)
            }
          >
            {pending ? shared.saving : t.save}
          </Button>
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={pending}
            >
              {t.cancel}
            </Button>
          )}
        </div>
      </fieldset>
    </form>
  );
}
