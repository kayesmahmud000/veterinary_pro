"use client";

import * as React from "react";
import * as Primitive from "@radix-ui/react-navigation-menu";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/ui/cn";

// shadcn/ui NavigationMenu composition; local content avoids an animated viewport.
export const NavigationMenu = Primitive.Root;
export const NavigationMenuItem = Primitive.Item;
export const NavigationMenuLink = Primitive.Link;
export const navigationMenuTriggerStyle =
  "flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-lg border-0 bg-transparent px-2 py-2 font-medium text-inherit hover:bg-[#214e3a0d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber data-[state=open]:bg-[#214e3a0d] data-[active]:!text-[#a26913]";
export const NavigationMenuList = React.forwardRef<
  React.ElementRef<typeof Primitive.List>,
  React.ComponentPropsWithoutRef<typeof Primitive.List>
>(({ className, ...props }, ref) => (
  <Primitive.List
    ref={ref}
    className={cn("m-0 flex list-none items-center gap-1 p-0", className)}
    {...props}
  />
));
NavigationMenuList.displayName = "NavigationMenuList";
export const NavigationMenuTrigger = React.forwardRef<
  React.ElementRef<typeof Primitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof Primitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <Primitive.Trigger
    ref={ref}
    className={cn(navigationMenuTriggerStyle, "group", className)}
    {...props}
  >
    {children}
    <ChevronDown
      aria-hidden="true"
      size={14}
      className="transition-transform group-data-[state=open]:rotate-180"
    />
  </Primitive.Trigger>
));
NavigationMenuTrigger.displayName = "NavigationMenuTrigger";
export const NavigationMenuContent = React.forwardRef<
  React.ElementRef<typeof Primitive.Content>,
  React.ComponentPropsWithoutRef<typeof Primitive.Content>
>(({ className, ...props }, ref) => (
  <Primitive.Content
    ref={ref}
    className={cn(
      "absolute left-0 top-full z-30 mt-2 w-72 rounded-xl border border-solid border-line bg-white p-2 text-ink shadow-lg",
      className,
    )}
    {...props}
  />
));
NavigationMenuContent.displayName = "NavigationMenuContent";
