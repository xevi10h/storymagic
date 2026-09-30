import BrandLogo from "@/components/BrandLogo";
import s from "./book-mockup.module.css";

export interface BackCoverSource {
  /** Closing illustration (or the cover art until it exists) shown in the arch vignette */
  imageUrl: string | null;
  synopsis: string;
  /** "Una historia personalizada para" — the name follows in the accent colour */
  subtitle: string;
  /** Theme colours (getBookColors): title, name accent, hairlines / ornament */
  titleColor: string;
  accentColor: string;
  ornamentColor: string;
}

/**
 * Back cover as printed (src/lib/pdf/cover-art.tsx BackCoverDesign), simplified for the
 * mockup: cream paper, an arch-window vignette of the closing art, title, "for {name}",
 * ornament, synopsis and the brand signature. Sized in cqw of its own box.
 */
export function BackCoverFace({ back, title, childName }: { back: BackCoverSource; title: string; childName: string }) {
  return (
    <div className={s.backFace} style={{ "--bc-title": back.titleColor, "--bc-accent": back.accentColor, "--bc-ornament": back.ornamentColor } as React.CSSProperties}>
      <div className={s.backColumn}>
        {back.imageUrl && (
          <div className={s.backVignette}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={back.imageUrl} alt="" loading="lazy" decoding="async" draggable={false} />
          </div>
        )}
        <p className={s.backTitle}>{title}</p>
        <p className={s.backFor}>
          {back.subtitle}
          {back.subtitle.endsWith("'") ? "" : " "}
          <strong>{childName}</strong>
        </p>
        <svg className={s.backOrnament} viewBox="0 0 200 30" aria-hidden>
          <path d="M100 5 L107 15 L100 25 L93 15 Z" fill="currentColor" opacity="0.8" />
          <path d="M90 15 Q70 5 50 15 Q30 25 10 15" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.6" />
          <path d="M110 15 Q130 5 150 15 Q170 25 190 15" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.6" />
        </svg>
        <p className={s.backSynopsis}>&ldquo;{back.synopsis}&rdquo;</p>
      </div>
      <div className={s.backBrand}>
        <BrandLogo className={s.backLogo} />
        <span>meapica.com</span>
      </div>
    </div>
  );
}
