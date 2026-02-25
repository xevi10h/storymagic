import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the session — important for Server Components
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protected routes: redirect to login if not authenticated
  // Note: /crear is intentionally NOT protected — guests can use the creation flow
  const protectedPaths: string[] = [];
  const isProtected = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  if (isProtected && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/auth/login";
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Auth pages: redirect to destination if already logged in
  if (request.nextUrl.pathname.startsWith("/auth/") && user) {
    const next = request.nextUrl.searchParams.get("next") || "/crear";
    // next may contain query params (e.g. /crear?step=finish)
    const nextParsed = new URL(next, request.nextUrl.origin);
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = nextParsed.pathname;
    redirectUrl.search = nextParsed.search;
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}
