// Runnable check for what the library shows per order (no deps, no test runner):
//   node --experimental-strip-types src/lib/order-view.check.mjs
import assert from "node:assert/strict";
import { orderReference, orderView } from "./order-view.ts";

const o = (over) => ({ format: "hardcover", status: "paid", refunded_at: null, gelato_status: null, pdf_ready: false, ...over });

assert.equal(orderReference("34d619c2-aaaa-bbbb-cccc-dddddddddddd"), "34D619C2");

// Printed book: stepper follows the status
{
  const v = orderView(o({}));
  assert.equal(v.kind, "print");
  assert.equal(v.phase, "print_paid");
  assert.equal(v.stepIndex, 0);
  assert.equal(v.canDownload, false);
  assert.equal(v.canReorder, false); // book not finished yet
}
assert.deepEqual(
  [orderView(o({ status: "producing", pdf_ready: true })), orderView(o({ status: "shipped", pdf_ready: true })), orderView(o({ status: "delivered", pdf_ready: true }))].map((v) => [v.phase, v.stepIndex, v.canDownload, v.canReorder]),
  [
    ["print_producing", 1, true, true],
    ["print_shipped", 2, true, true],
    ["print_delivered", 3, true, true],
  ],
);
// Gelato failed / returned: problem message, stepper kept where it was
assert.equal(orderView(o({ status: "producing", gelato_status: "failed" })).phase, "print_problem");
assert.equal(orderView(o({ status: "shipped", gelato_status: "returned" })).phase, "print_problem");
assert.equal(orderView(o({ status: "delivered", gelato_status: "returned" })).phase, "print_delivered");

// Digital (PDF only): never a print stepper; "ready to download" once the PDF exists
{
  const preparing = orderView(o({ format: "digital_pdf", status: "paid" }));
  assert.deepEqual([preparing.kind, preparing.phase, preparing.stepIndex, preparing.canDownload], ["digital", "digital_preparing", null, false]);
  // The pipeline moves digital orders to 'producing' after the ready email: still "ready", not "printing"
  const ready = orderView(o({ format: "digital_pdf", status: "producing", pdf_ready: true }));
  assert.deepEqual([ready.phase, ready.stepIndex, ready.canDownload, ready.canReorder], ["digital_ready", null, true, true]);
}

// Refunds
{
  const closed = orderView(o({ status: "refunded", refunded_at: "2026-09-30T10:00:00Z", pdf_ready: true }));
  assert.deepEqual([closed.phase, closed.stepIndex, closed.refunded, closed.canDownload], ["refunded", null, true, false]);
  // Goodwill refund after delivery: history kept, flagged as refunded, PDF still downloadable
  const goodwill = orderView(o({ status: "delivered", refunded_at: "2026-09-30T10:00:00Z", pdf_ready: true }));
  assert.deepEqual([goodwill.phase, goodwill.stepIndex, goodwill.refunded, goodwill.canDownload], ["print_delivered", 3, true, true]);
  const cancelled = orderView(o({ status: "cancelled" }));
  assert.deepEqual([cancelled.phase, cancelled.canReorder, cancelled.canDownload], ["cancelled", false, false]);
}

console.log("order view ✓");
