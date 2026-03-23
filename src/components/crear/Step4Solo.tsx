"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { StoryDecisions, StoryTemplateConfig } from "@/lib/create-store";
import CreationHeader from "./CreationHeader";
import CreationFooterNav from "./CreationFooterNav";

interface Step4SoloProps {
  decisions: StoryDecisions;
  characterName: string;
  characterAge?: number;
  template: StoryTemplateConfig;
  portraitUrl?: string | null;
  onRegeneratePortrait?: () => void;
  onUpdateDecisions: (updates: Partial<StoryDecisions>) => void;
  onNext: () => void;
  onBack: () => void;
}

type TabId = "companion" | "atmosphere" | "twist";

export default function Step4Solo({
  decisions,
  characterName,
  characterAge,
  template,
  portraitUrl,
  onRegeneratePortrait,
  onUpdateDecisions,
  onNext,
  onBack,
}: Step4SoloProps) {
  const t = useTranslations("crear.step4.solo");
  const td = useTranslations("data");
  const tStep2 = useTranslations("crear.step2");
  const [activeTab, setActiveTab] = useState<TabId>("companion");
  const displayName = characterName || t("defaultName");
  const tpl = `templates.${template.id}` as const;

  const companionDecision = template.decisions.find((d) => d.key === "companion");
  const challengeDecision = template.decisions.find((d) => d.key === "challenge");

  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: "companion", label: t("companionTab"), icon: "group" },
    { id: "atmosphere", label: t("atmosphereTab"), icon: "landscape" },
    { id: "twist", label: t("twistTab"), icon: "alt_route" },
  ];

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

  const atmosphereValue = [
    selectedTime && td(`${tpl}.atmosphere.time.${selectedTime.id}`),
    selectedSetting && td(`${tpl}.atmosphere.setting.${selectedSetting.id}`),
  ]
    .filter(Boolean)
    .join(" · ");

  const allComplete =
    !!decisions.companion &&
    !!decisions.timeOfDay &&
    !!decisions.setting &&
    !!decisions.challenge;

  const missingLabels = [
    !decisions.companion && t("companionTab"),
    (!decisions.timeOfDay || !decisions.setting) && t("atmosphereTab"),
    !decisions.challenge && t("twistTab"),
  ].filter(Boolean) as string[];

  const nextTooltip = !allComplete
    ? `${t("nextTooltipPrefix")}: ${missingLabels.join(", ")}`
    : undefined;

  return (
    <div className="min-h-screen flex flex-col bg-create-bg text-create-text">
      <CreationHeader currentStep={4} rightAction="save" portraitUrl={portraitUrl} characterName={characterName} characterAge={characterAge} onRegeneratePortrait={onRegeneratePortrait} />

      <main className="grow flex flex-col items-center w-full px-4 sm:px-6 py-3 lg:py-4">
        <div className="w-full max-w-[1100px] flex flex-col gap-3">

          {/* Compact title */}
          <div className="text-center">
            <h1 className="text-xl md:text-2xl font-display font-bold text-create-text">
              {t("title")}
            </h1>
            <p className="text-create-text-sub text-sm max-w-lg mx-auto font-medium mt-1">
              {t.rich("subtitle", {
                name: displayName,
                highlight: (chunks) => (
                  <span className="text-create-primary font-bold">{chunks}</span>
                ),
              })}
            </p>
          </div>

          {/* Two-column body */}
          <div className="flex flex-col lg:flex-row gap-4 items-start">

            {/* LEFT: Story preview + decisions summary (desktop only) */}
            <div className="hidden lg:flex w-[272px] shrink-0 flex-col gap-3">

              {/* Template image card */}
              <div className="relative rounded-2xl overflow-hidden shadow-md h-44">
                <img
                  src={template.image}
                  alt={td(`${tpl}.title`)}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest">
                    {t("storyPreview")}
                  </p>
                  <p className="text-white font-display font-bold text-sm leading-tight">
                    {td(`${tpl}.title`)}
                  </p>
                </div>
              </div>

              {/* Decisions summary */}
              <div className="bg-white rounded-xl border border-create-neutral p-4 flex flex-col gap-2.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-create-text-sub">
                  {t("yourStory")}
                </p>

                {/* Companion row */}
                <button
                  onClick={() => setActiveTab("companion")}
                  className={`flex items-start gap-2.5 text-left rounded-lg p-1.5 -mx-1.5 transition-colors ${activeTab === "companion" ? "bg-create-primary/5" : "hover:bg-create-neutral/50"}`}
                >
                  <span
                    className={`material-symbols-outlined text-[18px] mt-0.5 shrink-0 ${selectedCompanion ? "text-create-primary" : "text-create-text-sub/40"}`}
                  >
                    group
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-create-text-sub/60">
                      {t("companionTab")}
                    </p>
                    <p className={`text-xs font-medium truncate ${selectedCompanion ? "text-create-text" : "text-create-text-sub/50 italic"}`}>
                      {selectedCompanion
                        ? td(`${tpl}.decisions.companion.${selectedCompanion.id}.title`)
                        : t("notChosen")}
                    </p>
                  </div>
                </button>

                {/* Atmosphere row */}
                <button
                  onClick={() => setActiveTab("atmosphere")}
                  className={`flex items-start gap-2.5 text-left rounded-lg p-1.5 -mx-1.5 transition-colors ${activeTab === "atmosphere" ? "bg-create-primary/5" : "hover:bg-create-neutral/50"}`}
                >
                  <span
                    className={`material-symbols-outlined text-[18px] mt-0.5 shrink-0 ${atmosphereValue ? "text-create-primary" : "text-create-text-sub/40"}`}
                  >
                    landscape
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-create-text-sub/60">
                      {t("atmosphereTab")}
                    </p>
                    <p className={`text-xs font-medium truncate ${atmosphereValue ? "text-create-text" : "text-create-text-sub/50 italic"}`}>
                      {atmosphereValue || t("notChosen")}
                    </p>
                  </div>
                </button>

                {/* Twist row */}
                <button
                  onClick={() => setActiveTab("twist")}
                  className={`flex items-start gap-2.5 text-left rounded-lg p-1.5 -mx-1.5 transition-colors ${activeTab === "twist" ? "bg-create-primary/5" : "hover:bg-create-neutral/50"}`}
                >
                  <span
                    className={`material-symbols-outlined text-[18px] mt-0.5 shrink-0 ${selectedChallenge ? "text-create-primary" : "text-create-text-sub/40"}`}
                  >
                    alt_route
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-create-text-sub/60">
                      {t("twistTab")}
                    </p>
                    <p className={`text-xs font-medium truncate ${selectedChallenge ? "text-create-text" : "text-create-text-sub/50 italic"}`}>
                      {selectedChallenge
                        ? td(`${tpl}.decisions.challenge.${selectedChallenge.id}.title`)
                        : t("notChosen")}
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* RIGHT: Configuration panel */}
            <div className="flex-1 min-w-0 bg-white rounded-2xl border border-create-neutral shadow-sm flex flex-col">

              {/* Tabs */}
              <div className="flex border-b border-create-neutral px-1 sm:px-3 shrink-0">
                {tabs.map((tab) => {
                  const isFilled =
                    (tab.id === "companion" && !!decisions.companion) ||
                    (tab.id === "atmosphere" && !!(decisions.timeOfDay || decisions.setting)) ||
                    (tab.id === "twist" && !!decisions.challenge);
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center justify-center gap-1.5 sm:gap-2 pb-3 pt-3 px-3 sm:px-5 flex-1 sm:flex-initial border-b-[3px] transition-colors whitespace-nowrap ${
                        activeTab === tab.id
                          ? "border-create-primary text-create-primary"
                          : "border-transparent text-create-text-secondary hover:text-create-primary"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[20px]">{tab.icon}</span>
                      <span className="font-bold text-xs sm:text-sm tracking-wide">{tab.label}</span>
                      {isFilled && (
                        <span className="w-1.5 h-1.5 rounded-full bg-create-primary shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Mobile decisions summary (visible only on mobile when at least one choice is made) */}
              {(decisions.companion || atmosphereValue || decisions.challenge) && (
                <div className="flex flex-wrap gap-2 px-4 pt-3 lg:hidden">
                  {selectedCompanion && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-create-primary/10 px-2.5 py-1 text-xs font-medium text-create-primary">
                      <span className="material-symbols-outlined text-[14px]">group</span>
                      {td(`${tpl}.decisions.companion.${selectedCompanion.id}.title`)}
                    </span>
                  )}
                  {atmosphereValue && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-create-primary/10 px-2.5 py-1 text-xs font-medium text-create-primary">
                      <span className="material-symbols-outlined text-[14px]">landscape</span>
                      {atmosphereValue}
                    </span>
                  )}
                  {selectedChallenge && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-create-primary/10 px-2.5 py-1 text-xs font-medium text-create-primary">
                      <span className="material-symbols-outlined text-[14px]">alt_route</span>
                      {td(`${tpl}.decisions.challenge.${selectedChallenge.id}.title`)}
                    </span>
                  )}
                </div>
              )}

              {/* Tab content */}
              <div className="px-4 pt-3 pb-4 flex flex-col gap-3">

                {/* Context description */}
                <p className="text-sm text-create-text-sub leading-snug">
                  {activeTab === "companion" && t("companionContext", { name: displayName })}
                  {activeTab === "atmosphere" && t("atmosphereContext")}
                  {activeTab === "twist" && t("twistContext", { name: displayName })}
                </p>

                {/* ── Companion Tab ─── */}
                {activeTab === "companion" && companionDecision && (
                  <div className="flex flex-col gap-3">
                    <label className="text-sm font-bold text-create-text uppercase tracking-wider opacity-80">
                      {td(`${tpl}.decisions.companion.question`, { name: displayName })}
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {companionDecision.options.map((option) => {
                        const isActive = decisions.companion === option.id;
                        return (
                          <button
                            key={option.id}
                            onClick={() => {
                              onUpdateDecisions({ companion: option.id });
                              setTimeout(() => setActiveTab("atmosphere"), 600);
                            }}
                            className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all text-center ${
                              isActive
                                ? "border-create-primary bg-create-primary/5 shadow-md"
                                : "border-create-neutral bg-white hover:border-create-primary/40 hover:shadow-sm"
                            }`}
                          >
                            <div
                              className={`w-11 h-11 rounded-full flex items-center justify-center bg-linear-to-br ${template.themeGradient} text-white`}
                            >
                              <span className="material-symbols-outlined text-xl">{option.icon}</span>
                            </div>
                            <div>
                              <h4 className={`font-bold text-sm ${isActive ? "text-create-primary" : "text-create-text"}`}>
                                {td(`${tpl}.decisions.companion.${option.id}.title`)}
                              </h4>
                              <p className="text-xs text-create-text-sub mt-0.5">
                                {td(`${tpl}.decisions.companion.${option.id}.subtitle`)}
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

                {/* ── Atmosphere Tab ─── */}
                {activeTab === "atmosphere" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="flex flex-col gap-3">
                      <label className="text-sm font-bold text-create-text uppercase tracking-wider opacity-80">
                        {t("timeOfDay")}
                      </label>
                      <div className="grid grid-cols-1 gap-2">
                        {template.atmosphere.timeOptions.map((time) => {
                          const isActive = decisions.timeOfDay === time.id;
                          return (
                            <button
                              key={time.id}
                              onClick={() => onUpdateDecisions({ timeOfDay: time.id })}
                              className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                                isActive
                                  ? "border-create-primary bg-create-primary/5"
                                  : "border-create-neutral bg-white hover:border-create-primary/50"
                              }`}
                            >
                              <div className={`bg-create-neutral/40 p-2 rounded-lg ${time.iconColor}`}>
                                <span className="material-symbols-outlined text-xl block">
                                  {time.icon}
                                </span>
                              </div>
                              <span className="text-sm font-medium flex-1">
                                {td(`${tpl}.atmosphere.time.${time.id}`)}
                              </span>
                              {isActive && (
                                <span className="material-symbols-outlined text-lg text-create-primary">
                                  check_circle
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex flex-col gap-3">
                      <label className="text-sm font-bold text-create-text uppercase tracking-wider opacity-80">
                        {t("setting")}
                      </label>
                      <div className="grid grid-cols-1 gap-2">
                        {template.atmosphere.settingOptions.map((s) => {
                          const isActive = decisions.setting === s.id;
                          return (
                            <button
                              key={s.id}
                              onClick={() => {
                                onUpdateDecisions({ setting: s.id });
                                if (decisions.timeOfDay) {
                                  setTimeout(() => setActiveTab("twist"), 600);
                                }
                              }}
                              className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                                isActive
                                  ? "border-create-primary bg-create-primary/5"
                                  : "border-create-neutral bg-white hover:border-create-primary/50"
                              }`}
                            >
                              <div className={`${s.bgColor} p-2 rounded-lg ${s.iconColor}`}>
                                <span className="material-symbols-outlined text-xl block">{s.icon}</span>
                              </div>
                              <span className="text-sm font-medium flex-1">
                                {td(`${tpl}.atmosphere.setting.${s.id}`)}
                              </span>
                              {isActive && (
                                <span className="material-symbols-outlined text-lg text-create-primary">
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

                {/* ── Twist Tab ─── */}
                {activeTab === "twist" && challengeDecision && (
                  <div className="flex flex-col gap-3">
                    <label className="text-sm font-bold text-create-text uppercase tracking-wider opacity-80">
                      {td(`${tpl}.decisions.challenge.question`, { name: displayName })}
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {challengeDecision.options.map((option) => {
                        const isActive = decisions.challenge === option.id;
                        return (
                          <button
                            key={option.id}
                            onClick={() => onUpdateDecisions({ challenge: option.id })}
                            className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all text-center ${
                              isActive
                                ? "border-create-primary bg-create-primary/5 shadow-md"
                                : "border-create-neutral bg-white hover:border-create-primary/40 hover:shadow-sm"
                            }`}
                          >
                            <div className="w-11 h-11 rounded-full flex items-center justify-center bg-linear-to-br from-rose-700 to-red-500 text-white">
                              <span className="material-symbols-outlined text-xl">{option.icon}</span>
                            </div>
                            <div>
                              <h4 className={`font-bold text-sm ${isActive ? "text-create-primary" : "text-create-text"}`}>
                                {td(`${tpl}.decisions.challenge.${option.id}.title`)}
                              </h4>
                              <p className="text-xs text-create-text-sub mt-0.5">
                                {td(`${tpl}.decisions.challenge.${option.id}.subtitle`)}
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

                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-bold text-create-text opacity-80">
                        {t("specialMomentLabel")}
                        <span className="text-create-text-sub font-medium ml-2">{tStep2("optional")}</span>
                      </label>
                      <textarea
                        value={decisions.specialMoment || ""}
                        onChange={(e) => onUpdateDecisions({ specialMoment: e.target.value })}
                        placeholder={t("specialMomentPlaceholder")}
                        rows={2}
                        maxLength={300}
                        className="w-full px-4 py-3 rounded-xl border-2 border-create-neutral bg-white focus:border-create-primary focus:ring-0 transition-all outline-none placeholder:text-gray-300 text-sm font-medium text-create-text resize-none"
                      />
                      <p className="text-xs text-create-text-sub">{t("specialMomentHint")}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <CreationFooterNav
        onBack={onBack}
        onNext={onNext}
        nextDisabled={!allComplete}
        nextDisabledTooltip={nextTooltip}
      />
    </div>
  );
}
