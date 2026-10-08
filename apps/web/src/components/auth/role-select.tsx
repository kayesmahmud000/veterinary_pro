"use client";

import {
  BookOpen,
  ChevronDown,
  ShoppingBag,
  Sprout,
  Stethoscope,
} from "lucide-react";
import { PUBLIC_ROLES } from "@/lib/auth/contracts";
import type { AuthMessages } from "@/lib/i18n/auth";

const roleIcons = {
  LEARNER: BookOpen,
  FARMER: Sprout,
  VET: Stethoscope,
  BUYER: ShoppingBag,
};

export function RoleSelect({
  value,
  onValueChange,
  copy,
  error,
}: {
  value: string;
  onValueChange: (value: string) => void;
  copy: Pick<AuthMessages, "role" | "roles" | "roleDescriptions">;
  error?: string;
}) {
  const selected = PUBLIC_ROLES.find((role) => role === value) ?? "LEARNER";
  const Icon = roleIcons[selected];
  return (
    <>
      <label htmlFor="auth-role">{copy.role}</label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-2 flex h-8 w-8 items-center justify-center rounded-lg bg-paper text-green">
          <Icon size={18} aria-hidden="true" />
        </span>
        <select
          id="auth-role"
          name="role"
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={`auth-role-description${error ? " auth-role-error" : ""}`}
          className="appearance-none !rounded-xl !pl-12 !pr-9 !text-sm font-medium transition-colors hover:!border-green disabled:cursor-wait disabled:!bg-paper"
          required
        >
          {PUBLIC_ROLES.map((role) => (
            <option key={role} value={role}>
              {copy.roles[role]}
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-4 text-green"
        />
      </div>
      <p
        id="auth-role-description"
        aria-live="polite"
        className="!mb-0 mt-2 rounded-lg bg-[#edf2e9] px-3 py-2 text-sm leading-6 text-muted"
      >
        {copy.roleDescriptions[selected]}
      </p>
      {error && (
        <span
          id="auth-role-error"
          className="mt-1.5 block text-xs leading-6 text-[#a73425]"
        >
          {error}
        </span>
      )}
    </>
  );
}
