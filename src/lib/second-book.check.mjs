// Runnable check for the "Pack Reyes" second-book rules (no deps, no test runner):
//   node --experimental-strip-types src/lib/second-book.check.mjs
import assert from "node:assert/strict";
import { SECOND_BOOK_DISCOUNT_CENTS, isBlackFridayWeek, SECOND_BOOK_PRICE_CENTS, earnsSecondBookCode, secondBookExpiresAt, secondBookIssuing, secondBookLastDay } from "./second-book.ts";
import { readFileSync } from "node:fs";
import { earliestPrintedCutoff } from "./shipping.ts";

// pricing.ts has imports node can't resolve here: read the softcover amount from its source.
const softcover = Number(readFileSync(new URL("./pricing.ts", import.meta.url), "utf8").match(/softcover: \{ lookupKey: "meapica_softcover", amount: (\d+)/)[1]);
assert.equal(softcover - SECOND_BOOK_DISCOUNT_CENTS, SECOND_BOOK_PRICE_CENTS);

const cutoff = earliestPrintedCutoff("2026-11-27", "reyes");
assert.equal(cutoff, "2026-12-22");
assert.equal(earliestPrintedCutoff("2026-12-30", "reyes"), cutoff, "same season until 5 Jan");
assert.equal(secondBookIssuing("2026-10-25", cutoff), false, "before the start");
assert.equal(secondBookIssuing("2026-10-26", cutoff), true);
assert.equal(secondBookIssuing("2026-12-22", cutoff), true, "cut-off day included");
assert.equal(secondBookIssuing("2026-12-23", cutoff), false);
assert.equal(secondBookLastDay(cutoff), "2027-01-06");
assert.equal(secondBookLastDay("2027-01-02"), "2027-01-06", "a January cut-off stays in that year");
assert.equal(secondBookExpiresAt(cutoff).toISOString(), "2027-01-06T22:59:59.000Z");

const base = { format: "hardcover", amountTotalCents: 4990, usedSecondBookCode: false, today: "2026-11-27", reyesCutoff: cutoff };
assert.equal(earnsSecondBookCode(base), true);
assert.equal(earnsSecondBookCode({ ...base, format: "softcover" }), true);
assert.equal(earnsSecondBookCode({ ...base, format: "digital_pdf" }), false, "printed only");
assert.equal(earnsSecondBookCode({ ...base, amountTotalCents: 0 }), false, "0 € orders (vouchers, gift codes)");
assert.equal(earnsSecondBookCode({ ...base, usedSecondBookCode: true }), false, "no chaining");
assert.equal(earnsSecondBookCode({ ...base, today: "2026-12-23" }), false, "after the cut-off");

assert.equal(isBlackFridayWeek("2026-11-22"), false);
assert.equal(isBlackFridayWeek("2026-11-27"), true);
assert.equal(isBlackFridayWeek("2026-11-30"), true);
assert.ok(secondBookIssuing("2026-11-30", cutoff), "Black Friday sits inside the issuing window");

console.log("second-book: all checks passed");
