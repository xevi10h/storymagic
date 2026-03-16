#!/usr/bin/env npx tsx
/**
 * Creates a pre-baked Recraft portrait style from reference images.
 *
 * Usage:
 *   1. First, generate sample portraits you like (run the app, create characters).
 *   2. Save the portrait image URLs.
 *   3. Run this script with those URLs:
 *
 *      npx tsx scripts/create-portrait-style.ts <url1> [url2] [url3] [url4] [url5]
 *
 *   4. Copy the output style_id to your .env:
 *
 *      RECRAFT_PORTRAIT_STYLE_ID=<the-uuid>
 *
 *   5. All future portraits will use this style for visual consistency.
 *
 * The script creates a Recraft style with base_style "digital_illustration"
 * using the provided images as visual references. Recraft supports 1-5 images.
 */

const RECRAFT_BASE = "https://external.api.recraft.ai/v1";
const RECRAFT_STYLES_URL = `${RECRAFT_BASE}/styles`;

async function main() {
  const apiToken = process.env.RECRAFT_API_TOKEN?.trim();
  if (!apiToken) {
    console.error("Error: RECRAFT_API_TOKEN environment variable is required.");
    console.error("Set it in your .env or .env.local file.");
    process.exit(1);
  }

  const imageUrls = process.argv.slice(2);
  if (imageUrls.length === 0) {
    console.error("Usage: npx tsx scripts/create-portrait-style.ts <url1> [url2] [url3] [url4] [url5]");
    console.error("");
    console.error("Pass 1-5 portrait image URLs that represent the art style you want.");
    console.error("Tip: Generate a few portraits in the app first, then copy their URLs from the browser.");
    process.exit(1);
  }

  if (imageUrls.length > 5) {
    console.error("Error: Recraft supports maximum 5 reference images per style.");
    process.exit(1);
  }

  console.log(`Creating portrait style from ${imageUrls.length} reference image(s)...`);

  // Download all images
  const formData = new FormData();
  formData.append("style", "digital_illustration");

  for (let i = 0; i < imageUrls.length; i++) {
    const url = imageUrls[i];
    console.log(`  Downloading image ${i + 1}: ${url.slice(0, 80)}...`);

    const response = await fetch(url);
    if (!response.ok) {
      console.error(`  Error: Failed to download image ${i + 1} (HTTP ${response.status})`);
      process.exit(1);
    }

    const blob = await response.blob();
    formData.append("file", blob, `reference_${i + 1}.png`);
  }

  console.log("  Uploading to Recraft...");

  const response = await fetch(RECRAFT_STYLES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`Error: Recraft style creation failed (HTTP ${response.status}):`);
    console.error(errorBody);
    process.exit(1);
  }

  const data = await response.json();
  const styleId = data.id;

  if (!styleId) {
    console.error("Error: Recraft returned no style ID.");
    console.error("Response:", JSON.stringify(data, null, 2));
    process.exit(1);
  }

  console.log("");
  console.log("═══════════════════════════════════════════");
  console.log("  Style created successfully!");
  console.log("═══════════════════════════════════════════");
  console.log("");
  console.log(`  Style ID: ${styleId}`);
  console.log("");
  console.log("  Add this to your .env / .env.local:");
  console.log("");
  console.log(`  RECRAFT_PORTRAIT_STYLE_ID=${styleId}`);
  console.log("");
  console.log("  All future portraits will use this style.");
  console.log("═══════════════════════════════════════════");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
