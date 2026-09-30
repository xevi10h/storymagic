/**
 * Printed-book copy and text normalisation — pure (no fonts, no @react-pdf), so the PDF
 * renderer and the web book viewer print exactly the same words in the book's language
 * (stories.locale, not the visitor's UI language).
 */

// ── Glyph-safe normalisation ──────────────────────────────────────────────

// Emoji and pictographs we cannot print (no colour-emoji font is embedded).
// Symbols covered by the embedded Noto Sans Symbols 2 subset are kept.
export const KEPT_SYMBOLS = new Set(["♥", "♡", "★", "☆", "❤", "✿", "☀", "☁", "✓", "✶", "❀"]);
export const PICTOGRAPHIC = /\p{Extended_Pictographic}/u;
// Variation selectors, ZWJ, skin-tone modifiers, keycap combiner, tag chars
const INVISIBLE_MODIFIERS = /[︎️‍⃣]|[\u{1F3FB}-\u{1F3FF}]|[\u{E0020}-\u{E007F}]/gu;

/**
 * Normalises text for print without changing its meaning:
 * - NFC composition (é typed as e + ◌́ becomes é)
 * - ŀ/Ŀ (U+0140/U+013F) → l·/L· (their canonical compatibility form)
 * - emoji are dropped (they would print as blank boxes); kept: ♥ ★ ✿ …
 * - collapses the whitespace left behind, preserves paragraph breaks
 */
export function sanitizePrintText(input: string): string {
  let text = input.normalize("NFC").replace(/ŀ/g, "l·").replace(/Ŀ/g, "L·");
  text = text.replace(INVISIBLE_MODIFIERS, "");
  text = Array.from(text)
    .filter((ch) => KEPT_SYMBOLS.has(ch) || !PICTOGRAPHIC.test(ch))
    .join("");
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * No lone word on a paragraph's last line: the last two words are joined with a no-break
 * space (the line breaker only breaks at ASCII spaces, so the planner measures exactly what
 * prints). Skipped when the pair is long enough to leave a gappy line.
 */
export function tieLastWords(text: string): string {
  return text
    .split("\n")
    .map((p) => {
      const m = /^(.*\S) (\S+) (\S+)$/.exec(p);
      return m && m[2].length + m[3].length <= 18 ? `${m[1]} ${m[2]} ${m[3]}` : p;
    })
    .join("\n");
}

// ── Locale typography ────────────────────────────────────────────────────

/**
 * Opening / closing quotation marks for printed quotes (dedication, back-cover synopsis).
 * es/ca: «angle quotes»; fr: « guillemets » with a no-break space (U+00A0 — the embedded
 * fonts have no U+202F narrow no-break space, and a breaking space could orphan the »);
 * en: “curly quotes”. Unknown locales fall back to Spanish, like pdfT().
 */
export function printQuotes(locale: string | undefined): [open: string, close: string] {
  switch (locale) {
    case "en":
      return ["“", "”"];
    case "fr":
      return ["« ", " »"];
    default:
      return ["«", "»"];
  }
}

/** "…per a l'" + "Anna" → no space after an elided article; otherwise one space. */
export function joinName(phrase: string, name: string): string {
  return phrase.endsWith("'") ? `${phrase}${name}` : `${phrase} ${name}`;
}

// ── Book copy (es / ca / en / fr) ─────────────────────────────────────────

const PDF_STRINGS: Record<string, Record<string, string>> = {
  es: {
    personalizedStory: "Una historia personalizada para",
    personalizedAdventure: "Una aventura personalizada para",
    createdFor: "Una historia creada especialmente para",
    end: "Fin",
    hero: "El héroe",
    heroine: "La heroína",
    years: "años",
    colophonText: "Ilustraciones creadas exclusivamente para este libro.\nDiseño editorial por Meapica.",
    defaultSynopsis: "{name} está a punto de vivir la aventura más extraordinaria de su vida.",
    mapKicker: "El mapa de la aventura",
    mapWhereIs: "¿Dónde está…?",
    mapSeekFind: "Busca y encuentra",
    mapHowToLittle: "Señala cada uno en el mapa.",
    mapHowTo: "Encuentra estas {count} cosas escondidas en el mapa.",
    mapTrail: "Sigue con el dedo el camino de puntos.",
    mapQuestions: "Preguntas",
    mapAnswers: "Respuestas",
  },
  ca: {
    personalizedStory: "Una història personalitzada per a",
    personalizedAdventure: "Una aventura personalitzada per a",
    createdFor: "Una història creada especialment per a",
    end: "Fi",
    hero: "L'heroi",
    heroine: "L'heroïna",
    years: "anys",
    colophonText: "Il·lustracions creades exclusivament per a aquest llibre.\nDisseny editorial per Meapica.",
    defaultSynopsis: "{name} està a punt de viure l'aventura més extraordinària de la seva vida.",
    mapKicker: "El mapa de l'aventura",
    mapWhereIs: "On és…?",
    mapSeekFind: "Busca i troba",
    mapHowToLittle: "Assenyala'ls al mapa.",
    mapHowTo: "Troba aquestes {count} coses amagades al mapa.",
    mapTrail: "Segueix amb el dit el camí de punts.",
    mapQuestions: "Preguntes",
    mapAnswers: "Respostes",
  },
  en: {
    personalizedStory: "A personalized story for",
    personalizedAdventure: "A personalized adventure for",
    createdFor: "A story created especially for",
    end: "The End",
    hero: "The hero",
    heroine: "The heroine",
    years: "years old",
    colophonText: "Illustrations created exclusively for this book.\nEditorial design by Meapica.",
    defaultSynopsis: "{name} is about to live the most extraordinary adventure of their life.",
    mapKicker: "The adventure map",
    mapWhereIs: "Where is…?",
    mapSeekFind: "Seek and find",
    mapHowToLittle: "Point to each one on the map.",
    mapHowTo: "Find these {count} things hidden on the map.",
    mapTrail: "Follow the dotted trail with your finger.",
    mapQuestions: "Questions",
    mapAnswers: "Answers",
  },
  fr: {
    personalizedStory: "Une histoire personnalisée pour",
    personalizedAdventure: "Une aventure personnalisée pour",
    createdFor: "Une histoire créée spécialement pour",
    end: "Fin",
    hero: "Le héros",
    heroine: "L'héroïne",
    years: "ans",
    colophonText: "Illustrations créées exclusivement pour ce livre.\nDesign éditorial par Meapica.",
    defaultSynopsis: "{name} est sur le point de vivre l'aventure la plus extraordinaire de sa vie.",
    mapKicker: "La carte de l'aventure",
    mapWhereIs: "Où est… ?",
    mapSeekFind: "Cherche et trouve",
    mapHowToLittle: "Montre chacun sur la carte.",
    mapHowTo: "Trouve ces {count} choses cachées sur la carte.",
    mapTrail: "Suis du doigt le chemin en pointillés.",
    mapQuestions: "Questions",
    mapAnswers: "Réponses",
  },
};

export function pdfT(locale: string | undefined, key: string): string {
  const loc = locale && PDF_STRINGS[locale] ? locale : "es";
  return PDF_STRINGS[loc][key] || PDF_STRINGS.es[key] || key;
}

/**
 * A "…for" phrase ready to be followed by the child's name. Catalan needs the
 * personal article: "per a la Núria", "per a en Pau", "per a l'Anna".
 * Join with `joinName` (no space after an elided "l'").
 */
export function pdfForName(locale: string | undefined, key: string, name: string, gender?: string): string {
  const phrase = pdfT(locale, key);
  if (locale !== "ca") return phrase;
  // ponytail: vowel/h+vowel → l'; ignores the unstressed i/u exceptions ("la Irene").
  if (/^h?[aeiouàèéíòóúï]/i.test(name.trim())) return `${phrase} l'`;
  return `${phrase} ${gender === "boy" ? "en" : "la"}`;
}

export const COLOR_NAMES: Record<string, Record<string, string>> = {
  es: { red: "Rojo", blue: "Azul", green: "Verde", purple: "Morado", orange: "Naranja", yellow: "Amarillo", pink: "Rosa", turquoise: "Turquesa" },
  ca: { red: "Vermell", blue: "Blau", green: "Verd", purple: "Lila", orange: "Taronja", yellow: "Groc", pink: "Rosa", turquoise: "Turquesa" },
  en: { red: "Red", blue: "Blue", green: "Green", purple: "Purple", orange: "Orange", yellow: "Yellow", pink: "Pink", turquoise: "Turquoise" },
  fr: { red: "Rouge", blue: "Bleu", green: "Vert", purple: "Violet", orange: "Orange", yellow: "Jaune", pink: "Rose", turquoise: "Turquoise" },
};

/** Localised name of a favourite colour id (FAVORITE_COLORS ids), as printed on the hero page. */
export function colorName(locale: string | undefined, colorId: string): string {
  return COLOR_NAMES[locale ?? "es"]?.[colorId] ?? COLOR_NAMES.es[colorId] ?? colorId;
}

/** The adventure-map panel's copy for a game (pp. 28–29), in the book's language. */
export function mapPanelStrings(locale: string | undefined, band: "little" | "middle" | "big", itemCount: number) {
  return {
    kicker: pdfT(locale, "mapKicker"),
    title: pdfT(locale, band === "little" ? "mapWhereIs" : "mapSeekFind"),
    howTo: pdfT(locale, band === "little" ? "mapHowToLittle" : "mapHowTo").replace("{count}", String(itemCount)),
    trail: pdfT(locale, "mapTrail"),
    questions: pdfT(locale, "mapQuestions"),
    answers: pdfT(locale, "mapAnswers"),
  };
}

/** Interest ids (create-store) as printed on the hero page — same labels as messages data.interests. */
const INTEREST_LABELS: Record<string, Record<string, string>> = {
  es: { animals: "Animales", sports: "Deportes", music: "Música", art: "Arte", science: "Ciencia", nature: "Naturaleza", space: "Espacio", cooking: "Cocina", reading: "Lectura", superheroes: "Superhéroes", castles: "Castillos", dinosaurs: "Dinosaurios" },
  ca: { animals: "Animals", sports: "Esports", music: "Música", art: "Art", science: "Ciència", nature: "Natura", space: "Espai", cooking: "Cuina", reading: "Lectura", superheroes: "Superherois", castles: "Castells", dinosaurs: "Dinosaures" },
  en: { animals: "Animals", sports: "Sports", music: "Music", art: "Art", science: "Science", nature: "Nature", space: "Space", cooking: "Cooking", reading: "Reading", superheroes: "Superheroes", castles: "Castles", dinosaurs: "Dinosaurs" },
  fr: { animals: "Animaux", sports: "Sports", music: "Musique", art: "Art", science: "Science", nature: "Nature", space: "Espace", cooking: "Cuisine", reading: "Lecture", superheroes: "Super-héros", castles: "Châteaux", dinosaurs: "Dinosaures" },
};

/** Localised interest label; unknown ids (free text) are printed as written. */
export function interestLabel(locale: string | undefined, id: string): string {
  return INTEREST_LABELS[locale ?? "es"]?.[id] ?? INTEREST_LABELS.es[id] ?? id;
}
