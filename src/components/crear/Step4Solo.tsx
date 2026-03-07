"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { StoryDecisions, StoryTemplateConfig } from "@/lib/create-store";
import CreationHeader from "./CreationHeader";
import CreationFooterNav from "./CreationFooterNav";

interface Step4SoloProps {
  decisions: StoryDecisions;
  characterName: string;
  template: StoryTemplateConfig;
  onUpdateDecisions: (updates: Partial<StoryDecisions>) => void;
  onNext: () => void;
  onBack: () => void;
}

type TabId = "companion" | "atmosphere" | "twist";

export default function Step4Solo({
  decisions,
  characterName,
  template,
  onUpdateDecisions,
  onNext,
  onBack,
}: Step4SoloProps) {
  const t = useTranslations("crear.step4.solo");
  const tStep2 = useTranslations("crear.step2");
  const [activeTab, setActiveTab] = useState<TabId>("companion");
  const displayName = characterName || t("defaultName");

  const companionDecision = template.decisions.find((d) => d.key === "companion");
  const challengeDecision = template.decisions.find((d) => d.key === "challenge");

  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: "companion", label: t("companionTab"), icon: "group" },
    { id: "atmosphere", label: t("atmosphereTab"), icon: "landscape" },
    { id: "twist", label: t("twistTab"), icon: "alt_route" },
  ];

  // Get selected labels for the preview
  const selectedCompanion = companionDecision?.options.find(
    (o) => o.id === decisions.companion
  );
  const selectedTime = template.atmosphere.timeOptions.find(
    (t) => t.id === decisions.timeOfDay
  );
  const selectedSetting = template.atmosphere.settingOptions.find(
    (s) => s.id === decisions.setting
  );
  const selectedChallenge = challengeDecision?.options.find(
    (o) => o.id === decisions.challenge
  );

  return (
    <div className="min-h-screen flex flex-col bg-create-bg text-create-text">
      <CreationHeader currentStep={4} rightAction="save" />

      {/* Main */}
      <main className="grow flex flex-col items-center w-full px-4 sm:px-6 py-3 lg:py-4">
        <div className="w-full max-w-[1024px] flex flex-col gap-3">
          {/* Title */}
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl md:text-3xl font-display font-bold text-center text-create-text">
              {t("title")}
            </h1>
            <p className="text-create-text-sub text-center max-w-lg mx-auto font-medium">
              {t.rich("subtitle", {
                name: displayName,
                highlight: (chunks) => (
                  <span className="text-create-primary font-bold">{chunks}</span>
                ),
              })}
            </p>
          </div>

          {/* Book preview */}
          <div className="relative w-full mt-2 mb-2">
            <div className="relative w-full aspect-[4/3] md:aspect-5/2 bg-white rounded-xl md:rounded-3xl create-book-shadow border border-create-neutral flex overflow-hidden">
              {/* Left page - text */}
              <div className="hidden md:flex flex-1 p-8 md:p-12 flex-col justify-center items-start bg-[#fdfbf9] relative">
                <div className="absolute right-0 top-0 bottom-0 w-12 bg-linear-to-l from-black/5 to-transparent z-10 pointer-events-none" />
                <div className="font-serif italic text-create-text-secondary/60 mb-4">
                  {t("chapter")}
                </div>
                <h3 className="text-2xl font-bold text-create-text mb-6">
                  {template.previewChapterTitle}
                </h3>
                <div className="space-y-4 text-create-text-secondary leading-relaxed font-serif text-lg">
                  <p>
                    {t("storyStart")}{" "}
                    <span className="bg-create-primary/10 text-create-primary px-1 rounded font-bold">
                      {displayName}
                    </span>{" "}
                    {t("storyLived")}
                  </p>
                  <p>
                    {selectedTime && (
                      <>
                        {t("skyShowed")}{" "}
                        <span className="bg-create-primary/10 text-create-primary px-1 rounded font-bold">
                          {selectedTime.label.toLowerCase()}
                        </span>
                      </>
                    )}
                    {selectedCompanion && (
                      <>
                        {selectedTime ? ". N" : " N"}{t("notAlone")}{" "}
                        <span className="bg-create-primary/10 text-create-primary px-1 rounded font-bold">
                          {selectedCompanion.title}
                        </span>{" "}
                        {t("followedClose")}
                      </>
                    )}
                    {!selectedTime && !selectedCompanion && (
                      <>{t("unknownAfternoon")}</>
                    )}
                  </p>
                  {selectedChallenge && (
                    <p className="opacity-50">
                      {t("wouldFace")}{" "}
                      <span className="italic">
                        {selectedChallenge.title.toLowerCase()}...
                      </span>
                    </p>
                  )}
                </div>
                <div className="mt-auto text-xs text-create-text-secondary/40 text-center w-full">
                  {t("page")} 4
                </div>
              </div>

              {/* Right page - illustration placeholder */}
              <div className="flex-1 relative bg-neutral-100 overflow-hidden group">
                <div className="hidden md:block absolute left-0 top-0 bottom-0 w-4 bg-linear-to-r from-black/5 to-transparent z-10 pointer-events-none" />
                <img
                  alt={template.previewChapterTitle}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  src={template.image}
                />
                <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-6 left-6 right-6 flex justify-between items-end">
                  {selectedSetting && (
                    <div className="bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm">
                      <span className="text-create-primary">{t("settingLabel")}</span>{" "}
                      {selectedSetting.label}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Configuration panel */}
          <div className="bg-white rounded-2xl border border-create-neutral shadow-sm p-2 md:p-3">
            {/* Tabs */}
            <div className="flex border-b border-create-neutral mb-4 px-2 overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 pb-3 pt-2 px-6 border-b-[3px] transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? "border-create-primary text-create-primary"
                      : "border-transparent text-create-text-secondary hover:text-create-primary"
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {tab.icon}
                  </span>
                  <span className="font-bold text-sm tracking-wide">
                    {tab.label}
                  </span>
                  {/* Filled indicator */}
                  {tab.id === "companion" && decisions.companion && (
                    <span className="w-2 h-2 rounded-full bg-create-primary" />
                  )}
                  {tab.id === "atmosphere" && (decisions.timeOfDay || decisions.setting) && (
                    <span className="w-2 h-2 rounded-full bg-create-primary" />
                  )}
                  {tab.id === "twist" && decisions.challenge && (
                    <span className="w-2 h-2 rounded-full bg-create-primary" />
                  )}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="px-2 md:px-4 pb-3">
              {/* ── Companion Tab ────────────────────────── */}
              {activeTab === "companion" && companionDecision && (
                <div className="flex flex-col gap-3">
                  <label className="text-sm font-bold text-create-text uppercase tracking-wider opacity-80">
                    {companionDecision.question.replace("{name}", displayName)}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {companionDecision.options.map((option) => {
                      const isActive = decisions.companion === option.id;
                      return (
                        <button
                          key={option.id}
                          onClick={() =>
                            onUpdateDecisions({ companion: option.id })
                          }
                          className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all text-center ${
                            isActive
                              ? "border-create-primary bg-create-primary/5 shadow-md"
                              : "border-create-neutral bg-white hover:border-create-primary/40 hover:shadow-sm"
                          }`}
                        >
                          <div
                            className={`w-12 h-12 rounded-full flex items-center justify-center bg-linear-to-br ${template.themeGradient} text-white`}
                          >
                            <span className="material-symbols-outlined text-2xl">
                              {option.icon}
                            </span>
                          </div>
                          <div>
                            <h4 className={`font-bold text-sm ${isActive ? "text-create-primary" : "text-create-text"}`}>
                              {option.title}
                            </h4>
                            <p className="text-xs text-create-text-sub mt-0.5">
                              {option.subtitle}
                            </p>
                          </div>
                          {isActive && (
                            <span className="material-symbols-outlined text-create-primary text-lg">
                              check_circle
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Atmosphere Tab ───────────────────────── */}
              {activeTab === "atmosphere" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Time of Day */}
                  <div className="flex flex-col gap-3">
                    <label className="text-sm font-bold text-create-text uppercase tracking-wider opacity-80">
                      {t("timeOfDay")}
                    </label>
                    <div className="flex flex-wrap gap-3">
                      {template.atmosphere.timeOptions.map((time) => {
                        const isActive = decisions.timeOfDay === time.id;
                        return (
                          <button
                            key={time.id}
                            onClick={() =>
                              onUpdateDecisions({ timeOfDay: time.id })
                            }
                            className={`group flex items-center gap-2 px-4 py-2 rounded-full border transition-all ${
                              isActive
                                ? "border-create-primary bg-create-primary text-white shadow-md shadow-create-primary/20 scale-105"
                                : "border-create-neutral bg-create-neutral/30 hover:bg-create-primary/10 hover:border-create-primary/30"
                            }`}
                          >
                            <span
                              className={`material-symbols-outlined transition-transform group-hover:scale-110 ${isActive ? "text-white" : time.iconColor}`}
                            >
                              {time.icon}
                            </span>
                            <span
                              className={`text-sm ${isActive ? "font-bold" : "font-medium text-create-text"}`}
                            >
                              {time.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Setting */}
                  <div className="flex flex-col gap-3">
                    <label className="text-sm font-bold text-create-text uppercase tracking-wider opacity-80">
                      {t("setting")}
                    </label>
                    <div className="grid grid-cols-1 gap-3">
                      {template.atmosphere.settingOptions.map((s) => {
                        const isActive = decisions.setting === s.id;
                        return (
                          <button
                            key={s.id}
                            onClick={() =>
                              onUpdateDecisions({ setting: s.id })
                            }
                            className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                              isActive
                                ? "border-create-primary bg-create-primary/5"
                                : "border-create-neutral bg-white hover:border-create-primary/50"
                            }`}
                          >
                            <div
                              className={`${s.bgColor} p-2 rounded-lg ${s.iconColor}`}
                            >
                              <span className="material-symbols-outlined text-xl block">
                                {s.icon}
                              </span>
                            </div>
                            <span className="text-sm font-medium">
                              {s.label}
                            </span>
                            {isActive && (
                              <span className="material-symbols-outlined text-lg text-create-primary ml-auto">
                                check_circle
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Twist Tab ────────────────────────────── */}
              {activeTab === "twist" && challengeDecision && (
                <div className="flex flex-col gap-3">
                  <label className="text-sm font-bold text-create-text uppercase tracking-wider opacity-80">
                    {challengeDecision.question.replace("{name}", displayName)}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {challengeDecision.options.map((option) => {
                      const isActive = decisions.challenge === option.id;
                      return (
                        <button
                          key={option.id}
                          onClick={() =>
                            onUpdateDecisions({ challenge: option.id })
                          }
                          className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all text-center ${
                            isActive
                              ? "border-create-primary bg-create-primary/5 shadow-md"
                              : "border-create-neutral bg-white hover:border-create-primary/40 hover:shadow-sm"
                          }`}
                        >
                          <div className="w-12 h-12 rounded-full flex items-center justify-center bg-linear-to-br from-rose-700 to-red-500 text-white">
                            <span className="material-symbols-outlined text-2xl">
                              {option.icon}
                            </span>
                          </div>
                          <div>
                            <h4 className={`font-bold text-sm ${isActive ? "text-create-primary" : "text-create-text"}`}>
                              {option.title}
                            </h4>
                            <p className="text-xs text-create-text-sub mt-0.5">
                              {option.subtitle}
                            </p>
                          </div>
                          {isActive && (
                            <span className="material-symbols-outlined text-create-primary text-lg">
                              check_circle
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Special moment — open text field */}
                  <div className="mt-2 flex flex-col gap-1.5">
                    <label className="text-sm font-bold text-create-text opacity-80">
                      {t("specialMomentLabel")}
                      <span className="text-create-text-sub font-medium ml-2">{tStep2("optional")}</span>
                    </label>
                    <textarea
                      value={decisions.specialMoment || ""}
                      onChange={(e) =>
                        onUpdateDecisions({ specialMoment: e.target.value })
                      }
                      placeholder={t("specialMomentPlaceholder")}
                      rows={2}
                      maxLength={300}
                      className="w-full px-4 py-3 rounded-xl border-2 border-create-neutral bg-white focus:border-create-primary focus:ring-0 transition-all outline-none placeholder:text-gray-300 text-sm font-medium text-create-text resize-none"
                    />
                    <p className="text-xs text-create-text-sub">
                      {t("specialMomentHint")}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <CreationFooterNav
        onBack={onBack}
        onNext={onNext}
        nextDisabled={!decisions.companion}
      />
    </div>
  );
}
