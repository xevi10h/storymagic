"use client";

import { Suspense, useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import LogoIcon from "@/components/LogoIcon";

function UpdatePasswordContent() {
  const t = useTranslations("auth.updatePassword");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [exchanging, setExchanging] = useState(false);
  const [isExpiredError, setIsExpiredError] = useState(false);
  const exchangeAttempted = useRef(false);

  // If there's a code in the URL, exchange it for a session first
  // (Supabase recovery flow redirects here with ?code=XXX)
  useEffect(() => {
    const code = searchParams.get("code");
    if (!code || exchangeAttempted.current) return;
    exchangeAttempted.current = true;

    setExchanging(true);
    const supabase = createClient();
    supabase.auth
      .exchangeCodeForSession(code)
      .then(({ error }) => {
        if (error) {
          setError(t("linkExpired"));
          setIsExpiredError(true);
        }
      })
      .catch(() => {
        setError(t("linkError"));
        setIsExpiredError(true);
      })
      .finally(() => {
        setExchanging(false);
        // Clean the URL to remove the code
        window.history.replaceState(null, "", "/auth/update-password");
      });
  }, [searchParams, t]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsExpiredError(false);

    if (password.length < 6) {
      setError(t("passwordTooShort"));
      return;
    }

    if (password !== confirmPassword) {
      setError(t("passwordMismatch"));
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) throw error;
      setSuccess(true);

      setTimeout(() => {
        router.push("/auth/login");
      }, 3000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("updateError")
      );
    } finally {
      setLoading(false);
    }
  }

  if (exchanging) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-create-bg px-4">
        <div className="text-center">
          <span className="material-symbols-outlined animate-spin text-4xl text-primary">
            progress_activity
          </span>
          <p className="mt-4 text-sm text-text-muted">{t("verifyingLink")}</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-create-bg px-4">
        <div className="w-full max-w-md text-center">
          <div className="rounded-2xl border border-border-light bg-white p-8 shadow-sm">
            <span className="material-symbols-outlined mb-4 text-5xl text-success">
              check_circle
            </span>
            <h2 className="font-display text-2xl font-bold text-secondary">
              {t("successTitle")}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-text-muted">
              {t("successMessage")}
            </p>
            <Link
              href="/auth/login"
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
            <LogoIcon className="h-10 w-10 text-primary" />
            <span className="font-display text-3xl font-bold text-secondary">
              meapica
            </span>
          </Link>
          <p className="mt-3 text-sm text-create-text-sub">
            {t("subtitle")}
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-border-light bg-white p-8 shadow-sm">
          <h2 className="font-display text-xl font-bold text-secondary">
            {t("title")}
          </h2>
          <p className="mt-2 text-sm text-text-muted">
            {t("description")}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-create-text"
              >
                {t("newPasswordLabel")}
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder={t("passwordPlaceholder")}
                className="w-full rounded-xl border border-border-light bg-white px-4 py-3 text-sm text-text-main placeholder:text-text-muted outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="mb-1.5 block text-sm font-medium text-create-text"
              >
                {t("confirmPasswordLabel")}
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                placeholder={t("confirmPlaceholder")}
                className="w-full rounded-xl border border-border-light bg-white px-4 py-3 text-sm text-text-main placeholder:text-text-muted outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
                {isExpiredError && (
                  <Link
                    href="/auth/reset-password"
                    className="mt-2 block font-medium text-red-800 hover:underline"
                  >
                    {t("requestNewLink")}
                  </Link>
                )}
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
      </div>
    </div>
  );
}

export default function UpdatePasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-create-bg">
          <span className="material-symbols-outlined animate-spin text-4xl text-primary">
            progress_activity
          </span>
        </div>
      }
    >
      <UpdatePasswordContent />
    </Suspense>
  );
}
