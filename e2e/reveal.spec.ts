import { test, expect, Page } from "@playwright/test";

// "Book is born" reveal: shows once on first preview load after generation,
// auto-dismisses, and never replays on reload.

async function click(page: Page, re: RegExp) {
  const b = page.locator("button", { hasText: re }).first();
  await b.waitFor({ state: "visible", timeout: 15000 });
  await b.click();
}

test("book reveal plays once after generation", async ({ page }) => {
  test.setTimeout(180000);
  const errs: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errs.push(m.text());
  });

  await page.goto("/es/crear", { waitUntil: "networkidle" });
  await page.getByPlaceholder("Ej: Leo").fill("Rev");
  await click(page, /siguiente/i);
  await page.waitForTimeout(2800);
  await click(page, /elegir aventura/i);
  await page.waitForTimeout(1500);
  await click(page, /espacial/i);
  await page.waitForTimeout(900);
  for (let i = 0; i < 3; i++) {
    await page.locator("button.cp-fanin").first().click();
    await page.waitForTimeout(900);
  }
  await click(page, /escribir la dedicatoria/i);
  await page.waitForTimeout(900);
  await page.locator("text=Regreso Triunfal").first().click();
  await page.waitForTimeout(300);
  await page.locator("button", { hasText: /crear mi cuento/i }).last().click();
  await page.waitForURL(/preview/, { timeout: 120000 });

  // overlay visible shortly after landing
  const cover = page.locator(".book-reveal-cover");
  await cover.waitFor({ state: "visible", timeout: 10000 });

  // auto-dismisses within ~4s (3.4s hold + 0.45s fade + margin)
  await page.waitForTimeout(4600);
  await expect(cover).toHaveCount(0);

  // never replays on reload
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1800);
  await expect(page.locator(".book-reveal-cover")).toHaveCount(0);

  expect(errs).toEqual([]);
});
