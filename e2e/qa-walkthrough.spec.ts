import { test, expect, Page } from "@playwright/test";

// QA walkthrough: full creation flow with a screenshot at every phase.
// Run with MOCK_MODE=true on the dev server — no AI credits consumed.

async function click(page: Page, re: RegExp) {
  const b = page.locator("button", { hasText: re }).first();
  await b.waitFor({ state: "visible", timeout: 15000 });
  await b.click();
}

async function shot(page: Page, tag: string, name: string) {
  await page.screenshot({ path: `/tmp/qa-${tag}-${name}.png`, fullPage: false });
}

function walkthrough(tag: string) {
  test(`creation flow walkthrough [${tag}]`, async ({ page }) => {
    test.setTimeout(180000);
    const errs: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") errs.push(m.text());
    });
    page.on("pageerror", (e) => errs.push(`PAGEERROR: ${e.message}`));

    // Landing
    await page.goto("/es", { waitUntil: "networkidle" });
    await shot(page, tag, "00-landing");

    // Step 1: character creation
    await page.goto("/es/crear", { waitUntil: "networkidle" });
    await shot(page, tag, "01-step1-empty");
    await page.getByPlaceholder("Ej: Leo").fill("Vera");
    await page.waitForTimeout(300);
    await shot(page, tag, "02-step1-named");

    // Scroll through the whole step to capture all sections
    await page.mouse.wheel(0, 800);
    await page.waitForTimeout(400);
    await shot(page, tag, "03-step1-mid");
    await page.mouse.wheel(0, 800);
    await page.waitForTimeout(400);
    await shot(page, tag, "04-step1-bottom");

    // Advance → portrait generation
    await page.mouse.wheel(0, -2000);
    await page.waitForTimeout(300);
    await click(page, /siguiente/i);
    await page.waitForTimeout(1000);
    await shot(page, tag, "05-portrait-generating");
    await page.waitForTimeout(2500);
    await shot(page, tag, "06-portrait-revealed");

    // Into path builder (wait for the fan-in animation to settle)
    await click(page, /elegir aventura/i);
    await page.waitForTimeout(1800);
    await shot(page, tag, "07-path-worlds");

    await click(page, /espacial|espac/i);
    await page.waitForTimeout(800);
    await shot(page, tag, "08-path-beat1");

    await click(page, /nave dormida/i);
    await page.waitForTimeout(800);
    await shot(page, tag, "09-path-beat2");

    await click(page, /jardín interior|jardin interior/i);
    await page.waitForTimeout(800);
    await shot(page, tag, "10-path-beat3");

    await click(page, /regarla|agua de cometa/i);
    await page.waitForTimeout(900);
    await shot(page, tag, "11-path-complete");

    await click(page, /escribir la dedicatoria/i);
    await page.waitForTimeout(1000);
    await shot(page, tag, "12-dedication-top");

    // Fill dedication
    const textarea = page.locator("textarea").first();
    if (await textarea.isVisible().catch(() => false)) {
      await textarea.fill("Para Vera, que nunca deje de soñar entre las estrellas.");
    }
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(400);
    await shot(page, tag, "13-dedication-endings");

    const radio = page.locator('input[name="ending"]').first();
    await radio.waitFor({ state: "attached", timeout: 10000 });
    await radio.check({ force: true });
    await page.waitForTimeout(400);
    await shot(page, tag, "14-dedication-filled");

    // Create the book
    const create = page.locator("button", { hasText: /crear|finalizar|generar|continuar/i }).last();
    await create.click();
    await page.waitForTimeout(1500);
    await shot(page, tag, "15-generating");

    await page.waitForURL(/\/crear\/.+\/preview/, { timeout: 120000 }).catch(() => {});
    await page.waitForTimeout(2500);
    await shot(page, tag, "16-preview-initial");
    const url = page.url();

    // If preview reached, capture a couple of book states
    if (/preview/.test(url)) {
      await page.waitForTimeout(4000);
      await shot(page, tag, "17-preview-later");
      await page.mouse.wheel(0, 800);
      await page.waitForTimeout(500);
      await shot(page, tag, "18-preview-scrolled");
    }

    console.log("FINAL_URL:", url);
    console.log("CONSOLE_ERRORS:", JSON.stringify(errs.slice(0, 10)));
    expect(url).toMatch(/\/crear\/.+\/preview/);
  });
}

test.describe("desktop", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  walkthrough("desktop");
});

test.describe("mobile", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  walkthrough("mobile");
});
