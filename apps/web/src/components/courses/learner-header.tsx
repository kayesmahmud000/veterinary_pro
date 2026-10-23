"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { PublicAccountMenu } from "@/components/auth/public-account-menu";
import { SiteBrand } from "@/components/brand/site-brand";
import { LanguageSwitcher } from "@/components/marketing/language-switcher";
import { getCourseMessages } from "@/lib/i18n/courses";
import styles from "./course.styles";
export function LearnerHeader({
  brand,
  home,
  language,
}: {
  brand: string;
  home: string;
  language: string;
}) {
  const auth = useAuth(),
    t = getCourseMessages(auth.locale),
    pathname = usePathname();
  return (
    <header
      data-learner-header
      className="border-x-0 border-t-0 border-b border-solid border-line bg-white"
    >
      <div className="mx-auto flex w-11/12 flex-wrap items-center justify-between gap-3 py-3">
        <SiteBrand name={brand} homeLabel={home} />
        <div className="flex items-center gap-3">
          <LanguageSwitcher locale={auth.locale} label={language} />
          {auth.user && <PublicAccountMenu />}
        </div>
        <nav
          aria-label={t.courses}
          className="flex w-full flex-wrap gap-5 border-x-0 border-b-0 border-t border-solid border-line pt-2"
        >
          <Link href="/courses" className={styles.link}>
            {t.browse}
          </Link>
          <Link
            href="/account/courses"
            aria-current={pathname === "/account/courses" ? "page" : undefined}
            className={`${styles.link} aria-[current=page]:underline`}
          >
            {t.library}
          </Link>
        </nav>
      </div>
    </header>
  );
}
