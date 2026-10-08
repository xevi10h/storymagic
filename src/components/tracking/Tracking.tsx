"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { buttonClass } from "@/components/ui/Button";
import {
  CONSENT_CHANGE_EVENT,
  CONSENT_OPEN_EVENT,
  ADS_TRACKING_ENABLED,
  META_PIXEL_ID,
  TIKTOK_PIXEL_ID,
  GA4_ID,
  captureUtm,
  consentAllows,
  consentFromChoices,
  getConsent,
  setConsent,
  type Consent,
  type ConsentCategory,
} from "@/lib/tracking/consent";
import { POSTHOG_KEY, startPosthog, stopPosthog, syncPosthogPath } from "@/lib/tracking/posthog";

type Fbq = (...args: unknown[]) => void;
type TtqConsent = { grantConsent?: () => void; revokeConsent?: () => void };
type Gtag = (...args: unknown[]) => void;

// Consent Mode v2: the three ad signals follow the "ads" purpose, analytics_storage the "analytics" one.
const ga4Consent = (consent: Consent | null) => {
  const ads = consentAllows(consent, "ads") ? "granted" : "denied";
  return {
    ad_storage: ads,
    ad_user_data: ads,
    ad_personalization: ads,
    analytics_storage: consentAllows(consent, "analytics") ? "granted" : "denied",
  };
};

// Meta's standard base code. PageView on client navigations comes for free: the
// Pixel tracks history.pushState itself (opt-out is fbq.disablePushState).
const PIXEL_SNIPPET = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;
n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init',${JSON.stringify(META_PIXEL_ID)});fbq('track','PageView');`;

// TikTok's standard base code (Events Manager › Meapica web). ttq.page() covers the
// landing page only. ponytail: no page() on client navigations; add a pathname
// effect if TikTok audiences ever need per-page views.
const TIKTOK_SNIPPET = `!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script");n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};ttq.load(${JSON.stringify(TIKTOK_PIXEL_ID)});ttq.page();}(window,document,'ttq');`;

// GA4 (gtag.js), loaded only once analytics is accepted (basic consent mode):
// Consent Mode v2 default "denied" first, then the update to the visitor's choice, then config.
// Client-side navigations are page views via the stream's enhanced measurement (history events).
const ga4Snippet = (consent: Consent) => `window.dataLayer=window.dataLayer||[];window.gtag=function(){dataLayer.push(arguments);};
gtag('consent','default',${JSON.stringify(ga4Consent("denied"))});gtag('consent','update',${JSON.stringify(ga4Consent(consent))});
gtag('js',new Date());gtag('config',${JSON.stringify(GA4_ID)});`;

/**
 * Cookie banner + Meta and TikTok pixels + GA4 + PostHog. Renders nothing while no pixel id is
 * set (no non-essential cookies exist then). Consent is read on the client:
 * marketing pages are ISR, so the server can't know it.
 */
const subscribe = (onChange: () => void) => {
  window.addEventListener(CONSENT_CHANGE_EVENT, onChange);
  return () => window.removeEventListener(CONSENT_CHANGE_EVENT, onChange);
};
// "ssr" on the server and during hydration: render nothing, no banner flash.
const readConsent = (): Consent | "unset" => getConsent() ?? "unset";
const serverConsent = (): "ssr" => "ssr";

export default function Tracking() {
  const t = useTranslations("cookieConsent");
  const consent = useSyncExternalStore(subscribe, readConsent, serverConsent);
  const [reopened, setReopened] = useState(false);
  // Second layer ("Configurar"): per-purpose switches, never pre-ticked on a first visit.
  const [configuring, setConfiguring] = useState(false);
  const [choices, setChoices] = useState<Record<ConsentCategory, boolean>>({ analytics: false, ads: false });
  const pathname = usePathname();
  const open = ADS_TRACKING_ENABLED && (consent === "unset" || reopened);
  const stored: Consent | null = consent === "ssr" || consent === "unset" ? null : consent;
  const analyticsAllowed = consentAllows(stored, "analytics");
  const adsAllowed = consentAllows(stored, "ads");

  const bannerRef = useRef<HTMLDivElement>(null);
  // Phones: the first layer is a full-width bar over the bottom edge, exactly where the "next" and
  // buy bars live. Publish its height so those bars sit on top of it (--cookie-banner-h, globals.css).
  // Not for the settings layer (a tall sheet) nor from sm up (a corner card that covers no button).
  useEffect(() => {
    const el = bannerRef.current;
    const root = document.documentElement;
    if (!open || configuring || !el) return;
    const phone = window.matchMedia("(max-width: 639.98px)");
    const sync = () => root.style.setProperty("--cookie-banner-h", phone.matches ? `${el.offsetHeight}px` : "0px");
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    phone.addEventListener("change", sync);
    sync();
    return () => {
      observer.disconnect();
      phone.removeEventListener("change", sync);
      root.style.removeProperty("--cookie-banner-h");
    };
  }, [open, configuring]);

  const openSettings = () => {
    // Re-opened or "Configurar": the switches show what is stored (all off before any choice).
    const current = getConsent();
    setChoices({ analytics: consentAllows(current, "analytics"), ads: consentAllows(current, "ads") });
    setConfiguring(true);
  };

  useEffect(() => {
    // Footer "Configurar cookies": straight to the per-purpose layer, with the current choice shown.
    const onOpen = () => {
      const current = getConsent();
      setChoices({ analytics: consentAllows(current, "analytics"), ads: consentAllows(current, "ads") });
      setConfiguring(current !== null);
      setReopened(true);
    };
    window.addEventListener(CONSENT_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (consent === "ssr" || consent === "unset") return; // no choice yet: nothing loaded, nothing to stop
    if (adsAllowed) captureUtm(location.search);
    // Revoked after a pixel already loaded in this tab: stop it sending.
    const w = window as unknown as { fbq?: Fbq; ttq?: TtqConsent; gtag?: Gtag };
    if (w.fbq) w.fbq("consent", adsAllowed ? "grant" : "revoke");
    if (w.gtag) w.gtag("consent", "update", ga4Consent(consent));
    if (w.ttq) (adsAllowed ? w.ttq.grantConsent : w.ttq.revokeConsent)?.();
    if (POSTHOG_KEY) {
      if (analyticsAllowed) startPosthog();
      else stopPosthog();
    }
  }, [consent, adsAllowed, analyticsAllowed]);

  useEffect(() => {
    if (POSTHOG_KEY && analyticsAllowed) syncPosthogPath(pathname);
  }, [pathname, analyticsAllowed]);

  if (!ADS_TRACKING_ENABLED) return null;

  const choose = (value: Consent) => {
    setConsent(value);
    setReopened(false);
    setConfiguring(false);
  };

  // Same style, size and row for "Rechazar" and "Aceptar": the AEPD requires rejecting to be
  // as easy as accepting, and forbids nudging towards "accept".
  const choiceClass = buttonClass({ variant: "secondary", size: "sm", className: "min-h-11 flex-1 px-3" });
  const purposes: { id: ConsentCategory; title: string; text: string }[] = [
    { id: "analytics", title: t("analyticsTitle"), text: t("analyticsText") },
    { id: "ads", title: t("adsTitle"), text: t("adsText") },
  ];

  return (
    <>
      {adsAllowed && META_PIXEL_ID && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {PIXEL_SNIPPET}
        </Script>
      )}
      {adsAllowed && TIKTOK_PIXEL_ID && (
        <Script id="tiktok-pixel" strategy="afterInteractive">
          {TIKTOK_SNIPPET}
        </Script>
      )}
      {stored && analyticsAllowed && GA4_ID && (
        <>
          <Script id="ga4-src" src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA4_ID)}`} strategy="afterInteractive" />
          <Script id="ga4" strategy="afterInteractive">
            {ga4Snippet(stored)}
          </Script>
        </>
      )}
      {open && (
        <div
          ref={bannerRef}
          role="dialog"
          aria-live="polite"
          aria-label={t("title")}
          data-testid="cookie-banner"
          // Phones: a compact bar flush with the bottom edge (two lines of text + one row of buttons,
          // about an eighth of the screen), so the page stays usable behind it. The third parties are
          // named in the settings layer and in the cookie policy. From sm: a small card in the corner.
          className="fixed inset-x-0 bottom-0 z-[60] sm:bottom-4 sm:left-4 sm:right-auto sm:w-[26rem]"
        >
          <div className="max-h-[85dvh] overflow-y-auto rounded-t-2xl border border-b-0 border-line bg-surface px-4 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-8px_30px_-12px_rgba(58,36,24,.35)] sm:rounded-2xl sm:border-b sm:p-4 sm:shadow-xl">
            {configuring ? (
              <>
                <p className="font-display text-base font-semibold text-ink">{t("settingsTitle")}</p>
                <ul className="mt-2 divide-y divide-line">
                  <li className="flex items-start justify-between gap-3 py-2.5">
                    <span>
                      <span className="block text-[13px] font-bold text-ink">{t("necessaryTitle")}</span>
                      <span className="block text-xs leading-snug text-ink-muted">{t("necessaryText")}</span>
                    </span>
                    <span className="shrink-0 pt-0.5 text-xs font-semibold text-ink-muted">{t("alwaysOn")}</span>
                  </li>
                  {purposes.map((p) => (
                    <li key={p.id} className="flex items-start justify-between gap-3 py-2.5">
                      <span id={`cookie-${p.id}`}>
                        <span className="block text-[13px] font-bold text-ink">{p.title}</span>
                        <span className="block text-xs leading-snug text-ink-muted">{p.text}</span>
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={choices[p.id]}
                        aria-labelledby={`cookie-${p.id}`}
                        data-testid={`cookie-switch-${p.id}`}
                        onClick={() => setChoices((prev) => ({ ...prev, [p.id]: !prev[p.id] }))}
                        className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                          choices[p.id] ? "bg-brand-deep" : "bg-line-warm"
                        }`}
                      >
                        <span
                          aria-hidden
                          className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                            choices[p.id] ? "translate-x-5" : ""
                          }`}
                        />
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-xs text-ink-muted">
                  <Link href="/legal#cookies" className="font-semibold text-brand-text underline underline-offset-2">
                    {t("policy")}
                  </Link>
                </p>
                <div className="mt-3 flex gap-2">
                  <button type="button" className={choiceClass} onClick={() => choose("denied")}>
                    {t("rejectAll")}
                  </button>
                  <button type="button" className={choiceClass} onClick={() => choose("granted")}>
                    {t("acceptAll")}
                  </button>
                </div>
                <button
                  type="button"
                  data-testid="cookie-save"
                  className={buttonClass({ variant: "secondary", size: "sm", block: true, className: "mt-2 min-h-11" })}
                  onClick={() => choose(consentFromChoices(choices))}
                >
                  {t("save")}
                </button>
              </>
            ) : (
              <>
                <p className="text-[12.5px] leading-snug text-ink-soft sm:text-[13px]">
                  {t("text")}{" "}
                  <Link href="/legal#cookies" className="font-semibold text-brand-text underline underline-offset-2">
                    {t("policy")}
                  </Link>
                </p>
                <div className="mt-1.5 flex items-center gap-2 sm:mt-2.5">
                  <button
                    type="button"
                    data-testid="cookie-configure"
                    onClick={openSettings}
                    className="min-h-11 shrink-0 px-1 text-[13px] font-semibold text-ink-soft underline decoration-ink-muted/40 underline-offset-4 hover:text-brand-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  >
                    {t("configure")}
                  </button>
                  <button type="button" data-testid="cookie-reject" className={choiceClass} onClick={() => choose("denied")}>
                    {t("reject")}
                  </button>
                  <button type="button" data-testid="cookie-accept" className={choiceClass} onClick={() => choose("granted")}>
                    {t("accept")}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/** Footer list item that re-opens the banner (withdrawing must be as easy as giving consent). */
export function CookieSettingsButton({ className, label }: { className: string; label: string }) {
  if (!ADS_TRACKING_ENABLED) return null;
  return (
    <li>
      <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(CONSENT_OPEN_EVENT))}>
        {label}
      </button>
    </li>
  );
}
