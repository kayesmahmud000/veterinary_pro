import type { HTMLAttributes } from "react";
import { cn } from "@/lib/ui/cn";
export function Badge({
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-solid border-line bg-[#eff2eb] px-3 py-1 text-xs font-medium leading-5 text-ink",
        className,
      )}
      {...props}
    />
  );
}
