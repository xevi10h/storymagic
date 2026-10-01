import { test, expect, type Page, type Route } from "@playwright/test";

// Turnstile → Supabase Auth captcha_token wiring (login OTP + guest sign-up).
// Every Supabase Auth and /api call is intercepted: nothing reaches the shared
// project the local .env points at.
//
// Start the dev server with one of Cloudflare's test sitekeys, then run with the
// matching CAPTCHA_MODE:
//   NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA npx next dev --port 3121
//     CAPTCHA_MODE=pass BASE_URL=http://localhost:3121 npx playwright test e2e/captcha.spec.ts
//   NEXT_PUBLIC_TURNSTILE_SITE_KEY=2x00000000000000000000AB … CAPTCHA_MODE=fail …
//   NEXT_PUBLIC_TURNSTILE_SITE_KEY=3x00000000000000000000FF … CAPTCHA_MODE=interactive …
//   (no key) … CAPTCHA_MODE=off …

type Mode = "pass" | "fail" | "interactive" | "off";
const MODE = (process.env.CAPTCHA_MODE ?? "pass") as Mode;
const SHOTS = process.env.SHOTS_DIR ?? "test-results/captcha";
const DUMMY_TOKEN = "XXXX.DUMMY.TOKEN.XXXX"; // what Cloudflare's test sitekeys return

test.use({ baseURL: process.env.BASE_URL ?? "http://localhost:3121" });

const VIEWPORTS = {
  desktop: { viewport: { width: 1440, height: 900 } },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
} as const;

function b64url(obj: unknown) {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}
const USER = {
  id: "9f1c2d3e-0000-4000-8000-000000000002",
  aud: "authenticated",
  role: "authenticated",
  is_anonymous: true,
  app_metadata: { provider: "anonymous" },
  user_metadata: {},
  created_at: new Date().toISOString(),
};
function session() {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url({ sub: USER.id, exp, role: "authenticated", is_anonymous: true })}.sig`;
  return { access_token: token, token_type: "bearer", expires_in: 3600, expires_at: exp, refresh_token: "refresh-mock", user: USER };
}

interface AuthCall {
  path: string;
  body: Record<string, unknown> | null;
}

async function installMocks(page: Page) {
  const auth: AuthCall[] = [];
  await page.route(/\/auth\/v1\//, async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    let body: Record<string, unknown> | null = null;
    try {
      body = req.postDataJSON();
    } catch {
      body = null;
    }
    auth.push({ path: url.pathname, body });
    if (url.pathname.endsWith("/otp")) return route.fulfill({ json: {} });
    if (url.pathname.endsWith("/signup")) return route.fulfill({ json: session() });
    if (url.pathname.endsWith("/user")) return route.fulfill({ json: USER });
    return route.fulfill({ status: 404, json: { error: "unmocked" } });
  });
  await page.route(/\/api\//, async (route: Route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (path === "/api/auth/guest-merge") return route.fulfill({ json: { ok: true } });
    if (path === "/api/characters/prepare") return route.fulfill({ json: { characterPrepId: "prep-123" } });
    if (path === "/api/stories" && req.method() === "POST") return route.fulfill({ status: 500, json: { error: "mock_stop" } });
    return route.fulfill({ status: 404, json: { error: "unmocked", path } });
  });
  return auth;
}

function trackConsole(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));
  return errors;
}

/** Console noise that is not ours: mocked 404/500 answers, Cloudflare test-key chatter. */
function ownErrors(errors: string[]) {
  return errors.filter(
    (e) =>
      !/Failed to load resource/.test(e) &&
      !/challenges\.cloudflare\.com|turnstile|Private Access Token|\[Cloudflare/i.test(e),
  );
}

async function interactiveCheckbox(page: Page) {
  const overlay = page.getByTestId("captcha-overlay");
  await expect(overlay).toHaveAttribute("role", "dialog", { timeout: 20_000 });
  await expect(overlay).toHaveAttribute("aria-hidden", "false");
  return overlay;
}

for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
  test.describe(`${MODE} ${vpName}`, () => {
    test.use(vp);

    test(`login OTP carries the captcha token [${MODE} ${vpName}]`, async ({ page }) => {
      test.setTimeout(90_000);
      const errors = trackConsole(page);
      const auth = await installMocks(page);
      await page.goto("/es/auth/login");
      await page.getByTestId("auth-email-input").fill("padre@example.com");
      await page.getByRole("button", { name: /Enviar|código/i }).first().click();

      if (MODE === "interactive") {
        await interactiveCheckbox(page);
        await page.waitForTimeout(1200);
        await page.screenshot({ path: `${SHOTS}/login-interactive-${vpName}.png` });
        return; // the checkbox lives in a cross-origin iframe; overlay + a11y state is what we own
      }

      if (MODE === "fail") {
        await expect(page.getByTestId("auth-email-step").getByRole("alert")).toContainText("No hemos podido comprobar que eres una persona", { timeout: 20_000 });
        expect(auth.filter((c) => c.path.endsWith("/otp"))).toHaveLength(0);
        await page.screenshot({ path: `${SHOTS}/login-fail-${vpName}.png` });
      } else {
        await expect(page.getByTestId("auth-code-step")).toBeVisible({ timeout: 20_000 });
        const otp = auth.find((c) => c.path.endsWith("/otp"));
        expect(otp).toBeTruthy();
        const security = otp!.body?.gotrue_meta_security as { captcha_token?: string } | undefined;
        if (MODE === "pass") expect(security?.captcha_token).toBe(DUMMY_TOKEN);
        else expect(security?.captcha_token).toBeUndefined();
        await page.screenshot({ path: `${SHOTS}/login-${MODE}-${vpName}.png` });
      }
      await expect(page.getByTestId("captcha-overlay")).toHaveCount(0); // removed after use
      expect(ownErrors(errors)).toEqual([]);
    });

    test(`guest sign-up carries the captcha token [${MODE} ${vpName}]`, async ({ page }) => {
      test.setTimeout(120_000);
      const errors = trackConsole(page);
      const auth = await installMocks(page);
      await page.goto("/es/create", { waitUntil: "domcontentloaded" });
      await page.evaluate(() => localStorage.clear());
      await page.goto("/es/create", { waitUntil: "domcontentloaded" });
      await page.locator("#child-name").fill("Lucía");
      await page.getByRole("radio", { name: /^6/ }).click();
      await page.getByRole("radio", { name: "Una niña" }).click();
      await page.getByRole("button", { name: /Siguiente/ }).click();
      await expect(page.getByTestId("protagonist-portrait")).toBeVisible();
      await page.getByRole("button", { name: /Siguiente/ }).click(); // → background character prep → guest session

      if (MODE === "interactive") {
        await interactiveCheckbox(page);
        await page.waitForTimeout(1200);
        await page.screenshot({ path: `${SHOTS}/create-interactive-${vpName}.png` });
        // Escape cancels: the overlay goes away, no sign-up without a token
        await page.keyboard.press("Escape");
        await expect(page.getByTestId("captcha-overlay")).toHaveCount(0);
        expect(auth.filter((c) => c.path.endsWith("/signup"))).toHaveLength(0);
        return;
      }

      if (MODE === "fail") {
        // Prep is best effort (silent); creating the book surfaces the failure.
        await page.getByRole("radio", { name: /Espacial/i }).first().click();
        for (let ch = 1; ch <= 3; ch++) {
          const option = page.locator(`section[aria-labelledby="adv-ch-${ch}"] [role=radio]`).first();
          await option.waitFor({ state: "visible", timeout: 15_000 });
          await option.click();
        }
        await page.getByRole("button", { name: /Crear su libro/ }).click();
        await expect(page.getByText("No hemos podido comprobar que eres una persona").first()).toBeVisible({ timeout: 20_000 });
        expect(auth.filter((c) => c.path.endsWith("/signup"))).toHaveLength(0);
        await page.screenshot({ path: `${SHOTS}/create-fail-${vpName}.png` });
      } else {
        await expect.poll(() => auth.some((c) => c.path.endsWith("/signup")), { timeout: 20_000 }).toBe(true);
        const signup = auth.find((c) => c.path.endsWith("/signup"))!;
        const security = signup.body?.gotrue_meta_security as { captcha_token?: string } | undefined;
        if (MODE === "pass") expect(security?.captcha_token).toBe(DUMMY_TOKEN);
        else expect(security?.captcha_token).toBeUndefined();
        await page.screenshot({ path: `${SHOTS}/create-${MODE}-${vpName}.png` });
      }
      await expect(page.getByTestId("captcha-overlay")).toHaveCount(0);
      expect(ownErrors(errors)).toEqual([]);
    });
  });
}
