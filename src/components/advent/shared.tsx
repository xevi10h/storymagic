"use client";

// Small shared pieces of the Advent calendar UI.

import Image from "next/image";
import WatercolorAvatar from "@/components/avatar/WatercolorAvatar";
import { cx } from "@/components/ui";
import type { AdventLocale, StoryTemplate } from "@/lib/advent/render";
import type { DoorState } from "@/lib/advent/calendar";
import { doorDate } from "@/lib/advent/calendar";
import type { AdventChild } from "./child-store";

export interface AdventDoorData {
  door: number;
  state: DoorState;
  art: string;
  artAlt: string;
  /** Only for open doors (locked stories never reach the browser). */
  template: StoryTemplate | null;
}

const DATE_LOCALE: Record<AdventLocale, string> = { es: "es-ES", ca: "ca-ES" };

/** "5 de diciembre" / "5 de desembre". */
export function formatDoorDate(locale: AdventLocale, door: number): string {
  return new Intl.DateTimeFormat(DATE_LOCALE[locale], { timeZone: "UTC", day: "numeric", month: "long" }).format(
    new Date(`${doorDate(door)}T00:00:00Z`),
  );
}

/** Round watercolour portrait with a paper ring (character children only). */
export function ChildPortrait({
  child,
  size,
  ring = 4,
  alt,
  className,
  priority = false,
}: {
  child: AdventChild | null;
  size: number;
  ring?: number;
  alt: string;
  className?: string;
  priority?: boolean;
}) {
  const traits = child?.source === "character" ? child.traits : null;
  return (
    <span
      className={cx("block shrink-0 overflow-hidden rounded-full bg-paper", className)}
      style={{ width: size, height: size, padding: ring }}
    >
      {traits ? (
        <WatercolorAvatar traits={traits} alt={alt} size="fill" preloadNeighbours={false} priority={priority} />
      ) : (
        <span aria-hidden className="flex h-full w-full items-center justify-center rounded-full bg-line font-display text-2xl font-bold text-brand-deep">
          {child?.name.charAt(0).toUpperCase() ?? "?"}
        </span>
      )}
    </span>
  );
}

/** A door's illustration filling its (relatively positioned) parent. */
export function DoorArt({ door, sizes, priority = false }: { door: AdventDoorData; sizes: string; priority?: boolean }) {
  return <Image src={door.art} alt={door.artAlt} fill sizes={sizes} priority={priority} className="object-cover" />;
}
