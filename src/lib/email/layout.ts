// Shared Meapica email HTML shell.
//
// One consistent branded layout for every transactional email (waitlist,
// order updates, …). Inline styles only — email clients strip <style> blocks.
// Palette mirrors the app brand tokens (globals.css / docs/brand.md). Contrast rule:
// white on `primary` only at 19px bold (CTA); small orange text uses `primaryText`.

import { getSiteUrl } from "./send";

export const EMAIL_COLORS = {
  bg: "#FFF8F0", // --paper
  card: "#ffffff", // --surface
  primary: "#E86C3A", // --brand (fills only)
  primaryText: "#b94f1f", // --brand-text
  heading: "#1b120e", // --ink
  body: "#6b5850", // --ink-body
  border: "#f3ebe7", // --line
  muted: "#7a6963", // --ink-muted
};
const COLORS = EMAIL_COLORS;

export interface EmailLayoutParams {
  /** Big title at the top of the card */
  heading: string;
  /** Small label above the heading (e.g. "Oferta" on commercial email, LSSI art. 20.1) */
  kicker?: string;
  /** Optional greeting line (e.g. "Hola Marc,") */
  greeting?: string;
  /** Optional picture between the greeting and the body (e.g. the book cover); `url` and `href` are escaped here, `alt` by the caller */
  image?: { url: string; alt: string; href?: string; width?: number };
  /** Body paragraphs — each string becomes its own <p> */
  paragraphs: string[];
  /** Optional call-to-action button */
  cta?: { label: string; url: string };
  /** Optional structured block (e.g. an order receipt) rendered below the CTA (raw HTML) */
  detailsHtml?: string;
  /** Optional secondary info block rendered above the sign-off (raw HTML) */
  infoHtml?: string;
  /** Sign-off text (supports \n for line breaks) */
  signoff: string;
  /** Document language attribute */
  lang: string;
  /** Small print under the card (raw HTML), e.g. why we write + unsubscribe link */
  footerNoteHtml?: string;
}

/** Escape user-provided text for safe HTML interpolation. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Render the branded HTML shell. Returns a full HTML document string. */
export function renderEmailLayout(params: EmailLayoutParams): string {
  const site = getSiteUrl();
  const { heading, kicker, greeting, image, paragraphs, cta, detailsHtml, infoHtml, signoff, lang, footerNoteHtml } = params;

  const kickerHtml = kicker
    ? `<p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${COLORS.primaryText};">${kicker}</p>`
    : "";
  const footerNote = footerNoteHtml
    ? `<p style="margin:0 0 12px;font-size:12px;line-height:1.6;color:${COLORS.muted};">${footerNoteHtml}</p>`
    : "";

  const greetingHtml = greeting
    ? `<p style="margin:0 0 20px;font-size:16px;color:${COLORS.body};">${greeting}</p>`
    : "";

  const imageWidth = image?.width ?? 220;
  const imageTag = image
    ? `<img src="${escapeHtml(image.url)}" alt="${image.alt}" width="${imageWidth}" style="display:block;width:${imageWidth}px;max-width:100%;height:auto;border-radius:10px;border:1px solid ${COLORS.border};" />`
    : "";
  const imageHtml = image
    ? `<div style="margin:16px 0 24px;">${image.href ? `<a href="${escapeHtml(image.href)}" style="text-decoration:none;">${imageTag}</a>` : imageTag}</div>`
    : "";

  const paragraphsHtml = paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 20px;font-size:16px;line-height:1.7;color:${COLORS.body};">${p}</p>`,
    )
    .join("");

  const ctaHtml = cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 28px;">
         <tr><td style="border-radius:999px;background-color:${COLORS.primary};">
           <a href="${escapeHtml(cta.url)}" style="display:inline-block;padding:15px 30px;font-size:19px;font-weight:700;line-height:1.2;color:#ffffff;text-decoration:none;border-radius:999px;">${cta.label}</a>
         </td></tr>
       </table>`
    : "";

  const infoBlock = infoHtml
    ? `<div style="margin:0 0 28px;padding:16px 18px;background-color:${COLORS.bg};border-radius:10px;font-size:14px;line-height:1.6;color:${COLORS.body};">${infoHtml}</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="${lang}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:${COLORS.bg};font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COLORS.bg};padding:40px 20px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <tr><td style="padding-bottom:32px;">
          <img src="${site}/images/meapica-logo.png" alt="Meapica" height="36" style="height:36px;width:auto;" />
        </td></tr>
        <tr><td style="background-color:${COLORS.card};border-radius:16px;padding:40px 36px;box-shadow:0 2px 12px rgba(44,24,16,0.06);">
          ${kickerHtml}<h1 style="margin:0 0 8px;font-size:26px;color:${COLORS.heading};font-weight:700;">${heading}</h1>
          ${greetingHtml}
          ${imageHtml}
          ${paragraphsHtml}
          ${ctaHtml}
          ${detailsHtml ?? ""}
          ${infoBlock}
          <div style="border-top:1px solid ${COLORS.border};padding-top:24px;">
            <p style="margin:0;font-size:14px;color:${COLORS.muted};white-space:pre-line;">${signoff}</p>
          </div>
        </td></tr>
        <tr><td style="padding-top:24px;text-align:center;">
          ${footerNote}<p style="margin:0;font-size:12px;color:${COLORS.muted};">&copy; 2026 Meapica. meapica.shop</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
