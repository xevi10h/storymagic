"use client";

import { useState } from "react";
import { BookMockup, type BookMockupFormat } from "@/components/book-mockup";

const SHOWCASE = "https://rmxjtugoyfaxxkiiayss.supabase.co/storage/v1/object/public/showcase";
const COVER = `${SHOWCASE}/f6b7a973-e2de-41f9-9b80-bd86c21febca/cover-1774593946858.png`;
const MIA = `${SHOWCASE}/9fd35006-da4c-4ee4-a3ec-606b7ac31b68`;
const PANORAMA = { panorama: `${MIA}/scene-3.png` };
const PAIR = { left: `${MIA}/scene-1.png`, right: `${MIA}/scene-4.png` };

const FORMATS: BookMockupFormat[] = ["hardcover", "softcover", "pdf"];

export function BookMockupHarness(props: {
  initialFormat: BookMockupFormat;
  initialVariant: "closed" | "open";
  initialPose: "spine" | "pages";
  solo: boolean;
  noCover: boolean;
  longTitle: boolean;
  pair: boolean;
}) {
  const [format, setFormat] = useState(props.initialFormat);
  const [variant, setVariant] = useState(props.initialVariant);
  const [pose, setPose] = useState(props.initialPose);
  const title = props.longTitle
    ? "La increíble aventura de Maximiliano entre las estrellas del sur"
    : "Teo y el Viaje a las Estrellas";
  const name = props.longTitle ? "Maximiliano" : "Teo";

  const mockup = (
    <BookMockup
      coverUrl={props.noCover ? null : COVER}
      title={title}
      childName={name}
      subtitle="Una historia personalizada para"
      format={format}
      variant={variant}
      pose={pose}
      spread={props.pair ? PAIR : PANORAMA}
      spineColor="#1a1a4e"
      alt={`Libro ${format === "pdf" ? "digital" : format === "hardcover" ? "de tapa dura" : "de tapa blanda"} de 20 × 20 cm: ${title}`}
      priority
    />
  );

  if (props.solo) {
    return (
      <main className="min-h-screen bg-cream flex items-center justify-center p-4">
        <div className="w-full max-w-[720px]" data-testid="mockup">{mockup}</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-cream px-4 py-10">
      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[1.2fr_1fr] md:items-center">
        <div data-testid="mockup">{mockup}</div>
        <div className="space-y-6">
          <h1 className="font-display text-3xl font-bold text-text-main">Book mockup (dev)</h1>
          <Group label="Format" value={format} options={FORMATS} onChange={setFormat} />
          <Group label="Variant" value={variant} options={["closed", "open"] as const} onChange={setVariant} />
          <Group label="Pose" value={pose} options={["spine", "pages"] as const} onChange={setPose} />
        </div>
      </div>
    </main>
  );
}

function Group<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: readonly T[]; onChange: (v: T) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-text-soft">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            data-testid={`${label.toLowerCase()}-${o}`}
            onClick={() => onChange(o)}
            className={`rounded-full border px-4 py-2 text-sm font-semibold ${o === value ? "border-primary bg-primary text-white" : "border-border-light bg-white text-text-soft"}`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}
