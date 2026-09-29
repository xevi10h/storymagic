// Shared Meapica email HTML shell.
//
// One consistent branded layout for every transactional email (waitlist,
// order updates, …). Inline styles only — email clients strip <style> blocks.
// Palette mirrors the app (globals.css): cream bg, terracotta primary, warm browns.

import { getSiteUrl } from "./send";

export const EMAIL_COLORS = {
  bg: "#F9F5F0",
  card: "#ffffff",
  primary: "#D2691E",
  heading: "#2C1810",
  body: "#5D4037",
  border: "#E6C9A8",
  muted: "#A1887F",
};
const COLORS = EMAIL_COLORS;

export interface EmailLayoutParams {
  /** Big title at the top of the card */
  heading: string;
  /** Optional greeting line (e.g. "Hola Marc,") */
  greeting?: string;
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
  const { heading, greeting, paragraphs, cta, detailsHtml, infoHtml, signoff, lang } = params;

  const greetingHtml = greeting
    ? `<p style="margin:0 0 20px;font-size:16px;color:${COLORS.body};">${greeting}</p>`
    : "";

  const paragraphsHtml = paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 20px;font-size:16px;line-height:1.7;color:${COLORS.body};">${p}</p>`,
    )
    .join("");

  const ctaHtml = cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 28px;">
         <tr><td style="border-radius:10px;background-color:${COLORS.primary};">
           <a href="${escapeHtml(cta.url)}" style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">${cta.label}</a>
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
          <h1 style="margin:0 0 8px;font-size:26px;color:${COLORS.heading};font-weight:700;">${heading}</h1>
          ${greetingHtml}
          ${paragraphsHtml}
          ${ctaHtml}
          ${detailsHtml ?? ""}
          ${infoBlock}
          <div style="border-top:1px solid ${COLORS.border};padding-top:24px;">
            <p style="margin:0;font-size:14px;color:${COLORS.muted};white-space:pre-line;">${signoff}</p>
          </div>
        </td></tr>
        <tr><td style="padding-top:24px;text-align:center;">
          <p style="margin:0;font-size:12px;color:${COLORS.muted};">&copy; 2026 Meapica. meapica.com</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
