// «¿Lo reconoces?» (slate #7, 2026-10-27): a phone photo of Martín (AI actor from ../soy-yo-real) turns into his own
// illustration on page 29 (the hero portrait) of book 31ada3cf. The start photo copies the pose and framing of that page so the morph is smooth.
// Run from this folder: node start-frames.mjs a
import { run, REAL } from "../_shared/start-frames.mjs";
await run({
  a: { refs: ["people/ref-kid.jpg", "people/ref-p29.jpg"], prompt: `An unremarkable vertical phone snapshot taken by his mother: the same real boy as in the first image (same face, messy brown hair, round dark-rimmed glasses, faded red hoodie over a navy and white striped t-shirt), standing in his ordinary bedroom, framed like the painted boy in the second image: the same close-up, head position, size and angle, a small closed-mouth smile, eyes on the camera. The room is a real Spanish child's bedroom, nothing like the painting: white walls with a few stickers, a cheap wardrobe, clothes on a chair, a ceiling lamp. Flat overhead light, a little underexposed, phone sensor noise, slight blur, skin with blemishes and uneven tone, not retouched, not smooth, not glossy. ${REAL} A real photograph, not an illustration, not a render. No added text, no logos, no watermark.` },
});
