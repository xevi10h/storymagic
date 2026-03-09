// State management for the book creation flow
// Complete decision tree: Step 2 (character) → Step 3 (template) → Step 4 (decisions) → Step 5 (ending)

// ============================================================
// TYPES
// ============================================================

export type CreationMode = "solo" | "juntos" | null;
export type Gender = "boy" | "girl" | "neutral";
export type EndingChoice = string | null;

export interface CharacterData {
  name: string;
  city: string;
  age: number;
  hairColor: string;
  eyeColor: string;
  skinTone: string;
  gender: Gender;
  hairstyle: string;
  interests: string[];
  specialTrait: string;
  favoriteCompanion: string;
  favoriteFood: string;
  futureDream: string;
}

export interface StoryDecisions {
  encounter?: string;
  companion?: string;
  challenge?: string;
  timeOfDay?: string;
  setting?: string;
  specialMoment?: string;
}

export interface CreateBookState {
  currentStep: number;
  mode: CreationMode;
  character: CharacterData;
  /** AI-generated portrait URL (created between Step 2 and Step 3) */
  portraitUrl: string | null;
  /** Recraft style_id derived from the portrait (reused for all illustrations) */
  recraftStyleId: string | null;
  /** Snapshot of character data when portrait was generated (for change detection) */
  portraitCharacterSnapshot: string | null;
  selectedTemplate: string | null;
  decisions: StoryDecisions;
  dedication: string;
  senderName: string;
  ending: EndingChoice;
  endingNote: string;
}

// ============================================================
// TEMPLATE CONFIG TYPES
// ============================================================

export interface DecisionOption {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  narrativeContext: string;
}

export interface DecisionPoint {
  key: "encounter" | "companion" | "challenge";
  question: string;
  options: DecisionOption[];
}

export interface AtmosphereTimeOption {
  id: string;
  label: string;
  icon: string;
  iconColor: string;
  narrativeContext: string;
}

export interface AtmosphereSettingOption {
  id: string;
  label: string;
  icon: string;
  bgColor: string;
  iconColor: string;
  narrativeContext: string;
}

export interface EndingOption {
  id: string;
  title: string;
  description: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  narrativeContext: string;
}

export interface StoryTemplateConfig {
  id: string;
  title: string;
  ageMin: number;
  ageMax: number;
  ageRange: string;
  description: string;
  image: string;
  theme: string;
  moral: string;
  relatedInterests: string[];
  themeColor: string;
  themeGradient: string;
  previewChapterTitle: string;
  decisions: DecisionPoint[];
  atmosphere: {
    timeOptions: AtmosphereTimeOption[];
    settingOptions: AtmosphereSettingOption[];
  };
  endings: EndingOption[];
}

// ============================================================
// INITIAL STATE
// ============================================================

export const INITIAL_STATE: CreateBookState = {
  currentStep: 1,
  mode: null,
  character: {
    name: "",
    city: "",
    age: 5,
    hairColor: "#5d4037",
    eyeColor: "#5d4037",
    skinTone: "#fce4d6",
    gender: "boy",
    hairstyle: "short",
    interests: [],
    specialTrait: "",
    favoriteCompanion: "",
    favoriteFood: "",
    futureDream: "",
  },
  portraitUrl: null,
  recraftStyleId: null,
  portraitCharacterSnapshot: null,
  selectedTemplate: null,
  decisions: {},
  dedication: "",
  senderName: "",
  ending: null,
  endingNote: "",
};

// ============================================================
// CHARACTER CONSTANTS
// ============================================================

export const HAIR_COLORS = [
  { id: "black", color: "#2a2a2a" },
  { id: "brown-dark", color: "#5d4037" },
  { id: "brown", color: "#8d6e63" },
  { id: "blonde", color: "#e6c07b" },
  { id: "red", color: "#d84315" },
];

export const EYE_COLORS = [
  { id: "brown-dark", color: "#5d4037" },
  { id: "brown", color: "#8d6e63" },
  { id: "green", color: "#558b2f" },
  { id: "blue", color: "#1976d2" },
  { id: "hazel", color: "#a0875b" },
  { id: "gray", color: "#78909c" },
];

export const SKIN_TONES = [
  { id: "light", color: "#fce4d6" },
  { id: "medium-light", color: "#eebb99" },
  { id: "medium-dark", color: "#c68642" },
  { id: "dark", color: "#8d5524" },
  { id: "very-dark", color: "#523218" },
];

// Labels are translated via i18n: td('interests.${id}')
export const INTERESTS = [
  { id: "space", icon: "rocket_launch" },
  { id: "animals", icon: "pets" },
  { id: "sports", icon: "sports_soccer" },
  { id: "castles", icon: "castle" },
  { id: "dinosaurs", icon: "cruelty_free" },
  { id: "music", icon: "music_note" },
];

// Labels are translated via i18n: td('hairstyles.${id}')
export interface HairstyleOption {
  id: string;
  icon: string;
}

export const HAIRSTYLES: Record<Gender, HairstyleOption[]> = {
  boy: [
    { id: "short", icon: "content_cut" },
    { id: "curly", icon: "waves" },
    { id: "spiky", icon: "north" },
    { id: "buzz", icon: "circle" },
    { id: "medium", icon: "straighten" },
    { id: "afro", icon: "blur_on" },
    { id: "mohawk", icon: "expand_less" },
  ],
  girl: [
    { id: "long", icon: "straighten" },
    { id: "curly", icon: "waves" },
    { id: "pigtails", icon: "diversity_1" },
    { id: "ponytail", icon: "turn_right" },
    { id: "braids", icon: "link" },
    { id: "bob", icon: "horizontal_rule" },
    { id: "bun", icon: "radio_button_checked" },
    { id: "afro", icon: "blur_on" },
  ],
  neutral: [
    { id: "medium", icon: "straighten" },
    { id: "curly", icon: "waves" },
    { id: "short", icon: "content_cut" },
    { id: "afro", icon: "blur_on" },
    { id: "bob", icon: "horizontal_rule" },
    { id: "buzz", icon: "circle" },
  ],
};

// ============================================================
// STORY TEMPLATE CONFIGURATIONS
// ============================================================

export const STORY_TEMPLATES: StoryTemplateConfig[] = [
  // ── SPACE ──────────────────────────────────────────────────
  {
    id: "space",
    title: "La Gran Aventura Espacial",
    ageMin: 5,
    ageMax: 8,
    ageRange: "5-8 años",
    description:
      "Un viaje a las estrellas donde descubrirán planetas desconocidos y harán amigos alienígenas.",
    image: "/images/templates/space.jpg",
    theme: "Space travel, exploring unknown planets, making alien friends",
    moral: "Curiosity takes you far",
    relatedInterests: ["space"],
    themeColor: "#1a237e",
    themeGradient: "from-indigo-900 to-purple-800",
    previewChapterTitle: "La Nave de los Sueños",
    decisions: [
      {
        key: "encounter",
        question: "¿Qué descubre {name} en el planeta desconocido?",
        options: [
          {
            id: "robot",
            title: "Robot Amigable",
            subtitle: "Beep boop, ¿quieres ser mi amigo?",
            icon: "smart_toy",
            narrativeContext:
              "A friendly robot who has been alone on the planet for years and desperately wants a friend. The robot helps navigate the planet with built-in maps and tools.",
          },
          {
            id: "crystal",
            title: "Cristal Luminoso",
            subtitle: "Brilla con los colores del arcoíris",
            icon: "diamond",
            narrativeContext:
              "A glowing crystal that pulses with rainbow colors and grants the ability to understand any alien language. It hums a gentle melody when held.",
          },
          {
            id: "ship",
            title: "Nave Abandonada",
            subtitle: "¿Quién la dejó aquí?",
            icon: "rocket",
            narrativeContext:
              "An abandoned spaceship covered in vines and flowers, with a mysterious logbook inside that reveals clues about a hidden planet of wonders.",
          },
        ],
      },
      {
        key: "companion",
        question: "¿Quién acompaña a {name} en esta misión espacial?",
        options: [
          {
            id: "alien",
            title: "Alien Simpático",
            subtitle: "Tiene tres ojos y una sonrisa enorme",
            icon: "mood",
            narrativeContext:
              "A small, three-eyed alien named Zix who communicates through colors that change on their skin. Very curious and loves to laugh.",
          },
          {
            id: "copilot-robot",
            title: "Robot Copiloto",
            subtitle: "El mejor navegante de la galaxia",
            icon: "precision_manufacturing",
            narrativeContext:
              "A loyal robot co-pilot named NOVA who has explored hundreds of galaxies. Has a warm mechanical voice and tells bedtime stories about constellations.",
          },
          {
            id: "star",
            title: "Estrella Guía",
            subtitle: "Una estrellita que habla y señala el camino",
            icon: "star",
            narrativeContext:
              "A tiny talking star named Lumi who fell from a constellation. Glows brighter when the right path is near and dims when danger approaches.",
          },
        ],
      },
      {
        key: "challenge",
        question: "¿Qué peligro aparece en la misión de {name}?",
        options: [
          {
            id: "asteroids",
            title: "Tormenta de Asteroides",
            subtitle: "¡Esquiva y vuela!",
            icon: "blur_on",
            narrativeContext:
              "A massive asteroid storm blocks the path home. The protagonist must navigate through, using courage and quick thinking to dodge the tumbling space rocks.",
          },
          {
            id: "shrinking-planet",
            title: "Planeta que se Encoge",
            subtitle: "¡Hay que salvar a los habitantes!",
            icon: "compress",
            narrativeContext:
              "The planet they're visiting is slowly shrinking! The tiny inhabitants need help finding the cause and reversing it before their home disappears completely.",
          },
          {
            id: "black-hole",
            title: "Agujero Negro Travieso",
            subtitle: "¡Absorbe todo lo divertido!",
            icon: "cyclone",
            narrativeContext:
              "A mischievous black hole is sucking up all the fun things in the galaxy — toys, laughter, colors. The protagonist must find a way to make it stop.",
          },
        ],
      },
    ],
    atmosphere: {
      timeOptions: [
        {
          id: "stellar-dawn",
          label: "Amanecer Estelar",
          icon: "wb_twilight",
          iconColor: "text-amber-500",
          narrativeContext: "The scene takes place during a stunning stellar dawn, with three suns rising simultaneously over the alien horizon",
        },
        {
          id: "eclipse",
          label: "Eclipse Solar",
          icon: "brightness_3",
          iconColor: "text-orange-600",
          narrativeContext: "The scene takes place during a dramatic solar eclipse that reveals hidden pathways made of light",
        },
        {
          id: "infinite-night",
          label: "Noche Infinita",
          icon: "dark_mode",
          iconColor: "text-indigo-400",
          narrativeContext: "The scene takes place in the infinite cosmic night, with nebulae painting the sky in purples and blues",
        },
      ],
      settingOptions: [
        {
          id: "nebula",
          label: "Nebulosa Colorida",
          icon: "cloud",
          bgColor: "bg-purple-100",
          iconColor: "text-purple-500",
          narrativeContext: "Inside a colorful nebula where clouds of cosmic dust create a magical, kaleidoscopic environment",
        },
        {
          id: "asteroid-belt",
          label: "Cinturón de Asteroides",
          icon: "blur_on",
          bgColor: "bg-slate-100",
          iconColor: "text-slate-500",
          narrativeContext: "Floating through an asteroid belt, jumping between rocks that each contain tiny gardens and crystal caves",
        },
        {
          id: "unknown-moon",
          label: "Luna Desconocida",
          icon: "nightlight",
          bgColor: "bg-blue-100",
          iconColor: "text-blue-500",
          narrativeContext: "On the surface of an unknown moon with low gravity, where every step becomes a giant leap and craters hide glowing pools",
        },
      ],
    },
    endings: [
      {
        id: "triumphant-return",
        title: "Regreso Triunfal",
        description: "Vuelve a la Tierra con un regalo del espacio y una historia increíble que contar.",
        icon: "flight_land",
        iconBg: "bg-blue-100",
        iconColor: "text-blue-600",
        narrativeContext: "The story ends with a triumphant return to Earth, carrying a small glowing souvenir from space. Everyone gathers to hear about the incredible adventure.",
      },
      {
        id: "galactic-party",
        title: "Fiesta Intergaláctica",
        description: "Todos los amigos alienígenas celebran con música cósmica y comida de estrellas.",
        icon: "celebration",
        iconBg: "bg-purple-100",
        iconColor: "text-purple-600",
        narrativeContext: "The story ends with a grand intergalactic party where all the alien friends celebrate with cosmic music, star-shaped treats, and dancing in zero gravity.",
      },
      {
        id: "stargazing",
        title: "Acampada Estelar",
        description: "Se tumba en un planeta suave a mirar las constelaciones y recordar la aventura.",
        icon: "bedtime",
        iconBg: "bg-indigo-100",
        iconColor: "text-indigo-600",
        narrativeContext: "The story ends peacefully on a soft, moss-covered planet, lying under a sky full of familiar and new constellations, reflecting on the adventure and drifting off to sleep.",
      },
    ],
  },

  // ── FOREST ─────────────────────────────────────────────────
  {
    id: "forest",
    title: "El Bosque Mágico",
    ageMin: 2,
    ageMax: 5,
    ageRange: "2-5 años",
    description:
      "Secretos entre los árboles antiguos y criaturas fantásticas que necesitan ayuda.",
    image: "/images/templates/forest.jpg",
    theme: "Enchanted forest, fantastic animals, ancient trees with secrets",
    moral: "Taking care of our world matters",
    relatedInterests: ["animals", "dinosaurs"],
    themeColor: "#2e7d32",
    themeGradient: "from-green-800 to-emerald-700",
    previewChapterTitle: "El Bosque de los Susurros",
    decisions: [
      {
        key: "encounter",
        question: "¿Qué encuentra {name} entre los árboles?",
        options: [
          {
            id: "dragon",
            title: "Dragón Dormido",
            subtitle: "Zzz... bajo el árbol antiguo",
            icon: "local_fire_department",
            narrativeContext:
              "A small, gentle dragon sleeping under the oldest tree in the forest. When it wakes, it breathes warm (not hot) fire and is scared of its own shadow.",
          },
          {
            id: "treasure",
            title: "Cofre Mágico",
            subtitle: "¡Lleno de polvo de hadas!",
            icon: "deployed_code",
            narrativeContext:
              "An ancient treasure chest covered in moss and flowers, containing magical fairy dust that makes plants grow instantly and flowers bloom in every color.",
          },
          {
            id: "door",
            title: "Puerta Secreta",
            subtitle: "¿A dónde llevará?",
            icon: "door_front",
            narrativeContext:
              "A mysterious door standing alone between two trees, glowing softly. It leads to a hidden part of the forest where everything is upside down and magical.",
          },
        ],
      },
      {
        key: "companion",
        question: "¿Quién acompaña a {name} en el bosque?",
        options: [
          {
            id: "fox",
            title: "Zorro Sabio",
            subtitle: "Conoce todos los secretos del bosque",
            icon: "pets",
            narrativeContext:
              "A wise orange fox with kind eyes who has lived in the forest for a hundred years. Speaks softly and knows the name of every plant and creature.",
          },
          {
            id: "fairy",
            title: "Hada Traviesa",
            subtitle: "Pequeñita pero llena de magia",
            icon: "auto_awesome",
            narrativeContext:
              "A tiny mischievous fairy who leaves a trail of glitter everywhere. Loves playing pranks but always helps when it matters most.",
          },
          {
            id: "owl",
            title: "Búho Anciano",
            subtitle: "Ha visto pasar mil lunas",
            icon: "visibility",
            narrativeContext:
              "An ancient owl with huge golden eyes who only speaks in riddles and poems. Carries a tiny lantern and guides travelers through the darkest paths.",
          },
        ],
      },
      {
        key: "challenge",
        question: "¿Qué obstáculo aparece en el camino de {name}?",
        options: [
          {
            id: "river",
            title: "Río Crecido",
            subtitle: "El agua sube y no hay puente",
            icon: "water",
            narrativeContext:
              "A river that has risen overnight, blocking the path. The protagonist must find a creative way to cross — perhaps building a raft from branches or asking the fish for help.",
          },
          {
            id: "fog",
            title: "Niebla Encantada",
            subtitle: "No se ve nada... ¿o sí?",
            icon: "foggy",
            narrativeContext:
              "A magical fog that makes everything invisible — but reveals hidden things that are normally unseen. The protagonist must trust their other senses to navigate.",
          },
          {
            id: "talking-tree",
            title: "Árbol Parlante",
            subtitle: "Pide algo a cambio de dejar pasar",
            icon: "park",
            narrativeContext:
              "A giant talking tree blocks the path and won't move until the protagonist solves a riddle or performs an act of kindness.",
          },
        ],
      },
    ],
    atmosphere: {
      timeOptions: [
        {
          id: "golden-dawn",
          label: "Amanecer Dorado",
          icon: "sunny",
          iconColor: "text-yellow-500",
          narrativeContext: "The scene takes place at golden dawn, with warm rays of light filtering through the canopy and dewdrops sparkling on every leaf",
        },
        {
          id: "pink-sunset",
          label: "Atardecer Rosado",
          icon: "wb_twilight",
          iconColor: "text-pink-500",
          narrativeContext: "The scene takes place during a pink and golden sunset that paints the forest in warm, magical hues",
        },
        {
          id: "full-moon",
          label: "Noche de Luna Llena",
          icon: "bedtime",
          iconColor: "text-indigo-400",
          narrativeContext: "The scene takes place under a bright full moon that turns the forest into a silver wonderland with long, dancing shadows",
        },
      ],
      settingOptions: [
        {
          id: "enchanted-clearing",
          label: "Claro Encantado",
          icon: "grass",
          bgColor: "bg-green-100",
          iconColor: "text-green-600",
          narrativeContext: "In a magical clearing surrounded by the tallest trees, where fireflies create patterns of light and flowers glow softly",
        },
        {
          id: "crystal-cave",
          label: "Cueva de Cristales",
          icon: "diamond",
          bgColor: "bg-purple-100",
          iconColor: "text-purple-500",
          narrativeContext: "Inside a hidden cave filled with glowing crystals of every color, where echoes sound like music",
        },
        {
          id: "hidden-waterfall",
          label: "Cascada Escondida",
          icon: "water",
          bgColor: "bg-blue-100",
          iconColor: "text-blue-500",
          narrativeContext: "Behind a hidden waterfall that creates a permanent rainbow, with a secret grotto where the forest spirits gather",
        },
      ],
    },
    endings: [
      {
        id: "clearing-celebration",
        title: "Fiesta en el Claro",
        description: "Todas las criaturas del bosque celebran con música y baile entre luciérnagas.",
        icon: "celebration",
        iconBg: "bg-green-100",
        iconColor: "text-green-600",
        narrativeContext: "The story ends with a joyful celebration in the forest clearing, where all the creatures dance and sing together, and fireflies light up the night like tiny lanterns.",
      },
      {
        id: "magic-seed",
        title: "La Semilla Mágica",
        description: "El bosque regala una semilla especial para plantar en casa y recordar la aventura.",
        icon: "spa",
        iconBg: "bg-amber-100",
        iconColor: "text-amber-600",
        narrativeContext: "The story ends with the forest gifting a magical seed that, when planted at home, will grow into a tiny tree that whispers forest stories at bedtime.",
      },
      {
        id: "moss-rest",
        title: "Descanso en el Musgo",
        description: "Se tumba en un lecho de musgo a escuchar los susurros del bosque bajo las estrellas.",
        icon: "bedtime",
        iconBg: "bg-indigo-100",
        iconColor: "text-indigo-600",
        narrativeContext: "The story ends peacefully, lying on a soft bed of moss, listening to the gentle whispers of the forest and watching stars twinkle through the treetops.",
      },
    ],
  },

  // ── SUPERHERO ──────────────────────────────────────────────
  {
    id: "superhero",
    title: "Superhéroe por un Día",
    ageMin: 7,
    ageMax: 10,
    ageRange: "7-10 años",
    description:
      "¡A salvar la ciudad! Descubre superpoderes ocultos y aprende el valor de la valentía.",
    image: "/images/templates/superhero.jpg",
    theme: "Discovering hidden superpowers, saving the city with courage",
    moral: "True power is kindness",
    relatedInterests: ["sports"],
    themeColor: "#c62828",
    themeGradient: "from-red-700 to-orange-600",
    previewChapterTitle: "El Despertar del Héroe",
    decisions: [
      {
        key: "encounter",
        question: "¿Qué despierta los superpoderes de {name}?",
        options: [
          {
            id: "mask",
            title: "Máscara Misteriosa",
            subtitle: "Aparece de la nada con un brillo especial",
            icon: "theater_comedy",
            narrativeContext:
              "A mysterious glowing mask appears from nowhere. When put on, it reveals the superhero within and grants the power to see people's emotions as colors.",
          },
          {
            id: "help-call",
            title: "Llamada de Auxilio",
            subtitle: "¡Alguien necesita ayuda urgente!",
            icon: "campaign",
            narrativeContext:
              "A desperate cry for help echoes through the city. When the protagonist runs to help, they discover their own hidden powers activate in moments of bravery.",
          },
          {
            id: "power-ray",
            title: "Rayo de Poder",
            subtitle: "Un destello que cambia todo",
            icon: "bolt",
            narrativeContext:
              "A beam of light from the sky strikes the protagonist during a storm, awakening incredible powers they never knew they had.",
          },
        ],
      },
      {
        key: "companion",
        question: "¿Quién es el compañero de equipo de {name}?",
        options: [
          {
            id: "hero-dog",
            title: "Perro Superhéroe",
            subtitle: "¡Con capa y todo!",
            icon: "pets",
            narrativeContext:
              "A brave dog wearing a tiny cape who has super senses — can hear trouble from miles away and runs at incredible speed.",
          },
          {
            id: "best-friend",
            title: "Mejor Amigo/a",
            subtitle: "Juntos son un equipo imparable",
            icon: "group",
            narrativeContext:
              "The protagonist's best friend who also discovers they have a complementary superpower. Together they make an unbeatable team.",
          },
          {
            id: "helper-robot",
            title: "Robot Ayudante",
            subtitle: "Tiene herramientas para todo",
            icon: "smart_toy",
            narrativeContext:
              "A small flying robot with extendable arms, a projector screen, and a warm personality. Acts as mission control and always has the right tool.",
          },
        ],
      },
      {
        key: "challenge",
        question: "¿Qué villano amenaza la ciudad de {name}?",
        options: [
          {
            id: "shadow",
            title: "El Villano Sombra",
            subtitle: "Quiere apagar todas las luces de la ciudad",
            icon: "visibility_off",
            narrativeContext:
              "A shadowy villain who feeds on fear and wants to plunge the city into darkness. Can only be defeated with courage, kindness, and light.",
          },
          {
            id: "storm",
            title: "Tormenta Caótica",
            subtitle: "El clima se ha vuelto loco",
            icon: "thunderstorm",
            narrativeContext:
              "A chaotic storm that has taken on a life of its own, causing weather mayhem across the city. It's actually a confused cloud spirit that needs calming.",
          },
          {
            id: "laugh-thief",
            title: "El Ladrón de Risas",
            subtitle: "¡Nadie puede reír!",
            icon: "sentiment_dissatisfied",
            narrativeContext:
              "A lonely villain who steals everyone's laughter because they forgot how to laugh themselves. The city goes silent, and only genuine kindness can restore joy.",
          },
        ],
      },
    ],
    atmosphere: {
      timeOptions: [
        {
          id: "heroic-dawn",
          label: "Amanecer Heroico",
          icon: "sunny",
          iconColor: "text-amber-500",
          narrativeContext: "The scene takes place at a heroic dawn, with golden light breaking over the city skyline and hope filling the air",
        },
        {
          id: "epic-noon",
          label: "Mediodía Épico",
          icon: "wb_sunny",
          iconColor: "text-orange-500",
          narrativeContext: "The scene takes place at high noon with dramatic shadows and bright sunlight, the perfect stage for a hero's greatest moment",
        },
        {
          id: "watch-night",
          label: "Noche de Vigilancia",
          icon: "shield_moon",
          iconColor: "text-indigo-400",
          narrativeContext: "The scene takes place during a moonlit night, perfect for secret missions and rooftop surveillance over the sleeping city",
        },
      ],
      settingOptions: [
        {
          id: "city-center",
          label: "Centro de la Ciudad",
          icon: "location_city",
          bgColor: "bg-slate-100",
          iconColor: "text-slate-600",
          narrativeContext: "In the bustling city center with tall buildings, busy streets, and citizens who need saving",
        },
        {
          id: "secret-lair",
          label: "Guarida Secreta",
          icon: "security",
          bgColor: "bg-amber-100",
          iconColor: "text-amber-600",
          narrativeContext: "In a secret underground lair filled with gadgets, screens, and a map of the city",
        },
        {
          id: "rooftops",
          label: "Tejados bajo la Luna",
          icon: "roofing",
          bgColor: "bg-indigo-100",
          iconColor: "text-indigo-500",
          narrativeContext: "Atop the city rooftops with a panoramic view of the skyline, leaping between buildings",
        },
      ],
    },
    endings: [
      {
        id: "hero-parade",
        title: "Desfile Heroico",
        description: "La ciudad celebra con un gran desfile y todos gritan el nombre del héroe.",
        icon: "flag",
        iconBg: "bg-red-100",
        iconColor: "text-red-600",
        narrativeContext: "The story ends with a grand parade through the city, with confetti, cheering crowds, and the mayor giving a special medal to the hero.",
      },
      {
        id: "secret-identity",
        title: "Identidad Secreta",
        description: "Se quita la capa, sonríe, y vuelve a ser simplemente {name}.",
        icon: "sentiment_satisfied",
        iconBg: "bg-amber-100",
        iconColor: "text-amber-600",
        narrativeContext: "The story ends quietly — the hero takes off the cape, smiles, and walks home as their normal self, knowing that the real superpower was inside all along.",
      },
      {
        id: "hero-feast",
        title: "Banquete de Héroes",
        description: "Todos los personajes salvados preparan una fiesta sorpresa de agradecimiento.",
        icon: "cake",
        iconBg: "bg-pink-100",
        iconColor: "text-pink-600",
        narrativeContext: "The story ends with all the rescued characters throwing a surprise thank-you party with cake, music, and heartfelt speeches about bravery.",
      },
    ],
  },

  // ── PIRATES ────────────────────────────────────────────────
  {
    id: "pirates",
    title: "Piratas del Mar",
    ageMin: 5,
    ageMax: 8,
    ageRange: "5-8 años",
    description:
      "En busca del tesoro perdido navegando los siete mares con una tripulación muy divertida.",
    image: "/images/templates/pirates.jpg",
    theme: "Pirate adventure on the high seas, treasure hunting with a fun crew",
    moral: "The best treasures are friends",
    relatedInterests: ["castles"],
    themeColor: "#00695c",
    themeGradient: "from-teal-800 to-cyan-700",
    previewChapterTitle: "La Isla del Capitán",
    decisions: [
      {
        key: "encounter",
        question: "¿Qué descubre {name} en la isla misteriosa?",
        options: [
          {
            id: "treasure-map",
            title: "Mapa del Tesoro",
            subtitle: "¡X marca el lugar!",
            icon: "map",
            narrativeContext:
              "An ancient treasure map drawn on aged parchment, with an X that glows when you get closer to the treasure. The map has riddles that must be solved at each step.",
          },
          {
            id: "talking-parrot",
            title: "Loro Parlanchín",
            subtitle: "Cuenta historias de aventuras pasadas",
            icon: "record_voice_over",
            narrativeContext:
              "A colorful parrot who once belonged to the most famous pirate captain and knows all the secrets of the seven seas. Speaks in rhymes and loves crackers.",
          },
          {
            id: "mystery-island",
            title: "Cueva Submarina",
            subtitle: "Escondida bajo las olas",
            icon: "scuba_diving",
            narrativeContext:
              "A hidden underwater cave that can be entered at low tide, filled with ancient pirate artifacts, glowing shells, and a mysterious chest locked with a musical lock.",
          },
        ],
      },
      {
        key: "companion",
        question: "¿Quién forma parte de la tripulación de {name}?",
        options: [
          {
            id: "monkey",
            title: "Mono Travieso",
            subtitle: "Siempre roba los plátanos del capitán",
            icon: "cruelty_free",
            narrativeContext:
              "A mischievous little monkey named Coco who is incredibly agile, loves stealing bananas, and has a talent for finding hidden switches and secret passages.",
          },
          {
            id: "mermaid",
            title: "Sirena Amistosa",
            subtitle: "Conoce todos los secretos del mar",
            icon: "water",
            narrativeContext:
              "A friendly mermaid named Marina who can breathe underwater and above, knows where every reef and current leads, and sings beautiful songs that calm storms.",
          },
          {
            id: "veteran-pirate",
            title: "Pirata Veterano",
            subtitle: "Con parche, pata de palo y corazón de oro",
            icon: "elderly",
            narrativeContext:
              "An old pirate captain with an eye patch, a wooden leg, and the biggest heart on the seven seas. Tells incredible stories and always knows the right thing to do.",
          },
        ],
      },
      {
        key: "challenge",
        question: "¿Qué peligro acecha a la tripulación de {name}?",
        options: [
          {
            id: "kraken",
            title: "Kraken Gigante",
            subtitle: "¡Tentáculos por todas partes!",
            icon: "pest_control",
            narrativeContext:
              "A giant kraken rises from the deep! But it turns out to be lonely and just wants someone to play with. The protagonist must find a way to befriend it.",
          },
          {
            id: "sea-storm",
            title: "Tormenta Marina",
            subtitle: "Olas enormes y viento feroz",
            icon: "thunderstorm",
            narrativeContext:
              "A massive sea storm with towering waves and howling winds. The crew must work together, with each member using their unique skill to keep the ship safe.",
          },
          {
            id: "sinking-island",
            title: "Isla que se Hunde",
            subtitle: "¡Se hunde poco a poco!",
            icon: "south",
            narrativeContext:
              "The treasure island is slowly sinking into the sea! The protagonist must find the treasure and save the island's inhabitants before time runs out.",
          },
        ],
      },
    ],
    atmosphere: {
      timeOptions: [
        {
          id: "sea-dawn",
          label: "Amanecer en Alta Mar",
          icon: "wb_twilight",
          iconColor: "text-amber-500",
          narrativeContext: "The scene takes place at dawn on the open sea, with the first rays of sun painting the waves gold and the smell of salt in the air",
        },
        {
          id: "tropical-sunset",
          label: "Atardecer Tropical",
          icon: "sunny",
          iconColor: "text-orange-500",
          narrativeContext: "The scene takes place during a breathtaking tropical sunset with palm tree silhouettes and the sky ablaze in oranges and reds",
        },
        {
          id: "storm-night",
          label: "Noche de Tormenta",
          icon: "thunderstorm",
          iconColor: "text-slate-400",
          narrativeContext: "The scene takes place during a dramatic stormy night at sea, with lightning revealing the horizon and rain drumming on the deck",
        },
      ],
      settingOptions: [
        {
          id: "open-sea",
          label: "Mar Abierto",
          icon: "sailing",
          bgColor: "bg-blue-100",
          iconColor: "text-blue-500",
          narrativeContext: "On the vast open sea with nothing but blue water in every direction, aboard a creaking wooden ship with billowing sails",
        },
        {
          id: "desert-island",
          label: "Isla Desierta",
          icon: "landscape",
          bgColor: "bg-amber-100",
          iconColor: "text-amber-600",
          narrativeContext: "On a tiny desert island with a single palm tree, golden sand, and mysterious footprints leading into the jungle interior",
        },
        {
          id: "underwater-cave",
          label: "Cueva Submarina",
          icon: "scuba_diving",
          bgColor: "bg-teal-100",
          iconColor: "text-teal-500",
          narrativeContext: "Inside an underwater cave illuminated by bioluminescent creatures, with air pockets and ancient pirate carvings on the walls",
        },
      ],
    },
    endings: [
      {
        id: "true-treasure",
        title: "El Verdadero Tesoro",
        description: "Descubren que el verdadero tesoro son los amigos que hicieron en el viaje.",
        icon: "favorite",
        iconBg: "bg-red-100",
        iconColor: "text-red-500",
        narrativeContext: "The story ends with the realization that the real treasure was the friends made along the way. The chest contains letters from each crew member about what the adventure meant to them.",
      },
      {
        id: "paradise-island",
        title: "Isla Paradisíaca",
        description: "Anclan en una playa de arena dorada para descansar y disfrutar.",
        icon: "beach_access",
        iconBg: "bg-amber-100",
        iconColor: "text-amber-600",
        narrativeContext: "The story ends on a beautiful paradise beach with golden sand, gentle waves, and the entire crew relaxing in hammocks, telling stories of their adventure.",
      },
      {
        id: "pirate-party",
        title: "Fiesta Pirata",
        description: "Gran celebración en el barco con música, baile y pastel de coco.",
        icon: "celebration",
        iconBg: "bg-teal-100",
        iconColor: "text-teal-600",
        narrativeContext: "The story ends with a wild pirate party on the ship — music from an accordion, dancing on deck, coconut cake, and fireworks lighting up the starry sea sky.",
      },
    ],
  },

  // ── CHEF ───────────────────────────────────────────────────
  {
    id: "chef",
    title: "El Chef Más Pequeño",
    ageMin: 2,
    ageMax: 4,
    ageRange: "2-4 años",
    description:
      "Una cocina llena de magia donde los ingredientes cobran vida y bailan en la olla.",
    image: "/images/templates/chef.jpg",
    theme: "Magical kitchen where ingredients come alive, cooking with imagination",
    moral: "Creating with your hands is magic",
    relatedInterests: ["music"],
    themeColor: "#e65100",
    themeGradient: "from-orange-700 to-amber-500",
    previewChapterTitle: "La Cocina Encantada",
    decisions: [
      {
        key: "encounter",
        question: "¿Qué descubre {name} en la cocina mágica?",
        options: [
          {
            id: "secret-recipe",
            title: "Receta Secreta",
            subtitle: "Un libro viejo con una página que brilla",
            icon: "menu_book",
            narrativeContext:
              "An ancient recipe book with one glowing page — it contains the recipe for the most magical dish ever created, but some ingredients are written in riddles.",
          },
          {
            id: "living-ingredient",
            title: "Ingrediente Vivo",
            subtitle: "¡La zanahoria puede hablar!",
            icon: "eco",
            narrativeContext:
              "A talking carrot named Carlos who leads a group of living ingredients. They want to create the perfect dish together but need a human chef to guide them.",
          },
          {
            id: "enchanted-kitchen",
            title: "Cocina Encantada",
            subtitle: "Los utensilios se mueven solos",
            icon: "soup_kitchen",
            narrativeContext:
              "The entire kitchen comes alive — spoons stir by themselves, pots dance, and the oven hums a tune. It's a kitchen that cooks with feelings, not just recipes.",
          },
        ],
      },
      {
        key: "companion",
        question: "¿Quién ayuda a {name} en la cocina?",
        options: [
          {
            id: "singing-spoon",
            title: "Cuchara Cantarina",
            subtitle: "Canta mientras remueve la sopa",
            icon: "music_note",
            narrativeContext:
              "A singing wooden spoon named Melodía who stirs pots perfectly while humming happy tunes. The food tastes better when she sings her favorite songs.",
          },
          {
            id: "chef-mouse",
            title: "Ratón Chef",
            subtitle: "Pequeño pero con un paladar increíble",
            icon: "cruelty_free",
            narrativeContext:
              "A tiny mouse chef named Queso who has the most refined palate in the world. Can identify any ingredient by smell and knows every recipe by heart.",
          },
          {
            id: "magic-grandma",
            title: "Abuela Mágica",
            subtitle: "Sus recetas tienen un ingrediente secreto: amor",
            icon: "elderly_woman",
            narrativeContext:
              "A magical grandmother with sparkling eyes who appears when someone cooks with love. She adds a pinch of magic to every recipe and tells stories while cooking.",
          },
        ],
      },
      {
        key: "challenge",
        question: "¿Qué problema surge en la cocina de {name}?",
        options: [
          {
            id: "rebel-ingredients",
            title: "Ingredientes Rebeldes",
            subtitle: "¡No quieren entrar en la olla!",
            icon: "sentiment_very_dissatisfied",
            narrativeContext:
              "The ingredients have gone on strike! They refuse to be cooked until the protagonist finds a way to make cooking fun and respectful for everyone involved.",
          },
          {
            id: "growing-cake",
            title: "Pastel Gigante",
            subtitle: "¡No para de crecer!",
            icon: "expand",
            narrativeContext:
              "The cake recipe has gone wrong and the cake won't stop growing! It's pushing through the ceiling and filling the house. The protagonist must find the off switch before it fills the town.",
          },
          {
            id: "tiny-kitchen",
            title: "Cocina Diminuta",
            subtitle: "¡Todo se hace pequeñito!",
            icon: "zoom_in_map",
            narrativeContext:
              "A magic spell shrinks the entire kitchen (and everyone in it) to the size of a dollhouse. The protagonist must cook a reverse-growth potion using tiny ingredients.",
          },
        ],
      },
    ],
    atmosphere: {
      timeOptions: [
        {
          id: "magic-breakfast",
          label: "Desayuno Mágico",
          icon: "egg_alt",
          iconColor: "text-yellow-500",
          narrativeContext: "The scene takes place at magical breakfast time, with morning light streaming through a cozy kitchen window and the smell of fresh bread",
        },
        {
          id: "special-snack",
          label: "Merienda Especial",
          icon: "bakery_dining",
          iconColor: "text-orange-500",
          narrativeContext: "The scene takes place during a special afternoon snack time, the perfect magical hour between day and evening when the kitchen feels coziest",
        },
        {
          id: "gala-dinner",
          label: "Cena de Gala",
          icon: "dinner_dining",
          iconColor: "text-purple-400",
          narrativeContext: "The scene takes place during an elegant evening gala dinner with candlelight, fancy table settings, and a sense of grand occasion",
        },
      ],
      settingOptions: [
        {
          id: "home-kitchen",
          label: "Cocina de Casa",
          icon: "cottage",
          bgColor: "bg-amber-100",
          iconColor: "text-amber-600",
          narrativeContext: "In a warm, cozy home kitchen with checkered curtains, a big wooden table, and shelves full of colorful jars",
        },
        {
          id: "enchanted-restaurant",
          label: "Restaurante Encantado",
          icon: "restaurant",
          bgColor: "bg-red-100",
          iconColor: "text-red-500",
          narrativeContext: "In a magical restaurant where the tables set themselves, menus change based on your mood, and the walls are made of chocolate",
        },
        {
          id: "cloud-bakery",
          label: "Pastelería de las Nubes",
          icon: "cloud",
          bgColor: "bg-sky-100",
          iconColor: "text-sky-500",
          narrativeContext: "In a bakery floating among the clouds, where the floor is made of cotton candy and the ovens run on starlight",
        },
      ],
    },
    endings: [
      {
        id: "grand-feast",
        title: "Gran Banquete",
        description: "Todos prueban la receta mágica y es la más deliciosa del mundo.",
        icon: "cake",
        iconBg: "bg-orange-100",
        iconColor: "text-orange-600",
        narrativeContext: "The story ends with a grand feast where everyone tastes the magical recipe together — it's the most delicious thing anyone has ever tasted, because it was cooked with love.",
      },
      {
        id: "secret-recipe-kept",
        title: "La Receta Secreta",
        description: "Guarda la receta en un libro especial para cocinar siempre que quiera.",
        icon: "menu_book",
        iconBg: "bg-amber-100",
        iconColor: "text-amber-600",
        narrativeContext: "The story ends with the protagonist carefully writing the magical recipe in a special book, knowing they can return to the enchanted kitchen whenever they cook with imagination.",
      },
      {
        id: "cooking-together",
        title: "Todos a Cocinar",
        description: "Todos los personajes cocinan juntos la receta más grande del mundo.",
        icon: "group",
        iconBg: "bg-pink-100",
        iconColor: "text-pink-600",
        narrativeContext: "The story ends with all the characters — talking ingredients, singing spoons, and magical friends — cooking together the biggest and most wonderful recipe the world has ever seen.",
      },
    ],
  },

  // ── DINOSAURS ────────────────────────────────────────────────
  {
    id: "dinosaurs",
    title: "La Tierra de los Dinosaurios",
    ageMin: 4,
    ageMax: 7,
    ageRange: "4-7 años",
    description:
      "Un viaje en el tiempo a la era de los dinosaurios, donde la valentía y la amistad lo cambian todo.",
    image: "/images/templates/dinosaurs.jpg",
    theme: "Time travel to the dinosaur era, befriending prehistoric creatures",
    moral: "Bravery means helping those who are different from you",
    relatedInterests: ["dinosaurs", "animals"],
    themeColor: "#33691e",
    themeGradient: "from-lime-900 to-green-700",
    previewChapterTitle: "El Portal del Tiempo",
    decisions: [
      {
        key: "encounter",
        question: "¿Qué descubre {name} al llegar a la era de los dinosaurios?",
        options: [
          {
            id: "baby-dino",
            title: "Bebé Dinosaurio",
            subtitle: "Se ha perdido y necesita ayuda",
            icon: "egg",
            narrativeContext:
              "A tiny baby dinosaur who has been separated from its family. It imprints on the protagonist and follows them everywhere, making adorable chirping sounds.",
          },
          {
            id: "fossil-portal",
            title: "Portal de Fósiles",
            subtitle: "Un círculo de huesos que brilla",
            icon: "change_history",
            narrativeContext:
              "A glowing circle made of ancient fossils that acts as a portal between different dinosaur eras — each step through reveals a new prehistoric landscape.",
          },
          {
            id: "volcano",
            title: "Volcán Misterioso",
            subtitle: "Algo brilla en su interior",
            icon: "landscape",
            narrativeContext:
              "A dormant volcano with a mysterious glow inside. The cave within contains ancient dinosaur paintings that come to life and tell the story of the land.",
          },
        ],
      },
      {
        key: "companion",
        question: "¿Quién acompaña a {name} en la era prehistórica?",
        options: [
          {
            id: "triceratops",
            title: "Triceratops Amable",
            subtitle: "Fuerte, leal y le encanta jugar",
            icon: "cruelty_free",
            narrativeContext:
              "A gentle triceratops named Trix who is incredibly strong but very gentle. Loves playing hide-and-seek and gives the best dinosaur rides.",
          },
          {
            id: "pterodactyl",
            title: "Pterodáctilo Veloz",
            subtitle: "Ve todo desde las alturas",
            icon: "flight",
            narrativeContext:
              "A swift pterodactyl named Cielo who can spot anything from high above. Nervous but brave when it counts, and gives exhilarating flying rides.",
          },
          {
            id: "cave-child",
            title: "Niño/a de las Cavernas",
            subtitle: "Habla con gestos y sonrisas",
            icon: "face",
            narrativeContext:
              "A prehistoric child who communicates through gestures, drawings, and smiles. Despite the language barrier, they form an instant, deep friendship.",
          },
        ],
      },
      {
        key: "challenge",
        question: "¿Qué peligro amenaza a los dinosaurios de {name}?",
        options: [
          {
            id: "tar-pits",
            title: "Pantanos de Alquitrán",
            subtitle: "¡Los dinosaurios quedan atrapados!",
            icon: "water_drop",
            narrativeContext:
              "Expanding tar pits are trapping dinosaurs! The protagonist must find a way to free them and redirect the tar before it reaches the dinosaur nesting grounds.",
          },
          {
            id: "t-rex",
            title: "T-Rex Enfadado",
            subtitle: "Tiene dolor de muelas y gruñe a todos",
            icon: "pets",
            narrativeContext:
              "A grumpy T-Rex that's scaring everyone — but it turns out it just has a terrible toothache. The protagonist must find the courage to help the fearsome beast.",
          },
          {
            id: "meteor",
            title: "Lluvia de Estrellas",
            subtitle: "¡Algo se acerca desde el cielo!",
            icon: "stars",
            narrativeContext:
              "A spectacular meteor shower is heading toward the valley. The protagonist must organize an evacuation and find a safe cave for all the dinosaur families.",
          },
        ],
      },
    ],
    atmosphere: {
      timeOptions: [
        {
          id: "prehistoric-dawn",
          label: "Amanecer Jurásico",
          icon: "wb_twilight",
          iconColor: "text-amber-500",
          narrativeContext: "The scene takes place at a prehistoric dawn with mist rising from lush ferns, distant volcanoes silhouetted against a massive orange sun",
        },
        {
          id: "golden-afternoon",
          label: "Tarde en el Valle",
          icon: "sunny",
          iconColor: "text-yellow-600",
          narrativeContext: "The scene takes place during a warm afternoon in a vast dinosaur valley with herds grazing peacefully by a crystal-clear river",
        },
        {
          id: "starlit-night",
          label: "Noche Estrellada",
          icon: "bedtime",
          iconColor: "text-indigo-400",
          narrativeContext: "The scene takes place under a spectacular prehistoric night sky with no light pollution, constellations blazing brightly over sleeping dinosaurs",
        },
      ],
      settingOptions: [
        {
          id: "fern-valley",
          label: "Valle de Helechos",
          icon: "grass",
          bgColor: "bg-green-100",
          iconColor: "text-green-600",
          narrativeContext: "In a lush valley filled with giant ferns taller than houses, where gentle herbivores graze and waterfalls cascade down mossy cliffs",
        },
        {
          id: "dino-nests",
          label: "Nidos de Dinosaurio",
          icon: "egg",
          bgColor: "bg-amber-100",
          iconColor: "text-amber-600",
          narrativeContext: "Among the dinosaur nesting grounds, surrounded by enormous eggs and protective parents, a warm and intimate prehistoric nursery",
        },
        {
          id: "crystal-caves",
          label: "Cuevas de Cristal",
          icon: "diamond",
          bgColor: "bg-purple-100",
          iconColor: "text-purple-500",
          narrativeContext: "Inside ancient crystal caves with prehistoric paintings on the walls and crystals that project ancient memories like a movie",
        },
      ],
    },
    endings: [
      {
        id: "dino-farewell",
        title: "Despedida Jurásica",
        description: "Los dinosaurios rugen de alegría al despedirse de su nuevo amigo.",
        icon: "waving_hand",
        iconBg: "bg-green-100",
        iconColor: "text-green-600",
        narrativeContext: "The story ends with a heartfelt farewell — all the dinosaurs gather to say goodbye with gentle roars and nuzzles, and the baby dinosaur gives one last chirp of love.",
      },
      {
        id: "time-souvenir",
        title: "Recuerdo del Pasado",
        description: "Vuelve a casa con un pequeño fósil brillante que guarda la magia del viaje.",
        icon: "diamond",
        iconBg: "bg-amber-100",
        iconColor: "text-amber-600",
        narrativeContext: "The story ends with the protagonist returning home carrying a small glowing fossil — a gift from the dinosaurs that sparkles whenever they think about their prehistoric friends.",
      },
      {
        id: "sleeping-under-stars",
        title: "Bajo las Estrellas Antiguas",
        description: "Se duerme junto al triceratops mirando el cielo más antiguo del mundo.",
        icon: "bedtime",
        iconBg: "bg-indigo-100",
        iconColor: "text-indigo-600",
        narrativeContext: "The story ends peacefully, lying against the warm side of the triceratops, watching the most ancient sky in history and dreaming of a world where dinosaurs and children are friends.",
      },
    ],
  },

  // ── CASTLE ──────────────────────────────────────────────────
  {
    id: "castle",
    title: "El Castillo de los Sueños",
    ageMin: 6,
    ageMax: 10,
    ageRange: "6-10 años",
    description:
      "Un castillo encantado donde los sueños cobran vida y hay que salvar al reino de la oscuridad.",
    image: "/images/templates/castle.jpg",
    theme: "Enchanted castle, dream world, medieval fantasy with friendly dragons",
    moral: "Imagination is the greatest power of all",
    relatedInterests: ["castles"],
    themeColor: "#4a148c",
    themeGradient: "from-purple-900 to-violet-700",
    previewChapterTitle: "Las Puertas del Castillo",
    decisions: [
      {
        key: "encounter",
        question: "¿Qué descubre {name} al entrar en el castillo?",
        options: [
          {
            id: "dream-mirror",
            title: "Espejo de Sueños",
            subtitle: "Muestra mundos que solo tú puedes ver",
            icon: "image",
            narrativeContext:
              "A magical mirror that shows different dream worlds — each reflection leads to a new realm made of someone's imagination. The protagonist must find the right dream to save the kingdom.",
          },
          {
            id: "baby-dragon",
            title: "Dragón Bebé",
            subtitle: "Estornuda chispas de colores",
            icon: "local_fire_department",
            narrativeContext:
              "A baby dragon that sneezes colorful sparks instead of fire. It hatched from a golden egg in the throne room and thinks the protagonist is its parent.",
          },
          {
            id: "enchanted-armor",
            title: "Armadura Encantada",
            subtitle: "Se mueve sola y quiere ser tu amiga",
            icon: "shield",
            narrativeContext:
              "A suit of enchanted armor that moves on its own and speaks in a squeaky voice. It was once a brave knight cursed to be armor forever, and needs help breaking the spell.",
          },
        ],
      },
      {
        key: "companion",
        question: "¿Quién acompaña a {name} por el castillo?",
        options: [
          {
            id: "wise-cat",
            title: "Gato del Castillo",
            subtitle: "Conoce todos los pasadizos secretos",
            icon: "pets",
            narrativeContext:
              "A mysterious castle cat with starry eyes who has lived there for centuries. Knows every secret passage and hidden room, and purrs when danger is near.",
          },
          {
            id: "jester",
            title: "Bufón Mágico",
            subtitle: "Sus chistes hacen magia de verdad",
            icon: "sentiment_very_satisfied",
            narrativeContext:
              "A magical jester whose jokes literally come true — a punchline about flying makes everyone float, a joke about rain creates indoor clouds. Chaotic but lovable.",
          },
          {
            id: "ghost-princess",
            title: "Fantasma Amigable",
            subtitle: "Conoce la historia del castillo",
            icon: "auto_awesome",
            narrativeContext:
              "A friendly young ghost who once lived in the castle. Can walk through walls, turn invisible, and knows every secret of the castle's long history.",
          },
        ],
      },
      {
        key: "challenge",
        question: "¿Qué amenaza al reino de {name}?",
        options: [
          {
            id: "nightmare-cloud",
            title: "Nube de Pesadillas",
            subtitle: "Convierte los sueños en pesadillas",
            icon: "cloud_off",
            narrativeContext:
              "A dark cloud of nightmares is spreading through the castle, turning beautiful dreams into scary ones. The protagonist must find the source and fill it with happy thoughts.",
          },
          {
            id: "frozen-time",
            title: "Tiempo Congelado",
            subtitle: "Todo se detiene excepto tú",
            icon: "schedule",
            narrativeContext:
              "Time has frozen throughout the castle — everyone is stuck mid-action like statues. The protagonist must find the enchanted clock and restart time before it's too late.",
          },
          {
            id: "labyrinth",
            title: "Laberinto Cambiante",
            subtitle: "Los pasillos se mueven y cambian",
            icon: "grid_view",
            narrativeContext:
              "The castle's corridors keep shifting and rearranging like a living labyrinth. The protagonist must solve riddles at each turn to find the way to the throne room.",
          },
        ],
      },
    ],
    atmosphere: {
      timeOptions: [
        {
          id: "royal-dawn",
          label: "Amanecer Real",
          icon: "wb_twilight",
          iconColor: "text-amber-500",
          narrativeContext: "The scene takes place at dawn with golden light streaming through stained glass windows, painting the castle halls in rainbow colors",
        },
        {
          id: "enchanted-twilight",
          label: "Crepúsculo Encantado",
          icon: "nights_stay",
          iconColor: "text-purple-500",
          narrativeContext: "The scene takes place during a magical twilight when the castle's enchantments are strongest and the walls glow with ancient runes",
        },
        {
          id: "moonlit-night",
          label: "Noche de Luna",
          icon: "bedtime",
          iconColor: "text-indigo-400",
          narrativeContext: "The scene takes place on a moonlit night with silver light flooding through castle windows and the sound of a music box echoing through the halls",
        },
      ],
      settingOptions: [
        {
          id: "throne-room",
          label: "Sala del Trono",
          icon: "chair",
          bgColor: "bg-purple-100",
          iconColor: "text-purple-600",
          narrativeContext: "In the grand throne room with towering ceilings, tapestries that tell stories when you watch them, and a throne made of dreams",
        },
        {
          id: "tower",
          label: "Torre más Alta",
          icon: "castle",
          bgColor: "bg-sky-100",
          iconColor: "text-sky-600",
          narrativeContext: "At the top of the tallest tower, above the clouds, where you can see the entire dream kingdom stretching to the horizon",
        },
        {
          id: "gardens",
          label: "Jardines Encantados",
          icon: "local_florist",
          bgColor: "bg-green-100",
          iconColor: "text-green-500",
          narrativeContext: "In the enchanted castle gardens where flowers sing, hedges form into animal shapes, and a fountain grants small wishes",
        },
      ],
    },
    endings: [
      {
        id: "dream-coronation",
        title: "Coronación de Sueños",
        description: "El reino celebra con una corona hecha de estrellas y sueños cumplidos.",
        icon: "stars",
        iconBg: "bg-purple-100",
        iconColor: "text-purple-600",
        narrativeContext: "The story ends with a joyful coronation ceremony where the protagonist receives a crown made of starlight, and all the dream creatures celebrate with music and dancing.",
      },
      {
        id: "dragon-flight",
        title: "Vuelo con el Dragón",
        description: "Sobrevuela el reino en el lomo de un dragón amigable al atardecer.",
        icon: "flight",
        iconBg: "bg-amber-100",
        iconColor: "text-amber-600",
        narrativeContext: "The story ends with a breathtaking sunset flight on the back of a friendly dragon, soaring over the castle and the dream kingdom, seeing all the friends made along the way waving from below.",
      },
      {
        id: "dream-door",
        title: "La Puerta de los Sueños",
        description: "Descubre que puede volver al castillo cada vez que cierre los ojos.",
        icon: "door_front",
        iconBg: "bg-indigo-100",
        iconColor: "text-indigo-600",
        narrativeContext: "The story ends with the protagonist discovering a special door that opens every night in their dreams — they can return to the enchanted castle whenever they close their eyes and imagine.",
      },
    ],
  },

  // ── SAFARI ──────────────────────────────────────────────────
  {
    id: "safari",
    title: "Safari en la Sabana",
    ageMin: 4,
    ageMax: 7,
    ageRange: "4-7 años",
    description:
      "Una aventura por la sabana africana entre leones, elefantes y atardeceres que quitan el aliento.",
    image: "/images/templates/safari.jpg",
    theme: "African savanna adventure, wild animals, nature and conservation",
    moral: "Every creature, big or small, matters",
    relatedInterests: ["animals"],
    themeColor: "#e65100",
    themeGradient: "from-orange-800 to-amber-600",
    previewChapterTitle: "El Amanecer en la Sabana",
    decisions: [
      {
        key: "encounter",
        question: "¿Qué descubre {name} en la sabana?",
        options: [
          {
            id: "lion-cub",
            title: "Cachorro de León",
            subtitle: "Pequeño, valiente y con mucho sueño",
            icon: "pets",
            narrativeContext:
              "A tiny lion cub that has wandered away from its pride. Brave but sleepy, it yawns between each small adventure and needs help finding its way home.",
          },
          {
            id: "baobab-tree",
            title: "Baobab Parlante",
            subtitle: "El árbol más viejo cuenta historias",
            icon: "park",
            narrativeContext:
              "An ancient baobab tree that has been watching the savanna for thousands of years. It speaks in a deep, warm voice and tells stories of all the animals it has seen.",
          },
          {
            id: "watering-hole",
            title: "Oasis Mágico",
            subtitle: "Un lugar donde todos los animales son amigos",
            icon: "water_drop",
            narrativeContext:
              "A magical watering hole where all animals — predators and prey alike — come together peacefully. The water shows visions of the savanna's past and future.",
          },
        ],
      },
      {
        key: "companion",
        question: "¿Quién acompaña a {name} en el safari?",
        options: [
          {
            id: "elephant",
            title: "Elefante Sabio",
            subtitle: "Tiene la mejor memoria del mundo",
            icon: "cruelty_free",
            narrativeContext:
              "A wise old elephant who remembers every path, every rain, and every friend they've ever made. Gentle, protective, and gives the best trunk-hugs.",
          },
          {
            id: "meerkat",
            title: "Suricata Exploradora",
            subtitle: "Siempre de guardia, siempre alerta",
            icon: "visibility",
            narrativeContext:
              "An adventurous meerkat who stands on the tallest things to scout ahead. Quick, clever, and always has a plan (even if it's a silly one).",
          },
          {
            id: "giraffe",
            title: "Jirafa Amable",
            subtitle: "Ve todo desde muy arriba",
            icon: "straighten",
            narrativeContext:
              "A kind giraffe with the longest neck in the savanna, who can see everything from up high. Shy and gentle, but incredibly brave when friends are in danger.",
          },
        ],
      },
      {
        key: "challenge",
        question: "¿Qué problema amenaza la sabana de {name}?",
        options: [
          {
            id: "drought",
            title: "Gran Sequía",
            subtitle: "El agua se acaba y los animales tienen sed",
            icon: "wb_sunny",
            narrativeContext:
              "A terrible drought is drying up the savanna. Rivers are disappearing and animals are thirsty. The protagonist must find the hidden underground river to save everyone.",
          },
          {
            id: "lost-herd",
            title: "Manada Perdida",
            subtitle: "Los elefantes no encuentran el camino",
            icon: "explore",
            narrativeContext:
              "A herd of elephants has lost its way during the great migration. The protagonist must help guide them to the green valleys before the dry season arrives.",
          },
          {
            id: "trapped-animals",
            title: "Animales Atrapados",
            subtitle: "Un derrumbe bloquea el paso",
            icon: "warning",
            narrativeContext:
              "A rockslide has blocked the only path through the canyon, trapping a group of animals on the wrong side. The protagonist must find a creative way to free them.",
          },
        ],
      },
    ],
    atmosphere: {
      timeOptions: [
        {
          id: "savanna-sunrise",
          label: "Amanecer Africano",
          icon: "wb_twilight",
          iconColor: "text-orange-500",
          narrativeContext: "The scene takes place during a breathtaking African sunrise, with the sky ablaze in oranges and reds and silhouettes of acacia trees on the horizon",
        },
        {
          id: "golden-hour",
          label: "Hora Dorada",
          icon: "sunny",
          iconColor: "text-amber-500",
          narrativeContext: "The scene takes place during the golden hour when everything in the savanna glows warm and amber, and the animals prepare for evening",
        },
        {
          id: "starry-savanna",
          label: "Noche Estrellada",
          icon: "bedtime",
          iconColor: "text-indigo-400",
          narrativeContext: "The scene takes place under the vast African night sky, with the Milky Way visible and the sounds of the savanna creating a gentle nocturnal symphony",
        },
      ],
      settingOptions: [
        {
          id: "acacia-plains",
          label: "Llanura de Acacias",
          icon: "park",
          bgColor: "bg-amber-100",
          iconColor: "text-amber-700",
          narrativeContext: "On the vast golden plains dotted with umbrella-shaped acacia trees, herds of zebras and wildebeest in the distance",
        },
        {
          id: "river-crossing",
          label: "Cruce del Río",
          icon: "water",
          bgColor: "bg-blue-100",
          iconColor: "text-blue-600",
          narrativeContext: "At a wide river crossing where hippos float and crocodiles sun themselves, a crucial point in the great migration route",
        },
        {
          id: "kopje-rocks",
          label: "Rocas del Kopje",
          icon: "landscape",
          bgColor: "bg-stone-100",
          iconColor: "text-stone-600",
          narrativeContext: "Atop the ancient kopje rocks that rise from the plains like islands, offering panoramic views and shelter for the bravest climbers",
        },
      ],
    },
    endings: [
      {
        id: "sunset-gathering",
        title: "Reunión al Atardecer",
        description: "Todos los animales se reúnen al atardecer para celebrar con rugidos y cantos.",
        icon: "groups",
        iconBg: "bg-orange-100",
        iconColor: "text-orange-600",
        narrativeContext: "The story ends with all the savanna animals gathering at sunset — lions roar, elephants trumpet, and birds sing in a magnificent chorus of gratitude and friendship.",
      },
      {
        id: "baobab-promise",
        title: "La Promesa del Baobab",
        description: "Deja una marca en el baobab para recordar siempre la aventura.",
        icon: "park",
        iconBg: "bg-amber-100",
        iconColor: "text-amber-700",
        narrativeContext: "The story ends at the ancient baobab tree, where the protagonist carves a small mark — a promise to return and protect the savanna. The tree whispers 'I'll remember you' in the wind.",
      },
      {
        id: "stargazing-savanna",
        title: "Bajo el Cielo Africano",
        description: "Se tumba entre los animales a mirar la Vía Láctea sobre la sabana.",
        icon: "bedtime",
        iconBg: "bg-indigo-100",
        iconColor: "text-indigo-600",
        narrativeContext: "The story ends peacefully under the enormous African sky, lying between the warm elephant and the sleeping lion cub, watching shooting stars and feeling part of something vast and beautiful.",
      },
    ],
  },

  // ── INVENTOR ────────────────────────────────────────────────
  {
    id: "inventor",
    title: "La Fábrica de Inventos",
    ageMin: 8,
    ageMax: 12,
    ageRange: "8-12 años",
    description:
      "Un taller de inventos locos donde la creatividad y la ciencia se mezclan con la magia.",
    image: "/images/templates/inventor.jpg",
    theme: "Invention workshop, science and creativity, building fantastical machines",
    moral: "Mistakes are the best inventions waiting to happen",
    relatedInterests: ["space", "music"],
    themeColor: "#0277bd",
    themeGradient: "from-cyan-800 to-blue-600",
    previewChapterTitle: "El Taller Secreto",
    decisions: [
      {
        key: "encounter",
        question: "¿Qué descubre {name} en la fábrica de inventos?",
        options: [
          {
            id: "flying-machine",
            title: "Máquina Voladora",
            subtitle: "Hecha de paraguas y engranajes",
            icon: "flight",
            narrativeContext:
              "A half-built flying machine made of umbrellas, gears, and hope. It needs one final piece to work — something only the protagonist can provide: imagination.",
          },
          {
            id: "talking-invention",
            title: "Invento Parlante",
            subtitle: "¡Se ha inventado a sí mismo!",
            icon: "smart_toy",
            narrativeContext:
              "A machine that accidentally invented itself and is now sentient. It's curious about everything, asks endless questions, and wants to understand what 'fun' means.",
          },
          {
            id: "shrink-ray",
            title: "Rayo Miniaturizador",
            subtitle: "¡Todo se hace pequeñito!",
            icon: "zoom_in_map",
            narrativeContext:
              "A shrink ray that accidentally goes off and miniaturizes the protagonist, who must navigate the workshop at tiny scale — tools become mountains, screws become boulders.",
          },
        ],
      },
      {
        key: "companion",
        question: "¿Quién ayuda a {name} a inventar?",
        options: [
          {
            id: "genius-robot",
            title: "Robot Genio",
            subtitle: "Calcula todo pero no entiende los chistes",
            icon: "smart_toy",
            narrativeContext:
              "A brilliant robot who can calculate anything in milliseconds but doesn't understand humor, art, or feelings. Learning these from the protagonist makes the inventions truly special.",
          },
          {
            id: "mad-professor",
            title: "Profesor Despistado",
            subtitle: "Se olvida de todo menos de inventar",
            icon: "school",
            narrativeContext:
              "An absent-minded professor who forgets their own name but remembers every formula. Their lab coat has infinite pockets, each containing a different mini-invention.",
          },
          {
            id: "creative-spark",
            title: "Chispa Creativa",
            subtitle: "Una lucecita que aparece cuando tienes ideas",
            icon: "lightbulb",
            narrativeContext:
              "A tiny floating spark of light named Eureka that appears whenever someone has a great idea. It grows brighter with creativity and dims with doubt.",
          },
        ],
      },
      {
        key: "challenge",
        question: "¿Qué problema surge en la fábrica de {name}?",
        options: [
          {
            id: "chain-reaction",
            title: "Reacción en Cadena",
            subtitle: "¡Un invento activa todos los demás!",
            icon: "bolt",
            narrativeContext:
              "One invention accidentally triggers a chain reaction — every machine in the factory starts working at once, creating chaos. The protagonist must find the right sequence to shut them down.",
          },
          {
            id: "imagination-drain",
            title: "Sin Imaginación",
            subtitle: "¡Las ideas han desaparecido!",
            icon: "block",
            narrativeContext:
              "All imagination has drained from the factory — nothing works, no one can think of new ideas. The protagonist must find where the creativity went and bring it back.",
          },
          {
            id: "time-machine",
            title: "Máquina del Tiempo Rota",
            subtitle: "Mezcla pasado, presente y futuro",
            icon: "history",
            narrativeContext:
              "A time machine has malfunctioned and is mixing past, present, and future — dinosaurs in the kitchen, robots in medieval times. The protagonist must fix it before reality gets too scrambled.",
          },
        ],
      },
    ],
    atmosphere: {
      timeOptions: [
        {
          id: "eureka-morning",
          label: "Mañana de Ideas",
          icon: "lightbulb",
          iconColor: "text-yellow-500",
          narrativeContext: "The scene takes place in the bright morning when ideas flow freely, sunlight streaming through skylights onto workbenches covered in blueprints",
        },
        {
          id: "workshop-afternoon",
          label: "Tarde de Taller",
          icon: "build",
          iconColor: "text-blue-500",
          narrativeContext: "The scene takes place on a busy workshop afternoon with the sound of hammers, whirring gears, and the smell of oil and fresh wood shavings",
        },
        {
          id: "midnight-lab",
          label: "Laboratorio Nocturno",
          icon: "dark_mode",
          iconColor: "text-indigo-400",
          narrativeContext: "The scene takes place in the laboratory at midnight, lit only by bubbling experiments and glowing screens, the perfect time for secret inventions",
        },
      ],
      settingOptions: [
        {
          id: "main-workshop",
          label: "Taller Principal",
          icon: "construction",
          bgColor: "bg-blue-100",
          iconColor: "text-blue-600",
          narrativeContext: "In the main workshop with towering shelves of parts, a central workbench, hanging blueprints, and half-built inventions everywhere",
        },
        {
          id: "test-room",
          label: "Sala de Pruebas",
          icon: "science",
          bgColor: "bg-green-100",
          iconColor: "text-green-600",
          narrativeContext: "In the padded test room where inventions are tried for the first time — walls covered in scorch marks, dents, and paint splatters from previous experiments",
        },
        {
          id: "sky-garage",
          label: "Garaje del Cielo",
          icon: "flight",
          bgColor: "bg-sky-100",
          iconColor: "text-sky-500",
          narrativeContext: "In the rooftop sky garage with a retractable roof, launch pad for flying machines, and a telescope for stargazing between inventions",
        },
      ],
    },
    endings: [
      {
        id: "great-invention",
        title: "El Gran Invento",
        description: "Presenta el invento más increíble del mundo: uno que hace feliz a todos.",
        icon: "emoji_events",
        iconBg: "bg-blue-100",
        iconColor: "text-blue-600",
        narrativeContext: "The story ends with the protagonist unveiling their greatest invention — a machine that doesn't do anything 'useful' but makes everyone who sees it smile. The best invention of all.",
      },
      {
        id: "inventor-badge",
        title: "Insignia de Inventor",
        description: "Recibe la insignia oficial de inventor y un taller propio.",
        icon: "military_tech",
        iconBg: "bg-amber-100",
        iconColor: "text-amber-600",
        narrativeContext: "The story ends with a ceremony where the protagonist receives the official Inventor's Badge and the keys to their very own workshop corner — a place to create forever.",
      },
      {
        id: "blueprints",
        title: "Planos del Futuro",
        description: "Dibuja los planos de su próximo invento: ¡el más ambicioso hasta ahora!",
        icon: "draw",
        iconBg: "bg-cyan-100",
        iconColor: "text-cyan-600",
        narrativeContext: "The story ends with the protagonist sitting at their workbench, sketching blueprints for their next invention — something even more amazing. The adventure never really ends for a true inventor.",
      },
    ],
  },

  // ── CANDY ───────────────────────────────────────────────────
  {
    id: "candy",
    title: "El País de los Dulces",
    ageMin: 2,
    ageMax: 5,
    ageRange: "2-5 años",
    description:
      "Un mundo donde todo está hecho de dulces, chocolate y caramelo. ¡Pero cuidado con comer demasiado!",
    image: "/images/templates/candy.jpg",
    theme: "Candy world, sweet fantasy land, learning about balance and sharing",
    moral: "The sweetest things in life are shared with friends",
    relatedInterests: ["music", "animals"],
    themeColor: "#d81b60",
    themeGradient: "from-pink-700 to-rose-500",
    previewChapterTitle: "La Puerta de Caramelo",
    decisions: [
      {
        key: "encounter",
        question: "¿Qué descubre {name} en el País de los Dulces?",
        options: [
          {
            id: "chocolate-river",
            title: "Río de Chocolate",
            subtitle: "¡Fluye chocolate caliente!",
            icon: "water",
            narrativeContext:
              "A river of warm, flowing chocolate with marshmallow stepping stones and candy cane bridges. The fish are made of gummy bears and jump playfully.",
          },
          {
            id: "candy-garden",
            title: "Jardín de Gominolas",
            subtitle: "Flores de piruleta y árboles de regaliz",
            icon: "local_florist",
            narrativeContext:
              "A garden where flowers are lollipops, trees grow licorice branches, and the grass is made of green apple candy. Butterflies are made of cotton candy.",
          },
          {
            id: "cookie-house",
            title: "Casa de Galleta",
            subtitle: "Con tejas de chocolate y puerta de barquillo",
            icon: "cottage",
            narrativeContext:
              "A cozy house made entirely of cookies, with chocolate roof tiles, wafer doors, and windows of transparent sugar. Inside, everything is edible and delicious.",
          },
        ],
      },
      {
        key: "companion",
        question: "¿Quién acompaña a {name} por el País de los Dulces?",
        options: [
          {
            id: "gummy-bear",
            title: "Osito de Gominola",
            subtitle: "Blandito, alegre y muy dulce",
            icon: "cruelty_free",
            narrativeContext:
              "A cheerful gummy bear named Gomita who bounces everywhere and giggles when squeezed. Knows all the sweetest spots in candy land and loves to share.",
          },
          {
            id: "cookie-baker",
            title: "Pastelera de las Nubes",
            subtitle: "Hornea las nubes más esponjosas",
            icon: "bakery_dining",
            narrativeContext:
              "A friendly cloud baker who floats on a cotton candy cloud, baking the fluffiest pastries in the sky. Her oven runs on joy and her cookies taste like happiness.",
          },
          {
            id: "candy-fairy",
            title: "Hada de Azúcar",
            subtitle: "Su varita convierte todo en dulces",
            icon: "auto_awesome",
            narrativeContext:
              "A sugar fairy with translucent candy wings who can turn anything into sweets with a wave of her wand — but sometimes the transformations go hilariously wrong.",
          },
        ],
      },
      {
        key: "challenge",
        question: "¿Qué problema hay en el País de los Dulces de {name}?",
        options: [
          {
            id: "melting-kingdom",
            title: "Reino Derretido",
            subtitle: "¡Hace demasiado calor y todo se derrite!",
            icon: "wb_sunny",
            narrativeContext:
              "The sun is too strong and the entire candy kingdom is melting! Chocolate rivers are flooding, gummy bears are getting sticky. The protagonist must find the Ice Cream Mountain to cool everything down.",
          },
          {
            id: "sour-invasion",
            title: "Invasión Ácida",
            subtitle: "¡Los caramelos ácidos quieren conquistar!",
            icon: "sentiment_very_dissatisfied",
            narrativeContext:
              "An army of sour candies is taking over, turning everything bitter. But they're not evil — they just feel left out because nobody invites them to parties. The protagonist must help sweet and sour become friends.",
          },
          {
            id: "sugar-shortage",
            title: "Falta de Azúcar",
            subtitle: "¡Los dulces pierden su sabor!",
            icon: "water_drop",
            narrativeContext:
              "The sugar springs have dried up and all the candy is losing its flavor! The protagonist must journey to the Sugar Crystal Caves and restart the springs.",
          },
        ],
      },
    ],
    atmosphere: {
      timeOptions: [
        {
          id: "candy-morning",
          label: "Mañana de Caramelo",
          icon: "wb_twilight",
          iconColor: "text-pink-500",
          narrativeContext: "The scene takes place in a sweet candy morning with a cotton candy sunrise and the air smelling of fresh donuts and vanilla",
        },
        {
          id: "chocolate-afternoon",
          label: "Tarde de Chocolate",
          icon: "bakery_dining",
          iconColor: "text-amber-700",
          narrativeContext: "The scene takes place during a warm chocolate afternoon when the chocolate fountains flow fastest and the cookie trees are freshly baked",
        },
        {
          id: "marshmallow-night",
          label: "Noche de Malvavisco",
          icon: "bedtime",
          iconColor: "text-indigo-400",
          narrativeContext: "The scene takes place during a soft marshmallow night with a moon made of white chocolate and stars that twinkle like sugar crystals",
        },
      ],
      settingOptions: [
        {
          id: "candy-village",
          label: "Pueblo de Caramelo",
          icon: "cottage",
          bgColor: "bg-pink-100",
          iconColor: "text-pink-500",
          narrativeContext: "In a charming village where every house is made of different candy — gingerbread walls, gumdrop rooftops, and candy cane lampposts",
        },
        {
          id: "ice-cream-mountain",
          label: "Montaña de Helado",
          icon: "ac_unit",
          bgColor: "bg-blue-100",
          iconColor: "text-blue-400",
          narrativeContext: "On the slopes of Ice Cream Mountain, where different flavors create colorful layers and snow is actually powdered sugar",
        },
        {
          id: "lollipop-forest",
          label: "Bosque de Piruletas",
          icon: "forest",
          bgColor: "bg-green-100",
          iconColor: "text-green-500",
          narrativeContext: "In a forest of giant lollipop trees with rainbow canopies, where the paths are paved with jelly beans and the streams are liquid caramel",
        },
      ],
    },
    endings: [
      {
        id: "candy-feast",
        title: "Gran Banquete de Dulces",
        description: "Todo el reino celebra con la fiesta más dulce jamás vista.",
        icon: "cake",
        iconBg: "bg-pink-100",
        iconColor: "text-pink-600",
        narrativeContext: "The story ends with the most spectacular candy feast ever — tables stretching to the horizon, every sweet imaginable, and everyone sharing their favorite treats with each other.",
      },
      {
        id: "candy-pocket",
        title: "Bolsillo Mágico",
        description: "Vuelve a casa con un bolsillo que siempre tiene el dulce perfecto.",
        icon: "redeem",
        iconBg: "bg-amber-100",
        iconColor: "text-amber-600",
        narrativeContext: "The story ends with the protagonist receiving a magical pocket that always contains the perfect sweet for any occasion — but only when shared with someone else.",
      },
      {
        id: "sweet-dreams",
        title: "Dulces Sueños",
        description: "Se duerme en una cama de algodón de azúcar soñando con volver.",
        icon: "bedtime",
        iconBg: "bg-indigo-100",
        iconColor: "text-indigo-600",
        narrativeContext: "The story ends peacefully, curled up in a cotton candy bed under a marshmallow blanket, drifting off to the sweetest dreams imaginable, knowing the candy kingdom is always there.",
      },
    ],
  },
];

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/** Find a template config by its ID */
export function getTemplateConfig(templateId: string): StoryTemplateConfig | undefined {
  return STORY_TEMPLATES.find((t) => t.id === templateId);
}

/** Score and sort templates based on child's age and interests */
export function getRecommendedTemplates(
  age: number,
  interests: string[]
): (StoryTemplateConfig & { score: number; isRecommended: boolean })[] {
  const scored = STORY_TEMPLATES.map((template) => {
    let score = 0;

    // Age match: full score if within range, partial if close
    if (age >= template.ageMin && age <= template.ageMax) {
      score += 10;
    } else {
      const distance = Math.min(
        Math.abs(age - template.ageMin),
        Math.abs(age - template.ageMax)
      );
      score += Math.max(0, 5 - distance);
    }

    // Interest match: +5 per matching interest
    const matchingInterests = interests.filter((i) =>
      template.relatedInterests.includes(i)
    );
    score += matchingInterests.length * 5;

    return { ...template, score, isRecommended: false };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Mark the top one as recommended (only if score > 5)
  if (scored.length > 0 && scored[0].score > 5) {
    scored[0].isRecommended = true;
  }

  return scored;
}

/** Get the narrative context string for a decision choice */
export function getDecisionNarrative(
  template: StoryTemplateConfig,
  decisionKey: string,
  choiceId: string
): string | undefined {
  const decision = template.decisions.find((d) => d.key === decisionKey);
  const option = decision?.options.find((o) => o.id === choiceId);
  return option?.narrativeContext;
}

/** Get the narrative context string for an ending choice */
export function getEndingNarrative(
  template: StoryTemplateConfig,
  endingId: string
): string | undefined {
  return template.endings.find((e) => e.id === endingId)?.narrativeContext;
}

/** Get atmosphere narrative context */
export function getAtmosphereNarrative(
  template: StoryTemplateConfig,
  timeId?: string,
  settingId?: string
): { time?: string; setting?: string } {
  return {
    time: template.atmosphere.timeOptions.find((t) => t.id === timeId)?.narrativeContext,
    setting: template.atmosphere.settingOptions.find((s) => s.id === settingId)?.narrativeContext,
  };
}

// ============================================================
// CATALOG DEFAULTS — Pre-configured decisions for the catalog flow
// When a user enters via the catalog, these decisions are pre-selected
// so they skip Steps 3-5 and go directly to Step 2 → Generate.
// ============================================================

export interface CatalogDefaults {
  mode: CreationMode;
  decisions: StoryDecisions;
  ending: string;
  endingNote: string;
  dedication: string;
  senderName: string;
}

/** Default decisions for each template in catalog flow */
export const CATALOG_DEFAULTS: Record<string, CatalogDefaults> = {
  space: {
    mode: "solo",
    decisions: { encounter: "crystal", companion: "alien", challenge: "black-hole" },
    ending: "galactic-party",
    endingNote: "",
    dedication: "",
    senderName: "",
  },
  forest: {
    mode: "juntos",
    decisions: { encounter: "dragon", companion: "fox", challenge: "fog" },
    ending: "magic-seed",
    endingNote: "",
    dedication: "",
    senderName: "",
  },
  superhero: {
    mode: "solo",
    decisions: { encounter: "mask", companion: "hero-dog", challenge: "laugh-thief" },
    ending: "secret-identity",
    endingNote: "",
    dedication: "",
    senderName: "",
  },
  pirates: {
    mode: "juntos",
    decisions: { encounter: "treasure-map", companion: "monkey", challenge: "kraken" },
    ending: "true-treasure",
    endingNote: "",
    dedication: "",
    senderName: "",
  },
  chef: {
    mode: "juntos",
    decisions: { encounter: "living-ingredient", companion: "singing-spoon", challenge: "growing-cake" },
    ending: "grand-feast",
    endingNote: "",
    dedication: "",
    senderName: "",
  },
  dinosaurs: {
    mode: "juntos",
    decisions: { encounter: "baby-dino", companion: "triceratops", challenge: "t-rex" },
    ending: "dino-farewell",
    endingNote: "",
    dedication: "",
    senderName: "",
  },
  castle: {
    mode: "solo",
    decisions: { encounter: "baby-dragon", companion: "wise-cat", challenge: "nightmare-cloud" },
    ending: "dragon-flight",
    endingNote: "",
    dedication: "",
    senderName: "",
  },
  safari: {
    mode: "juntos",
    decisions: { encounter: "lion-cub", companion: "elephant", challenge: "drought" },
    ending: "sunset-gathering",
    endingNote: "",
    dedication: "",
    senderName: "",
  },
  inventor: {
    mode: "solo",
    decisions: { encounter: "flying-machine", companion: "mad-professor", challenge: "chain-reaction" },
    ending: "great-invention",
    endingNote: "",
    dedication: "",
    senderName: "",
  },
  candy: {
    mode: "juntos",
    decisions: { encounter: "chocolate-river", companion: "gummy-bear", challenge: "sour-invasion" },
    ending: "candy-feast",
    endingNote: "",
    dedication: "",
    senderName: "",
  },
};

/** Get catalog defaults for a template */
export function getCatalogDefaults(templateId: string): CatalogDefaults | undefined {
  return CATALOG_DEFAULTS[templateId];
}
