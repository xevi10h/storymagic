/**
 * Standalone test script — generates a PDF from mock data to verify layout.
 * Usage: node scripts/generate-test-pdf.mjs
 *
 * This script bypasses Next.js/Supabase and renders the PDF directly.
 */

import { createElement } from "react";
import { renderToBuffer, Document, Page, View, Text, Image, Font, StyleSheet } from "@react-pdf/renderer";
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Inline theme + book constants ─────────────────────────────────────────

const MM_TO_PT = 2.83465;

const BOOK = {
  pageWidth: 216 * MM_TO_PT,
  pageHeight: 216 * MM_TO_PT,
  trimWidth: 210 * MM_TO_PT,
  trimHeight: 210 * MM_TO_PT,
  bleed: 3 * MM_TO_PT,
  safeMargin: 15 * MM_TO_PT,
  contentMargin: 18 * MM_TO_PT,
};

const COLORS = {
  cream: "#FDF8F0",
  paper: "#FFFCF7",
  warmWhite: "#FFF9F2",
  textDark: "#2C1810",
  textMedium: "#5D4037",
  textMuted: "#A1887F",
  textLight: "#D7CCC8",
  gold: "#D4AF37",
};

const FONTS = { display: "Fredoka", body: "PlusJakartaSans" };

const theme = {
  coverGradientStart: "#7f1d1d",
  coverGradientEnd: "#991b1b",
  accent: "#dc2626",
  accentLight: "#fee2e2",
  pageTint: "#fef7f7",
  titleColor: "#7f1d1d",
  ornamentColor: "#fca5a5",
};

// ── Font registration ──────────────────────────────────────────────────────

Font.register({
  family: FONTS.display,
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
  family: FONTS.body,
  fonts: [
    {
      src: "https://fonts.gstatic.com/s/plusjakartasans/v12/LDIbaomQNQcsA88c7O9yZ4KMCoOg4IA6-91aHEjcWuA_qU7NSg.ttf",
      fontWeight: 400,
    },
    {
      src: "https://fonts.gstatic.com/s/plusjakartasans/v12/LDIZaomQNQcsA88c7O9yZ4KMCoOg4KozySKCdSNG9OcqYQ0lCR_Q.ttf",
      fontWeight: 400,
      fontStyle: "italic",
    },
    {
      src: "https://fonts.gstatic.com/s/plusjakartasans/v12/LDIbaomQNQcsA88c7O9yZ4KMCoOg4IA6-91aHEjcWuA_d0nNSg.ttf",
      fontWeight: 600,
    },
  ],
});

Font.registerHyphenationCallback((word) => [word]);

// ── Mock story data ────────────────────────────────────────────────────────

const MOCK_SCENES = [
  {
    sceneNumber: 1,
    title: "Un día cualquiera",
    text: "Sofía vivía en Barcelona, y cada mañana era una pequeña aventura en sí misma. El olor del pan recién horneado llenaba el aire cuando bajaba las escaleras, y el sonido de los pájaros marcaba el ritmo del día. Le gustaba observar el cielo desde la ventana, buscando formas en las nubes: allí un dragón, aquí un barco pirata. «Hoy será un día especial», se dijo en voz baja, aunque todavía no sabía por qué. Un cosquilleo extraño le recorrió la tripa. Y entonces, sin previo aviso, todo cambió.",
    imagePrompt: "test",
  },
  {
    sceneNumber: 2,
    title: "La señal",
    text: "Mientras caminaba por las calles empedradas de Barcelona, Sofía notó un destello extraño junto a una farola. Era una capa roja, pequeña y brillante, que relucía como si guardara un secreto dentro. Al agacharse a recogerla, sintió un hormigueo cálido en la punta de los dedos, como cuando se toca una bombilla encendida. La tela era suave como el agua y ligera como el aire. «¿Cómo habrá llegado aquí?», pensó Sofía, mirando a ambos lados de la calle vacía. Nadie. Solo el viento, que parecía susurrarle algo que no llegaba a entender. Con cuidado, la dobló y se la guardó bajo el brazo.",
    imagePrompt: "test",
  },
  {
    sceneNumber: 3,
    title: "El despertar",
    text: "En cuanto Sofía se puso la capa sobre los hombros, el mundo se transformó por completo. Los colores estallaron: el rojo de los buzones brillaba como rubíes, el verde de los árboles cantaba con mil tonos distintos. Podía escuchar el latido de la ciudad, sus risas y sus susurros, como si el mundo entero tuviera corazón. «¿Qué me está pasando?», murmuró Sofía, mirando sus manos como si fueran nuevas. El sonido de las risas de unos niños llegó desde tres calles de distancia, nítido y claro. El mundo de la aventura se abría ante sus ojos como un libro lleno de páginas en blanco, esperando ser escritas.",
    imagePrompt: "test",
  },
  {
    sceneNumber: 4,
    title: "Un grito de ayuda",
    text: "Un ladrido agudo cortó el aire de la tarde. Sofía giró la cabeza y vio a un pequeño perro corriendo hacia ella a toda velocidad, con las orejas hacia atrás y los ojos muy abiertos. Llevaba atada al cuello una diminuta capa, igual que la suya pero azul. «Hola, pequeño, ¿qué te pasa?», dijo Sofía arrodillándose en el suelo. El perro giraba en círculos, miraba hacia el callejón y volvía, como si le estuviera pidiendo que le siguiera. Algo urgente, algo importante, necesitaba su ayuda. Sofía sintió que el corazón le latía más rápido. Y sin pensarlo dos veces, se levantó y echó a correr.",
    imagePrompt: "test",
  },
  {
    sceneNumber: 5,
    title: "Max, el valiente",
    text: "El perro se llamaba Max, y pronto Sofía descubrió que era el compañero más extraordinario que podría haber imaginado. Max tenía un oído tan fino que podía escuchar cuando alguien estaba triste o asustado, incluso desde el otro extremo de la ciudad. Con solo levantar la nariz, sabía exactamente dónde se necesitaba ayuda. «Eres increíble, Max», dijo Sofía, acariciándole las orejas. Max respondió con un pequeño ladrido orgulloso y movió la cola tan rápido que casi despegó del suelo. Juntos formaban un equipo perfecto: Sofía con su fuerza y su corazón generoso, y Max con su olfato prodigioso. Nadie los detendría.",
    imagePrompt: "test",
  },
  {
    sceneNumber: 6,
    title: "Explorando la ciudad secreta",
    text: "Max guio a Sofía por rincones de Barcelona que nunca había visto: callejones cubiertos de musgo brillante, plazas escondidas donde el tiempo parecía detenerse. Descubrieron una escalera de caracol que subía hasta un jardín flotante entre las nubes, con flores que cambiaban de color según el viento. El olor a rosas y canela llenaba el aire. «¡No me puedo creer que esto existiera aquí siempre!», exclamó Sofía, girando sobre sí misma para ver todo a la vez. Max trotaba delante, feliz de compartir sus secretos favoritos. Cada esquina traía una nueva sorpresa, y Sofía sentía que su corazón crecía con cada descubrimiento.",
    imagePrompt: "test",
  },
  {
    sceneNumber: 7,
    title: "La primera prueba",
    text: "El primer desafío llegó sin avisar: desde la cima de un edificio antiguo, llegaban los chillidos asustados de unos pájaros atrapados en una vieja jaula olvidada. Sofía miró hacia arriba y tragó saliva: eran muchos pisos. «Puedo hacerlo», se dijo en voz baja, aunque le temblaban un poco las rodillas. Con cuidado, comenzó a trepar por la fachada de piedra, buscando cada grieta y cada saliente. Max ladraba ánimos desde abajo, sin moverse ni un centímetro de su sitio. Piso a piso, la altura aumentaba, pero también la determinación de Sofía. Cuando por fin abrió la jaula y vio volar a los pájaros libres, sintió una alegría tan grande que tuvo que sujetarse para no caer.",
    imagePrompt: "test",
  },
  {
    sceneNumber: 8,
    title: "Un momento de calma",
    text: "Después de tanto correr y ayudar, Sofía y Max se sentaron en el tejado más alto que encontraron. El sol se ponía despacio, pintando el cielo de naranja, rosa y violeta, como si alguien hubiera derramado un bote de acuarelas gigante. «Ha sido un día increíble, Max», dijo Sofía en voz baja. El perro apoyó la cabeza en su regazo y suspiró, contento. Por un momento, todo estaba en silencio: ni coches, ni voces, solo el viento suave y el latido de la ciudad durmiendo. Sofía se dio cuenta de que nunca antes se había sentido tan acompañada, tan completa. Era una sensación nueva, cálida como el sol que se escondía lentamente.",
    imagePrompt: "test",
  },
  {
    sceneNumber: 9,
    title: "La gran amenaza",
    text: "La tranquilidad duró poco. Sin previo aviso, una nube enorme y oscura como la tinta cubrió el cielo de Barcelona. El viento comenzó a aullar, arrancando hojas y zarandeando las farolas. La lluvia llegó de golpe, fría y furiosa, y la gente corría buscando refugio. Max gruñó suavemente, con el pelo erizado. Sofía miró la tormenta y sintió algo que nunca antes había sentido: un miedo de verdad, un miedo que le pesaba en el pecho como una piedra. Pero entonces miró a Max, y en sus ojos vio algo que le devolvió las fuerzas. «Tenemos que hacer algo», dijo Sofía con voz firme. La ciudad los necesitaba.",
    imagePrompt: "test",
  },
  {
    sceneNumber: 10,
    title: "Todo parece perdido",
    text: "Sofía probó todo lo que se le ocurrió: gritar a la tormenta, pedir que parara, poner los brazos en cruz como un escudo. Pero nada funcionaba. La oscuridad crecía, el frío se colaba por debajo de la capa, y el viento soplaba cada vez más fuerte. Las lágrimas se mezclaban con la lluvia en las mejillas de Sofía. «¿Y si no puedo?», pensó, mirando sus manos temblorosas. «¿Y si no soy suficiente?». Max gimió suavemente y se acercó más, apoyando su cuerpo caliente contra sus piernas. Y en ese contacto pequeño y firme, Sofía encontró algo inesperado: el coraje para intentarlo una vez más.",
    imagePrompt: "test",
  },
  {
    sceneNumber: 11,
    title: "La verdadera fuerza",
    text: "Entonces Sofía recordó algo que alguien le había dicho una vez: «La verdadera valentía no es no tener miedo, sino actuar aunque lo tengas». Se limpió las lágrimas, respiró hondo y se acercó despacio al centro de la tormenta. No con los puños apretados, sino con el corazón abierto. «Sé que estás enfadada», dijo en voz alta, hablándole a la nube como si fuera un amigo que necesita escucha. «Yo también me enfado a veces. Pero no hace falta hacer tanto daño». La tormenta vaciló. El viento amainó un poco. Sofía siguió hablando, con calma y con cariño, y poco a poco, como un niño que se queda dormido, la nube oscura comenzó a deshacerse.",
    imagePrompt: "test",
  },
  {
    sceneNumber: 12,
    title: "De vuelta a casa",
    text: "La tormenta se disipó y el sol volvió a aparecer, bañando las calles mojadas de Barcelona con una luz dorada y limpia. La gente salió de sus casas poco a poco, mirando el cielo con asombro. Sofía se quitó la capa con cuidado y la dobló entre sus brazos. Había aprendido algo muy importante ese día: el verdadero poder no estaba en la capa, sino dentro de sí misma. Siempre había estado ahí, esperando el momento adecuado. Max movía la cola sin parar, orgulloso de su compañera. De camino a casa, Sofía iba sonriendo, con los pies mojados y el corazón lleno. Y supo, con total certeza, que el mundo era un lugar mejor cuando uno decide ayudar.",
    imagePrompt: "test",
  },
];

const MOCK_STORY = {
  bookTitle: "Sofía y la capa extraordinaria",
  scenes: MOCK_SCENES,
  dedication: "Para Sofía, el alma más valiente y luminosa que conocemos. Que cada página de este libro te recuerde que llevas un héroe dentro.",
  finalMessage: "Y así, Sofía descubrió que la bondad es la mayor fuerza de todas. Y que los verdaderos héroes no necesitan capas — solo un corazón valiente y ganas de ayudar.",
};

// ── Components (minimal, no imports from src/) ────────────────────────────

const SCENE_SPREADS = [
  "galeria", "pergamino", "ventana", "pergamino",
  "galeria", "ventana", "galeria", "pergamino",
  "ventana", "galeria", "pergamino", "ventana",
];

function el(type, props, ...children) {
  return createElement(type, props, ...children);
}

function FrameBorder({ color, inset }) {
  return el(View, {
    style: {
      position: "absolute", top: inset, left: inset, right: inset, bottom: inset,
      borderWidth: 0.75, borderColor: color, borderRadius: 6, opacity: 0.4,
    }
  });
}

function PageNumber({ num, color }) {
  const c = color || COLORS.textLight;
  return el(View, {
    style: { position: "absolute", bottom: BOOK.bleed + 10, left: 0, right: 0, alignItems: "center" }
  },
    el(View, { style: { flexDirection: "row", alignItems: "center", gap: 6 } },
      el(View, { style: { width: 12, height: 0.5, backgroundColor: c } }),
      el(Text, { style: { fontFamily: FONTS.body, fontSize: 8, color: c } }, String(num)),
      el(View, { style: { width: 12, height: 0.5, backgroundColor: c } }),
    )
  );
}

function FullBleedPlaceholder({ sceneNumber }) {
  return el(View, {
    style: {
      width: BOOK.pageWidth, height: BOOK.pageHeight,
      backgroundColor: "#e8d5c4",
      justifyContent: "center", alignItems: "center",
    }
  },
    el(Text, { style: { fontFamily: FONTS.display, fontSize: 32, color: "#c4a882", fontWeight: 600 } }, `Escena ${sceneNumber}`),
    el(Text, { style: { fontFamily: FONTS.body, fontSize: 11, color: "#c4a882", marginTop: 8 } }, "Ilustración")
  );
}

function SceneBadge({ num, top, left, right }) {
  return el(View, {
    style: {
      position: "absolute", top, left, right,
      width: 28, height: 28, borderRadius: 14,
      backgroundColor: theme.accent,
      justifyContent: "center", alignItems: "center",
    }
  },
    el(Text, { style: { fontFamily: FONTS.display, fontSize: 11, color: "#fff", fontWeight: 600 } }, String(num))
  );
}

// ── Spread components ──────────────────────────────────────────────────────

function SpreadGaleriaA({ scene, pageNumber }) {
  return el(Page, { size: [BOOK.pageWidth, BOOK.pageHeight], style: { width: BOOK.pageWidth, height: BOOK.pageHeight, position: "relative" } },
    el(FullBleedPlaceholder, { sceneNumber: scene.sceneNumber }),
    el(View, {
      style: {
        position: "absolute", bottom: 0, left: 0, right: 0,
        paddingTop: 28, paddingBottom: BOOK.contentMargin + 10,
        paddingHorizontal: BOOK.contentMargin,
        backgroundColor: "rgba(0,0,0,0.42)",
      }
    },
      el(Text, { style: { fontFamily: FONTS.display, fontSize: 20, fontWeight: 600, color: "#ffffff", lineHeight: 1.3 } }, scene.title)
    ),
    el(SceneBadge, { num: scene.sceneNumber, top: BOOK.contentMargin, left: BOOK.contentMargin }),
    el(PageNumber, { num: pageNumber, color: "#ffffff88" }),
  );
}

function SpreadGaleriaB({ scene, pageNumber }) {
  return el(Page, { size: [BOOK.pageWidth, BOOK.pageHeight], style: { width: BOOK.pageWidth, height: BOOK.pageHeight, backgroundColor: COLORS.paper, position: "relative" } },
    el(FrameBorder, { color: theme.ornamentColor, inset: BOOK.contentMargin - 5 }),
    el(View, { style: { flex: 1, justifyContent: "center", alignItems: "center", padding: BOOK.contentMargin + 15 } },
      el(View, { style: { alignItems: "center", maxWidth: BOOK.trimWidth * 0.78 } },
        el(View, { style: { backgroundColor: theme.accentLight, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3, marginBottom: 14 } },
          el(Text, { style: { fontFamily: FONTS.display, fontSize: 9, color: theme.accent, letterSpacing: 1 } }, String(scene.sceneNumber))
        ),
        el(Text, { style: { fontFamily: FONTS.display, fontSize: 22, fontWeight: 600, color: theme.titleColor, textAlign: "center", lineHeight: 1.3, marginBottom: 16 } }, scene.title),
        el(View, { style: { width: 80, height: 1, backgroundColor: theme.ornamentColor, marginBottom: 16 } }),
        el(Text, { style: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textDark, lineHeight: 1.9, textAlign: "center" } }, scene.text),
      )
    ),
    el(PageNumber, { num: pageNumber }),
  );
}

function SpreadPergaminoA({ scene, pageNumber }) {
  return el(Page, { size: [BOOK.pageWidth, BOOK.pageHeight], style: { width: BOOK.pageWidth, height: BOOK.pageHeight, backgroundColor: theme.accentLight, position: "relative" } },
    el(FrameBorder, { color: theme.ornamentColor, inset: BOOK.contentMargin - 5 }),
    el(View, { style: { flex: 1, justifyContent: "center", padding: BOOK.contentMargin + 12 } },
      el(Text, { style: { fontFamily: FONTS.display, fontSize: 11, color: theme.ornamentColor, letterSpacing: 2, marginBottom: 10 } }, String(scene.sceneNumber).padStart(2, "0")),
      el(Text, { style: { fontFamily: FONTS.display, fontSize: 22, fontWeight: 600, color: theme.titleColor, lineHeight: 1.3, marginBottom: 14 } }, scene.title),
      el(View, { style: { width: BOOK.trimWidth * 0.35, height: 3, backgroundColor: theme.accent, borderRadius: 2, marginBottom: 18, opacity: 0.8 } }),
      el(Text, { style: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textDark, lineHeight: 1.9 } }, scene.text),
    ),
    el(PageNumber, { num: pageNumber }),
  );
}

function SpreadPergaminoB({ scene, pageNumber }) {
  return el(Page, { size: [BOOK.pageWidth, BOOK.pageHeight], style: { width: BOOK.pageWidth, height: BOOK.pageHeight, position: "relative" } },
    el(FullBleedPlaceholder, { sceneNumber: scene.sceneNumber }),
    el(SceneBadge, { num: scene.sceneNumber, top: BOOK.contentMargin, right: BOOK.contentMargin }),
    el(PageNumber, { num: pageNumber, color: "#ffffff88" }),
  );
}

function SpreadVentanaA({ scene, pageNumber }) {
  const firstChar = scene.text.charAt(0);
  const restText = scene.text.slice(1);
  return el(Page, { size: [BOOK.pageWidth, BOOK.pageHeight], style: { width: BOOK.pageWidth, height: BOOK.pageHeight, backgroundColor: COLORS.paper, position: "relative" } },
    el(FrameBorder, { color: theme.ornamentColor, inset: BOOK.contentMargin - 5 }),
    el(View, { style: { flex: 1, justifyContent: "center", padding: BOOK.contentMargin + 15 } },
      el(Text, { style: { fontFamily: FONTS.display, fontSize: 18, fontWeight: 600, color: theme.titleColor, marginBottom: 18, lineHeight: 1.3 } }, scene.title),
      el(View, { style: { flexDirection: "row", alignItems: "flex-start" } },
        el(View, { style: { marginRight: 6, marginTop: 2 } },
          el(Text, { style: { fontFamily: FONTS.display, fontSize: 64, fontWeight: 600, color: theme.accent, lineHeight: 1 } }, firstChar)
        ),
        el(View, { style: { flex: 1 } },
          el(Text, { style: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textDark, lineHeight: 1.9 } }, restText)
        ),
      ),
      el(View, { style: { marginTop: 20, width: 70, height: 1, backgroundColor: theme.ornamentColor } }),
    ),
    el(PageNumber, { num: pageNumber }),
  );
}

function SpreadVentanaB({ scene, pageNumber }) {
  return el(Page, { size: [BOOK.pageWidth, BOOK.pageHeight], style: { width: BOOK.pageWidth, height: BOOK.pageHeight, position: "relative" } },
    el(FullBleedPlaceholder, { sceneNumber: scene.sceneNumber }),
    el(SceneBadge, { num: scene.sceneNumber, top: BOOK.contentMargin, left: BOOK.contentMargin }),
    el(View, {
      style: {
        position: "absolute", bottom: 0, left: 0, right: 0,
        paddingTop: 28, paddingBottom: BOOK.contentMargin + 10,
        paddingHorizontal: BOOK.contentMargin,
        backgroundColor: "rgba(0,0,0,0.42)",
      }
    },
      el(Text, { style: { fontFamily: FONTS.display, fontSize: 18, fontWeight: 600, color: "#ffffff", lineHeight: 1.3 } }, scene.title)
    ),
    el(PageNumber, { num: pageNumber, color: "#ffffff88" }),
  );
}

// ── Structural pages ───────────────────────────────────────────────────────

function CoverPage() {
  return el(Page, { size: [BOOK.pageWidth, BOOK.pageHeight], style: { width: BOOK.pageWidth, height: BOOK.pageHeight, position: "relative" } },
    el(View, { style: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.coverGradientStart } }),
    el(View, { style: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.coverGradientEnd, opacity: 0.4 } }),
    el(View, { style: { flex: 1, justifyContent: "center", alignItems: "center", padding: BOOK.contentMargin + 10 } },
      el(Text, { style: { fontFamily: FONTS.display, fontSize: 10, color: "#ffffff88", letterSpacing: 3, marginBottom: 20 } }, "MEAPICA"),
      el(View, { style: { width: 50, height: 1, backgroundColor: "#ffffff44", marginBottom: 20 } }),
      el(Text, { style: { fontFamily: FONTS.display, fontSize: 32, fontWeight: 600, color: "#ffffff", lineHeight: 1.2, textAlign: "center" } }, MOCK_STORY.bookTitle),
      el(View, { style: { width: 50, height: 1, backgroundColor: "#ffffff44", marginTop: 20, marginBottom: 20 } }),
      el(Text, { style: { fontFamily: FONTS.body, fontSize: 13, color: "#ffffffcc", textAlign: "center" } }, "Una historia personalizada para"),
      el(Text, { style: { fontFamily: FONTS.display, fontSize: 22, fontWeight: 600, color: "#ffffff", marginTop: 6, textAlign: "center" } }, "Sofía"),
    )
  );
}

function EndpapersPage() {
  return el(Page, { size: [BOOK.pageWidth, BOOK.pageHeight], style: { width: BOOK.pageWidth, height: BOOK.pageHeight, backgroundColor: theme.accentLight, position: "relative" } },
    el(View, { style: { flex: 1, justifyContent: "center", alignItems: "center" } },
      el(Text, { style: { fontFamily: FONTS.display, fontSize: 48, color: theme.accent, opacity: 0.15 } }, "✦"),
    )
  );
}

function TitlePage() {
  return el(Page, { size: [BOOK.pageWidth, BOOK.pageHeight], style: { width: BOOK.pageWidth, height: BOOK.pageHeight, backgroundColor: COLORS.paper, position: "relative" } },
    el(FrameBorder, { color: theme.ornamentColor, inset: BOOK.contentMargin - 5 }),
    el(View, { style: { flex: 1, justifyContent: "center", alignItems: "center", padding: BOOK.contentMargin + 20 } },
      el(Text, { style: { fontFamily: FONTS.display, fontSize: 9, color: COLORS.textMuted, letterSpacing: 2, marginBottom: 24 } }, "MEAPICA PRESENTA"),
      el(Text, { style: { fontFamily: FONTS.display, fontSize: 28, fontWeight: 600, color: theme.titleColor, textAlign: "center", lineHeight: 1.3, marginBottom: 24 } }, MOCK_STORY.bookTitle),
      el(Text, { style: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.textMedium, textAlign: "center" } }, "Una aventura personalizada para"),
      el(Text, { style: { fontFamily: FONTS.display, fontSize: 20, fontWeight: 600, color: theme.accent, marginTop: 8, textAlign: "center" } }, "Sofía"),
    )
  );
}

function DedicationPage() {
  return el(Page, { size: [BOOK.pageWidth, BOOK.pageHeight], style: { width: BOOK.pageWidth, height: BOOK.pageHeight, backgroundColor: COLORS.paper, position: "relative" } },
    el(FrameBorder, { color: theme.ornamentColor, inset: BOOK.contentMargin - 5 }),
    el(View, { style: { flex: 1, justifyContent: "center", alignItems: "center", padding: BOOK.contentMargin + 20 } },
      el(View, { style: { alignItems: "center", maxWidth: BOOK.trimWidth * 0.65 } },
        el(Text, { style: { fontFamily: FONTS.display, fontSize: 42, color: COLORS.gold, opacity: 0.4, marginBottom: -8 } }, "\u201C"),
        el(Text, { style: { fontFamily: FONTS.body, fontSize: 14, color: "#5D4037", lineHeight: 1.8, fontStyle: "italic", textAlign: "center" } }, MOCK_STORY.dedication),
        el(Text, { style: { fontFamily: FONTS.display, fontSize: 42, color: COLORS.gold, opacity: 0.4, marginTop: -4 } }, "\u201D"),
      )
    )
  );
}

function FinalPage() {
  return el(Page, { size: [BOOK.pageWidth, BOOK.pageHeight], style: { width: BOOK.pageWidth, height: BOOK.pageHeight, backgroundColor: COLORS.paper, position: "relative" } },
    el(FrameBorder, { color: theme.ornamentColor, inset: BOOK.contentMargin - 5 }),
    el(View, { style: { flex: 1, justifyContent: "center", alignItems: "center", padding: BOOK.contentMargin + 20 } },
      el(View, { style: { alignItems: "center", maxWidth: BOOK.trimWidth * 0.7 } },
        el(Text, { style: { fontFamily: FONTS.display, fontSize: 16, fontWeight: 600, color: "#5D4037", lineHeight: 1.5, textAlign: "center" } }, MOCK_STORY.finalMessage),
        el(View, { style: { width: 80, height: 1, backgroundColor: theme.ornamentColor, marginTop: 20, marginBottom: 20 } }),
        el(Text, { style: { fontFamily: FONTS.display, fontSize: 16, fontWeight: 600, color: theme.accent } }, "Fin"),
      )
    )
  );
}

function AboutReaderPage() {
  return el(Page, { size: [BOOK.pageWidth, BOOK.pageHeight], style: { width: BOOK.pageWidth, height: BOOK.pageHeight, backgroundColor: COLORS.paper, position: "relative" } },
    el(FrameBorder, { color: theme.ornamentColor, inset: BOOK.contentMargin - 5 }),
    el(View, { style: { flex: 1, justifyContent: "center", alignItems: "center", padding: BOOK.contentMargin + 20 } },
      el(Text, { style: { fontFamily: FONTS.display, fontSize: 9, color: COLORS.textMuted, letterSpacing: 2, marginBottom: 16 } }, "SOBRE EL PROTAGONISTA"),
      el(Text, { style: { fontFamily: FONTS.display, fontSize: 24, fontWeight: 600, color: theme.accent, marginTop: 20, textAlign: "center" } }, "Sofía"),
      el(Text, { style: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.textMedium, marginTop: 8, textAlign: "center" } }, "7 años"),
      el(View, { style: { marginTop: 24, marginBottom: 24, width: BOOK.trimWidth * 0.4, height: 1, backgroundColor: theme.ornamentColor } }),
      el(Text, { style: { fontFamily: FONTS.body, fontStyle: "italic", fontSize: 11, color: COLORS.textMedium, textAlign: "center", lineHeight: 1.8 } }, "Este libro fue creado especialmente para ti.\nRecuerda siempre que eres capaz de vivir\nlas aventuras más increíbles."),
      el(View, { style: { marginTop: 20, width: BOOK.trimWidth * 0.5, height: 60, borderWidth: 0.5, borderColor: theme.ornamentColor, borderRadius: 8, justifyContent: "center", alignItems: "center", opacity: 0.5 } },
        el(Text, { style: { fontFamily: FONTS.body, fontSize: 7, color: COLORS.textLight } }, "Dibuja aquí tu momento favorito")
      ),
    )
  );
}

function BackCoverPage() {
  return el(Page, { size: [BOOK.pageWidth, BOOK.pageHeight], style: { width: BOOK.pageWidth, height: BOOK.pageHeight, position: "relative" } },
    el(View, { style: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.coverGradientStart } }),
    el(View, { style: { flex: 1, justifyContent: "center", alignItems: "center", padding: BOOK.contentMargin + 20 } },
      el(Text, { style: { fontFamily: FONTS.body, fontSize: 11, color: "#ffffffbb", lineHeight: 1.5, textAlign: "center" } }, "Esta historia fue creada especialmente para"),
      el(Text, { style: { fontFamily: FONTS.display, fontSize: 24, fontWeight: 600, color: "#ffffff", marginTop: 8, textAlign: "center" } }, "Sofía"),
      el(View, { style: { marginTop: 40, alignItems: "center" } },
        el(Text, { style: { fontFamily: FONTS.display, fontSize: 10, color: "#ffffff88", letterSpacing: 3 } }, "MEAPICA"),
        el(Text, { style: { fontFamily: FONTS.body, fontSize: 7, color: "#ffffff55", marginTop: 4, letterSpacing: 1 } }, "Historias reales para tocar"),
      )
    ),
    el(View, { style: { position: "absolute", bottom: BOOK.contentMargin + 10, left: BOOK.contentMargin, right: BOOK.contentMargin, alignItems: "center" } },
      el(Text, { style: { fontFamily: FONTS.body, fontSize: 7, color: "#ffffff44", textAlign: "center", lineHeight: 1.7 } }, "Texto generado por inteligencia artificial. Ilustraciones por Recraft V3.\nDiseño editorial por Meapica Press — meapica.com")
    )
  );
}

// ── Build the document ─────────────────────────────────────────────────────

function TestBook() {
  const scenePages = [];
  let pageCounter = 5;

  for (let i = 0; i < MOCK_SCENES.length; i++) {
    const scene = MOCK_SCENES[i];
    const spreadType = SCENE_SPREADS[i] ?? "galeria";

    if (spreadType === "galeria") {
      scenePages.push(el(SpreadGaleriaA, { key: `ga-a-${i}`, scene, pageNumber: pageCounter }));
      pageCounter++;
      scenePages.push(el(SpreadGaleriaB, { key: `ga-b-${i}`, scene, pageNumber: pageCounter }));
      pageCounter++;
    } else if (spreadType === "pergamino") {
      scenePages.push(el(SpreadPergaminoA, { key: `pe-a-${i}`, scene, pageNumber: pageCounter }));
      pageCounter++;
      scenePages.push(el(SpreadPergaminoB, { key: `pe-b-${i}`, scene, pageNumber: pageCounter }));
      pageCounter++;
    } else {
      scenePages.push(el(SpreadVentanaA, { key: `ve-a-${i}`, scene, pageNumber: pageCounter }));
      pageCounter++;
      scenePages.push(el(SpreadVentanaB, { key: `ve-b-${i}`, scene, pageNumber: pageCounter }));
      pageCounter++;
    }
  }

  return el(Document, { title: MOCK_STORY.bookTitle, author: "Meapica" },
    el(CoverPage, null),
    el(EndpapersPage, null),
    el(TitlePage, null),
    el(DedicationPage, null),
    ...scenePages,
    el(FinalPage, null),
    el(AboutReaderPage, null),
    el(EndpapersPage, null),
    el(BackCoverPage, null),
  );
}

// ── Render ─────────────────────────────────────────────────────────────────

console.log("Generating PDF...");
const buffer = await renderToBuffer(el(TestBook, null));
const outputPath = path.join(__dirname, "test-output.pdf");
writeFileSync(outputPath, buffer);
console.log(`PDF written to: ${outputPath} (${(buffer.length / 1024).toFixed(0)} KB)`);
