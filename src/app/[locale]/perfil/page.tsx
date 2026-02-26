"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/lib/supabase/client";
import { useTranslations, useLocale } from "next-intl";

interface ProfileData {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  provider: string;
  isAnonymous: boolean;
  createdAt: string;
}

export default function ProfilePage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const t = useTranslations("profile");
  const locale = useLocale();

  // Edit state
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [savingName, setSavingName] = useState(false);

  // Password change state
  const [changingPassword, setChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) return;

    async function fetchProfile() {
      try {
        const res = await fetch("/api/profile");
        if (!res.ok) throw new Error("Failed to fetch profile");
        const data = await res.json();
        setProfile(data);
        setNameValue(data.name || "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error");
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, [user, authLoading]);

  async function handleSaveName() {
    setSavingName(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameValue }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setProfile((prev) => (prev ? { ...prev, name: nameValue } : prev));
      setEditingName(false);
    } catch {
      setError(t("nameSection.saveError"));
    } finally {
      setSavingName(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (newPassword.length < 6) {
      setPasswordError(t("passwordSection.tooShort"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t("passwordSection.mismatch"));
      return;
    }

    setSavingPassword(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;
      setPasswordSuccess(true);
      setNewPassword("");
      setConfirmPassword("");
      setChangingPassword(false);
    } catch (err) {
      setPasswordError(
        err instanceof Error ? err.message : t("passwordSection.error")
      );
    } finally {
      setSavingPassword(false);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <span className="material-symbols-outlined animate-spin text-4xl text-primary">
          progress_activity
        </span>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-cream px-4">
        <span className="material-symbols-outlined text-5xl text-red-400">error</span>
        <p className="mt-4 text-base text-text-main">{error}</p>
        <Link href="/" className="mt-6 text-sm text-primary hover:underline">
          {t("back")}
        </Link>
      </div>
    );
  }

  const isEmailProvider = profile?.provider === "email";
  const initials = (profile?.name || profile?.email || "U").charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border-light bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="flex h-9 w-9 items-center justify-center rounded-full text-text-soft transition-colors hover:bg-cream hover:text-text-main"
              aria-label={t("back")}
            >
              <span className="material-symbols-outlined text-xl">arrow_back</span>
            </Link>
            <h1 className="font-display text-lg font-bold text-secondary">{t("title")}</h1>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {/* Avatar + basic info */}
        <div className="flex items-center gap-4 rounded-xl border border-border-light bg-white p-6">
          {profile?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatarUrl}
              alt={profile.name || "Avatar"}
              className="h-16 w-16 rounded-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-xl font-bold text-white">
              {initials}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-bold text-text-main">
              {profile?.name || t("noName")}
            </h2>
            <p className="text-sm text-text-muted">{profile?.email}</p>
            <p className="mt-1 text-xs text-text-muted">
              {t("memberSince", {
                date: profile?.createdAt
                  ? new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(new Date(profile.createdAt))
                  : "",
              })}
            </p>
          </div>
        </div>

        {/* Name section */}
        <section className="mt-6 rounded-xl border border-border-light bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-text-main">{t("nameSection.label")}</h3>
              <p className="mt-0.5 text-xs text-text-muted">
                {t("nameSection.hint")}
              </p>
            </div>
            {!editingName && (
              <button
                onClick={() => setEditingName(true)}
                className="flex items-center gap-1 rounded-lg border border-border-light px-3 py-1.5 text-xs font-medium text-text-soft transition-colors hover:bg-cream hover:text-text-main"
              >
                <span className="material-symbols-outlined text-sm">edit</span>
                {t("nameSection.edit")}
              </button>
            )}
          </div>

          {editingName ? (
            <div className="mt-4 flex items-center gap-3">
              <input
                type="text"
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                className="flex-1 rounded-xl border border-border-light bg-white px-4 py-2.5 text-sm text-text-main placeholder:text-text-muted outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder={t("nameSection.placeholder")}
                autoFocus
              />
              <button
                onClick={handleSaveName}
                disabled={savingName || !nameValue.trim()}
                className="rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-primary-hover disabled:opacity-60"
              >
                {savingName ? "..." : t("nameSection.save")}
              </button>
              <button
                onClick={() => {
                  setEditingName(false);
                  setNameValue(profile?.name || "");
                }}
                className="rounded-lg border border-border-light px-3 py-2.5 text-sm text-text-soft transition-colors hover:bg-cream"
              >
                {t("nameSection.cancel")}
              </button>
            </div>
          ) : (
            <p className="mt-3 text-sm text-text-main">
              {profile?.name || <span className="italic text-text-muted">{t("nameSection.notSet")}</span>}
            </p>
          )}
        </section>

        {/* Email section */}
        <section className="mt-4 rounded-xl border border-border-light bg-white p-6">
          <h3 className="text-sm font-bold text-text-main">{t("emailSection.label")}</h3>
          <p className="mt-0.5 text-xs text-text-muted">
            {profile?.provider === "google" ? t("emailSection.googleLinked") : t("emailSection.emailRegistration")}
          </p>
          <div className="mt-3 flex items-center gap-2">
            {profile?.provider === "google" && (
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            <p className="text-sm text-text-main">{profile?.email}</p>
          </div>
        </section>

        {/* Password section — only for email users */}
        {isEmailProvider && (
          <section className="mt-4 rounded-xl border border-border-light bg-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-text-main">{t("passwordSection.label")}</h3>
                <p className="mt-0.5 text-xs text-text-muted">
                  {t("passwordSection.hint")}
                </p>
              </div>
              {!changingPassword && (
                <button
                  onClick={() => setChangingPassword(true)}
                  className="flex items-center gap-1 rounded-lg border border-border-light px-3 py-1.5 text-xs font-medium text-text-soft transition-colors hover:bg-cream hover:text-text-main"
                >
                  <span className="material-symbols-outlined text-sm">lock</span>
                  {t("passwordSection.change")}
                </button>
              )}
            </div>

            {changingPassword && (
              <form onSubmit={handleChangePassword} className="mt-4 space-y-3">
                <div>
                  <label htmlFor="newPassword" className="mb-1 block text-xs font-medium text-text-soft">
                    {t("passwordSection.newPasswordLabel")}
                  </label>
                  <input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={6}
                    required
                    placeholder={t("passwordSection.newPasswordPlaceholder")}
                    className="w-full rounded-xl border border-border-light bg-white px-4 py-2.5 text-sm text-text-main placeholder:text-text-muted outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label htmlFor="confirmPassword" className="mb-1 block text-xs font-medium text-text-soft">
                    {t("passwordSection.confirmPasswordLabel")}
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    minLength={6}
                    required
                    placeholder={t("passwordSection.confirmPlaceholder")}
                    className="w-full rounded-xl border border-border-light bg-white px-4 py-2.5 text-sm text-text-main placeholder:text-text-muted outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                {passwordError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
                    {passwordError}
                  </div>
                )}

                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="submit"
                    disabled={savingPassword}
                    className="rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-primary-hover disabled:opacity-60"
                  >
                    {savingPassword ? t("passwordSection.saving") : t("passwordSection.submit")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setChangingPassword(false);
                      setNewPassword("");
                      setConfirmPassword("");
                      setPasswordError(null);
                    }}
                    className="rounded-lg border border-border-light px-3 py-2.5 text-sm text-text-soft transition-colors hover:bg-cream"
                  >
                    {t("passwordSection.cancel")}
                  </button>
                </div>
              </form>
            )}

            {passwordSuccess && !changingPassword && (
              <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs text-emerald-700">
                {t("passwordSection.success")}
              </div>
            )}
          </section>
        )}

        {/* Anonymous user notice */}
        {profile?.isAnonymous && (
          <section className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-6">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-xl text-amber-600 shrink-0">info</span>
              <div>
                <h3 className="text-sm font-bold text-amber-800">{t("guestNotice.title")}</h3>
                <p className="mt-1 text-xs text-amber-700 leading-relaxed">
                  {t("guestNotice.description")}
                </p>
                <Link
                  href="/auth/signup"
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-amber-700"
                >
                  <span className="material-symbols-outlined text-sm">person_add</span>
                  {t("guestNotice.createAccount")}
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* Sign out */}
        <div className="mt-8 text-center">
          <button
            onClick={signOut}
            className="inline-flex items-center gap-2 rounded-lg border border-border-light px-5 py-2.5 text-sm font-medium text-text-soft transition-colors hover:bg-cream hover:text-text-main"
          >
            <span className="material-symbols-outlined text-lg">logout</span>
            {t("signOut")}
          </button>
        </div>
      </div>
    </div>
  );
}
