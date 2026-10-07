import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Exact arbitrary font sizes do not emit a line-height. Keep the independently
// declared leading when composing an existing button with a new font size.
const merge = extendTailwindMerge({
  override: { conflictingClassGroups: { "font-size": [] } },
});

/** Compose complete Tailwind classes; later component overrides win. */
export function cn(...inputs: ClassValue[]) {
  return merge(clsx(inputs));
}
