"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Script from "next/script";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { buttonClass } from "@/components/ui/Button";
import {
  CONSENT_CHANGE_EVENT,
  CONSENT_OPEN_EVENT,
  META_PIXEL_ID,
  captureUtm,
  getConsent,
  setConsent,
  type Consent,
} from "@/lib/tracking/consent";

type Fbq = (...args: unknown[]) => void;

// Meta's standard base code. PageView on client navigations comes for free: the
// Pixel tracks history.pushState itself (opt-out is fbq.disablePushState).
const PIXEL_SNIPPET = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;
n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init',${JSON.stringify(META_PIXEL_ID)});fbq('track','PageView');`;

/**
 * Cookie banner + Meta Pixel. Renders nothing while NEXT_PUBLIC_META_PIXEL_ID is
 * unset (no non-essential cookies exist then). Consent is read on the client:
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
  const open = META_PIXEL_ID !== "" && (consent === "unset" || reopened);

  useEffect(() => {
    const onOpen = () => setReopened(true);
    window.addEventListener(CONSENT_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (consent === "granted") captureUtm(location.search);
    // Revoked after the Pixel already loaded in this tab: stop it sending.
    const fbq = (window as unknown as { fbq?: Fbq }).fbq;
    if (fbq) fbq("consent", consent === "granted" ? "grant" : "revoke");
  }, [consent]);

  if (!META_PIXEL_ID) return null;

  const choose = (value: Consent) => {
    setConsent(value);
    setReopened(false);
  };

  // Same style for both choices: the AEPD forbids nudging towards "accept".
  const choiceClass = buttonClass({ variant: "secondary", size: "sm", className: "flex-1 sm:flex-none" });

  return (
    <>
      {consent === "granted" && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {PIXEL_SNIPPET}
        </Script>
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
  if (!META_PIXEL_ID) return null;
  return (
    <li>
      <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(CONSENT_OPEN_EVENT))}>
        {label}
      </button>
    </li>
  );
}
