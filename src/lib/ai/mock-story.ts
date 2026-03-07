// Mock story generator for local development (MOCK_MODE=true).
//
// Returns a publication-quality story with real Recraft illustrations
// stored in Supabase Storage. Zero API calls — instant generation.
//
// This mock also serves as a reference for the expected output quality
// and structure of real AI-generated books.

import { getTemplateConfig } from "@/lib/create-store";
import type { GeneratedStory, StoryInput } from "./story-generator";
import { buildCharacterVisualDescription } from "./story-generator";

// Real Recraft V3 illustrations stored in Supabase Storage (public bucket).
// Scenes 1-8 from story 52e25a7f, scenes 9-12 from story c609dc62.
const MOCK_ILLUSTRATION_URLS = [
  "https://rmxjtugoyfaxxkiiayss.supabase.co/storage/v1/object/public/illustrations/52e25a7f-52b6-4b0f-92fa-2c14d6d9f554/scene-1.png",
  "https://rmxjtugoyfaxxkiiayss.supabase.co/storage/v1/object/public/illustrations/52e25a7f-52b6-4b0f-92fa-2c14d6d9f554/scene-2.png",
  "https://rmxjtugoyfaxxkiiayss.supabase.co/storage/v1/object/public/illustrations/52e25a7f-52b6-4b0f-92fa-2c14d6d9f554/scene-3.png",
  "https://rmxjtugoyfaxxkiiayss.supabase.co/storage/v1/object/public/illustrations/52e25a7f-52b6-4b0f-92fa-2c14d6d9f554/scene-4.png",
  "https://rmxjtugoyfaxxkiiayss.supabase.co/storage/v1/object/public/illustrations/52e25a7f-52b6-4b0f-92fa-2c14d6d9f554/scene-5.png",
  "https://rmxjtugoyfaxxkiiayss.supabase.co/storage/v1/object/public/illustrations/52e25a7f-52b6-4b0f-92fa-2c14d6d9f554/scene-6.png",
  "https://rmxjtugoyfaxxkiiayss.supabase.co/storage/v1/object/public/illustrations/52e25a7f-52b6-4b0f-92fa-2c14d6d9f554/scene-7.png",
  "https://rmxjtugoyfaxxkiiayss.supabase.co/storage/v1/object/public/illustrations/52e25a7f-52b6-4b0f-92fa-2c14d6d9f554/scene-8.png",
  "https://rmxjtugoyfaxxkiiayss.supabase.co/storage/v1/object/public/illustrations/c609dc62-b4b3-48c4-ab5c-dc4bfec4c521/scene-9.png",
  "https://rmxjtugoyfaxxkiiayss.supabase.co/storage/v1/object/public/illustrations/c609dc62-b4b3-48c4-ab5c-dc4bfec4c521/scene-10.png",
  "https://rmxjtugoyfaxxkiiayss.supabase.co/storage/v1/object/public/illustrations/c609dc62-b4b3-48c4-ab5c-dc4bfec4c521/scene-11.png",
  "https://rmxjtugoyfaxxkiiayss.supabase.co/storage/v1/object/public/illustrations/c609dc62-b4b3-48c4-ab5c-dc4bfec4c521/scene-12.png",
];

/** Get mock illustration URL for a given scene index (0-based). */
export function getMockIllustrationUrl(sceneIndex: number): string {
  return MOCK_ILLUSTRATION_URLS[sceneIndex % MOCK_ILLUSTRATION_URLS.length];
}

// --- 12-scene story templates (publication-quality Spanish prose) ---

interface SceneTemplate {
  title: string;
  text: string;
  imagePrompt: string;
}

function buildScenes(name: string, city: string, theme: string, characterVisual: string): SceneTemplate[] {
  return [
    {
      title: "Un día cualquiera",
      text: `${name} vivía en ${city}, donde cada mañana traía consigo el murmullo del viento y la promesa de algo nuevo. Le gustaba observar el cielo desde la ventana, preguntándose qué habría más allá de las nubes. Aquel día, sin saberlo, todo estaba a punto de cambiar.`,
      imagePrompt: `${characterVisual} standing by a window in a cozy room, looking up at the sky with curiosity, morning sunlight streaming in, warm and peaceful atmosphere. Children's book illustration, soft warm colors, whimsical, gentle lighting.`,
    },
    {
      title: "La señal",
      text: `Mientras caminaba por la calle, ${name} notó un destello extraño en el suelo: una capa roja que brillaba con una luz suave, como si estuviera viva. Al recogerla, sintió un cosquilleo recorrer sus dedos. Algo le decía que aquella capa era especial.`,
      imagePrompt: `${characterVisual} kneeling on a cobblestone street, picking up a glowing red cape, with a look of wonder, subtle magical sparkles around the cape. Children's book illustration, soft warm colors, whimsical, gentle lighting.`,
    },
    {
      title: "El despertar",
      text: `En cuanto se puso la capa, ${name} sintió que el mundo se transformaba a su alrededor. Los colores se volvieron más brillantes, los sonidos más claros. Podía escuchar el latido de la ciudad, sus alegrías y sus penas. El mundo de ${theme} se abría ante sus ojos como un libro sin estrenar.`,
      imagePrompt: `${characterVisual} wearing a red cape, standing in the middle of a vibrant city street that seems to glow with magical energy, arms slightly outstretched, amazed expression. Children's book illustration, soft warm colors, whimsical, gentle lighting.`,
    },
    {
      title: "Un grito de ayuda",
      text: `Un ladrido llamó su atención. Un pequeño perro con una diminuta capa corría hacia donde estaba, agitado y nervioso. Parecía querer decirle algo urgente. ${name} entendió al instante: alguien necesitaba ayuda.`,
      imagePrompt: `${characterVisual} wearing a red cape, looking down at a small brave dog wearing a tiny cape running towards them, in a city park with trees and flowers. Children's book illustration, soft warm colors, whimsical, gentle lighting.`,
    },
    {
      title: "Max, el valiente",
      text: `El perro se llamaba Max, y resultó ser el compañero más leal que ${name} podía haber imaginado. Max tenía un oído extraordinario: podía escuchar cuando alguien estaba triste o asustado, incluso desde el otro lado de la ciudad. Juntos formaban un equipo invencible.`,
      imagePrompt: `${characterVisual} wearing a red cape, standing proudly next to a brave dog wearing a tiny cape, both looking at the horizon, city skyline in background. Children's book illustration, soft warm colors, whimsical, gentle lighting.`,
    },
    {
      title: "Explorando la ciudad secreta",
      text: `Max guio a ${name} por callejones escondidos y plazas que no aparecían en ningún mapa. Descubrieron jardines flotantes, fuentes que cantaban melodías y escaleras que subían hasta las nubes. La ciudad guardaba secretos maravillosos para quien supiera mirar.`,
      imagePrompt: `${characterVisual} wearing a red cape, and a brave dog wearing a tiny cape, flying through the air above the city, discovering hidden gardens and sparkling fountains below. Children's book illustration, soft warm colors, whimsical, gentle lighting.`,
    },
    {
      title: "La primera prueba",
      text: `Su primer desafío apareció sin avisar: un grupo de pájaros atrapados en lo alto de un edificio antiguo. ${name} trepó con cuidado, sintiendo el vértigo en cada paso. Pero cada pájaro que liberaba le daba fuerzas para seguir. Max ladraba de ánimo desde abajo.`,
      imagePrompt: `${characterVisual} wearing a red cape, and a brave dog wearing a tiny cape, standing in front of a tall building, looking up at caged birds, determined expression, heroic pose. Children's book illustration, soft warm colors, whimsical, gentle lighting.`,
    },
    {
      title: "Un momento de calma",
      text: `Tras el rescate, ${name} y Max descansaron en un tejado, contemplando la puesta de sol. El cielo se teñía de naranjas y violetas. «Gracias por estar conmigo, Max», susurró ${name}. El perro apoyó la cabeza en su regazo, como diciendo: «Siempre».`,
      imagePrompt: `${characterVisual} wearing a red cape, sitting on a rooftop next to a brave dog, both watching a beautiful sunset, warm comforting glow, peaceful atmosphere. Children's book illustration, soft warm colors, whimsical, gentle lighting.`,
    },
    {
      title: "La gran amenaza",
      text: `De repente, una nube oscura y enorme cubrió el cielo de la ciudad. El viento soplaba con furia, arrancando hojas y apagando farolas. Los vecinos corrían asustados. ${name} miró a Max y supo que aquel era el verdadero desafío: la ciudad los necesitaba.`,
      imagePrompt: `${characterVisual} wearing a red cape, standing in front of a massive dark storm cloud with lightning, looking brave but determined, with the brave dog by their side. Children's book illustration, soft warm colors, whimsical, gentle lighting, with a hint of drama.`,
    },
    {
      title: "Todo parece perdido",
      text: `El temporal arreciaba y nada de lo que intentaban funcionaba. La oscuridad se hacía más densa, el frío más intenso. ${name} sintió miedo por primera vez. «¿Y si no puedo?», pensó, mirando sus manos temblorosas. Max gimió suavemente a su lado.`,
      imagePrompt: `${characterVisual} wearing a red cape, covering their face from strong wind, with the brave dog trying to shield them, dark looming cloud above, worried expression. Children's book illustration, soft warm colors, whimsical, gentle lighting, with a sense of urgency.`,
    },
    {
      title: "La verdadera fuerza",
      text: `Entonces ${name} recordó las palabras que siempre llevaba en el corazón: la verdadera valentía no es no tener miedo, sino actuar a pesar de él. Se acercó a la tormenta y, en lugar de luchar, habló con ella. Con palabras suaves y sinceras, la calmó poco a poco, como quien consuela a un amigo.`,
      imagePrompt: `${characterVisual} wearing a red cape, standing in front of the dark cloud, speaking to it gently, with a warm comforting light surrounding them, as the cloud begins to clear. Children's book illustration, soft warm colors, whimsical, gentle lighting, with a sense of resolution.`,
    },
    {
      title: "De vuelta a casa",
      text: `La tormenta se disipó y el sol volvió a bañar la ciudad con su luz dorada. ${name} se quitó la capa y sonrió. Había descubierto que el verdadero poder no estaba en ella, sino dentro de sí. Con Max trotando a su lado, caminó de vuelta a casa, sabiendo que siempre podría ser un héroe — con o sin capa.`,
      imagePrompt: `${characterVisual} walking back into the sunny peaceful city, with the brave dog by their side, looking happy and content, golden sunlight. Children's book illustration, soft warm colors, whimsical, gentle lighting.`,
    },
  ];
}

export function generateMockStory(input: StoryInput): GeneratedStory {
  const template = getTemplateConfig(input.templateId);
  const theme = template?.theme || "a magical adventure";
  const moral = template?.moral || "la bondad es la mayor fuerza de todas";
  const city = input.city || "una ciudad mágica";
  const characterVisual = buildCharacterVisualDescription(input);

  const sceneTemplates = buildScenes(input.childName, city, theme, characterVisual);

  const scenes = sceneTemplates.map((scene, index) => ({
    sceneNumber: index + 1,
    title: scene.title,
    text: scene.text,
    imagePrompt: scene.imagePrompt,
  }));

  const dedication = input.dedication
    ? `Para ${input.childName}, con todo el cariño de ${input.senderName || "alguien muy especial"}. ${input.dedication}`
    : `Para ${input.childName}, el alma más valiente y luminosa que conocemos. Que cada página de este libro te recuerde que llevas un héroe dentro.`;

  return {
    bookTitle: `${input.childName} y la capa extraordinaria`,
    scenes,
    dedication,
    finalMessage: `Y así, ${input.childName} descubrió que ${moral}. Y que los verdaderos héroes no necesitan capas — solo un corazón valiente y ganas de ayudar.`,
  };
}
