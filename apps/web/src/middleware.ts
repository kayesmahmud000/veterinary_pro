import { NextResponse, type NextRequest } from "next/server";
import { findBlogPost } from "@/lib/public-content";
import { doctorProfiles } from "@/lib/doctor-data";
import { findDoctor } from "@/lib/doctor-directory";
import { checkProtectedAccess } from "@/lib/auth/route-session";
import {
  isProtectedWorkspacePath,
  protectedEntryUrl,
} from "@/lib/workspace/navigation";
// Next 14 renders thrown dynamic notFound() through an error document before
// the cookie-localized shell. Set the HTTP status here; the page renders the
// localized recovery content normally, preserving native language forms.
export async function middleware(request: NextRequest) {
  if (isProtectedWorkspacePath(request.nextUrl.pathname)) {
    const valid = await checkProtectedAccess(
      request.cookies.get("vetralink_access")?.value,
    );
    const response = valid
      ? NextResponse.next()
      : NextResponse.redirect(
          new URL(
            protectedEntryUrl(
              request.nextUrl.pathname + request.nextUrl.search,
            ),
            request.url,
          ),
        );
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Vary", "Cookie");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    return response;
  }
  const parts = request.nextUrl.pathname.split("/").filter(Boolean);
  let id = parts[1] ?? "";
  try {
    id = decodeURIComponent(id);
  } catch {
    return NextResponse.next({ status: 404 });
  }
  const missing =
    parts.length === 2 &&
    ((parts[0] === "blog" && !findBlogPost(id)) ||
      (parts[0] === "doctors" && !findDoctor(doctorProfiles, id)));
  return NextResponse.next(missing ? { status: 404 } : undefined);
}
export const config = {
  matcher: [
    "/blog/:path*",
    "/doctors/:path*",
    "/dashboard/:path*",
    "/account/:path*",
    "/admin/:path*",
    "/farm/:path*",
    "/app/farms/:path*",
  ],
};
