// State management for the book creation flow

export type CreationMode = "solo" | "juntos" | null;
export type Gender = "boy" | "girl" | "neutral";
export type EndingChoice = "banquet" | "stars" | null;

export interface CharacterData {
  name: string;
  city: string;
  age: number;
  hairColor: string;
  skinTone: string;
  gender: Gender;
  hairstyle: string;
  interests: string[];
}

export interface StoryTemplate {
  id: string;
  title: string;
  ageRange: string;
  description: string;
  image: string;
}

export interface StoryDecisions {
  // Juntos mode
  forestChoice?: string;
  // Solo mode
  timeOfDay?: "day" | "sunset" | "night";
  weather?: "rain" | "wind" | "fog" | "sparkles";
  companion?: string;
  magicTool?: string;
  challenge?: string;
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
  },
  selectedTemplate: null,
  decisions: {},
  dedication: "",
  senderName: "",
  ending: null,
};

export const STORY_TEMPLATES: StoryTemplate[] = [
  {
    id: "space",
    title: "La Gran Aventura Espacial",
    ageRange: "4-7 años",
    description:
      "Un viaje a las estrellas donde descubrirán planetas desconocidos y harán amigos alienígenas.",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuD5og5A51uVb2WCU32gqb0-QQRw4qOJg3agmHlIIujlVx2vxrXBEjjlIgefGj6P0LYSCmLnDjoBtF_u4-QoQZBAEyTcrI39YBshH_Y8vB3WuHzbcrfVfzipgw4xYabOoYoOJ2nXgdvV_dLLoWSh4IJ4KeUnXU7G8ozW1ZkC9LZbGvEGTLohongxVnZBhcy0wkxJ-yumwLjbrdYmH2B-v8awizqEkEUNc4nnltypwVAG6zsGn-JVu9HvnYtR5Vh6OZoZ_Tfvfxwvekwv",
  },
  {
    id: "forest",
    title: "El Bosque Mágico",
    ageRange: "3-6 años",
    description:
      "Secretos entre los árboles antiguos y criaturas fantásticas que necesitan ayuda.",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBdax-IuRAdYXnYVewgRQrK3BmBdVmrOU-p5wCYae2GXim0fNskv2IKQpjDeOP_L_6uzJrzFRdBO2I03riRwK7Jj6HK4W_Se91e-RWFJk384A3tKftRkJEuNLZKgx-SCt_U55HBbEPJafk5wwZ4a-ndShIbJKaX1MMq2faTQv1r9tIQVzpPF66Pk5Q047h5J-FBQAXbVhlM4r-MQepNvC7JFwFr9XSWNtxS9Nszg81hgxanfcvJzAIhK9hFMn_Oo92bTJsn-dlUQkyQ",
  },
  {
    id: "superhero",
    title: "Superhéroe por un Día",
    ageRange: "5-8 años",
    description:
      "¡A salvar la ciudad! Descubre superpoderes ocultos y aprende el valor de la valentía.",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBFSuezAiiPjTc_TWd9v6i3b0xpo2Cp4hc7sjGTkKKGyM8WAq-EPBAyFiCpq4Ie64H8zBuf7foFmbmFNQ4kZzdrkYOrudcb9Yd5Iah_5zxC1ivp3z57imepQbomjZoaMh0klH_7D--OEPYNixD-dbdrJ1gg9aS_bnIQP49sOmhEClTqKnsLDufeRCTTzr7QY3iKiKerBF2DOzmWd71TyGhDbYIndTZpzBKbWvqBpdVm97aHT9A5JJs8xZUm50S2zmvmpiaDZkrfMDSc",
  },
  {
    id: "pirates",
    title: "Piratas del Mar",
    ageRange: "4-8 años",
    description:
      "En busca del tesoro perdido navegando los siete mares con una tripulación muy divertida.",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAGqNTVDqIxlIgmXNsHpXMuGZhSsVAR9uXWoLI_Kq3pX6e5QWL2NepQGuRcZMOh8TqjoLHxOmWQctO4P5FaKKC_5fJW3sOiEkkia-YnL6obfPyQtTiOWibQ2FpnXJzANYpoCu3acj-VHtwDS4nBFcVueGAzd75E1vUsVSAuhxBROomp_9UiXDm7soPLCdvOHujUBKhHleDEGxTrhzUyf0oMEWEDfGNL6AAmVfUERt7RwI8JKrzg37SJ1QU9LWHd7kKm38hNj4RP7NRO",
  },
  {
    id: "chef",
    title: "El Chef Más Pequeño",
    ageRange: "2-5 años",
    description:
      "Una cocina llena de magia donde los ingredientes cobran vida y bailan en la olla.",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuChN1pFS5YZuf_VTjg1XbPmCxdu2kZoSKDJIxEqILulM32om9BWu_sV_YLo2ujiO9btUqouVxD_qlxSHxVAvFotYYihg4lbmMAmx0ykh0g1tg9kCF11Tfk9hpXqoXkMrQFFmCNiZNfJSPvseAB2kwA1h8BxwzpgOV5kAg7yWUokTrIgVgA2cC0obvyYUUSfHBuSExq5Jee1K0ZqFUb9kJxX7NfHEiFu09xNzlp_J33flFm8szCVWE8OPK45kfKKZ18N1jED89U_OKrX",
  },
];

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
