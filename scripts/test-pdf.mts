/**
 * Test script — renders a full 24-page PDF book with mock 12-scene data.
 * Run: npx tsx --tsconfig tsconfig.json scripts/test-pdf.mts
 * Output: scripts/test-output.pdf
 */

import { createElement } from "react";
import { renderToBuffer, Font } from "@react-pdf/renderer";
import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// Use path alias (tsx respects tsconfig paths)
import { BookPdf, type BookPdfInput } from "@/lib/pdf/book-template";

// Ensure fonts are registered before rendering (module top-level may not run first)
Font.register({
  family: "Fredoka",
  fonts: [
    {
      src: "https://fonts.gstatic.com/s/fredoka/v17/X7nP4b87HvSqjb_WIi2yDCRwoQ_k7367_B-i2yQag0-mac3O8SLMFg.ttf",
      fontWeight: 400,
    },
    {
      src: "https://fonts.gstatic.com/s/fredoka/v17/X7nP4b87HvSqjb_WIi2yDCRwoQ_k7367_B-i2yQag0-mac3OLyXMFg.ttf",
      fontWeight: 600,
    },
  ],
});

Font.register({
  family: "PlusJakartaSans",
  fonts: [
    {
      src: "https://fonts.gstatic.com/s/plusjakartasans/v12/LDIbaomQNQcsA88c7O9yZ4KMCoOg4IA6-91aHEjcWuA_qU7NSg.ttf",
      fontWeight: 400,
    },
    {
      src: "https://fonts.gstatic.com/s/plusjakartasans/v12/LDIZaomQNQcsA88c7O9yZ4KMCoOg4KozySKCdSNG9OcqYQ0lCR_Q.ttf",
      fontWeight: 400,
      fontStyle: "italic" as const,
    },
    {
      src: "https://fonts.gstatic.com/s/plusjakartasans/v12/LDIbaomQNQcsA88c7O9yZ4KMCoOg4IA6-91aHEjcWuA_d0nNSg.ttf",
      fontWeight: 600,
    },
  ],
});

Font.registerHyphenationCallback((word: string) => [word]);

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Mock data — realistic 12-scene Spanish children's story ──────────

const mockStory = {
  bookTitle: "Lucía y el Bosque de las Estrellas",
  dedication:
    "Para mi pequeña Lucía, que cada noche mira las estrellas desde su ventana y sueña con tocarlas. Este cuento es tuyo, como lo es cada estrella que brilla en el cielo.",
  finalMessage:
    "Y así, Lucía descubrió que la magia más poderosa no estaba en las estrellas del cielo, sino en el brillo de su propio corazón valiente.",
  scenes: [
    {
      sceneNumber: 1,
      title: "Una noche especial",
      text: "Lucía vivía en un pequeño pueblo rodeado de montañas, donde las noches eran tan oscuras que las estrellas parecían diamantes esparcidos sobre terciopelo negro. Cada noche, antes de dormir, se asomaba a su ventana y les susurraba secretos.",
      imagePrompt: "",
    },
    {
      sceneNumber: 2,
      title: "La estrella fugaz",
      text: "Una noche, una estrella fugaz cruzó el cielo dejando una estela dorada que no se desvanecía. La luz descendió lentamente hasta posarse entre los árboles del bosque cercano, iluminando las copas con un resplandor mágico.",
      imagePrompt: "",
    },
    {
      sceneNumber: 3,
      title: "El camino de luciérnagas",
      text: "Sin pensarlo dos veces, Lucía se puso sus botas de lluvia y salió al jardín. Un sendero de luciérnagas apareció ante ella, como si las pequeñas luces la invitaran a seguirlas hacia el corazón del bosque encantado.",
      imagePrompt: "",
    },
    {
      sceneNumber: 4,
      title: "El Guardián del Bosque",
      text: "En un claro bañado de luz de luna, Lucía encontró un enorme ciervo con astas que brillaban como constelaciones. «Bienvenida, pequeña soñadora», dijo con voz profunda y amable. «Te estábamos esperando.»",
      imagePrompt: "",
    },
    {
      sceneNumber: 5,
      title: "Zuri, la zorra de las estrellas",
      text: "De entre los helechos emergió una pequeña zorra de pelaje azul medianoche, con manchas que centelleaban como estrellas. «¡Me llamo Zuri!», exclamó dando vueltas. «¡Yo seré tu guía en esta aventura!»",
      imagePrompt: "",
    },
    {
      sceneNumber: 6,
      title: "El jardín de cristal",
      text: "Zuri condujo a Lucía a un jardín secreto donde las flores eran de cristal transparente y cada pétalo contenía una pequeña galaxia en su interior. Cuando Lucía tocó una, una melodía dulce llenó el aire y las flores comenzaron a brillar con más intensidad.",
      imagePrompt: "",
    },
    {
      sceneNumber: 7,
      title: "El puente de arcoíris",
      text: "Para cruzar el Río de los Reflejos, Lucía tuvo que construir un puente con notas musicales que flotaban en el aire. Cantó la canción que su abuela siempre le cantaba, y las notas se solidificaron formando un camino brillante.",
      imagePrompt: "",
    },
    {
      sceneNumber: 8,
      title: "Secretos bajo la luna",
      text: "Sentadas en una roca junto al río, Lucía y Zuri compartieron sus sueños más profundos. «Yo sueño con tener alas», confesó Zuri. «Yo sueño con que mi abuela pueda ver las estrellas otra vez», susurró Lucía con los ojos brillantes.",
      imagePrompt: "",
    },
    {
      sceneNumber: 9,
      title: "La Sombra Oscura",
      text: "De pronto, una sombra inmensa cubrió el bosque. El Devorador de Luz, una criatura hecha de oscuridad pura, había despertado y estaba apagando las estrellas una a una. El bosque comenzó a sumirse en la negrura más absoluta.",
      imagePrompt: "",
    },
    {
      sceneNumber: 10,
      title: "Todo está perdido",
      text: "La última estrella del bosque se apagó. En la oscuridad total, Lucía no podía ver ni sus propias manos. El miedo se apoderó de ella y las lágrimas comenzaron a rodar por sus mejillas. «No puedo hacerlo», gimió. «Soy solo una niña.»",
      imagePrompt: "",
    },
    {
      sceneNumber: 11,
      title: "La luz interior",
      text: "Entonces Zuri presionó su nariz fría contra la mano de Lucía. «Las estrellas no están fuera, Lucía. Están dentro de ti.» Lucía cerró los ojos, pensó en su abuela, en su familia, en todo lo que amaba, y un resplandor dorado nació de su corazón.",
      imagePrompt: "",
    },
    {
      sceneNumber: 12,
      title: "De vuelta a casa",
      text: "Las estrellas regresaron al cielo, más brillantes que nunca. Lucía volvió a su cama con una pequeña estrella de cristal que Zuri le regaló como recuerdo. Desde entonces, cada vez que mira al cielo nocturno, sabe que el bosque la recuerda y que la verdadera magia vive en su corazón.",
      imagePrompt: "",
    },
  ],
};

// Placeholder images with earthy/forest palette
const COLORS = [
  "2e7d32", "1b5e20", "33691e", "388e3c",
  "4caf50", "1a237e", "004d40", "006064",
  "01579b", "1a1a4e", "4a148c", "2e7d32",
];

// Pre-fetch images as base64 data URIs (same approach as production PDF route)
async function prefetchImage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") || "image/png";
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    return `data:${contentType};base64,${base64}`;
  } catch {
    return null;
  }
}

async function buildMockInput(): Promise<BookPdfInput> {
  console.log("Pre-fetching 12 placeholder images as base64...");
  const illustrations = await Promise.all(
    mockStory.scenes.map(async (scene, i) => {
      const url = `https://placehold.co/1024x1024/${COLORS[i]}/fff3e0.png?text=Escena+${i + 1}`;
      const dataUri = await prefetchImage(url);
      if (dataUri) {
        console.log(`  Scene ${i + 1}: OK (${(dataUri.length / 1024).toFixed(0)} KB)`);
      } else {
        console.log(`  Scene ${i + 1}: FAILED — will show placeholder`);
      }
      return { sceneNumber: scene.sceneNumber, imageUrl: dataUri };
    }),
  );

  return {
    story: mockStory,
    templateId: "forest",
    characterName: "Lucía",
    characterAge: 6,
    dedicationText: mockStory.dedication,
    senderName: "Mamá y Papá",
    illustrations,
  };
}

// ── Main ──────────────────────────────────────────────────────────────

async function main() {
  console.log("Rendering 23-page book PDF with forest theme (5 layout types)...");
  const start = Date.now();

  const mockInput = await buildMockInput();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = createElement(BookPdf as any, { input: mockInput });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(element as any);

  const outPath = resolve(__dirname, "test-output.pdf");
  writeFileSync(outPath, Buffer.from(buffer));

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  const sizeKb = (buffer.byteLength / 1024).toFixed(0);
  console.log(`Done in ${elapsed}s → ${outPath} (${sizeKb} KB)`);
}

main().catch((err) => {
  console.error("PDF render failed:", err);
  process.exit(1);
});
