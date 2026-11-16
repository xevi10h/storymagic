"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";

// AI-recreated scenes of the sample book "Noa y la llave de flor" (hardcover), made with the production
// image model from the real cover and real inside pages (2026-11-16). The caption saying so stays visible:
// they are not photos of a real delivery (AI Act art. 50, no misleading product claims).
const PHOTOS = [
  { src: "/images/purchase/home-table.webp", alt: "altTable" },
  { src: "/images/purchase/home-open.webp", alt: "altOpen" },
  { src: "/images/purchase/home-gift.webp", alt: "altGift" },
] as const;

export function BookAtHomePhotos({ className = "" }: { className?: string }) {
  const t = useTranslations("crear.purchase.atHome");
  return (
    <section className={className} data-testid="book-at-home" aria-labelledby="book-at-home-title">
      <p id="book-at-home-title" className="mb-1.5 text-xs font-bold uppercase tracking-wide text-create-text-sub">
        {t("title")}
      </p>
      <ul className="no-scrollbar -mx-5 flex snap-x snap-mandatory scroll-px-5 gap-2 overflow-x-auto px-5 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
        {PHOTOS.map((p) => (
          <li key={p.src} className="w-[62%] shrink-0 snap-start sm:w-auto">
            <Image
              src={p.src}
              alt={t(p.alt)}
              width={720}
              height={960}
              sizes="(min-width: 640px) 180px, 62vw"
              loading="lazy"
              className="aspect-[3/4] w-full rounded-lg bg-create-neutral object-cover"
            />
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-[11.5px] leading-snug text-create-text-sub">{t("caption")}</p>
    </section>
  );
}
