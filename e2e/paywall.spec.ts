import { test, expect, type Page, type Route } from "@playwright/test";

// Paywall (screen 6) — every backend call is mocked (shared prod Supabase locally).
//   npx playwright test e2e/paywall.spec.ts

const SHOTS = process.env.SHOTS_DIR ?? "test-results/paywall";
const STORY_ID = "11111111-2222-4333-8444-666666666666";
const CHARACTER_ID = "c0ffee00-0000-4000-8000-000000000001";

const VIEWPORTS = {
  desktop: { viewport: { width: 1440, height: 900 } },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
} as const;

const COPY = {
  es: { hard: /Tapa dura/, soft: /Tapa blanda/, digital: /PDF Digital/, extra: /Ejemplar extra/, required: /Marca la casilla/, outdated: /ya no se puede comprar/, recreate: /Crear de nuevo/ },
  ca: { hard: /Tapa dura/, soft: /Tapa tova/, digital: /PDF Digital/, extra: /Exemplar extra/, required: /Marca la casella/, outdated: /ja no es pot comprar/, recreate: /Crear de nou/ },
} as const;
type Locale = keyof typeof COPY;

const b64url = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
const USER = { id: "9f1c2d3e-0000-4000-8000-000000000002", aud: "authenticated", role: "authenticated", is_anonymous: true, app_metadata: { provider: "anonymous" }, user_metadata: {}, created_at: new Date().toISOString() };
function session() {
  const exp = Math.floor(Date.now() / 1000) + 86400;
  return { access_token: `${b64url({ alg: "HS256" })}.${b64url({ sub: USER.id, exp, role: "authenticated" })}.sig`, token_type: "bearer", expires_in: 86400, expires_at: exp, refresh_token: "r", user: USER };
}
const ART = (f: string) => `/images/path/space/${f}.webp`;

function story(withPlan: boolean) {
  return {
    id: STORY_ID,
    status: "preview",
    character_id: CHARACTER_ID,
    template_id: "space",
    title: "Lucía y el jardín de las estrellas",
    cover_image_url: ART("space-c1-crystal"),
    character_portrait_url: null,
    dedication_text: null,
    sender_name: null,
    generated_text: {
      bookTitle: "Lucía y el jardín de las estrellas",
      synopsis: "Una aventura entre estrellas.",
      finalMessage: "Fin.",
      scenes: Array.from({ length: 12 }, (_, i) => ({ sceneNumber: i + 1, title: `Escena ${i + 1}`, text: `Texto de la escena ${i + 1}.`, imagePrompt: "", type: "scene" })),
      ...(withPlan ? { imagePlan: { bible: "x" } } : {}),
    },
    characters: { name: "Lucía", age: 6, gender: "girl", city: null, interests: [], favorite_color: "#E53935", favorite_companion: null, future_dream: null, avatar_url: null, hair_color: null, skin_tone: null, eye_color: null, hairstyle: null },
    story_illustrations: ["space-c1-ship", "space-c2ship-garden", "space-c2ship-bridge"].map((f, i) => ({ scene_number: i + 1, image_url: ART(f), status: "ready" })),
  };
}

async function mockApi(page: Page, opts: { withPlan: boolean; checkoutError?: string }) {
  const checkoutBodies: Record<string, unknown>[] = [];
  await page.route(/\/auth\/v1\//, (route: Route) =>
    route.request().url().includes("/user") ? route.fulfill({ json: USER }) : route.fulfill({ json: session() }),
  );
  await page.route(/\/api\//, async (route: Route) => {
    const url = new URL(route.request().url());
    if (url.pathname === `/api/stories/${STORY_ID}`) return route.fulfill({ json: story(opts.withPlan) });
    if (url.pathname === "/api/checkout") {
      checkoutBodies.push(route.request().postDataJSON());
      if (opts.checkoutError) return route.fulfill({ status: 409, json: { error: opts.checkoutError } });
      return route.fulfill({ json: { url: "http://localhost:3013/__stripe_mock" } });
    }
    return route.fulfill({ status: 404, json: { error: "unmocked" } });
  });
  await page.route("**/__stripe_mock", (route) => route.fulfill({ contentType: "text/html", body: "<h1>stripe</h1>" }));
  return checkoutBodies;
}

function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  return errors;
}

const section = (page: Page) => page.locator("#checkout-section");
const card = (page: Page, re: RegExp) => section(page).locator("button").filter({ hasText: re }).first();
const mainCta = (page: Page) => section(page).locator("button").filter({ hasText: /IVA incl\./ }).first();

for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
  for (const locale of ["es", "ca"] as Locale[]) {
    test.describe(`${locale} ${vpName}`, () => {
      test.use(vp);

      test(`consent gate, extra-copy price per format, checkout body [${locale} ${vpName}]`, async ({ page }) => {
        const errors = trackErrors(page);
        const bodies = await mockApi(page, { withPlan: true });
        const c = COPY[locale];
        await page.goto(`/${locale}/crear/${STORY_ID}/preview`);
        await section(page).waitFor();
        await section(page).scrollIntoViewIfNeeded();

        // Extra copy follows the book's format.
        await card(page, c.hard).click();
        const extra = section(page).locator("button").filter({ hasText: c.extra });
        await expect(extra).toContainText("29,90");
        await card(page, c.soft).click();
        await expect(extra).toContainText("19,90");
        await extra.click();
        await expect(section(page).getByText(/54,80\s*€/).first()).toBeVisible(); // 34,90 + 19,90
        await card(page, c.hard).click();
        await expect(section(page).getByText(/79,80\s*€/).first()).toBeVisible();
        // Digital: no add-ons.
        await card(page, c.digital).click();
        await expect(extra).toHaveCount(0);
        await card(page, c.hard).click();
        await extra.click();

        // Every price carries "IVA incl."
        await expect(section(page).getByText(/IVA incl/).first()).toBeVisible();

        // No consent → blocked, message, no request.
        await page.locator("#withdrawal-consent").scrollIntoViewIfNeeded();
        await mainCta(page).click();
        await expect(page.getByText(c.required)).toBeVisible();
        expect(bodies).toHaveLength(0);
        await page.screenshot({ path: `${SHOTS}/${locale}-${vpName}-consent-missing.png` });

        await page.locator("#withdrawal-consent input").check();
        await expect(page.getByText(c.required)).toHaveCount(0);
        await page.screenshot({ path: `${SHOTS}/${locale}-${vpName}-consent-ok.png` });
        await mainCta(page).click();
        await page.waitForURL("**/__stripe_mock");
        expect(bodies).toHaveLength(1);
        expect(bodies[0]).toMatchObject({ storyId: STORY_ID, format: "hardcover", addons: ["extra_copy"], locale, withdrawalConsent: true });
        expect(errors).toEqual([]);
      });

      if (vpName === "mobile") {
        test(`sticky buy bar needs consent [${locale}]`, async ({ page }) => {
          const bodies = await mockApi(page, { withPlan: true });
          await page.goto(`/${locale}/crear/${STORY_ID}/preview`);
          await section(page).waitFor();
          // Scroll to the paywall once (sticky bar then pays directly), then back up.
          await section(page).scrollIntoViewIfNeeded();
          await page.waitForTimeout(300);
          await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
          const sticky = page.locator("div.fixed.inset-x-0.bottom-0 button");
          await expect(sticky).toBeVisible();
          await sticky.click();
          await expect(page.getByText(COPY[locale].required)).toBeVisible();
          await expect(page.locator("#withdrawal-consent")).toBeInViewport();
          expect(bodies).toHaveLength(0);
          await page.screenshot({ path: `${SHOTS}/${locale}-mobile-sticky-consent.png` });
        });
      }

      test(`outdated preview can't be bought [${locale} ${vpName}]`, async ({ page }) => {
        const errors = trackErrors(page);
        await mockApi(page, { withPlan: false });
        await page.goto(`/${locale}/crear/${STORY_ID}/preview`);
        await expect(page.getByText(COPY[locale].outdated)).toBeVisible();
        await expect(page.locator("#withdrawal-consent")).toHaveCount(0);
        const link = page.getByRole("link", { name: COPY[locale].recreate });
        await expect(link).toHaveAttribute("href", new RegExp(`/crear\\?characterId=${CHARACTER_ID}`));
        await section(page).scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${SHOTS}/${locale}-${vpName}-outdated.png` });
        expect(errors).toEqual([]);
      });
    });
  }
}

test("server says preview_outdated → outdated notice", async ({ page }) => {
  await mockApi(page, { withPlan: true, checkoutError: "preview_outdated" });
  await page.goto(`/es/crear/${STORY_ID}/preview`);
  await section(page).waitFor();
  await page.locator("#withdrawal-consent input").check();
  await mainCta(page).click();
  await expect(page.getByText(COPY.es.outdated)).toBeVisible();
});
