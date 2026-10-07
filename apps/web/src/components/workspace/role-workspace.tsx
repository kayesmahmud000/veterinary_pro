"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ProfessionalRole,
  UserRole,
  submitRoleRequestSchema,
  roleRequestSchema,
  roleDecisionSchema,
} from "@vetralink/shared-types";
import { useAuth } from "@/components/auth/auth-provider";
import {
  questionnaireSchema,
  requestListSchema,
  reviewQueueSchema,
  reviewDetailSchema,
  decisionResponseSchema,
} from "@/lib/workspace/contracts";
import { workspaceRequest } from "@/lib/workspace/client";
import type { WorkspaceMessages } from "@/lib/i18n/workspace";
import {
  answerValues,
  Answers,
  Confirmation,
  Field,
  Notice,
  option,
  QuestionFields,
  useRemote,
  validate,
  type Issues,
} from "./workspace-ui";
import styles from "./workspace.module.css";
export function RoleApplication({
  locale,
  t,
}: {
  locale: "bn" | "en";
  t: WorkspaceMessages;
}) {
  const router = useRouter(),
    [target, setTarget] = useState<ProfessionalRole>(ProfessionalRole.FARMER),
    [values, setValues] = useState<Record<string, unknown>>({}),
    [issues, setIssues] = useState<Issues>({}),
    [pending, setPending] = useState(false),
    [code, setCode] = useState<string>();
  const busy = useRef(false),
    key = useRef(""),
    questionnaire = useRemote(`questionnaires/${target}`, questionnaireSchema),
    existing = useRemote(
      "me/role-requests?status=PENDING&limit=1",
      requestListSchema,
    );
  function change(name: string, value: unknown) {
    setValues((v) => ({ ...v, [name]: value }));
    setIssues((v) => ({ ...v, [name]: "" }));
    setCode(undefined);
    key.current = "";
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (
      busy.current ||
      questionnaire.data?.targetRole !== target ||
      existing.data?.requests.length
    )
      return;
    key.current ||= crypto.randomUUID();
    const input = validate(
      submitRoleRequestSchema,
      {
        targetRole: target,
        questionnaireVersion: questionnaire.data.version,
        locale,
        submissionKey: key.current,
        answers: answerValues(questionnaire.data.fields, values),
      },
      setIssues,
      t,
    );
    if (!input) return;
    busy.current = true;
    setPending(true);
    setCode(undefined);
    const result = await workspaceRequest(
      "me/role-requests",
      roleRequestSchema,
      "POST",
      input,
    );
    busy.current = false;
    setPending(false);
    if (result.data) router.push(`/account/role-requests/${result.data.id}`);
    else {
      setCode(result.code);
      existing.reload();
    }
  }
  if (existing.loading) return <Notice text={t.loading} t={t} />;
  if (existing.code)
    return (
      <>
        <Notice code={existing.code} t={t} />
        <button className={styles.secondary} onClick={existing.reload}>
          {t.retry}
        </button>
      </>
    );
  if (existing.data?.requests.length)
    return (
      <>
        <Notice text={t.pending} t={t} />
        <Link className={styles.primary} href="/account/role-requests">
          {t.applicationsTitle}
        </Link>
      </>
    );
  return (
    <>
      <p className={styles.intro}>{t.applicationBody}</p>
      <Notice code={code} t={t} />
      <form
        onSubmit={submit}
        noValidate
        aria-busy={pending}
        className={styles.card}
      >
        <fieldset className={styles.formFields} disabled={pending}>
          <Field
            name="targetRole"
            label={t.chooseRole}
            error={issues.targetRole}
          >
            <select
              id="targetRole"
              value={target}
              onChange={(event) => {
                setTarget(event.target.value as ProfessionalRole);
                setValues({});
                setIssues({});
                key.current = "";
              }}
            >
              {Object.values(ProfessionalRole).map((role) => (
                <option key={role} value={role}>
                  {option(t, role)}
                </option>
              ))}
            </select>
          </Field>
          {questionnaire.code ? (
            <>
              <Notice code={questionnaire.code} t={t} />
              <button
                type="button"
                className={styles.secondary}
                onClick={questionnaire.reload}
              >
                {t.retry}
              </button>
            </>
          ) : questionnaire.loading ||
            questionnaire.data?.targetRole !== target ? (
            <Notice text={t.loading} t={t} />
          ) : (
            <div className={styles.actions}>
              <QuestionFields
                fields={questionnaire.data.fields}
                values={values}
                change={change}
                issues={issues}
                locale={locale}
                t={t}
              />
            </div>
          )}
          <div className={styles.actions}>
            <button
              className={styles.primary}
              disabled={
                pending ||
                questionnaire.loading ||
                !questionnaire.data ||
                !!questionnaire.code
              }
            >
              {pending ? t.saving : t.submit}
            </button>
            <Link className={styles.secondary} href="/account/role-requests">
              {t.applicationsTitle}
            </Link>
          </div>
        </fieldset>
      </form>
    </>
  );
}
export function RoleHistory({
  locale,
  t,
  id,
}: {
  locale: "bn" | "en";
  t: WorkspaceMessages;
  id?: string;
}) {
  const auth = useAuth(),
    [status, setStatus] = useState(""),
    [cursor, setCursor] = useState("");
  const list = useRemote(
      !id
        ? `me/role-requests?limit=20${status ? `&status=${status}` : ""}${cursor ? `&cursor=${cursor}` : ""}`
        : null,
      requestListSchema,
    ),
    single = useRemote(id ? `me/role-requests/${id}` : null, roleRequestSchema);
  const requests = id
      ? single.data
        ? [single.data]
        : []
      : (list.data?.requests ?? []),
    loading = id ? single.loading : list.loading,
    code = id ? single.code : list.code,
    reload = id ? single.reload : list.reload;
  useEffect(() => {
    if (
      requests.some((r) => r.status === "APPROVED") &&
      auth.user?.role === UserRole.LEARNER
    )
      void auth.restore();
  }, [list.data, single.data, auth.user?.role]);
  const date = (value: string) =>
    new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  return (
    <>
      <div className={styles.actions}>
        {auth.user?.role === UserRole.LEARNER && (
          <Link className={styles.primary} href="/account/role-requests/new">
            {t.newApplication}
          </Link>
        )}
        <button
          type="button"
          className={styles.secondary}
          onClick={() => {
            reload();
            void auth.restore();
          }}
        >
          {t.refresh}
        </button>
        {!id && (
          <Field name="history-status" label={t.filter}>
            <select
              id="history-status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setCursor("");
              }}
            >
              <option value="">{t.all}</option>
              {["PENDING", "APPROVED", "REJECTED"].map((s) => (
                <option key={s} value={s}>
                  {option(t, s)}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>
      <Notice code={code} t={t} />
      {loading ? (
        <Notice text={t.loading} t={t} />
      ) : !requests.length && !code ? (
        <Notice text={t.noResults} t={t} />
      ) : (
        requests.map((request) => (
          <article className={styles.card} key={request.id}>
            <h2>{option(t, request.targetRole)}</h2>
            <span className={styles.badge} data-state={request.status}>
              {option(t, request.status)}
            </span>
            <p>
              {t.submittedAt}: {date(request.submittedAt)}
            </p>
            <Notice
              text={
                request.status === "PENDING"
                  ? t.pending
                  : request.status === "APPROVED"
                    ? t.approved
                    : t.rejected
              }
              t={t}
            />
            {request.publicDecisionReason && (
              <p>{request.publicDecisionReason}</p>
            )}
            {id ? (
              <>
                <h3>{t.responses}</h3>
                <Answers answers={request.answers} t={t} />
              </>
            ) : (
              <Link
                className={styles.secondary}
                href={`/account/role-requests/${request.id}`}
              >
                {t.details}
              </Link>
            )}
            {request.status === "APPROVED" &&
              auth.user?.role === UserRole.FARMER && (
                <div className={styles.actions}>
                  <Link
                    className={styles.primary}
                    href={
                      auth.user.farmerOnboardingRequired
                        ? "/account/farm-onboarding"
                        : "/farm"
                    }
                  >
                    {auth.user.farmerOnboardingRequired
                      ? t.setupTitle
                      : t.farmTitle}
                  </Link>
                </div>
              )}
          </article>
        ))
      )}
      {!id && list.data?.nextCursor && (
        <div className={styles.actions}>
          <button
            className={styles.secondary}
            onClick={() => setCursor(list.data!.nextCursor!)}
          >
            {t.next}
          </button>
        </div>
      )}
    </>
  );
}
export function ReviewQueue({
  locale,
  t,
}: {
  locale: "bn" | "en";
  t: WorkspaceMessages;
}) {
  const [status, setStatus] = useState("PENDING"),
    [target, setTarget] = useState(""),
    [cursor, setCursor] = useState("");
  const queue = useRemote(
    `admin/role-requests?limit=20${status ? `&status=${status}` : ""}${target ? `&targetRole=${target}` : ""}${cursor ? `&cursor=${cursor}` : ""}`,
    reviewQueueSchema,
  );
  return (
    <>
      <div className={`${styles.grid} ${styles.card}`}>
        <Field name="review-status" label={t.filter}>
          <select
            id="review-status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setCursor("");
            }}
          >
            <option value="">{t.all}</option>
            {["PENDING", "APPROVED", "REJECTED"].map((s) => (
              <option key={s} value={s}>
                {option(t, s)}
              </option>
            ))}
          </select>
        </Field>
        <Field name="review-role" label={t.chooseRole}>
          <select
            id="review-role"
            value={target}
            onChange={(event) => {
              setTarget(event.target.value);
              setCursor("");
            }}
          >
            <option value="">{t.all}</option>
            {Object.values(ProfessionalRole).map((role) => (
              <option key={role} value={role}>
                {option(t, role)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Notice code={queue.code} t={t} />
      {queue.loading ? (
        <Notice text={t.loading} t={t} />
      ) : (
        <section className={styles.card}>
          {!queue.data?.requests.length && !queue.code ? (
            <p>{t.noResults}</p>
          ) : (
            <ul className={styles.list}>
              {queue.data?.requests.map((request) => (
                <li key={request.id}>
                  <div>
                    <strong>
                      {request.applicant.name} · {option(t, request.targetRole)}
                    </strong>
                    <small>{request.applicant.email}</small>
                    <small>
                      {new Intl.DateTimeFormat(
                        locale === "bn" ? "bn-BD" : "en-GB",
                        { dateStyle: "medium" },
                      ).format(new Date(request.submittedAt))}{" "}
                      · {option(t, request.status)}
                    </small>
                  </div>
                  <Link
                    className={styles.secondary}
                    href={`/admin/role-requests/${request.id}`}
                  >
                    {t.details}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      <div className={styles.actions}>
        <button className={styles.secondary} onClick={queue.reload}>
          {t.refresh}
        </button>
        {queue.data?.nextCursor && (
          <button
            className={styles.secondary}
            onClick={() => setCursor(queue.data!.nextCursor!)}
          >
            {t.next}
          </button>
        )}
      </div>
    </>
  );
}
export function ApplicationReview({
  id,
  t,
}: {
  id: string;
  t: WorkspaceMessages;
}) {
  const auth = useAuth(),
    detail = useRemote(`admin/role-requests/${id}`, reviewDetailSchema),
    [decision, setDecision] = useState<"APPROVED" | "REJECTED">("APPROVED"),
    [publicReason, setPublicReason] = useState(""),
    [privateNote, setPrivateNote] = useState(""),
    [verification, setVerification] = useState(""),
    [issues, setIssues] = useState<Issues>({}),
    [code, setCode] = useState<string>(),
    [pending, setPending] = useState(false),
    [success, setSuccess] = useState(false),
    [confirmation, setConfirmation] = useState<ReturnType<
      typeof roleDecisionSchema.parse
    > | null>(null);
  const busy = useRef(false),
    row = detail.data;
  function review(event: FormEvent) {
    event.preventDefault();
    if (!row || busy.current) return;
    const schema = roleDecisionSchema.superRefine((v, ctx) => {
      if (
        row.request.targetRole === ProfessionalRole.VET &&
        v.decision === "APPROVED" &&
        !v.qualificationVerificationNote
      )
        ctx.addIssue({
          code: "custom",
          path: ["qualificationVerificationNote"],
          message: "required",
        });
    });
    const input = validate(
      schema,
      {
        decision,
        expectedRequestVersion: row.request.requestVersion,
        expectedApplicantRoleVersion: row.applicant.roleVersion ?? 0,
        ...(publicReason.trim() ? { publicReason } : {}),
        ...(privateNote.trim() ? { privateNote } : {}),
        ...(verification.trim()
          ? { qualificationVerificationNote: verification }
          : {}),
      },
      setIssues,
      t,
    );
    if (input) setConfirmation(input);
  }
  async function submit() {
    if (!confirmation || busy.current) return;
    busy.current = true;
    setPending(true);
    setCode(undefined);
    const result = await workspaceRequest(
      `admin/role-requests/${id}/decision`,
      decisionResponseSchema,
      "POST",
      confirmation,
    );
    busy.current = false;
    setPending(false);
    setConfirmation(null);
    if (result.data) {
      setSuccess(true);
      detail.reload();
    } else {
      setCode(result.code);
      detail.reload();
    }
  }
  if (detail.loading) return <Notice text={t.loading} t={t} />;
  if (detail.code || !row)
    return (
      <>
        <Notice code={detail.code ?? "NOT_FOUND"} t={t} />
        <button className={styles.secondary} onClick={detail.reload}>
          {t.retry}
        </button>
      </>
    );
  const eligible =
    row.request.status === "PENDING" &&
    row.applicant.status === "ACTIVE" &&
    !row.applicant.isDeleted &&
    row.applicant.role === UserRole.LEARNER &&
    row.applicant.id !== auth.user?.id;
  return (
    <>
      <Notice code={code} text={success ? t.saved : undefined} t={t} />
      <section className={styles.card}>
        <h2>{row.applicant.name}</h2>
        <p>
          {row.applicant.email} · {option(t, row.applicant.role)}
        </p>
        <span className={styles.badge} data-state={row.request.status}>
          {option(t, row.request.targetRole)} · {option(t, row.request.status)}
        </span>
        <h3 className={styles.actions}>{t.responses}</h3>
        <Answers answers={row.request.answers} t={t} />
        {row.request.publicDecisionReason && (
          <p>
            {t.publicReason}: {row.request.publicDecisionReason}
          </p>
        )}
        {row.request.privateReviewNote && (
          <p>
            {t.privateNote}: {row.request.privateReviewNote}
          </p>
        )}
        {row.request.qualificationVerificationNote && (
          <p>
            {t.verification}: {row.request.qualificationVerificationNote}
          </p>
        )}
      </section>
      {!eligible ? (
        <Notice
          text={
            row.request.status !== "PENDING"
              ? t.reviewed
              : t.errors.APPLICANT_INELIGIBLE
          }
          t={t}
        />
      ) : (
        <form
          className={styles.card}
          onSubmit={review}
          noValidate
          aria-busy={pending}
        >
          <h2>{t.decision}</h2>
          {row.request.targetRole === ProfessionalRole.VET && (
            <Notice text={t.vetNotice} t={t} />
          )}
          <fieldset className={styles.formFields} disabled={pending}>
            <div className={styles.grid}>
              <Field name="decision" label={t.decision}>
                <select
                  id="decision"
                  value={decision}
                  onChange={(event) =>
                    setDecision(event.target.value as "APPROVED" | "REJECTED")
                  }
                >
                  <option value="APPROVED">{t.approve}</option>
                  <option value="REJECTED">{t.reject}</option>
                </select>
              </Field>
              <Field
                name="publicReason"
                label={`${t.publicReason}${decision === "REJECTED" ? " *" : ` (${t.optional})`}`}
                error={issues.publicReason}
              >
                <textarea
                  id="publicReason"
                  maxLength={500}
                  rows={3}
                  value={publicReason}
                  onChange={(event) => setPublicReason(event.target.value)}
                  aria-invalid={!!issues.publicReason}
                  aria-describedby={
                    issues.publicReason ? "publicReason-error" : undefined
                  }
                />
              </Field>
              <Field
                name="privateNote"
                label={`${t.privateNote} (${t.optional})`}
                error={issues.privateNote}
              >
                <textarea
                  id="privateNote"
                  maxLength={1000}
                  rows={3}
                  value={privateNote}
                  onChange={(event) => setPrivateNote(event.target.value)}
                  aria-invalid={!!issues.privateNote}
                />
              </Field>
              {row.request.targetRole === ProfessionalRole.VET && (
                <Field
                  name="qualificationVerificationNote"
                  label={`${t.verification}${decision === "APPROVED" ? " *" : ""}`}
                  error={issues.qualificationVerificationNote}
                >
                  <textarea
                    id="qualificationVerificationNote"
                    maxLength={1000}
                    rows={3}
                    value={verification}
                    onChange={(event) => setVerification(event.target.value)}
                    aria-invalid={!!issues.qualificationVerificationNote}
                    aria-describedby={
                      issues.qualificationVerificationNote
                        ? "qualificationVerificationNote-error"
                        : undefined
                    }
                  />
                </Field>
              )}
            </div>
            <div className={styles.actions}>
              <button className={styles.primary} disabled={pending}>
                {decision === "APPROVED" ? t.approve : t.reject}
              </button>
              <button
                className={styles.secondary}
                type="button"
                onClick={detail.reload}
              >
                {t.refresh}
              </button>
            </div>
          </fieldset>
        </form>
      )}
      <section className={styles.card}>
        <h2>{t.history}</h2>
        <ul className={styles.list}>
          {row.history.map((request) => (
            <li key={request.id}>
              {option(t, request.targetRole)} · {option(t, request.status)}
            </li>
          ))}
        </ul>
      </section>
      {confirmation && (
        <Confirmation
          title={t.decisionConfirm}
          confirm={() => void submit()}
          cancel={() => setConfirmation(null)}
          pending={pending}
          t={t}
        >
          <p>
            {row.applicant.name} · {row.applicant.email}
          </p>
          <p>
            {option(t, row.request.targetRole)} ·{" "}
            {option(t, confirmation.decision)}
          </p>
          {confirmation.publicReason && <p>{confirmation.publicReason}</p>}
        </Confirmation>
      )}
    </>
  );
}
