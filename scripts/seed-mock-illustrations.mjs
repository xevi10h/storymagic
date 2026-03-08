/**
 * One-time script: generate 13 permanent Recraft V3 illustrations for the mock story
 * (cover + 12 scenes) and upload them to Supabase Storage under illustrations/mock/.
 *
 * Then patches src/lib/ai/mock-story.ts with the new permanent URLs so they never
 * need to be regenerated again.
 *
 * Usage:
 *   node scripts/seed-mock-illustrations.mjs
 *
 * Requirements in .env.local:
 *   RECRAFT_API_TOKEN          — Recraft V3 API token
 *   NEXT_PUBLIC_SUPABASE_URL   — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY  — Service role key (bypasses RLS for storage upload)
 */

import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Load .env.local ───────────────────────────────────────────────────────────

function loadEnv() {
  const envPath = path.join(__dirname, "../.env.local");
  const lines = readFileSync(envPath, "utf8").split("\n");
  const env = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    env[key] = val;
  }
  return env;
}

const env = loadEnv();

const RECRAFT_TOKEN = env.RECRAFT_API_TOKEN;
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!RECRAFT_TOKEN || RECRAFT_TOKEN.includes("your_")) {
  console.error("❌  RECRAFT_API_TOKEN not configured in .env.local");
  process.exit(1);
}
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌  NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Character + prompts ───────────────────────────────────────────────────────

// Generic representative child for the mock — reused across all scenes for consistency
const CHAR = "a brave 7-year-old child with short brown hair, light skin tone, wearing a red superhero cape";

const ITEMS = [
  {
    key: "cover",
    prompt: `${CHAR}, triumphant hero pose, arms outstretched, colorful city skyline in background, golden sunset light, wide cinematic composition, children's book cover art, editorial illustration quality, vivid warm colors, no text`,
  },
  {
    key: "scene-1",
    prompt: `${CHAR} standing by a window in a cozy room, looking up at the sky with curiosity, morning sunlight streaming in, warm and peaceful atmosphere. Children's book illustration, soft warm colors, whimsical, gentle lighting`,
  },
  {
    key: "scene-2",
    prompt: `${CHAR} kneeling on a cobblestone street, picking up a glowing red cape, look of wonder, subtle magical sparkles around the cape. Children's book illustration, soft warm colors, whimsical, gentle lighting`,
  },
  {
    key: "scene-3",
    prompt: `${CHAR} standing in the middle of a vibrant city street glowing with magical energy, arms slightly outstretched, amazed expression. Children's book illustration, soft warm colors, whimsical, gentle lighting`,
  },
  {
    key: "scene-4",
    prompt: `${CHAR} looking down at a small brave dog wearing a tiny cape running towards them, in a city park with trees and flowers. Children's book illustration, soft warm colors, whimsical, gentle lighting`,
  },
  {
    key: "scene-5",
    prompt: `${CHAR} standing proudly next to a small brave dog wearing a tiny cape, both looking at the horizon, city skyline in background. Children's book illustration, soft warm colors, whimsical, gentle lighting`,
  },
  {
    key: "scene-6",
    prompt: `${CHAR} and a small brave dog wearing a tiny cape, soaring through the air above the city, discovering hidden rooftop gardens and sparkling fountains below. Children's book illustration, soft warm colors, whimsical, gentle lighting`,
  },
  {
    key: "scene-7",
    prompt: `${CHAR} and a small brave dog wearing a tiny cape, standing in front of a tall old building, looking up at caged birds near the roof, determined heroic pose. Children's book illustration, soft warm colors, whimsical, gentle lighting`,
  },
  {
    key: "scene-8",
    prompt: `${CHAR} sitting on a rooftop next to a brave dog, both watching a beautiful sunset, warm golden glow, peaceful atmosphere. Children's book illustration, soft warm colors, whimsical, gentle lighting`,
  },
  {
    key: "scene-9",
    prompt: `${CHAR} standing in front of a massive dark storm cloud with lightning, brave and determined expression, small dog by their side. Children's book illustration, soft warm colors, whimsical, gentle lighting, hint of drama`,
  },
  {
    key: "scene-10",
    prompt: `${CHAR} shielding their face from strong wind, small brave dog pressing close for comfort, dark looming cloud overhead, worried yet resolute expression. Children's book illustration, soft warm colors, whimsical, gentle lighting, sense of urgency`,
  },
  {
    key: "scene-11",
    prompt: `${CHAR} standing before a dark cloud, speaking to it gently with open arms, warm comforting light radiating outward, cloud beginning to dissolve. Children's book illustration, soft warm colors, whimsical, gentle lighting, sense of resolution`,
  },
  {
    key: "scene-12",
    prompt: `${CHAR} walking through a sunny city street, small dog trotting happily alongside, people cheering from windows, golden sunlight everywhere. Children's book illustration, soft warm colors, whimsical, gentle lighting`,
  },
];

// ── Recraft generation ────────────────────────────────────────────────────────

async function generateImage(prompt, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch("https://external.api.recraft.ai/v1/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RECRAFT_TOKEN}`,
        },
        body: JSON.stringify({
          prompt,
          model: "recraftv3",
          size: "1024x1024",
          n: 1,
          response_format: "url",
          style: "digital_illustration",
          substyle: "child_book",
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Recraft ${res.status}: ${err}`);
      }

      const data = await res.json();
      return data.data[0].url;
    } catch (err) {
      if (attempt < retries) {
        console.log(`  ↻ Retry ${attempt + 1}/${retries}…`);
        await new Promise((r) => setTimeout(r, 3000));
      } else {
        throw err;
      }
    }
  }
}

// ── Supabase upload ───────────────────────────────────────────────────────────

async function uploadToStorage(imageUrl, storagePath) {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") || "image/png";

  const { error } = await supabase.storage
    .from("illustrations")
    .upload(storagePath, buffer, { contentType, upsert: true });

  if (error) throw new Error(`Supabase upload error: ${error.message}`);

  return `${SUPABASE_URL}/storage/v1/object/public/illustrations/${storagePath}`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

const results = {}; // key → permanent URL

for (let i = 0; i < ITEMS.length; i++) {
  const { key, prompt } = ITEMS[i];
  console.log(`\n[${i + 1}/${ITEMS.length}] ${key}`);
  console.log(`  Prompt: ${prompt.slice(0, 80)}…`);

  const tempUrl = await generateImage(prompt);
  console.log("  ✓ Generated");

  const permanentUrl = await uploadToStorage(tempUrl, `mock/${key}.png`);
  console.log(`  ✓ Uploaded → ${permanentUrl}`);

  results[key] = permanentUrl;
}

// ── Patch mock-story.ts ───────────────────────────────────────────────────────

const mockStoryPath = path.join(__dirname, "../src/lib/ai/mock-story.ts");
let content = readFileSync(mockStoryPath, "utf8");

const sceneUrls = [
  results["scene-1"],
  results["scene-2"],
  results["scene-3"],
  results["scene-4"],
  results["scene-5"],
  results["scene-6"],
  results["scene-7"],
  results["scene-8"],
  results["scene-9"],
  results["scene-10"],
  results["scene-11"],
  results["scene-12"],
];

const newBlock = `// Real Recraft V3 illustrations stored in Supabase Storage (public bucket).
// Generated by scripts/seed-mock-illustrations.mjs — all 13 images confirmed accessible.
const MOCK_COVER_URL = "${results["cover"]}";
const MOCK_ILLUSTRATION_URLS = [
${sceneUrls.map((u) => `  "${u}",`).join("\n")}
];`;

// Replace the block from the first comment to the closing ];
content = content.replace(
  /\/\/ Real Recraft.*?const MOCK_ILLUSTRATION_URLS = \[[\s\S]*?\];/,
  newBlock,
);

// Add MOCK_COVER_URL export if getMockCoverUrl doesn't exist yet
if (!content.includes("getMockCoverUrl")) {
  content = content.replace(
    `/** Get mock illustration URL for a given scene index (0-based). */`,
    `/** Get mock cover illustration URL. */\nexport function getMockCoverUrl(): string {\n  return MOCK_COVER_URL;\n}\n\n/** Get mock illustration URL for a given scene index (0-based). */`,
  );
}

writeFileSync(mockStoryPath, content);

console.log(`\n✅ Done! Patched src/lib/ai/mock-story.ts`);
console.log(`   Cover: ${results["cover"]}`);
console.log(`   Scenes 1-12: all uploaded to illustrations/mock/`);
console.log(`\n📌 Next: update generate/route.ts to use getMockCoverUrl() for the cover.`);
