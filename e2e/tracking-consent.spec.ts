// Ad pixels vs cookie consent and child data. Needs a dev server built with a TikTok pixel id:
//   NEXT_PUBLIC_TIKTOK_PIXEL_ID=<id> NEXT_PUBLIC_META_PIXEL_ID=000000000000000 npx next dev --port 3023
//   BASE_URL=http://localhost:3023 npx playwright test e2e/tracking-consent.spec.ts
// Every tracker POST is recorded and aborted, so nothing reaches TikTok or Meta.
//
// Not covered here: TikTok's automatic click capture (AutoClick) sends the clicked button's text
// ("Crear el libro de Zoraida"). It is switched on per pixel in TikTok Events Manager, not in our
// code, so the checks below only look at what our code controls: URLs, referrers and our events.
import { test, expect, type Page, type BrowserContext } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3023";
const CHILD = "Zoraida";
// Third-party hosts only (our own bundle has a posthog-js chunk).
const TRACKER = /^https:\/\/([a-z0-9-]+\.)*(tiktok\.com|tiktokw\.us|facebook\.com|facebook\.net|google-analytics\.com|googletagmanager\.com|posthog\.com)\//;

type Hit = { url: string; body: string };

async function recordTrackers(context: BrowserContext): Promise<Hit[]> {
  const hits: Hit[] = [];
  await context.route(TRACKER, async (route) => {
    const req = route.request();
    hits.push({ url: req.url(), body: req.postData() ?? "" });
    // Scripts load (the pixel must run to be tested); beacons never leave the machine.
    if (req.method() === "GET" && /\.js(\?|$)/.test(new URL(req.url()).pathname + new URL(req.url()).search)) return route.continue();
    return route.abort();
  });
  return hits;
}

async function withConsent(context: BrowserContext, value: string | null) {
  if (value) await context.addCookies([{ name: "meapica_consent", value, url: BASE }]);
}

const tiktokEvents = (hits: Hit[]) =>
  hits.filter((h) => /analytics\.tiktok\.com\/api\/v2\/pixel$/.test(h.url)).map((h) => JSON.parse(h.body).event as string);

/** Our code's channels (page URL, referrer, our events). AutoClick's button text is excluded on purpose (see top). */
const nameLeaks = (hits: Hit[]) =>
  hits.filter((h) => !/\/pixel\/act$/.test(h.url) && (h.url + h.body).includes(CHILD));

async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2500);
}

test("no choice yet: no tracker script or request", async ({ context, page }) => {
  const hits = await recordTrackers(context);
  await page.goto(`${BASE}/es`);
  await settle(page);
  expect(await page.evaluate(() => typeof (window as { ttq?: unknown }).ttq)).toBe("undefined");
  expect(hits).toEqual([]);
});

test("analytics only: the TikTok pixel stays off", async ({ context, page }) => {
  await withConsent(context, "analytics");
  const hits = await recordTrackers(context);
  await page.goto(`${BASE}/es`);
  await settle(page);
  expect(hits.filter((h) => /tiktok/.test(h.url))).toEqual([]);
});

test("ads consent: the pixel loads and sends a page view", async ({ context, page }) => {
  await withConsent(context, "ads");
  const hits = await recordTrackers(context);
  await page.goto(`${BASE}/es`);
  await settle(page);
  expect(hits.some((h) => h.url.includes("analytics.tiktok.com/i18n/pixel/events.js"))).toBe(true);
  expect(tiktokEvents(hits)).toContain("Pageview");
});

test("hero CTA: the name reaches /create in memory, never in a URL the trackers see", async ({ context, page }) => {
  await withConsent(context, "granted");
  const hits = await recordTrackers(context);
  await page.goto(`${BASE}/es`);
  await settle(page);
  await page.locator("#hero-name").fill(CHILD);
  await page.locator("#hero-cta").click();
  await page.waitForURL(/\/es\/create/);
  await expect(page.locator("#child-name")).toHaveValue(CHILD);
  expect(page.url()).not.toContain("name=");
  await settle(page);
  expect(tiktokEvents(hits).filter((e) => e === "Pageview").length).toBeGreaterThanOrEqual(2); // client navigation counted
  expect(nameLeaks(hits)).toEqual([]);
});

test("hard load of /create?name=: trackers wait until the URL is clean, prefill still works", async ({ context, page }) => {
  await withConsent(context, "granted");
  const hits = await recordTrackers(context);
  await page.goto(`${BASE}/es/create?name=${CHILD}&utm_source=tiktok`);
  await expect(page.locator("#child-name")).toHaveValue(CHILD);
  await settle(page);
  expect(page.url()).not.toContain("name=");
  expect(page.url()).toContain("utm_source=tiktok");
  expect(hits.some((h) => h.url.includes("analytics.tiktok.com/i18n/pixel/events.js"))).toBe(true); // loaded after the clean-up
  expect(nameLeaks(hits)).toEqual([]);
});

test("a later visit to /create (header link) does not re-apply a used hand-off", async ({ context, page }) => {
  await recordTrackers(context);
  await page.goto(`${BASE}/es`);
  await page.locator("#hero-name").fill(CHILD);
  await page.locator("#hero-cta").click();
  await expect(page.locator("#child-name")).toHaveValue(CHILD);
  await page.evaluate(() => localStorage.clear()); // no saved draft: only an unused hand-off could refill the field
  await page.goBack(); // client-side, same JS memory
  await page.waitForURL(/\/es$/);
  await page.locator('header a[href="/es/create"]').first().click();
  await page.waitForURL(/\/es\/create/);
  await page.waitForTimeout(1500);
  await expect(page.locator("#child-name")).toHaveValue(""); // the hand-off was used once
});

test("choosing a world sends ViewContent with the world as content_id", async ({ context, page }) => {
  await withConsent(context, "ads");
  const hits = await recordTrackers(context);
  await page.goto(`${BASE}/es/create`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator("#child-name").fill(CHILD);
  await page.getByRole("radio", { name: /^6\b/ }).click();
  await page.getByRole("radio", { name: /^Una niña$/ }).click();
  const world = page.getByRole("radio", { name: /Espacial/i }).first();
  for (let step = 0; step < 4 && !(await world.isVisible()); step++) {
    await page.getByRole("button", { name: /Siguiente/ }).click();
    await page.waitForTimeout(600);
  }
  await world.click();
  await expect.poll(() => tiktokEvents(hits), { timeout: 10_000 }).toContain("ViewContent");
  const viewContent = hits
    .map((h) => (/\/api\/v2\/pixel$/.test(h.url) ? JSON.parse(h.body) : null))
    .find((b) => b?.event === "ViewContent");
  expect(viewContent.properties.contents[0].content_id).toBeTruthy();
  expect(nameLeaks(hits)).toEqual([]);
});
