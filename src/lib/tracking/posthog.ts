// PostHog product analytics (funnels + session replay), EU cloud, browser only.
// Loaded only after cookie consent ("Aceptar"), like the pixels: Tracking.tsx calls
// startPosthog() / stopPosthog(). Events go through our own /ingest proxy (next.config.ts).
//
// Children's data never leaves the browser:
// - replay masks every text node, text attribute and input on PRIVATE_PATH pages (the child's name,
//   dedication and story are on screen there) and blocks all private / local images
//   (signed child illustrations, blob/data previews of an uploaded photo);
// - autocapture drops element text and attributes on the same pages;
// - the shared preview (/preview/<token>) is a capability URL: nothing is sent there.

import type { PostHog } from "posthog-js";

export const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "";

/** Pages that show the child's data (name, dedication, story, avatar). Locale prefix optional. */
const PRIVATE_PATH = /^(\/(es|ca|en|fr))?\/(create|dashboard|profile|checkout|preview|auth)(\/|$)/;
/** Shared previews: the token in the URL grants access to a child's book. */
const NO_TRACK_PATH = /^(\/(es|ca|en|fr))?\/preview\//;

export const isPrivatePath = (pathname: string) => PRIVATE_PATH.test(pathname);
export const isNoTrackPath = (pathname: string) => NO_TRACK_PATH.test(pathname);

/** Attributes that hold human-readable text (never class/style/src/href: replay layout needs them). */
const TEXT_ATTRIBUTE = /^(alt|title|placeholder|value|aria-label|aria-description|aria-valuetext|aria-roledescription|data-name)$/;
const mask = (text: string) => text.replace(/\S/g, "*");

let client: Promise<PostHog> | null = null;

export function startPosthog(): void {
  if (!POSTHOG_KEY || typeof window === "undefined") return;
  if (client) {
    // Re-granted in the same tab after a withdrawal.
    void client.then((ph) => {
      ph.set_config({ disable_persistence: false });
      ph.opt_in_capturing();
      syncPosthogPath(location.pathname, ph);
    });
    return;
  }
  client = import("posthog-js").then(({ default: posthog }) => {
    posthog.init(POSTHOG_KEY, {
      api_host: "/ingest",
      ui_host: "https://eu.posthog.com",
      defaults: "2026-08-30",
      // No identify() calls: anonymous events only, no person profiles.
      person_profiles: "identified_only",
      mask_personal_data_properties: true,
      // No network timings in replays: request URLs include signed child-image links.
      capture_performance: { network_timing: false, web_vitals: true },
      before_send: (event) => (event && isNoTrackPath(location.pathname) ? null : event),
      session_recording: {
        maskAllInputs: true,
        maskTextSelector: "*",
        maskTextFn: (text) => (isPrivatePath(location.pathname) ? mask(text) : text),
        // alt / aria-label / title… can carry the child's name too.
        maskAttributeFn: (name, value) => (isPrivatePath(location.pathname) && TEXT_ATTRIBUTE.test(name) ? mask(value) : value),
        blockSelector: 'img[src*="/storage/v1/object/sign/"], img[src^="blob:"], img[src^="data:"]',
        recordHeaders: false,
        recordBody: false,
      },
    });
    if (posthog.has_opted_out_capturing()) posthog.opt_in_capturing();
    syncPosthogPath(location.pathname, posthog);
    return posthog;
  });
}

/** Revoked consent: stop sending, forget the visitor and delete every ph_ cookie / storage key. */
export function stopPosthog(): void {
  if (!client) return clearPosthogStorage(); // denied before PostHog loaded in this tab
  void client.then((ph) => {
    ph.stopSessionRecording();
    ph.opt_out_capturing();
    // No reset(): it reloads feature flags (a request after withdrawal); clearing storage forgets the visitor.
    // Otherwise PostHog re-writes its cookie right after we delete it.
    ph.set_config({ disable_persistence: true });
    clearPosthogStorage();
  });
}

function clearPosthogStorage() {
  const apex = location.hostname.replace(/^www\./, "");
  for (const name of document.cookie.split("; ").map((c) => c.split("=")[0])) {
    if (!name.startsWith("ph_") && !name.startsWith("__ph_")) continue;
    document.cookie = `${name}=; Path=/; Max-Age=0`;
    document.cookie = `${name}=; Path=/; Max-Age=0; Domain=.${apex}`;
  }
  for (const store of [localStorage, sessionStorage]) {
    for (const key of Object.keys(store)) if (key.startsWith("ph_") || key.startsWith("__ph_")) store.removeItem(key);
  }
}

/** Per-route privacy: autocapture text/attributes off and replay paused where it must be. */
export function syncPosthogPath(pathname: string, loaded?: PostHog): void {
  const apply = (ph: PostHog) => {
    const isPrivate = isPrivatePath(pathname);
    ph.set_config({ mask_all_text: isPrivate, mask_all_element_attributes: isPrivate });
    if (isNoTrackPath(pathname)) ph.stopSessionRecording();
    else if (!ph.sessionRecordingStarted()) ph.startSessionRecording();
  };
  if (loaded) apply(loaded);
  else void client?.then(apply);
}

/** Product event (no-op until consent loaded PostHog). */
export function capturePosthog(name: string, properties?: Record<string, unknown>): void {
  void client?.then((ph) => ph.capture(name, properties));
}
