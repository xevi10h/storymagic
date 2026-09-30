"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import BrandLogo from "@/components/BrandLogo";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import EmailSignIn, { type SignInStep } from "@/components/auth/EmailSignIn";
import { Card, Heading, cx, focusRing } from "@/components/ui";
import { queryErrorKey } from "@/lib/auth/auth-errors";
import { sanitizeNextPath } from "@/lib/auth/next-path";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageContent />
    </Suspense>
  );
}

/**
 * The one "Entrar" screen: email → one email with a link + a code, or Google.
 * No passwords, no separate sign-up (the first login creates the account).
 * Query: next (locale-less path, sanitised), email (prefill, e.g. from an order
 * email), error (set by the email-link / Google routes).
 */
function LoginPageContent() {
  const t = useTranslations("auth");
  const searchParams = useSearchParams();
  const next = sanitizeNextPath(searchParams.get("next"));
  const initialEmail = (searchParams.get("email") ?? "").trim().slice(0, 254);
  const initialError = queryErrorKey(searchParams.get("error"));

  const [step, setStep] = useState<SignInStep>("email");
  const [isGuest, setIsGuest] = useState(false);
  const onStepChange = useCallback((s: SignInStep) => setStep(s), []);

  useEffect(() => {
    let active = true;
    createClient()
      .auth.getSession()
      .then(({ data: { session } }) => {
        if (active) setIsGuest(session?.user?.is_anonymous === true);
      });
    return () => {
      active = false;
    };
  }, []);

  const title = step === "code" ? t("code.title") : isGuest ? t("login.guestTitle") : t("login.title");
  const subtitle = step === "code" ? null : isGuest ? t("login.guestSubtitle") : t("login.subtitle");

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <header className="mx-auto flex h-14 w-full max-w-[1120px] items-center justify-between px-4 sm:px-6">
        <Link href="/" aria-label="Meapica" className={cx("flex min-h-11 items-center rounded-md", focusRing)}>
          <BrandLogo className="h-6 text-brand-deep" />
        </Link>
        <LocaleSwitcher />
      </header>

      <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-6 sm:items-center sm:pt-0">
        <div className="w-full max-w-[440px]">
          <Heading size="page" subtitle={subtitle} className="mb-6 text-center" key={step}>
            {title}
          </Heading>

          <Card variant="elevated" className="p-5 sm:p-7">
            <EmailSignIn
              next={next}
              initialEmail={initialEmail}
              initialError={initialError}
              autoFocus={!initialEmail}
              onStepChange={onStepChange}
            />
          </Card>

          {step === "email" && <p className="mt-5 text-center text-sm text-ink-muted">{t("login.newAccountHint")}</p>}

          <p className="mt-3 text-center">
            <Link
              href="/"
              className={cx("inline-flex min-h-11 items-center rounded-full px-3 text-sm text-ink-muted transition-colors hover:text-ink-soft", focusRing)}
            >
              {t("login.backHome")}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
