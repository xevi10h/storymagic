import { test, expect } from "@playwright/test";
async function click(page, re: RegExp){const b=page.locator("button",{hasText:re}).first();await b.waitFor({state:"visible",timeout:15000});await b.click();}
test("space tree book creates end-to-end", async ({ page }) => {
  const errs: string[] = [];
  page.on("console", m => { if (m.type()==="error") errs.push(m.text()); });
  test.setTimeout(120000);
  await page.goto("/es/crear", { waitUntil: "networkidle" });
  await page.getByPlaceholder("Ej: Leo").fill("Bruno");
  await click(page, /siguiente/i);
  await page.waitForTimeout(2500);
  await click(page, /elegir aventura/i);
  await page.waitForTimeout(600);
  await click(page, /espacial|espac/i);
  await page.waitForTimeout(600);
  await click(page, /nave dormida/i);     // c1 ship
  await page.waitForTimeout(600);
  await click(page, /jardín interior|jardin interior/i); // c2 garden
  await page.waitForTimeout(600);
  await click(page, /regarla|agua de cometa/i);          // c3 water → ending
  await page.waitForTimeout(700);
  await click(page, /escribir la dedicatoria/i); // finish → dedication
  await page.waitForTimeout(800);
  // pick an ending radio
  const radio = page.locator('input[name="ending"]').first();
  await radio.waitFor({ state: "attached", timeout: 10000 });
  await radio.check({ force: true });
  await page.waitForTimeout(400);
  await page.screenshot({ path: "/tmp/ff-dedication.png" });
  // create button (footer next)
  const create = page.locator("button", { hasText: /crear|finalizar|generar|continuar/i }).last();
  await create.click();
  // wait for navigation to preview
  await page.waitForURL(/\/crear\/.+\/preview/, { timeout: 90000 }).catch(()=>{});
  await page.waitForTimeout(2000);
  const url = page.url();
  await page.screenshot({ path: "/tmp/ff-preview.png", fullPage: false });
  const bodyText = (await page.locator("body").innerText()).slice(0, 400);
  console.log("FINAL_URL:", url);
  console.log("BODY_HEAD:", bodyText.replace(/\s+/g," ").slice(0,200));
  console.log("ERRORS:", JSON.stringify(errs.slice(0,5)));
  expect(url).toMatch(/\/crear\/.+\/preview/);
});
