"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { getRecommendedTemplates, getAllTemplateTags, type CreationMode, type StoryTag } from "@/lib/create-store";
import CreationHeader from "./CreationHeader";
import CreationFooterNav from "./CreationFooterNav";

interface Step3Props {
  mode: CreationMode;
  selectedTemplate: string | null;
  characterName: string;
  characterAge: number;
  characterInterests: string[];
  portraitUrl?: string | null;
  onRegeneratePortrait?: () => void;
  onSelectTemplate: (id: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function Step3AdventureSelection({
  mode,
  selectedTemplate,
  characterName,
  characterAge,
  characterInterests,
  portraitUrl,
  onRegeneratePortrait,
  onSelectTemplate,
  onNext,
  onBack,
}: Step3Props) {
  const isJuntos = mode === "juntos";
  const t = useTranslations("crear.step3");
  const td = useTranslations("data");
  const displayName = characterName || t("defaultName");
  const sortedTemplates = getRecommendedTemplates(characterAge, characterInterests);

  // ── Tag filter state ──────────────────────────────────────
  const [activeTag, setActiveTag] = useState<StoryTag | null>(null);
  const allTags = useMemo(() => getAllTemplateTags(), []);

  const filteredTemplates = useMemo(() => {
    if (!activeTag) return sortedTemplates;
    return sortedTemplates.filter((t) => t.tags.includes(activeTag));
  }, [sortedTemplates, activeTag]);

  return (
    <div className="flex flex-col min-h-screen w-full bg-create-bg">
      <CreationHeader currentStep={3} rightAction="save" portraitUrl={portraitUrl} characterName={characterName} characterAge={characterAge} onRegeneratePortrait={onRegeneratePortrait} />

      {/* Main */}
      <main className="flex-1 px-4 md:px-10 py-4 flex justify-center w-full">
        <div className="w-full max-w-6xl flex flex-col gap-4">

          {/* Title */}
          <div className="text-center space-y-2 max-w-2xl mx-auto">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-display font-bold text-create-text leading-tight">
              {t(isJuntos ? "titleJuntos" : "title", { name: displayName })}
            </h1>
            <p className="text-base text-create-text-sub font-medium">
              {t(isJuntos ? "subtitleJuntos" : "subtitle")}
            </p>
          </div>

          {/* Tag filter bar */}
          <div className="flex flex-wrap justify-center gap-2 px-2">
            <button
              onClick={() => setActiveTag(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
                activeTag === null
                  ? "bg-create-primary text-white shadow-sm"
                  : "bg-white/70 text-create-text-body hover:bg-white hover:text-create-primary border border-create-primary/10"
              }`}
            >
              {t("filterAll")}
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
                  activeTag === tag
                    ? "bg-create-primary text-white shadow-sm"
                    : "bg-white/70 text-create-text-body hover:bg-white hover:text-create-primary border border-create-primary/10"
                }`}
              >
                {td(`tags.${tag}`)}
              </button>
            ))}
          </div>

          {/* Adventure grid — vertical on mobile, horizontal scroll on desktop */}
          <div className="relative md:-mx-10 md:px-10">
            {/* Mobile: vertical list */}
            <div className="flex flex-col gap-3 md:hidden">
              {filteredTemplates.map((template) => {
                const isSelected = selectedTemplate === template.id;
                return (
                  <div
                    key={template.id}
                    onClick={() => onSelectTemplate(template.id)}
                    className={`group relative flex flex-row rounded-xl overflow-hidden cursor-pointer transition-all duration-300 ${
                      isSelected
                        ? "shadow-xl border-3 border-create-primary ring-4 ring-create-primary/20"
                        : "create-card-shadow border-2 border-transparent hover:border-create-primary/30 bg-white"
                    }`}
                  >
                    {/* Image */}
                    <div className="w-28 shrink-0 relative overflow-hidden bg-slate-100">
                      <img
                        alt={td(`templates.${template.id}.title`)}
                        className="w-full h-full object-cover"
                        src={template.image}
                      />
                      {/* Selection checkmark */}
                      {isSelected && (
                        <div className="absolute top-2 left-2 z-10 bg-create-primary text-white size-6 rounded-full flex items-center justify-center shadow-lg">
                          <span className="material-symbols-outlined text-base font-bold">check</span>
                        </div>
                      )}
                      {/* Recommended badge */}
                      {template.isRecommended && !isSelected && (
                        <div className="absolute top-2 left-2 z-10 bg-create-primary text-white size-6 rounded-full flex items-center justify-center shadow-lg">
                          <span className="material-symbols-outlined text-sm">thumb_up</span>
                        </div>
                      )}
                    </div>

                    {/* Text */}
                    <div className={`p-3 flex flex-col justify-center gap-1 flex-1 min-w-0 ${isSelected ? "bg-create-primary/5" : ""}`}>
                      <div className="flex items-center gap-2">
                        <h3 className={`text-sm font-bold leading-tight ${isSelected ? "text-create-primary" : "text-create-text"}`}>
                          {td(`templates.${template.id}.title`)}
                        </h3>
                        <span className="text-[10px] font-bold text-create-primary bg-create-primary/10 px-1.5 py-0.5 rounded-full shrink-0">
                          {td(`templates.${template.id}.ageRange`)}
                        </span>
                      </div>
                      <p className="text-xs text-create-text-body line-clamp-2">
                        {td(`templates.${template.id}.description`)}
                      </p>
                      {/* Tags */}
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {template.tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-[9px] font-medium text-create-text-sub bg-create-primary/5 px-1.5 py-0.5 rounded-full"
                          >
                            {td(`tags.${tag}`)}
                          </span>
                        ))}
                      </div>
                      {template.isRecommended && !isSelected && (
                        <span className="text-[10px] font-bold text-create-primary">
                          {t("recommendedFor", { name: displayName })}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop: horizontal scroll */}
            <div
              className="hidden md:flex gap-4 overflow-x-auto pt-4 pb-4 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-create-primary/20 scrollbar-track-transparent"
              style={{ scrollbarWidth: "thin" }}
            >
              {filteredTemplates.map((template) => {
                const isSelected = selectedTemplate === template.id;
                return (
                  <div
                    key={template.id}
                    onClick={() => onSelectTemplate(template.id)}
                    className={`group relative flex flex-col rounded-xl overflow-hidden cursor-pointer transition-all duration-300 snap-start shrink-0 w-55 lg:w-50 ${
                      isSelected
                        ? "-translate-y-2 shadow-xl border-4 border-create-primary ring-4 ring-create-primary/20"
                        : "hover:-translate-y-2 create-card-shadow hover:shadow-xl border-2 border-transparent hover:border-create-primary/30 bg-white"
                    }`}
                  >
                    {/* Recommended badge */}
                    {template.isRecommended && !isSelected && (
                      <div className="absolute top-3 left-3 z-10 bg-create-primary text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-lg flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">thumb_up</span>
                        {t("recommendedFor", { name: displayName })}
                      </div>
                    )}

                    {/* Selection checkmark */}
                    {isSelected && (
                      <div className="absolute top-3 left-3 z-10 bg-create-primary text-white size-8 rounded-full flex items-center justify-center shadow-lg animate-bounce">
                        <span className="material-symbols-outlined text-xl font-bold">check</span>
                      </div>
                    )}

                    {/* Image */}
                    <div className="aspect-4/5 w-full relative overflow-hidden bg-slate-100">
                      <img
                        alt={td(`templates.${template.id}.title`)}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        src={template.image}
                      />
                      <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent" />
                      <div className="absolute top-3 right-3 bg-white/90 backdrop-blur text-create-primary text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                        {td(`templates.${template.id}.ageRange`)}
                      </div>
                    </div>

                    {/* Text */}
                    <div className={`p-3 flex flex-col gap-1.5 flex-1 ${isSelected ? "bg-create-primary/5" : ""}`}>
                      <h3 className={`text-base font-bold leading-tight ${isSelected ? "text-create-primary" : "text-create-text"}`}>
                        {td(`templates.${template.id}.title`)}
                      </h3>
                      <p className="text-xs text-create-text-body line-clamp-2">
                        {td(`templates.${template.id}.description`)}
                      </p>
                      {/* Tags */}
                      <div className="flex flex-wrap gap-1 mt-auto pt-1">
                        {template.tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-[10px] font-medium text-create-text-sub bg-create-primary/5 px-2 py-0.5 rounded-full"
                          >
                            {td(`tags.${tag}`)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </main>

      <CreationFooterNav onBack={onBack} onNext={onNext} nextDisabled={!selectedTemplate} />
    </div>
  );
}
