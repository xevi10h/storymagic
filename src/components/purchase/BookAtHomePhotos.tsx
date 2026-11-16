"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { CoverFace } from "@/components/book-mockup/CoverFace";
import { quadMatrix3d, type Quad } from "@/lib/perspective";

// AI-recreated home scenes of a sample hardcover (gpt-image-2.5-sunburst, 2026-11-16). The table and gift
// scenes are "plates": the same book with a blank white cover and a plain spine, so the buyer's OWN cover is laid
// on top with a perspective transform, and the plate is multiplied back over it to give the cover the photo's
// light, shading and board edges. The open-book scene keeps sample pages. The caption saying the scenes are
// AI-recreated always stays visible (AI Act art. 50, no misleading product claims).
// Quads are the blank cover's corners in the photo's own pixels (720 × 960), TL, TR, BR, BL, found by
// thresholding the white cover on the plate files, then pushed ~3 px outward so the art covers the white board rim.
const PHOTO_W = 720;
const PHOTO_H = 960;
type Photo = { src: string; alt: "altTable" | "altOpen" | "altGift"; cover?: Quad };
const PHOTOS: Photo[] = [
  { src: "/images/purchase/home-table-blank.webp", alt: "altTable", cover: [[34, 318], [441, 216], [666, 550], [169, 710]] },
  { src: "/images/purchase/home-open.webp", alt: "altOpen" },
  { src: "/images/purchase/home-gift-blank.webp", alt: "altGift", cover: [[81, 270], [548, 200], [667, 675], [149, 769]] },
];
const FACE = 400; // flat cover size before the transform

export interface BookAtHomeCover {
  coverUrl: string | null;
  title: string;
  childName: string;
  subtitle?: string;
  spineColor: string;
}

export function BookAtHomePhotos({ cover, className = "" }: { cover: BookAtHomeCover; className?: string }) {
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
      <p className="mt-1.5 text-[11.5px] leading-snug text-create-text-sub">{t("caption")}</p>
    </section>
  );
}

function PhotoWithCover({ photo, cover, alt }: { photo: Photo; cover: BookAtHomeCover; alt: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  useEffect(() => {
    const el = box.current;
    if (!el || !photo.cover) return;
    const ro = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / PHOTO_W));
    ro.observe(el);
    return () => ro.disconnect();
  }, [photo.cover]);
  // A plate is a blank book: never show it without the cover on it.
  const ready = !photo.cover || scale > 0;
  const clip = photo.cover && `polygon(${photo.cover.map(([x, y]) => `${(x / PHOTO_W) * 100}% ${(y / PHOTO_H) * 100}%`).join(",")})`;

  return (
    <div ref={box} className="relative aspect-[3/4] w-full overflow-hidden rounded-lg bg-create-neutral">
      <Image
        src={photo.src}
        alt={alt}
        fill
        sizes="(min-width: 640px) 180px, 62vw"
        loading="lazy"
        className={`object-cover transition-opacity duration-300 ${ready ? "opacity-100" : "opacity-0"}`}
      />
      {photo.cover && scale > 0 && (
        // The photo's own pixel space, scaled to the box.
        <div
          aria-hidden
          data-testid="own-cover"
          className="pointer-events-none absolute left-0 top-0 origin-top-left"
          style={{ width: PHOTO_W, height: PHOTO_H, transform: `scale(${scale})` }}
        >
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
          </div>
        </div>
      )}
      {photo.cover && scale > 0 && (
        // The plate multiplied back over the cover only: its light, shading, hinge groove and board edges.
        // Brightened so the white cover maps to ~1 and only the shading darkens the art. Kept outside the scaled
        // layer (clip in %): inside it Chromium draws a seam at the clip's bounding box.
        // eslint-disable-next-line @next/next/no-img-element -- same file as the photo above
        <img
          src={photo.src}
          alt=""
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full mix-blend-multiply"
          style={{ clipPath: clip, filter: "brightness(1.12)" }}
        />
      )}
    </div>
  );
}
