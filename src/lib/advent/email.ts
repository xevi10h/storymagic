// Advent calendar daily email (es / ca), approved design Email.dc.html: the door's art, the
// title with the child's portrait (portrait subscribers only), two lines and "Abrir la
// puerta", then a labelled offer block for the full book, and the sign-off.
//
// Legal: explicit consent to this daily email (RGPD 6.1.a, LSSI 21.1). It carries an offer
// (the book block), so it is labelled ("Oferta"), names the seller, says why we write, has
// an unsubscribe link and the sender adds List-Unsubscribe one-click (RFC 8058). Prices are
// final VAT-inclusive consumer prices. Voice: warm, direct, short, no em-dashes in prose.
//
// Email-safe HTML: tables, inline styles, no overlap/absolute positioning (the portrait sits
// beside the title instead of over the art), JPEG art (Outlook ignores webp).

import { EMAIL_COLORS, escapeHtml } from "@/lib/email/layout";
import type { BuiltEmail } from "@/lib/email/order-emails";
import { ADVENT_COPY } from "./copy";
import { ADVENT_DOORS_COUNT } from "./calendar";
import type { AdventLocale, RenderedStory } from "./render";

export interface AdventOffer {
  /** Printed Reyes cut-off still open ("22 de diciembre"), else null. */
  deadline: string | null;
  /** Pack Reyes second-book price ("19,90 €") while codes are issued, else null. */
  packPrice: string | null;
  /** PDF price once no printed book arrives for Reyes, else null. */
  latePdfPrice: string | null;
  /** "34,90 €" (cheapest printed format). */
  fromPrice: string;
  pages: number;
}

export interface AdventEmailContext {
  locale: AdventLocale;
  story: RenderedStory;
  childName: string;
  deName: string;
  siteUrl: string;
  /** The door on the site (UTM-tagged). */
  openUrl: string;
  /** /create prefilled with the child (UTM-tagged). */
  createUrl: string;
  unsubscribeUrl: string;
  /** Absolute JPEG URL of the door art. */
  artUrl: string;
  /** cid of the inline portrait attachment, or null (name-only). */
  portraitCid: string | null;
  /** Day 24: the compilation PDF is attached too. */
  withCompilation: boolean;
  offer: AdventOffer;
  seller: string;
  mailbox: string;
}

const C = EMAIL_COLORS;
const FONT = "'Helvetica Neue',Helvetica,Arial,sans-serif";

function offerLines(ctx: AdventEmailContext): string[] {
  const e = ADVENT_COPY[ctx.locale].email;
  const lines = [e.bookText({ pages: ctx.offer.pages })];
  if (ctx.offer.deadline) lines.push(e.bookDeadline(ctx.offer.deadline));
  if (ctx.offer.packPrice) lines.push(e.bookPack(ctx.offer.packPrice));
  if (ctx.offer.latePdfPrice) lines.push(e.bookLate(ctx.offer.latePdfPrice));
  lines.push(e.bookFrom(ctx.offer.fromPrice));
  return lines;
}

export function buildAdventEmail(ctx: AdventEmailContext): BuiltEmail {
  const e = ADVENT_COPY[ctx.locale].email;
  const { story } = ctx;
  const kicker = e.kicker({ door: story.door, total: ADVENT_DOORS_COUNT });
  const paragraphs = [e.intro({ door: story.door, teaser: story.teaser }), e.pdfLine, ...(ctx.withCompilation ? [e.compilationLine] : [])];
  const offer = offerLines(ctx);
  const bookCta = e.bookCta(ctx.deName);
  const footerHtml = e.footer({
    seller: escapeHtml(ctx.seller),
    unsubscribe: `<a href="${escapeHtml(ctx.unsubscribeUrl)}" style="color:${C.muted};text-decoration:underline;">${escapeHtml(e.unsubscribe)}</a>`,
    mailbox: `<a href="mailto:${escapeHtml(ctx.mailbox)}" style="color:${C.muted};text-decoration:underline;">${escapeHtml(ctx.mailbox)}</a>`,
  });

  const portraitCell = ctx.portraitCid
    ? `<td width="96" valign="top" style="width:96px;padding-left:12px;"><img src="cid:${escapeHtml(ctx.portraitCid)}" alt="" width="88" height="88" style="display:block;width:88px;height:88px;border-radius:44px;border:3px solid #ffffff;" /></td>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="${ctx.locale}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(story.title)}</title></head>
<body style="margin:0;padding:0;background-color:${C.border};font-family:${FONT};">
  <div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(story.teaser)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${C.border};padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:${C.bg};border-radius:16px;overflow:hidden;">
        <tr><td align="center" style="padding:24px 32px;">
          <img src="${ctx.siteUrl}/images/meapica-logo.png" alt="Meapica" height="30" style="height:30px;width:auto;" />
        </td></tr>
        <tr><td>
          <a href="${escapeHtml(ctx.openUrl)}" style="text-decoration:none;"><img src="${escapeHtml(ctx.artUrl)}" alt="" width="600" style="display:block;width:100%;max-width:600px;height:auto;" /></a>
        </td></tr>
        <tr><td style="padding:28px 32px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td valign="top">
              <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${C.primaryText};">${escapeHtml(kicker)}</p>
              <h1 style="margin:8px 0 0;font-size:26px;line-height:1.2;font-weight:700;color:${C.heading};">${escapeHtml(story.title)}</h1>
            </td>
            ${portraitCell}
          </tr></table>
          <p style="margin:18px 0 0;font-size:16px;line-height:1.7;color:${C.body};">${escapeHtml(e.hello)}</p>
          ${paragraphs.map((p) => `<p style="margin:10px 0 0;font-size:16px;line-height:1.7;color:${C.body};">${escapeHtml(p)}</p>`).join("")}
          <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:24px auto 0;">
            <tr><td style="border-radius:12px;background-color:${C.primary};">
              <a href="${escapeHtml(ctx.openUrl)}" style="display:inline-block;padding:14px 28px;font-size:19px;font-weight:700;line-height:1.2;color:#ffffff;text-decoration:none;border-radius:12px;">${escapeHtml(e.open)}</a>
            </td></tr>
          </table>
          <div style="margin-top:28px;padding:18px 20px;border:1px solid #E6C9A8;border-radius:12px;background-color:${C.card};">
            <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${C.muted};">${escapeHtml(e.offerLabel)}</p>
            <p style="margin:0;font-size:16px;font-weight:700;color:${C.heading};">${escapeHtml(e.bookHeading(ctx.childName))}</p>
            <p style="margin:6px 0 0;font-size:14px;line-height:1.6;color:${C.body};">${escapeHtml(offer.join(" "))}</p>
            <p style="margin:10px 0 0;font-size:14px;"><a href="${escapeHtml(ctx.createUrl)}" style="font-weight:700;color:${C.primaryText};">${escapeHtml(bookCta)}</a></p>
          </div>
          <p style="margin:24px 0 0;font-size:16px;line-height:1.7;color:${C.body};white-space:pre-line;">${escapeHtml(e.signoff)}</p>
        </td></tr>
      </table>
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="padding:16px 8px 0;text-align:center;">
          <p style="margin:0;font-size:12px;line-height:1.6;color:${C.muted};">${footerHtml}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const footerText = e.footer({ seller: ctx.seller, unsubscribe: `${e.unsubscribe} (${ctx.unsubscribeUrl})`, mailbox: ctx.mailbox });
  const text = [
    kicker,
    story.title,
    e.hello,
    ...paragraphs,
    `${e.open}: ${ctx.openUrl}`,
    "---",
    `${e.offerLabel}: ${e.bookHeading(ctx.childName)}`,
    offer.join(" "),
    `${bookCta}: ${ctx.createUrl}`,
    "---",
    e.signoff,
    footerText,
  ].join("\n\n");

  return { subject: e.subject({ door: story.door, title: story.title }), html, text, commercial: true };
}
