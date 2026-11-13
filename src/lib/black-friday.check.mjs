// Runnable check for the Black Friday 2026 rules (no deps, no test runner):
//   node --experimental-strip-types src/lib/black-friday.check.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  BLACK_FRIDAY,
  BLACK_FRIDAY_ENDS_AT,
  BLACK_FRIDAY_FEED_EFFECTIVE_DATE,
  BLACK_FRIDAY_STARTS_AT,
  BLACK_FRIDAY_VALID_FROM,
  BLACK_FRIDAY_VALID_UNTIL,
  blackFridayDiscountCents,
  blackFridayPriceCents,
  bookPriceToday,
  isBlackFriday,
  isBlackFridayAt,
  lowestPrice30Days,
  orderPromoCandidates,
} from "./black-friday.ts";
import { spainToday } from "./shipping.ts";
import { SECOND_BOOK_DISCOUNT_CENTS, earnsSecondBookCode } from "./second-book.ts";
import { REFERRAL_DISCOUNT_CENTS } from "./promo-codes.ts";
import { CREATOR_AUDIENCE_PERCENT_OFF } from "./creators.ts";

// pricing.ts has imports node can't resolve here: read the book amounts from its source.
const pricing = readFileSync(new URL("./pricing.ts", import.meta.url), "utf8");
const amount = (item) => Number(pricing.match(new RegExp(`  ${item}: \\{ lookupKey: "meapica_${item}", amount: (\\d+)`))[1]);
const LIST = { digital_pdf: amount("digital_pdf"), softcover: amount("softcover"), hardcover: amount("hardcover") };
assert.deepEqual(LIST, { digital_pdf: 990, softcover: 3490, hardcover: 4990 }, "list prices (owner decision quotes these)");

// ── Prices (owner 2026-11-13: exact in cents) ───────────────────────────────
assert.equal(blackFridayPriceCents(LIST.digital_pdf), 792);
assert.equal(blackFridayPriceCents(LIST.softcover), 2792);
assert.equal(blackFridayPriceCents(LIST.hardcover), 3992);
for (const cents of Object.values(LIST)) {
  // Stripe rounds percent_off per line; 20 % of these amounts is exact, so app and Stripe agree.
  assert.equal((cents * 20) % 100, 0, `20 % of ${cents} is a whole number of cents`);
  assert.equal(blackFridayDiscountCents(cents) + blackFridayPriceCents(cents), cents);
  assert.equal(lowestPrice30Days(cents), cents, "Omnibus reference = list price (unchanged > 30 days)");
}
// Softcover + extra copy (19,90 €, not discounted): 27,92 + 19,90 = 47,82 €.
assert.equal(blackFridayPriceCents(LIST.softcover) + 1990, 4782);

// ── Window: Spain dates (UI) ────────────────────────────────────────────────
assert.equal(isBlackFriday("2026-11-12"), false, "day before deploy");
assert.equal(isBlackFriday("2026-11-13"), true, "deploy day");
assert.equal(isBlackFriday("2026-11-27"), true);
assert.equal(isBlackFriday("2026-11-30"), true, "last day");
assert.equal(isBlackFriday("2026-12-01"), false, "reverts on 1 December");
assert.equal(isBlackFriday(null), false, "before hydration = list price");
assert.equal(bookPriceToday(LIST.softcover, "2026-11-30"), 2792);
assert.equal(bookPriceToday(LIST.softcover, "2026-12-01"), 3490);
assert.equal(bookPriceToday(LIST.softcover, undefined), 3490);

// ── Window: instants (checkout) in Europe/Madrid ────────────────────────────
const at = (iso) => isBlackFridayAt(Date.parse(iso));
assert.equal(at("2026-11-12T22:59:59Z"), false, "12 Nov 23:59:59 Madrid");
assert.equal(at("2026-11-12T23:00:00Z"), true, "13 Nov 00:00 Madrid");
assert.equal(at("2026-11-30T22:59:59Z"), true, "30 Nov 23:59:59 Madrid");
assert.equal(at("2026-11-30T23:00:00Z"), false, "1 Dec 00:00 Madrid (still 30 Nov in UTC)");
assert.equal(at("2026-11-30T23:30:00Z"), false, "1 Dec 00:30 Madrid");
// The instants and the dates describe the same window.
assert.equal(spainToday(BLACK_FRIDAY_STARTS_AT), BLACK_FRIDAY.from);
assert.equal(spainToday(new Date(BLACK_FRIDAY_STARTS_AT.getTime() - 1000)), "2026-11-12");
assert.equal(spainToday(BLACK_FRIDAY_ENDS_AT), BLACK_FRIDAY.to);
assert.equal(spainToday(new Date(BLACK_FRIDAY_ENDS_AT.getTime() + 1000)), "2026-12-01");

// ── Machine-readable formats ────────────────────────────────────────────────
// Google Merchant: YYYY-MM-DDThh:mm±hhmm/…, no seconds, offset without a colon, ≤ 51 chars.
assert.equal(BLACK_FRIDAY_FEED_EFFECTIVE_DATE, "2026-11-13T00:00+0100/2026-11-30T23:59+0100");
assert.ok(BLACK_FRIDAY_FEED_EFFECTIVE_DATE.length <= 51);
assert.equal(Date.parse(BLACK_FRIDAY_VALID_FROM), BLACK_FRIDAY_STARTS_AT.getTime());
assert.equal(Date.parse(BLACK_FRIDAY_VALID_UNTIL), BLACK_FRIDAY_ENDS_AT.getTime());

// ── Which code is pre-applied (biggest saving first, the rest are fallbacks) ─
const creator = (cents) => Math.round((cents * CREATOR_AUDIENCE_PERCENT_OFF) / 100);
const candidates = (format, { secondBook = false, referral = false, creatorLink = false, blackFriday = true } = {}) =>
  orderPromoCandidates([
    secondBook && format === "softcover" && { kind: "second_book", promotionCodeId: "promo_sb", savingCents: SECOND_BOOK_DISCOUNT_CENTS },
    // Referral codes only cover printed books (canPreApplyReferral); creator codes cover every format.
    referral && format !== "digital_pdf" && { kind: "referral", promotionCodeId: "promo_ref", savingCents: REFERRAL_DISCOUNT_CENTS },
    creatorLink && { kind: "creator", promotionCodeId: "promo_cr", savingCents: creator(LIST[format]) },
    blackFriday && { kind: "black_friday", promotionCodeId: "promo_bf", savingCents: blackFridayDiscountCents(LIST[format]) },
  ]).map((c) => c.kind);

// Creator link: Black Friday wins on every format (owner: non-cumulative, 20 % wins), creator code is the fallback.
for (const f of ["digital_pdf", "softcover", "hardcover"]) assert.deepEqual(candidates(f, { creatorLink: true }), ["black_friday", "creator"], f);
// Pack Reyes on softcover beats Black Friday (15 € > 6,98 €); never both (one code per session).
assert.deepEqual(candidates("softcover", { secondBook: true }), ["second_book", "black_friday"]);
assert.deepEqual(candidates("hardcover", { secondBook: true }), ["black_friday"], "the pack code covers softcover only");
// A friend's 10 € referral beats 20 % on printed books (6,98 € / 9,98 €), not on the PDF (doesn't cover it).
assert.deepEqual(candidates("softcover", { referral: true }), ["referral", "black_friday"]);
assert.deepEqual(candidates("hardcover", { referral: true }), ["referral", "black_friday"]);
assert.deepEqual(candidates("digital_pdf", { referral: true }), ["black_friday"]);
assert.deepEqual(candidates("softcover", { secondBook: true, referral: true, creatorLink: true }), ["second_book", "referral", "black_friday", "creator"]);
// Outside the window / ownCode ("¿Tienes otro código?") / reorders: no Black Friday candidate.
assert.deepEqual(candidates("softcover", { creatorLink: true, blackFriday: false }), ["creator"]);
assert.deepEqual(candidates("hardcover", { blackFriday: false }), [], "nothing pre-applied: Stripe shows its code field");
assert.deepEqual(orderPromoCandidates([null, undefined, false, { kind: "black_friday", promotionCodeId: "", savingCents: 1 }]), [], "empty ids ignored");
assert.deepEqual(
  orderPromoCandidates([{ kind: "referral", promotionCodeId: "a", savingCents: 500 }, { kind: "creator", promotionCodeId: "b", savingCents: 500 }]).map((c) => c.kind),
  ["referral", "creator"],
  "ties keep the input order",
);

// A Black Friday order still earns the Pack Reyes code (it is paid and printed).
assert.equal(
  earnsSecondBookCode({ format: "softcover", amountTotalCents: 2792, usedSecondBookCode: false, today: "2026-11-27", reyesCutoff: "2026-12-22" }),
  true,
);

console.log("black-friday: all checks passed");
