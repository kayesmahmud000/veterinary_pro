import Image from "next/image";
import Link from "next/link";
import logo from "../../../public/assets/brand/logo-green.jpeg";
import { cn } from "@/lib/ui/cn";

export function BrandLogo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative block h-12 w-12 shrink-0 overflow-hidden rounded-full",
        className,
      )}
    >
      <Image
        src={logo}
        alt=""
        width={64}
        height={64}
        sizes="48px"
        className="block h-full w-full scale-[1.37] object-cover"
      />
    </span>
  );
}

/** Shared accessible brand link; crop the supplied square artwork only in the UI. */
export function SiteBrand({
  homeLabel,
  name,
}: {
  homeLabel: string;
  name: string;
}) {
  return (
    <Link
      href="/"
      aria-label={homeLabel}
      className="inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap text-[1.35rem] font-bold tracking-[-0.035em] max-[1279px]:mr-auto max-[1279px]:text-[1.05rem] max-[380px]:text-[0.95rem]"
    >
      <BrandLogo className="max-[1279px]:h-10 max-[1279px]:w-10 max-[380px]:h-8 max-[380px]:w-8" />
      <span>{name}</span>
    </Link>
  );
}
