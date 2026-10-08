"use client";
import { cn } from "@/lib/ui/cn";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { z } from "zod";
import { workspaceRequest } from "@/lib/workspace/client";
import type { Question, WorkspaceResult } from "@/lib/workspace/contracts";
import type { WorkspaceMessages } from "@/lib/i18n/workspace";
import styles from "./workspace.styles";
export type Issues = Record<string, string>;
export function useRemote<T>(
  path: string | null,
  schema: z.ZodType<T, any, any>,
) {
  const [result, setResult] = useState<WorkspaceResult<T>>({ status: 0 });
  const [scope, setScope] = useState<string | null>(null);
  const [loading, setLoading] = useState(true),
    [revision, revise] = useState(0);
  useEffect(() => {
    if (!path) {
      setLoading(false);
      setResult({ status: 0 });
      return;
    }
    let active = true;
    setScope(path);
    setLoading(true);
    setResult({ status: 0 });
    void workspaceRequest(path, schema).then((value) => {
      if (active) {
        setResult(value);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [path, schema, revision]);
  const current = scope === path;
  return {
    ...(current ? result : { status: 0 }),
    loading: !!path && (!current || loading),
    reload: () => revise((v) => v + 1),
  };
}
export function option(t: WorkspaceMessages, value: string) {
  return (t.options as Record<string, string>)[value] ?? value;
}
export function Notice({
  code,
  text,
  t,
}: {
  code?: string;
  text?: string;
  t: WorkspaceMessages;
}) {
  if (!code && !text) return null;
  return (
    <div
      className={cn(code ? styles.error : styles.notice)}
      role={code ? "alert" : "status"}
    >
      {text ?? (t.errors as Record<string, string>)[code!] ?? t.errors.DEFAULT}
    </div>
  );
}
export function Field({
  name,
  label,
  error,
  hint,
  children,
}: {
  name: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn(styles.field)}>
      <label htmlFor={name}>{label}</label>
      {children}
      {hint && <small id={`${name}-hint`}>{hint}</small>}
      {error && (
        <small className={cn(styles.fieldError)} id={`${name}-error`}>
          {error}
        </small>
      )}
    </div>
  );
}
export function validate<T>(
  schema: z.ZodType<T, any, any>,
  value: unknown,
  setIssues: (v: Issues) => void,
  t: WorkspaceMessages,
): T | null {
  const result = schema.safeParse(value);
  if (result.success) {
    setIssues({});
    return result.data;
  }
  const issues: Issues = {};
  for (const issue of result.error.issues)
    issues[issue.path.join(".").replace(/^answers\./, "")] = t.fieldError;
  setIssues(issues);
  requestAnimationFrame(() => {
    const key = Object.keys(issues)[0];
    document.getElementById(key)?.focus();
  });
  return null;
}
export function QuestionFields({
  fields,
  values,
  change,
  issues,
  locale,
  t,
}: {
  fields: Question[];
  values: Record<string, unknown>;
  change: (key: string, value: unknown) => void;
  issues: Issues;
  locale: "bn" | "en";
  t: WorkspaceMessages;
}) {
  return (
    <div className={cn(styles.grid)}>
      {fields.map((field) => {
        const props = {
          id: field.key,
          name: field.key,
          "aria-invalid": !!issues[field.key],
          "aria-describedby": issues[field.key]
            ? `${field.key}-error`
            : undefined,
          required: field.required,
        };
        const label =
          field.label[locale] + (field.required ? " *" : ` (${t.optional})`);
        if (field.type === "multiselect")
          return (
            <fieldset
              key={field.key}
              id={field.key}
              className={cn(styles.choices)}
              tabIndex={-1}
              aria-describedby={
                issues[field.key] ? `${field.key}-error` : undefined
              }
            >
              <legend>{label}</legend>
              {field.options?.map((value) => (
                <label key={value}>
                  <input
                    type="checkbox"
                    checked={
                      Array.isArray(values[field.key]) &&
                      (values[field.key] as unknown[]).includes(value)
                    }
                    onChange={(event) => {
                      const selected = Array.isArray(values[field.key])
                        ? (values[field.key] as string[])
                        : [];
                      change(
                        field.key,
                        event.target.checked
                          ? [...selected, value]
                          : selected.filter((v) => v !== value),
                      );
                    }}
                  />
                  {option(t, value)}
                </label>
              ))}
              {issues[field.key] && (
                <small
                  id={`${field.key}-error`}
                  className={cn(styles.fieldError)}
                >
                  {issues[field.key]}
                </small>
              )}
            </fieldset>
          );
        if (field.type === "consent")
          return (
            <div key={field.key} className={cn(styles.full)}>
              <label className={cn(styles.checkbox)}>
                <input
                  {...props}
                  type="checkbox"
                  checked={values[field.key] === true}
                  onChange={(event) => change(field.key, event.target.checked)}
                />
                {label}
              </label>
              {issues[field.key] && (
                <small
                  className={cn(styles.fieldError)}
                  id={`${field.key}-error`}
                >
                  {issues[field.key]}
                </small>
              )}
            </div>
          );
        return (
          <Field
            key={field.key}
            name={field.key}
            label={label}
            error={issues[field.key]}
          >
            {field.type === "select" ? (
              <select
                {...props}
                value={String(values[field.key] ?? "")}
                onChange={(event) => change(field.key, event.target.value)}
              >
                <option value="">—</option>
                {field.options?.map((value) => (
                  <option key={value} value={value}>
                    {option(t, value)}
                  </option>
                ))}
              </select>
            ) : field.type === "text" && (field.max ?? 100) > 300 ? (
              <textarea
                {...props}
                rows={4}
                maxLength={field.max}
                value={String(values[field.key] ?? "")}
                onChange={(event) => change(field.key, event.target.value)}
              />
            ) : (
              <input
                {...props}
                type={field.type === "number" ? "number" : "text"}
                min={field.min}
                max={field.type === "number" ? field.max : undefined}
                step={field.type === "number" ? 1 : undefined}
                maxLength={
                  field.type === "text" ? (field.max ?? 100) : undefined
                }
                value={String(values[field.key] ?? "")}
                onChange={(event) => change(field.key, event.target.value)}
              />
            )}
          </Field>
        );
      })}
    </div>
  );
}
export function answerValues(
  fields: Question[],
  values: Record<string, unknown>,
) {
  const answers: Record<string, unknown> = {};
  for (const field of fields) {
    const raw = values[field.key];
    if (!field.required && (raw === "" || raw === undefined)) continue;
    answers[field.key] =
      field.type === "number"
        ? raw === "" || raw === undefined
          ? undefined
          : Number(raw)
        : raw;
  }
  return answers;
}
export function Answers({
  answers,
  t,
}: {
  answers: Record<string, unknown>;
  t: WorkspaceMessages;
}) {
  return (
    <dl className={cn(styles.details)}>
      {Object.entries(answers).map(([key, value]) => (
        <div key={key}>
          <dt>{(t.fields as Record<string, string>)[key] ?? key}</dt>
          <dd>
            {Array.isArray(value)
              ? value.map((v) => option(t, String(v))).join(", ")
              : typeof value === "boolean"
                ? value
                  ? "✓"
                  : "—"
                : option(t, String(value))}
          </dd>
        </div>
      ))}
    </dl>
  );
}
export function Confirmation({
  title,
  children,
  confirm,
  cancel,
  pending,
  t,
}: {
  title: string;
  children: ReactNode;
  confirm: () => void;
  cancel: () => void;
  pending: boolean;
  t: WorkspaceMessages;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const opener = document.activeElement as HTMLElement | null;
    element?.showModal();
    return () => {
      element?.close();
      opener?.isConnected && opener.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className={cn(styles.confirmation)}
      aria-labelledby="workspace-confirm-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) cancel();
      }}
    >
      <h2 id="workspace-confirm-title">{title}</h2>
      {children}
      <div className={cn(styles.actions)}>
        <button
          className={cn(styles.primary)}
          type="button"
          disabled={pending}
          onClick={confirm}
        >
          {pending ? t.saving : t.confirm}
        </button>
        <button
          className={cn(styles.secondary)}
          type="button"
          disabled={pending}
          onClick={cancel}
        >
          {t.cancel}
        </button>
      </div>
    </dialog>
  );
}
