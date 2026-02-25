"use client";

import { STORY_TEMPLATES } from "@/lib/create-store";
import CreationHeader from "./CreationHeader";
import CreationFooterNav from "./CreationFooterNav";

interface Step3Props {
  selectedTemplate: string | null;
  characterName: string;
  onSelectTemplate: (id: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function Step3AdventureSelection({
  selectedTemplate,
  characterName,
  onSelectTemplate,
  onNext,
  onBack,
}: Step3Props) {
  const displayName = characterName || "tu héroe";

  return (
    <div className="flex flex-col min-h-screen w-full bg-create-bg">
      <CreationHeader currentStep={3} rightAction="save" />

      {/* Main */}
      <main className="flex-1 px-4 md:px-10 py-8 flex justify-center w-full">
        <div className="w-full max-w-6xl flex flex-col gap-8">

          {/* Title */}
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-create-text leading-tight">
              ¿Qué aventura vivirá{" "}
              <span className="text-create-primary bg-create-primary/10 px-2 rounded-lg decoration-wavy underline decoration-create-primary/30 decoration-2">
                {displayName}
              </span>
              ?
            </h1>
            <p className="text-lg text-create-text-sub font-medium">
              Selecciona una historia mágica para comenzar el viaje. Cada cuento
              está diseñado para despertar su imaginación.
            </p>
          </div>

          {/* Adventure Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mt-4">
            {STORY_TEMPLATES.map((template) => {
              const isSelected = selectedTemplate === template.id;
              return (
                <div
                  key={template.id}
                  onClick={() => onSelectTemplate(template.id)}
                  className={`group relative flex flex-col rounded-xl overflow-hidden cursor-pointer transition-all duration-300 ${
                    isSelected
                      ? "-translate-y-2 shadow-xl border-4 border-create-primary ring-4 ring-create-primary/20"
                      : "hover:-translate-y-2 create-card-shadow hover:shadow-xl border-2 border-transparent hover:border-create-primary/30 bg-white"
                  }`}
                >
                  {/* Selection checkmark */}
                  {isSelected && (
                    <div className="absolute top-3 left-3 z-10 bg-create-primary text-white size-8 rounded-full flex items-center justify-center shadow-lg animate-bounce">
                      <span className="material-symbols-outlined text-xl font-bold">
                        check
                      </span>
                    </div>
                  )}

                  {/* Image */}
                  <div className="aspect-[3/4] w-full relative overflow-hidden bg-slate-100">
                    <img
                      alt={template.title}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      src={template.image}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute top-3 right-3 bg-white/90 backdrop-blur text-create-primary text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                      {template.ageRange}
                    </div>
                  </div>

                  {/* Text */}
                  <div
                    className={`p-5 flex flex-col gap-2 flex-1 ${isSelected ? "bg-create-primary/5" : ""}`}
                  >
                    <h3
                      className={`text-lg font-bold leading-tight ${isSelected ? "text-create-primary" : "text-create-text"}`}
                    >
                      {template.title}
                    </h3>
                    <p className="text-sm text-create-text-body line-clamp-3">
                      {template.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </main>

      <CreationFooterNav onBack={onBack} onNext={onNext} nextDisabled={!selectedTemplate} />
    </div>
  );
}
