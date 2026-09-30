import createIntlMiddleware from "next-intl/middleware";
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "@/i18n/routing";
import { parseDateOverride, SEASON_NOW_HEADER } from "@/lib/shipping";
import { localizedPath, sanitizeNextPath } from "@/lib/auth/next-path";

const intlMiddleware = createIntlMiddleware(routing);

export async function middleware(request: NextRequest) {
  // Skip locale middleware for API routes
  if (request.nextUrl.pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // Operator panel: English, unlocalized, outside the waitlist gate. Access is
  // decided server-side (ADMIN_EMAILS → otherwise 404); never indexed or cached.
  if (request.nextUrl.pathname === "/admin" || request.nextUrl.pathname.startsWith("/admin/")) {
    // Refresh the session here (Supabase SSR pattern): admin server components can't
    // write rotated auth cookies, so forward them on the request and set them on the response.
    let res = NextResponse.next({ request });
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            res = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
          },
        },
      }
    );
    await supabase.auth.getUser();
    res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  }

  // Dev-only "?now=YYYY-MM-DD": forward it as a request header so server
  // components (the seasonal banner in Navbar) render that day too. next-intl
  // passes the request headers through to the page.
  if (process.env.NODE_ENV !== "production") {
    const now = parseDateOverride(request.nextUrl.searchParams.get("now"));
    if (now) {
      const headers = new Headers(request.headers);
      headers.set(SEASON_NOW_HEADER, now);
      request = new NextRequest(request, { headers });
    }
  }

  // Step 1: Apply locale routing (redirects, rewrites)
  const response = intlMiddleware(request);

  // ─── Waitlist gate ───
  const waitlistMode = process.env.WAITLIST_MODE === "true";
  if (waitlistMode) {
    const accessCode = process.env.WAITLIST_ACCESS_CODE;
    const pathname = request.nextUrl.pathname;

    // Check for access code in query param → set cookie and redirect clean
    const qsAccess = request.nextUrl.searchParams.get("access");
    if (qsAccess && accessCode && qsAccess === accessCode) {
      const cleanUrl = request.nextUrl.clone();
      cleanUrl.searchParams.delete("access");
      const redirect = NextResponse.redirect(cleanUrl);
      redirect.cookies.set("meapica_access", accessCode, {
        path: "/",
        maxAge: 60 * 60 * 24 * 30, // 30 days
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
      return redirect;
    }

    // Check if user has access cookie
    const cookie = request.cookies.get("meapica_access")?.value;
    const hasAccess = cookie === accessCode;

    if (!hasAccess) {
      // Extract locale from path
      const localeMatch = pathname.match(/^\/(es|ca|en|fr)(\/|$)/);
      const detectedLocale = localeMatch ? localeMatch[1] : "es";
      const pathWithoutLocale = localeMatch
        ? pathname.replace(`/${detectedLocale}`, "") || "/"
        : pathname;

      // Only allow root page (waitlist itself) and read-only preview share links
      // (/preview/[token]: sent to family who never passed the waitlist) — block everything else
      if (pathWithoutLocale !== "/" && !pathWithoutLocale.startsWith("/preview/")) {
        const rootUrl = request.nextUrl.clone();
        rootUrl.pathname = `/${detectedLocale}`;
        rootUrl.search = "";
        return NextResponse.redirect(rootUrl);
      }
    }
  }

  // Step 2: Refresh Supabase session on the response
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Step 3: Route protection with locale-aware paths
  const pathname = request.nextUrl.pathname;

  // Extract the path without locale prefix
  const localePattern = /^\/(es|ca|en|fr)(\/|$)/;
  const localeMatch = pathname.match(localePattern);
  const locale = localeMatch ? localeMatch[1] : routing.defaultLocale;
  const pathWithoutLocale = localeMatch
    ? pathname.replace(`/${locale}`, "") || "/"
    : pathname;

  // Protected routes: redirect to login if not authenticated
  const protectedPaths = ["/dashboard", "/perfil"];
  const isProtected = protectedPaths.some((path) =>
    pathWithoutLocale.startsWith(path)
  );

  if (isProtected && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = `/${locale}/auth/login`;
    loginUrl.search = "";
    loginUrl.searchParams.set("next", `${pathWithoutLocale}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  // Auth pages: a signed-in account goes straight to its destination (guests may
  // log in). `next` goes through the same sanitiser as every auth step.
  const isAuthPage = pathWithoutLocale.startsWith("/auth/") && !pathWithoutLocale.startsWith("/auth/callback");
  if (isAuthPage && user && !user.is_anonymous) {
    const destination = localizedPath(locale, sanitizeNextPath(request.nextUrl.searchParams.get("next")));
    return NextResponse.redirect(new URL(destination, request.nextUrl.origin));
  }

  // Share links carry a private token: never index them, never let a shared cache keep them.
  if (pathWithoutLocale.startsWith("/preview/")) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    response.headers.set("Referrer-Policy", "no-referrer");
  }

  return response;
}

export const config = {
  matcher: [
    // Match all request paths except API routes, static files, and images
    "/((?!api|_next/static|_next/image|favicon.ico|manifest\\.json|robots\\.txt|sitemap\\.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|mp3|wav|ogg|mp4|webm|woff2?|ttf|otf|pdf|txt|xml|json|js|css|map)$).*)",
  ],
};
