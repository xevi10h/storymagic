import type { AbstractIntlMessages } from "next-intl";

/**
 * Messages handed to NextIntlClientProvider, i.e. serialized into the HTML of
 * EVERY page for client components. The programmatic-landing copy (seo.gifts /
 * seo.ages / seo.themes / seo.hubs, ≈46 KB of JSON, a quarter of the payload) is
 * only ever read by server components (SeoLandingPage, HubPage, generateMetadata,
 * OG images), so it is left out. `seo.nav` and `seo.common` stay (shared labels).
 *
 * The gift-voucher copy (`giftVoucher`) is server-only too.
 *
 * Rule: a "use client" component must not read these keys. If one ever needs to,
 * remove the key from this list (a missing client message renders its key).
 * Do not add `legal` here: removing it made the production home page spin in a
 * React re-render loop (≈3.5 s of CPU after load, measured 2026-10-03), cause not
 * identified; the seo-only trim was measured loop-free.
 */
const SERVER_ONLY_SEO_KEYS = ["gifts", "ages", "themes", "hubs"] as const;

export function clientMessages(messages: AbstractIntlMessages): AbstractIntlMessages {
  // giftVoucher: the voucher pages are server components; the form gets its labels as props.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { seo, giftVoucher, ...rest } = messages;
  if (!seo || typeof seo !== "object") return rest;
  const clientSeo = { ...(seo as AbstractIntlMessages) };
  for (const key of SERVER_ONLY_SEO_KEYS) delete clientSeo[key];
  return { ...rest, seo: clientSeo };
}
