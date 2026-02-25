"use client";

import type { CharacterData, Gender } from "@/lib/create-store";
import CreationHeader from "./CreationHeader";
import CreationFooterNav from "./CreationFooterNav";
import { HAIR_COLORS, SKIN_TONES, INTERESTS, HAIRSTYLES } from "@/lib/create-store";
import {
  getAvatarUrl,
  INTEREST_RING_COLORS,
  DEFAULT_RING,
} from "@/lib/avatar-library";

interface Step2Props {
  character: CharacterData;
  onUpdateCharacter: (updates: Partial<CharacterData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function Step2CharacterCreation({
  character,
  onUpdateCharacter,
  onNext,
  onBack,
}: Step2Props) {
  const toggleInterest = (id: string) => {
    const current = character.interests;
    if (current.includes(id)) {
      onUpdateCharacter({ interests: current.filter((i) => i !== id) });
    } else if (current.length < 5) {
      onUpdateCharacter({ interests: [...current, id] });
    }
  };

  // When gender changes, reset hairstyle to the first option for that gender
  const handleGenderChange = (gender: Gender) => {
    const firstHairstyle = HAIRSTYLES[gender][0].id;
    onUpdateCharacter({ gender, hairstyle: firstHairstyle });
  };

  const avatarUrl = getAvatarUrl(character);
  const hairstyleOptions = HAIRSTYLES[character.gender];

  const greetingText = character.name
    ? `¡Hola, ${character.name}!`
    : "¡Hola, héroe!";

  const interestLabels = character.interests
    .map((id) => INTERESTS.find((i) => i.id === id)?.label)
    .filter(Boolean);

  const previewText =
    interestLabels.length > 0
      ? `Tu héroe está listo para vivir aventuras entre ${interestLabels.join(" y ").toLowerCase()}.`
      : "Personaliza los detalles mágicos para que el cuento sea único.";

  return (
    <div className="flex flex-col min-h-screen bg-create-bg">
      <CreationHeader currentStep={2} rightAction="save" />

      {/* Main */}
      <main className="flex-1 flex flex-col lg:flex-row h-full max-w-7xl mx-auto w-full">
        {/* Left: Form */}
        <section className="flex-1 flex flex-col w-full lg:w-[55%] px-6 lg:px-12 py-4 lg:py-8 overflow-y-auto no-scrollbar">
          <div className="mb-8 text-center lg:text-left">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-create-text mb-4 leading-tight">
              Crea a tu pequeño héroe
            </h1>
            <p className="text-create-text-sub text-lg font-medium">
              Personaliza los detalles mágicos para que el cuento sea único.
            </p>
          </div>

          <div className="flex flex-col gap-6 max-w-xl mx-auto lg:mx-0">
            {/* Name & City */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="flex flex-col gap-2">
                <label className="text-create-text font-bold text-base ml-1">
                  Nombre del niño/a
                </label>
                <div className="relative group">
                  <input
                    type="text"
                    value={character.name}
                    onChange={(e) =>
                      onUpdateCharacter({ name: e.target.value })
                    }
                    placeholder="Ej: Leo"
                    className="w-full h-14 px-5 rounded-[16px] border-2 border-transparent bg-white shadow-sm group-hover:shadow-md focus:border-create-primary focus:ring-0 transition-all outline-none placeholder:text-gray-300 text-lg font-bold text-create-text"
                  />
                  <span className="material-symbols-outlined absolute right-5 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-create-primary transition-colors">
                    edit
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-create-text font-bold text-base ml-1">
                  Vive en
                </label>
                <div className="relative group">
                  <input
                    type="text"
                    value={character.city}
                    onChange={(e) =>
                      onUpdateCharacter({ city: e.target.value })
                    }
                    placeholder="Ej: Madrid"
                    className="w-full h-14 px-5 rounded-[16px] border-2 border-transparent bg-white shadow-sm group-hover:shadow-md focus:border-create-primary focus:ring-0 transition-all outline-none placeholder:text-gray-300 text-lg font-bold text-create-text"
                  />
                  <span className="material-symbols-outlined absolute right-5 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-create-primary transition-colors">
                    location_on
                  </span>
                </div>
              </div>
            </div>

            {/* Age slider */}
            <div className="flex flex-col gap-4 p-6 bg-white rounded-[24px] shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-center mb-2">
                <label className="text-create-text font-bold text-base">
                  Edad
                </label>
                <span className="text-create-primary font-display text-xl">
                  {character.age} {character.age === 1 ? "año" : "años"}
                </span>
              </div>
              <div className="relative w-full h-8 flex items-center">
                <input
                  type="range"
                  min={1}
                  max={12}
                  value={character.age}
                  onChange={(e) =>
                    onUpdateCharacter({ age: parseInt(e.target.value) })
                  }
                  className="create-slider w-full relative z-10"
                />
              </div>
              <div className="flex justify-between text-xs text-create-text-sub font-bold mt-1 px-1">
                <span>1</span>
                <span>12</span>
              </div>
            </div>

            {/* Hair & Skin */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-3">
                <label className="text-create-text font-bold text-base ml-1">
                  Color de pelo
                </label>
                <div className="flex flex-wrap gap-3">
                  {HAIR_COLORS.map((h) => {
                    const isSelected = character.hairColor === h.color;
                    return (
                      <button
                        key={h.id}
                        onClick={() =>
                          onUpdateCharacter({ hairColor: h.color })
                        }
                        className={`w-12 h-12 rounded-full transition-all ${
                          isSelected
                            ? "ring-4 ring-create-primary ring-offset-2 shadow-md scale-110"
                            : "ring-4 ring-transparent hover:scale-110 hover:shadow-lg"
                        }`}
                        style={{ backgroundColor: h.color }}
                      >
                        {isSelected && (
                          <span
                            className={`material-symbols-outlined font-bold text-lg ${h.id === "blonde" ? "text-gray-800" : "text-white"}`}
                          >
                            check
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <label className="text-create-text font-bold text-base ml-1">
                  Tono de piel
                </label>
                <div className="flex flex-wrap gap-3">
                  {SKIN_TONES.map((s) => {
                    const isSelected = character.skinTone === s.color;
                    return (
                      <button
                        key={s.id}
                        onClick={() =>
                          onUpdateCharacter({ skinTone: s.color })
                        }
                        className={`w-12 h-12 rounded-full transition-all ${
                          isSelected
                            ? "ring-4 ring-create-primary ring-offset-2 shadow-md scale-110"
                            : "ring-4 ring-transparent hover:scale-110 hover:shadow-lg"
                        }`}
                        style={{ backgroundColor: s.color }}
                      >
                        {isSelected && (
                          <span
                            className={`material-symbols-outlined font-bold text-lg ${s.id === "light" || s.id === "medium-light" ? "text-gray-800" : "text-white"}`}
                          >
                            check
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Gender */}
            <div className="flex flex-col gap-3">
              <label className="text-create-text font-bold text-base ml-1">
                Género
              </label>
              <div className="flex gap-4 p-1 bg-white rounded-full shadow-sm w-fit">
                {(
                  [
                    { id: "boy", label: "Niño", icon: "boy" },
                    { id: "girl", label: "Niña", icon: "girl" },
                    {
                      id: "neutral",
                      label: "Neutro",
                      icon: "sentiment_satisfied",
                    },
                  ] as const
                ).map((g) => (
                  <button
                    key={g.id}
                    onClick={() => handleGenderChange(g.id as Gender)}
                    className={`py-3 px-6 rounded-full font-bold flex items-center justify-center gap-2 transition-all ${
                      character.gender === g.id
                        ? "bg-create-primary text-white shadow-md scale-105"
                        : "text-create-text-sub hover:bg-gray-50 hover:text-create-primary"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {g.icon}
                    </span>
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Hairstyle */}
            <div className="flex flex-col gap-3">
              <label className="text-create-text font-bold text-base ml-1">
                Peinado
              </label>
              <div className="flex flex-wrap gap-3">
                {hairstyleOptions.map((hs) => {
                  const isSelected = character.hairstyle === hs.id;
                  return (
                    <button
                      key={hs.id}
                      onClick={() =>
                        onUpdateCharacter({ hairstyle: hs.id })
                      }
                      className={`px-5 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 transform hover:-translate-y-1 ${
                        isSelected
                          ? "bg-create-primary text-white shadow-md"
                          : "bg-white text-create-text border-2 border-transparent hover:border-create-primary/30 hover:bg-create-primary/5 shadow-sm"
                      }`}
                    >
                      <span
                        className={`material-symbols-outlined text-lg ${!isSelected ? "text-create-text-sub" : ""}`}
                      >
                        {hs.icon}
                      </span>
                      {hs.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Interests */}
            <div className="flex flex-col gap-3 mb-10">
              <label className="text-create-text font-bold text-base ml-1">
                Le encanta...
              </label>
              <div className="flex flex-wrap gap-3">
                {INTERESTS.map((interest) => {
                  const isSelected = character.interests.includes(interest.id);
                  return (
                    <button
                      key={interest.id}
                      onClick={() => toggleInterest(interest.id)}
                      className={`px-5 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 transform hover:-translate-y-1 ${
                        isSelected
                          ? "bg-create-primary text-white shadow-md"
                          : "bg-white text-create-text border-2 border-transparent hover:border-create-primary/30 hover:bg-create-primary/5 shadow-sm"
                      }`}
                    >
                      <span
                        className={`material-symbols-outlined text-lg ${!isSelected ? "text-create-text-sub" : ""}`}
                      >
                        {interest.icon}
                      </span>
                      {interest.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Spacer for footer nav */}
            <div className="pb-4" />
          </div>
        </section>

        {/* Right: Character Card (desktop only) */}
        <section className="hidden lg:flex flex-col items-center justify-center w-[45%] relative">
          {/* Decorative background blobs */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-[10%] right-[5%] w-48 h-48 rounded-full bg-create-primary/5 blur-3xl" />
            <div className="absolute bottom-[15%] left-[10%] w-36 h-36 rounded-full bg-amber-200/20 blur-3xl" />
          </div>

          {/* Character card */}
          <div className="relative z-10 w-[320px] flex flex-col items-center">
            {/* Avatar frame with floating interest icons */}
            <div className="relative mb-6">
              {/* Floating interest icons orbiting the avatar */}
              {character.interests.slice(0, 4).map((id, i) => {
                const interest = INTERESTS.find((int) => int.id === id);
                if (!interest) return null;
                // Position around the circle: top-left, mid-right, bottom-right, bottom-left
                // Avoid top-right corner where the age badge sits
                const positions = [
                  { top: "-8px", left: "10px" },
                  { top: "40%", right: "-18px" },
                  { bottom: "8px", right: "2px" },
                  { bottom: "8px", left: "2px" },
                ];
                const pos = positions[i];
                return (
                  <div
                    key={id}
                    className="absolute z-20 flex items-center justify-center w-10 h-10 rounded-full bg-white shadow-lg border-2 border-create-primary/15 animate-create-float"
                    style={{
                      ...pos,
                      animationDelay: `${i * 0.5}s`,
                      animationDuration: `${3.5 + i * 0.4}s`,
                    }}
                  >
                    <span className="material-symbols-outlined text-create-primary text-xl">
                      {interest.icon}
                    </span>
                  </div>
                );
              })}

              {/* Outer gradient ring — changes color with interests */}
              <div
                className={`w-64 h-64 rounded-full p-1.5 bg-linear-to-br shadow-xl transition-all duration-500 ${
                  character.interests.length > 0 &&
                  INTEREST_RING_COLORS[character.interests[0]]
                    ? `${INTEREST_RING_COLORS[character.interests[0]].from} ${INTEREST_RING_COLORS[character.interests[0]].via} ${INTEREST_RING_COLORS[character.interests[0]].to} shadow-current/15`
                    : `${DEFAULT_RING.from} ${DEFAULT_RING.via} ${DEFAULT_RING.to} shadow-create-primary/15`
                }`}
              >
                <div className="w-full h-full rounded-full overflow-hidden relative">
                  <img
                    key={avatarUrl}
                    alt="Character avatar preview"
                    className="w-full h-full object-cover transition-all duration-300 ease-out animate-fade-in"
                    src={avatarUrl}
                  />
                </div>
              </div>

              {/* Age badge — top right */}
              <div className="absolute -top-1 -right-1 z-10 bg-white rounded-full shadow-lg border-2 border-create-primary/20 w-14 h-14 flex flex-col items-center justify-center transition-all duration-300">
                <span className="text-create-primary font-display text-lg leading-none">
                  {character.age}
                </span>
                <span className="text-[9px] font-bold text-create-text-sub leading-none mt-0.5">
                  {character.age === 1 ? "año" : "años"}
                </span>
              </div>

              {/* Trait dots — bottom left */}
              <div className="absolute -bottom-1 -left-1 z-10 flex gap-1.5 bg-white rounded-full shadow-lg border border-create-primary/10 px-3 py-2">
                <div
                  className="w-5 h-5 rounded-full ring-2 ring-white shadow-sm transition-colors duration-300"
                  style={{ backgroundColor: character.skinTone }}
                  title="Tono de piel"
                />
                <div
                  className="w-5 h-5 rounded-full ring-2 ring-white shadow-sm transition-colors duration-300"
                  style={{ backgroundColor: character.hairColor }}
                  title="Color de pelo"
                />
              </div>
            </div>

            {/* Name and greeting */}
            <div className="text-center mb-4">
              <h3 className="text-3xl font-display text-create-text leading-tight">
                {greetingText}
              </h3>
            </div>

            {/* Info card */}
            <div className="w-full bg-white/70 backdrop-blur-sm rounded-2xl border border-create-primary/10 shadow-sm p-5 flex flex-col gap-3">
              {/* Gender + Hairstyle row */}
              <div className="flex items-center gap-2 text-sm">
                <span className="material-symbols-outlined text-create-primary text-base">
                  {character.gender === "boy" ? "boy" : character.gender === "girl" ? "girl" : "sentiment_satisfied"}
                </span>
                <span className="font-bold text-create-text">
                  {character.gender === "boy" ? "Niño" : character.gender === "girl" ? "Niña" : "Neutro"}
                </span>
                <span className="text-create-text-sub">·</span>
                <span className="text-create-text-sub font-medium">
                  {hairstyleOptions.find((h) => h.id === character.hairstyle)?.label || ""}
                </span>
              </div>

              {/* Interests */}
              {character.interests.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {character.interests.map((id) => {
                    const interest = INTERESTS.find((i) => i.id === id);
                    if (!interest) return null;
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-create-primary/8 text-create-primary text-xs font-bold"
                      >
                        <span className="material-symbols-outlined text-sm">
                          {interest.icon}
                        </span>
                        {interest.label}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <p className="text-create-text-sub text-sm font-medium italic">
                  Elige sus intereses para personalizar la aventura...
                </p>
              )}

              {/* Preview text */}
              {interestLabels.length > 0 && (
                <p className="text-create-text-sub text-sm leading-relaxed border-t border-create-primary/5 pt-3">
                  {previewText}
                </p>
              )}
            </div>
          </div>
        </section>
      </main>

      <CreationFooterNav onBack={onBack} onNext={onNext} nextDisabled={!character.name} />
    </div>
  );
}
