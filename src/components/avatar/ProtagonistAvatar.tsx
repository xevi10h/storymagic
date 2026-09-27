"use client";

import { avatarTraitsFromCharacter } from "@/lib/avatar/manifest";
import AvatarSketch, { type ProtagonistLook } from "./AvatarSketch";
import WatercolorAvatar from "./WatercolorAvatar";

export type { ProtagonistLook };

interface ProtagonistAvatarProps {
  look: ProtagonistLook;
  /** Accessible description; omit for decorative uses (e.g. option thumbnails). */
  alt?: string;
  className?: string;
  priority?: boolean;
  preloadNeighbours?: boolean;
}

/**
 * The protagonist as the creation flow shows it: the pre-rendered watercolor
 * avatar when the matrix contains these traits, otherwise the vector sketch
 * (instant, no network) — so a partially rendered matrix never shows a hole.
 * Fills its (sized) parent.
 */
export default function ProtagonistAvatar({ look, alt, className, priority, preloadNeighbours = true }: ProtagonistAvatarProps) {
  return (
    <div className={className} aria-hidden={alt ? undefined : true}>
      <WatercolorAvatar
        traits={avatarTraitsFromCharacter(look)}
        alt={alt ?? ""}
        size="fill"
        round={false}
        priority={priority}
        preloadNeighbours={preloadNeighbours}
        fallback={<AvatarSketch look={look} className="h-full w-full" />}
      />
    </div>
  );
}
