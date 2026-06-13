#!/usr/bin/env node
/**
 * Batch-generates the pre-rendered card art for the "El Camino" story trees.
 *
 * For each option card in src/lib/story-trees/{space,forest}.ts it calls the
 * BFL FLUX.2 API directly (flux-2-flex, 3:2 → 1408×960), downscales with sharp
 * to 720×480 webp, and saves to public/images/path/{template}/{imageSeed}.webp.
 * Finally rescans ALL template directories under public/images/path/ and writes
 * src/lib/story-trees/art-manifest.ts with every valid (>10KB) webp found, so
 * the manifest is idempotent across partial runs.
 *
 * IMPORTANT: the prompts deliberately depict ONLY the object/creature/place of
 * each option — never a child/protagonist (the hero is generated per user later).
 *
 * Usage:
 *   node scripts/generate-path-art.mjs                  # generate missing + rewrite manifest
 *   node scripts/generate-path-art.mjs --manifest-only  # skip generation, just rescan + rewrite manifest
 * Reads BFL_API_KEY from .env.local. Ignores MOCK_MODE on purpose (real generation).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PATH_ART_ROOT = path.join(ROOT, "public", "images", "path");
const MANIFEST_PATH = path.join(ROOT, "src", "lib", "story-trees", "art-manifest.ts");
const MIN_VALID_SIZE = 10 * 1024; // webp smaller than this is considered a failed/partial output

const MANIFEST_ONLY = process.argv.includes("--manifest-only");

// ── env loader (same pattern as scripts/benchmark-illustrations.mjs) ─────────
function loadEnv() {
  for (const f of [".env.local", ".env"]) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (process.env[m[1]] === undefined) process.env[m[1]] = v;
    }
  }
}
loadEnv();

const BFL_KEY = process.env.BFL_API_KEY || "";
if (!BFL_KEY && !MANIFEST_ONLY) {
  console.error("FATAL: BFL_API_KEY not found in .env.local");
  process.exit(1);
}

const MODEL = "flux-2-flex";
const WIDTH = 1408; // 3:2, multiples of 32 (matches ASPECT_TO_DIMS in src/lib/ai/flux2.ts)
const HEIGHT = 960;
const FINAL_W = 720;
const FINAL_H = 480;
const CONCURRENCY = 4;
const MAX_ATTEMPTS = 3; // 1 try + 2 retries
const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ITERATIONS = 90;

// Verbatim copy of WATERCOLOR_STYLE_SUFFIX from src/lib/ai/style.ts
const WATERCOLOR_STYLE_SUFFIX =
  " Traditional hand-painted children's book watercolor illustration: loose wet-on-wet washes with soft bleeding edges, " +
  "visible cold-press watercolor paper grain, granulating pigment, gentle gouache highlights, delicate ink linework, " +
  "muted warm storybook palette (Studio Ghibli meets Beatrix Potter meets Quentin Blake). " +
  "Painterly and analog, NOT digital, NOT vector, NOT 3D render, NOT glossy, NOT a photograph. " +
  "Full bleed edge-to-edge. No borders, no white edges, no text, no signature, no watermark, no branded logos.";

// Reinforce the "no protagonist" rule on every prompt.
const NO_CHILD = " No people, no children, no human characters anywhere in the image.";

// ── Option cards from src/lib/story-trees/{space,forest}.ts ──────────────────
// English scene prompts derived from the desc/narrative of each option.
// They show only the object/creature/place of the choice — never the child hero.
const OPTIONS = [
  // c1 — what does the rocket fly toward first?
  { template: "space", seed: "space-c1-robot", prompt: "A small friendly silver robot floating all alone in deep space among twinkling stars, its round eyes blinking with a soft hopeful light as if asking for help, a distant colorful nebula glowing behind it." },
  { template: "space", seed: "space-c1-crystal", prompt: "A magical multicolored crystal gently pulsing with soft rainbow light on the surface of a small rocky asteroid drifting through starry space." },
  { template: "space", seed: "space-c1-ship", prompt: "An enormous gentle spaceship floating silently in dark starry space with all its lights off, as if peacefully asleep, faint starlight outlining its rounded hull." },

  // c2_robot — where to search for Tin's energy screw?
  { template: "space", seed: "space-c2robot-factory", prompt: "An old floating space factory slowly spinning among the stars, brimming with shiny gears, cogs and glittering screws, warm golden light glowing from its round windows." },
  { template: "space", seed: "space-c2robot-comet", prompt: "A swift comet streaking across a deep blue starry sky, leaving behind a sparkling tail of bright golden sparks that look like tiny lost machine pieces." },
  { template: "space", seed: "space-c2robot-moon", prompt: "A small grey scrap-metal moon covered with gentle mountains of old machine parts, gears and antique pieces glinting softly under the starlight." },

  // c2_crystal — how to give the crystal its shine back?
  { template: "space", seed: "space-c2crystal-star", prompt: "A big kind star with a gentle smiling face glowing warmly in space, radiating soft golden light as if happy to share it, wisps of cosmic clouds around it." },
  { template: "space", seed: "space-c2crystal-rainbow", prompt: "A glowing cosmic rainbow bridge of seven colors arching gracefully across the starry darkness of space between soft clouds of shimmering stardust." },
  { template: "space", seed: "space-c2crystal-song", prompt: "A sad translucent crystal resting on an asteroid, surrounded by glowing musical notes floating toward it through the starry darkness, its facets just beginning to shimmer awake." },

  // c2_ship — how to wake the sleeping ship?
  { template: "space", seed: "space-c2ship-bridge", prompt: "The dim quiet command bridge of a gentle spaceship, with one big softly glowing power button in the middle of a console of sleeping controls, starlight pouring through the wide round window." },
  { template: "space", seed: "space-c2ship-engine", prompt: "The engine room deep inside a spaceship: a big round sleeping engine shaped like a gentle heart, cold and quiet in soft blue shadows, a little ladder leading down to it." },
  { template: "space", seed: "space-c2ship-garden", prompt: "A hidden indoor garden inside a spaceship, full of magical plants glowing softly in the half-dark, bioluminescent leaves and flowers lighting up a quiet greenhouse dome with stars beyond the glass." },

  // c3_robot_a — finding the right screw in the floating factory
  { template: "space", seed: "space-c3robota-magnet", prompt: "A giant friendly red horseshoe magnet inside a floating space factory attracting one shiny golden screw that flies sparkling through the air toward it, gears and bolts drifting around." },
  { template: "space", seed: "space-c3robota-listen", prompt: "A tiny golden screw hidden among many quiet grey machine parts, glowing faintly and humming like a little bee, with gentle visible ripples of soft sound in the air around it." },
  { template: "space", seed: "space-c3robota-helper", prompt: "Kind friendly factory machines with gentle glowing faces leaning in together to offer one shiny golden screw on a little tray, warm workshop light, cogs and tools all around." },

  // c3_robot_b — catching the comet spark
  { template: "space", seed: "space-c3robotb-net", prompt: "A glowing net woven from threads of starlight floating wide open in dark space, catching one bright golden spark from the sparkling tail of a passing comet." },
  { template: "space", seed: "space-c3robotb-race", prompt: "A small cheerful red rocket racing at full speed alongside a bright comet through the starry sky, golden sparks flying from the comet's glowing tail, motion and joy." },
  { template: "space", seed: "space-c3robotb-wish", prompt: "A single bright golden spark drifting down slowly and gently through the starry darkness, glowing warmly like a granted wish, leaving a delicate trail of soft light." },

  // c3_robot_c — searching the scrap moon
  { template: "space", seed: "space-c3robotc-dig", prompt: "A gentle golden glow shining out from beneath carefully stacked old machine parts on a grey scrap moon, pieces set aside in tidy little piles, a sky full of stars above." },
  { template: "space", seed: "space-c3robotc-friend", prompt: "A tiny cheerful green alien with big happy eyes standing on a grey scrap moon, proudly pointing at one perfect shiny screw among soft mountains of old machine parts." },
  { template: "space", seed: "space-c3robotc-build", prompt: "A brand-new shiny screw being assembled from small spare parts on a little workbench on a scrap moon, tiny tools, bolts and pieces neatly arranged around it under the stars." },

  // c3_crystal_a — carrying the star's light to the crystal
  { template: "space", seed: "space-c3crystala-jar", prompt: "A small magical glass jar holding a glowing piece of warm starlight that flickers like a firefly, softly illuminating the dark starry space around it." },
  { template: "space", seed: "space-c3crystala-ray", prompt: "A kind smiling star gently blowing one thin soft ray of golden light across the darkness toward a waiting rainbow crystal resting on an asteroid." },
  { template: "space", seed: "space-c3crystala-carry", prompt: "A small warm sphere of gentle golden starlight floating delicately through dark space like a tiny tame sun, leaving a trail of soft sparkles behind it." },

  // c3_crystal_b — collecting the rainbow's colors
  { template: "space", seed: "space-c3crystalb-brush", prompt: "A paintbrush dipped in liquid rainbow colors painting bright glowing stripes onto a large faceted crystal, drops of luminous paint floating weightlessly in space." },
  { template: "space", seed: "space-c3crystalb-slide", prompt: "A cosmic rainbow curving down through the stars like a giant joyful slide, its seven glowing bands of color streaming with little sparkles of light." },
  { template: "space", seed: "space-c3crystalb-bottles", prompt: "Seven little glass bottles floating in a row in space, each filled with a different glowing rainbow color, gently pouring ribbons of colored light toward a crystal below." },

  // c3_crystal_c — adding magic to the song
  { template: "space", seed: "space-c3crystalc-clap", prompt: "A large rainbow crystal pulsing brightly to a joyful rhythm, surrounded by concentric rings of light and floating musical notes, beating like a happy drum among the stars." },
  { template: "space", seed: "space-c3crystalc-friends", prompt: "A choir of small smiling moons gathered in a circle around a glowing crystal in space, singing together with rosy cheeks, musical notes floating between them." },
  { template: "space", seed: "space-c3crystalc-dance", prompt: "Ribbons of colorful light swirling and dancing in joyful spirals around a glowing rainbow crystal, twinkling stars all around, full of movement and happiness." },

  // c3_ship_a — which control to press on the bridge
  { template: "space", seed: "space-c3shipa-blue", prompt: "A big round glowing blue button softly pulsing on a spaceship control panel in a dim cozy command bridge, gentle and inviting, like it wants to be pressed." },
  { template: "space", seed: "space-c3shipa-lever", prompt: "A great shiny lever on a spaceship bridge with rows and rows of colorful lights bursting on around it, the whole control room waking up in a warm joyful glow." },
  { template: "space", seed: "space-c3shipa-map", prompt: "A glowing screen on a spaceship bridge showing a beautiful map of stars with a sparkling golden path traced between them, soft blue light filling the dim room." },

  // c3_ship_b — warming the cold engine heart
  { template: "space", seed: "space-c3shipb-stardust", prompt: "Glittering stardust sprinkling down onto a big round spaceship engine shaped like a heart, which begins to glow warm orange as it wakes, little embers of light dancing." },
  { template: "space", seed: "space-c3shipb-hug", prompt: "A big round spaceship engine shaped like a gentle heart glowing warmer and warmer, wrapped in a soft rosy loving glow, tiny hearts of light floating around it." },
  { template: "space", seed: "space-c3shipb-sunray", prompt: "A single warm ray of light from a small friendly smiling sun travelling down a spaceship corridor toward a cold engine, turning everything it touches soft and golden." },

  // c3_ship_c — reviving the sleeping plant
  { template: "space", seed: "space-c3shipc-water", prompt: "A little glass watering can pouring sparkling drops of glowing comet-water onto a sleepy luminous plant whose leaves are opening happily, inside a spaceship's glowing indoor garden." },
  { template: "space", seed: "space-c3shipc-whisper", prompt: "A sleepy glowing plant in a spaceship garden leaning toward tiny floating sparkles of whispered sweet words, its leaves slowly waking and beginning to shine." },
  { template: "space", seed: "space-c3shipc-light", prompt: "A small star-shaped lantern bathing a sleeping luminous plant in warm tender light inside a spaceship garden, the plant lifting its glowing leaves toward it." },

  // ════════ FOREST (El Bosque Mágico) ════════
  // c1 — what does {name} explore first in the Magic Forest?
  { template: "forest", seed: "forest-c1-dragon", prompt: "A small green dragon curled up fast asleep under the oldest mossy tree of a magical forest, snoring tiny puffs of glittering smoke, soft dappled sunlight falling through the leaves." },
  { template: "forest", seed: "forest-c1-chest", prompt: "An ancient wooden chest covered in soft moss and tiny wildflowers glowing with warm golden light, nestled between the great gnarled roots of a forest tree." },
  { template: "forest", seed: "forest-c1-door", prompt: "A little rounded wooden door glowing softly all by itself between two tall trees in a magical forest, fireflies drifting around it, ferns and red-capped mushrooms at its feet." },

  // c2_dragon — where to look for a new spark for Brasa the dragon?
  { template: "forest", seed: "forest-c2dragon-fireflies", prompt: "A twilight meadow at the edge of a magical forest where hundreds of fireflies dance over the tall grass like tiny living sparks, a soft purple evening sky above." },
  { template: "forest", seed: "forest-c2dragon-sunflower", prompt: "A giant golden flower deep in a magical forest holding a glowing little sunbeam safe between its enormous petals, warm light spilling gently onto the leaves around it." },
  { template: "forest", seed: "forest-c2dragon-cave", prompt: "A hidden cave inside a forest mountain glowing with warm colourful crystals in rose, amber and turquoise, their soft cozy light dancing on the stone walls." },

  // c2_chest — where to search for the flower key?
  { template: "forest", seed: "forest-c2chest-squirrels", prompt: "A cozy squirrels' nest high in a great forest tree, filled with tidy little piles of shiny treasures, acorns and sparkling trinkets, two cheerful squirrels guarding them proudly." },
  { template: "forest", seed: "forest-c2chest-stream", prompt: "A clear singing stream winding through a sunlit magical forest, something small and golden glittering at the bottom of the water among smooth round pebbles." },
  { template: "forest", seed: "forest-c2chest-hollow", prompt: "The cozy inside of a great hollow tree with a tiny golden key hanging from a twig very high up, soft light streaming through a hole in the trunk, little mushrooms dotting the walls." },

  // c2_door — where to start saving the fading Whispering Garden?
  { template: "forest", seed: "forest-c2door-tree", prompt: "A great rainbow tree in an enchanted garden whose colourful leaves have all turned grey and sad, one last leaf still holding a faint shimmer of colour, soft misty light around it." },
  { template: "forest", seed: "forest-c2door-fountain", prompt: "A beautiful old stone fountain in an enchanted garden that once poured water of every colour, now dry and silent, faded rainbow traces on its basin and drooping flowers around it." },
  { template: "forest", seed: "forest-c2door-pond", prompt: "A still quiet pond in an enchanted garden at dusk, tiny sleeping stars glowing faintly at the bottom of the dark water like drowsy fireflies, water lilies floating above them." },

  // c3_dragon_a — convincing the shy fireflies to gift a spark
  { template: "forest", seed: "forest-c3dragona-dance", prompt: "Hundreds of fireflies swirling in a joyful spiral dance above a twilight meadow, one bright little spark drifting down toward the nose of a small happy green dragon." },
  { template: "forest", seed: "forest-c3dragona-song", prompt: "A cloud of fireflies floating dreamily closer through the soft evening air of a meadow as if lulled by a sweet lullaby, gathering like a tiny constellation around a small green dragon." },
  { template: "forest", seed: "forest-c3dragona-berries", prompt: "A little heap of sweet red berries laid out on a big green leaf in a twilight meadow, grateful fireflies gathering around it and lighting a glowing spark for a small green dragon." },

  // c3_dragon_b — waking the sleeping Sun Flower gently
  { template: "forest", seed: "forest-c3dragonb-dew", prompt: "Fresh dewdrops sparkling as they fall onto a giant sleeping golden flower, its petals just beginning to open with a warm glow, soft morning light in a magical forest." },
  { template: "forest", seed: "forest-c3dragonb-song", prompt: "A giant Sun Flower opening its petals wide like a tiny sunrise deep in a magical forest, glowing musical notes floating in the air around it, golden light spilling everywhere." },
  { template: "forest", seed: "forest-c3dragonb-leaf", prompt: "A soft green leaf gently tickling the tall stem of a giant golden flower that is waking up mid-giggle, its petals fluttering open with little bursts of warm light." },

  // c3_dragon_c — finding the one warm fire crystal in the cave
  { template: "forest", seed: "forest-c3dragonc-listen", prompt: "One small crystal among hundreds in a dim cave glowing warm orange and humming softly like a happy fireplace, gentle visible ripples of sound in the air around it." },
  { template: "forest", seed: "forest-c3dragonc-warmth", prompt: "A dim crystal cave where one crystal glows with a sweet warm amber light among many cool blue ones, soft shimmering waves of warmth rising from it into the air." },
  { template: "forest", seed: "forest-c3dragonc-echo", prompt: "A magical cave full of colourful crystals where a friendly echo travels as gentle glowing ripples of sound bouncing from wall to wall, all pointing toward one bright fire crystal." },

  // c3_chest_a — getting the flower key from the squirrels
  { template: "forest", seed: "forest-c3chesta-trade", prompt: "A handful of golden hazelnuts laid out on a tree stump in front of two delighted squirrels, one of them holding out a tiny golden key shaped like a flower, warm forest light." },
  { template: "forest", seed: "forest-c3chesta-hide", prompt: "Cheerful squirrels peeking out from behind big red-capped mushrooms in a sunny forest clearing, playing hide-and-seek, a little flower-shaped key shining on a stump as the prize." },
  { template: "forest", seed: "forest-c3chesta-pantry", prompt: "A squirrels' autumn pantry inside a tree trunk with acorns and nuts neatly sorted into tidy little piles, grateful squirrels offering a small golden flower-shaped key." },

  // c3_chest_b — reaching the key at the bottom of the stream
  { template: "forest", seed: "forest-c3chestb-stones", prompt: "A little path of flat stepping stones laid one by one across a clear singing forest stream, leading toward a golden flower-shaped key shining underwater in the middle." },
  { template: "forest", seed: "forest-c3chestb-frog", prompt: "A cheerful green frog leaping out of a clear forest stream with a joyful splash, proudly holding up a golden flower-shaped key in its little front feet." },
  { template: "forest", seed: "forest-c3chestb-rod", prompt: "A tiny fishing rod made from a twig and a long flower stem dangling over a clear forest stream, gently lifting a golden flower-shaped key out of the sparkling water." },

  // c3_chest_c — reaching the key at the top of the hollow tree
  { template: "forest", seed: "forest-c3chestc-climb", prompt: "The tall trunk of an old hollow tree whose rough bark forms perfect little steps spiraling upward toward a tiny golden key hanging from the highest twig, soft forest light." },
  { template: "forest", seed: "forest-c3chestc-woodpecker", prompt: "A friendly woodpecker flying down through the inside of a great hollow tree carrying a small golden flower-shaped key in its beak, soft light streaming through the trunk." },
  { template: "forest", seed: "forest-c3chestc-stairs", prompt: "A spiral staircase of sturdy round mushrooms growing up the trunk of a great hollow tree, leading all the way to a golden key hanging from a twig at the very top." },

  // c3_door_a — helping the rainbow tree remember its colours
  { template: "forest", seed: "forest-c3doora-petals", prompt: "A paintbrush made of soft flower petals colouring the grey leaves of a great rainbow tree, each touched leaf blooming back into bright glowing colour in an enchanted garden." },
  { template: "forest", seed: "forest-c3doora-hug", prompt: "A little deer made of glowing light nuzzling the trunk of a great rainbow tree as its grey leaves remember their colours one by one, soft sparkles drifting down like confetti." },
  { template: "forest", seed: "forest-c3doora-dew", prompt: "Seven dewdrops, each glowing a different colour of the rainbow, falling gently onto the roots of a grey tree that is bursting back into bloom with a thousand colours." },

  // c3_door_b — helping the fountain of colours flow again
  { template: "forest", seed: "forest-c3doorb-leaves", prompt: "A gentle breeze lifting a pile of golden autumn leaves off a hidden garden spring as the first jets of rainbow-coloured water bubble joyfully back up into an old stone fountain." },
  { template: "forest", seed: "forest-c3doorb-cloud", prompt: "A friendly little rain cloud with rosy cheeks hovering over a stone fountain in an enchanted garden, sprinkling soft silver rain until the fountain flows with water of every colour." },
  { template: "forest", seed: "forest-c3doorb-song", prompt: "A little deer made of glowing light standing beside an old stone fountain, glowing musical notes floating in the air as the fountain wakes up dancing with little jets of every colour." },

  // c3_door_c — waking the sleeping stars in the pond
  { template: "forest", seed: "forest-c3doorc-petals", prompt: "Soft flower petals floating down onto a quiet garden pond, drawing gentle glowing ripples that reach the tiny sleeping stars shimmering awake at the bottom of the water." },
  { template: "forest", seed: "forest-c3doorc-whistle", prompt: "Tiny glowing stars rising from the bottom of a dark garden pond and dancing up to the surface, while a nightingale sings on a moonlit branch above the water." },
  { template: "forest", seed: "forest-c3doorc-moonbeam", prompt: "A single silver moonbeam dipping into a dark garden pond like a glowing ribbon, reaching the tiny stars at the bottom, which wake and rise filling the night garden with light." },

  // Hand-crafted entries for options whose desc mentions the child (auto-prompt
  // would either fail to parse the {name} braces or depict the protagonist).
  { template: "dinosaurs", seed: "dinosaurs-c3eggc-fly", prompt: "A gentle young pterosaur with wide friendly wings soaring over a prehistoric valley of giant ferns and winding rivers, scanning the green horizon below for a dinosaur family, warm golden sky." },
  { template: "pirates", seed: "pirates-c3dolphinc-race", prompt: "A cheerful dolphin leaping joyfully along the shoreline of a tropical beach in a friendly race, splashing turquoise water, a glowing pearl waiting on a rock at the finish, palm trees leaning over the sand." },
  { template: "pirates", seed: "pirates-c3islandc-game", prompt: "A friendly octopus on a tropical island playfully covering its eyes with two tentacles while pointing toward a glowing lantern half-buried in the warm sand, a game of hot-and-cold among seashells and starfish." },
];

// ── auto-prompts for trees without hand-crafted entries ───────────────────────
// Newer trees (dinosaurs, pirates, …) compose their prompt from the option's
// English title + desc, which are already child-free scene descriptions.
// Hand-crafted entries above always win; this only fills the gaps.
const AUTO_PROMPT_TREES = [
  "dinosaurs",
  "pirates",
  "superhero",
  "chef",
  "castle",
  "safari",
  "inventor",
  "candy",
];

function autoPromptOptions() {
  const have = new Set(OPTIONS.map((o) => o.seed));
  const out = [];
  for (const template of AUTO_PROMPT_TREES) {
    const src = fs.readFileSync(
      path.join(ROOT, "src", "lib", "story-trees", `${template}.ts`),
      "utf8",
    );
    // Each option block: imageSeed "…" preceded by title{en:…} and desc{en:…}.
    const blocks = src.split(/imageSeed:\s*"/).slice(1);
    let prev = src.slice(0, src.indexOf('imageSeed: "'));
    for (const block of blocks) {
      const seed = block.slice(0, block.indexOf('"'));
      const titleEn = prev.match(/title:\s*{[^}]*en:\s*"((?:[^"\\]|\\.)*)"[^}]*}\s*,\s*desc:/s)?.[1];
      const descEn = prev.match(/desc:\s*{[^}]*en:\s*"((?:[^"\\]|\\.)*)"[^}]*}\s*,\s*$/s)?.[1];
      prev = block;
      if (have.has(seed)) continue;
      if (!titleEn || !descEn) {
        console.warn(`auto-prompt: could not extract en title/desc for ${seed} — skipped`);
        continue;
      }
      out.push({
        template,
        seed,
        prompt: `A charming children's storybook scene — ${titleEn.replace(/\\"/g, '"')}: ${descEn.replace(/\\"/g, '"')} Wide establishing view, rich environment detail.`,
      });
    }
  }
  return out;
}
OPTIONS.push(...autoPromptOptions());

// ── helpers ───────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── FLUX.2 submit + poll (same pattern as src/lib/ai/flux2.ts) ────────────────
async function fluxGenerate(prompt) {
  const endpoints = [`https://api.bfl.ai/v1/${MODEL}`, `https://api.bfl.ai/v1/${MODEL}-preview`];
  let submit = null;
  let lastErr = "";
  for (const ep of endpoints) {
    const res = await fetch(ep, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-key": BFL_KEY },
      body: JSON.stringify({
        prompt,
        width: WIDTH,
        height: HEIGHT,
        output_format: "png",
        safety_tolerance: 4,
      }),
    });
    if (res.ok) { submit = await res.json(); break; }
    const errText = await res.text();
    if (errText.includes("insufficient") || errText.includes("credits")) {
      throw new Error(`NO CREDITS — top up at dashboard.bfl.ai. Error: ${errText}`);
    }
    lastErr = `BFL API ${res.status}: ${errText}`;
    if (res.status !== 404) throw new Error(lastErr); // only fall through on 404
  }
  if (!submit) throw new Error(lastErr || "FLUX.2 submit failed");

  const pollUrl = submit.polling_url || `https://api.bfl.ai/v1/get_result?id=${submit.id}`;
  let cost = submit.cost ?? null;

  for (let i = 0; i < MAX_POLL_ITERATIONS; i++) {
    await sleep(POLL_INTERVAL_MS);
    const pollRes = await fetch(pollUrl, { headers: { "x-key": BFL_KEY } });
    const pollData = await pollRes.json();
    if (pollData.cost != null) cost = pollData.cost;
    if (pollData.status === "Ready" && pollData.result?.sample) {
      const imgRes = await fetch(pollData.result.sample);
      if (!imgRes.ok) throw new Error(`image download ${imgRes.status}`);
      return { buffer: Buffer.from(await imgRes.arrayBuffer()), cost };
    }
    if (pollData.status === "Error" || pollData.status === "Request Moderated" || pollData.status === "Failed") {
      throw new Error(`FLUX.2 generation failed: ${JSON.stringify(pollData)}`);
    }
  }
  throw new Error(`Timeout after ${(MAX_POLL_ITERATIONS * POLL_INTERVAL_MS) / 1000}s polling FLUX.2`);
}

async function generateOne(opt, index) {
  const tag = `[${String(index + 1).padStart(2, "0")}/${OPTIONS.length}] ${opt.seed}`;
  const fullPrompt = opt.prompt + NO_CHILD + WATERCOLOR_STYLE_SUFFIX;
  const dest = path.join(PATH_ART_ROOT, opt.template, `${opt.seed}.webp`);

  // Resumable: skip seeds that already have a valid output from a prior run.
  if (fs.existsSync(dest) && fs.statSync(dest).size > MIN_VALID_SIZE) {
    console.log(`${tag} ✓ already exists, skipping`);
    return { ok: true, seed: opt.seed, cost: 0 };
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const t0 = Date.now();
    try {
      const { buffer, cost } = await fluxGenerate(fullPrompt);
      await sharp(buffer)
        .resize(FINAL_W, FINAL_H, { fit: "cover" })
        .webp({ quality: 80 })
        .toFile(dest);
      const size = fs.statSync(dest).size;
      if (size < MIN_VALID_SIZE) throw new Error(`output too small (${size} bytes)`);
      const secs = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`${tag} ✓ ${secs}s${cost != null ? ` (cost ${cost})` : ""} → ${(size / 1024).toFixed(0)}KB`);
      return { ok: true, seed: opt.seed, cost };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("NO CREDITS")) throw err; // abort everything — not retryable
      console.warn(`${tag} ✗ attempt ${attempt}/${MAX_ATTEMPTS}: ${msg}`);
      if (attempt < MAX_ATTEMPTS) await sleep(3000 * attempt);
    }
  }
  return { ok: false, seed: opt.seed, cost: null };
}

// ── worker pool (max CONCURRENCY in flight) ───────────────────────────────────
async function runPool() {
  const results = new Array(OPTIONS.length);
  let next = 0;
  async function worker() {
    while (next < OPTIONS.length) {
      const i = next++;
      results[i] = await generateOne(OPTIONS[i], i);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return results;
}

// Scans every template directory under public/images/path/ for valid (>10KB)
// webp files and rewrites the manifest from what is actually on disk, so it
// stays correct and idempotent across partial runs.
function writeManifest() {
  const entries = [];
  if (fs.existsSync(PATH_ART_ROOT)) {
    for (const template of fs.readdirSync(PATH_ART_ROOT).sort()) {
      const dir = path.join(PATH_ART_ROOT, template);
      if (!fs.statSync(dir).isDirectory()) continue;
      for (const file of fs.readdirSync(dir).sort()) {
        if (!file.endsWith(".webp")) continue;
        if (fs.statSync(path.join(dir, file)).size <= MIN_VALID_SIZE) continue;
        const seed = file.slice(0, -".webp".length);
        entries.push({ seed, publicPath: `/images/path/${template}/${file}` });
      }
    }
  }
  entries.sort((a, b) => a.seed.localeCompare(b.seed));
  const lines = entries.map((e) => `  "${e.seed}": "${e.publicPath}",`);
  const content =
    `// Auto-generated by scripts/generate-path-art.mjs — do not edit by hand.\n` +
    `/** Maps tree option imageSeed → public path of its pre-generated card art. */\n` +
    `export const PATH_ART: Record<string, string> = {\n` +
    lines.join("\n") +
    `\n};\n`;
  fs.writeFileSync(MANIFEST_PATH, content);
  console.log(`\n✓ manifest written → ${MANIFEST_PATH} (${entries.length} entries)`);
}

async function main() {
  if (MANIFEST_ONLY) {
    console.log("▶ --manifest-only: skipping generation, rescanning existing art");
    writeManifest();
    return;
  }

  const templates = [...new Set(OPTIONS.map((o) => o.template))];
  for (const template of templates) {
    fs.mkdirSync(path.join(PATH_ART_ROOT, template), { recursive: true });
  }
  console.log(`▶ Generating ${OPTIONS.length} card images with ${MODEL} (${WIDTH}×${HEIGHT} → ${FINAL_W}×${FINAL_H} webp)`);
  console.log(`▶ Output: ${PATH_ART_ROOT}/{${templates.join(",")}}\n`);
  const t0 = Date.now();

  const results = await runPool();

  const ok = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);
  const totalCost = results.reduce((a, r) => a + (r.cost || 0), 0);

  writeManifest();

  console.log(`\n── Summary ──────────────────────────`);
  console.log(`  Success: ${ok.length}/${OPTIONS.length}`);
  if (failed.length) console.log(`  FAILED seeds: ${failed.map((r) => r.seed).join(", ")}`);
  if (totalCost > 0) console.log(`  Total BFL cost (provider-reported credits): ${totalCost.toFixed(2)}`);
  console.log(`  Elapsed: ${((Date.now() - t0) / 60000).toFixed(1)} min`);
  if (failed.length) process.exitCode = 1;
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
