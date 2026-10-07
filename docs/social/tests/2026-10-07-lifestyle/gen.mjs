import { readFileSync, writeFileSync } from "node:fs";
const key = readFileSync("/Users/xavierhuixtrenco/Desktop/Casmar/kids-book/.env.local", "utf8").match(/^FAL_KEY=(.+)$/m)[1].trim().replace(/^"|"$/g, "");
const uri = (f) => `data:image/jpeg;base64,${readFileSync(f).toString("base64")}`;
const LOOK = "Authentic editorial lifestyle photograph, 35mm lens, shallow depth of field, soft warm natural light, real skin texture, muted cosy home colours. Vertical composition with the book in the middle third of the frame. No added text, no logos, no watermark.";
const SCENES = {
  s1: { ref: "cover.jpg", prompt: `An adult's two hands holding up this exact square hardcover children's picture book, front cover facing the camera and filling most of the width, above a bed with a knitted cream blanket, a bedside lamp glowing softly out of focus behind. The cover artwork and its title are reproduced exactly as in the reference image. ${LOOK}` },
  s2: { ref: "spreadA.jpg", prompt: `Over-the-shoulder view from behind of a parent and a small child with dark curly hair sitting in bed at bedtime, seen only from behind, faces not visible. The parent holds this exact square picture book open flat on their laps: the left page is the full illustration and the right page is the cream text page, both reproduced exactly as in the reference image and clearly visible. Warm lamp light. ${LOOK}` },
  s3: { ref: "cover.jpg", prompt: `This exact square hardcover children's picture book lying on a light wooden table, front cover up, seen from above at a slight angle, half unwrapped from brown kraft gift paper with a thin orange ribbon, a child's small hands just reaching in from the bottom edge. Morning window light. The cover artwork and its title are reproduced exactly as in the reference image. ${LOOK}` },
  s4: { ref: "spreadB.jpg", prompt: `A small child with dark curly hair lying on their tummy on a rug, seen from behind and above, face not visible, with this exact square picture book open flat on the floor in front of them: left page the full illustration, right page the cream text page, both reproduced exactly as in the reference image. One small finger points at the illustration. Afternoon light, wooden floor. ${LOOK}` },
};
for (const name of process.argv.slice(2)) {
  const s = SCENES[name];
  const res = await fetch("https://fal.run/fal-ai/flux-2/edit", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Key ${key}` },
    body: JSON.stringify({ prompt: s.prompt, image_urls: [uri(s.ref)], image_size: { width: 1080, height: 1920 }, output_format: "jpeg", num_images: 1 }),
  });
  const j = await res.json();
  if (!res.ok || !j.images?.[0]?.url) { console.log(name, "FAILED", res.status, JSON.stringify(j).slice(0, 300)); continue; }
  writeFileSync(`${name}.jpg`, Buffer.from(await (await fetch(j.images[0].url)).arrayBuffer()));
  console.log(name, "ok", j.images[0].width, j.images[0].height, "seed", j.seed);
}
