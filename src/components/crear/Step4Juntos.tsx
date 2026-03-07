"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { StoryDecisions, StoryTemplateConfig, DecisionPoint } from "@/lib/create-store";
import CreationHeader from "./CreationHeader";
import CreationFooterNav from "./CreationFooterNav";

interface Step4JuntosProps {
  decisions: StoryDecisions;
  characterName: string;
  template: StoryTemplateConfig;
  onUpdateDecisions: (updates: Partial<StoryDecisions>) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function Step4Juntos({
  decisions,
  characterName,
  template,
  onUpdateDecisions,
  onNext,
  onBack,
}: Step4JuntosProps) {
  const t = useTranslations("crear.step4.juntos");
  const td = useTranslations("data");
  const [subStep, setSubStep] = useState(0);
  const displayName = characterName || t("defaultName");
  const tpl = `templates.${template.id}` as const;

  const decisionPoints = template.decisions;
  const currentDecision: DecisionPoint = decisionPoints[subStep];
  const totalSubSteps = decisionPoints.length;

  const currentKey = currentDecision.key;
  const selectedId = decisions[currentKey] as string | undefined;

  const question = td(`${tpl}.decisions.${currentKey}.question`, { name: displayName });

  const handleSelect = (optionId: string) => {
    onUpdateDecisions({ [currentKey]: optionId });
  };

  const handleNext = () => {
    if (subStep < totalSubSteps - 1) {
      setSubStep(subStep + 1);
    } else {
      onNext();
    }
  };

  const handleBack = () => {
    if (subStep > 0) {
      setSubStep(subStep - 1);
    } else {
      onBack();
    }
  };

  // Gradient for each decision type
  const decisionGradients: Record<string, string> = {
    encounter: template.themeGradient,
    companion: "from-amber-600 to-orange-500",
    challenge: "from-rose-700 to-red-500",
  };

  const gradient = decisionGradients[currentKey] || template.themeGradient;

  return (
    <div className="min-h-screen flex flex-col bg-create-bg selection:bg-create-primary selection:text-white">
      {/* Decorative star pattern */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40 create-star-pattern"
        style={{ backgroundPosition: "0 0, 20px 20px" }}
      />

      <CreationHeader currentStep={4} />

      {/* Main */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-3 md:p-4 lg:p-6">
        {/* Sub-step indicator */}
        <div className="flex items-center gap-3 mb-3">
          {decisionPoints.map((_, idx) => (
            <div
              key={idx}
              className={`h-2 rounded-full transition-all duration-300 ${
                idx === subStep
                  ? "w-10 bg-create-primary"
                  : idx < subStep
                    ? "w-6 bg-create-primary/40"
                    : "w-6 bg-create-neutral"
              }`}
            />
          ))}
          <span className="text-sm font-bold text-create-text-sub ml-2">
            {t("decision", { current: subStep + 1, total: totalSubSteps })}
          </span>
        </div>

        {/* Floating prompt */}
        <div className="relative z-30 mb-4 max-w-2xl w-full text-center animate-create-float">
          <div className="relative bg-white rounded-[3rem] px-6 py-4 shadow-xl border-4 border-create-primary/20 inline-block">
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 bg-white border-b-4 border-r-4 border-create-primary/20 transform rotate-45" />
            <h1 className="text-xl md:text-3xl font-display font-bold text-create-text mb-1">
              {question}
            </h1>
            <p className="text-create-primary font-medium text-base">
              {t("chooseNext")}
            </p>
          </div>
        </div>

        {/* The Open Book */}
        <div
          className="relative w-full max-w-5xl aspect-16/8 md:aspect-16/7 lg:aspect-5/2 bg-[#fffdfc] rounded-[3rem] overflow-hidden flex border-8 border-[#8B5E3C]"
          style={{
            boxShadow:
              "0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06), inset 20px 0 50px rgba(0,0,0,0.05), inset -20px 0 50px rgba(0,0,0,0.05)",
            backgroundImage:
              "linear-gradient(to right, #f8f1ef 0%, #fffdfc 10%, #fffdfc 90%, #f8f1ef 100%)",
          }}
        >
          {/* Left Page */}
          <div className="flex-1 relative p-6 md:p-12 flex flex-col items-center justify-center border-r border-gray-200/50">
            <span className="absolute bottom-6 left-8 text-gray-400 font-serif italic text-lg">
              {10 + subStep * 2}
            </span>
            <div
              className="absolute inset-0 opacity-5 pointer-events-none"
              style={{
                backgroundImage:
                  "url('https://www.transparenttextures.com/patterns/notebook.png')",
              }}
            />
          </div>

          {/* Spine */}
          <div className="absolute left-1/2 top-0 bottom-0 w-16 -ml-8 z-10 create-spine-shadow pointer-events-none" />

          {/* Right Page */}
          <div className="flex-1 relative p-6 md:p-12 flex flex-col items-center justify-center">
            <span className="absolute bottom-6 right-8 text-gray-400 font-serif italic text-lg">
              {11 + subStep * 2}
            </span>
            <div
              className="absolute inset-0 opacity-5 pointer-events-none"
              style={{
                backgroundImage:
                  "url('https://www.transparenttextures.com/patterns/notebook.png')",
              }}
            />
          </div>

          {/* Floating options */}
          <div className="absolute inset-0 z-20 flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 p-6">
            {currentDecision.options.map((option, idx) => {
              const isSelected = selectedId === option.id;
              const floatClass =
                idx === 0
                  ? "animate-create-float-delay-1"
                  : idx === 1
                    ? "animate-create-float"
                    : "animate-create-float-delay-2";

              return (
                <div
                  key={option.id}
                  onClick={() => handleSelect(option.id)}
                  className={`group relative cursor-pointer flex flex-col items-center w-full max-w-[240px] ${floatClass}`}
                >
                  {/* Circle icon */}
                  <div className="relative">
                    <div
                      className={`rounded-full overflow-hidden shadow-xl transition-all duration-300 ease-out flex items-center justify-center bg-linear-to-br ${gradient} ${
                        isSelected
                          ? "w-28 h-28 md:w-40 md:h-40 border-[6px] border-create-primary scale-105"
                          : "w-24 h-24 md:w-36 md:h-36 border-[6px] border-white group-hover:scale-110 group-hover:shadow-2xl group-hover:border-create-primary"
                      }`}
                      style={
                        isSelected
                          ? { boxShadow: "0 0 40px rgba(233,107,58,0.4)" }
                          : undefined
                      }
                    >
                      <span
                        className={`material-symbols-outlined text-white transition-transform duration-300 group-hover:scale-110 ${
                          isSelected ? "text-5xl md:text-6xl" : "text-4xl md:text-5xl"
                        }`}
                      >
                        {option.icon}
                      </span>
                    </div>
                    {/* Check indicator */}
                    {isSelected ? (
                      <div className="absolute -top-2 -right-2 md:-top-3 md:-right-3 bg-create-primary text-white w-8 h-8 md:w-10 md:h-10 rounded-full shadow-lg z-20 flex items-center justify-center border-2 border-white">
                        <span className="material-symbols-outlined text-lg md:text-xl">
                          check
                        </span>
                      </div>
                    ) : (
                      <div className="absolute -top-2 -right-2 md:-top-3 md:-right-3 bg-create-primary text-white w-7 h-7 md:w-9 md:h-9 rounded-full opacity-0 group-hover:opacity-100 scale-0 group-hover:scale-100 transition-all z-20 flex items-center justify-center border-2 border-white">
                        <span className="material-symbols-outlined text-base md:text-lg">
                          check
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Label */}
                  <div
                    className={`mt-3 text-center rounded-2xl p-2.5 shadow-lg transition-transform ${
                      isSelected
                        ? "bg-create-primary text-white -translate-y-1 relative z-20 p-3"
                        : "bg-white/90 backdrop-blur group-hover:-translate-y-1"
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-create-primary transform rotate-45" />
                    )}
                    <h3
                      className={`font-bold ${isSelected ? "text-lg" : "text-base"} ${
                        !isSelected ? "text-create-text" : ""
                      }`}
                    >
                      {td(`${tpl}.decisions.${currentKey}.${option.id}.title`)}
                    </h3>
                    <p
                      className={`text-sm font-medium mt-0.5 ${
                        isSelected ? "text-white/90" : "text-create-text-sub"
                      }`}
                    >
                      {td(`${tpl}.decisions.${currentKey}.${option.id}.subtitle`)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      <CreationFooterNav
        onBack={handleBack}
        onNext={handleNext}
        nextDisabled={!selectedId}
        nextLabel={subStep < totalSubSteps - 1 ? t("nextDecision") : undefined}
      />
    </div>
  );
}
