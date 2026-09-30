// Prod smoke: live Checkout session is created (no payment), page renders, then expired by the caller.
import { chromium } from "@playwright/test";
const OUT = process.env.OUT;
const browser = await chromium.launch();
const page = await (await browser.newContext({ locale: "es-ES" })).newPage();
await page.goto("https://meapica.shop/es/auth/login");
await page.locator("#email").fill("meapica-e2e-1@resend.dev");
await page.locator("#password").fill("E2e-test-Meapica-2026!");
await page.locator('button[type="submit"]').click();
await page.waitForURL((u) => !u.pathname.includes("/auth/login"), { timeout: 30000 });
const call = (b) => page.evaluate(async (b) => { const r = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }); return { s: r.status, j: await r.json() }; }, b);
const base = { storyId: "f5e6bb9a-4f46-4995-82dc-4bd7d7a2605d", format: "hardcover", addons: ["extra_copy"], locale: "ca" };
console.log("no consent:", JSON.stringify(await call(base)));
const r = await call({ ...base, withdrawalConsent: true });
console.log("live:", r.s, r.j.url?.match(/cs_live_[A-Za-z0-9]+/)?.[0] ?? JSON.stringify(r.j));
if (r.j.url) {
  await page.goto(r.j.url);
  await page.waitForTimeout(6000);
  await page.screenshot({ path: `${OUT}/prod-live-checkout.png` });
}
await browser.close();
