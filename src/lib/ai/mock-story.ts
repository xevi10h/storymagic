// Mock story generator for local development (MOCK_MODE=true).
//
// Returns a publication-quality story with placeholder illustrations.
// Zero API calls — instant generation.
//
// This mock also serves as a reference for the expected output quality
// and structure of real AI-generated books.

import { getTemplateConfig } from "@/lib/create-store";
import type { GeneratedStory, StoryInput } from "./story-generator";
import { buildCharacterVisualDescription } from "./character-description";
import {
  PANORAMIC_SCENES,
  PLAN_CHILD_ID,
  buildPlanChildDescription,
  getPlanSpec,
  planToGeneratedStory,
  type BookPlan,
} from "./book-plan";

// MOCK_MODE images: random real placeholders from Lorem Picsum (no AI cost, no
// missing-asset/ORB issues). Seeded per slot so each render is stable but the set
// looks varied. Swap back to a real pre-generated set before any production use.
const PICSUM = (seed: string, size = 1024) =>
  `https://picsum.photos/seed/${seed}/${size}/${size}`;
const MOCK_COVER_URL = PICSUM("meapica-cover");
const MOCK_ILLUSTRATION_URLS = Array.from({ length: 12 }, (_, i) =>
  PICSUM(`meapica-scene-${i + 1}`),
);

/** Get mock cover illustration URL. */
export function getMockCoverUrl(): string {
  return MOCK_COVER_URL;
}

/** Get mock character portrait URL (random placeholder in MOCK_MODE). */
export function getMockPortraitUrl(): string {
  return PICSUM("meapica-portrait", 800);
}

/** Get mock illustration URL for a given scene index (0-based). */
export function getMockIllustrationUrl(sceneIndex: number): string {
  return MOCK_ILLUSTRATION_URLS[sceneIndex % MOCK_ILLUSTRATION_URLS.length];
}

/** Get mock secondary illustration URL — offset by 6 so it differs from primary. */
export function getMockSecondaryIllustrationUrl(sceneIndex: number): string {
  return MOCK_ILLUSTRATION_URLS[(sceneIndex + 6) % MOCK_ILLUSTRATION_URLS.length];
}

/**
 * Scenes that get a secondary illustration in the mock book (stored as scene N + 12).
 * Excludes the panorama scenes (3, 8). Younger readers get more picture pages.
 */
export function getSecondaryScenes(age: number): number[] {
  if (age <= 4) return [1, 2, 4, 5, 6, 7, 9, 10, 11, 12];
  if (age <= 6) return [1, 2, 5, 6, 9, 10, 11, 12];
  if (age <= 9) return [1, 5, 6, 9, 11, 12];
  return [1, 6, 9, 12];
}

// --- 12-slot story templates (10 scenes + 2 bridges for default ~6yo) ---

interface SceneTemplate {
  title: string;
  text: string;
  type: "scene" | "bridge";
  imagePrompt: string;
}

function buildScenes(name: string, city: string, theme: string, characterVisual: string): SceneTemplate[] {
  return [
    // BLOCK 1 — MI MUNDO
    {
      type: "scene",
      title: "Un día cualquiera",
      text: `${name} vivía en ${city}, y cada mañana era una pequeña aventura en sí misma. El olor del pan recién horneado llenaba el aire cuando bajaba las escaleras, y el sonido de los pájaros marcaba el ritmo del día. Le gustaba observar el cielo desde la ventana, buscando formas en las nubes: allí un dragón, aquí un barco pirata. «Hoy será un día especial», se dijo en voz baja, aunque todavía no sabía por qué.`,
      imagePrompt: `${characterVisual} standing by a window in a cozy room, looking up at the sky with curiosity, morning sunlight streaming in, warm and peaceful atmosphere. Children's book illustration, soft warm colors, whimsical, gentle lighting.`,
    },
    {
      type: "scene",
      title: "La señal",
      text: `Mientras caminaba por las calles empedradas de ${city}, ${name} notó un destello extraño junto a una farola. Era una capa roja, pequeña y brillante, que relucía como si guardara un secreto. Al agacharse a recogerla, sintió un hormigueo cálido en la punta de los dedos. La tela era suave como el agua y ligera como el aire. «¿Cómo habrá llegado aquí?», pensó ${name}, mirando a ambos lados de la calle vacía.`,
      imagePrompt: `${characterVisual} kneeling on a cobblestone street, picking up a glowing red cape, with a look of wonder, subtle magical sparkles around the cape. Children's book illustration, soft warm colors, whimsical, gentle lighting.`,
    },
    // BRIDGE — threshold between ordinary and extraordinary
    {
      type: "bridge",
      title: "El umbral",
      text: "Y entonces, sin previo aviso, todo cambió.",
      imagePrompt: `${characterVisual} wearing a red cape, silhouetted against a doorway filled with swirling golden light, mysterious and inviting atmosphere. Children's book illustration, soft warm colors, whimsical, dreamlike.`,
    },
    // BLOCK 2 — LA LLAMADA
    {
      type: "scene",
      title: "El despertar",
      text: `En cuanto ${name} se puso la capa sobre los hombros, el mundo se transformó por completo. Los colores estallaron: el rojo de los buzones brillaba como rubíes, el verde de los árboles cantaba con mil tonos distintos. Podía escuchar el latido de la ciudad, sus risas y sus susurros, como si el mundo entero tuviera corazón. «¿Qué me está pasando?», murmuró ${name}. El mundo de ${theme} se abría ante sus ojos como un libro lleno de páginas en blanco.`,
      imagePrompt: `${characterVisual} wearing a red cape, standing in the middle of a vibrant city street that seems to glow with magical energy, arms slightly outstretched, amazed expression. Children's book illustration, soft warm colors, whimsical, gentle lighting.`,
    },
    {
      type: "scene",
      title: "Max, el valiente",
      text: `Un ladrido agudo cortó el aire. ${name} vio a un pequeño perro corriendo hacia él con una diminuta capa azul atada al cuello. Se llamaba Max. Tenía un oído tan fino que podía escuchar cuando alguien estaba triste, incluso desde el otro extremo de la ciudad. «Eres increíble, Max», dijo ${name}, acariciándole las orejas. Max respondió con un ladrido orgulloso. Juntos formaban un equipo perfecto.`,
      imagePrompt: `${characterVisual} wearing a red cape, standing proudly next to a brave dog wearing a tiny cape, both looking at the horizon, city skyline in background. Children's book illustration, soft warm colors, whimsical, gentle lighting.`,
    },
    // BLOCK 3 — EL CAMINO
    {
      type: "scene",
      title: "Explorando la ciudad secreta",
      text: `Max guio a ${name} por rincones de ${city} que nunca había visto: callejones cubiertos de musgo brillante, plazas escondidas donde el tiempo parecía detenerse. Descubrieron una escalera de caracol que subía hasta un jardín flotante entre las nubes. «¡No me puedo creer que esto existiera aquí siempre!», exclamó ${name}. Max trotaba delante, feliz de compartir sus secretos favoritos. Cada esquina traía una nueva sorpresa.`,
      imagePrompt: `${characterVisual} wearing a red cape, and a brave dog wearing a tiny cape, flying through the air above the city, discovering hidden gardens and sparkling fountains below. Children's book illustration, soft warm colors, whimsical, gentle lighting.`,
    },
    {
      type: "scene",
      title: "La primera prueba",
      text: `El primer desafío llegó sin avisar: desde la cima de un edificio antiguo, llegaban los chillidos de unos pájaros atrapados en una vieja jaula. «Puedo hacerlo», se dijo ${name}, aunque le temblaban un poco las rodillas. Comenzó a trepar por la fachada de piedra. Max ladraba ánimos desde abajo. Cuando por fin abrió la jaula y vio volar a los pájaros libres, sintió una alegría tan grande que tuvo que sujetarse para no caer.`,
      imagePrompt: `${characterVisual} wearing a red cape, and a brave dog wearing a tiny cape, standing in front of a tall building, looking up at caged birds, determined expression, heroic pose. Children's book illustration, soft warm colors, whimsical, gentle lighting.`,
    },
    {
      type: "scene",
      title: "Un momento de calma",
      text: `Después de tanto correr, ${name} y Max se sentaron en el tejado más alto que encontraron. El sol se ponía despacio, pintando el cielo de naranja, rosa y violeta. «Ha sido un día increíble, Max», dijo ${name} en voz baja. El perro apoyó la cabeza en su regazo y suspiró, contento. Por un momento, todo estaba en silencio: solo el viento suave y el latido de la ciudad durmiendo.`,
      imagePrompt: `${characterVisual} wearing a red cape, sitting on a rooftop next to a brave dog, both watching a beautiful sunset, warm comforting glow, peaceful atmosphere. Children's book illustration, soft warm colors, whimsical, gentle lighting.`,
    },
    // BRIDGE — tension builds
    {
      type: "bridge",
      title: "La calma antes de la tormenta",
      text: "Pero la tranquilidad estaba a punto de romperse...",
      imagePrompt: `Dark clouds gathering over a peaceful city skyline, the last rays of golden sunlight fading, ominous but beautiful atmosphere. Children's book illustration, soft warm colors transitioning to dramatic tones, atmospheric.`,
    },
    // BLOCK 4 — LA PRUEBA
    {
      type: "scene",
      title: "La gran amenaza",
      text: `Sin previo aviso, una nube enorme y oscura cubrió el cielo de ${city}. El viento comenzó a aullar. Max gruñó suavemente, con el pelo erizado. ${name} miró la tormenta y sintió un miedo de verdad, un miedo que le pesaba en el pecho. Pero entonces miró a Max, y en sus ojos vio algo que le devolvió las fuerzas. «Tenemos que hacer algo», dijo ${name} con voz firme.`,
      imagePrompt: `${characterVisual} wearing a red cape, standing in front of a massive dark storm cloud with lightning, looking brave but determined, with the brave dog by their side. Children's book illustration, soft warm colors, whimsical, gentle lighting, with a hint of drama.`,
    },
    {
      type: "scene",
      title: "La verdadera fuerza",
      text: `${name} se acercó al centro de la tormenta. No con los puños apretados, sino con el corazón abierto. «Sé que estás enfadada», dijo en voz alta, hablándole a la nube como si fuera un amigo. «Yo también me enfado a veces. Pero no hace falta hacer tanto daño». La tormenta vaciló. El viento amainó. ${name} siguió hablando con cariño, y poco a poco, la nube oscura comenzó a deshacerse.`,
      imagePrompt: `${characterVisual} wearing a red cape, standing in front of the dark cloud, speaking to it gently, with a warm comforting light surrounding them, as the cloud begins to clear. Children's book illustration, soft warm colors, whimsical, gentle lighting, with a sense of resolution.`,
    },
    // BLOCK 5 — VOLVER A CASA
    {
      type: "scene",
      title: "De vuelta a casa",
      text: `La tormenta se disipó y el sol volvió a aparecer, bañando las calles mojadas de ${city} con una luz dorada. ${name} se quitó la capa con cuidado y la dobló entre los brazos. Había aprendido algo muy importante: el verdadero poder no estaba en la capa, sino dentro de sí mismo. Max movía la cola sin parar. De camino a casa, ${name} iba sonriendo, con los pies mojados y el corazón lleno.`,
      imagePrompt: `${characterVisual} walking back into the sunny peaceful city, with the brave dog by their side, looking happy and content, golden sunlight. Children's book illustration, soft warm colors, whimsical, gentle lighting.`,
    },
  ];
}

const MOCK_CAMERAS = [
  "eye-level medium shot",
  "close-up",
  "wide panoramic shot",
  "low-angle medium shot",
  "high-angle wide shot",
  "over-the-shoulder view",
  "medium close-up",
  "wide panoramic shot",
  "bird's-eye wide shot",
  "close-up",
  "low-angle wide shot",
  "eye-level medium shot",
];

/**
 * Deterministic mock that goes through the same Book Plan contract as the real
 * generator (plan → planToGeneratedStory), so MOCK_MODE exercises the same
 * consumers (image engine, viewer, PDF). The parent's dedication is verbatim.
 */
export function generateMockStory(input: StoryInput): GeneratedStory {
  const template = getTemplateConfig(input.templateId);
  const theme = template?.theme || "a magical adventure";
  const moral = template?.moral || "la bondad es la mayor fuerza de todas";
  const city = input.city || "una ciudad mágica";
  const characterVisual = buildCharacterVisualDescription(input);
  const sceneTemplates = buildScenes(input.childName, city, theme, characterVisual);
  const homeScenes = [1, 2, 12];

  const parentDedication = input.dedication?.trim() ? input.dedication : undefined;
  const dedicationText = parentDedication
    ?? `Para ${input.childName}, el alma más valiente y luminosa que conocemos. Que cada página de este libro te recuerde que llevas un héroe dentro.`;

  const plan: BookPlan = {
    version: 1,
    locale: input.locale || "es",
    mode: getPlanSpec(input.age).mode,
    childName: input.childName,
    gender: input.gender,
    age: input.age,
    dedicationSource: parentDedication ? "parent" : "generated",
    dedicationText,
    model: "mock",
    title: `${input.childName} y la capa extraordinaria`,
    alternateTitles: [
      `La gran aventura de ${input.childName}`,
      `${input.childName} y el misterio de ${input.city || "la ciudad"}`,
      `El héroe llamado ${input.childName}`,
    ],
    synopsis: `${input.childName} tiene un don especial que todavía no conoce. Un día extraordinario cambiará su mundo para siempre. ¿Estás listo para acompañarle en la aventura?`,
    refrain: "",
    setupPayoff: { detail: "a small glowing red cape found by a street lamp", setupScene: 2, payoffScene: 11 },
    cast: [],
    world: [
      { id: "home_city", name: city, kind: "location", visual: "A sunny Mediterranean city street with cobblestones, balconies with flowers and a warm stone facade." },
      { id: "magic_city", name: "La ciudad secreta", kind: "location", visual: "The same city transformed by magic: glowing colours, floating lanterns, rooftops that sparkle." },
      { id: "red_cape", name: "La capa roja", kind: "object", visual: "A small bright red cape with a golden clasp that glows softly." },
    ],
    scenes: sceneTemplates.map((scene, index) => {
      const n = index + 1;
      const action = scene.imagePrompt
        .replace(characterVisual, "The child")
        .replace(/\s*Children's book illustration.*$/, "")
        .trim();
      const home = homeScenes.includes(n);
      return {
        sceneNumber: n,
        type: scene.type,
        title: scene.title,
        text: scene.text,
        illustratedMoment: action,
        shot: {
          action,
          setting: home ? `A sunny street in ${city}` : "The city transformed by magic, glowing and colourful",
          castIds: [PLAN_CHILD_ID],
          worldIds: [home ? "home_city" : "magic_city", ...(n >= 2 && n <= 11 ? ["red_cape"] : [])],
          camera: MOCK_CAMERAS[index] ?? "eye-level medium shot",
          shotScale: PANORAMIC_SCENES.includes(n) ? ("wide" as const) : ("medium" as const),
          light: "Warm golden light",
        },
      };
    }),
    cover: {
      action: "The child wearing a red cape in a gentle heroic pose, arms outstretched, the city skyline behind",
      setting: `Rooftops of ${city} at sunset`,
      castIds: [PLAN_CHILD_ID],
      worldIds: ["home_city", "red_cape"],
      camera: "low-angle medium shot, calm sky in the upper third for the title",
      shotScale: "medium",
      light: "Golden sunset light",
    },
    finalMessage: `Y así, ${input.childName} descubrió que ${moral}. Y que los verdaderos héroes no necesitan capas — solo un corazón valiente y ganas de ayudar.`,
  };

  return planToGeneratedStory(plan, buildPlanChildDescription(input));
}
