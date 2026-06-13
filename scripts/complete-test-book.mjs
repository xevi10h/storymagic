#!/usr/bin/env node
/**
 * Completes an existing preview story end-to-end via the real /complete route,
 * simulating a purchase (inserts a paid digital order so the guest-path guard passes).
 * Reuses an already-generated preview so we only exercise the remaining scenes + QA loop.
 *
 * Usage: node scripts/complete-test-book.mjs <storyId>
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const OUT = path.join(ROOT, "artifacts", "fullbook");
fs.mkdirSync(OUT, { recursive: true });

const storyId = process.argv[2];
if (!storyId) { console.error("usage: node scripts/complete-test-book.mjs <storyId>"); process.exit(1); }

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: story } = await admin.from("stories").select("user_id, status").eq("id", storyId).single();
  if (!story) { console.error("story not found"); process.exit(1); }
  console.log("story status:", story.status, "user:", story.user_id?.slice(0, 8));

  // Simulate purchase: paid digital order (idempotent-ish — skip if one exists)
  const { data: existing } = await admin.from("orders").select("id").eq("story_id", storyId).eq("status", "paid").limit(1).maybeSingle();
  if (!existing) {
    const { error } = await admin.from("orders").insert({
      story_id: storyId, user_id: story.user_id, format: "digital_pdf", subtotal: 0, total: 0, status: "paid",
    });
    if (error) { console.error("order insert failed:", error.message); process.exit(1); }
    console.log("✓ paid digital order inserted");
  } else console.log("✓ paid order already exists");

  // Disable undici's 300s headers timeout — /complete (8 scenes + QA loop + PDF) runs longer.
  try {
    const { setGlobalDispatcher, Agent } = await import("undici");
    setGlobalDispatcher(new Agent({ headersTimeout: 0, bodyTimeout: 0 }));
  } catch { /* undici not importable — fall back to default + DB poll below */ }

  // Call /complete as guest (paid-order path). Long timeout for real FLUX.2 + QA loop.
  console.log("POST /complete … (real FLUX.2 generation + Gemini QA loop, ~3-5 min)");
  const t0 = Date.now();
  try {
    const res = await fetch(`http://localhost:3013/api/stories/${storyId}/complete`, { method: "POST", signal: AbortSignal.timeout(570000) });
    console.log(`COMPLETE_STATUS: ${res.status} in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    console.log("BODY:", (await res.text()).slice(0, 300));
  } catch (e) {
    console.log(`(client detached after ${((Date.now() - t0) / 1000).toFixed(0)}s: ${e.message}) — server may still be finishing; checking DB…`);
  }

  const { data: st2 } = await admin.from("stories").select("status, cover_image_url, character_portrait_url").eq("id", storyId).single();
  const { data: ills } = await admin.from("story_illustrations").select("scene_number, image_url, status").eq("story_id", storyId).order("scene_number");
  console.log("STORY_STATUS:", st2?.status);
  console.log("ILLUSTRATIONS:", JSON.stringify((ills || []).map((i) => ({ s: i.scene_number, ok: !!i.image_url, st: i.status }))));

  const dl = async (u, name) => {
    if (!u) return;
    try { const r = await fetch(u); if (r.ok) { fs.writeFileSync(path.join(OUT, name), Buffer.from(await r.arrayBuffer())); console.log(`  saved ${name}`); } else console.log(`  HTTP ${r.status} ${name}`); }
    catch (e) { console.log(`  fail ${name}: ${e.message}`); }
  };
  await dl(st2?.character_portrait_url, "avatar.png");
  await dl(st2?.cover_image_url, "cover.png");
  for (const i of ills || []) await dl(i.image_url, `scene-${String(i.scene_number).padStart(2, "0")}.png`);

  const imgs = fs.readdirSync(OUT).filter((f) => f.endsWith(".png")).sort();
  fs.writeFileSync(path.join(OUT, "contact-sheet.html"),
    `<!doctype html><meta charset=utf8><style>body{font-family:system-ui;margin:20px;background:#faf8f5}figure{display:inline-block;text-align:center;margin:4px}img{height:190px;border-radius:6px}</style><h1>Full book ${storyId}</h1>` +
    imgs.map((f) => `<figure><img src="${f}"><figcaption><small>${f}</small></figcaption></figure>`).join(""));

  const ready = (ills || []).filter((i) => i.image_url && i.status === "ready").length;
  console.log("READY_COUNT:", ready, ready >= 10 ? "✅" : "⚠️");
}
main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
