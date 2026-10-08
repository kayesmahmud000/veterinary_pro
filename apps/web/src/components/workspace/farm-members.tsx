"use client";
import { useRef, useState, type FormEvent } from "react";
import {
  FarmRole,
  addFarmMemberSchema,
  farmMemberSchema,
} from "@vetralink/shared-types";
import { useAuth } from "@/components/auth/auth-provider";
import { memberListSchema } from "@/lib/workspace/contracts";
import { workspaceRequest } from "@/lib/workspace/client";
import type { WorkspaceMessages } from "@/lib/i18n/workspace";
import { cn } from "@/lib/ui/cn";
import { useFarmContext, useFarmDirty } from "./farm-context";
import {
  useRemote,
  Field,
  Notice,
  option,
  validate,
  type Issues,
} from "./workspace-ui";
import { useFarmAccess, FarmWriteNotice } from "./farm-access";
import styles from "./workspace.styles";
export function FarmMembers({ t }: { t: WorkspaceMessages }) {
  const auth = useAuth(),
    { farm, farmId } = useFarmContext();
  const [email, setEmail] = useState(""),
    [role, setRole] = useState<FarmRole>(FarmRole.HERDSMAN),
    [issues, setIssues] = useState<Issues>({}),
    [code, setCode] = useState<string>(),
    [success, setSuccess] = useState(false),
    [pending, setPending] = useState(false);
  const busy = useRef(false),
    access = useFarmAccess();
  const members = useRemote(`farms/${farmId}/members`, memberListSchema);
  useFarmDirty(!!email);
  async function add(event: FormEvent) {
    event.preventDefault();
    if (!farm || busy.current || !access.canAddMember) return;
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
  return (
    <>
      {farm && (
        <>
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
              <FarmWriteNotice
                allowed={access.canAddMember}
                loading={access.access.loading || access.quota.loading}
                quotaBlocked={
                  access.quota.data?.quotas.staff.canAccommodate === false
                }
                staff
                onRetry={access.reload}
              />
              <fieldset
                className={cn(styles.formFields)}
                disabled={pending || !access.canAddMember}
              >
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
                  <button
                    className={cn(styles.primary)}
                    disabled={pending || !access.canAddMember}
                  >
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
