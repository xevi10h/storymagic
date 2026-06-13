import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

for (const line of fs.readFileSync(path.resolve("./.env.local"), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const OUT = path.resolve("./artifacts/fullbook");
fs.mkdirSync(OUT, { recursive: true });

test("FLUX.2 visual-bible full book end-to-end", async ({ page }) => {
  test.setTimeout(900000);
  const errs: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });

  // robust click: wait (long, for real AI between steps), dump buttons on failure
  const click = async (re: RegExp, timeout = 90000) => {
    const b = page.locator("button:visible", { hasText: re }).first();
    try {
      await b.waitFor({ state: "visible", timeout });
      await b.click();
    } catch {
      const btns = await page.locator("button:visible").allInnerTexts();
      console.log(`CLICK_FAIL ${re} — visible buttons:`, JSON.stringify(btns.slice(0, 30)));
      throw new Error(`button not found: ${re}`);
    }
  };

  // ── 1. Create flow → preview (avatar now via FLUX.2, then book generate) ──
  await page.goto("/es/crear", { waitUntil: "networkidle" });
  await page.getByPlaceholder(/Ej:/i).first().fill("Bruno");
  await click(/siguiente/i);
  // portrait (FLUX.2) generates here (~20-30s) before the adventure step appears
  await click(/elegir aventura/i, 120000);
  await click(/espacial|espac/i);
  await click(/nave dormida/i);
  await click(/jardín interior|jardin interior/i);
  await click(/regarla|agua de cometa/i);
  await click(/continuar/i);
  // ending radios are sr-only (controlled by their label) — click the label, not the input
  await page.locator('input[name="ending"]').first().waitFor({ state: "attached", timeout: 15000 });
  const endingLabel = page.locator('label:has(input[name="ending"])').first();
  if (await endingLabel.count()) await endingLabel.click();
  else await page.locator('input[name="ending"]').first().click({ force: true });
  await page.waitForTimeout(500);
  await page.locator("button:visible", { hasText: /crear|finalizar|generar|continuar/i }).last().click();

  // book preview generation (real FLUX.2): allow up to 4 min
  await page.waitForURL(/\/crear\/.+\/preview/, { timeout: 240000 });
  const storyId = page.url().match(/\/crear\/([0-9a-f-]{36})\/preview/)?.[1];
  console.log("STORY_ID:", storyId);
  expect(storyId).toBeTruthy();
  await page.screenshot({ path: path.join(OUT, "preview.png"), fullPage: true });

  // ── 2. Complete the rest of the book (same authed anon session) ──
  console.log("POST /complete …");
  const comp = await page.request.post(`/api/stories/${storyId}/complete`, { timeout: 300000 });
  console.log("COMPLETE_STATUS:", comp.status());

  // ── 3. Pull whole book from Supabase + download every image ──
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: story } = await admin.from("stories").select("status, cover_image_url, character_portrait_url, generated_text").eq("id", storyId).single();
  const { data: ills } = await admin.from("story_illustrations").select("scene_number, image_url, status").eq("story_id", storyId).order("scene_number");
  console.log("STORY_STATUS:", story?.status);
  console.log("ILLUSTRATIONS:", JSON.stringify((ills || []).map((i) => ({ s: i.scene_number, ok: !!i.image_url, st: i.status }))));
  const tree = (story?.generated_text as any)?.fluxAssetTree?.assets?.map((a: any) => `${a.id}(${a.type})`);
  console.log("VISUAL_BIBLE:", JSON.stringify(tree));

  const dl = async (u: string | null | undefined, name: string) => {
    if (!u) return;
    try { const r = await fetch(u); if (r.ok) { fs.writeFileSync(path.join(OUT, name), Buffer.from(await r.arrayBuffer())); console.log(`  saved ${name}`); } else console.log(`  HTTP ${r.status} ${name}`); }
    catch (e) { console.log(`  fail ${name}: ${(e as Error).message}`); }
  };
  await dl(story?.character_portrait_url, "avatar.png");
  await dl(story?.cover_image_url, "cover.png");
  for (const i of ills || []) await dl(i.image_url, `scene-${String(i.scene_number).padStart(2, "0")}.png`);

  const imgs = fs.readdirSync(OUT).filter((f) => f.endsWith(".png")).sort();
  fs.writeFileSync(path.join(OUT, "contact-sheet.html"),
    `<!doctype html><meta charset=utf8><style>body{font-family:system-ui;margin:20px;background:#faf8f5}figure{display:inline-block;text-align:center;margin:4px}img{height:190px;border-radius:6px}</style><h1>Full book ${storyId}</h1>` +
    imgs.map((f) => `<figure><img src="${f}"><figcaption><small>${f}</small></figcaption></figure>`).join(""));

  console.log("ERRORS:", JSON.stringify(errs.slice(0, 8)));
  const ready = (ills || []).filter((i) => i.image_url && i.status === "ready").length;
  console.log("READY_COUNT:", ready);
  expect(ready).toBeGreaterThanOrEqual(10);
});
