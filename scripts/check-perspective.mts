// Self-check for src/lib/perspective.ts: the element's 4 corners must land on the quad.
//   npx tsx scripts/check-perspective.mts
import assert from "node:assert/strict";
import { quadMatrix3d, type Quad } from "../src/lib/perspective.ts";

const quad: Quad = [[38, 242], [441, 139], [669, 470], [163, 623]];
const w = 400, h = 300;
const m = quadMatrix3d(w, h, quad).slice(9, -1).split(",").map(Number);
// Column-major 4×4; a 2D point (x, y, 0, 1) maps to (m0x + m4y + m12, m1x + m5y + m13) / (m3x + m7y + m15).
const map = (x: number, y: number) => {
  const W = m[3] * x + m[7] * y + m[15];
  return [(m[0] * x + m[4] * y + m[12]) / W, (m[1] * x + m[5] * y + m[13]) / W];
};
[[0, 0], [w, 0], [w, h], [0, h]].forEach(([x, y], i) => {
  const [px, py] = map(x, y);
  assert.ok(Math.abs(px - quad[i][0]) < 1e-3 && Math.abs(py - quad[i][1]) < 1e-3, `corner ${i}: ${px},${py}`);
});
console.log("perspective ok");
