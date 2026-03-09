/**
 * One-time script: Generate sample images for each art style using Recraft V3.
 * Uploads results to Supabase Storage (illustrations bucket).
 *
 * Usage: npx tsx scripts/generate-style-samples.ts
 */

import { createClient } from "@supabase/supabase-js";
import { ART_STYLES } from "../src/lib/create-store";

const RECRAFT_API_TOKEN = process.env.RECRAFT_API_TOKEN?.trim();
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!RECRAFT_API_TOKEN || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing env vars. Run with: source .env.local && npx tsx scripts/generate-style-samples.ts");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// A friendly child character prompt — same for all styles so you can compare
const SAMPLE_PROMPT =
  "A cheerful 6-year-old girl with curly brown hair and bright eyes, wearing a cozy sweater, " +
  "sitting under a big magical tree reading a glowing book. Friendly forest animals peek from behind " +
  "the tree. Warm golden afternoon light filtering through the leaves. " +
  "Close-up character portrait composition. " +
  "IMPORTANT: no text, no letters, no words, no titles, no captions, no watermarks anywhere in the image.";

async function generateSample(style: typeof ART_STYLES[number]): Promise<string> {
  const fullPrompt = `${SAMPLE_PROMPT} ${style.promptStyle}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: Record<string, any> = {
    prompt: fullPrompt,
    model: "recraftv3",
    size: "1024x1024",
    n: 1,
    response_format: "url",
  };

  // Use community style UUID
  body.style_id = style.recraftStyleId;

  console.log(`\n[${style.id}] Generating with style_id="${style.recraftStyleId}"...`);

  const res = await fetch("https://external.api.recraft.ai/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RECRAFT_API_TOKEN}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Recraft error for ${style.id}: ${res.status} — ${err}`);
  }

  const data = await res.json();
  const imageUrl: string = data.data[0].url;
  console.log(`[${style.id}] Generated: ${imageUrl.slice(0, 80)}...`);

  // Download the image
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Failed to download image for ${style.id}`);
  const imgBuffer = Buffer.from(await imgRes.arrayBuffer());

  // Upload to Supabase Storage
  const path = `style-samples/${style.id}.webp`;
  const { error: uploadError } = await supabase.storage
    .from("illustrations")
    .upload(path, imgBuffer, {
      contentType: "image/webp",
      upsert: true,
    });

  if (uploadError) throw new Error(`Upload failed for ${style.id}: ${uploadError.message}`);

  // Get public URL
  const { data: urlData } = supabase.storage.from("illustrations").getPublicUrl(path);
  console.log(`[${style.id}] Uploaded: ${urlData.publicUrl}`);

  return urlData.publicUrl;
}

async function main() {
  console.log("Generating art style sample images...\n");
  console.log(`Prompt: "${SAMPLE_PROMPT.slice(0, 100)}..."\n`);

  const results: Record<string, string> = {};

  for (const style of ART_STYLES) {
    try {
      results[style.id] = await generateSample(style);
    } catch (err) {
      console.error(`[${style.id}] FAILED:`, err);
    }
  }

  console.log("\n\n=== RESULTS ===");
  console.log(JSON.stringify(results, null, 2));
  console.log("\nAdd these URLs to ART_STYLES in create-store.ts as 'sampleImageUrl'");
}

main().catch(console.error);
