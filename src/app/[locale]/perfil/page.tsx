"use client";

import { useEffect, useId, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/lib/supabase/client";
import EmailSignIn from "@/components/auth/EmailSignIn";
import Sheet from "@/components/crear/Sheet";
import { Button, Card, Eyebrow, Heading, buttonClass, cx, focusRing } from "@/components/ui";
import { SUPPORT_EMAIL } from "@/lib/support";

interface ProfileData {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  provider: string;
  isAnonymous: boolean;
  createdAt: string;
}

const inputClass =
  "h-12 w-full rounded-2xl border-2 border-line bg-surface px-4 text-base text-ink outline-none transition-colors placeholder:text-ink-muted/45 focus:border-brand";

function GoogleMark() {
  return (
    <svg aria-hidden className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

export default function ProfilePage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const t = useTranslations("profile");
  const locale = useLocale();

  useEffect(() => {
    if (authLoading || !user) return;
    let active = true;
    fetch("/api/profile")
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as ProfileData;
        if (active) setProfile(data);
      })
      .catch(() => active && setLoadFailed(true))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [user, authLoading]);

  const header = (
    <header className="sticky top-0 z-40 border-b border-brand/10 bg-paper/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-2xl items-center gap-2 px-4 sm:px-6">
        <Link
          href="/dashboard"
          aria-label={t("back")}
          className={cx("-ml-2 flex h-11 w-11 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-brand/5 hover:text-ink", focusRing)}
        >
          <span aria-hidden className="material-symbols-outlined">
            arrow_back
          </span>
        </Link>
        <h1 className="font-display text-lg font-bold text-ink">{t("title")}</h1>
      </div>
    </header>
  );

  if (authLoading || (user && loading)) {
    return (
      <div className="min-h-dvh bg-paper">
        {header}
        <div className="flex justify-center py-24">
          <span aria-hidden className="material-symbols-outlined animate-spin text-brand">
            progress_activity
          </span>
        </div>
      </div>
    );
  }

  if (loadFailed || !profile) {
    return (
      <div className="min-h-dvh bg-paper">
        {header}
        <div className="mx-auto max-w-md px-4 py-20 text-center">
          <p role="alert" className="text-base text-ink-soft">
            {t("loadError")}
          </p>
          <Link href="/dashboard" className={buttonClass({ variant: "secondary", size: "sm", className: "mt-6" })}>
            {t("back")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-paper">
      {header}
      <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6 sm:px-6 sm:py-10">
        {profile.isAnonymous ? (
          <GuestProfile onSignOut={signOut} />
        ) : (
          <AccountProfile profile={profile} setProfile={setProfile} locale={locale} onSignOut={signOut} />
        )}
      </main>
    </div>
  );
}

// ── Guest: save the books (no account to manage yet) ─────────────────────────

function GuestProfile({ onSignOut }: { onSignOut: () => Promise<void> }) {
  const t = useTranslations("profile");
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <Card variant="elevated" className="p-5 sm:p-7" data-testid="guest-save-card">
        <Heading size="section" eyebrow={t("guest.eyebrow")} subtitle={t("guest.body")} className="mb-5">
          {t("guest.title")}
        </Heading>
        <EmailSignIn next="/dashboard" />
      </Card>

      <div className="mt-4 text-center">
        <Button variant="quiet" size="sm" leadingIcon="logout" onClick={() => setConfirmOpen(true)}>
          {t("guest.signOut")}
        </Button>
      </div>

      <Sheet
        open={confirmOpen}
        title={t("guest.signOutTitle")}
        onClose={() => setConfirmOpen(false)}
        closeLabel={t("close")}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="quiet" size="sm" onClick={() => void onSignOut()}>
              {t("guest.signOutConfirm")}
            </Button>
            <Button size="sm" onClick={() => setConfirmOpen(false)}>
              {t("guest.keep")}
            </Button>
          </div>
        }
      >
        <p className="text-sm leading-relaxed text-ink-soft">{t("guest.signOutBody")}</p>
      </Sheet>
    </>
  );
}

// ── Account ──────────────────────────────────────────────────────────────────

function AccountProfile({
  profile,
  setProfile,
  locale,
  onSignOut,
}: {
  profile: ProfileData;
  setProfile: (p: ProfileData) => void;
  locale: string;
  onSignOut: () => Promise<void>;
}) {
  const t = useTranslations("profile");
  const nameId = useId();
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(profile.name);
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const initial = (profile.name || profile.email || "M").charAt(0).toUpperCase();
  const since = profile.createdAt
    ? new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(new Date(profile.createdAt))
    : "";

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    const name = nameValue.trim();
    if (!name || savingName) return;
    setSavingName(true);
    setNameError(false);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setProfile({ ...profile, name });
      setEditingName(false);
    } catch {
      setNameError(true);
    } finally {
      setSavingName(false);
    }
  }

  return (
    <>
      <Card className="flex items-center gap-4 p-5">
        {profile.avatarUrl ? (
          // Provider avatar (Google): external URL, plain <img>
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.avatarUrl} alt="" className="h-14 w-14 rounded-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <span aria-hidden className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand font-display text-xl font-bold text-white">
            {initial}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-bold text-ink">{profile.name || t("noName")}</p>
          <p className="truncate text-sm text-ink-muted">{profile.email}</p>
          {since && <p className="mt-0.5 text-xs text-ink-muted">{t("memberSince", { date: since })}</p>}
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Eyebrow as="h2">{t("nameSection.label")}</Eyebrow>
            <p className="mt-1 text-xs text-ink-muted">{t("nameSection.hint")}</p>
          </div>
          {!editingName && (
            <Button variant="secondary" size="sm" leadingIcon="edit" onClick={() => setEditingName(true)}>
              {t("nameSection.edit")}
            </Button>
          )}
        </div>
        {editingName ? (
          <form onSubmit={saveName} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <label htmlFor={nameId} className="sr-only">
              {t("nameSection.label")}
            </label>
            <input
              id={nameId}
              type="text"
              value={nameValue}
              maxLength={100}
              autoComplete="name"
              onChange={(e) => setNameValue(e.target.value)}
              placeholder={t("nameSection.placeholder")}
              className={cx(inputClass, "sm:flex-1")}
              autoFocus
            />
            <div className="flex gap-2">
              <Button type="submit" size="sm" loading={savingName} disabled={!nameValue.trim()}>
                {savingName ? t("nameSection.saving") : t("nameSection.save")}
              </Button>
              <Button
                variant="quiet"
                size="sm"
                onClick={() => {
                  setEditingName(false);
                  setNameValue(profile.name);
                  setNameError(false);
                }}
              >
                {t("nameSection.cancel")}
              </Button>
            </div>
          </form>
        ) : (
          <p className="mt-3 text-base text-ink">{profile.name || <span className="text-ink-muted">{t("nameSection.notSet")}</span>}</p>
        )}
        {nameError && (
          <p role="alert" className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
            {t("nameSection.saveError")}
          </p>
        )}
      </Card>

      <Card className="p-5">
        <Eyebrow as="h2">{t("emailSection.label")}</Eyebrow>
        <p className="mt-1 text-xs text-ink-muted">
          {profile.provider === "google" ? t("emailSection.googleLinked") : t("emailSection.emailRegistration")}
        </p>
        <p className="mt-3 flex items-center gap-2 break-all text-base text-ink">
          {profile.provider === "google" && <GoogleMark />}
          {profile.email}
        </p>
      </Card>

      <div className="flex justify-center py-2">
        <Button variant="secondary" size="sm" leadingIcon="logout" onClick={() => void onSignOut()}>
          {t("signOut")}
        </Button>
      </div>

      <section aria-labelledby="delete-account-title" className="mt-4 rounded-2xl border-2 border-red-200 bg-surface p-5" data-testid="danger-zone">
        <h2 id="delete-account-title" className="font-display text-base font-bold text-ink">
          {t("deleteAccount.title")}
        </h2>
        <p className="mt-1 text-sm text-ink-muted">{t("deleteAccount.body")}</p>
        <button
          type="button"
          onClick={() => setDeleteOpen(true)}
          className={cx(
            "mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-red-200 bg-surface px-5 text-sm font-bold text-red-700 transition-colors hover:border-red-700 hover:bg-red-50",
            focusRing,
          )}
        >
          <span aria-hidden className="material-symbols-outlined !text-lg">
            delete
          </span>
          {t("deleteAccount.button")}
        </button>
      </section>

      <DeleteAccountSheet open={deleteOpen} onClose={() => setDeleteOpen(false)} locale={locale} />
    </>
  );
}

// ── Delete account (typed confirmation → DELETE /api/account) ────────────────

function DeleteAccountSheet({ open, onClose, locale }: { open: boolean; onClose: () => void; locale: string }) {
  const t = useTranslations("profile");
  const inputId = useId();
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  // null = no error · "error" generic · "rateLimited" 429 · { reference } 409 order in production/shipping
  const [failed, setFailed] = useState<null | "error" | "rateLimited" | { reference: string }>(null);
  const word = t("deleteAccount.word");
  const matches = typed.trim().toLocaleUpperCase(locale) === word.toLocaleUpperCase(locale);

  function close() {
    if (deleting) return;
    setTyped("");
    setFailed(null);
    onClose();
  }

  async function confirmDelete(e?: React.FormEvent) {
    e?.preventDefault();
    if (!matches || deleting) return;
    setDeleting(true);
    setFailed(null);
    try {
      const res = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; orderReference?: string } | null;
      if (res.status === 409 && body?.error === "order_in_progress") {
        setFailed({ reference: body.orderReference ?? "" });
        setDeleting(false);
        return;
      }
      if (res.status === 429) {
        setFailed("rateLimited");
        setDeleting(false);
        return;
      }
      if (!res.ok || body?.ok !== true) throw new Error(String(res.status));
      // The user no longer exists: drop the local session (no server call) and go home.
      await createClient()
        .auth.signOut({ scope: "local" })
        .catch(() => undefined);
      window.location.assign(`/${locale}`);
    } catch {
      setFailed("error");
      setDeleting(false);
    }
  }

  return (
    <Sheet
      open={open}
      title={t("deleteAccount.dialogTitle")}
      onClose={close}
      closeLabel={t("close")}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="quiet" size="sm" onClick={close} disabled={deleting}>
            {t("deleteAccount.cancel")}
          </Button>
          <button
            type="submit"
            form={inputId + "-form"}
            disabled={!matches || deleting}
            aria-busy={deleting || undefined}
            className={cx(
              "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-red-700 px-5 text-sm font-bold text-white transition-colors hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-40",
              focusRing,
            )}
            data-testid="delete-account-confirm"
          >
            {deleting && (
              <span aria-hidden className="material-symbols-outlined animate-spin !text-lg">
                progress_activity
              </span>
            )}
            {deleting ? t("deleteAccount.deleting") : t("deleteAccount.confirm")}
          </button>
        </div>
      }
    >
      <form id={inputId + "-form"} onSubmit={confirmDelete} className="flex flex-col gap-4" noValidate>
        <p className="text-sm leading-relaxed text-ink-soft">{t("deleteAccount.dialogBody")}</p>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={inputId} className="text-sm font-semibold text-ink-soft">
            {t("deleteAccount.typeLabel", { word })}
          </label>
          <input
            id={inputId}
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            disabled={deleting}
            className={inputClass}
            data-testid="delete-account-input"
          />
        </div>
        {failed && (
          <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
            {failed === "rateLimited"
              ? t("deleteAccount.rateLimited")
              : typeof failed === "object"
                ? t("deleteAccount.orderInProgress", { reference: failed.reference, email: SUPPORT_EMAIL })
                : t("deleteAccount.error", { email: SUPPORT_EMAIL })}
          </p>
        )}
      </form>
    </Sheet>
  );
}
