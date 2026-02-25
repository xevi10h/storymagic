"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import CreationHeader from "@/components/crear/CreationHeader";

const WHIMSICAL_MESSAGES = [
  { text: "Tu héroe está preparando la mochila...", icon: "backpack" },
  { text: "Eligiendo los colores perfectos...", icon: "palette" },
  { text: "Las páginas están cobrando vida...", icon: "auto_stories" },
  { text: "Los personajes se están conociendo...", icon: "groups" },
  { text: "Pintando un cielo lleno de estrellas...", icon: "star" },
  { text: "Los árboles del bosque están creciendo...", icon: "forest" },
  { text: "Las ilustraciones se están secando...", icon: "brush" },
  { text: "Preparando la tinta mágica...", icon: "ink_pen" },
  { text: "Encuadernando tu aventura...", icon: "menu_book" },
  { text: "Añadiendo un toque de magia final...", icon: "auto_awesome" },
];

type GenerationStatus = "starting" | "generating" | "ready" | "error";

export default function GenerarPage() {
  const { storyId } = useParams<{ storyId: string }>();
  const router = useRouter();
  const [status, setStatus] = useState<GenerationStatus>("starting");
  const [messageIndex, setMessageIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const generationStarted = useRef(false);

  // Rotate whimsical messages
  useEffect(() => {
    if (status !== "generating" && status !== "starting") return;

    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % WHIMSICAL_MESSAGES.length);
    }, 3500);

    return () => clearInterval(interval);
  }, [status]);

  // Simulate progress bar
  useEffect(() => {
    if (status !== "generating" && status !== "starting") return;

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return prev; // Cap at 90 until actually done
        return prev + Math.random() * 3;
      });
    }, 500);

    return () => clearInterval(interval);
  }, [status]);

  const startGeneration = useCallback(async () => {
    setStatus("generating");

    try {
      const res = await fetch(`/api/stories/${storyId}/generate`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.details || data.error || "Generation failed");
      }

      setProgress(100);
      setStatus("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
      setStatus("error");
    }
  }, [storyId]);

  // Start generation on mount
  useEffect(() => {
    if (generationStarted.current) return;
    generationStarted.current = true;
    startGeneration();
  }, [startGeneration]);

  const currentMessage = WHIMSICAL_MESSAGES[messageIndex];

  // Ready state
  if (status === "ready") {
    return (
      <div className="flex min-h-screen flex-col bg-create-bg">
        <CreationHeader rightAction="none" />
        <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
        <div className="max-w-md">
          <div className="mb-6 inline-flex h-24 w-24 items-center justify-center rounded-full bg-success/10">
            <span className="material-symbols-outlined text-5xl text-success">
              check_circle
            </span>
          </div>
          <h1 className="font-display text-3xl font-bold text-secondary">
            Tu cuento está listo
          </h1>
          <p className="mt-4 text-base leading-relaxed text-text-muted">
            Hemos creado una historia única con 8 escenas personalizadas.
            ¡Hora de verla!
          </p>
          <div className="mt-8 flex flex-col gap-3">
            <button
              onClick={() => router.push(`/crear/${storyId}/preview`)}
              className="rounded-full bg-create-primary px-8 py-4 text-base font-bold text-white transition-all hover:bg-create-primary-hover hover:-translate-y-0.5 shadow-lg shadow-create-primary/20"
            >
              Ver mi cuento
            </button>
            <Link
              href="/crear"
              className="text-sm text-text-muted hover:text-text-soft"
            >
              Crear otro cuento
            </Link>
          </div>
        </div>
        </div>
      </div>
    );
  }

  // Error state
  if (status === "error") {
    return (
      <div className="flex min-h-screen flex-col bg-create-bg">
        <CreationHeader rightAction="none" />
        <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
        <div className="max-w-md">
          <div className="mb-6 inline-flex h-24 w-24 items-center justify-center rounded-full bg-red-100">
            <span className="material-symbols-outlined text-5xl text-red-500">
              error
            </span>
          </div>
          <h1 className="font-display text-2xl font-bold text-secondary">
            Algo no ha ido bien
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-text-muted">
            {error || "Ha ocurrido un error durante la generación."}
          </p>
          <div className="mt-8 flex flex-col gap-3">
            <button
              onClick={() => {
                setStatus("starting");
                setProgress(0);
                setError(null);
                generationStarted.current = false;
                startGeneration();
              }}
              className="rounded-full bg-create-primary px-8 py-3 text-sm font-bold text-white transition-all hover:bg-create-primary-hover"
            >
              Reintentar
            </button>
            <Link
              href="/crear"
              className="text-sm text-text-muted hover:text-text-soft"
            >
              ← Volver a empezar
            </Link>
          </div>
        </div>
        </div>
      </div>
    );
  }

  // Generating state (main animation)
  return (
    <div className="flex min-h-screen flex-col bg-create-bg relative overflow-hidden">
      <CreationHeader rightAction="none" />
      {/* Background star pattern */}
      <div className="absolute inset-0 create-star-pattern opacity-30 pointer-events-none" />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 text-center">
      <div className="max-w-lg w-full">
        {/* Animated book icon */}
        <div className="mb-8 relative">
          <div className="inline-flex h-32 w-32 items-center justify-center rounded-full bg-white shadow-lg shadow-create-primary/10">
            <span className="material-symbols-outlined text-7xl text-create-primary animate-pulse">
              {currentMessage.icon}
            </span>
          </div>
          {/* Floating decorative elements */}
          <div className="absolute -top-2 -right-4 animate-create-float">
            <span className="material-symbols-outlined text-2xl text-create-gold opacity-60">
              star
            </span>
          </div>
          <div className="absolute -bottom-1 -left-6 animate-create-float-delay-1">
            <span className="material-symbols-outlined text-xl text-create-primary opacity-40">
              auto_awesome
            </span>
          </div>
          <div className="absolute top-4 -left-2 animate-create-float-delay-2">
            <span className="material-symbols-outlined text-lg text-indigo-400 opacity-50">
              star
            </span>
          </div>
        </div>

        {/* Title */}
        <h1 className="font-display text-3xl font-bold text-secondary">
          Creando tu historia...
        </h1>

        {/* Rotating message */}
        <div className="mt-4 h-8">
          <p
            key={messageIndex}
            className="text-base text-text-muted animate-fade-in"
          >
            {currentMessage.text}
          </p>
        </div>

        {/* Progress bar */}
        <div className="mt-8 w-full max-w-sm mx-auto">
          <div className="rounded-full bg-create-neutral h-3 w-full overflow-hidden shadow-inner">
            <div
              className="h-full rounded-full bg-create-primary transition-all duration-700 ease-out"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-text-muted">
            {Math.round(Math.min(progress, 100))}% completado
          </p>
        </div>

        {/* Info text */}
        <p className="mt-8 text-sm text-text-muted leading-relaxed max-w-xs mx-auto">
          Esto puede tardar unos segundos. Estamos escribiendo cada escena con
          cariño.
        </p>
      </div>
      </div>
    </div>
  );
}
