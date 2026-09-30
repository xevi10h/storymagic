"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Button, Eyebrow, cx, focusRing } from "@/components/ui";
import { authErrorKey, isExistingAccountError, type AuthErrorKey } from "@/lib/auth/auth-errors";
import { localizedPath, sanitizeNextPath } from "@/lib/auth/next-path";
import { SUPPORT_EMAIL } from "@/lib/support";

export type SignInStep = "email" | "code";

/** "login" = signInWithOtp (new or existing account) · "upgrade" = guest keeps its user id. */
type Mode = "login" | "upgrade";

const RESEND_COOLDOWN_SEC = 60;
const CODE_MIN = 6;
const CODE_MAX = 8; // project OTP length may be 6 (recommended) or 8
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const inputClass =
  "h-12 w-full rounded-2xl border-2 border-line bg-surface px-4 text-base text-ink outline-none transition-colors placeholder:text-ink-muted/45 focus:border-brand disabled:opacity-60";

interface EmailSignInProps {
  /** Locale-less destination after login ("/dashboard?tab=orders"). */
  next: string;
  initialEmail?: string;
  /** Error to show on arrival (e.g. ?error=link_invalid). */
  initialError?: AuthErrorKey | null;
  showGoogle?: boolean;
  autoFocus?: boolean;
  onStepChange?: (step: SignInStep) => void;
}

/** Google "G" mark (official colours, required by Google's branding rules). */
function GoogleMark() {
  return (
    <svg aria-hidden className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

/**
 * Passwordless sign-in: email → one email with a link AND a code (works on any
 * device) → code here or link there. Guests keep their books: the anonymous user is
 * upgraded in place when the email is new, otherwise its books are merged into the
 * existing account after login (server-side, signed proof cookie).
 */
export default function EmailSignIn({ next, initialEmail = "", initialError = null, showGoogle = true, autoFocus = false, onStepChange }: EmailSignInProps) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const supabase = useMemo(() => createClient(), []);
  const safeNext = useMemo(() => sanitizeNextPath(next), [next]);

  const [step, setStep] = useState<SignInStep>("email");
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<null | "send" | "verify" | "google" | "resend">(null);
  const [error, setError] = useState<AuthErrorKey | null>(initialError);
  const [resent, setResent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const ids = { email: useId(), code: useId(), error: useId() };

  useEffect(() => {
    onStepChange?.(step);
    if (step === "code") codeRef.current?.focus();
  }, [step, onStepChange]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  function confirmUrl() {
    return `${window.location.origin}/api/auth/confirm?locale=${locale}&next=${encodeURIComponent(safeNext)}`;
  }

  async function isGuestSession(): Promise<boolean> {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.user?.is_anonymous === true;
  }

  /** Arm the guest-merge proof (HttpOnly, server-signed). Best-effort: without it the login still works. */
  async function armGuestMerge() {
    try {
      await fetch("/api/auth/guest-merge", { method: "POST" });
    } catch {
      // offline: the login call below will surface the network error
    }
  }

  /** Sends the email. Returns the mode used, or null after setting an error. */
  async function sendEmail(address: string, preferredMode: Mode | null): Promise<Mode | null> {
    if (preferredMode !== "login" && (await isGuestSession())) {
      await armGuestMerge();
      // Language first, so the "confirm your email" template picks it up.
      await supabase.auth.updateUser({ data: { locale } });
      const { error: upgradeError } = await supabase.auth.updateUser({ email: address }, { emailRedirectTo: confirmUrl() });
      if (!upgradeError) return "upgrade";
      if (!isExistingAccountError(upgradeError)) {
        setError(authErrorKey(upgradeError));
        return null;
      }
      // The email already has an account: log in to it, the guest's books follow.
    }
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: address,
      options: { emailRedirectTo: confirmUrl(), shouldCreateUser: true, data: { locale } },
    });
    if (otpError) {
      setError(authErrorKey(otpError));
      return null;
    }
    return "login";
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const address = email.trim();
    setError(null);
    setResent(false);
    if (!EMAIL_RE.test(address)) {
      setError("invalidEmail");
      emailRef.current?.focus();
      return;
    }
    setBusy("send");
    try {
      const used = await sendEmail(address, null);
      if (used) {
        setEmail(address);
        setMode(used);
        setCode("");
        setCooldown(RESEND_COOLDOWN_SEC);
        setStep("code");
      }
    } catch (err) {
      setError(authErrorKey(err));
    } finally {
      setBusy(null);
    }
  }

  async function handleResend() {
    if (busy || cooldown > 0) return;
    setError(null);
    setResent(false);
    setBusy("resend");
    try {
      const used = await sendEmail(email, mode);
      if (used) {
        setMode(used);
        setResent(true);
        setCooldown(RESEND_COOLDOWN_SEC);
      }
    } catch (err) {
      setError(authErrorKey(err));
    } finally {
      setBusy(null);
    }
  }

  async function verify(token: string) {
    if (busy) return;
    if (token.length < CODE_MIN || token.length > CODE_MAX) {
      setError("invalidCode");
      return;
    }
    setError(null);
    setResent(false);
    setBusy("verify");
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token,
        type: mode === "upgrade" ? "email_change" : "email",
      });
      if (verifyError) {
        setError(authErrorKey(verifyError));
        setBusy(null);
        codeRef.current?.select();
        return;
      }
      // Link guest data + remember the language. Login already succeeded: never block on it.
      try {
        await fetch("/api/auth/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locale }),
        });
      } catch {
        // ignore
      }
      // Full navigation: every server component re-renders with the new session.
      window.location.assign(localizedPath(locale, safeNext));
    } catch (err) {
      setError(authErrorKey(err));
      setBusy(null);
    }
  }

  function handleCodeChange(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, CODE_MAX);
    const wasEmpty = code.length === 0;
    setCode(digits);
    if (error === "invalidCode") setError(null);
    // Paste or iOS/Android one-time-code autofill drops the whole code at once.
    if (wasEmpty && digits.length >= CODE_MIN) void verify(digits);
  }

  async function handleGoogle() {
    if (busy) return;
    setError(null);
    setBusy("google");
    try {
      if (await isGuestSession()) await armGuestMerge();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/${locale}/auth/callback?next=${encodeURIComponent(safeNext)}`,
        },
      });
      if (oauthError) {
        setError(authErrorKey(oauthError));
        setBusy(null);
      }
      // Success: the browser is leaving for Google; keep the loading state.
    } catch (err) {
      setError(authErrorKey(err));
      setBusy(null);
    }
  }

  function backToEmail() {
    setStep("email");
    setCode("");
    setError(null);
    setResent(false);
    setBusy(null);
    requestAnimationFrame(() => emailRef.current?.focus());
  }

  const errorBox = error && (
    <div id={ids.error} role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-700">
      <p>{t(`errors.${error}`)}</p>
      {(error === "generic" || error === "emailSendFailed" || error === "blocked") && (
        <p className="mt-1">
          {t.rich("errors.help", {
            email: SUPPORT_EMAIL,
            mail: (chunks) => (
              <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold underline decoration-red-700/30 underline-offset-2">
                {chunks}
              </a>
            ),
          })}
        </p>
      )}
    </div>
  );

  if (step === "code") {
    return (
      <div className="step-in flex flex-col gap-5" data-testid="auth-code-step">
        <div className="flex gap-3 rounded-2xl bg-brand/[0.06] px-4 py-3.5">
          <span aria-hidden className="material-symbols-outlined shrink-0 text-brand-text">
            mail
          </span>
          <div className="min-w-0 text-sm leading-relaxed text-ink-soft">
            <p>
              {t.rich("code.sentTo", {
                email,
                b: (chunks) => <strong className="font-semibold text-ink [overflow-wrap:anywhere]">{chunks}</strong>,
              })}
            </p>
            <p className="mt-0.5">{t("code.instructions")}</p>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void verify(code);
          }}
          className="flex flex-col gap-4"
          noValidate
        >
          <div className="flex flex-col gap-1.5">
            <Eyebrow as="label" htmlFor={ids.code}>
              {t("code.codeLabel")}
            </Eyebrow>
            <input
              ref={codeRef}
              id={ids.code}
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              enterKeyHint="go"
              pattern="[0-9]*"
              maxLength={CODE_MAX}
              value={code}
              onChange={(e) => handleCodeChange(e.target.value)}
              disabled={busy === "verify"}
              aria-invalid={error === "invalidCode" || undefined}
              aria-describedby={error ? ids.error : undefined}
              placeholder="000000"
              className={cx(inputClass, "h-14 pl-[calc(1rem+0.35em)] text-center font-display text-2xl font-semibold tracking-[0.35em] tabular-nums")}
              data-testid="auth-code-input"
            />
          </div>

          {errorBox}
          {resent && !error && (
            <p role="status" className="text-sm font-medium text-success">
              {t("code.resent")}
            </p>
          )}

          <Button
            type="submit"
            size="lg"
            block
            loading={busy === "verify"}
            disabled={code.length < CODE_MIN}
            className="text-[19px]"
          >
            {busy === "verify" ? t("code.verifying") : t("code.submit")}
          </Button>
        </form>

        <div className="flex flex-col items-center gap-1 text-sm">
          <button
            type="button"
            onClick={handleResend}
            disabled={cooldown > 0 || busy !== null}
            className={cx(
              "min-h-11 rounded-full px-3 font-semibold text-brand-text transition-colors hover:bg-brand/5 disabled:cursor-not-allowed disabled:text-ink-muted disabled:hover:bg-transparent",
              focusRing,
            )}
          >
            {busy === "resend" ? t("login.sending") : cooldown > 0 ? t("code.resendIn", { seconds: cooldown }) : t("code.resend")}
          </button>
          <button
            type="button"
            onClick={backToEmail}
            className={cx("min-h-11 rounded-full px-3 text-ink-muted underline decoration-ink-muted/40 underline-offset-2 transition-colors hover:text-ink-soft", focusRing)}
          >
            {t("code.changeEmail")}
          </button>
          <p className="mt-1 text-center text-xs text-ink-muted">{t("code.spamHint")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5" data-testid="auth-email-step">
      <form onSubmit={handleSend} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <Eyebrow as="label" htmlFor={ids.email}>
            {t("login.emailLabel")}
          </Eyebrow>
          <input
            ref={emailRef}
            id={ids.email}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="send"
            autoFocus={autoFocus}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error === "invalidEmail") setError(null);
            }}
            disabled={busy === "send"}
            aria-invalid={error === "invalidEmail" || undefined}
            aria-describedby={error ? ids.error : undefined}
            placeholder={t("login.emailPlaceholder")}
            className={inputClass}
            data-testid="auth-email-input"
          />
        </div>

        {errorBox}

        <Button type="submit" size="lg" block loading={busy === "send"} disabled={busy !== null && busy !== "send"} className="text-[19px]">
          {busy === "send" ? t("login.sending") : t("login.sendCode")}
        </Button>
      </form>

      {showGoogle && (
        <>
          <div className="flex items-center gap-4" aria-hidden>
            <div className="h-px flex-1 bg-line" />
            <span className="text-xs font-medium text-ink-muted">{t("login.or")}</span>
            <div className="h-px flex-1 bg-line" />
          </div>
          <button
            type="button"
            onClick={handleGoogle}
            disabled={busy !== null}
            aria-busy={busy === "google" || undefined}
            className={cx(
              "flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl border-2 border-line bg-surface px-5 text-base font-bold text-ink-soft transition-colors hover:border-brand/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60",
              focusRing,
            )}
          >
            {busy === "google" ? (
              <span aria-hidden className="material-symbols-outlined animate-spin !text-xl">
                progress_activity
              </span>
            ) : (
              <GoogleMark />
            )}
            {busy === "google" ? t("login.googleLoading") : t("login.google")}
          </button>
        </>
      )}
    </div>
  );
}
