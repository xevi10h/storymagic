// First-touch attribution of a story: which channel (UTMs, referring site, ad click) brought the
// visitor whose story this is. Consent-independent by design, because NOTHING is stored on the
// device: the landing page's own URL and referrer are read once into JS memory (this module) and
// sent with the story-creation request the parent makes (POST /api/stories), which stores them on
// the story row. No cookie, localStorage or sessionStorage, so LSSI art. 22.2 (storage of or access
// to data on the terminal) does not apply; the server-side record is our own processing under
// legitimate interest (RGPD art. 6.1.f), disclosed in the privacy policy. Full reasoning:
// docs/technical-architecture.md › "Story attribution".
// Trade-off: a full page reload or a new tab restarts the capture (that page's referrer is then
// our own site, reported as "(internal)" by scripts/growth-funnel.mjs).
// Shared by client and server — no server-only imports here.

export const ATTRIBUTION_UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content"] as const;
/** Ad-click ids: only WHICH one was present is kept, never its value (a per-click identifier). */
export const ATTRIBUTION_CLICK_IDS = ["gclid", "fbclid", "ttclid", "msclkid"] as const;

export const ATTRIBUTION_MAX = { value: 100, host: 253, path: 200 } as const;

export type Attribution = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  /** Ad-click id parameter name present on the landing URL (gclid / fbclid / ttclid / msclkid). */
  click_id?: (typeof ATTRIBUTION_CLICK_IDS)[number];
  /** Host of the referring page, lower-case, without "www." (never its path or query). */
  referrer_host?: string;
  /** Path of the first page seen in this page load, without query string or hash. */
  landing_path?: string;
};

const clean = (value: string | null, max: number): string | undefined => {
  const v = value?.trim();
  return v ? v.slice(0, max) : undefined;
};

/** Pure: the attribution of a landing page from its URL parts and document.referrer. */
export function parseAttribution(input: { search: string; pathname: string; referrer: string }): Attribution {
  const params = new URLSearchParams(input.search);
  const out: Attribution = {};
  for (const key of ATTRIBUTION_UTM_KEYS) {
    const v = clean(params.get(key), ATTRIBUTION_MAX.value);
    if (v) out[key] = v.toLowerCase();
  }
  const clickId = ATTRIBUTION_CLICK_IDS.find((k) => params.has(k));
  if (clickId) out.click_id = clickId;
  let host: string | undefined;
  try {
    host = input.referrer ? new URL(input.referrer).hostname.toLowerCase().replace(/^www\./, "") : undefined;
  } catch {
    host = undefined; // malformed referrer: ignore
  }
  if (host) out.referrer_host = host.slice(0, ATTRIBUTION_MAX.host);
  const path = clean(input.pathname, ATTRIBUTION_MAX.path);
  if (path) out.landing_path = path;
  return out;
}

let firstTouch: Attribution | null = null;

/** Client: record the first page of this page load (idempotent; later navigations keep it). */
export function captureFirstTouch() {
  if (firstTouch || typeof window === "undefined") return;
  firstTouch = parseAttribution({ search: location.search, pathname: location.pathname, referrer: document.referrer });
}

/** Client: what POST /api/stories receives. Null if nothing was captured in this page load. */
export function getFirstTouch(): Attribution | null {
  return firstTouch;
}
