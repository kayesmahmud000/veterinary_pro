"use client";
import { cn } from "@/lib/ui/cn";
import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import {
  AnimalSpecies,
  FarmType,
  FarmRole,
  farmOnboardingSchema,
  farmOnboardingStatusSchema,
  addFarmMemberSchema,
  farmMemberSchema,
} from "@vetralink/shared-types";
import { useAuth } from "@/components/auth/auth-provider";
import { memberListSchema, type Question } from "@/lib/workspace/contracts";
import { workspaceRequest } from "@/lib/workspace/client";
import type { WorkspaceMessages } from "@/lib/i18n/workspace";
import {
  answerValues,
  Field,
  Notice,
  option,
  QuestionFields,
  useRemote,
  validate,
  type Issues,
} from "./workspace-ui";
import styles from "./workspace.styles";
export function FarmOnboarding({
  locale,
  t,
}: {
  locale: "bn" | "en";
  t: WorkspaceMessages;
}) {
  const router = useRouter(),
    auth = useAuth();
  const status = useRemote("farm/onboarding", farmOnboardingStatusSchema);
  const [mode, setMode] = useState<"create" | "join">("create"),
    [values, setValues] = useState<Record<string, unknown>>({
      country: "Bangladesh",
      farmType: FarmType.DAIRY,
    }),
    [farmId, setFarmId] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [issues, setIssues] = useState<Issues>({}),
    [code, setCode] = useState<string>(),
    [pending, setPending] = useState(false);
  const key = useRef(""),
    busy = useRef(false);
  const fields: Question[] = [
    {
      key: "name",
      type: "text",
      required: true,
      label: { bn: t.name, en: t.name },
      max: 100,
    },
    {
      key: "farmType",
      type: "select",
      required: true,
      label: { bn: t.farmType, en: t.farmType },
      options: Object.values(FarmType),
    },
    ...(["country", "district", "upazila", "address"] as const).map((name) => ({
      key: name,
      type: "text" as const,
      required: true,
      label: { bn: t[name], en: t[name] },
      max: name === "address" ? 500 : 100,
    })),
    {
      key: "species",
      type: "multiselect",
      required: true,
      label: { bn: t.species, en: t.species },
      options: Object.values(AnimalSpecies),
    },
    ...(["animalCount", "experienceYears"] as const).map((name) => ({
      key: name,
      type: "number" as const,
      required: true,
      label: { bn: t[name], en: t[name] },
      min: 0,
      max: name === "animalCount" ? 100000 : 80,
    })),
  ];
  function change(name: string, value: unknown) {
    setValues((v) => ({ ...v, [name]: value }));
    setIssues((v) => ({ ...v, [name]: "" }));
    setCode(undefined);
    key.current = "";
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy.current) return;
    key.current ||= crypto.randomUUID();
    const input =
      mode === "join"
        ? { mode, submissionKey: key.current, farmId, confirmed }
        : {
            mode,
            submissionKey: key.current,
            ...answerValues(fields, values),
            ...(values.gpsLat !== undefined && values.gpsLat !== ""
              ? { gpsLat: Number(values.gpsLat) }
              : {}),
            ...(values.gpsLng !== undefined && values.gpsLng !== ""
              ? { gpsLng: Number(values.gpsLng) }
              : {}),
          };
    const parsed = validate(farmOnboardingSchema, input, setIssues, t);
    if (!parsed) return;
    busy.current = true;
    setPending(true);
    setCode(undefined);
    const result = await workspaceRequest(
      "farm/onboarding",
      farmOnboardingStatusSchema,
      "POST",
      parsed,
    );
    busy.current = false;
    setPending(false);
    if (result.data && !result.data.required) {
      await auth.restore();
      router.replace("/farm");
    } else {
      setCode(result.code);
      status.reload();
    }
  }
  if (status.loading) return <Notice text={t.loading} t={t} />;
  if (status.code)
    return (
      <>
        <Notice code={status.code} t={t} />
        <button className={cn(styles.secondary)} onClick={status.reload}>
          {t.retry}
        </button>
      </>
    );
  if (status.data && !status.data.required)
    return (
      <>
        <Notice text={t.farmReady} t={t} />
        <Link className={cn(styles.primary)} href="/farm">
          {t.farmTitle}
        </Link>
      </>
    );
  return (
    <>
      <p className={cn(styles.intro)}>{t.setupBody}</p>
      <Notice code={code} t={t} />
      <form
        onSubmit={submit}
        noValidate
        className={cn(styles.card)}
        aria-busy={pending}
      >
        <fieldset className={cn(styles.formFields)} disabled={pending}>
          <Field name="setup-mode" label={t.setupMode}>
            <select
              id="setup-mode"
              value={mode}
              onChange={(event) => {
                setMode(event.target.value as "create" | "join");
                setIssues({});
                key.current = "";
              }}
            >
              <option value="create">{t.createFarm}</option>
              <option value="join">{t.existingFarm}</option>
            </select>
          </Field>
          {mode === "create" ? (
            <>
              <Notice text={t.ownerRole} t={t} />
              <p>{t.ownerHint}</p>
              <QuestionFields
                fields={fields}
                values={values}
                change={change}
                issues={issues}
                locale={locale}
                t={t}
              />
              <div className={cn(styles.grid, styles.actions)}>
                {(["gpsLat", "gpsLng"] as const).map((name) => (
                  <Field
                    key={name}
                    name={name}
                    label={t[name]}
                    error={issues[name]}
                  >
                    <input
                      id={name}
                      name={name}
                      type="number"
                      step="any"
                      value={String(values[name] ?? "")}
                      onChange={(event) => change(name, event.target.value)}
                      aria-invalid={!!issues[name]}
                      aria-describedby={
                        issues[name] ? `${name}-error` : undefined
                      }
                    />
                  </Field>
                ))}
              </div>
              <p>{t.gpsHint}</p>
            </>
          ) : !status.data?.farms.length ? (
            <Notice text={t.noMembership} t={t} />
          ) : (
            <>
              <div className={cn(styles.actions)}>
                <Field name="farmId" label={t.selectFarm} error={issues.farmId}>
                  <select
                    id="farmId"
                    value={farmId}
                    onChange={(event) => {
                      setFarmId(event.target.value);
                      key.current = "";
                    }}
                  >
                    <option value="">—</option>
                    {status.data.farms.map((farm) => (
                      <option key={farm.id} value={farm.id}>
                        {farm.name} — {option(t, farm.farmType)} ·{" "}
                        {option(t, farm.role)}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <label className={cn(styles.checkbox)}>
                <input
                  id="confirmed"
                  type="checkbox"
                  checked={confirmed}
                  onChange={(event) => {
                    setConfirmed(event.target.checked);
                    key.current = "";
                  }}
                />
                {t.confirmMembership}
              </label>
              {issues.confirmed && (
                <small className={cn(styles.fieldError)}>
                  {issues.confirmed}
                </small>
              )}
            </>
          )}
          <div className={cn(styles.actions)}>
            <button
              className={cn(styles.primary)}
              type="submit"
              disabled={
                pending || (mode === "join" && !status.data?.farms.length)
              }
            >
              {pending ? t.saving : t.finishSetup}
            </button>
            <button
              className={cn(styles.secondary)}
              type="button"
              onClick={status.reload}
            >
              {t.retry}
            </button>
          </div>
        </fieldset>
      </form>
    </>
  );
}
