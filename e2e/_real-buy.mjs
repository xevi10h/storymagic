// Real test-mode purchase through Stripe Checkout. Usage: FORMAT=digital_pdf|hardcover EXTRA=1 node e2e/_real-buy.mjs
import { chromium } from "@playwright/test";
const OUT = process.env.OUT, STORY = process.env.STORY, FORMAT = process.env.FORMAT ?? "digital_pdf";
const TAG = process.env.TAG ?? FORMAT;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "es-ES" });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const shot = (n) => page.screenshot({ path: `${OUT}/${TAG}-${n}.png` });

await page.goto("http://localhost:3013/es/auth/login");
await page.locator("#email").fill("meapica-e2e-1@resend.dev");
await page.locator("#password").fill("E2e-test-Meapica-2026!");
await page.locator('button[type="submit"]').click();
await page.waitForURL((u) => !u.pathname.includes("/auth/login"), { timeout: 30000 });

if (process.env.VIA_API) {
  await page.goto("http://localhost:3013/es/dashboard");
  const res = await page.evaluate(async (b) => (await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) })).json(),
    { storyId: STORY, format: FORMAT, addons: process.env.EXTRA ? ["extra_copy"] : [], locale: "es", withdrawalConsent: true });
  console.log("api", JSON.stringify(res).slice(0, 80));
  await page.goto(res.url);
} else {
await page.goto(`http://localhost:3013/es/create/${STORY}/preview`);
await page.locator("#checkout-section").waitFor({ timeout: 30000 });
await page.locator("#checkout-section").scrollIntoViewIfNeeded();
const labels = { digital_pdf: /PDF Digital/, softcover: /blanda/i, hardcover: /dura/i };
await page.locator("#checkout-section button").filter({ hasText: labels[FORMAT] }).first().click();
if (process.env.EXTRA) await page.locator("#checkout-section button").filter({ hasText: /Ejemplar extra/ }).click();
await page.locator("#withdrawal-consent").scrollIntoViewIfNeeded();
await shot("1-paywall");
// Without consent: blocked + message
const cta = page.locator("#checkout-section button").filter({ hasText: /IVA incl\./ }).first();
await cta.click();
await page.getByText("Marca la casilla para continuar").waitFor({ timeout: 5000 });
await shot("2-consent-missing");
await page.locator("#withdrawal-consent input").check();
const [req] = await Promise.all([page.waitForRequest((r) => r.url().endsWith("/api/checkout")), cta.click()]);
console.log("checkout body", req.postData());
}
await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30000 });
await page.waitForLoadState("networkidle");
await shot("3-stripe");

await page.locator("#email").fill("delivered@resend.dev").catch(() => {});
if (FORMAT !== "digital_pdf") {
  await page.locator("#shippingName").fill("Marta Prueba García");
  await page.locator("#shippingAddressLine1").fill("Carrer de Mallorca 200");
  await page.locator("#shippingLocality").fill("Barcelona");
  await page.locator("#shippingPostalCode").fill("08036");
  const prov = page.locator("#shippingAdministrativeArea");
  if (await prov.count()) await prov.selectOption({ label: "Barcelona" }).catch(() => {});
}
const cardBtn = page.locator('[data-testid="card-accordion-item-button"]');
if (await cardBtn.count()) await cardBtn.click().catch(() => {});
await page.locator("#cardNumber").fill("4242424242424242");
await page.locator("#cardExpiry").fill("12/34");
await page.locator("#cardCvc").fill("123");
await page.locator("#billingName").fill("Marta Prueba García").catch(() => {});
const bpc = page.locator("#billingPostalCode");
if (await bpc.isVisible().catch(() => false)) await bpc.fill("08036");
await shot("4-stripe-filled");
await page.locator(".SubmitButton, button[type=submit]").first().click();
await page.waitForURL(/localhost:3013\/es\/checkout\/success/, { timeout: 90000 });
console.log("success url", page.url());
await page.waitForTimeout(8000);
await shot("5-success");
console.log("errors", JSON.stringify(errors.slice(0, 10)));
await browser.close();
