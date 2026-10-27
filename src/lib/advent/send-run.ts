// Advent daily email run (server-only). Driven by /api/cron/advent (several runs each
// morning, vercel.json). On 1–24 December (Spain date) every active subscription that has
// not had today's door gets ONE email with that door's PDF (on the 24th, also the 24-story
// compilation). Never a backfill: a sign-up on the 10th starts with door 10.
//
// Double opt-in: only confirmed subscriptions (confirmed_at set) are ever emailed here.
// Exactly once per subscriber and day: the send is claimed by moving last_sent_day forward
// with a conditional update (last_sent_day < door); a failed send moves it back so the next
// run retries. Suppressed addresses (email_suppressions) are skipped. Resend's team limit
// is 10 requests/s and emails with attachments cannot be batched, so sends are sequential
// and spaced (MIN_SEND_GAP_MS), leaving room for the other crons.
//
// Portrait PDFs only when the subscription is linked to an account (user_id + character_id)
// whose confirmed, non-anonymous email is still this address, re-checked here; otherwise the
// subscriber gets the name-only PDF. Logs ids and counts only, never names or addresses.

import type { FulfilmentClient } from "@/lib/fulfilment/db";
import { getSiteUrl, sendEmail, type EmailAttachment } from "@/lib/email/send";
import { listUnsubscribeHeaders, normalizeEmail } from "@/lib/marketing/unsubscribe-token";
import { suppressedAmong } from "@/lib/marketing/suppression";
import { isMissingSchemaError } from "@/lib/reviews/schema";
import { SELLER_IDENTITY } from "@/lib/pricing";
import { SUPPORT_EMAIL } from "@/lib/support";
import { spainToday } from "@/lib/shipping";
import { ADVENT_DOORS_COUNT, ADVENT_UNSUBSCRIBE_PATH, ADVENT_PATH, ADVENT_YEAR, emailDoorFor } from "./calendar";
import { ADVENT_DOORS } from "./stories";
import { ADVENT_COPY } from "./copy";
import { adventDeName, adventNameIn, asAdventGender, personalizeStory } from "./personalize";
import { adventFileSlug, renderCompilationPdf, renderDoorPdf } from "./pdf";
import { buildAdventEmail } from "./email";
import { adventOffer } from "./offer";
import { portraitPng } from "./assets";
import { toAdventCharacter, verifiedAccountEmail } from "./account";
import type { AdventGender, AdventLocale } from "./render";

const SCAN_LIMIT = 2000;
const MIN_SEND_GAP_MS = 150;
const PORTRAIT_CID = "advent-portrait";

export interface AdventRunSummary {
  dryRun: boolean;
  migrationPending: boolean;
  today: string;
  /** Door sent today, null outside 1–24 December. */
  door: number | null;
  scanned: number;
  sent: number;
  withPortrait: number;
  wouldSend: number;
  failed: number;
  deferred: number;
  suppressed: number;
  claimedElsewhere: number;
}

type SubRow = {
  id: string;
  email: string;
  user_id: string | null;
  character_id: string | null;
  child_name: string;
  gender: string;
  locale: string;
  unsubscribe_token: string;
  last_sent_day: number;
};

export async function runAdventEmails(
  db: FulfilmentClient,
  opts: { now: number; dryRun: boolean; limit: number; budgetMs: number; today?: string },
): Promise<AdventRunSummary> {
  const startedAt = Date.now();
  const today = opts.today ?? spainToday(new Date(opts.now));
  const door = emailDoorFor(today);
  const summary: AdventRunSummary = {
    dryRun: opts.dryRun,
    migrationPending: false,
    today,
    door,
    scanned: 0,
    sent: 0,
    withPortrait: 0,
    wouldSend: 0,
    failed: 0,
    deferred: 0,
    suppressed: 0,
    claimedElsewhere: 0,
  };
  if (door === null) return summary;

  const { data, error } = await db
    .from("advent_subscriptions")
    .select("id, email, user_id, character_id, child_name, gender, locale, unsubscribe_token, last_sent_day")
    .eq("season", ADVENT_YEAR)
    .is("unsubscribed_at", null)
    .not("confirmed_at", "is", null) // double opt-in: pending rows never get a door
    .lt("last_sent_day", door)
    .order("created_at")
    .limit(SCAN_LIMIT);
  if (error && isMissingSchemaError(error)) {
    summary.migrationPending = true;
    return summary;
  }
  if (error) throw new Error(`advent candidates: ${error.message}`);
  const rows = (data ?? []) as SubRow[];
  summary.scanned = rows.length;
  if (rows.length === 0) return summary;

  const suppressed = await suppressedAmong(
    db,
    rows.map((r) => r.email),
  );
  const pdfCache = new Map<string, string>();
  let lastSendAt = 0;

  for (const row of rows) {
    if (suppressed.has(normalizeEmail(row.email) ?? "")) {
      summary.suppressed++;
      continue;
    }
    if (summary.sent + summary.wouldSend + summary.failed >= opts.limit || Date.now() - startedAt > opts.budgetMs) {
      summary.deferred++;
      continue;
    }
    if (opts.dryRun) {
      summary.wouldSend++;
      continue;
    }

    const { data: claimed, error: claimErr } = await db
      .from("advent_subscriptions")
      .update({ last_sent_day: door, last_sent_at: new Date().toISOString() })
      .eq("id", row.id)
      .lt("last_sent_day", door)
      .is("unsubscribed_at", null)
      .not("confirmed_at", "is", null)
      .select("id");
    if (claimErr) {
      console.error(`[advent] Could not claim subscription ${row.id}: ${claimErr.message}`);
      summary.failed++;
      continue;
    }
    if (!claimed || claimed.length === 0) {
      summary.claimedElsewhere++;
      continue;
    }

    const wait = MIN_SEND_GAP_MS - (Date.now() - lastSendAt);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastSendAt = Date.now();

    let result: { ok: boolean; portrait: boolean } = { ok: false, portrait: false };
    try {
      result = await sendDoorEmail(db, row, door, today, pdfCache);
    } catch (err) {
      console.error(`[advent] Subscription ${row.id} failed: ${err instanceof Error ? err.message : "unknown"}`);
    }
    if (result.ok) {
      summary.sent++;
      if (result.portrait) summary.withPortrait++;
    } else {
      summary.failed++;
      await db.from("advent_subscriptions").update({ last_sent_day: row.last_sent_day }).eq("id", row.id).eq("last_sent_day", door);
    }
  }
  return summary;
}

/** The account's character when portrait PDFs may still go to this address, else null. */
async function portraitFor(db: FulfilmentClient, row: SubRow) {
  if (!row.user_id || !row.character_id) return null;
  const { data: userData, error } = await db.auth.admin.getUserById(row.user_id);
  if (error || verifiedAccountEmail(userData.user) !== normalizeEmail(row.email)) return null;
  const { data: character } = await db
    .from("characters")
    .select("id, name, gender, age, skin_tone, hair_color, hairstyle, eye_color, glasses, freckles")
    .eq("id", row.character_id)
    .eq("user_id", row.user_id)
    .maybeSingle();
  return character ? toAdventCharacter(character) : null;
}

async function sendDoorEmail(
  db: FulfilmentClient,
  row: SubRow,
  door: number,
  today: string,
  pdfCache: Map<string, string>,
): Promise<{ ok: boolean; portrait: boolean }> {
  const locale: AdventLocale = row.locale === "ca" ? "ca" : "es";
  const character = await portraitFor(db, row);
  const name = character?.name ?? row.child_name;
  const gender: AdventGender = character?.gender ?? asAdventGender(row.gender);
  const portraitUri = character?.traits ? await portraitPng(character.traits).catch(() => null) : null;

  const deName = adventDeName(locale, name, gender);
  const child = { name, deName, portraitUri };
  const story = personalizeStory(door, ADVENT_DOORS[door - 1].stories[locale], locale, name, gender);
  const files = ADVENT_COPY[locale].file;
  const slug = adventFileSlug(name);

  // Name-only PDFs are the same for every child with this name: render once per run.
  const cached = async (key: string, render: () => Promise<Buffer>) => {
    if (portraitUri) return (await render()).toString("base64");
    const hit = pdfCache.get(key);
    if (hit) return hit;
    const b64 = (await render()).toString("base64");
    pdfCache.set(key, b64);
    return b64;
  };
  const attachments: EmailAttachment[] = [
    { filename: files.door(slug, door), content: await cached(`${locale}|${door}|${name}|${gender}`, () => renderDoorPdf(locale, story, child)) },
  ];
  const withCompilation = door === ADVENT_DOORS_COUNT;
  if (withCompilation) {
    const stories = ADVENT_DOORS.map((d, i) => personalizeStory(i + 1, d.stories[locale], locale, name, gender));
    attachments.push({
      filename: files.compilation(slug),
      content: await cached(`${locale}|all|${name}|${gender}`, () => renderCompilationPdf(locale, stories, child)),
    });
  }
  if (portraitUri) {
    attachments.push({ filename: "retrato.png", content: portraitUri.replace(/^data:image\/png;base64,/, ""), contentId: PORTRAIT_CID });
  }

  const site = getSiteUrl();
  const utm = "utm_source=email&utm_medium=email&utm_campaign=advent";
  const createParams = new URLSearchParams({ name });
  if (character) createParams.set("characterId", character.id);
  const built = buildAdventEmail({
    locale,
    story,
    childName: adventNameIn(locale, name, gender),
    deName,
    siteUrl: site,
    openUrl: `${site}/${locale}${ADVENT_PATH}?door=${door}&${utm}`,
    createUrl: `${site}/${locale}/create?${createParams.toString()}&${utm}`,
    unsubscribeUrl: `${site}/${locale}${ADVENT_UNSUBSCRIBE_PATH}?t=${encodeURIComponent(row.unsubscribe_token)}`,
    artUrl: `${site}/api/advent/art/${door}`,
    portraitCid: portraitUri ? PORTRAIT_CID : null,
    withCompilation,
    offer: adventOffer(today, locale),
    seller: SELLER_IDENTITY,
    mailbox: SUPPORT_EMAIL,
  });
  const ok = await sendEmail({
    to: row.email.trim(),
    subject: built.subject,
    html: built.html,
    text: built.text,
    headers: listUnsubscribeHeaders(`${site}/api/advent/unsubscribe?t=${encodeURIComponent(row.unsubscribe_token)}`, SUPPORT_EMAIL),
    attachments,
  });
  return { ok, portrait: !!portraitUri };
}
