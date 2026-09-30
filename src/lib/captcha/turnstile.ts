// Cloudflare Turnstile tokens for Supabase Auth CAPTCHA protection (browser only).
//
// Once CAPTCHA is enabled in Supabase (Auth → Attack Protection), GoTrue rejects
// POST /signup (incl. signInAnonymously), /otp (signInWithOtp), /magiclink,
// /recover, /resend, /sso and /token?grant_type=password|web3 without a
// `captcha_token`. /verify, PUT /user, /authorize (OAuth) and the pkce /
// refresh_token grants are never checked (supabase/auth internal/api/api.go +
// isIgnoreCaptchaRoute), so only signInAnonymously and signInWithOtp need one here.
//
// Tokens are single use and expire after 300 s, so every call renders a fresh
// widget, resolves with its token and removes it. Appearance "interaction-only":
// nothing is shown unless Cloudflare asks the visitor to interact; only then the
// overlay becomes visible (with a cancel button).
//
// No NEXT_PUBLIC_TURNSTILE_SITE_KEY → no captcha (undefined token): local dev and
// deployments where Supabase CAPTCHA is still off keep working unchanged.

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const SCRIPT_TIMEOUT_MS = 15_000;
/** A non-interactive challenge normally settles in 1-3 s; interactive ones use timeout-callback. */
const SILENT_TIMEOUT_MS = 30_000;

interface TurnstileRenderOptions {
  sitekey: string;
  callback: (token: string) => void;
  "error-callback": (code: string) => boolean | void;
  "timeout-callback": () => void;
  "unsupported-callback": () => void;
  "before-interactive-callback": () => void;
  "after-interactive-callback": () => void;
  appearance: "always" | "execute" | "interaction-only";
  retry: "auto" | "never";
  "refresh-expired": "auto" | "manual" | "never";
  theme: "auto" | "light" | "dark";
  language: string;
}

interface TurnstileApi {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string | null | undefined;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export type CaptchaFailure = "script" | "failed" | "timeout" | "unsupported" | "cancelled";

export class CaptchaError extends Error {
  readonly reason: CaptchaFailure;
  constructor(reason: CaptchaFailure) {
    super(`captcha_${reason}`);
    this.name = "CaptchaError";
    this.reason = reason;
  }
}

/** Our own challenge failure, or Supabase refusing the token (`captcha_failed`). */
export function isCaptchaError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: unknown; code?: unknown };
  return e.name === "CaptchaError" || e.code === "captcha_failed";
}

export interface CaptchaLabels {
  /** Shown above the widget when Cloudflare needs an interaction. */
  prompt: string;
  cancel: string;
  /** Page locale (es/ca/en/fr) for the widget's own text. */
  locale?: string;
}

/** Widget language. Turnstile has no Catalan: Spanish reads better there than English. */
function widgetLanguage(locale: string | undefined): string {
  const lang = (locale || document.documentElement.lang).slice(0, 2).toLowerCase();
  if (lang === "ca") return "es";
  return lang === "es" || lang === "en" || lang === "fr" ? lang : "auto";
}

function siteKey(): string | null {
  // Literal reference: Next inlines NEXT_PUBLIC_* at build time.
  const key = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  return key ? key : null;
}

export function isCaptchaEnabled(): boolean {
  return siteKey() !== null;
}

let scriptPromise: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!scriptPromise) {
    scriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SCRIPT_SRC;
      script.async = true;
      const timer = window.setTimeout(() => fail(), SCRIPT_TIMEOUT_MS);
      function fail() {
        window.clearTimeout(timer);
        script.remove();
        reject(new CaptchaError("script"));
      }
      script.onload = () => {
        window.clearTimeout(timer);
        if (window.turnstile) resolve(window.turnstile);
        else fail();
      };
      script.onerror = fail;
      document.head.appendChild(script);
    }).catch((err) => {
      scriptPromise = null; // blocked/offline: the next action may retry
      throw err;
    });
  }
  return scriptPromise;
}

/** Hidden host; becomes a small centred dialog only when an interaction is required. */
function createOverlay(labels: CaptchaLabels | undefined, onCancel: () => void) {
  const overlay = document.createElement("div");
  overlay.className =
    "pointer-events-none fixed inset-0 z-[1000] flex items-center justify-center bg-ink/40 p-4 opacity-0 transition-opacity";
  overlay.setAttribute("aria-hidden", "true");
  overlay.dataset.testid = "captcha-overlay";

  const card = document.createElement("div");
  card.className = "flex w-full max-w-sm flex-col items-center gap-4 rounded-3xl bg-surface p-5 text-center shadow-xl";
  const titleId = `captcha-title-${Math.random().toString(36).slice(2)}`;
  if (labels?.prompt) {
    const title = document.createElement("p");
    title.id = titleId;
    title.className = "text-base font-semibold text-ink";
    title.textContent = labels.prompt;
    card.appendChild(title);
  }
  const widget = document.createElement("div");
  widget.className = "flex min-h-[65px] justify-center";
  card.appendChild(widget);
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className =
    "min-h-11 rounded-full px-4 text-sm font-semibold text-ink-muted underline underline-offset-2 hover:text-ink";
  cancel.textContent = labels?.cancel ?? "Cancel";
  cancel.addEventListener("click", onCancel);
  card.appendChild(cancel);
  overlay.appendChild(card);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape" && overlay.getAttribute("aria-hidden") === "false") onCancel();
  };
  document.addEventListener("keydown", onKey);
  document.body.appendChild(overlay);

  return {
    widget,
    show() {
      overlay.classList.remove("pointer-events-none", "opacity-0");
      overlay.setAttribute("aria-hidden", "false");
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      if (labels?.prompt) overlay.setAttribute("aria-labelledby", titleId);
    },
    hide() {
      overlay.classList.add("pointer-events-none", "opacity-0");
      overlay.setAttribute("aria-hidden", "true");
      overlay.removeAttribute("role");
    },
    destroy() {
      document.removeEventListener("keydown", onKey);
      overlay.remove();
    },
  };
}

/**
 * A fresh, unused Turnstile token for one Supabase Auth call, or `undefined` when
 * captcha is not configured. Rejects with CaptchaError when the challenge cannot
 * be passed (blocked script, failed/unsupported/timed-out challenge, cancelled).
 */
export async function getCaptchaToken(labels?: CaptchaLabels): Promise<string | undefined> {
  const sitekey = siteKey();
  if (!sitekey) return undefined;
  const turnstile = await loadTurnstile();

  return new Promise<string>((resolve, reject) => {
    let widgetId: string | null | undefined = null;
    let settled = false;

    const settle = (outcome: { token: string } | { error: CaptchaFailure }) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(silentTimer);
      // Defer removal: Turnstile is still inside its own callback here.
      window.setTimeout(() => {
        if (widgetId) {
          try {
            turnstile.remove(widgetId);
          } catch {
            // already gone
          }
        }
        overlay.destroy();
      }, 0);
      if ("token" in outcome) resolve(outcome.token);
      else reject(new CaptchaError(outcome.error));
    };

    const overlay = createOverlay(labels, () => settle({ error: "cancelled" }));
    const silentTimer = window.setTimeout(() => settle({ error: "timeout" }), SILENT_TIMEOUT_MS);

    try {
      widgetId = turnstile.render(overlay.widget, {
        sitekey,
        callback: (token) => settle({ token }),
        "error-callback": () => {
          settle({ error: "failed" });
          return true; // handled: no uncaught Turnstile error in the console
        },
        "timeout-callback": () => settle({ error: "timeout" }),
        "unsupported-callback": () => settle({ error: "unsupported" }),
        "before-interactive-callback": () => {
          window.clearTimeout(silentTimer); // the visitor may take their time now
          overlay.show();
        },
        "after-interactive-callback": () => overlay.hide(),
        appearance: "interaction-only",
        retry: "never",
        "refresh-expired": "never",
        theme: "light",
        language: widgetLanguage(labels?.locale),
      });
      if (!widgetId) settle({ error: "failed" });
    } catch {
      settle({ error: "failed" });
    }
  });
}
