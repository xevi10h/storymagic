"use client";

import { useTranslations } from "next-intl";
import type { CharacterData, CreationMode, Gender } from "@/lib/create-store";
import CreationHeader from "./CreationHeader";
import CreationFooterNav from "./CreationFooterNav";
import { HAIR_COLORS, EYE_COLORS, SKIN_TONES, INTERESTS, HAIRSTYLES, getHairHex, getEyeHex, getSkinHex } from "@/lib/create-store";

interface Step2Props {
  mode: CreationMode;
  character: CharacterData;
  catalogMode?: boolean;
  onUpdateCharacter: (updates: Partial<CharacterData>) => void;
  onNext: () => void;
  onBack: () => void;
}

/** Animated nebula placeholder — mystery silhouette while character is being configured. */
function NebulaPlaceholder({ size, name }: { size: number; name: string }) {
  return (
    <div
      className="rounded-full flex items-center justify-center overflow-hidden relative"
      style={{
        width: size,
        height: size,
        background: "radial-gradient(ellipse at 35% 40%, rgba(217,119,6,0.25) 0%, transparent 55%), radial-gradient(ellipse at 65% 60%, rgba(180,83,9,0.2) 0%, transparent 50%), radial-gradient(circle at 50% 50%, rgba(251,191,36,0.15) 0%, rgba(217,119,6,0.08) 60%, transparent 80%)",
      }}
    >
      {/* Slow-rotating nebula layers */}
      <div
        className="absolute inset-0 rounded-full animate-spin"
        style={{
          animationDuration: "15s",
          background: "conic-gradient(from 0deg, transparent 0%, rgba(217,119,6,0.12) 25%, transparent 50%, rgba(251,191,36,0.1) 75%, transparent 100%)",
        }}
      />
      <div
        className="absolute inset-3 rounded-full animate-spin"
        style={{
          animationDuration: "10s",
          animationDirection: "reverse",
          background: "conic-gradient(from 180deg, transparent 0%, rgba(180,83,9,0.1) 30%, transparent 55%, rgba(245,158,11,0.08) 80%, transparent 100%)",
        }}
      />

      {/* Soft glow core */}
      <div
        className="absolute rounded-full animate-pulse"
        style={{
          inset: size * 0.2,
          background: "radial-gradient(circle, rgba(251,191,36,0.2) 0%, rgba(217,119,6,0.08) 50%, transparent 70%)",
          animationDuration: "3s",
        }}
      />

      {/* Floating particles */}
      <div className="absolute w-1.5 h-1.5 rounded-full bg-amber-400/30 animate-pulse" style={{ top: "22%", left: "30%", animationDuration: "2.5s", animationDelay: "0s" }} />
      <div className="absolute w-1 h-1 rounded-full bg-create-primary/25 animate-pulse" style={{ top: "60%", right: "25%", animationDuration: "3s", animationDelay: "1s" }} />
      <div className="absolute w-1 h-1 rounded-full bg-amber-300/20 animate-pulse" style={{ bottom: "28%", left: "25%", animationDuration: "2s", animationDelay: "0.5s" }} />

      {/* Center content */}
      {name ? (
        <span className="relative z-10 font-display font-bold text-create-primary/50" style={{ fontSize: size * 0.35 }}>
          {name.charAt(0).toUpperCase()}
        </span>
      ) : (
        <span className="relative z-10 material-symbols-outlined text-create-primary/30 animate-pulse" style={{ fontSize: size * 0.3, animationDuration: "3s" }}>
          person
        </span>
      )}
    </div>
  );
}

export default function Step2CharacterCreation({
  mode,
  character,
  catalogMode,
  onUpdateCharacter,
  onNext,
  onBack,
}: Step2Props) {
  const isJuntos = mode === "juntos";
  const t = useTranslations("crear.step2");
  const td = useTranslations("data");

  const MAX_INTERESTS = 4;

  const toggleInterest = (id: string) => {
    const current = character.interests;
    if (current.includes(id)) {
      onUpdateCharacter({ interests: current.filter((i) => i !== id) });
    } else if (current.length < MAX_INTERESTS) {
      onUpdateCharacter({ interests: [...current, id] });
    }
  };

  const handleGenderChange = (gender: Gender) => {
    const firstHairstyle = HAIRSTYLES[gender][0].id;
    onUpdateCharacter({ gender, hairstyle: firstHairstyle });
  };

  const hairstyleOptions = HAIRSTYLES[character.gender];

  const greetingText = character.name
    ? t("greeting", { name: character.name })
    : t("greetingDefault");

  const interestLabels = character.interests
    .map((id) => td(`interests.${id}`))
    .filter(Boolean);

  const previewText =
    interestLabels.length > 0
      ? t("previewReady", { interests: interestLabels.join(t("andConnector")).toLowerCase() })
      : t("previewDefault");

  return (
    <div className="flex flex-col h-screen bg-create-bg overflow-hidden">
      <CreationHeader currentStep={catalogMode ? undefined : 2} rightAction="save" />

      <main className="flex-1 flex flex-col lg:flex-row min-h-0 max-w-[1440px] mx-auto w-full">
        {/* Left: Form */}
        <section className="flex-1 flex flex-col w-full lg:w-[68%] px-5 lg:px-8 xl:px-10 py-3 lg:py-4 overflow-y-auto no-scrollbar">
          <div className="mb-3 text-center lg:text-left">
            <h1 className="text-2xl md:text-3xl font-display font-bold text-create-text leading-tight">
              {isJuntos ? t("titleJuntos") : t("title")}
            </h1>
            <p className="text-create-text-sub text-sm font-medium mt-1">
              {t("subtitle")}
            </p>
          </div>

          {/* Mobile preview strip — nebula placeholder */}
          <div className="flex lg:hidden items-center gap-3 bg-white rounded-2xl border border-create-neutral/60 shadow-sm px-4 py-3 mb-1">
            <div className="relative shrink-0">
              <div className="rounded-full p-0.5 bg-gradient-to-br from-create-primary via-amber-400 to-create-primary shadow-md">
                <NebulaPlaceholder size={56} name={character.name} />
              </div>
              {/* Age badge */}
              <div className="absolute -top-1 -right-1 z-10 bg-white rounded-full shadow-md border-2 border-create-primary/20 w-7 h-7 flex flex-col items-center justify-center">
                <span className="text-create-primary font-display text-[11px] leading-none font-bold">
                  {character.age}
                </span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-display font-bold text-create-text truncate">
                {greetingText}
              </p>
              {character.interests.length > 0 ? (
                <div className="flex flex-wrap gap-1 mt-1">
                  {character.interests.slice(0, 4).map((id) => {
                    const interest = INTERESTS.find((i) => i.id === id);
                    if (!interest) return null;
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-create-primary/8 text-create-primary text-[10px] font-bold"
                      >
                        <span className="material-symbols-outlined text-[10px]">
                          {interest.icon}
                        </span>
                        {td(`interests.${interest.id}`)}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <p className="text-create-text-sub text-[10px] font-medium italic mt-0.5">
                  {character.name.trim()
                    ? t("nebulaHintReady", { name: character.name })
                    : t("nebulaHint")}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-4 max-w-3xl mx-auto lg:mx-0 w-full flex-1 justify-evenly">
            {/* Section 1: Identity */}
            <div className="bg-white rounded-2xl border border-create-neutral/60 shadow-sm px-5 py-4 flex flex-col gap-3.5">
              <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-4 items-end">
                <div className="flex flex-col gap-1.5">
                  <label className="text-create-text font-bold text-xs ml-1 uppercase tracking-wide">
                    {t("nameLabel")}
                  </label>
                  <div className="relative group">
                    <input
                      type="text"
                      value={character.name}
                      onChange={(e) => onUpdateCharacter({ name: e.target.value })}
                      placeholder={t("namePlaceholder")}
                      maxLength={50}
                      className="w-full h-11 px-4 rounded-xl border-2 border-create-neutral/40 bg-create-bg/50 group-hover:shadow-sm focus:border-create-primary focus:bg-white focus:ring-0 transition-all outline-none placeholder:text-gray-300 text-sm font-bold text-create-text"
                    />
                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-create-primary transition-colors text-lg">
                      edit
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-create-text font-bold text-xs ml-1 uppercase tracking-wide">
                    {t("cityLabel")}
                  </label>
                  <div className="relative group">
                    <input
                      type="text"
                      value={character.city}
                      onChange={(e) => onUpdateCharacter({ city: e.target.value })}
                      placeholder={t("cityPlaceholder")}
                      maxLength={100}
                      className="w-full h-11 px-4 rounded-xl border-2 border-create-neutral/40 bg-create-bg/50 group-hover:shadow-sm focus:border-create-primary focus:bg-white focus:ring-0 transition-all outline-none placeholder:text-gray-300 text-sm font-bold text-create-text"
                    />
                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-create-primary transition-colors text-lg">
                      location_on
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-create-text font-bold text-xs ml-1 uppercase tracking-wide">
                    {t("ageLabel")}
                  </label>
                  <div className="flex items-center gap-2 h-11 bg-create-bg/50 rounded-xl border-2 border-create-neutral/40 px-3 min-w-[150px]">
                    <input
                      type="range"
                      min={1}
                      max={12}
                      value={character.age}
                      onChange={(e) => onUpdateCharacter({ age: parseInt(e.target.value) })}
                      className="create-slider flex-1"
                    />
                    <span className="text-create-primary font-display text-base font-bold tabular-nums min-w-[52px] text-right">
                      {character.age} {character.age === 1 ? t("year") : t("years")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Optional fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-create-text font-bold text-xs ml-1 uppercase tracking-wide">
                    {character.name ? t("specialTraitLabel", { name: character.name }) : t("specialTraitLabelDefault")}
                    <span className="text-create-text-sub font-medium normal-case tracking-normal ml-1.5">{t("optional")}</span>
                  </label>
                  <div className="relative group">
                    <input
                      type="text"
                      value={character.specialTrait}
                      onChange={(e) => onUpdateCharacter({ specialTrait: e.target.value })}
                      placeholder={t("specialTraitPlaceholder")}
                      maxLength={200}
                      className="w-full h-11 pl-4 pr-10 rounded-xl border-2 border-create-neutral/40 bg-create-bg/50 group-hover:shadow-sm focus:border-create-primary focus:bg-white focus:ring-0 transition-all outline-none placeholder:text-gray-300 text-sm font-medium text-create-text"
                    />
                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-create-primary transition-colors text-lg">
                      auto_awesome
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-create-text font-bold text-xs ml-1 uppercase tracking-wide">
                    {t("companionLabel")}
                    <span className="text-create-text-sub font-medium normal-case tracking-normal ml-1.5">{t("optional")}</span>
                  </label>
                  <div className="relative group">
                    <input
                      type="text"
                      value={character.favoriteCompanion}
                      onChange={(e) => onUpdateCharacter({ favoriteCompanion: e.target.value })}
                      placeholder={t("companionPlaceholder")}
                      maxLength={100}
                      className="w-full h-11 pl-4 pr-10 rounded-xl border-2 border-create-neutral/40 bg-create-bg/50 group-hover:shadow-sm focus:border-create-primary focus:bg-white focus:ring-0 transition-all outline-none placeholder:text-gray-300 text-sm font-medium text-create-text"
                    />
                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-create-primary transition-colors text-lg">
                      favorite
                    </span>
                  </div>
                </div>
              </div>

              {/* Row 3: Favorite food + Future dream */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-create-text font-bold text-xs ml-1 uppercase tracking-wide">
                    {t("favoriteFoodLabel")}
                    <span className="text-create-text-sub font-medium normal-case tracking-normal ml-1.5">{t("optional")}</span>
                  </label>
                  <div className="relative group">
                    <input
                      type="text"
                      value={character.favoriteFood}
                      onChange={(e) => onUpdateCharacter({ favoriteFood: e.target.value })}
                      placeholder={t("favoriteFoodPlaceholder")}
                      maxLength={100}
                      className="w-full h-11 pl-4 pr-10 rounded-xl border-2 border-create-neutral/40 bg-create-bg/50 group-hover:shadow-sm focus:border-create-primary focus:bg-white focus:ring-0 transition-all outline-none placeholder:text-gray-300 text-sm font-medium text-create-text"
                    />
                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-create-primary transition-colors text-lg">
                      restaurant
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-create-text font-bold text-xs ml-1 uppercase tracking-wide">
                    {t("futureDreamLabel")}
                    <span className="text-create-text-sub font-medium normal-case tracking-normal ml-1.5">{t("optional")}</span>
                  </label>
                  <div className="relative group">
                    <input
                      type="text"
                      value={character.futureDream}
                      onChange={(e) => onUpdateCharacter({ futureDream: e.target.value })}
                      placeholder={t("futureDreamPlaceholder")}
                      maxLength={150}
                      className="w-full h-11 pl-4 pr-10 rounded-xl border-2 border-create-neutral/40 bg-create-bg/50 group-hover:shadow-sm focus:border-create-primary focus:bg-white focus:ring-0 transition-all outline-none placeholder:text-gray-300 text-sm font-medium text-create-text"
                    />
                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-create-primary transition-colors text-lg">
                      rocket_launch
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Appearance */}
            <div className="bg-white rounded-2xl border border-create-neutral/60 shadow-sm px-5 py-4 flex flex-col gap-3.5">
              {/* Row 1: Hair + Eye Color */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                <div className="flex flex-col gap-2">
                  <label className="text-create-text font-bold text-xs ml-1 uppercase tracking-wide">
                    {t("hairColorLabel")}
                  </label>
                  <div className="flex gap-2">
                    {HAIR_COLORS.map((h) => {
                      const isSelected = character.hairColor === h.id;
                      return (
                        <button
                          key={h.id}
                          onClick={() => onUpdateCharacter({ hairColor: h.id })}
                          className={`w-9 h-9 rounded-full transition-all ${
                            isSelected
                              ? "ring-[3px] ring-create-primary ring-offset-2 shadow-md scale-110"
                              : "ring-[3px] ring-transparent hover:scale-110"
                          }`}
                          style={{ backgroundColor: h.color }}
                        >
                          {isSelected && (
                            <span
                              className={`material-symbols-outlined font-bold text-sm ${h.id === "blonde" ? "text-gray-800" : "text-white"}`}
                            >
                              check
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-create-text font-bold text-xs ml-1 uppercase tracking-wide">
                    {t("eyeColorLabel")}
                  </label>
                  <div className="flex gap-2">
                    {EYE_COLORS.map((e) => {
                      const isSelected = character.eyeColor === e.id;
                      return (
                        <button
                          key={e.id}
                          onClick={() => onUpdateCharacter({ eyeColor: e.id })}
                          className={`w-9 h-9 rounded-full transition-all ${
                            isSelected
                              ? "ring-[3px] ring-create-primary ring-offset-2 shadow-md scale-110"
                              : "ring-[3px] ring-transparent hover:scale-110"
                          }`}
                          style={{ backgroundColor: e.color }}
                        >
                          {isSelected && (
                            <span
                              className={`material-symbols-outlined font-bold text-sm ${e.id === "hazel" ? "text-gray-800" : "text-white"}`}
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

              {/* Row 2: Skin + Gender */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                <div className="flex flex-col gap-2">
                  <label className="text-create-text font-bold text-xs ml-1 uppercase tracking-wide">
                    {t("skinToneLabel")}
                  </label>
                  <div className="flex gap-2">
                    {SKIN_TONES.map((s) => {
                      const isSelected = character.skinTone === s.id;
                      return (
                        <button
                          key={s.id}
                          onClick={() => onUpdateCharacter({ skinTone: s.id })}
                          className={`w-9 h-9 rounded-full transition-all ${
                            isSelected
                              ? "ring-[3px] ring-create-primary ring-offset-2 shadow-md scale-110"
                              : "ring-[3px] ring-transparent hover:scale-110"
                          }`}
                          style={{ backgroundColor: s.color }}
                        >
                          {isSelected && (
                            <span
                              className={`material-symbols-outlined font-bold text-sm ${s.id === "light" || s.id === "medium-light" ? "text-gray-800" : "text-white"}`}
                            >
                              check
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-create-text font-bold text-xs ml-1 uppercase tracking-wide">
                    {t("genderLabel")}
                  </label>
                  <div className="flex gap-1 bg-create-bg/80 rounded-full p-0.5 w-fit">
                    {(
                      [
                        { id: "boy", icon: "boy" },
                        { id: "girl", icon: "girl" },
                        { id: "neutral", icon: "sentiment_satisfied" },
                      ] as const
                    ).map((g) => (
                      <button
                        key={g.id}
                        onClick={() => handleGenderChange(g.id as Gender)}
                        className={`py-2 px-3.5 rounded-full font-bold flex items-center justify-center gap-1.5 transition-all text-xs ${
                          character.gender === g.id
                            ? "bg-create-primary text-white shadow-md"
                            : "text-create-text-sub hover:bg-white hover:text-create-primary"
                        }`}
                      >
                        <span className="material-symbols-outlined text-lg">
                          {g.icon}
                        </span>
                        {t(g.id)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Row 3: Hairstyle */}
              <div className="flex flex-col gap-2">
                <label className="text-create-text font-bold text-xs ml-1 uppercase tracking-wide">
                  {t("hairstyleLabel")}
                </label>
                <div className="flex flex-wrap gap-2">
                  {hairstyleOptions.map((hs) => {
                    const isSelected = character.hairstyle === hs.id;
                    return (
                      <button
                        key={hs.id}
                        onClick={() => onUpdateCharacter({ hairstyle: hs.id })}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                          isSelected
                            ? "bg-create-primary text-white shadow-md"
                            : "bg-create-bg/80 text-create-text hover:bg-create-primary/10"
                        }`}
                      >
                        <span
                          className={`material-symbols-outlined text-base ${!isSelected ? "text-create-text-sub" : ""}`}
                        >
                          {hs.icon}
                        </span>
                        {td(`hairstyles.${hs.id}`)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Section 3: Interests */}
            <div className="bg-white rounded-2xl border border-create-neutral/60 shadow-sm px-5 py-4 flex flex-col gap-2">
              <div className="flex items-center justify-between ml-1">
                <label className="text-create-text font-bold text-xs uppercase tracking-wide">
                  {t("interestsLabel")}
                </label>
                <span className={`text-xs font-bold tabular-nums ${character.interests.length >= MAX_INTERESTS ? "text-create-primary" : "text-create-text-sub"}`}>
                  {character.interests.length}/{MAX_INTERESTS}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {INTERESTS.map((interest) => {
                  const isSelected = character.interests.includes(interest.id);
                  const isDisabled = !isSelected && character.interests.length >= MAX_INTERESTS;
                  return (
                    <button
                      key={interest.id}
                      onClick={() => toggleInterest(interest.id)}
                      disabled={isDisabled}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                        isSelected
                          ? "bg-create-primary text-white shadow-md"
                          : isDisabled
                          ? "bg-create-bg/40 text-create-text-sub/40 cursor-not-allowed"
                          : "bg-create-bg/80 text-create-text hover:bg-create-primary/10"
                      }`}
                    >
                      <span
                        className={`material-symbols-outlined text-base ${
                          isSelected ? "" : isDisabled ? "text-create-text-sub/40" : "text-create-text-sub"
                        }`}
                      >
                        {interest.icon}
                      </span>
                      {td(`interests.${interest.id}`)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Right: Character Card (desktop only) — nebula mystery placeholder */}
        <section className="hidden lg:flex flex-col items-center justify-center w-[32%] relative">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-[10%] right-[5%] w-48 h-48 rounded-full bg-create-primary/5 blur-3xl" />
            <div className="absolute bottom-[15%] left-[10%] w-36 h-36 rounded-full bg-amber-200/20 blur-3xl" />
          </div>

          <div className="relative z-10 w-[280px] flex flex-col items-center gap-0">
            {/* Nebula placeholder */}
            <div className="relative">
              <div className="rounded-full p-1 bg-gradient-to-br from-create-primary/60 via-amber-400/50 to-create-primary/40 shadow-lg">
                <NebulaPlaceholder size={160} name={character.name} />
              </div>

              {/* Age badge */}
              <div className="absolute -top-1 -right-1 z-10 bg-white rounded-full shadow-lg border-2 border-create-primary/20 w-11 h-11 flex flex-col items-center justify-center">
                <span className="text-create-primary font-display text-sm leading-none">
                  {character.age}
                </span>
                <span className="text-[7px] font-bold text-create-text-sub leading-none mt-0.5">
                  {character.age === 1 ? t("year") : t("years")}
                </span>
              </div>

              {/* Trait dots */}
              <div className="absolute -bottom-1 -left-1 z-10 flex gap-1.5 bg-white rounded-full shadow-lg border border-create-primary/10 px-2.5 py-1.5">
                <div
                  className="w-4 h-4 rounded-full ring-2 ring-white shadow-sm transition-colors duration-300"
                  style={{ backgroundColor: getSkinHex(character.skinTone) }}
                  title={t("skinToneTitle")}
                />
                <div
                  className="w-4 h-4 rounded-full ring-2 ring-white shadow-sm transition-colors duration-300"
                  style={{ backgroundColor: getHairHex(character.hairColor) }}
                  title={t("hairColorTitle")}
                />
                <div
                  className="w-4 h-4 rounded-full ring-2 ring-white shadow-sm transition-colors duration-300"
                  style={{ backgroundColor: getEyeHex(character.eyeColor) }}
                  title={t("eyeColorTitle")}
                />
              </div>
            </div>

            {/* Greeting */}
            <div className="text-center mt-2">
              <h3 className="text-lg font-display text-create-text leading-tight">
                {greetingText}
              </h3>
            </div>

            {/* Hint: communicate that avatar will be created */}
            <p className="text-center text-create-text-sub text-xs font-medium leading-snug max-w-56 mt-1 mb-2">
              {character.name.trim()
                ? t("nebulaHintReady", { name: character.name })
                : t("nebulaHint")}
            </p>

            {/* Info card */}
            <div className="w-full bg-white/70 backdrop-blur-sm rounded-xl border border-create-primary/10 shadow-sm px-3.5 py-3 flex flex-col gap-1.5">
              <div className="flex items-center gap-2 text-sm">
                <span className="material-symbols-outlined text-create-primary text-base">
                  {character.gender === "boy" ? "boy" : character.gender === "girl" ? "girl" : "sentiment_satisfied"}
                </span>
                <span className="font-bold text-create-text">
                  {t(character.gender)}
                </span>
                <span className="text-create-text-sub">·</span>
                <span className="text-create-text-sub font-medium">
                  {td(`hairstyles.${character.hairstyle}`)}
                </span>
              </div>

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
                        <span className="material-symbols-outlined text-xs">
                          {interest.icon}
                        </span>
                        {td(`interests.${interest.id}`)}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <p className="text-create-text-sub text-sm font-medium italic">
                  {t("interestsPrompt")}
                </p>
              )}

              {interestLabels.length > 0 && (
                <p className="text-create-text-sub text-xs leading-relaxed border-t border-create-primary/5 pt-2">
                  {previewText}
                </p>
              )}
            </div>
          </div>
        </section>
      </main>

      <CreationFooterNav onBack={onBack} onNext={onNext} nextDisabled={!character.name.trim()} />
    </div>
  );
}
