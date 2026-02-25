"use client";

import type { StoryDecisions } from "@/lib/create-store";
import CreationHeader from "./CreationHeader";
import CreationFooterNav from "./CreationFooterNav";

interface Step4JuntosProps {
  decisions: StoryDecisions;
  characterName: string;
  onUpdateDecisions: (updates: Partial<StoryDecisions>) => void;
  onNext: () => void;
  onBack: () => void;
}

const FOREST_CHOICES = [
  {
    id: "dragon",
    title: "Dragón Dormido",
    subtitle: "Zzz... bajo el árbol antiguo",
    icon: "eco",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuA58FrKZurkdFsZ3FsnHT7vnuTlWJel4hmVzsaNdePhP5tZO64R0fQzs4r5iUR9NHQXezzVKO9qvncS5q7Rlt1G8Vk_Ss4_z_UyMJu256Ls4G9plLT5DqlYQHVZ_23-9BxcVTaKbRDTsnSpSR98cZaSdEPx9AdEGDXItI3-RiD9vVxGGVZ7Dnjn3-_GkULLFjue28jt1azcWf5vNnRMWTB3MfQ_GEhpUGXGkIN8lXgA6uLO7nzIFcGFXq4ZJ_QYxJco5BgDLxoskzuH",
  },
  {
    id: "treasure",
    title: "Cofre Mágico",
    subtitle: "¡Lleno de polvo de hadas!",
    icon: "diamond",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCVZDYVrpjSihutlCQkmyABHDGj-xzt8UHQiivlZ34eVMRlFNlq0O07z2SzBQxu6NTTuVabSoPqVQoejhfTvn3NLTv0xN_n3r-YUYgbAlmz30fcNMBLLWGt9QCMJwIpoaKeeScCA-e8s1EWkg18ETNMo-NPxNZDEnXy_flZnaHvkbh2lMBY8aT9xO8a6DqN8fxedOLWC-LUa2Mkw9HzDrYB2Gjc-lf90U96c-AMPn6vSnLTqPw1FAg_IT-_PHoOYazn4Fe10TOwlcNU",
  },
  {
    id: "door",
    title: "Puerta Secreta",
    subtitle: "¿A dónde llevará?",
    icon: "door_front",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuD2yKOR3WJQniBLX4NmSWA6mv22oELmWjhc5NxEIR2dKHxFSTLoKH6x5Ir1ArBZ1jxoX1KOpedEyyNdzpP2QcicZrDWE2XYnAh993nt2TKUEnmH1X661VaqWV1hoL35bV7JrOyvi_SYxy6NrPHo0OuDTdJR2TRSDUmERN-OnN5uMghQV-7iCcH6PhPfGW_BfSVB_yAMYkK-FXH30ZX0YK9f-PfOhB0RtaY_4kwyAM7SC09WiwXXDDeCnAkHTXL7k-AIowksq96JM84o",
  },
];

export default function Step4Juntos({
  decisions,
  onUpdateDecisions,
  onNext,
  onBack,
}: Step4JuntosProps) {
  const selected = decisions.forestChoice;

  return (
    <div className="min-h-screen flex flex-col bg-create-bg selection:bg-create-primary selection:text-white">
      {/* Decorative star pattern */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40 create-star-pattern"
        style={{ backgroundPosition: "0 0, 20px 20px" }}
      />

      <CreationHeader currentStep={4} />

      {/* Main */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-4 md:p-8 lg:p-12">
        {/* Floating prompt */}
        <div className="relative z-30 mb-8 max-w-2xl w-full text-center animate-create-float">
          <div className="relative bg-white rounded-[3rem] px-8 py-6 shadow-xl border-4 border-create-primary/20 inline-block">
            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-8 h-8 bg-white border-b-4 border-r-4 border-create-primary/20 transform rotate-45" />
            <h1 className="text-2xl md:text-4xl font-display font-bold text-create-text mb-2">
              ¿Qué encuentra el héroe en el bosque?
            </h1>
            <p className="text-create-primary font-medium text-lg">
              ¡Elige el siguiente paso de nuestra historia!
            </p>
          </div>
        </div>

        {/* The Open Book */}
        <div className="relative w-full max-w-6xl aspect-[16/10] md:aspect-[16/9] lg:aspect-[2/1] bg-[#fffdfc] rounded-[3rem] overflow-hidden flex border-8 border-[#8B5E3C]"
          style={{
            boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06), inset 20px 0 50px rgba(0,0,0,0.05), inset -20px 0 50px rgba(0,0,0,0.05)",
            backgroundImage: "linear-gradient(to right, #f8f1ef 0%, #fffdfc 10%, #fffdfc 90%, #f8f1ef 100%)"
          }}
        >
          {/* Left Page */}
          <div className="flex-1 relative p-6 md:p-12 flex flex-col items-center justify-center border-r border-gray-200/50">
            <span className="absolute bottom-6 left-8 text-gray-400 font-serif italic text-lg">
              12
            </span>
            <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/notebook.png')" }} />
          </div>

          {/* Spine */}
          <div className="absolute left-1/2 top-0 bottom-0 w-16 -ml-8 z-10 create-spine-shadow pointer-events-none" />

          {/* Right Page */}
          <div className="flex-1 relative p-6 md:p-12 flex flex-col items-center justify-center">
            <span className="absolute bottom-6 right-8 text-gray-400 font-serif italic text-lg">
              13
            </span>
            <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/notebook.png')" }} />
          </div>

          {/* Floating options */}
          <div className="absolute inset-0 z-20 flex flex-col md:flex-row items-center justify-center gap-6 md:gap-12 p-8">
            {FOREST_CHOICES.map((choice, idx) => {
              const isSelected = selected === choice.id;
              const floatClass =
                idx === 0
                  ? "animate-create-float-delay-1"
                  : idx === 1
                    ? "animate-create-float"
                    : "animate-create-float-delay-2";

              return (
                <div
                  key={choice.id}
                  onClick={() =>
                    onUpdateDecisions({ forestChoice: choice.id })
                  }
                  className={`group relative cursor-pointer flex flex-col items-center w-full max-w-[240px] ${floatClass}`}
                >
                  {/* Circle image */}
                  <div className="relative">
                    <div
                      className={`rounded-full overflow-hidden shadow-xl transition-all duration-300 ease-out bg-white ${
                        isSelected
                          ? "w-44 h-44 md:w-64 md:h-64 border-8 border-create-primary scale-105"
                          : "w-40 h-40 md:w-56 md:h-56 border-8 border-white group-hover:scale-110 group-hover:shadow-2xl group-hover:border-create-primary"
                      }`}
                      style={
                        isSelected
                          ? {
                              boxShadow:
                                "0 0 40px rgba(233,107,58,0.4)",
                            }
                          : undefined
                      }
                    >
                      {isSelected && (
                        <div className="absolute inset-0 bg-create-primary/10 z-10 rounded-full" />
                      )}
                      {!isSelected && (
                        <div className="absolute inset-0 bg-create-primary/20 opacity-0 group-hover:opacity-100 transition-opacity z-10 rounded-full" />
                      )}
                      <img
                        alt={choice.title}
                        className="w-full h-full object-cover"
                        src={choice.image}
                      />
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
                    className={`mt-6 text-center rounded-2xl p-3 shadow-lg transition-transform ${
                      isSelected
                        ? "bg-create-primary text-white -translate-y-2 relative z-20 p-4"
                        : "bg-white/90 backdrop-blur group-hover:-translate-y-2"
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-create-primary transform rotate-45" />
                    )}
                    <div
                      className={`flex items-center justify-center gap-2 mb-1 ${!isSelected ? "text-create-text" : ""}`}
                    >
                      <span
                        className={`material-symbols-outlined ${isSelected ? "text-yellow-200" : "text-create-primary"}`}
                      >
                        {choice.icon}
                      </span>
                      <h3
                        className={`font-bold ${isSelected ? "text-2xl" : "text-xl"}`}
                      >
                        {choice.title}
                      </h3>
                    </div>
                    <p
                      className={`text-sm font-medium ${isSelected ? "text-white/90" : "text-create-text-sub"}`}
                    >
                      {choice.subtitle}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </main>

      <CreationFooterNav onBack={onBack} onNext={onNext} nextDisabled={!selected} />
    </div>
  );
}
