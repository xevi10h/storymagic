"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button, buttonClass, cx } from "@/components/ui";
import { SUPPORT_EMAIL } from "@/lib/support";
import { DISPLAY_NAME_MAX, REVIEW_BODY_MAX, parseReviewInput, type ReviewInputError } from "@/lib/reviews/review-content";
import { Star } from "./Stars";

export type ReviewPageState =
  | { kind: "invalid" }
  | { kind: "unavailable" }
  | { kind: "reviewed" }
  | { kind: "form"; token: string; bookTitle: string | null; suggestedName: string };

type Done = "published" | "pending" | "private" | "already";
type SubmitError = ReviewInputError | "generic";

const RATINGS = [1, 2, 3, 4, 5] as const;

/** Review form → thank-you (with the optional Trustpilot link). */
export function ReviewForm({ state, locale, trustpilotUrl }: { state: ReviewPageState; locale: string; trustpilotUrl: string | null }) {
  const t = useTranslations("review");
  const [done, setDone] = useState<Done | null>(null);

  const mailto = (
    <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-brand-text underline underline-offset-2">
      {SUPPORT_EMAIL}
    </a>
  );

  if (state.kind === "invalid") {
    return (
      <Panel title={t("invalid.title")} testId="review-invalid">
        <p>{t.rich("invalid.body", { mail: () => mailto })}</p>
        <HomeLink label={t("backHome")} />
      </Panel>
    );
  }
  if (state.kind === "unavailable") {
    return (
      <Panel title={t("unavailable.title")} testId="review-unavailable">
        <p>{t.rich("unavailable.body", { mail: () => mailto })}</p>
        <HomeLink label={t("backHome")} />
      </Panel>
    );
  }
  if (state.kind === "reviewed" || done) {
    return (
      <Panel title={t("done.title")} testId="review-done" icon="check_circle">
        <p>{t(`done.${state.kind === "reviewed" ? "already" : done}`)}</p>
        {trustpilotUrl && (
          <div className="mt-6 rounded-2xl border-2 border-line bg-paper p-4">
            <p className="font-semibold text-ink">{t("trustpilot.ask")}</p>
            <p className="mt-1 text-sm text-ink-soft">{t("trustpilot.note")}</p>
            <a
              href={trustpilotUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cx(buttonClass({ variant: "secondary", size: "sm" }), "mt-3")}
              data-testid="review-trustpilot"
            >
              {t("trustpilot.cta")}
              <span aria-hidden className="material-symbols-outlined !text-lg" data-icon="open_in_new" />
            </a>
          </div>
        )}
        <HomeLink label={t("backHome")} />
      </Panel>
    );
  }

  return <FormPanel state={state} locale={locale} onDone={setDone} mailto={mailto} />;
}

function FormPanel({
  state,
  locale,
  onDone,
  mailto,
}: {
  state: Extract<ReviewPageState, { kind: "form" }>;
  locale: string;
  onDone: (d: Done) => void;
  mailto: React.ReactNode;
}) {
  const t = useTranslations("review");
  const ids = { body: useId(), name: useId(), nameHint: useId(), counter: useId(), consent: useId(), rating: useId() };
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [body, setBody] = useState("");
  const [name, setName] = useState(state.suggestedName);
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<SubmitError | null>(null);
  const bodyLength = [...body].length;
  const shown = hover || rating;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;
    const parsed = parseReviewInput({ rating, body, displayName: name, publishConsent: consent });
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError(null);
    setSending(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ t: state.token, ...parsed.value, locale }),
      });
      const data = (await res.json().catch(() => ({}))) as { status?: string; error?: string };
      if (res.ok) {
        onDone(!parsed.value.publishConsent ? "private" : data.status === "published" ? "published" : "pending");
        return;
      }
      if (res.status === 409) {
        onDone("already");
        return;
      }
      const field = data.error?.replace(/^invalid_/, "");
      setError(field === "rating" || field === "body" || field === "display_name" ? field : "generic");
    } catch {
      setError("generic");
    } finally {
      setSending(false);
    }
  }

  return (
    <Panel
      title={state.bookTitle ? t("form.titleBook", { title: state.bookTitle }) : t("form.title")}
      testId="review-form"
    >
      <p>{t("form.lead")}</p>
      <form onSubmit={(e) => void submit(e)} noValidate className="mt-6 flex flex-col gap-6">
        <fieldset>
          <legend id={ids.rating} className="mb-2 block text-sm font-semibold text-ink">
            {t("form.ratingLabel")}
          </legend>
          <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
            {RATINGS.map((n) => (
              <label
                key={n}
                onMouseEnter={() => setHover(n)}
                className="group relative inline-flex h-12 w-12 cursor-pointer items-center justify-center rounded-xl has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand"
              >
                <input
                  type="radio"
                  name="rating"
                  value={n}
                  checked={rating === n}
                  onChange={() => {
                    setRating(n);
                    if (error === "rating") setError(null);
                  }}
                  className="sr-only"
                  aria-label={t(`form.stars.${n}`)}
                  data-testid={`review-star-${n}`}
                />
                <Star filled={n <= shown} className="h-9 w-9 transition-transform group-hover:scale-110" />
              </label>
            ))}
          </div>
          <p className="mt-1 min-h-5 text-sm font-semibold text-ink-soft" aria-live="polite">
            {shown ? t(`form.stars.${shown}`) : ""}
          </p>
          {error === "rating" && (
            <p role="alert" className="mt-1 text-sm font-semibold text-error">
              {t("errors.rating")}
            </p>
          )}
        </fieldset>

        <div>
          <label htmlFor={ids.body} className="mb-1.5 block text-sm font-semibold text-ink">
            {t("form.bodyLabel")}
          </label>
          <textarea
            id={ids.body}
            value={body}
            onChange={(e) => setBody(Array.from(e.target.value).slice(0, REVIEW_BODY_MAX).join(""))}
            placeholder={t("form.bodyPlaceholder")}
            rows={4}
            aria-describedby={ids.counter}
            className="w-full resize-y rounded-xl border-2 border-line bg-surface px-3.5 py-3 text-base leading-relaxed text-ink placeholder:text-ink-muted focus:border-brand focus:outline-none"
            data-testid="review-body"
          />
          <p id={ids.counter} className="mt-1 text-right text-xs tabular-nums text-ink-muted">
            {t("form.counter", { count: bodyLength, max: REVIEW_BODY_MAX })}
          </p>
        </div>

        <div>
          <label htmlFor={ids.name} className="mb-1.5 block text-sm font-semibold text-ink">
            {t("form.nameLabel")}
          </label>
          <input
            id={ids.name}
            type="text"
            value={name}
            maxLength={DISPLAY_NAME_MAX}
            onChange={(e) => {
              setName(e.target.value);
              if (error === "display_name") setError(null);
            }}
            autoComplete="off"
            aria-describedby={ids.nameHint}
            aria-invalid={error === "display_name" || undefined}
            className="min-h-12 w-full rounded-xl border-2 border-line bg-surface px-3.5 text-base text-ink placeholder:text-ink-muted focus:border-brand focus:outline-none"
            placeholder={t("form.namePlaceholder")}
            data-testid="review-name"
          />
          <p id={ids.nameHint} className="mt-1 text-xs leading-snug text-ink-muted">
            {t("form.nameHint")}
          </p>
          {error === "display_name" && (
            <p role="alert" className="mt-1 text-sm font-semibold text-error">
              {t("errors.display_name")}
            </p>
          )}
        </div>

        <label htmlFor={ids.consent} className="flex cursor-pointer items-start gap-2.5 text-sm leading-snug text-ink-body">
          <input
            id={ids.consent}
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-brand"
            data-testid="review-consent"
          />
          <span>
            {t("form.consentLabel")}
            <span className="mt-0.5 block text-xs text-ink-muted">{t("form.consentNote")}</span>
          </span>
        </label>

        <div>
          <Button type="submit" size="lg" block loading={sending} data-testid="review-submit">
            {t("form.submit")}
          </Button>
          {(error === "generic" || error === "body") && (
            <p role="alert" className="mt-3 text-sm font-semibold text-error">
              {error === "body" ? t("errors.body") : t.rich("errors.generic", { mail: () => mailto })}
            </p>
          )}
          <p className="mt-3 text-xs leading-snug text-ink-muted">
            {t("form.privacy")}{" "}
            <a href={`/${locale}/legal#privacy`} className="font-semibold underline decoration-brand/30 underline-offset-2 hover:text-brand-text">
              {t("form.privacyLink")}
            </a>
          </p>
        </div>
      </form>
    </Panel>
  );
}

function Panel({ title, icon, testId, children }: { title: string; icon?: string; testId: string; children: React.ReactNode }) {
  return (
    <section
      data-testid={testId}
      className="w-full max-w-[560px] rounded-3xl bg-surface p-6 text-base leading-relaxed text-ink-body shadow-card ring-1 ring-line sm:p-8"
    >
      {icon && (
        <span aria-hidden className="material-symbols-outlined mb-3 block text-[36px] text-success" data-icon={icon} />
      )}
      <h1 className="text-balance font-display text-[26px] font-bold leading-tight text-ink sm:text-3xl">{title}</h1>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function HomeLink({ label }: { label: string }) {
  return (
    <div className="mt-7">
      <Link href="/" className={buttonClass({ variant: "secondary", size: "sm" })}>
        {label}
      </Link>
    </div>
  );
}
