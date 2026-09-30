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
  es: { pdfOnly: /Solo el PDF/, required: /Marca la casilla/, outdated: /ya no se puede comprar/, recreate: /Crear de nuevo/, delivery: /Llega entre el/, teaser: /Lo que viene en la historia/ },
  ca: { pdfOnly: /Només el PDF/, required: /Marca la casella/, outdated: /ja no es pot comprar/, recreate: /Crear de nou/, delivery: /Arriba entre el/, teaser: /El que ve a la història/ },
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
    if (url.pathname === `/api/stories/${STORY_ID}/share`) return route.fulfill({ json: { path: "/es/preview/token" } });
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
const format = (page: Page, key: "hardcover" | "softcover" | "digital_pdf") => page.getByTestId(`format-${key}`);
const extra = (page: Page) => page.getByTestId("extra-copy");
const mainCta = (page: Page) => page.getByTestId("checkout-cta");
const sticky = (page: Page) => page.getByTestId("sticky-buy").locator("button");

for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
  for (const locale of ["es", "ca"] as Locale[]) {
    test.describe(`${locale} ${vpName}`, () => {
      test.use(vp);

      test(`formats, extra copy per format, consent gate, checkout body [${locale} ${vpName}]`, async ({ page }) => {
        const errors = trackErrors(page);
        const bodies = await mockApi(page, { withPlan: true });
        const c = COPY[locale];
        await page.goto(`/${locale}/crear/${STORY_ID}/preview`);
        await section(page).waitFor();
        await section(page).scrollIntoViewIfNeeded();

        // Hardcover pre-selected; delivery date next to the CTA; VAT next to every price.
        await expect(format(page, "hardcover").locator("input")).toBeChecked();
        await expect(section(page).getByTestId("delivery-line")).toContainText(c.delivery);
        await expect(format(page, "hardcover")).toContainText(/49,90\s*€/);
        await expect(format(page, "hardcover")).toContainText(/IVA incl/);

        // Extra copy follows the book's format.
        await expect(extra(page)).toContainText("29,90");
        await format(page, "softcover").click();
        await expect(extra(page)).toContainText("19,90");
        await extra(page).click();
        await expect(mainCta(page)).toContainText(/54,80\s*€/); // 34,90 + 19,90
        await format(page, "hardcover").click();
        await expect(mainCta(page)).toContainText(/79,80\s*€/);
        // PDF only via the text link: no add-ons, back to printed keeps working.
        await section(page).getByRole("button", { name: c.pdfOnly }).click();
        await expect(format(page, "digital_pdf").locator("input")).toBeChecked();
        await expect(extra(page)).toHaveCount(0);
        await expect(mainCta(page)).toContainText(/9,90\s*€/);
        await format(page, "hardcover").click();
        await extra(page).click();

        // No consent → blocked in place, message, no request.
        await mainCta(page).click();
        await expect(page.getByText(c.required)).toBeVisible();
        expect(bodies).toHaveLength(0);
        await page.screenshot({ path: `${SHOTS}/${locale}-${vpName}-consent-missing.png` });

        await page.locator("#withdrawal-consent input").check();
        await expect(page.getByText(c.required)).toHaveCount(0);
        await mainCta(page).click();
        await page.waitForURL("**/__stripe_mock");
        expect(bodies).toHaveLength(1);
        expect(bodies[0]).toMatchObject({ storyId: STORY_ID, format: "hardcover", addons: ["extra_copy"], locale, withdrawalConsent: true });
        expect(errors).toEqual([]);
      });

      test(`preview ends on the chapters + printed book, not a padlock [${locale} ${vpName}]`, async ({ page }) => {
        await mockApi(page, { withPlan: true });
        await page.goto(`/${locale}/crear/${STORY_ID}/preview`);
        await section(page).waitFor();
        await expect(page.getByText(COPY[locale].teaser)).toHaveCount(1);
        // The old blank padlock page ("Desbloquear cuento") is gone; the printed book closes the preview.
        await expect(page.getByText(/Desbloquear cuento|Desbloquejar conte/)).toHaveCount(0);
        await expect(page.getByTestId("checkout-cta")).toHaveCount(1);
      });

      if (vpName === "mobile") {
        test(`sticky bar: formats first, then a soft consent nudge, never the error [${locale}]`, async ({ page }) => {
          const bodies = await mockApi(page, { withPlan: true });
          await page.goto(`/${locale}/crear/${STORY_ID}/preview`);
          await section(page).waitFor();
          await page.waitForTimeout(500);
          await expect(sticky(page)).toBeVisible();
          // 1st tap: the format choice comes into view (below the sticky header).
          await sticky(page).click();
          await expect(page.locator("#formats")).toBeInViewport();
          await expect(page.getByText(COPY[locale].required)).toHaveCount(0);
          const top = await page.locator("#formats").evaluate((el) => el.getBoundingClientRect().top);
          const header = await page.locator("header").evaluate((el) => el.getBoundingClientRect().bottom);
          expect(top).toBeGreaterThanOrEqual(header);
          // Choose → back to the top → the sticky now leads to the consent line, softly.
          await format(page, "softcover").click();
          await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
          await expect(sticky(page)).toBeVisible();
          await sticky(page).click();
          await expect(page.locator("#withdrawal-consent")).toBeInViewport();
          await expect(page.getByText(COPY[locale].required)).toHaveCount(0);
          expect(bodies).toHaveLength(0);
          // Consent given → the sticky (or the CTA now in view) goes straight to Stripe.
          await page.locator("#withdrawal-consent input").check();
          await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
          await sticky(page).click();
          await page.waitForURL("**/__stripe_mock");
          expect(bodies[0]).toMatchObject({ format: "softcover", withdrawalConsent: true });
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
