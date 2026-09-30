import { redirect } from "next/navigation";
import { isAuthLocale, loginHref } from "./next-path";

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

/**
 * Retired auth routes (/auth/signup, /auth/reset-password, /auth/update-password):
 * passwords are gone, so they all land on the one login screen, keeping language,
 * `next` and a prefilled email.
 */
export async function redirectToLogin(params: Promise<{ locale: string }>, searchParams: Promise<SearchParams>): Promise<never> {
  const { locale } = await params;
  const query = await searchParams;
  const loc = isAuthLocale(locale) ? locale : "es";
  redirect(`/${loc}${loginHref(first(query.next), first(query.email))}`);
}
