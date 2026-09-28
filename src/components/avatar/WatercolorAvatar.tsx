"use client";

import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";
import {
  avatarBaseSrc,
  avatarLayers,
  avatarNeighbours,
  avatarOverlaySrcs,
  isAvatarRendered,
  type AvatarTraits,
} from "@/lib/avatar/manifest";

export interface WatercolorAvatarProps {
  traits: AvatarTraits;
  /** Accessible description, e.g. "Retrato de Lucía" */
  alt: string;
  /** Rendered edge in px (the component is square), or "fill" to fill a sized parent. Default 240. */
  size?: number | "fill";
  /**
   * Crop factor around the face (1 = the full 512 px portrait with its paper
   * margin). 1.35 frames head and shoulders for a round avatar.
   */
  zoom?: number;
  /** Round mask (default true) */
  round?: boolean;
  /** Preload every base one click away (+ all overlays) so the next swap is instant. Default true. */
  preloadNeighbours?: boolean;
  /** Shown when the matrix does not contain these traits yet (partial rollout). */
  fallback?: ReactNode;
  className?: string;
  priority?: boolean;
}

// One request per URL for the whole session (the builder re-renders often).
const preloaded = new Set<string>();
function preload(src: string) {
  if (typeof window === "undefined" || preloaded.has(src)) return;
  preloaded.add(src);
  const img = new window.Image();
  img.decoding = "async";
  img.src = src;
}

/**
 * Pre-rendered watercolor portrait assembled client-side: base (age band +
 * skin + hair) + eye colour (alpha) + freckles (multiply) + glasses (alpha). All layers are pixel-aligned 512 px
 * webp files, so a trait change is a src swap with no server round-trip.
 *
 * Swap strategy: the previously shown base stays on screen until the new one
 * has loaded (no blank flash on a cold cache); neighbours are preloaded, so in
 * practice the swap is immediate. Images are served `unoptimized` — they are
 * already sized/compressed, and the preload must hit the exact same URL.
 */
export default function WatercolorAvatar({
  traits,
  alt,
  size = 240,
  zoom = 1.35,
  round = true,
  preloadNeighbours = true,
  fallback = null,
  className,
  priority = false,
}: WatercolorAvatarProps) {
  const rendered = isAvatarRendered(traits);
  const baseSrc = avatarBaseSrc(traits);
  const [shownBase, setShownBase] = useState(baseSrc);

  useEffect(() => {
    if (!preloadNeighbours || !rendered) return;
    for (const src of avatarOverlaySrcs(traits.gender, traits.ageBand)) preload(src);
    for (const n of avatarNeighbours(traits)) if (isAvatarRendered(n)) preload(avatarBaseSrc(n));
  }, [traits, preloadNeighbours, rendered]);

  if (!rendered) return <>{fallback}</>;

  const overlays = avatarLayers(traits).filter((l) => l.key !== "base");
  const sizesAttr = size === "fill" ? "(min-width: 1024px) 300px, 112px" : `${size}px`;
  const layerStyle = { objectFit: "cover" as const };

  return (
    <div
      className={className}
      role="img"
      aria-label={alt}
      style={{
        position: "relative",
        width: size === "fill" ? "100%" : size,
        height: size === "fill" ? "100%" : size,
        overflow: "hidden",
        borderRadius: round ? "9999px" : undefined,
        isolation: "isolate", // multiply blends with the base only
      }}
    >
      <div style={{ position: "absolute", inset: 0, transform: `scale(${zoom})`, transformOrigin: "50% 47%" }}>
        <Image src={shownBase} alt="" fill unoptimized priority={priority} sizes={sizesAttr} style={layerStyle} draggable={false} />
        {baseSrc !== shownBase && (
          // Loads the new base on top, then promotes it; invisible until ready.
          <Image
            key={baseSrc}
            src={baseSrc}
            alt=""
            fill
            unoptimized
            sizes={sizesAttr}
            style={{ ...layerStyle, opacity: 0 }}
            onLoad={() => setShownBase(baseSrc)}
            draggable={false}
          />
        )}
        {overlays.map((l) => (
          <Image
            key={l.key}
            src={l.src}
            alt=""
            fill
            unoptimized
            sizes={sizesAttr}
            style={{ ...layerStyle, mixBlendMode: l.blend }}
            draggable={false}
          />
        ))}
      </div>
    </div>
  );
}
