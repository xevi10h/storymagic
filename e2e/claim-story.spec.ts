import { test, expect, type Page, type Route } from "@playwright/test";
import { createStoryClaimToken } from "../src/lib/share/story-claim-token";

// "Continue your book" link (/[locale]/continue/[token]) — every backend call is mocked
// (shared prod Supabase locally): no real guest is minted, no story is moved.
//   npx playwright test e2e/claim-story.spec.ts
// The page verifies the token server-side, so the test signs with the same key as the dev server.

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) process.loadEnvFile(".env.local");

const STORY_ID = "11111111-2222-4333-8444-777777777777";
const b64url = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
const USER = { id: "9f1c2d3e-0000-4000-8000-000000000003", aud: "authenticated", role: "authenticated", is_anonymous: true, app_metadata: { provider: "anonymous" }, user_metadata: {}, created_at: new Date().toISOString() };
const exp = () => Math.floor(Date.now() / 1000) + 86400;
const accessToken = () => `${b64url({ alg: "HS256" })}.${b64url({ sub: USER.id, exp: exp(), role: "authenticated" })}.sig`;
const session = () => ({ access_token: accessToken(), token_type: "bearer", expires_in: 86400, expires_at: exp(), refresh_token: "r", user: USER });
const ART = (f: string) => `/images/path/space/${f}.webp`;

const story = {
  id: STORY_ID,
  status: "preview",
  character_id: "c0ffee00-0000-4000-8000-000000000009",
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
    imagePlan: { bible: "x" },
    scenes: Array.from({ length: 12 }, (_, i) => ({ sceneNumber: i + 1, title: `Escena ${i + 1}`, text: `Texto ${i + 1}.`, imagePrompt: "", type: "scene" })),
  },
  characters: { name: "Lucía", age: 6, gender: "girl", city: null, interests: [], favorite_color: "#E53935", favorite_companion: null, future_dream: null, avatar_url: null, hair_color: null, skin_tone: null, eye_color: null, hairstyle: null },
  story_illustrations: ["space-c1-ship", "space-c2ship-garden", "space-c2ship-bridge"].map((f, i) => ({ scene_number: i + 1, image_url: ART(f), status: "ready" })),
};

async function mockApi(page: Page, claimStatuses: number[]) {
  const calls = { guest: 0, claims: [] as unknown[] };
  await page.route(/\/auth\/v1\//, (route: Route) =>
    route.request().url().includes("/user") ? route.fulfill({ json: USER }) : route.fulfill({ json: session() }),
  );
  await page.route(/\/api\//, async (route: Route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/auth/guest-session") {
      calls.guest++;
      return route.fulfill({ json: { access_token: accessToken(), refresh_token: "r" } });
    }
    if (url.pathname === "/api/stories/claim") {
      calls.claims.push(route.request().postDataJSON());
      const status = claimStatuses.shift() ?? 200;
      if (status !== 200) return route.fulfill({ status, json: { error: status === 410 ? "invalid_link" : "claim_failed" } });
      return route.fulfill({ json: { storyId: STORY_ID, claimed: true } });
    }
    if (url.pathname === `/api/stories/${STORY_ID}`) return route.fulfill({ json: story });
    if (url.pathname === `/api/stories/${STORY_ID}/share`) return route.fulfill({ json: { path: "/es/preview/token" } });
    return route.fulfill({ status: 404, json: { error: "unmocked" } });
  });
  return calls;
}

function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && !/404|Failed to load resource/.test(m.text()) && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  return errors;
}

test("valid link in a fresh browser: guest session, claim, preview with the buy panel", async ({ page }) => {
  const errors = trackErrors(page);
  const calls = await mockApi(page, []);
  const { token } = createStoryClaimToken(STORY_ID, "marta@example.com");
  const res = await page.goto(`/es/continue/${token}`);
  expect(res?.headers()["x-robots-tag"]).toContain("noindex");
  expect(res?.headers()["referrer-policy"]).toBe("no-referrer");
  await page.waitForURL(`**/es/create/${STORY_ID}/preview`);
  await expect(page.getByTestId("checkout-cta")).toBeVisible();
  expect(calls.guest).toBe(1);
  expect(calls.claims).toEqual([{ token }]);
  expect(errors).toEqual([]);
});

test("tampered link: friendly dead end, nothing is called", async ({ page }) => {
  const calls = await mockApi(page, []);
  const { token } = createStoryClaimToken(STORY_ID, "marta@example.com");
  const forged = `${token.slice(0, 10)}${token[10] === "A" ? "B" : "A"}${token.slice(11)}`;
  await page.goto(`/ca/continue/${forged}`);
  await expect(page.getByTestId("claim-invalid")).toContainText("Aquest enllaç ja no funciona");
  await expect(page.getByRole("link", { name: "Crea un conte nou" })).toHaveAttribute("href", "/ca/create");
  await page.waitForTimeout(500);
  expect(calls.guest).toBe(0);
  expect(calls.claims).toHaveLength(0);
});

test("story gone (410): same dead end", async ({ page }) => {
  await mockApi(page, [410]);
  const { token } = createStoryClaimToken(STORY_ID, "marta@example.com");
  await page.goto(`/es/continue/${token}`);
  await expect(page.getByTestId("claim-invalid")).toContainText("Este enlace ya no funciona");
});

test("server hiccup: error with retry, then the preview", async ({ page }) => {
  const calls = await mockApi(page, [503]);
  const { token } = createStoryClaimToken(STORY_ID, "marta@example.com");
  await page.goto(`/en/continue/${token}`);
  await expect(page.getByTestId("claim-error")).toContainText("We couldn't open the book");
  await page.getByRole("button", { name: "Try again" }).click();
  await page.waitForURL(`**/en/create/${STORY_ID}/preview`);
  expect(calls.claims).toHaveLength(2);
});
