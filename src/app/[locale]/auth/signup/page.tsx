"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  return (
    <Suspense>
      <SignupPageContent />
    </Suspense>
  );
}

function SignupPageContent() {
  const t = useTranslations("auth.signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();

  const nextUrl = searchParams.get("next") || "/crear";

  // Detect anonymous users — they need account upgrade, not new signup
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.is_anonymous) {
        setIsAnonymous(true);
      }
    });
  }, [supabase]);

  async function handleEmailSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (isAnonymous) {
      // Upgrade anonymous user → keeps the same user_id, preserving all stories
      const { error } = await supabase.auth.updateUser({
        email,
        password,
        data: { full_name: name },
      });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      // Update profile name
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("profiles").upsert({
          id: user.id,
          name,
          email,
        }, { onConflict: "id" });
      }

      setSuccess(true);
      setLoading(false);
      return;
    }

    // Normal signup for non-anonymous users
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextUrl)}`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  async function handleGoogleLogin() {
    setError(null);

    if (isAnonymous) {
      // Link Google identity to anonymous account
      const { error } = await supabase.auth.linkIdentity({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextUrl)}`,
        },
      });
      if (error) {
        setError(error.message);
      }
      return;
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextUrl)}`,
      },
    });

    if (error) {
      setError(error.message);
    }
  }

  if (success) {
    // Anonymous upgrade: redirect to dashboard immediately
    if (isAnonymous) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-create-bg px-4">
          <div className="w-full max-w-md text-center">
            <div className="rounded-2xl border border-border-light bg-white p-8 shadow-sm">
              <span className="material-symbols-outlined mb-4 text-5xl text-success">
                check_circle
              </span>
              <h2 className="font-display text-2xl font-bold text-secondary">
                {t("upgradeSuccess")}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-text-muted">
                {t("upgradeSuccessDesc")}
              </p>
              <Link
                href="/dashboard"
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white transition-all hover:bg-primary-hover"
              >
                <span className="material-symbols-outlined text-lg">library_books</span>
                {t("goToLibrary")}
              </Link>
            </div>
          </div>
        </div>
      );
    }

    // Normal signup: check email
    return (
      <div className="flex min-h-screen items-center justify-center bg-create-bg px-4">
        <div className="w-full max-w-md text-center">
          <div className="rounded-2xl border border-border-light bg-white p-8 shadow-sm">
            <span className="material-symbols-outlined mb-4 text-5xl text-success">
              mark_email_read
            </span>
            <h2 className="font-display text-2xl font-bold text-secondary">
              {t("checkEmail")}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-text-muted">
              {t("confirmationSent")}{" "}
              <strong className="text-text-main">{email}</strong>. {t("confirmationAction")}
            </p>
            <Link
              href={`/auth/login${nextUrl !== "/crear" ? `?next=${encodeURIComponent(nextUrl)}` : ""}`}
              className="mt-6 inline-block text-sm font-semibold text-primary hover:underline"
            >
              {t("goToLogin")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-create-bg px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <span className="material-symbols-outlined text-4xl text-primary">
              menu_book
            </span>
            <span className="font-display text-3xl font-bold text-secondary">
              StoryMagic
            </span>
          </Link>
          <p className="mt-3 text-sm text-create-text-sub">
            {isAnonymous ? t("upgradeSubtitle") : t("subtitle")}
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-border-light bg-white p-8 shadow-sm">
          {/* Google button */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-border-light bg-white px-4 py-3 text-sm font-semibold text-text-main transition-all hover:border-border-medium hover:bg-cream active:scale-[0.98]"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            {t("googleButton")}
          </button>

          {/* Divider */}
          <div className="my-6 flex items-center gap-4">
            <div className="h-px flex-1 bg-border-light" />
            <span className="text-xs font-medium text-text-muted">{t("or")}</span>
            <div className="h-px flex-1 bg-border-light" />
          </div>

          {/* Email form */}
          <form onSubmit={handleEmailSignup} className="space-y-4">
            <div>
              <label
                htmlFor="name"
                className="mb-1.5 block text-sm font-medium text-create-text"
              >
                {t("nameLabel")}
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder={t("namePlaceholder")}
                className="w-full rounded-xl border border-border-light bg-white px-4 py-3 text-sm text-text-main placeholder:text-text-muted outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-create-text"
              >
                {t("emailLabel")}
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder={t("emailPlaceholder")}
                className="w-full rounded-xl border border-border-light bg-white px-4 py-3 text-sm text-text-main placeholder:text-text-muted outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-create-text"
              >
                {t("passwordLabel")}
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder={t("passwordPlaceholder")}
                minLength={6}
                className="w-full rounded-xl border border-border-light bg-white px-4 py-3 text-sm text-text-main placeholder:text-text-muted outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white transition-all hover:bg-primary-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? t("loading") : t("submit")}
            </button>
          </form>
        </div>

        {/* Login link */}
        <p className="mt-6 text-center text-sm text-text-muted">
          {t("hasAccount")}{" "}
          <Link
            href="/auth/login"
            className="font-semibold text-primary hover:underline"
          >
            {t("signIn")}
          </Link>
        </p>

        {/* Back to home */}
        <p className="mt-3 text-center">
          <Link
            href="/"
            className="text-sm text-text-muted hover:text-text-soft"
          >
            {t("backHome")}
          </Link>
        </p>
      </div>
    </div>
  );
}
