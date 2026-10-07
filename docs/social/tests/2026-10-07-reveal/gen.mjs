import { readFileSync, writeFileSync } from "node:fs";
const key = readFileSync("/Users/xavierhuixtrenco/Desktop/Casmar/kids-book/.env.local", "utf8").match(/^FAL_KEY=(.+)$/m)[1].trim().replace(/^"|"$/g, "");
const uri = (f) => `data:image/jpeg;base64,${readFileSync(f).toString("base64")}`;
const KID = "a small boy with dark curly afro hair, wearing an orange zip-up jacket over a navy and white striped t-shirt and blue jeans (the same clothes as the boy painted in the book)";
const LOOK = "Candid phone-camera home video frame, natural window light, slightly imperfect framing, real skin texture, lived-in family living room. Vertical. No added text, no logos, no watermark.";
const BOOK = "The book is this exact square hardcover children's picture book. Copy the cover from the reference image without changing anything: the same painting of the boy in the orange jacket shouting next to the green baby dinosaur in a misty valley, and the same white title, which reads exactly \"Leo\" in large letters with \"y el valle que rugía\" in smaller letters below it.";
const SCENES = {
  v1: { ref: "cover.jpg", prompt: `Seen from above over the child's shoulder: the small hands of ${KID} are tearing open brown kraft wrapping paper on a rug. Inside the torn paper, about half of the book cover is already visible, the rest still hidden under paper. ${BOOK} The child's curly hair is at the bottom edge of the frame, face not visible. ${LOOK}` },
  v2: { ref: "cover.jpg", prompt: `Seen from behind and slightly to the side: ${KID} sits on a rug holding the book upright in both hands in front of him, front cover fully visible to the camera and filling the centre of the frame, one finger resting just under the big name printed on the cover. Torn kraft paper lies around him. Only the back of his curly head and one cheek are visible. ${BOOK} ${LOOK}` },
  v3: { ref: "spread.jpg", prompt: `Close over-the-shoulder view: ${KID} sits cross-legged with the book open flat on his lap, both pages clearly visible and filling the lower two thirds of the frame: copy both pages from the reference image without changing anything: the left page is the painting of the boy in the orange jacket shouting with his hands around his mouth beside the green baby dinosaur, sunrise and volcano behind; the right page is plain cream with two short centred lines of dark brown text that read exactly \"Leo juntó las manos.\" and \"Lulo tomó aire.\" His finger touches the painted boy on the left page. Only the back of his curly head, his orange sleeve and the edge of a smiling cheek are visible. ${LOOK}` },
  v4: { ref: "cover.jpg", prompt: `Bedtime, warm bedside lamp: ${KID} lies in bed under a blanket hugging the closed book against his chest with both arms, front cover facing the camera and clearly visible, seen from the side and slightly behind so his face is mostly hidden by his curls and the book. An adult's hand is pulling the blanket up over him. ${BOOK} ${LOOK}` },
};
await Promise.all(process.argv.slice(2).map(async (name) => {
  const s = SCENES[name];
  const res = await fetch("https://fal.run/fal-ai/flux-2/edit", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Key ${key}` },
    body: JSON.stringify({ prompt: s.prompt, image_urls: [uri(s.ref)], image_size: { width: 1080, height: 1920 }, output_format: "jpeg", num_images: 2 }) });
  const j = await res.json();
  if (!res.ok || !j.images?.[0]?.url) return console.log(name, "FAILED", res.status, JSON.stringify(j).slice(0, 300));
  for (const [i, im] of j.images.entries()) writeFileSync(`${name}${"ab"[i]}.jpg`, Buffer.from(await (await fetch(im.url)).arrayBuffer()));
  console.log(name, "ok seed", j.seed);
}));
