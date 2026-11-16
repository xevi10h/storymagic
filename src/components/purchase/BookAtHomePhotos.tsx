"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { CoverFace } from "@/components/book-mockup/CoverFace";
import { quadMatrix3d, type Quad } from "@/lib/perspective";

// AI-recreated scenes of the sample hardcover "Noa y la llave de flor" (gpt-image-2.5-sunburst from the real
// cover and pages, 2026-11-16). On the two closed-book scenes the buyer's own cover and spine are laid over the
// sample's with a perspective transform, so they see THEIR book at home. The caption saying the scenes are
// AI-recreated always stays visible (AI Act art. 50, no misleading product claims).
// Quads are in the photo's own pixels (720 × 960), corners TL, TR, BR, BL; measured by hand on the files.
const PHOTO_W = 720;
const PHOTO_H = 960;
type Photo = { src: string; alt: "altTable" | "altOpen" | "altGift"; cover?: Quad; spine?: Quad; shade?: string };
const PHOTOS: Photo[] = [
  {
    src: "/images/purchase/home-table.webp",
    alt: "altTable",
    cover: [[38, 242], [441, 139], [669, 470], [163, 623]],
    spine: [[21, 247], [38, 242], [163, 623], [148, 646]],
    shade: "linear-gradient(160deg, rgba(255,255,255,0.10), rgba(0,0,0,0.10))",
  },
  { src: "/images/purchase/home-open.webp", alt: "altOpen" },
  {
    src: "/images/purchase/home-gift.webp",
    alt: "altGift",
    cover: [[82, 235], [555, 172], [667, 637], [144, 740]],
    spine: [[55, 240], [82, 235], [144, 740], [120, 750]],
    shade: "linear-gradient(170deg, rgba(255,214,150,0.10), rgba(0,0,0,0.14))",
  },
];
// Size of the flat faces before the transform (square cover; spine = board thickness × height).
const FACE = 400;
const SPINE_W = 26;

export interface BookAtHomeCover {
  coverUrl: string | null;
  title: string;
  childName: string;
  subtitle?: string;
  spineColor: string;
}

export function BookAtHomePhotos({ cover, className = "" }: { cover?: BookAtHomeCover; className?: string }) {
  const t = useTranslations("crear.purchase.atHome");
  return (
    <section className={className} data-testid="book-at-home" aria-labelledby="book-at-home-title">
      <p id="book-at-home-title" className="mb-1.5 text-xs font-bold uppercase tracking-wide text-create-text-sub">
        {t("title")}
      </p>
      <ul className="no-scrollbar -mx-5 flex snap-x snap-mandatory scroll-px-5 gap-2 overflow-x-auto px-5 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
        {PHOTOS.map((p) => (
          <li key={p.src} className="w-[62%] shrink-0 snap-start sm:w-auto">
            <PhotoWithCover photo={p} cover={cover} alt={t(p.alt)} />
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-[11.5px] leading-snug text-create-text-sub">{t(cover ? "captionOwn" : "caption")}</p>
    </section>
  );
}

function PhotoWithCover({ photo, cover, alt }: { photo: Photo; cover?: BookAtHomeCover; alt: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const overlay = !!(cover && photo.cover);
  useEffect(() => {
    const el = box.current;
    if (!el || !overlay) return;
    const ro = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / PHOTO_W));
    ro.observe(el);
    return () => ro.disconnect();
  }, [overlay]);

  return (
    <div ref={box} className="relative aspect-[3/4] w-full overflow-hidden rounded-lg bg-create-neutral">
      <Image src={photo.src} alt={alt} fill sizes="(min-width: 640px) 180px, 62vw" loading="lazy" className="object-cover" />
      {overlay && cover && photo.cover && scale > 0 && (
        // The photo's pixel space, scaled to the box; faces are mapped into it.
        <div
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 origin-top-left"
          style={{ width: PHOTO_W, height: PHOTO_H, transform: `scale(${scale})` }}
          data-testid="own-cover"
        >
          {photo.spine && (
            <div
              className="absolute left-0 top-0 origin-top-left overflow-hidden"
              style={{ width: SPINE_W, height: FACE, transform: quadMatrix3d(SPINE_W, FACE, photo.spine), backgroundColor: cover.spineColor }}
            >
              <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.45),rgba(255,255,255,0.12)_50%,rgba(0,0,0,0.35))]" />
              <span
                className="absolute inset-0 flex items-center justify-center overflow-hidden whitespace-nowrap font-display text-[11px] font-semibold text-white/90 [writing-mode:vertical-rl]"
              >
                {cover.title}
              </span>
            </div>
          )}
          <div
            className="absolute left-0 top-0 origin-top-left"
            style={{ width: FACE, height: FACE, transform: quadMatrix3d(FACE, FACE, photo.cover) }}
          >
            <CoverFace
              imageUrl={cover.coverUrl}
              title={cover.title}
              childName={cover.childName}
              subtitle={cover.subtitle}
              fallbackColor={cover.spineColor}
            />
            {photo.shade && <div className="absolute inset-0" style={{ background: photo.shade }} />}
          </div>
        </div>
      )}
    </div>
  );
}
