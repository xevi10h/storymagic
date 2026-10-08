import { readFileSync, writeFileSync } from "node:fs";
const key = readFileSync("/Users/xavierhuixtrenco/Desktop/Casmar/kids-book/.env.local", "utf8").match(/^FAL_KEY=(.+)$/m)[1].trim().replace(/^"|"$/g, "");
const uri = (f) => `data:image/jpeg;base64,${readFileSync(f).toString("base64")}`;
const KID = "a small four-year-old girl with curly red hair, wearing a mustard-yellow jacket over a navy and white striped t-shirt and blue denim dungarees (the same clothes as the girl painted in the book)";
const LOOK = "Candid phone-camera home video frame, natural window light, slightly imperfect framing, real skin texture, lived-in child's bedroom with a rug. Vertical. No added text, no logos, no watermark.";
const COVER = "The book is this exact square hardcover children's picture book. Copy the cover from the reference image without changing anything: the same painting, and the same white title, which reads exactly \"Noa\" in large letters with \"y la llave de flor\" in smaller letters below it.";
const SCENES = {
  n1: { ref: "illus.jpg", prompt: `Seen from behind and above: ${KID} sits on a rug with a large square picture book open on the floor in front of her. A worn brown teddy bear sits propped up beside the book, facing its pages, as if listening. The left page of the open book is this exact full-page painting from the reference image, copied without changing anything; the right page is mostly hidden by the teddy bear's legs. Her face is not visible, only her red curls and her small hand flat on the painted page. ${LOOK}` },
  n2: { ref: "illus.jpg", prompt: `Close view over the girl's shoulder: ${KID} points with one finger at the painted girl in a large open picture book on the rug, her other hand holding a worn brown teddy bear's paw so that the bear "looks" at the page. The visible page is this exact full-page painting from the reference image, copied without changing anything, filling the lower half of the frame. Only her red curls, her sleeve and the edge of one cheek are visible. ${LOOK}` },
  n3: { ref: "cover.jpg", prompt: `Seen from behind: ${KID} sits on a rug holding the closed book upright in both hands, showing its front cover to a worn brown teddy bear sitting in front of her; the cover faces the camera too and fills the centre of the frame. ${COVER} Only the back of her red curly head is visible. ${LOOK}` },
  n4: { ref: "cover.jpg", prompt: `Evening, warm lamp light: ${KID} lies asleep on her side in bed, seen from behind and slightly above so her face is hidden by her red curls, one arm around a worn brown teddy bear and the closed book resting against the bear, front cover facing the camera and clearly visible. ${COVER} ${LOOK}` },
};
await Promise.all(process.argv.slice(2).map(async (name) => {
  const s = SCENES[name];
  const res = await fetch("https://fal.run/fal-ai/flux-2/edit", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Key ${key}` },
    body: JSON.stringify({ prompt: s.prompt, image_urls: [uri(s.ref)], image_size: { width: 1080, height: 1920 }, output_format: "jpeg", num_images: 2 }) });
  const j = await res.json();
  if (!res.ok || !j.images?.[0]?.url) return console.log(name, "FAILED", res.status, JSON.stringify(j).slice(0, 300));
  for (const [i, im] of j.images.entries()) writeFileSync(`${name}${"ab"[i]}.jpg`, Buffer.from(await (await fetch(im.url)).arrayBuffer()));
  console.log(name, "ok");
}));
