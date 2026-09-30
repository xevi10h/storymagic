import { redirectToLogin } from "@/lib/auth/legacy-redirect";

// Passwordless login: this route only forwards to /auth/login (next + email kept).
export default async function Page(props: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return redirectToLogin(props.params, props.searchParams);
}
