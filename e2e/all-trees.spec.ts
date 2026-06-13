import { test, expect, Page } from "@playwright/test";

// Walks every template's branching path to completion (first option each beat).
// Mock mode: no AI cost. Asserts the celebration CTA appears and zero console errors.

const TEMPLATES: Array<[string, RegExp]> = [
  ["space", /espacial/i],
  ["forest", /bosque mágico|bosque magico/i],
  ["dinosaurs", /dinosaurios/i],
  ["pirates", /piratas/i],
  ["superhero", /superhéroe|superheroe/i],
  ["chef", /chef/i],
  ["castle", /castillo/i],
  ["safari", /safari/i],
  ["inventor", /inventos|inventor/i],
  ["candy", /dulces/i],
];

async function click(page: Page, re: RegExp) {
  const b = page.locator("button", { hasText: re }).first();
  await b.waitFor({ state: "visible", timeout: 15000 });
  await b.click();
}

for (const [id, worldRe] of TEMPLATES) {
  test(`tree path completes: ${id}`, async ({ page }) => {
    test.setTimeout(90000);
    const errs: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") errs.push(m.text());
    });
    page.on("pageerror", (e) => errs.push(`PAGEERROR: ${e.message}`));

    await page.goto("/es/crear", { waitUntil: "networkidle" });
    await page.getByPlaceholder("Ej: Leo").fill("Test");
    await click(page, /siguiente/i);
    await page.waitForTimeout(2600);
    await click(page, /elegir aventura/i);
    await page.waitForTimeout(1200);
    await click(page, worldRe);
    await page.waitForTimeout(900);

    // Three chapters: always take the first option card.
    for (let beat = 0; beat < 3; beat++) {
      const card = page.locator("button.cp-fanin").first();
      await card.waitFor({ state: "visible", timeout: 15000 });
      await card.click();
      await page.waitForTimeout(900);
    }

    const finish = page.locator("button", { hasText: /escribir la dedicatoria/i }).first();
    await finish.waitFor({ state: "visible", timeout: 15000 });
    expect(errs).toEqual([]);
  });
}
