// Full real flow, local only: logged-in creation → preview → hardcover test-mode purchase with
// phone + Baleares address. Stripe test mode ⇒ Gelato order is a DRAFT (never printed).
// Spends ~$2.3 of OpenAI (preview + final images). Run the dev server with MOCK_MODE=false and
// STRIPE_ENVIRONMENT=test, plus `stripe listen --forward-to localhost:3013/api/webhooks/stripe`.
// Usage: OUT=/tmp/x [POSTCODE=07001] node e2e/_real-full.mjs
import { chromium } from "@playwright/test";
const OUT = process.env.OUT, BASE = "http://localhost:3013";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "es-ES" });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png` });

await page.goto(`${BASE}/es/auth/login`);
await page.locator("#email").fill("meapica-e2e-1@resend.dev");
await page.locator("#password").fill("E2e-test-Meapica-2026!");
await page.locator('button[type="submit"]').click();
await page.waitForURL((u) => !u.pathname.includes("/auth/login"), { timeout: 30000 });

let storyId = process.env.STORY;
if (!storyId) {
await page.goto(`${BASE}/es/crear`);
await page.evaluate(() => localStorage.clear());
await page.goto(`${BASE}/es/crear`);
await page.locator("#child-name").fill("Martina");
await page.getByRole("radio", { name: /^5/ }).click();
await page.getByRole("radio", { name: "Una niña" }).click();
await page.getByRole("button", { name: /Siguiente/ }).click();
await page.getByTestId("protagonist-portrait").waitFor();
await page.getByRole("button", { name: /Siguiente/ }).click();
await page.getByRole("radio", { name: /Espacial/i }).first().click();
for (let ch = 1; ch <= 3; ch++) {
  const o = page.locator(`section[aria-labelledby="adv-ch-${ch}"] [role=radio]`).first();
  await o.waitFor({ state: "visible", timeout: 15000 });
  await o.click();
}
await page.getByRole("button", { name: /Crear su libro/ }).click();
await page.waitForURL(/\/crear\/[0-9a-f-]{36}\/generar/, { timeout: 60000 });
storyId = page.url().match(/crear\/([0-9a-f-]{36})/)[1];
console.log("storyId", storyId);
// v2: the generation screen waits for a click to open the finished book.
await page.getByRole("button", { name: /Ver el libro/i }).first().click({ timeout: 300000 });
await page.waitForURL(/\/preview/, { timeout: 60000 });
} else await page.goto(`${BASE}/es/crear/${storyId}/preview`);
await page.waitForTimeout(3000);
await shot("1-preview");

await page.locator("#checkout-section").waitFor({ timeout: 30000 });
await page.locator("#checkout-section button").filter({ hasText: /dura/i }).first().click();
await page.locator("#withdrawal-consent input").check();
await page.locator("#checkout-section button").filter({ hasText: /IVA incl\./ }).first().click();
await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30000 });
await page.waitForLoadState("networkidle");
await shot("2-stripe");

await page.locator("#email").fill("delivered@resend.dev").catch(() => {});
await page.locator("#shippingName").fill("Marta Prueba García");
await page.locator("#shippingAddressLine1").fill("Carrer de Sant Miquel 20");
await page.locator("#shippingLocality").fill("Palma");
await page.locator("#shippingPostalCode").fill(process.env.POSTCODE ?? "07001");
const prov = page.locator("#shippingAdministrativeArea");
if (await prov.count()) await prov.selectOption({ label: process.env.PROVINCE ?? "Islas Baleares" }).catch((e) => console.log("province", String(e).slice(0, 120)));
const phone = page.locator("#phoneNumber");
if (await phone.count()) await phone.fill("612345678"); else console.log("WARN no phone field");
const cardBtn = page.locator('[data-testid="card-accordion-item-button"]');
if (await cardBtn.count()) await cardBtn.click().catch(() => {});
await page.locator("#cardNumber").fill("4242424242424242");
await page.locator("#cardExpiry").fill("12/34");
await page.locator("#cardCvc").fill("123");
await page.locator("#billingName").fill("Marta Prueba García").catch(() => {});
await shot("3-stripe-filled");
await page.locator(".SubmitButton, button[type=submit]").first().click();
await page.waitForURL(/localhost:3013\/es\/checkout\/success/, { timeout: 90000 });
await page.waitForTimeout(8000);
await shot("4-success");
console.log("errors", JSON.stringify(errors.slice(0, 10)));
await browser.close();
