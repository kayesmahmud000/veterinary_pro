import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
export default function NotFound() {
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <SiteHeader />
      <main id="main-content" className="container not-found">
        <div className="eyebrow">404 / A LITTLE OFF THE PATH</div>
        <h1>Page not found.</h1>
        <p>
          This page may have moved, or the address may be incorrect. Head back
          to explore the Vetralink approach.
        </p>
        <Link className="button" href="/">
          <ArrowLeft size={18} aria-hidden="true" /> Back to home
        </Link>
      </main>
      <SiteFooter />
    </>
  );
}
