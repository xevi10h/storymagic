/**
 * Generate cover images for ALL 10 story templates using Recraft V3 API.
 * Uses the SAME illustration style as the actual book pages:
 *   - All ages: digital_illustration / child_book
 *   - Ages 2-4: soft watercolor (Oliver Jeffers + Eric Carle)
 *   - Ages 5-7: warm watercolor with detail (Oliver Jeffers)
 *   - Ages 8-12: editorial cinematic (Jim Kay + Shaun Tan)
 *
 * Saves images to public/images/templates/
 *
 * Usage: node scripts/generate-template-images.mjs [templateId]
 *   If templateId is provided, only that template is regenerated.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, "..", "public", "images", "templates");

const RECRAFT_API_TOKEN = process.env.RECRAFT_API_TOKEN;
if (!RECRAFT_API_TOKEN) {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    const match = envContent.match(/RECRAFT_API_TOKEN=(.+)/);
    if (match) {
      process.env.RECRAFT_API_TOKEN = match[1].trim();
    }
  }
}

const API_TOKEN = process.env.RECRAFT_API_TOKEN;
if (!API_TOKEN) {
  console.error("RECRAFT_API_TOKEN not found");
  process.exit(1);
}

const RECRAFT_URL = "https://external.api.recraft.ai/v1/images/generations";

// Age-based prompt styles — identical to src/lib/ai/story-generator.ts getAgeConfig()
const AGE_STYLES = {
  young:
    "Children's book illustration for toddlers, soft warm watercolor style, big rounded shapes, exaggerated friendly expressions, simple compositions with clear focal point, pastel colors, inspired by Oliver Jeffers and Eric Carle, gentle lighting, no text.",
  mid:
    "Children's book illustration, soft warm watercolor style, rich detailed backgrounds, expressive characters, warm pastel colors, whimsical atmosphere, inspired by Oliver Jeffers, gentle lighting, no text.",
  older:
    "Editorial children's book illustration, detailed cinematic compositions, atmospheric lighting, deeper color palette, rich textures, inspired by Jim Kay and Shaun Tan, immersive world-building, no text.",
};

const TEMPLATES = [
  // ─── 2-4 bucket (toddler/preschool) ───
  {
    id: "chef",
    ageGroup: "young",
    prompt: `A cozy magical kitchen scene: a bubbling pot with friendly vegetables peeking out (a smiling carrot, a waving broccoli), wooden spoons stirring by themselves, flour dust floating like fairy dust, warm oven glow, checkerboard floor, copper pots hanging on the wall. No human characters. ${AGE_STYLES.young}`,
  },
  {
    id: "candy",
    ageGroup: "young",
    prompt: `A magical candy kingdom landscape: rolling hills made of ice cream scoops, a chocolate river with marshmallow stepping stones, lollipop trees with swirly tops, a gingerbread cottage in the distance, cotton candy clouds in a soft pastel sky. No human characters. ${AGE_STYLES.young}`,
  },
  {
    id: "forest",
    ageGroup: "young",
    prompt: `An enchanted forest clearing at golden hour: ancient mossy trees with tiny glowing doors at their bases, fireflies dancing in the warm light, a babbling brook with smooth stones, colorful mushrooms and wildflowers, a friendly owl perched on a branch. No human characters. ${AGE_STYLES.young}`,
  },

  // ─── 5-7 bucket (early readers) ───
  {
    id: "dinosaurs",
    ageGroup: "mid",
    prompt: `A lush prehistoric valley: a gentle triceratops drinking from a crystal-clear lake, pterodactyls soaring through misty mountain peaks, giant ferns and prehistoric flowers, a volcano with a soft glow in the far distance, warm golden sunlight filtering through the canopy. No human characters. ${AGE_STYLES.mid}`,
  },
  {
    id: "safari",
    ageGroup: "mid",
    prompt: `A breathtaking African savanna at golden hour: a majestic baobab tree in the center, a gentle elephant family walking in the foreground, giraffes silhouetted against a spectacular orange-red sunset sky, zebras grazing nearby, tall golden grass swaying. No human characters. ${AGE_STYLES.mid}`,
  },
  {
    id: "pirates",
    ageGroup: "mid",
    prompt: `A colorful pirate ship sailing on turquoise waters at sunset: billowing sails with a friendly flag, a treasure map unrolled on deck, a parrot on the mast, a treasure chest overflowing with gold coins and gems on the bow, tropical islands with palm trees in the background. No human characters. ${AGE_STYLES.mid}`,
  },
  {
    id: "space",
    ageGroup: "mid",
    prompt: `A wondrous outer space scene: a colorful rocket ship flying past a ringed planet, swirling nebulae in deep purples and blues, a friendly crescent moon, twinkling stars of different sizes, a distant Earth glowing blue-green, comets with sparkling tails. No human characters. ${AGE_STYLES.mid}`,
  },

  // ─── 8-12 bucket (confident readers) ───
  {
    id: "castle",
    ageGroup: "older",
    prompt: `A magnificent enchanted castle at twilight: soaring towers with glowing stained-glass windows, a stone bridge over a misty moat, a baby dragon curled on a turret, magical fireflies and floating lanterns, a winding cobblestone path leading to grand wooden doors, ancient ivy climbing the walls. No human characters. ${AGE_STYLES.older}`,
  },
  {
    id: "superhero",
    ageGroup: "older",
    prompt: `A dramatic city skyline at dusk seen from a rooftop: a flowing cape billowing in the wind draped over the edge, city lights beginning to glow, dramatic clouds parting to reveal a beam of light, a cat sitting next to the cape looking out at the city. No human characters. ${AGE_STYLES.older}`,
  },
  {
    id: "inventor",
    ageGroup: "older",
    prompt: `A fantastical inventor's workshop: intricate gears and brass machinery, a half-built flying machine made of umbrellas and bicycle parts, glowing lightbulbs suspended from the ceiling, blueprints and sketches pinned to wooden walls, a mechanical bird mid-flight, warm workshop lamp lighting. No human characters. ${AGE_STYLES.older}`,
  },
];

async function generateImage(template) {
  console.log(
    `Generating "${template.id}" (${template.ageGroup}, child_book)...`,
  );

  const body = {
    prompt: template.prompt,
    model: "recraftv3",
    size: "1024x1024",
    n: 1,
    response_format: "url",
    style: "digital_illustration",
    substyle: "child_book",
  };

  const response = await fetch(RECRAFT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_TOKEN}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Recraft error for ${template.id} (${response.status}): ${errorBody}`,
    );
  }

  const data = await response.json();
  const imageUrl = data.data?.[0]?.url;

  if (!imageUrl) {
    throw new Error(`No image URL returned for ${template.id}`);
  }

  console.log(`  Downloading image from ${imageUrl.slice(0, 60)}...`);
  const imageResponse = await fetch(imageUrl);
  const arrayBuffer = await imageResponse.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const outputPath = path.join(OUTPUT_DIR, `${template.id}.jpg`);
  fs.writeFileSync(outputPath, buffer);
  console.log(
    `  Saved to ${outputPath} (${(buffer.length / 1024).toFixed(0)} KB)`,
  );

  return outputPath;
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const targetId = process.argv[2];
  const targets = targetId
    ? TEMPLATES.filter((t) => t.id === targetId)
    : TEMPLATES;

  if (targetId && targets.length === 0) {
    console.error(`Template "${targetId}" not found. Available: ${TEMPLATES.map((t) => t.id).join(", ")}`);
    process.exit(1);
  }

  console.log(
    `Generating ${targets.length} template image(s) via Recraft V3 (digital_illustration/child_book)...\n`,
  );

  for (const template of targets) {
    try {
      await generateImage(template);
    } catch (err) {
      console.error(`  ERROR: ${err.message}`);
    }
    // Small delay between requests to respect rate limits
    await new Promise((r) => setTimeout(r, 1500));
  }

  console.log("\nDone!");
}

main();
