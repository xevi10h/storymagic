"use client";

import type { EndingChoice } from "@/lib/create-store";
import CreationHeader from "./CreationHeader";
import CreationFooterNav from "./CreationFooterNav";

interface Step5Props {
  dedication: string;
  senderName: string;
  ending: EndingChoice;
  saving: boolean;
  onSetDedication: (text: string) => void;
  onSetSenderName: (name: string) => void;
  onSetEnding: (ending: EndingChoice) => void;
  onNext: () => void;
  onBack: () => void;
}

const ENDING_OPTIONS = [
  {
    id: "banquet" as const,
    title: "Un Banquete de Celebración",
    description:
      "Todos los personajes se reúnen para comer, bailar y celebrar el éxito de la misión.",
    icon: "cake",
    iconBg: "bg-create-primary/10",
    iconColor: "text-create-primary",
  },
  {
    id: "stars" as const,
    title: "Descanso bajo las Estrellas",
    description:
      "Un final tranquilo donde miran el cielo estrellado y reflexionan sobre lo aprendido.",
    icon: "bedtime",
    iconBg: "bg-indigo-100",
    iconColor: "text-indigo-600",
  },
];

export default function Step5AuthorMessage({
  dedication,
  senderName,
  ending,
  saving,
  onSetDedication,
  onSetSenderName,
  onSetEnding,
  onNext,
  onBack,
}: Step5Props) {
  return (
    <div className="min-h-screen flex flex-col bg-create-bg text-create-text">
      <CreationHeader currentStep={5} rightAction="save" />

      {/* Main */}
      <main className="flex-1 flex flex-col relative">
        {/* Star pattern background */}
        <div className="absolute inset-0 bg-create-neutral/30 create-star-pattern opacity-60 pointer-events-none z-0" />

        <div className="relative z-10 w-full max-w-[1200px] mx-auto px-4 py-8 flex flex-col gap-6">

          {/* Content Grid */}
          <div className="grid lg:grid-cols-12 gap-8 mt-4 items-start">
            {/* Left: Book Back Cover */}
            <div className="lg:col-span-7 flex flex-col items-center">
              <div
                className="relative w-full max-w-[500px] aspect-[3.5/5] bg-[#3A506B] rounded-r-[20px] rounded-l-[5px] p-8 flex flex-col items-center justify-between transition-transform hover:scale-[1.01] duration-300"
                style={{
                  boxShadow:
                    "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04), inset 10px 0 20px rgba(0,0,0,0.05), inset -2px 0 5px rgba(0,0,0,0.1)",
                }}
              >
                {/* Spine hint */}
                <div className="absolute left-0 top-0 bottom-0 w-[10px] bg-gradient-to-r from-white/10 to-transparent" />

                {/* Top decorative */}
                <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center mb-4 backdrop-blur-sm border border-white/20">
                  <span className="material-symbols-outlined text-white text-5xl">
                    auto_awesome
                  </span>
                </div>

                {/* Dedication card */}
                <div className="relative w-full bg-[#faf9f6] p-6 rounded-sm shadow-md rotate-[1deg] max-w-[380px]">
                  {/* Tape */}
                  <div className="create-tape-effect absolute -top-3 left-1/2 -translate-x-1/2 w-32 h-8 z-10" />
                  <label
                    className="block text-center text-create-primary font-bold text-sm mb-3 uppercase tracking-wider"
                    htmlFor="dedication"
                  >
                    Dedicatoria Especial
                  </label>
                  <textarea
                    id="dedication"
                    value={dedication}
                    onChange={(e) => onSetDedication(e.target.value)}
                    placeholder={`Querido Leo,\nEscribí este cuento para recordarte que siempre puedes alcanzar las estrellas.\nCon amor, Mamá.`}
                    rows={6}
                    className="w-full border-none bg-transparent p-0 text-center text-lg text-gray-700 focus:ring-0 resize-none leading-relaxed placeholder:text-gray-400 placeholder:italic"
                  />
                  <div className="mt-3">
                    <input
                      type="text"
                      value={senderName}
                      onChange={(e) => onSetSenderName(e.target.value)}
                      placeholder="Tu nombre (ej: Mamá, Papá, Abuela...)"
                      className="w-full border-none bg-transparent p-0 text-center text-sm text-gray-500 focus:ring-0 placeholder:text-gray-300 placeholder:italic"
                    />
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between items-center text-xs text-gray-400 font-medium">
                    <span>StoryMagic Press</span>
                    <span>2024 Edition</span>
                  </div>
                </div>

                {/* Bottom branding */}
                <div className="mt-8 text-center">
                  <h3 className="text-white/90 font-bold text-xl tracking-wide">
                    EL SECRETO DEL BOSQUE
                  </h3>
                  <p className="text-white/60 text-sm mt-1 font-medium">
                    Una aventura personalizada
                  </p>
                  <div className="mt-4 bg-white p-1 px-2 rounded-sm inline-block">
                    <div className="h-6 w-24 bg-gray-300 opacity-80" />
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Controls */}
            <div className="lg:col-span-5 flex flex-col gap-6 pt-4">
              <div className="text-center lg:text-left">
                <h1 className="text-3xl md:text-4xl font-display font-bold text-create-text leading-tight mb-2">
                  El Gran Final
                </h1>
                <p className="text-create-text-sub text-base font-medium leading-relaxed">
                  ¿Cómo quieres que termine esta increíble aventura? Tú tienes
                  la última palabra.
                </p>
              </div>

              {/* Ending options */}
              <div className="flex flex-col gap-4">
                {ENDING_OPTIONS.map((option) => {
                  const isSelected = ending === option.id;
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
                        className={`size-16 rounded-full ${option.iconBg} flex items-center justify-center ${option.iconColor} shrink-0 group-hover:scale-110 transition-transform`}
                      >
                        <span className="material-symbols-outlined text-3xl">
                          {option.icon}
                        </span>
                      </div>
                      <div className="flex-1">
                        <h3
                          className={`text-lg font-bold ${isSelected ? "text-create-primary" : "text-create-text"}`}
                        >
                          {option.title}
                        </h3>
                        <p className="text-sm text-create-text-sub leading-snug">
                          {option.description}
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

            </div>
          </div>
        </div>
      </main>

      <CreationFooterNav
        onBack={onBack}
        onNext={onNext}
        nextLabel="Crear mi cuento"
        nextLoading={saving}
      />
    </div>
  );
}
