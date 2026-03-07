"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import LogoIcon from "@/components/LogoIcon";

export default function ResetPasswordPage() {
  const t = useTranslations("auth.resetPassword");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      });

      if (error) throw error;
      setSent(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("sendError")
      );
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
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
              {t("linkSent")}{" "}
              <strong className="text-text-main">{email}</strong>{" "}
              {t("linkSentEnd")}
            </p>
            <p className="mt-4 text-xs text-text-muted">
              {t("checkSpam")}
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
          <p className="mt-2 text-sm text-text-muted leading-relaxed">
            {t("description")}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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

        {/* Back to login */}
        <p className="mt-6 text-center">
          <Link
            href="/auth/login"
            className="text-sm text-text-muted hover:text-text-soft"
          >
            {t("backToLogin")}
          </Link>
        </p>
      </div>
    </div>
  );
}
