import { test, expect } from "@playwright/test";
async function click(page, re: RegExp, which: "first"|"last"="first") {
  const b = page.locator("button", { hasText: re })[which]();
  await b.waitFor({ state: "visible", timeout: 15000 });
  await b.click();
}
test("full depth reaches ending", async ({ page }) => {
  const errs: string[] = [];
  page.on("console", m => { if (m.type()==="error") errs.push(m.text()); });
  await page.goto("/es/crear", { waitUntil: "networkidle" });
  await page.getByPlaceholder("Ej: Leo").fill("Aina");
  await click(page, /siguiente/i);
  await page.waitForTimeout(2500);
  await click(page, /elegir aventura/i);
  await page.waitForTimeout(700);
  await click(page, /espacial|espac/i);            // world
  await page.waitForTimeout(600);
  await click(page, /robot perdido/i);             // c1
  await page.waitForTimeout(600);
  await click(page, /fábrica flotante/i);          // c2
  await page.waitForTimeout(600);
  const q_c3 = (await page.locator(".path-chapter h2").innerText()).replace(/\s+/g," ").trim();
  await page.screenshot({ path: "/tmp/pb-c3.png" });
  await click(page, /usar un imán|imán/i);         // c3 → ending
  await page.waitForTimeout(700);
  await page.screenshot({ path: "/tmp/pb-ending.png" });
  const finishVisible = await page.locator("button", { hasText: /continuar/i }).first().isVisible();
  console.log("Q_C3:", q_c3);
  console.log("FINISH_VISIBLE:", finishVisible);
  console.log("ERRORS:", JSON.stringify(errs));
  expect(q_c3).toContain("fábrica");
  expect(finishVisible).toBeTruthy();
  // click finish → should go to dedication step 3
  await click(page, /continuar/i);
  await page.waitForTimeout(800);
  await page.screenshot({ path: "/tmp/pb-step3.png" });
  expect(errs).toEqual([]);
});
