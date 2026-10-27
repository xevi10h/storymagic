// Start frames for the "¡Soy yo!" ad (fal flux-2 edit, cents per image), copied from scripts/social/scene-photos.example.mjs.
// Run from docs/social/ads/soy-yo: FAL_MODEL=fal-ai/nano-banana-pro/edit PREFIX=nb node start-frames.mjs a, pick one as people/start-a.jpg,
// then the same with "b c" (they reuse start-a.jpg for the dad); the chosen ones are people/start-{a,b,c}.jpg.
import { existsSync, readFileSync } from "node:fs";
import sharp from "sharp";
const key = readFileSync("/Users/xavierhuixtrenco/Desktop/Casmar/kids-book/.env.local", "utf8").match(/^FAL_KEY=(.+)$/m)[1].trim().replace(/^"|"$/g, "");
const uri = (f) => `data:image/jpeg;base64,${readFileSync(f).toString("base64")}`;
const KID = "a real four-year-old boy who looks exactly like the painted boy in the reference illustration, as a real child: warm medium-brown skin (the same tone as in the painting), a big round cloud of tight black curly hair, big dark brown eyes, round cheeks, a small nose; wearing the same clothes as in the painting: an orange zip hoodie open over a navy and white striped t-shirt";
const DAD = "his father, a man in his early thirties with dark brown skin, short black hair and a short neat black beard, wearing a plain grey knit sweater";
const REAL = "He is a real human child photographed with a phone: natural human proportions, normal-sized eyes, real skin with pores and slight unevenness, natural dry lips, not a doll, not CGI, not a 3D animation character, not airbrushed.";
const LOOK = "Candid phone video frame filmed by the mother, late evening at home, the room lit only by a warm table lamp, amber golden tones and soft shadows, a beige living room sofa with cushions, real skin texture, natural soft grain, slightly imperfect handheld framing. Photorealistic, not a studio photo. Vertical. No added text, no logos, no watermark.";
const COVER = "The book is this exact square hardcover children's picture book from the first reference image. Copy the cover without changing anything: the same painting of the curly-haired boy in an orange jacket next to a green baby dinosaur, and the same white title, which reads exactly \"Leo\" in large letters with \"y el valle que rugía\" in smaller letters below it.";
const SCENES = {
  a: { refs: ["people/ref-cover.jpg", "people/ref-leo.jpg"], prompt: `Close-up on a sofa: ${KID}. ${REAL} His face is in the upper half of the frame, turned three-quarters toward the camera, eyes wide with wonder, lips slightly parted, his eyes looking down at the book cover in his father's hands, not at the camera, as if he has just recognised himself. ${DAD} sits beside him; only his shoulder, his forearm and his two hands are visible on the left, holding the closed book upright on his knee with its front cover angled toward the boy and the camera, in the lower-middle part of the frame. ${COVER} ${LOOK}` },
  b: { refs: ["people/start-a.jpg", "people/ref-leo.jpg"], prompt: `The same boy and the same father as in the first reference image, same sofa, same lamp light, a moment later. Medium close-up: the boy kneels on the sofa next to his father, leaning over a large open book that lies flat on his father's lap at the very bottom edge of the frame, the pages seen almost edge-on and out of focus so no artwork is visible. The boy points down at the page with his index finger and looks up at his father with a huge delighted smile, mouth open as if talking. The father, on the left, slightly out of focus, smiles down at him. The boy must look exactly like the painted boy in the second reference image (same face, same curly hair, orange hoodie over a striped t-shirt). ${REAL} ${LOOK}` },
  c: { refs: ["people/start-a.jpg"], prompt: `The same father as in the reference image, same sofa, same lamp light. Close-up of the father's face, filling the upper half of the frame: he looks down to his right at his son, not at the camera, with a small tender smile, his eyes glistening and slightly wet, moved. In the bottom right foreground, out of focus, the back of the boy's curly black hair and his orange hood. No book visible. ${LOOK}` },
};
// FAL_MODEL=fal-ai/nano-banana-pro/edit ($0.15 an image) keeps the reference face and cover far better than flux-2 edit.
const BANANA = /nano-banana/.test(process.env.FAL_MODEL ?? "");
await Promise.all(process.argv.slice(2).map(async (name) => {
  const s = SCENES[name];
  for (const r of s.refs) if (!existsSync(r)) throw new Error(`missing ${r}`);
  const res = await fetch(`https://fal.run/${process.env.FAL_MODEL ?? "fal-ai/flux-2/edit"}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Key ${key}` },
    body: JSON.stringify({ prompt: s.prompt, image_urls: s.refs.map(uri), output_format: "jpeg", num_images: 2, ...(BANANA ? { aspect_ratio: "9:16", resolution: "2K" } : { image_size: { width: 1080, height: 1920 } }) }) });
  const j = await res.json();
  if (!res.ok || !j.images?.[0]?.url) return console.log(name, "FAILED", res.status, JSON.stringify(j).slice(0, 300));
  for (const [i, im] of j.images.entries()) await sharp(Buffer.from(await (await fetch(im.url)).arrayBuffer())).resize(1080, 1920, { fit: "cover" }).jpeg({ quality: 92 }).toFile(`people/${process.env.PREFIX ?? "start"}-${name}${"12"[i]}.jpg`);
  console.log(name, "ok");
}));
