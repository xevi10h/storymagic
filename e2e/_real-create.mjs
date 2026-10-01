// Real (non-mocked) guest creation → preview. Spends ~$0.35 of OpenAI. Local only.
import { chromium } from "@playwright/test";
const OUT = process.env.OUT;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "es-ES" });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto("http://localhost:3013/es/create");
await page.evaluate(() => localStorage.clear());
await page.goto("http://localhost:3013/es/create");
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
await page.waitForURL(/\/create\/[0-9a-f-]{36}\/generate/, { timeout: 60000 });
const storyId = page.url().match(/create\/([0-9a-f-]{36})/)[1];
console.log("storyId", storyId);
await page.waitForURL(/\/preview/, { timeout: 300000 });
await page.waitForTimeout(3000);
await page.screenshot({ path: `${OUT}/preview.png` });
await ctx.storageState({ path: `${OUT}/state.json` });
console.log("errors", JSON.stringify(errors.slice(0, 10)));
await browser.close();
