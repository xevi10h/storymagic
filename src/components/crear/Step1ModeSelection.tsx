"use client";

import type { CreationMode } from "@/lib/create-store";
import CreationHeader from "./CreationHeader";
import CreationFooterNav from "./CreationFooterNav";

interface Step1Props {
  mode: CreationMode;
  onSelectMode: (mode: CreationMode) => void;
  onNext: () => void;
}

const MODES = [
  {
    id: "solo" as const,
    title: "Creo yo solo/a",
    subtitle: "Sorpresa Mágica",
    description:
      "Diseña el cuento en secreto para dárselo como un regalo sorpresa inolvidable. Tú tienes el control total de la historia y los detalles.",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDjd-aoOpygR8MrGzzCHcxxp3Z8Rz-wnvSFvizt10jeqpldSJ8J0jxtwMCfrHVcWiHc3_M6uTXMYpJnI4VX2_Eqe2XpXxgY6nccF9N-d9z-fImO8Xi3olYO2rltoK3KaEENYNad5EHpvrdITzMLOYBB7pLUgNHRPQylguMnsYx1Slw1zQ49CxSl4U_yTFz8kjQIBbMSl15TFtLnYWvDqZ0QfkaXrDM493VGIy-8BgGRxuv5MPM6gglzmFX35Aowr24jLIbYpZN0-1m-",
    imageAlt: "Niño leyendo un libro concentrado",
  },
  {
    id: "juntos" as const,
    title: "Creamos juntos",
    subtitle: "Aventura Compartida",
    description:
      "Una experiencia interactiva diseñada para disfrutar en familia. Elige personajes, colores y giros de la trama junto a tu peque.",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAHrn-Dhfxi3HjHNJY2G48oMf5eBhsdfcXkg8zCN4ckdnY3HRII7lMcfJdaU-aLDDZdmaluSdXeSljJQbMJXErn9hwUM-qFJnRVSkiPX3ZYBtk5iTeKlZirM4QnVe7whOn-PxUTuCm2tHsrSLiUWu5VUsMRd3tebWWBDzS6e8aewctvhtoe0OyQzwZegNxoM-DFqSBZR1JrBXMeJVmF6prhzYpfEohTtyaewr7TLoHoTo17uBZDt7dHLg7o1BYXfeENGooHC_4VfxhV",
    imageAlt: "Padre e hijo leyendo juntos un libro",
  },
];

export default function Step1ModeSelection({
  mode,
  onSelectMode,
  onNext,
}: Step1Props) {
  return (
    <div className="flex min-h-screen w-full flex-col bg-create-bg">
      <CreationHeader currentStep={1} />

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center w-full max-w-6xl mx-auto px-6 pb-8 pt-8">
        <div className="text-center mb-12 space-y-3 max-w-3xl">
          <h1 className="text-create-text font-display text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
            ¿Cómo quieres crear esta aventura?
          </h1>
          <p className="text-create-text-sub text-lg md:text-xl font-medium leading-relaxed max-w-2xl mx-auto">
            Elige la experiencia perfecta para hoy. Puedes personalizar cada
            detalle o dejar que la magia te sorprenda.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-5xl">
          {MODES.map((m) => {
            const isSelected = mode === m.id;
            return (
              <div
                key={m.id}
                onClick={() => onSelectMode(m.id)}
                className={`group relative cursor-pointer flex flex-col rounded-[24px] border-2 transition-all duration-300 hover:-translate-y-1 p-6 md:p-8 h-full ${
                  isSelected
                    ? "create-card-selected ring-4 ring-create-primary/10"
                    : "bg-white border-transparent hover:border-create-primary/40 create-card-shadow"
                }`}
              >
                {/* Selection indicator */}
                <div className="absolute top-6 right-6 z-20">
                  {isSelected ? (
                    <div className="size-8 rounded-full border-2 border-create-primary bg-create-primary shadow-sm flex items-center justify-center transition-all">
                      <span className="material-symbols-outlined text-white text-lg font-bold">
                        check
                      </span>
                    </div>
                  ) : (
                    <div className="size-8 rounded-full border-2 border-white bg-white/80 backdrop-blur-sm shadow-sm group-hover:border-create-primary flex items-center justify-center transition-all">
                      <div className="size-4 rounded-full bg-create-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  )}
                </div>

                {/* Image */}
                <div className="w-full aspect-[4/3] rounded-2xl bg-gray-100 mb-6 overflow-hidden relative shadow-inner">
                  <img
                    alt={m.imageAlt}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    src={m.image}
                  />
                  <div
                    className={`absolute inset-0 ${
                      isSelected
                        ? "bg-gradient-to-t from-create-primary/20 to-transparent opacity-60"
                        : "bg-gradient-to-t from-black/40 to-transparent opacity-60"
                    }`}
                  />
                </div>

                {/* Text */}
                <div className="flex flex-col gap-2 flex-grow">
                  <h3
                    className={`font-display text-2xl font-bold ${
                      isSelected ? "text-create-primary" : "text-create-text"
                    }`}
                  >
                    {m.title}
                  </h3>
                  <p className="text-create-primary font-bold text-sm tracking-wide uppercase">
                    {m.subtitle}
                  </p>
                  <p className="text-create-text-sub text-base leading-relaxed mt-2">
                    {m.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      <CreationFooterNav onNext={onNext} nextDisabled={!mode} />
    </div>
  );
}
