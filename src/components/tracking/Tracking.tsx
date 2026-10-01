"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Script from "next/script";
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
  getConsent,
  setConsent,
  type Consent,
} from "@/lib/tracking/consent";

type Fbq = (...args: unknown[]) => void;
type TtqConsent = { grantConsent?: () => void; revokeConsent?: () => void };
type Gtag = (...args: unknown[]) => void;

// One banner choice covers all four Consent Mode v2 signals.
const ga4Consent = (v: Consent) => ({ ad_storage: v, ad_user_data: v, ad_personalization: v, analytics_storage: v });

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

// GA4 (gtag.js), loaded only after "Aceptar" like the pixels (basic consent mode):
// Consent Mode v2 default "denied" first, then the update to "granted", then config.
// Client-side navigations are page views via the stream's enhanced measurement (history events).
const GA4_SNIPPET = `window.dataLayer=window.dataLayer||[];window.gtag=function(){dataLayer.push(arguments);};
gtag('consent','default',${JSON.stringify(ga4Consent("denied"))});gtag('consent','update',${JSON.stringify(ga4Consent("granted"))});
gtag('js',new Date());gtag('config',${JSON.stringify(GA4_ID)});`;

/**
 * Cookie banner + Meta and TikTok pixels + GA4. Renders nothing while no pixel id is
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
  const open = ADS_TRACKING_ENABLED && (consent === "unset" || reopened);

  useEffect(() => {
    const onOpen = () => setReopened(true);
    window.addEventListener(CONSENT_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (consent === "granted") captureUtm(location.search);
    // Revoked after a pixel already loaded in this tab: stop it sending.
    const w = window as unknown as { fbq?: Fbq; ttq?: TtqConsent; gtag?: Gtag };
    if (w.fbq) w.fbq("consent", consent === "granted" ? "grant" : "revoke");
    if (w.gtag) w.gtag("consent", "update", ga4Consent(consent === "granted" ? "granted" : "denied"));
    if (w.ttq) (consent === "granted" ? w.ttq.grantConsent : w.ttq.revokeConsent)?.();
  }, [consent]);

  if (!ADS_TRACKING_ENABLED) return null;

  const choose = (value: Consent) => {
    setConsent(value);
    setReopened(false);
  };

  // Same style for both choices: the AEPD forbids nudging towards "accept".
  const choiceClass = buttonClass({ variant: "secondary", size: "sm", className: "flex-1 sm:flex-none" });

  return (
    <>
      {consent === "granted" && META_PIXEL_ID && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {PIXEL_SNIPPET}
        </Script>
      )}
      {consent === "granted" && TIKTOK_PIXEL_ID && (
        <Script id="tiktok-pixel" strategy="afterInteractive">
          {TIKTOK_SNIPPET}
        </Script>
      )}
      {consent === "granted" && GA4_ID && (
        <>
          <Script id="ga4-src" src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA4_ID)}`} strategy="afterInteractive" />
          <Script id="ga4" strategy="afterInteractive">
            {GA4_SNIPPET}
          </Script>
        </>
      )}
      {open && (
        <div
          role="dialog"
          aria-live="polite"
          aria-label={t("title")}
          className="fixed inset-x-0 bottom-0 z-[60] p-4 sm:bottom-4 sm:left-4 sm:right-auto sm:max-w-md sm:p-0"
        >
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-xl">
            <p className="text-sm leading-relaxed text-ink-soft">
              {t("text")}{" "}
              <Link href="/legal#cookies" className="font-semibold text-brand-text underline underline-offset-2">
                {t("policy")}
              </Link>
            </p>
            <div className="mt-4 flex gap-3">
              <button type="button" className={choiceClass} onClick={() => choose("denied")}>
                {t("reject")}
              </button>
              <button type="button" className={choiceClass} onClick={() => choose("granted")}>
                {t("accept")}
              </button>
            </div>
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
