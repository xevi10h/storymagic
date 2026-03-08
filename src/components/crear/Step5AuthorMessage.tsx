"use client";

import { useTranslations } from "next-intl";
import type { CreationMode, EndingChoice, StoryTemplateConfig } from "@/lib/create-store";
import CreationHeader from "./CreationHeader";
import CreationFooterNav from "./CreationFooterNav";
import BrandLogo from "@/components/BrandLogo";

interface Step5Props {
  mode: CreationMode;
  dedication: string;
  senderName: string;
  ending: EndingChoice;
  endingNote: string;
  saving: boolean;
  template: StoryTemplateConfig;
  characterName: string;
  characterAge?: number;
  portraitUrl?: string | null;
  onRegeneratePortrait?: () => void;
  onSetDedication: (text: string) => void;
  onSetSenderName: (name: string) => void;
  onSetEnding: (ending: EndingChoice) => void;
  onSetEndingNote: (note: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function Step5AuthorMessage({
  mode,
  dedication,
  senderName,
  ending,
  endingNote,
  saving,
  template,
  characterName,
  characterAge,
  portraitUrl,
  onRegeneratePortrait,
  onSetDedication,
  onSetSenderName,
  onSetEnding,
  onSetEndingNote,
  onNext,
  onBack,
}: Step5Props) {
  const t = useTranslations("crear.step5");
  const isSolo = mode === "solo";
  const td = useTranslations("data");
  const displayName = characterName || t("defaultName");
  const endingOptions = template.endings;
  const tpl = `templates.${template.id}` as const;

  return (
    <div className="min-h-screen flex flex-col bg-create-bg text-create-text">
      <CreationHeader currentStep={5} rightAction="save" portraitUrl={portraitUrl} characterName={characterName} characterAge={characterAge} onRegeneratePortrait={onRegeneratePortrait} />

      {/* Main */}
      <main className="flex-1 flex flex-col relative">
        {/* Star pattern background */}
        <div className="absolute inset-0 bg-create-neutral/30 create-star-pattern opacity-60 pointer-events-none z-0" />

        <div className="relative z-10 w-full max-w-300 mx-auto px-4 py-4 flex flex-col gap-3">

          {/* Content Grid */}
          <div className="grid lg:grid-cols-12 gap-6 items-start">
            {/* Left: Book Back Cover */}
            <div className="lg:col-span-7 flex flex-col items-center">
              <div
                className="relative w-full max-w-115 aspect-3.5/4.5 rounded-r-[20px] rounded-l-[5px] p-6 flex flex-col items-center justify-between transition-transform hover:scale-[1.01] duration-300"
                style={{
                  backgroundColor: template.themeColor,
                  boxShadow:
                    "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04), inset 10px 0 20px rgba(0,0,0,0.05), inset -2px 0 5px rgba(0,0,0,0.1)",
                }}
              >
                {/* Spine hint */}
                <div className="absolute left-0 top-0 bottom-0 w-2.5 bg-linear-to-r from-white/10 to-transparent" />

                {/* Dedication card */}
                <div className="relative w-full bg-[#faf9f6] p-5 rounded-sm shadow-md rotate-1 max-w-95">
                  {/* Tape */}
                  <div className="create-tape-effect absolute -top-3 left-1/2 -translate-x-1/2 w-32 h-8 z-10" />
                  <label
                    className="block text-center text-create-primary font-bold text-sm mb-3 uppercase tracking-wider"
                    htmlFor="dedication"
                  >
                    {isSolo ? t("dedicationLabelSolo") : t("dedicationLabel")}
                  </label>
                  <textarea
                    id="dedication"
                    value={dedication}
                    onChange={(e) => onSetDedication(e.target.value)}
                    placeholder={t(isSolo ? "dedicationPlaceholderSolo" : "dedicationPlaceholder", { name: displayName })}
                    rows={4}
                    maxLength={500}
                    className="w-full border-none bg-transparent p-0 text-center text-lg text-gray-700 focus:ring-0 resize-none leading-relaxed placeholder:text-gray-400 placeholder:italic"
                  />
                  <div className="mt-3">
                    <input
                      type="text"
                      value={senderName}
                      onChange={(e) => onSetSenderName(e.target.value)}
                      placeholder={t("senderPlaceholder")}
                      maxLength={100}
                      className="w-full border-none bg-transparent p-0 text-center text-sm text-gray-500 focus:ring-0 placeholder:text-gray-300 placeholder:italic"
                    />
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between items-center text-xs text-gray-400 font-medium">
                    <span>Meapica</span>
                    <span>{new Date().getFullYear()} Edition</span>
                  </div>
                </div>

                {/* Bottom branding — dynamic title */}
                <div className="mt-4 text-center">
                  <h3 className="text-white/90 font-bold text-xl tracking-wide uppercase">
                    {td(`${tpl}.title`)}
                  </h3>
                  <p className="text-white/60 text-sm mt-1 font-medium">
                    {t("adventureOf", { name: displayName })}
                  </p>
                  <div className="mt-4 bg-white/10 px-4 py-2 rounded-sm inline-block">
                    <BrandLogo className="h-5 text-white/80" />
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Controls */}
            <div className="lg:col-span-5 flex flex-col gap-4 pt-2">
              <div className="text-center lg:text-left">
                <h1 className="text-2xl md:text-3xl font-display font-bold text-create-text leading-tight mb-1">
                  {isSolo ? t("titleSolo") : t("title")}
                </h1>
                <p className="text-create-text-sub text-base font-medium leading-relaxed">
                  {t.rich(isSolo ? "subtitleSolo" : "subtitle", {
                    name: displayName,
                    highlight: (chunks) => (
                      <span className="text-create-primary font-bold">{chunks}</span>
                    ),
                  })}
                </p>
              </div>

              {/* Ending options — dynamic per template */}
              <div className="flex flex-col gap-3">
                {endingOptions.map((option) => {
                  const isSelected = ending === option.id;
                  const description = td(`${tpl}.endings.${option.id}.description`, { name: displayName });
                  const title = td(`${tpl}.endings.${option.id}.title`, { name: displayName });

                  return (
                    <label
                      key={option.id}
                      className={`group relative flex items-center gap-4 p-4 rounded-xl border-2 bg-white shadow-sm hover:shadow-md cursor-pointer transition-all ${
                        isSelected
                          ? "border-create-primary bg-create-primary/5"
                          : "border-transparent hover:border-create-primary/30"
                      }`}
                    >
                      <input
                        type="radio"
                        name="ending"
                        value={option.id}
                        checked={isSelected}
                        onChange={() => onSetEnding(option.id)}
                        className="peer sr-only"
                      />
                      <div
                        className={`size-12 rounded-full ${option.iconBg} flex items-center justify-center ${option.iconColor} shrink-0 group-hover:scale-110 transition-transform`}
                      >
                        <span className="material-symbols-outlined text-2xl">
                          {option.icon}
                        </span>
                      </div>
                      <div className="flex-1">
                        <h3
                          className={`text-base font-bold ${isSelected ? "text-create-primary" : "text-create-text"}`}
                        >
                          {title}
                        </h3>
                        <p className="text-sm text-create-text-sub leading-snug">
                          {description}
                        </p>
                      </div>
                      <div
                        className={`size-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                          isSelected
                            ? "border-create-primary bg-create-primary"
                            : "border-gray-300"
                        }`}
                      >
                        {isSelected && (
                          <span className="material-symbols-outlined text-white text-sm">
                            check
                          </span>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>

              {/* Optional ending note — appears once an ending is selected */}
              {ending && (
                <div className="flex flex-col gap-1.5 mt-1">
                  <label className="text-sm font-bold text-create-text opacity-80">
                    {t("endingNoteLabel")}
                    <span className="text-create-text-sub font-normal ml-2 normal-case tracking-normal">
                      {t("endingNoteOptional")}
                    </span>
                  </label>
                  <textarea
                    value={endingNote}
                    onChange={(e) => onSetEndingNote(e.target.value)}
                    placeholder={t("endingNotePlaceholder", { name: displayName })}
                    rows={2}
                    maxLength={300}
                    className="w-full px-4 py-3 rounded-xl border-2 border-create-neutral bg-white focus:border-create-primary focus:ring-0 transition-all outline-none placeholder:text-gray-300 text-sm font-medium text-create-text resize-none"
                  />
                  <p className="text-xs text-create-text-sub">{t("endingNoteHint")}</p>
                </div>
              )}

            </div>
          </div>
        </div>
      </main>

      <CreationFooterNav
        onBack={onBack}
        onNext={onNext}
        nextLabel={t("createMyStory")}
        nextLoading={saving}
        nextDisabled={!ending}
        nextDisabledTooltip={!ending ? t("chooseEndingFirst") : undefined}
      />
    </div>
  );
}
