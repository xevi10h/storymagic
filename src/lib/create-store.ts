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
  skinTone: string;
  gender: Gender;
  hairstyle: string;
  interests: string[];
  specialTrait: string;
  favoriteCompanion: string;
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
  selectedTemplate: string | null;
  decisions: StoryDecisions;
  dedication: string;
  senderName: string;
  ending: EndingChoice;
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
    skinTone: "#fce4d6",
    gender: "boy",
    hairstyle: "short",
    interests: [],
    specialTrait: "",
    favoriteCompanion: "",
  },
  selectedTemplate: null,
  decisions: {},
  dedication: "",
  senderName: "",
  ending: null,
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

export const SKIN_TONES = [
  { id: "light", color: "#fce4d6" },
  { id: "medium-light", color: "#eebb99" },
  { id: "medium-dark", color: "#c68642" },
  { id: "dark", color: "#8d5524" },
  { id: "very-dark", color: "#523218" },
];

export const INTERESTS = [
  { id: "space", label: "Espacio", icon: "rocket_launch" },
  { id: "animals", label: "Animales", icon: "pets" },
  { id: "sports", label: "Deportes", icon: "sports_soccer" },
  { id: "castles", label: "Castillos", icon: "castle" },
  { id: "dinosaurs", label: "Dinosaurios", icon: "cruelty_free" },
  { id: "music", label: "Música", icon: "music_note" },
];

export interface HairstyleOption {
  id: string;
  label: string;
  icon: string;
}

export const HAIRSTYLES: Record<Gender, HairstyleOption[]> = {
  boy: [
    { id: "short", label: "Corto", icon: "content_cut" },
    { id: "curly", label: "Rizado", icon: "waves" },
    { id: "spiky", label: "De punta", icon: "north" },
    { id: "buzz", label: "Rapado", icon: "circle" },
  ],
  girl: [
    { id: "long", label: "Largo liso", icon: "straighten" },
    { id: "curly", label: "Rizado", icon: "waves" },
    { id: "pigtails", label: "Coletas", icon: "diversity_1" },
    { id: "bob", label: "Melena", icon: "content_cut" },
  ],
  neutral: [
    { id: "medium", label: "Medio", icon: "straighten" },
    { id: "curly", label: "Rizado", icon: "waves" },
    { id: "short", label: "Corto", icon: "content_cut" },
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
    ageMin: 4,
    ageMax: 7,
    ageRange: "4-7 años",
    description:
      "Un viaje a las estrellas donde descubrirán planetas desconocidos y harán amigos alienígenas.",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuD5og5A51uVb2WCU32gqb0-QQRw4qOJg3agmHlIIujlVx2vxrXBEjjlIgefGj6P0LYSCmLnDjoBtF_u4-QoQZBAEyTcrI39YBshH_Y8vB3WuHzbcrfVfzipgw4xYabOoYoOJ2nXgdvV_dLLoWSh4IJ4KeUnXU7G8ozW1ZkC9LZbGvEGTLohongxVnZBhcy0wkxJ-yumwLjbrdYmH2B-v8awizqEkEUNc4nnltypwVAG6zsGn-JVu9HvnYtR5Vh6OZoZ_Tfvfxwvekwv",
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
    ageMin: 3,
    ageMax: 6,
    ageRange: "3-6 años",
    description:
      "Secretos entre los árboles antiguos y criaturas fantásticas que necesitan ayuda.",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBdax-IuRAdYXnYVewgRQrK3BmBdVmrOU-p5wCYae2GXim0fNskv2IKQpjDeOP_L_6uzJrzFRdBO2I03riRwK7Jj6HK4W_Se91e-RWFJk384A3tKftRkJEuNLZKgx-SCt_U55HBbEPJafk5wwZ4a-ndShIbJKaX1MMq2faTQv1r9tIQVzpPF66Pk5Q047h5J-FBQAXbVhlM4r-MQepNvC7JFwFr9XSWNtxS9Nszg81hgxanfcvJzAIhK9hFMn_Oo92bTJsn-dlUQkyQ",
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
    ageMin: 5,
    ageMax: 8,
    ageRange: "5-8 años",
    description:
      "¡A salvar la ciudad! Descubre superpoderes ocultos y aprende el valor de la valentía.",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBFSuezAiiPjTc_TWd9v6i3b0xpo2Cp4hc7sjGTkKKGyM8WAq-EPBAyFiCpq4Ie64H8zBuf7foFmbmFNQ4kZzdrkYOrudcb9Yd5Iah_5zxC1ivp3z57imepQbomjZoaMh0klH_7D--OEPYNixD-dbdrJ1gg9aS_bnIQP49sOmhEClTqKnsLDufeRCTTzr7QY3iKiKerBF2DOzmWd71TyGhDbYIndTZpzBKbWvqBpdVm97aHT9A5JJs8xZUm50S2zmvmpiaDZkrfMDSc",
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
    ageMin: 4,
    ageMax: 8,
    ageRange: "4-8 años",
    description:
      "En busca del tesoro perdido navegando los siete mares con una tripulación muy divertida.",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAGqNTVDqIxlIgmXNsHpXMuGZhSsVAR9uXWoLI_Kq3pX6e5QWL2NepQGuRcZMOh8TqjoLHxOmWQctO4P5FaKKC_5fJW3sOiEkkia-YnL6obfPyQtTiOWibQ2FpnXJzANYpoCu3acj-VHtwDS4nBFcVueGAzd75E1vUsVSAuhxBROomp_9UiXDm7soPLCdvOHujUBKhHleDEGxTrhzUyf0oMEWEDfGNL6AAmVfUERt7RwI8JKrzg37SJ1QU9LWHd7kKm38hNj4RP7NRO",
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
    ageMax: 5,
    ageRange: "2-5 años",
    description:
      "Una cocina llena de magia donde los ingredientes cobran vida y bailan en la olla.",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuChN1pFS5YZuf_VTjg1XbPmCxdu2kZoSKDJIxEqILulM32om9BWu_sV_YLo2ujiO9btUqouVxD_qlxSHxVAvFotYYihg4lbmMAmx0ykh0g1tg9kCF11Tfk9hpXqoXkMrQFFmCNiZNfJSPvseAB2kwA1h8BxwzpgOV5kAg7yWUokTrIgVgA2cC0obvyYUUSfHBuSExq5Jee1K0ZqFUb9kJxX7NfHEiFu09xNzlp_J33flFm8szCVWE8OPK45kfKKZ18N1jED89U_OKrX",
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
