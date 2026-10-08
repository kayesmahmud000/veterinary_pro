import * as React from "react";
import { cn } from "@/lib/ui/cn";

// shadcn/ui Card primitives with this site's existing colors and spacing.
export const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-2xl border border-solid border-line bg-white text-ink shadow-[0_4px_24px_#183f3206]",
      className,
    )}
    {...props}
  />
));
Card.displayName = "Card";
export const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col gap-3 p-6", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";
export const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("px-6 pb-6", className)} {...props} />
));
CardContent.displayName = "CardContent";
export const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-wrap items-center gap-3 px-6 pb-6", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";
