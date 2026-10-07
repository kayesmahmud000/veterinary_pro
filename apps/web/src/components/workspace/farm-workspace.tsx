"use client";
import { cn } from "@/lib/ui/cn";
import { useEffect, useRef, useState, type FormEvent } from "react";
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
                <small className={cn(styles.fieldError)}>{issues.confirmed}</small>
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
export function FarmDashboard({ t }: { t: WorkspaceMessages }) {
  const router = useRouter(),
    auth = useAuth(),
    farms = useRemote("farms", farmOnboardingStatusSchema);
  const [farmId, setFarmId] = useState(""),
    [email, setEmail] = useState(""),
    [role, setRole] = useState<FarmRole>(FarmRole.HERDSMAN),
    [issues, setIssues] = useState<Issues>({}),
    [code, setCode] = useState<string>(),
    [success, setSuccess] = useState(false),
    [pending, setPending] = useState(false);
  const busy = useRef(false);
  useEffect(() => {
    if (farms.data?.required) router.replace("/account/farm-onboarding");
    else if (
      farms.data?.farms.length &&
      !farms.data.farms.some((f) => f.id === farmId)
    )
      setFarmId(farms.data.farms[0]!.id);
  }, [farms.data, farmId, router]);
  const farm = farms.data?.farms.find((f) => f.id === farmId),
    members = useRemote(
      farm && !farms.data?.required ? `farms/${farm.id}/members` : null,
      memberListSchema,
    );
  async function add(event: FormEvent) {
    event.preventDefault();
    if (!farm || busy.current) return;
    const input = validate(addFarmMemberSchema, { email, role }, setIssues, t);
    if (!input) return;
    busy.current = true;
    setPending(true);
    setCode(undefined);
    setSuccess(false);
    const result = await workspaceRequest(
      `farms/${farm.id}/members`,
      farmMemberSchema,
      "POST",
      input,
    );
    busy.current = false;
    setPending(false);
    if (result.data) {
      setSuccess(true);
      setEmail("");
      members.reload();
    } else setCode(result.code);
  }
  if (farms.loading || farms.data?.required)
    return <Notice text={t.loading} t={t} />;
  if (farms.code)
    return (
      <>
        <Notice code={farms.code} t={t} />
        <button className={cn(styles.secondary)} onClick={farms.reload}>
          {t.retry}
        </button>
      </>
    );
  if (!farms.data?.farms.length)
    return <Notice text={t.membershipRequired} t={t} />;
  return (
    <>
      <p>{t.farmReady}</p>
      <Field name="active-farm" label={t.selectFarm}>
        <select
          id="active-farm"
          value={farmId}
          onChange={(event) => {
            setFarmId(event.target.value);
            setCode(undefined);
            setSuccess(false);
          }}
        >
          {farms.data.farms.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </Field>
      {farm && (
        <>
          <section className={cn(styles.card)}>
            <h2>{farm.name}</h2>
            <dl className={cn(styles.details)}>
              {(
                [
                  ["farmType", farm.farmType],
                  ["farmRole", farm.role],
                  ["country", farm.country],
                  ["address", farm.address],
                ] as const
              ).map(([key, value]) => (
                <div key={key}>
                  <dt>{t[key]}</dt>
                  <dd>{value ? option(t, value) : "—"}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section className={cn(styles.card)}>
            <h2>{t.membersTitle}</h2>
            <Notice code={members.code} t={t} />
            {members.loading ? (
              <p>{t.loading}</p>
            ) : (
              <ul className={cn(styles.list)}>
                {members.data?.items.map((member) => (
                  <li key={member.id}>
                    <div>
                      <strong>
                        {member.displayName ??
                          (member.userId === auth.user?.id
                            ? auth.user.name
                            : t.memberAccount)}
                      </strong>
                    </div>
                    <span className={cn(styles.badge)}>
                      {option(t, member.role)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <button
              className={cn(styles.secondary)}
              type="button"
              onClick={members.reload}
            >
              {t.refresh}
            </button>
          </section>
          {[FarmRole.OWNER, FarmRole.MANAGER].includes(farm.role) && (
            <form
              className={cn(styles.card)}
              onSubmit={add}
              noValidate
              aria-busy={pending}
            >
              <h2>{t.addMember}</h2>
              <p>{t.memberHint}</p>
              <p>{t.staffHint}</p>
              <Notice code={code} text={success ? t.added : undefined} t={t} />
              <fieldset className={cn(styles.formFields)} disabled={pending}>
                <div className={cn(styles.grid)}>
                  <Field
                    name="email"
                    label={t.memberEmail}
                    error={issues.email}
                  >
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="off"
                      maxLength={254}
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      aria-invalid={!!issues.email}
                      aria-describedby={
                        issues.email ? "email-error" : undefined
                      }
                    />
                  </Field>
                  <Field name="role" label={t.farmRole} error={issues.role}>
                    <select
                      id="role"
                      name="role"
                      value={role}
                      onChange={(event) =>
                        setRole(event.target.value as FarmRole)
                      }
                    >
                      {Object.values(FarmRole)
                        .filter(
                          (r) =>
                            r !== FarmRole.OWNER ||
                            farm.role === FarmRole.OWNER,
                        )
                        .map((r) => (
                          <option key={r} value={r}>
                            {option(t, r)}
                          </option>
                        ))}
                    </select>
                  </Field>
                </div>
                <div className={cn(styles.actions)}>
                  <button className={cn(styles.primary)} disabled={pending}>
                    {pending ? t.saving : t.addMember}
                  </button>
                </div>
              </fieldset>
            </form>
          )}
        </>
      )}
    </>
  );
}
