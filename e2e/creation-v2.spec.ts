import { test, expect, type Page, type Route, type Request } from "@playwright/test";

// Creation flow v2 (6 screens). Every backend call is mocked with page.route:
// the local .env points at the shared Supabase project, so these tests must
// never create users, stories or uploads for real.
//
// Photo tab tests depend on the build-time flag. Run twice:
//   npx playwright test e2e/creation-v2.spec.ts                     (flag off)
//   PHOTO_FLAG=1 npx playwright test e2e/creation-v2.spec.ts -g photo  (server started with
//   NEXT_PUBLIC_PHOTO_UPLOAD_ENABLED=true)

const SHOTS = process.env.SHOTS_DIR ?? "test-results/flow-v2";
const PHOTO_FLAG = process.env.PHOTO_FLAG === "1";
const STORY_ID = "11111111-2222-4333-8444-555555555555";
const NAME = "Lucía Núria l'Olivé";

const VIEWPORTS = {
  desktop: { viewport: { width: 1440, height: 900 } },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
} as const;

const COPY = {
  es: { next: /Siguiente/, create: /Crear su libro/, back: "Atrás", world: /Espacial/i, painting: /Pintando el libro de Lucía/, see: /Ver su libro/ },
  ca: { next: /Següent/, create: /Crear el seu llibre/, back: "Enrere", world: /Espacial/i, painting: /Pintant el llibre de Lucía/, see: /Veure el llibre/ },
} as const;
type Locale = keyof typeof COPY;

// ── Mock backend ──────────────────────────────────────────────────────────────

function b64url(obj: unknown) {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}
const USER = {
  id: "9f1c2d3e-0000-4000-8000-000000000001",
  aud: "authenticated",
  role: "authenticated",
  is_anonymous: true,
  app_metadata: { provider: "anonymous" },
  user_metadata: {},
  created_at: new Date().toISOString(),
};
function session() {
  const exp = Math.floor(Date.now() / 1000) + 3600 * 24;
  const token = `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url({ sub: USER.id, exp, role: "authenticated", is_anonymous: true })}.sig`;
  return { access_token: token, token_type: "bearer", expires_in: 86400, expires_at: exp, refresh_token: "refresh-mock", user: USER };
}

const ART = (f: string) => `/images/path/space/${f}.webp`;
const SCENE_ART = ["space-c1-ship", "space-c2ship-garden", "space-c2ship-bridge", "space-c2ship-engine"].map(ART);
const COVER_ART = ART("space-c1-crystal");

function generatedText() {
  return {
    bookTitle: "Lucía y el jardín de las estrellas",
    titleOptions: ["Lucía y el jardín de las estrellas", "La nave dormida", "Un viaje entre cometas"],
    coverImagePrompt: "",
    dedication: "",
    finalMessage: "Y colorín colorado, este cuento se ha terminado.",
    synopsis: "Una aventura entre estrellas.",
    scenes: Array.from({ length: 12 }, (_, i) => ({
      sceneNumber: i + 1,
      title: `Escena ${i + 1}`,
      text: `Capítulo ${i + 1}. Lucía miró por la ventanilla de la nave y vio un jardín que flotaba entre las estrellas. Respiró hondo y siguió adelante, con el corazón lleno de valor.`,
      imagePrompt: "",
      type: "scene" as const,
    })),
  };
}

interface Mock {
  requests: { method: string; path: string; body: unknown }[];
  lightCalls: number;
  status: string;
  dedication: string | null;
  sender: string | null;
}

async function installMocks(page: Page): Promise<Mock> {
  const mock: Mock = { requests: [], lightCalls: 0, status: "draft", dedication: null, sender: null };

  await page.route(/\/auth\/v1\//, async (route: Route) => {
    const url = route.request().url();
    if (url.includes("/user")) return route.fulfill({ json: USER });
    if (url.includes("/logout")) return route.fulfill({ status: 204, body: "" });
    return route.fulfill({ json: session() });
  });

  // Shape of GET ?light=true (signed): scene `index` is the 1-based scene number,
  // `key`/`coverKey` the stored object path (stable while the signed URL changes).
  const scene = (url: string, i: number) => ({ index: i + 1, url: `${url}?sig=${Date.now()}`, key: `k/${i + 1}` });
  const cover = () => ({ coverUrl: `${COVER_ART}?sig=${Date.now()}`, coverKey: "k/cover" });
  const progressFor = (call: number) => {
    // 1 draft → 2 generating → 3 scene 1 first (before the cover) → 4 cover + 2/4 → 5 cover + 4/4 → 6+ preview
    if (call <= 2) return null;
    if (call === 3) return { scenes: [scene(SCENE_ART[0], 0)], total: 4 };
    if (call === 4) return { ...cover(), scenes: SCENE_ART.slice(0, 2).map(scene), total: 4 };
    return { ...cover(), scenes: SCENE_ART.map(scene), total: 4 };
  };

  await page.route(/\/api\//, async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    let body: unknown = null;
    try {
      body = req.postDataJSON();
    } catch {
      body = req.postData();
    }
    mock.requests.push({ method: req.method(), path: `${path}${url.search}`, body });

    // Read-only landing data (home page) — not part of this flow
    if (path.startsWith("/api/showcase")) return route.continue();
    if (path === "/api/characters/prepare") return route.fulfill({ json: { characterPrepId: "prep-123" } });
    if (path === "/api/characters/photo") {
      if (req.method() === "DELETE") return route.fulfill({ json: { deleted: true } });
      return route.fulfill({ json: { photoPath: `${USER.id}/photo-abc.jpg` } });
    }
    if (path === "/api/stories" && req.method() === "POST") {
      const b = body as { dedication?: string; senderName?: string };
      mock.dedication = b.dedication ?? null;
      mock.sender = b.senderName || null;
      mock.status = "draft";
      mock.lightCalls = 0;
      return route.fulfill({ json: { storyId: STORY_ID, characterId: "c1" } });
    }
    if (path === `/api/stories/${STORY_ID}/generate`) {
      // Long-running like the real route: answers once the preview is done.
      mock.status = "generating";
      for (let i = 0; i < 120 && mock.lightCalls < 6; i++) await new Promise((r) => setTimeout(r, 500));
      return route.fulfill({ json: { status: "preview" } }).catch(() => {});
    }
    if (path === `/api/stories/${STORY_ID}/dedication`) {
      const b = body as { dedication?: string; senderName?: string };
      if (b.dedication !== undefined) mock.dedication = b.dedication;
      if (b.senderName !== undefined) mock.sender = b.senderName;
      return route.fulfill({ json: { dedication: mock.dedication, senderName: mock.sender } });
    }
    if (path === `/api/stories/${STORY_ID}/title`) return route.fulfill({ json: { success: true } });
    if (path === `/api/stories/${STORY_ID}/send-preview`) return route.fulfill({ json: { sent: true } });
    if (path === `/api/stories/${STORY_ID}` && url.searchParams.get("light") === "true") {
      mock.lightCalls += 1;
      const call = mock.lightCalls;
      mock.status = call === 1 ? "draft" : call <= 5 ? "generating" : "preview";
      return route.fulfill({ json: { id: STORY_ID, status: mock.status, title: null, generated_text: null, preview_progress: progressFor(call) } });
    }
    if (path === `/api/stories/${STORY_ID}`) {
      const done = mock.status === "preview";
      return route.fulfill({
        json: {
          id: STORY_ID,
          status: mock.status,
          template_id: "space",
          title: done ? "Lucía y el jardín de las estrellas" : null,
          cover_image_url: done ? COVER_ART : null,
          character_portrait_url: null,
          dedication_text: mock.dedication,
          sender_name: mock.sender,
          generated_text: done ? generatedText() : null,
          characters: {
            name: NAME, age: 6, gender: "girl", city: null, interests: [], favorite_color: "#E53935",
            favorite_companion: null, future_dream: null, avatar_url: null,
            hair_color: "#e6c07b", skin_tone: "#eebb99", eye_color: "#1976d2", hairstyle: "curly",
          },
          story_illustrations: done
            ? SCENE_ART.slice(0, 3).map((image_url, i) => ({ scene_number: i + 1, image_url, status: "ready" }))
            : [],
        },
      });
    }
    return route.fulfill({ status: 404, json: { error: "unmocked", path } });
  });
  return mock;
}

function trackConsole(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("response", (r) => {
    if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`);
  });
  return errors;
}

async function shot(page: Page, name: string) {
  await page.waitForTimeout(350); // let entrance animations settle
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false });
}

async function freshStart(page: Page, locale: Locale) {
  // Not the landing: its showcase images depend on the prod `showcase` bucket (deploy step).
  await page.goto(`/${locale}/crear`);
  await page.evaluate(() => localStorage.clear());
  await page.goto(`/${locale}/crear`);
  await expect(page.getByTestId("live-cover")).toBeVisible();
}

async function fillName(page: Page) {
  await page.locator("#child-name").fill(NAME);
  await expect(page.getByTestId("live-cover-name")).toHaveText(NAME);
}

async function next(page: Page, locale: Locale) {
  await page.getByRole("button", { name: COPY[locale].next }).click();
}

async function chooseAdventure(page: Page, locale: Locale) {
  await page.getByRole("radio", { name: COPY[locale].world }).first().click();
  for (let ch = 1; ch <= 3; ch++) {
    const option = page.locator(`section[aria-labelledby="adv-ch-${ch}"] [role=radio]`).first();
    await option.waitFor({ state: "visible", timeout: 15000 });
    await option.click();
    await expect(option).toHaveAttribute("aria-checked", "true");
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
  for (const locale of ["es", "ca"] as Locale[]) {
    test.describe(`${locale} ${vpName}`, () => {
      test.use(vp);

      test(`happy path to the painting screen [${locale} ${vpName}]`, async ({ page }) => {
        test.skip(PHOTO_FLAG, "flag-off suite");
        test.setTimeout(120_000);
        const errors = trackConsole(page);
        const mock = await installMocks(page);
        const tag = `${locale}-${vpName}`;

        // 1 — Name: live cover
        await freshStart(page, locale);
        await shot(page, `${tag}-1-name-empty`);
        await fillName(page);
        // Keystroke → cover update latency
        const latency = await page.evaluate(async () => {
          const input = document.querySelector<HTMLInputElement>("#child-name")!;
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
          const t0 = performance.now();
          setter.call(input, input.value + "a");
          input.dispatchEvent(new Event("input", { bubbles: true }));
          const target = document.querySelector('[data-testid="live-cover-name"]')!;
          while (!target.textContent?.endsWith("a")) await new Promise((r) => requestAnimationFrame(r));
          const dt = performance.now() - t0;
          setter.call(input, input.value.slice(0, -1));
          input.dispatchEvent(new Event("input", { bubbles: true }));
          return dt;
        });
        expect(latency).toBeLessThan(100);
        await expect(page.getByTestId("live-cover-name")).toHaveText(NAME);
        await expect(page.getByRole("radio", { name: /^1 / })).toHaveCount(0); // ages 2–12 only
        await page.getByRole("radio", { name: /^6/ }).click();
        await page.getByRole("radio", { name: locale === "es" ? "Una niña" : "Una nena" }).click();
        await shot(page, `${tag}-1-name-filled`);
        await next(page, locale);

        // 2 — Protagonist: trait swaps are instant, client-side (only pre-rendered avatar images, no API/doc)
        const portrait = page.getByTestId("protagonist-portrait");
        await expect(portrait).toBeVisible();
        await expect(page.getByRole("tab")).toHaveCount(0); // photo flag off
        const before = await portrait.innerHTML();
        const netDuringTraits: string[] = [];
        const onReq = (r: Request) => {
          if (["fetch", "xhr", "image", "document"].includes(r.resourceType())) netDuringTraits.push(r.url());
        };
        page.on("request", onReq);
        await page.locator('[aria-labelledby="lbl-skin"]').getByRole("radio").nth(3).click();
        await page.locator('[aria-labelledby="lbl-glasses"]').getByRole("radio").nth(1).click();
        await page.getByRole("switch").click();
        await page.locator('[aria-labelledby="lbl-hairstyle"]').getByRole("radio").nth(1).click();
        await page.waitForTimeout(300);
        page.off("request", onReq);
        expect(netDuringTraits.filter((u) => !new URL(u).pathname.startsWith("/images/avatar/"))).toEqual([]);
        expect(await portrait.innerHTML()).not.toEqual(before);
        // Real pre-rendered matrix, not the vector fallback
        await expect(portrait.locator('img[src*="/images/avatar/"]').first()).toBeVisible();
        await expect(portrait.locator("svg")).toHaveCount(0);
        // Colour choices carry names: accessible + visible under the row
        await expect(page.getByTestId("selected-skin")).toHaveText(/\S/);
        await expect(page.getByTestId("selected-glasses-frame")).toHaveText(/\S/);
        await expect(page.locator('[aria-labelledby="lbl-eyes"] [role=radio]:not([aria-label])')).toHaveCount(0);
        await shot(page, `${tag}-2-protagonist`);
        if (vpName === "mobile") {
          // the portrait stays in view while scrolling the traits
          await page.mouse.wheel(0, 600);
          await page.waitForTimeout(300);
          await expect(portrait).toBeInViewport();
          await shot(page, `${tag}-2-protagonist-scrolled`);
        }
        await next(page, locale);

        // Character prep fired in the background
        await expect.poll(() => mock.requests.some((r) => r.path === "/api/characters/prepare")).toBe(true);
        const prep = mock.requests.find((r) => r.path === "/api/characters/prepare")!.body as Record<string, unknown>;
        expect(prep.glasses).toBe("round-dark");
        expect(prep.freckles).toBe(true);
        expect(prep.photoPath).toBeUndefined();
        // Face anchor = the matrix base of the chosen traits (girl, age 6 → small band)
        expect(String(prep.avatarAssetPath)).toMatch(/^\/images\/avatar\/girl\/small\/dark\/[a-z-]+\.webp$/);

        // 3 — Adventure: world + 3 chapters on one screen
        await expect(page.getByRole("button", { name: COPY[locale].create })).toBeDisabled();
        await shot(page, `${tag}-3-adventure-empty`);
        await chooseAdventure(page, locale);
        await expect(page.getByTestId("live-cover").filter({ visible: true }).first()).toBeVisible();
        await page.waitForTimeout(900); // let the smooth scroll to the last chapter finish
        await shot(page, `${tag}-3-adventure-done-bottom`);
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
        await shot(page, `${tag}-3-adventure-done-top`);
        await page.getByRole("button", { name: COPY[locale].create }).click();

        // Story POST carries the pre-filled dedication (verbatim template with the name) + prep id
        await page.waitForURL(new RegExp(`/${locale}/crear/${STORY_ID}/generar`));
        const post = mock.requests.find((r) => r.path === "/api/stories")!.body as Record<string, unknown>;
        expect(post.characterPrepId).toBe("prep-123");
        // The prep is only reused when the Bible matches: both bodies carry the same look.
        const look = ["gender", "age", "skinTone", "hairColor", "eyeColor", "hairstyle", "favoriteColor", "glasses", "freckles"];
        const storyChar = post.character as Record<string, unknown>;
        for (const k of look) expect(storyChar[k], k).toEqual(prep[k]);
        expect(post.avatarAssetPath ?? null).toEqual(prep.avatarAssetPath ?? null);
        expect(String(post.dedication)).toMatch(locale === "es" ? /^Para ti, Lucía: / : /^Per a tu, Lucía: /);
        expect((post.decisions as { treePath: unknown[] }).treePath).toHaveLength(3);

        // 4 — Painting: real progress, cover first, then scenes
        await expect(page.getByRole("heading", { name: COPY[locale].painting })).toBeVisible();
        await shot(page, `${tag}-4-painting-start`);
        // Scene 1 lands before the cover: it dresses the hero meanwhile
        await expect(page.getByTestId("progress-cover").locator(`img[src*="space-c1-ship"]`)).toBeVisible({ timeout: 15_000 });
        await shot(page, `${tag}-4-painting-first-scene`);
        await expect(page.getByTestId("progress-cover").locator(`img[src*="space-c1-crystal"]`)).toBeVisible({ timeout: 15_000 });
        await expect(page.getByTestId("progress-scenes").locator("[data-slot=cover] img")).toBeVisible();
        await shot(page, `${tag}-4-painting-cover`);
        await expect(page.getByTestId("progress-scenes").locator("[data-slot=scene] img")).toHaveCount(2, { timeout: 15_000 });
        // Fresh signatures on every poll must not swap the <img> already shown
        const firstSrc = await page.getByTestId("progress-scenes").locator("[data-slot=scene] img").first().getAttribute("src");
        await expect(page.getByTestId("progress-scenes").locator("[data-slot=scene] img")).toHaveCount(4, { timeout: 15_000 });
        await expect(page.getByTestId("progress-scenes").locator("[data-slot=scene] img").first()).toHaveAttribute("src", firstSrc!);
        await shot(page, `${tag}-4-painting-scenes`);

        // Dedication: pre-filled, live on the page mock, counter, saved verbatim
        const textarea = page.locator("textarea");
        // Default dedication: first name only, no emoji
        await expect(textarea).toHaveValue(/Lucía/);
        await expect(textarea).not.toHaveValue(/Núria|✨/);
        const custom = "Per a tu, Lucía:\nque mai deixis de somiar.";
        await textarea.fill(custom);
        await expect(page.getByTestId("dedication-page")).toContainText("que mai deixis de somiar");
        await expect(page.getByTestId("dedication-counter")).toHaveText(`${custom.length}/500`);
        // Sender is never pre-filled (single parents, grandparents…): only a placeholder
        await expect(page.locator('input[type="text"]').last()).toHaveValue("");
        await expect(page.getByTestId("dedication-page")).not.toContainText(/mam|papa|àvi|abuel/i);
        await page.locator('input[type="text"]').last().fill("L'àvia Carme");
        await expect.poll(() => mock.dedication).toBe(custom);
        await expect.poll(() => mock.sender).toBe("L'àvia Carme");
        await shot(page, `${tag}-4-dedication`);

        // Ready → open the book
        await expect(page.getByRole("button", { name: COPY[locale].see }).last()).toBeEnabled({ timeout: 20_000 });
        await shot(page, `${tag}-4-ready`);
        await page.getByRole("button", { name: COPY[locale].see }).last().click();
        await page.waitForURL(new RegExp(`/crear/${STORY_ID}/preview`));

        // 5 — The book + checklist
        await expect(page.getByTestId("chip-dedication")).toBeVisible({ timeout: 20_000 });
        await page.waitForTimeout(3500); // one-shot reveal overlay
        await shot(page, `${tag}-5-book`);
        await page.getByTestId("chip-dedication").click();
        await expect(page.getByRole("dialog")).toBeVisible();
        await expect(page.getByRole("dialog").locator("textarea")).toHaveValue(custom);
        await shot(page, `${tag}-5-dedication-sheet`);
        await page.keyboard.press("Escape");
        await page.getByTestId("chip-cover").click();
        await shot(page, `${tag}-5-cover-sheet`);
        await page.keyboard.press("Escape");

        // 6 — Format + payment (VAT next to every price), optional email after the wow
        await page.locator("#checkout-section").scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
        await shot(page, `${tag}-6-format`);
        const checkoutText = await page.locator("#checkout-section").innerText();
        expect(checkoutText).toMatch(locale === "es" ? /IVA incl/ : /IVA incl/);
        await page.getByTestId("send-preview").locator("input").fill("familia@example.com");
        await page.getByTestId("send-preview").getByRole("button").click();
        await expect(page.getByTestId("send-preview-sent")).toBeVisible();
        await page.getByTestId("send-preview-sent").scrollIntoViewIfNeeded();
        await shot(page, `${tag}-6-email-sent`);

        expect(errors).toEqual([]);
      });
    });
  }
}

test.describe("avatar matrix", () => {
  const combos = [
    { name: "girl4-glasses-freckles", age: 4, gender: "Una niña", skin: 0, glasses: 1, frame: 1, freckles: true, eyes: 3 },
    { name: "girl10-darkskin", age: 10, gender: "Una niña", skin: 4, glasses: 0, frame: -1, freckles: false, eyes: 2 },
    { name: "boy4-square", age: 4, gender: "Un niño", skin: 2, glasses: 2, frame: 0, freckles: false, eyes: 0 },
    { name: "boy10-darkskin-freckles-glasses", age: 10, gender: "Un niño", skin: 3, glasses: 1, frame: 0, freckles: true, eyes: 4 },
  ];
  for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
    test(`trait combos render the real matrix without layout shift [${vpName}]`, async ({ browser }) => {
      test.skip(PHOTO_FLAG, "flag-off suite");
      test.setTimeout(120_000);
      const errors: string[] = [];
      for (const c of combos) {
        // Fresh context per combo: a clean draft, and a cold image cache like a new visitor.
        const context = await browser.newContext(vp);
        const page = await context.newPage();
        const pageErrors = trackConsole(page);
        await installMocks(page);
        await freshStart(page, "es");
        await fillName(page);
        await page.getByRole("radio", { name: new RegExp(`^${c.age}\\b`) }).click();
        await page.getByRole("radio", { name: c.gender }).click();
        await next(page, "es");
        const portrait = page.getByTestId("protagonist-portrait");
        await expect(portrait.locator('img[src*="/images/avatar/"]').first()).toBeVisible();
        // Layout shift = size of the portrait or document position of the controls changing
        // (the portrait itself is sticky, so its viewport y legitimately moves with scroll).
        const docY = () => page.locator('[aria-labelledby="lbl-glasses"]').evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
        await page.waitForTimeout(700); // screen entrance animation settles first
        const box0 = await portrait.boundingBox();
        const y0 = await docY();
        await page.locator('[aria-labelledby="lbl-skin"]').getByRole("radio").nth(c.skin).click();
        await page.locator('[aria-labelledby="lbl-eyes"]').getByRole("radio").nth(c.eyes).click();
        await page.locator('[aria-labelledby="lbl-glasses"]').getByRole("radio").nth(c.glasses).click();
        if (c.frame >= 0) await page.getByRole("radiogroup", { name: /montura/i }).getByRole("radio").nth(c.frame).click();
        if (c.freckles) await page.getByRole("switch").click();
        await page.waitForTimeout(400);
        const box1 = await portrait.boundingBox();
        expect(Math.abs(box1!.width - box0!.width)).toBeLessThan(1);
        expect(Math.abs(box1!.height - box0!.height)).toBeLessThan(1);
        if (c.glasses === 0) expect(Math.abs((await docY()) - y0)).toBeLessThan(1); // (frame row appears only with glasses)
        const band = c.age <= 6 ? "small" : "big";
        await expect(portrait.locator(`img[src*="/${band}/"]`).first()).toBeVisible();
        if (c.glasses > 0) await expect(portrait.locator('img[src*="glasses-"]')).toHaveCount(1);
        if (c.freckles) await expect(portrait.locator('img[src*="freckles"]')).toHaveCount(1);
        await expect(portrait.locator("svg")).toHaveCount(0);
        await shot(page, `avatar-${vpName}-${c.name}`);
        errors.push(...pageErrors);
        await context.close();
      }
      expect(errors).toEqual([]);
    });
  }
});

test.describe("state", () => {
  test.use(VIEWPORTS.mobile);

  test("Back from every screen keeps state, and reload keeps it", async ({ page }) => {
    test.skip(PHOTO_FLAG, "flag-off suite");
    test.setTimeout(90_000);
    const errors = trackConsole(page);
    const mock = await installMocks(page);
    await freshStart(page, "es");
    await fillName(page);
    await page.getByRole("radio", { name: /^8/ }).click();
    await next(page, "es");
    await page.locator('[aria-labelledby="lbl-glasses"]').getByRole("radio").nth(2).click();
    await next(page, "es");
    await chooseAdventure(page, "es");

    // Reload on screen 3: everything restored
    await page.reload();
    await expect(page.locator(`section[aria-labelledby="adv-ch-3"] [role=radio][aria-checked=true]`)).toHaveCount(1);
    await expect(page.getByRole("button", { name: /Crear su libro/ })).toBeEnabled();

    // 3 → 2 → 1 with the header back arrow
    await page.getByRole("button", { name: "Atrás" }).first().click();
    await expect(page.locator('[aria-labelledby="lbl-glasses"]').getByRole("radio").nth(2)).toHaveAttribute("aria-checked", "true");
    await page.getByRole("button", { name: "Atrás" }).first().click();
    await expect(page.locator("#child-name")).toHaveValue(NAME);
    await expect(page.getByRole("radio", { name: /^8/ })).toHaveAttribute("aria-checked", "true");

    // Forward again: choices intact
    await next(page, "es");
    await next(page, "es");
    await expect(page.locator(`[role=radio][aria-checked=true]`)).toHaveCount(4); // world + 3 chapters

    // 3 → 4, then Back from 4 returns to 3 with choices, and re-create reuses the same story
    await page.getByRole("button", { name: /Crear su libro/ }).click();
    await page.waitForURL(/\/generar/);
    await expect(page.locator("textarea")).toBeVisible();
    await page.getByRole("button", { name: "Atrás" }).last().click();
    await page.waitForURL(/\/es\/crear$/);
    await expect(page.locator(`[role=radio][aria-checked=true]`)).toHaveCount(4);
    const postsBefore = mock.requests.filter((r) => r.path === "/api/stories").length;
    await page.getByRole("button", { name: /Crear su libro/ }).click();
    await page.waitForURL(/\/generar/);
    expect(mock.requests.filter((r) => r.path === "/api/stories").length).toBe(postsBefore);
    expect(errors).toEqual([]);
  });

  test("an old v1 draft migrates gracefully", async ({ page }) => {
    test.skip(PHOTO_FLAG, "flag-off suite");
    await installMocks(page);
    await page.goto("/ca/crear");
    await page.evaluate(() =>
      localStorage.setItem(
        "meapica_create_state",
        JSON.stringify({
          currentStep: 3,
          mode: "solo",
          character: { name: "Àlex", age: 7, gender: "boy", hairColor: "#2a2a2a", eyeColor: "#5d4037", skinTone: "#d4a574", hairstyle: "short", interests: ["space"], city: "", favoriteColor: "#E53935", favoriteCompanion: "", futureDream: "" },
          portraitUrl: "https://example.com/p.png",
          recraftStyleId: null,
          portraitCharacterSnapshot: null,
          selectedTemplate: "forest",
          decisions: {},
          dedication: "Per a l'Àlex",
          senderName: "",
          ending: null,
          endingNote: "",
        }),
      ),
    );
    await page.goto("/ca/crear");
    await expect(page.getByRole("heading", { name: /Quina aventura viurà Àlex/ })).toBeVisible();
    // Catalan elision on the cover: "L'aventura d'Àlex"
    await expect(page.getByTestId("live-cover").first()).toHaveAttribute("aria-label", /L'aventura d'Àlex/);
  });
});

test.describe("en/fr smoke", () => {
  for (const locale of ["en", "fr"] as const) {
    test(`screens 1–3 render with no missing messages [${locale}]`, async ({ page }) => {
      test.skip(PHOTO_FLAG, "flag-off suite");
      const errors = trackConsole(page);
      await installMocks(page);
      // Not the landing: its showcase images depend on the prod `showcase` bucket (deploy step).
      await page.goto(`/${locale}/crear`);
      await page.evaluate(() => localStorage.clear());
      await page.goto(`/${locale}/crear`);
      await fillName(page);
      await page.getByRole("button", { name: locale === "en" ? /^Next$/ : /^Suivant$/ }).click();
      await expect(page.getByTestId("protagonist-portrait")).toBeVisible();
      await page.getByRole("button", { name: locale === "en" ? /^Next$/ : /^Suivant$/ }).click();
      await page.getByRole("radio").first().click();
      await expect(page.locator('section[aria-labelledby="adv-ch-1"]')).toBeVisible({ timeout: 15000 });
      expect(errors).toEqual([]);
    });
  }
});

test.describe("photo tab", () => {
  test.use(VIEWPORTS.mobile);

  test("photo tab hidden when the flag is off", async ({ page }) => {
    test.skip(PHOTO_FLAG, "needs the flag off");
    await installMocks(page);
    await freshStart(page, "es");
    await fillName(page);
    await next(page, "es");
    await expect(page.getByTestId("protagonist-portrait")).toBeVisible();
    await expect(page.getByRole("tab")).toHaveCount(0);
    await expect(page.getByText(/Sube una foto/)).toHaveCount(0);
  });

  test("photo tab visible and consent-gated when the flag is on", async ({ page }) => {
    test.skip(!PHOTO_FLAG, "needs NEXT_PUBLIC_PHOTO_UPLOAD_ENABLED=true");
    const errors = trackConsole(page);
    const mock = await installMocks(page);
    await freshStart(page, "es");
    await fillName(page);
    await next(page, "es");
    await page.getByRole("tab", { name: /Sube una foto/ }).click();
    const choose = page.getByRole("button", { name: /Elegir una foto/ });
    await expect(choose).toBeDisabled();
    await expect(page.getByRole("checkbox")).not.toBeChecked();
    await expect(page.getByRole("button", { name: /Siguiente/ })).toBeDisabled();
    await shot(page, "es-mobile-2-photo-consent");
    await page.getByRole("checkbox").check();
    await expect(choose).toBeEnabled();

    // Upload: client re-encodes to JPEG and posts field "photo"
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAIAAADTED8xAAAAPUlEQVR42u3BAQ0AAADCoPdPbQ8HFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPwZgAAB4JYwmgAAAABJRU5ErkJggg==",
      "base64",
    );
    await page.getByTestId("photo-input").setInputFiles({ name: "nena.png", mimeType: "image/png", buffer: png });
    await expect(page.getByTestId("photo-uploaded")).toBeVisible();
    const upload = mock.requests.find((r) => r.path === "/api/characters/photo" && r.method === "POST");
    expect(String(upload?.body)).toContain('name="photo"');
    expect(String(upload?.body)).toContain("2026-09-27");
    await shot(page, "es-mobile-2-photo-uploaded");
    await expect(page.getByRole("button", { name: /Siguiente/ })).toBeEnabled();

    // Next → the early child sheet is prepared from the private photo (no avatar asset)
    await next(page, "es");
    await expect.poll(() => mock.requests.some((r) => r.path === "/api/characters/prepare")).toBe(true);
    const prep = mock.requests.find((r) => r.path === "/api/characters/prepare")!.body as Record<string, unknown>;
    expect(prep.photoPath).toBe(`${USER.id}/photo-abc.jpg`);
    expect(prep.avatarAssetPath).toBeUndefined();
    await page.getByRole("button", { name: "Atrás" }).first().click();
    await expect(page.getByTestId("photo-uploaded")).toBeVisible();

    // Withdraw → DELETE, consent reset
    await page.getByRole("button", { name: /Quitar la foto/ }).click();
    await expect.poll(() => mock.requests.some((r) => r.path === "/api/characters/photo" && r.method === "DELETE")).toBe(true);
    await expect(page.getByRole("checkbox")).not.toBeChecked();
    expect(errors).toEqual([]);
  });
});
