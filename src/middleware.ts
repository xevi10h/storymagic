import createIntlMiddleware from "next-intl/middleware";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

export async function middleware(request: NextRequest) {
  // Skip locale middleware for API routes
  if (request.nextUrl.pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // Step 1: Apply locale routing (redirects, rewrites)
  const response = intlMiddleware(request);

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
    loginUrl.searchParams.set("next", pathWithoutLocale);
    return NextResponse.redirect(loginUrl);
  }

  // Auth pages: redirect to destination if already logged in
  const isAuthPage = pathWithoutLocale.startsWith("/auth/");
  const isRecoveryPage = pathWithoutLocale === "/auth/update-password";
  const isResetPage = pathWithoutLocale === "/auth/reset-password";

  if (isAuthPage && user && !user.is_anonymous && !isRecoveryPage && !isResetPage) {
    const next = request.nextUrl.searchParams.get("next") || "/dashboard";
    const nextParsed = new URL(next, request.nextUrl.origin);
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = `/${locale}${nextParsed.pathname}`;
    redirectUrl.search = nextParsed.search;
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    // Match all request paths except API routes, static files, and images
    "/((?!api|_next/static|_next/image|favicon.ico|manifest\\.json|robots\\.txt|sitemap\\.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
