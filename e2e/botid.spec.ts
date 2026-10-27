import { test, expect, type Page, type Request, type Route } from "@playwright/test";

// Vercel BotID wiring (replaces Cloudflare Turnstile, 2026-10-27): no captcha is ever
// shown; the browser attaches BotID's challenge headers (x-is-human, x-path,
// x-method) to the protected routes of src/lib/botid/routes.ts, and nothing calls
// Supabase's captcha-checked endpoints (/signup, /otp) from the browser any more.
// Our /api routes and Supabase Auth are intercepted: nothing reaches the shared project.
//
//   npm run dev   (port 3013; `next dev` serves BotID's challenge script through the
//                  withBotId rewrites, and checkBotId() always answers "human" there)
//   npx playwright test e2e/botid.spec.ts
//
// Bot path (403) on the real server: BOTID_DEV_BYPASS=BAD-BOT npm run dev, then
//   curl -X POST localhost:3013/api/auth/guest-session → 403 {"error":"bot_detected"}.

const SHOTS = process.env.SHOTS_DIR ?? "test-results/botid";
const IG_IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22G86 Instagram 400.0.0.32.81 (iPhone15,3; iOS 18_6; es_ES; es; scale=3.00; 1290x2796; 0)";

const VIEWPORTS = {
  desktop: { viewport: { width: 1440, height: 900 } },
  instagram: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: IG_IPHONE_UA },
} as const;

function b64url(obj: unknown) {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}
const USER = {
  id: "9f1c2d3e-0000-4000-8000-000000000003",
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
  return { access_token: token, refresh_token: "refresh-mock" };
}

interface Seen {
  path: string;
  method: string;
  botHeaders: boolean;
  body: unknown;
}

function seen(req: Request): Seen {
  const h = req.headers();
  let body: unknown = null;
  try {
    body = req.postDataJSON();
  } catch {
    body = null;
  }
  return {
    path: new URL(req.url()).pathname,
    method: req.method(),
    botHeaders: Boolean(h["x-is-human"]) && h["x-path"] === new URL(req.url()).pathname && Boolean(h["x-method"]),
    body,
  };
}

async function installMocks(page: Page, opts: { otpStatus?: number; otpBody?: unknown } = {}) {
  const auth: string[] = [];
  const api: Seen[] = [];
  await page.route(/\/auth\/v1\//, async (route: Route) => {
    const url = new URL(route.request().url());
    auth.push(url.pathname);
    if (url.pathname.endsWith("/user")) return route.fulfill({ json: USER });
    return route.fulfill({ status: 404, json: { error: "unmocked" } });
  });
  await page.route(/\/api\//, async (route: Route) => {
    const req = route.request();
    const s = seen(req);
    api.push(s);
    if (s.path === "/api/auth/guest-session") return route.fulfill({ json: session() });
    if (s.path === "/api/auth/email-otp") {
      return route.fulfill({ status: opts.otpStatus ?? 200, json: opts.otpBody ?? { ok: true } });
    }
    if (s.path === "/api/characters/prepare") return route.fulfill({ json: { characterPrepId: "prep-123", status: "rendering" } });
    if (s.path === "/api/stories" && s.method === "POST") return route.fulfill({ status: 500, json: { error: "mock_stop" } });
    return route.fulfill({ status: 404, json: { error: "unmocked", path: s.path } });
  });
  return { auth, api };
}

function trackConsole(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));
  return errors;
}

/** Mocked 404/500 answers are expected noise. */
const ownErrors = (errors: string[]) => errors.filter((e) => !/Failed to load resource/.test(e));

for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
  test.describe(vpName, () => {
    test.use(vp);

    test(`email sign-in goes through /api/auth/email-otp with BotID headers [${vpName}]`, async ({ page }) => {
      test.setTimeout(90_000);
      const errors = trackConsole(page);
      const calls = await installMocks(page);
      await page.goto("/es/auth/login");
      await page.getByTestId("auth-email-input").fill("Padre@Example.com ");
      await page.getByRole("button", { name: /Enviar|código/i }).first().click();
      await expect(page.getByTestId("auth-code-step")).toBeVisible({ timeout: 30_000 });

      const otp = calls.api.find((c) => c.path === "/api/auth/email-otp");
      expect(otp?.method).toBe("POST");
      expect(otp?.botHeaders).toBe(true);
      expect(otp?.body).toEqual({ email: "Padre@Example.com", locale: "es", next: "/dashboard" });
      expect(calls.auth.filter((p) => p.endsWith("/otp") || p.endsWith("/signup"))).toEqual([]);
      await expect(page.locator("iframe[src*='challenges.cloudflare.com']")).toHaveCount(0);
      await page.screenshot({ path: `${SHOTS}/login-${vpName}.png` });
      expect(ownErrors(errors)).toEqual([]);
    });

    test(`email sign-in shows the human-check error on a BotID refusal [${vpName}]`, async ({ page }) => {
      test.setTimeout(90_000);
      await installMocks(page, { otpStatus: 403, otpBody: { error_code: "bot_detected" } });
      await page.goto("/es/auth/login");
      await page.getByTestId("auth-email-input").fill("padre@example.com");
      await page.getByRole("button", { name: /Enviar|código/i }).first().click();
      await expect(page.getByTestId("auth-email-step").getByRole("alert")).toContainText("No hemos podido comprobar que eres una persona", {
        timeout: 30_000,
      });
      await page.screenshot({ path: `${SHOTS}/login-bot-${vpName}.png` });
    });

    test(`guest session and character prep carry BotID headers, nothing visible [${vpName}]`, async ({ page }) => {
      test.setTimeout(120_000);
      const errors = trackConsole(page);
      const calls = await installMocks(page);
      await page.goto("/es/create", { waitUntil: "domcontentloaded" });
      await page.evaluate(() => localStorage.clear());
      await page.goto("/es/create", { waitUntil: "domcontentloaded" });
      await page.locator("#child-name").fill("Lucía");
      await page.getByRole("radio", { name: /^6/ }).click();
      await page.getByRole("radio", { name: "Una niña" }).click();
      await page.getByRole("button", { name: /Siguiente/ }).click();
      await expect(page.getByTestId("protagonist-portrait")).toBeVisible();
      await page.getByRole("button", { name: /Siguiente/ }).click(); // → guest session → background character prep

      await expect.poll(() => calls.api.some((c) => c.path === "/api/characters/prepare"), { timeout: 30_000 }).toBe(true);
      const guest = calls.api.find((c) => c.path === "/api/auth/guest-session");
      const prep = calls.api.find((c) => c.path === "/api/characters/prepare");
      expect(guest?.botHeaders).toBe(true);
      expect(prep?.botHeaders).toBe(true);
      // Unprotected routes are left alone by the BotID client.
      expect(calls.api.filter((c) => !c.path.startsWith("/api/auth/") && c.path !== "/api/characters/prepare").every((c) => !c.botHeaders)).toBe(true);
      expect(calls.auth.filter((p) => p.endsWith("/signup") || p.endsWith("/otp"))).toEqual([]);
      await expect(page.getByRole("radio", { name: /Espacial/i }).first()).toBeVisible();
      await page.screenshot({ path: `${SHOTS}/create-${vpName}.png` });
      expect(ownErrors(errors)).toEqual([]);
    });
  });
}
