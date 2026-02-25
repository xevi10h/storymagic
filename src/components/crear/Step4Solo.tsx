"use client";

import { useState } from "react";
import type { StoryDecisions } from "@/lib/create-store";
import CreationHeader from "./CreationHeader";
import CreationFooterNav from "./CreationFooterNav";

interface Step4SoloProps {
  decisions: StoryDecisions;
  characterName: string;
  onUpdateDecisions: (updates: Partial<StoryDecisions>) => void;
  onNext: () => void;
  onBack: () => void;
}

type TabId = "protagonists" | "atmosphere" | "twist";

const WEATHER_OPTIONS = [
  {
    id: "rain" as const,
    label: "Lluvia Suave",
    icon: "rainy",
    bgColor: "bg-blue-100",
    iconColor: "text-blue-500",
  },
  {
    id: "wind" as const,
    label: "Viento Cálido",
    icon: "air",
    bgColor: "bg-create-primary/10",
    iconColor: "text-create-primary",
  },
  {
    id: "fog" as const,
    label: "Niebla Misteriosa",
    icon: "foggy",
    bgColor: "bg-purple-100",
    iconColor: "text-purple-500",
  },
  {
    id: "sparkles" as const,
    label: "Chispas Mágicas",
    icon: "auto_awesome",
    bgColor: "bg-yellow-100",
    iconColor: "text-yellow-600",
  },
];

const TIME_OPTIONS = [
  { id: "day" as const, label: "Día", icon: "sunny", iconColor: "text-yellow-500" },
  {
    id: "sunset" as const,
    label: "Atardecer",
    icon: "wb_twilight",
    iconColor: "text-white",
  },
  {
    id: "night" as const,
    label: "Noche",
    icon: "bedtime",
    iconColor: "text-indigo-400",
  },
];

export default function Step4Solo({
  decisions,
  characterName,
  onUpdateDecisions,
  onNext,
  onBack,
}: Step4SoloProps) {
  const [activeTab, setActiveTab] = useState<TabId>("atmosphere");
  const displayName = characterName || "Leo";

  const timeOfDay = decisions.timeOfDay || "sunset";
  const weather = decisions.weather || "wind";

  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: "protagonists", label: "Protagonistas", icon: "face" },
    { id: "atmosphere", label: "Atmósfera", icon: "landscape" },
    { id: "twist", label: "El Giro", icon: "alt_route" },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-create-bg text-create-text">
      <CreationHeader currentStep={4} rightAction="save" />

      {/* Main */}
      <main className="flex-grow flex flex-col items-center w-full px-4 sm:px-6 py-6 lg:py-8">
        <div className="w-full max-w-[1024px] flex flex-col gap-6">
          {/* Title */}
          <div className="flex flex-col gap-4">
            <h1 className="text-3xl md:text-4xl font-display font-bold text-center text-create-text">
              El Libro de las Mil Decisiones
            </h1>
            <p className="text-create-text-sub text-center max-w-lg mx-auto font-medium">
              Personaliza los detalles de tu historia y observa cómo cambia la
              magia en tiempo real.
            </p>
          </div>

          {/* Book preview */}
          <div className="relative w-full mt-6 mb-8">
            <div className="relative w-full aspect-[4/3] md:aspect-[2/1] bg-white rounded-xl md:rounded-3xl create-book-shadow border border-create-neutral flex overflow-hidden">
              {/* Left page - text */}
              <div className="hidden md:flex flex-1 p-8 md:p-12 flex-col justify-center items-start bg-[#fdfbf9] relative">
                <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-black/5 to-transparent z-10 pointer-events-none" />
                <div className="font-serif italic text-create-text-secondary/60 mb-4">
                  Capítulo 1
                </div>
                <h3 className="text-2xl font-bold text-create-text mb-6">
                  El Bosque de los Susurros
                </h3>
                <div className="space-y-4 text-create-text-secondary leading-relaxed font-serif text-lg">
                  <p>
                    Había una vez un pequeño explorador llamado{" "}
                    <span className="bg-create-primary/10 text-create-primary px-1 rounded font-bold">
                      {displayName}
                    </span>{" "}
                    que vivía al borde de lo desconocido.
                  </p>
                  <p>
                    Una tarde, mientras el sol teñía el cielo de{" "}
                    <span className="bg-create-primary/10 text-create-primary px-1 rounded font-bold">
                      naranja atardecer
                    </span>
                    , decidió adentrarse en el bosque. No iba solo, su fiel{" "}
                    <span className="bg-create-primary/10 text-create-primary px-1 rounded font-bold">
                      dragón Pepe
                    </span>{" "}
                    lo seguía de cerca.
                  </p>
                  <p className="opacity-50">
                    Lo que no sabían era que hoy...{" "}
                    <span className="italic">algo inesperado sucedería.</span>
                  </p>
                </div>
                <div className="mt-auto text-xs text-create-text-secondary/40 text-center w-full">
                  Página 4
                </div>
              </div>

              {/* Right page - illustration */}
              <div className="flex-1 relative bg-neutral-100 overflow-hidden group">
                <div className="hidden md:block absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-black/5 to-transparent z-10 pointer-events-none" />
                <img
                  alt="Magical forest illustration at sunset"
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuD6sHs-cjno2J1JgS7Emj1wqM28Gr25e1I9HAL4NmUypmbI9AXebv5PZDw17MiQbrEZ-lzJ25Xg8sNSR3EF2d3lf8Idav28UoHlOKZByHIUoGhXJg2pHQGAekZS9TYN49D_2pllK-htV7jw4ieclImp5FSuKoHI8se8U1OG52Iuj8mkC0LRYoirkISEQMKnGmlV8qlbilr09DB51z_hgsnamx0XsWpNpU3OW8knn1pSB5HkRtrgnV_o4RnemztodEkVH4-k0E6hHmSt"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-6 left-6 right-6 flex justify-between items-end">
                  <div className="bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm">
                    <span className="text-create-primary">Atmósfera:</span>{" "}
                    {timeOfDay === "day"
                      ? "Día"
                      : timeOfDay === "sunset"
                        ? "Atardecer"
                        : "Noche"}
                  </div>
                  <button className="bg-white/20 hover:bg-white/40 backdrop-blur-md p-2 rounded-full text-white transition-colors">
                    <span className="material-symbols-outlined text-xl">
                      refresh
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Configuration panel */}
          <div className="bg-white rounded-2xl border border-create-neutral shadow-sm p-2 md:p-4">
            {/* Tabs */}
            <div className="flex border-b border-create-neutral mb-6 px-2 overflow-x-auto">
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
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="px-2 md:px-4 pb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Time of Day */}
                <div className="flex flex-col gap-4">
                  <label className="text-sm font-bold text-create-text uppercase tracking-wider opacity-80">
                    Momento del día
                  </label>
                  <div className="flex flex-wrap gap-3">
                    {TIME_OPTIONS.map((time) => {
                      const isActive = timeOfDay === time.id;
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
                            className={`material-symbols-outlined transition-transform ${isActive ? time.iconColor : time.iconColor} group-hover:scale-110`}
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

                {/* Weather */}
                <div className="flex flex-col gap-4">
                  <label className="text-sm font-bold text-create-text uppercase tracking-wider opacity-80">
                    Clima Mágico
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {WEATHER_OPTIONS.map((w) => {
                      const isActive = weather === w.id;
                      return (
                        <button
                          key={w.id}
                          onClick={() =>
                            onUpdateDecisions({ weather: w.id })
                          }
                          className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                            isActive
                              ? "border-create-primary bg-create-primary/5"
                              : "border-create-neutral bg-white hover:border-create-primary/50"
                          }`}
                        >
                          <div
                            className={`${w.bgColor} p-2 rounded-lg ${w.iconColor}`}
                          >
                            <span className="material-symbols-outlined text-xl block">
                              {w.icon}
                            </span>
                          </div>
                          <span className="text-sm font-medium">
                            {w.label}
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
            </div>
          </div>

        </div>
      </main>

      <CreationFooterNav onBack={onBack} onNext={onNext} />
    </div>
  );
}
