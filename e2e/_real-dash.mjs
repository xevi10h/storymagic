import { chromium } from "@playwright/test";
const OUT = process.env.OUT;
const browser = await chromium.launch();
for (const [name, vp] of [["desktop", { width: 1440, height: 900 }], ["mobile", { width: 390, height: 844 }]]) {
  const ctx = await browser.newContext({ viewport: vp, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto("http://localhost:3013/es/auth/login");
  await page.locator("#email").fill("meapica-e2e-1@resend.dev");
  await page.locator("#password").fill("E2e-test-Meapica-2026!");
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((u) => !u.pathname.includes("/auth/login"));
  await page.goto("http://localhost:3013/es/dashboard");
  const btn = page.getByRole("button", { name: /PDF|Descargar/ }).first();
  await btn.waitFor({ timeout: 20000 });
  await page.screenshot({ path: `${OUT}/dash-${name}.png` });
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 30000 }), btn.click()]);
  console.log(name, "dashboard download:", dl.suggestedFilename());
  // Ready book view: download button
  await page.goto("http://localhost:3013/es/crear/f5e6bb9a-4f46-4995-82dc-4bd7d7a2605d/preview");
  const b2 = page.getByRole("button", { name: /Descargar/ }).first();
  await b2.waitFor({ timeout: 20000 });
  const [dl2] = await Promise.all([page.waitForEvent("download", { timeout: 30000 }), b2.click()]);
  console.log(name, "preview download:", dl2.suggestedFilename());
  // Success page of the digital order (invoice link)
  await page.goto("http://localhost:3013/es/checkout/success?session_id=cs_test_b1COF00CqJpch6tZLpqpSZxPLfNAPyEfih7sf6PfTUvANRypq5l1NP8XWH");
  await page.getByText(/Ver factura/).waitFor({ timeout: 60000 }).catch(() => console.log("no invoice link"));
  await page.screenshot({ path: `${OUT}/success-${name}.png`, fullPage: true });
  console.log(name, "errors", JSON.stringify(errors.slice(0, 5)));
  await ctx.close();
}
await browser.close();
