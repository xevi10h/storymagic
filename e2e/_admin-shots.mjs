// Local visual check of the operator panel (fixture harness, no DB) + access gates.
//   BASE=http://localhost:3104 OUT=/tmp/shots node e2e/_admin-shots.mjs
import { chromium } from "@playwright/test";

const BASE = process.env.BASE ?? "http://localhost:3104";
const OUT = process.env.OUT ?? ".";
const browser = await chromium.launch();
const errors = [];

async function shot(name, url, viewport = { width: 1440, height: 1000 }, after) {
  const page = await browser.newPage({ viewport });
  page.on("console", (m) => m.type() === "error" && errors.push(`${name}: ${m.text()}`));
  page.on("pageerror", (e) => errors.push(`${name}: ${e.message}`));
  await page.goto(`${BASE}${url}`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  if (after) await after(page);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  await page.close();
}

const detailId = "3f2a3e22-7d1e-4c2a-9b1f-000000000002"; // fixture row 2 (stuck paid)
await shot("admin-list", "/es/dev/admin");
await shot("admin-list-problems", "/es/dev/admin?status=problems");
await shot("admin-list-search", "/es/dev/admin?q=mateo");
await shot("admin-detail", `/es/dev/admin?order=${detailId}`);
await shot("admin-detail-dialog", `/es/dev/admin?order=${detailId}`, { width: 1440, height: 1000 }, async (page) => {
  await page.getByRole("button", { name: /Reenviar a Gelato/ }).click();
  await page.getByRole("dialog").waitFor();
});
await shot("admin-list-mobile", "/es/dev/admin", { width: 390, height: 844 });
await shot("admin-detail-mobile", `/es/dev/admin?order=${detailId}`, { width: 390, height: 844 });

// Gates: no session → 404 everywhere.
const ctx = await browser.newContext();
const r1 = await ctx.request.get(`${BASE}/admin`, { maxRedirects: 0 });
const r2 = await ctx.request.get(`${BASE}/admin/orders/${detailId}`, { maxRedirects: 0 });
const r3 = await ctx.request.post(`${BASE}/api/admin/orders/${detailId}/actions`, { data: { action: "retry_generation", confirm: true } });
const r4 = await ctx.request.delete(`${BASE}/api/account`, { data: { confirm: true } });
console.log(`gates: /admin ${r1.status()} (robots: ${r1.headers()["x-robots-tag"]}) · detail ${r2.status()} · action API ${r3.status()} · DELETE /api/account ${r4.status()}`);
console.log(errors.length ? `console errors:\n${errors.join("\n")}` : "no console errors");
await browser.close();
