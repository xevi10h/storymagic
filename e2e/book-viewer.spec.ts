import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "fs";

// Web book = printed book (src/lib/book/book-plan.ts). Uses a real example book (read-only):
//   npx playwright test e2e/book-viewer.spec.ts
// The viewer must show the PDF's 34 pages in print order and end on the world: the hero portrait,
// the adventure-map game spread, the endpapers and the back cover.

const LEO = "159f5965-7601-478d-8590-cda0d8253d62"; // "Leo y el valle que rugía" (es, age 5)

const VIEWPORTS = {
  desktop: { viewport: { width: 1440, height: 1000 } },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
} as const;

/** WAITLIST_MODE gate: the access cookie from .env.local, when there is one. */
function accessCode(): string | null {
  try {
    const m = /^WAITLIST_ACCESS_CODE=(.*)$/m.exec(readFileSync(".env.local", "utf8"));
    return m ? m[1].replace(/^["']|["']$/g, "") : null;
  } catch {
    return null;
  }
}

async function openBook(page: Page) {
  const code = accessCode();
  if (code) await page.context().addCookies([{ name: "meapica_access", value: code, url: "http://localhost:3013" }]);
  const res = await page.request.get(`/api/showcase/${LEO}`);
  test.skip(!res.ok(), "example book not available");
  await page.goto(`/es/examples/${LEO}`);
  await page.getByTestId("book-viewer").waitFor({ timeout: 60_000 });
  await expect(page.getByTestId("book-page-count")).toHaveText("1 / 34");
}

async function turnTo(page: Page, spread: string) {
  const viewer = page.getByTestId("book-viewer");
  for (let i = 0; i < 20 && (await viewer.getAttribute("data-spread")) !== spread; i++) {
    await page.getByTestId("book-next").click();
    await page.waitForTimeout(900);
  }
  await expect(viewer).toHaveAttribute("data-spread", spread);
}

for (const [name, vp] of Object.entries(VIEWPORTS)) {
  test.describe(name, () => {
    test.use(vp);

    test(`34 printed pages, ending on the hero, the map game and the back cover [${name}]`, async ({ page }) => {
      const errors: string[] = [];
      page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
      page.on("pageerror", (e) => errors.push(String(e)));
      await openBook(page);

      // p26 "Fin" ↔ p27 hero portrait
      await turnTo(page, "27-28");
      await expect(page.getByText("Fin", { exact: true })).toBeVisible();
      await expect(page.getByText("EL HÉROE", { exact: true })).toBeVisible();

      // p28–29: the adventure map with its search-and-find game, playable on screen
      await turnTo(page, "29-30");
      const game = page.getByTestId("map-game");
      await expect(game).toBeVisible();
      await expect(game).toContainText("Busca y encuentra");
      await expect(game).toContainText("Encuentra estas 6 cosas escondidas en el mapa.");
      const item = game.getByRole("button", { name: "Lulo" });
      await expect(item).toHaveAttribute("aria-pressed", "false");
      await item.click();
      await expect(item).toHaveAttribute("aria-pressed", "true");
      // Ticking an item never turns the page
      await page.waitForTimeout(900);
      await expect(page.getByTestId("book-viewer")).toHaveAttribute("data-spread", "29-30");

      // p30 colophon ↔ back endpaper, then the back cover alone
      await turnTo(page, "31-32");
      await turnTo(page, "33");
      await expect(page.getByTestId("book-next")).toBeDisabled();

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      expect(errors).toEqual([]);
    });
  });
}
