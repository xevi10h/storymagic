"use client";

import { useTranslations } from "next-intl";
import type { CreationMode } from "@/lib/create-store";
import CreationHeader from "./CreationHeader";
import CreationFooterNav from "./CreationFooterNav";

interface Step1Props {
  mode: CreationMode;
  onSelectMode: (mode: CreationMode) => void;
  onNext: () => void;
}

const MODE_IDS = [
  {
    id: "solo" as const,
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDjd-aoOpygR8MrGzzCHcxxp3Z8Rz-wnvSFvizt10jeqpldSJ8J0jxtwMCfrHVcWiHc3_M6uTXMYpJnI4VX2_Eqe2XpXxgY6nccF9N-d9z-fImO8Xi3olYO2rltoK3KaEENYNad5EHpvrdITzMLOYBB7pLUgNHRPQylguMnsYx1Slw1zQ49CxSl4U_yTFz8kjQIBbMSl15TFtLnYWvDqZ0QfkaXrDM493VGIy-8BgGRxuv5MPM6gglzmFX35Aowr24jLIbYpZN0-1m-",
  },
  {
    id: "juntos" as const,
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAHrn-Dhfxi3HjHNJY2G48oMf5eBhsdfcXkg8zCN4ckdnY3HRII7lMcfJdaU-aLDDZdmaluSdXeSljJQbMJXErn9hwUM-qFJnRVSkiPX3ZYBtk5iTeKlZirM4QnVe7whOn-PxUTuCm2tHsrSLiUWu5VUsMRd3tebWWBDzS6e8aewctvhtoe0OyQzwZegNxoM-DFqSBZR1JrBXMeJVmF6prhzYpfEohTtyaewr7TLoHoTo17uBZDt7dHLg7o1BYXfeENGooHC_4VfxhV",
  },
];

export default function Step1ModeSelection({
  mode,
  onSelectMode,
  onNext,
}: Step1Props) {
  const t = useTranslations("crear.step1");

  const MODES = MODE_IDS.map((m) => ({
    ...m,
    title: t(`${m.id}.title`),
    subtitle: t(`${m.id}.subtitle`),
    description: t(`${m.id}.description`),
    imageAlt: t(`${m.id}.imageAlt`),
  }));

  return (
    <div className="flex min-h-screen w-full flex-col bg-create-bg">
      <CreationHeader currentStep={1} />

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center w-full max-w-6xl mx-auto px-6 pb-4 pt-4 lg:pt-6">
        <div className="text-center mb-5 lg:mb-6 space-y-2 max-w-3xl">
          <h1 className="text-create-text font-display text-3xl md:text-4xl lg:text-5xl font-bold leading-tight">
            {t("title")}
          </h1>
          <p className="text-create-text-sub text-base md:text-lg font-medium leading-relaxed max-w-2xl mx-auto">
            {t("subtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full max-w-5xl">
          {MODES.map((m) => {
            const isSelected = mode === m.id;
            return (
              <div
                key={m.id}
                onClick={() => onSelectMode(m.id)}
                className={`group relative cursor-pointer flex flex-col rounded-[24px] border-2 transition-all duration-300 hover:-translate-y-1 p-4 md:p-5 h-full ${
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
                <div className="w-full aspect-16/10 rounded-2xl bg-gray-100 mb-4 overflow-hidden relative shadow-inner">
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
                <div className="flex flex-col gap-1.5 grow">
                  <h3
                    className={`font-display text-xl font-bold ${
                      isSelected ? "text-create-primary" : "text-create-text"
                    }`}
                  >
                    {m.title}
                  </h3>
                  <p className="text-create-primary font-bold text-sm tracking-wide uppercase">
                    {m.subtitle}
                  </p>
                  <p className="text-create-text-sub text-sm leading-relaxed mt-1">
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
