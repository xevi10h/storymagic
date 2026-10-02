// "Respuesta de los Reyes Magos": the letter the Kings write back, composed from
// hand-written templates (no AI at runtime). Pure: the form previews exactly the
// text the PDF prints (src/lib/tools/pdf/reply-document.tsx).
//
// Spanish and Catalan are written separately, not translated: the Catalan letter
// speaks of the Patge Reial and the Carter Reial, uses the personal article
// ("en Melcior") and the comma after the salutation; the Spanish one, pajes,
// camellos and the colon. Every sentence addresses the child as "tú".

export const ACHIEVEMENT_IDS = [
  "reading",
  "schoolStart",
  "schoolEffort",
  "helpingHome",
  "sibling",
  "sharing",
  "brave",
  "newSkills",
  "friends",
  "kindness",
  "ownBed",
  "pet",
] as const;
export type AchievementId = (typeof ACHIEVEMENT_IDS)[number];

export const CHALLENGE_IDS = [
  "tidyToys",
  "bedtime",
  "veggies",
  "patience",
  "siblingPeace",
  "teeth",
  "homework",
  "noShouting",
  "screens",
  "listening",
] as const;
export type ChallengeId = (typeof CHALLENGE_IDS)[number];

export type ReplyGender = "boy" | "girl" | "neutral";
type Gendered = string | Record<ReplyGender, string>;

export interface ReplyComposeInput {
  locale: "es" | "ca";
  name: string;
  gender: ReplyGender;
  achievements: readonly AchievementId[];
  customAchievement: string;
  challenge: ChallengeId | null;
  moment: "before" | "morning";
  postscript: string;
  variant: number;
}

export interface ComposedReply {
  /** "De parte de Sus Majestades…" */
  eyebrow: string;
  /** "Oriente, 5 de enero de 2027" */
  dateLine: string;
  salutation: string;
  paragraphs: string[];
  signOff: string;
  /** "P. D.: …" or null */
  postscript: string | null;
  kings: [string, string, string];
}

interface ReplyCopy {
  eyebrow: string;
  dateLine: (year: number) => string;
  salutation: Record<ReplyGender, (name: string) => string>;
  signOff: string;
  psLabel: string;
  kings: [string, string, string];
  achievements: Record<AchievementId, Gendered>;
  challenges: Record<ChallengeId, string>;
  opening: string[];
  /** {list} = the chosen achievements joined ("has aprendido a leer y has…"). */
  praise: string[];
  /** No achievement chosen. */
  praiseGeneric: string[];
  /** {custom} = the parent's own line, as a full sentence. */
  custom: string[];
  /** {challenge} = the chosen challenge. */
  challenge: string[];
  night: Record<"before" | "morning", string[]>;
  wishes: string[];
  /** May quote {name}. */
  closing: string[];
  and: string;
}

const ES: ReplyCopy = {
  eyebrow: "De parte de Sus Majestades los Reyes Magos de Oriente",
  dateLine: (year) => `Oriente, 5 de enero de ${year}`,
  salutation: {
    girl: (n) => `Querida ${n}:`,
    boy: (n) => `Querido ${n}:`,
    neutral: (n) => `Hola, ${n}:`,
  },
  signOff: "Con todo nuestro cariño,",
  psLabel: "P. D.:",
  kings: ["Melchor", "Gaspar", "Baltasar"],
  achievements: {
    reading: "has aprendido a leer",
    schoolStart: "has empezado el cole con mucha valentía",
    schoolEffort: "te has esforzado mucho en el cole",
    helpingHome: "has ayudado mucho en casa",
    sibling: {
      boy: "has sido un hermano estupendo",
      girl: "has sido una hermana estupenda",
      neutral: "has cuidado mucho de tus hermanos",
    },
    sharing: "has compartido tus juguetes",
    brave: "has sido muy valiente cuando algo te daba miedo",
    newSkills: "has aprendido cosas nuevas que te costaban mucho",
    friends: "has hecho nuevos amigos y los has cuidado",
    kindness: "has sido amable con todo el mundo",
    ownBed: "has empezado a dormir en tu cama sin miedo",
    pet: "has cuidado de tu mascota",
  },
  challenges: {
    tidyToys: "recoger los juguetes después de jugar",
    bedtime: "irte a dormir sin protestar",
    veggies: "probar la verdura, aunque sea un poquito",
    patience: "tener un poco más de paciencia",
    siblingPeace: "hacer las paces rápido con tus hermanos",
    teeth: "lavarte los dientes sin que te lo tengan que recordar",
    homework: "hacer los deberes con calma",
    noShouting: "decir las cosas sin gritar",
    screens: "dejar la pantalla cuando toca",
    listening: "hacer caso a la primera en casa",
  },
  opening: [
    "Hemos recibido tu carta. Nos la trajo uno de nuestros pajes y la leímos los tres juntos, despacio, a la luz de la estrella que nos guía cada año.",
    "Tu carta llegó a Oriente sana y salva. Melchor la guardó en su cofre, Gaspar la leyó en voz alta y Baltasar dijo que olía a casa.",
    "Te escribimos desde muy lejos, mientras los camellos descansan y llenamos los sacos para la noche más larga del año. Antes de salir hacia tu casa, queríamos contarte algo.",
    "Ya estamos de camino. Llevamos muchas noches cruzando desiertos y montañas, y en una de las paradas hemos sacado papel y tinta para escribirte.",
  ],
  praise: [
    "Este año nos han llegado muy buenas noticias de ti. Sabemos que {list}. ¡Eso tiene mucho mérito!",
    "Nuestros pajes nos lo cuentan todo, y este año nos han dicho que {list}. Estamos muy orgullosos de ti.",
    "Desde Oriente lo vemos casi todo, y este año hemos visto que {list}. Cuando nos lo contaron, Baltasar sonrió tanto que se le vio desde la otra punta del desierto.",
  ],
  praiseGeneric: [
    "Sabemos que este año has crecido mucho y que has aprendido un montón de cosas nuevas. ¡Eso tiene mucho mérito!",
    "Nuestros pajes nos han contado que este año has crecido un montón, por fuera y por dentro. Estamos muy orgullosos de ti.",
    "Desde Oriente lo vemos casi todo, y este año te hemos visto crecer, aprender y reír mucho. Eso es lo que más nos gusta.",
  ],
  custom: [
    "Y hay algo que nos ha hecho especial ilusión. {custom}",
    "Ah, y un pajarito nos ha contado otra cosa. {custom}",
    "Hay una cosa más que no queríamos olvidar. {custom}",
  ],
  challenge: [
    "Para el año que viene te dejamos un pequeño reto: {challenge}. Sabemos que puedes, porque ya has hecho cosas mucho más difíciles.",
    "Y ahora, un secreto de Reyes: nos haría mucha ilusión una cosa, {challenge}. No tiene que salir perfecto a la primera; basta con intentarlo un poco cada día.",
    "Te pedimos un pequeño favor para este año nuevo: {challenge}. Cuando lo consigas, mira al cielo: alguna estrella te guiñará el ojo.",
  ],
  night: {
    before: [
      "Esta noche pasaremos por tu casa. Si puedes, deja un poco de agua para los camellos: el viaje es largo y llegan con mucha sed.",
      "Esta noche, cuando duermas, entraremos sin hacer ruido. Acuéstate pronto, que los Reyes solo llegan cuando todo el mundo duerme.",
      "Dentro de unas horas estaremos en tu calle. Deja los zapatos en un sitio donde podamos verlos bien, que con tanta casa a veces nos cuesta encontrarlos.",
    ],
    morning: [
      "Mientras dormías, hemos pasado por tu casa sin hacer ruido y te hemos dejado los regalos con mucho cariño. Los camellos te mandan recuerdos.",
      "Esta noche hemos estado en tu casa. Lo hicimos muy despacito, para no despertar a nadie, y elegimos cada regalo pensando en ti.",
      "Ya ha pasado la noche más larga del año. Antes de seguir nuestro camino, hemos dejado esta carta junto a tus regalos para que sepas lo mucho que pensamos en ti.",
    ],
  },
  wishes: [
    "Hemos leído con atención todo lo que nos pedías. No siempre podemos traerlo todo, porque en los sacos tiene que haber sitio para todos los niños y niñas del mundo, pero lo hemos elegido con el corazón.",
    "Ya sabes que los Reyes hacemos magia, pero no milagros: traemos lo que podemos, y siempre con mucho cariño.",
    "Cada año recibimos cartas de niños y niñas de todo el mundo, y la tuya la hemos leído con una sonrisa de principio a fin.",
  ],
  closing: [
    "Nunca dejes de soñar, ni de reír, ni de hacer preguntas. Volveremos el año que viene.",
    "Te mandamos un abrazo enorme, de esos que solo se dan en Oriente. ¡Hasta el año que viene!",
    "Sigue siendo como eres, {name}. Nos vemos el año que viene.",
  ],
  and: "y",
};

const CA: ReplyCopy = {
  eyebrow: "De part de Ses Majestats els Reis d'Orient",
  dateLine: (year) => `Orient, 5 de gener de ${year}`,
  salutation: {
    girl: (n) => `Estimada ${n},`,
    boy: (n) => `Estimat ${n},`,
    neutral: (n) => `Hola, ${n},`,
  },
  signOff: "Amb tot el nostre afecte,",
  psLabel: "P. S.:",
  kings: ["Melcior", "Gaspar", "Baltasar"],
  achievements: {
    reading: "has après a llegir",
    schoolStart: "has començat l'escola amb molta valentia",
    schoolEffort: "t'has esforçat molt a l'escola",
    helpingHome: "has ajudat molt a casa",
    sibling: {
      boy: "has estat un germà fantàstic",
      girl: "has estat una germana fantàstica",
      neutral: "has cuidat molt els teus germans",
    },
    sharing: "has compartit les teves joguines",
    brave: {
      boy: "has estat molt valent quan alguna cosa et feia por",
      girl: "has estat molt valenta quan alguna cosa et feia por",
      neutral: "has plantat cara a les coses que et feien por",
    },
    newSkills: "has après coses noves que et costaven molt",
    friends: "has fet amics nous i n'has tingut cura",
    kindness: "has estat amable amb tothom",
    ownBed: "has començat a dormir al teu llit sense por",
    pet: "has tingut cura de la teva mascota",
  },
  challenges: {
    tidyToys: "endreçar les joguines després de jugar",
    bedtime: "anar a dormir sense protestar",
    veggies: "tastar la verdura, encara que sigui una mica",
    patience: "tenir una mica més de paciència",
    siblingPeace: "fer les paus de pressa amb els teus germans",
    teeth: "rentar-te les dents sense que t'ho hagin de recordar",
    homework: "fer els deures amb calma",
    noShouting: "dir les coses sense cridar",
    screens: "deixar la pantalla quan toca",
    listening: "fer cas a la primera a casa",
  },
  opening: [
    "Hem rebut la teva carta. Ens la va portar el Carter Reial i la vam llegir tots tres junts, a poc a poc, a la llum de l'estel que ens guia cada any.",
    "La teva carta ha arribat a Orient sana i estalvia. En Melcior l'ha desada al seu cofre, en Gaspar l'ha llegida en veu alta i en Baltasar diu que feia olor de casa.",
    "T'escrivim des de molt lluny, mentre els camells descansen i omplim els sacs per a la nit més llarga de l'any. Abans de sortir cap a casa teva, et volíem explicar una cosa.",
    "Ja som de camí. Fa moltes nits que travessem deserts i muntanyes, i en una de les parades hem tret paper i tinta per escriure't.",
  ],
  praise: [
    "Aquest any ens han arribat molt bones notícies de tu. Sabem que {list}. Això té molt de mèrit!",
    "El Patge Reial ens ho explica tot, i aquest any ens ha dit que {list}. N'estem molt orgullosos.",
    "Des d'Orient ho veiem gairebé tot, i aquest any hem vist que {list}. Quan ens ho van explicar, en Baltasar va fer un somriure tan gran que es veia des de l'altra punta del desert.",
  ],
  praiseGeneric: [
    "Sabem que aquest any has crescut molt i que has après un munt de coses noves. Això té molt de mèrit!",
    "El Patge Reial ens ha explicat que aquest any has crescut moltíssim, per fora i per dins. N'estem molt orgullosos.",
    "Des d'Orient ho veiem gairebé tot, i aquest any t'hem vist créixer, aprendre i riure molt. Això és el que més ens agrada.",
  ],
  custom: [
    "I hi ha una cosa que ens ha fet especial il·lusió. {custom}",
    "Ah, i un ocellet ens ha explicat una altra cosa. {custom}",
    "Hi ha una cosa més que no volíem oblidar. {custom}",
  ],
  challenge: [
    "Per a l'any que ve et deixem un petit repte: {challenge}. Sabem que pots, perquè ja has fet coses molt més difícils.",
    "I ara, un secret de Reis: ens faria molta il·lusió una cosa, {challenge}. No cal que surti perfecte a la primera; n'hi ha prou d'intentar-ho una mica cada dia.",
    "Et demanem un petit favor per a aquest any nou: {challenge}. Quan ho aconsegueixis, mira el cel: algun estel et picarà l'ullet.",
  ],
  night: {
    before: [
      "Aquesta nit passarem per casa teva. Si pots, deixa una mica d'aigua per als camells: el viatge és llarg i hi arriben amb molta set.",
      "Aquesta nit, quan dormis, entrarem sense fer soroll. Ves a dormir d'hora, que els Reis només arriben quan tothom dorm.",
      "D'aquí a unes hores serem al teu carrer. Deixa les sabates en un lloc on les puguem veure bé, que amb tantes cases de vegades ens costa trobar-les.",
    ],
    morning: [
      "Mentre dormies, hem passat per casa teva sense fer soroll i t'hem deixat els regals amb molt d'amor. Els camells et donen records.",
      "Aquesta nit hem estat a casa teva. Ho hem fet molt a poc a poc, perquè ningú es despertés, i hem triat cada regal pensant en tu.",
      "Ja ha passat la nit més llarga de l'any. Abans de continuar el camí, hem deixat aquesta carta al costat dels teus regals perquè sàpigues que pensem molt en tu.",
    ],
  },
  wishes: [
    "Hem llegit amb atenció tot el que ens demanaves. No sempre ho podem portar tot, perquè als sacs hi ha d'haver lloc per a tots els nens i nenes del món, però ho hem triat amb el cor.",
    "Ja saps que els Reis fem màgia, però no miracles: portem el que podem, i sempre amb molt d'amor.",
    "Cada any rebem cartes de nens i nenes de tot el món, i la teva l'hem llegida amb un somriure de principi a fi.",
  ],
  closing: [
    "No deixis mai de somiar, ni de riure, ni de fer preguntes. Tornarem l'any que ve.",
    "T'enviem una abraçada enorme, d'aquelles que només es fan a Orient. Fins a l'any que ve!",
    "Continua sent com ets, {name}. Ens veiem l'any que ve.",
  ],
  and: "i",
};

const COPY: Record<"es" | "ca", ReplyCopy> = { es: ES, ca: CA };

const pick = (g: Gendered, gender: ReplyGender) => (typeof g === "string" ? g : g[gender]);

/** "a", "a y b", "a, b y c" (es) / "a, b i c" (ca). */
export function joinList(items: string[], and: string): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} ${and} ${items[items.length - 1]}`;
}

/** The parent's free line as a full sentence: capital first letter, closing punctuation. */
export function asSentence(raw: string): string {
  const s = raw.trim().replace(/\s+/g, " ");
  if (!s) return "";
  const capped = s.charAt(0).toLocaleUpperCase() + s.slice(1);
  return /[.!?…»"')]$/.test(capped) ? capped : `${capped}.`;
}

/** Small stable hash, so each name starts on its own mix of variants. */
function seedOf(name: string): number {
  let h = 7;
  for (const ch of name) h = (h * 31 + (ch.codePointAt(0) ?? 0)) % 9973;
  return h;
}

/** Season of the reply: Reyes falls on 5/6 January of `christmasYear + 1`. */
export function composeReply(input: ReplyComposeInput, reyesYear: number): ComposedReply {
  const c = COPY[input.locale];
  const name = input.name.trim();
  const seed = seedOf(name.toLocaleLowerCase());
  // Each section rotates with the variant; a different offset per section keeps
  // the mix varied instead of always "variant 1 of everything".
  const choose = (list: string[], section: number) => list[(input.variant + seed + section * 2) % list.length];

  const achievements = [...new Set(input.achievements)].map((id) => pick(c.achievements[id], input.gender));
  const paragraphs: string[] = [choose(c.opening, 0)];

  const praise =
    achievements.length > 0
      ? choose(c.praise, 1).replace("{list}", joinList(achievements, c.and))
      : choose(c.praiseGeneric, 1);
  const custom = asSentence(input.customAchievement);
  paragraphs.push(custom ? `${praise} ${choose(c.custom, 2).replace("{custom}", custom)}` : praise);

  if (input.challenge) paragraphs.push(choose(c.challenge, 3).replace("{challenge}", c.challenges[input.challenge]));

  paragraphs.push(`${choose(c.night[input.moment], 4)} ${choose(c.wishes, 5)}`);
  paragraphs.push(choose(c.closing, 6).replace("{name}", name));

  const ps = asSentence(input.postscript);
  return {
    eyebrow: c.eyebrow,
    dateLine: c.dateLine(reyesYear),
    salutation: c.salutation[input.gender](name),
    paragraphs,
    signOff: c.signOff,
    postscript: ps ? `${c.psLabel} ${ps}` : null,
    kings: c.kings,
  };
}
