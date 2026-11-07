/**
 * Photo-mode validation with SYNTHETIC children only (never a real child's photo):
 *
 *   1. generate an AI photo of a fictional child (gpt-image, text only, no reference)
 *   2. normalizeChildPhoto (same EXIF strip / re-encode as POST /api/characters/photo)
 *   3. photo-mode child sheet: renderChildSheet(prepBible(confirmed traits), "preview",
 *      { avatar: null, photo }) — exactly what POST /api/characters/prepare renders
 *   4. avatar-mode child sheet for the same traits (matrix asset) — the cost baseline
 *   5. one scene-like render anchored on the photo sheet — is the child recognisable,
 *      and what does the sheet cost as the final book's face anchor (finalFaceAnchor)
 *
 * No database, no storage, nothing persisted outside --out. Prints the usage/cost
 * of every call (OpenAI `usage`, priced in src/lib/ai/openai-image.ts).
 *
 *   npx tsx --tsconfig tsconfig.json scripts/photo-mode-spike.mts --out=/abs/dir [--only=a|b]
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, join } from "path";

for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
process.env.MOCK_MODE = "false";

const { generateOpenAIImage } = await import("../src/lib/ai/openai-image.ts");
const { renderChildSheet, loadAvatarReference, stageConfig } = await import("../src/lib/ai/book-images.ts");
const { prepBible } = await import("../src/lib/ai/character-prep.ts");
const { normalizeChildPhoto } = await import("../src/lib/privacy/child-photo.ts");
const { avatarAssetPathFor } = await import("../src/lib/creation-flow.ts");
const { INITIAL_STATE } = await import("../src/lib/create-store.ts");
const { WATERCOLOR_STYLE } = await import("../src/lib/ai/style.ts");

const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
const out = arg("out");
if (!out || !out.startsWith("/")) throw new Error("--out=/absolute/dir is required (keep synthetic images out of the repo)");
mkdirSync(out, { recursive: true });

type Usage = { input_tokens?: number; input_tokens_details?: { text_tokens?: number; image_tokens?: number }; output_tokens?: number };
const rows: { child: string; call: string; model: string; quality: string; size: string; imageIn: number; textIn: number; out: number; usd: number; s: number }[] = [];
function log(child: string, call: string, r: { model: string; quality: string; size: string; usage: Usage; costUsd: number; ms: number }) {
  rows.push({
    child, call, model: r.model, quality: r.quality, size: r.size,
    imageIn: r.usage.input_tokens_details?.image_tokens ?? 0,
    textIn: r.usage.input_tokens_details?.text_tokens ?? 0,
    out: r.usage.output_tokens ?? 0,
    usd: r.costUsd, s: Math.round(r.ms / 1000),
  });
}

// Fictional children. The traits are what the parent would confirm after uploading.
const CHILDREN = {
  a: {
    prompt:
      "Candid smartphone photo of a fictional 6-year-old girl with deep brown skin, short black curly hair and dark brown eyes, " +
      "smiling, wearing a plain yellow t-shirt, sitting at a kitchen table in soft daylight, head and shoulders, looking at the camera. " +
      "Photorealistic, natural colours, slightly imperfect phone snapshot.",
    character: { gender: "girl" as const, age: 6, skinTone: "#523218", hairColor: "#2a2a2a", hairstyle: "curly", eyeColor: "#5d4037", glasses: "none" as const, freckles: false },
  },
  b: {
    prompt:
      "Candid smartphone photo of a fictional 8-year-old boy with fair skin, freckles, straight chestnut-brown hair and blue eyes, " +
      "wearing round dark-framed glasses and a green hoodie, in a park on a cloudy day, head and shoulders, looking at the camera. " +
      "Photorealistic, natural colours, slightly imperfect phone snapshot.",
    character: { gender: "boy" as const, age: 8, skinTone: "#fce4d6", hairColor: "#8d6e63", hairstyle: "short", eyeColor: "#1976d2", glasses: "round-dark" as const, freckles: true },
  },
};

const only = arg("only");
for (const [id, c] of Object.entries(CHILDREN)) {
  if (only && only !== id) continue;
  const character = { ...INITIAL_STATE.character, ...c.character, name: id === "a" ? "Aina" : "Biel" };
  const look = {
    gender: character.gender, age: character.age, skinTone: character.skinTone, hairColor: character.hairColor,
    eyeColor: character.eyeColor, hairstyle: character.hairstyle, favoriteColor: "", glasses: character.glasses, freckles: character.freckles,
  };

  // 1. synthetic photo (not a product cost)
  const synth = await generateOpenAIImage({ model: stageConfig("preview").model, quality: "medium", size: "1024x1536", prompt: c.prompt, label: `spike ${id} synthetic photo` });
  log(id, "synthetic photo (test only)", synth);
  writeFileSync(join(out, `${id}-1-synthetic-photo.jpg`), synth.image);

  // 2. the upload route's normalization
  const norm = await normalizeChildPhoto(synth.image);
  writeFileSync(join(out, `${id}-2-normalized.jpg`), norm.data);
  const photo = { data: norm.data, mime: "image/jpeg" };

  // 3. photo-mode prep sheet (what the prepare route renders)
  const bible = prepBible(look);
  writeFileSync(join(out, `${id}-bible.txt`), bible.description);
  try {
    const sheet = await renderChildSheet(bible, "preview", { avatar: null, photo }, { label: `spike ${id} photo` });
    log(id, "child sheet, photo mode", sheet);
    writeFileSync(join(out, `${id}-3-sheet-photo.jpg`), sheet.image);

    // 5. scene anchored on the photo sheet (as the book's scenes and the final anchor use it)
    const scene = await generateOpenAIImage({
      model: stageConfig("preview").model,
      quality: "medium",
      size: "1536x1024",
      prompt:
        "The FIRST attached image is the character model sheet of THE CHILD: the single source of truth for how THE CHILD looks. " +
        `Children's book illustration: THE CHILD (${bible.description}) explores an enchanted forest at dusk, holding a small glowing lantern, ` +
        `full body, three-quarter view, facing a friendly fox. ${WATERCOLOR_STYLE}`,
      references: [{ data: sheet.image, mime: sheet.mime }],
      label: `spike ${id} scene from photo sheet`,
    });
    log(id, "scene anchored on photo sheet", scene);
    writeFileSync(join(out, `${id}-5-scene.jpg`), scene.image);
  } catch (err) {
    console.error(`[spike ${id}] photo-mode render FAILED:`, err instanceof Error ? `${err.name}: ${err.message}` : err);
    rows.push({ child: id, call: `FAILED: ${err instanceof Error ? err.message.slice(0, 120) : String(err)}`, model: "", quality: "", size: "", imageIn: 0, textIn: 0, out: 0, usd: 0, s: 0 });
  }

  // 4. avatar-mode baseline for the same traits
  const assetPath = avatarAssetPathFor(character);
  const avatar = await loadAvatarReference(assetPath);
  if (avatar) {
    const base = await renderChildSheet(bible, "preview", { avatar }, { label: `spike ${id} avatar` });
    log(id, `child sheet, avatar mode (${assetPath})`, base);
    writeFileSync(join(out, `${id}-4-sheet-avatar.jpg`), base.image);
  } else {
    console.warn(`[spike ${id}] no matrix avatar for these traits (${assetPath})`);
  }
}

console.table(rows);
writeFileSync(join(out, "usage.json"), JSON.stringify(rows, null, 2));
console.log(`total spend $${rows.reduce((s, r) => s + r.usd, 0).toFixed(3)} · images in ${out}`);
