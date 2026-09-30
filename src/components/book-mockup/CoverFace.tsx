import { coverLockup } from "./cover-title";
import s from "./book-mockup.module.css";

export interface CoverFaceProps {
  /** Cover art (square). `null` paints the theme colour instead. */
  imageUrl: string | null;
  title: string;
  childName: string;
  /** Shown under a title that does not name the child, e.g. "Una historia personalizada para" */
  subtitle?: string;
  /** Background when there is no art (theme `gradientStart`) */
  fallbackColor: string;
  priority?: boolean;
}

/**
 * Flat front cover, as printed (src/lib/pdf/cover-art.tsx FrontCoverDesign): full-bleed art,
 * a top scrim with the print gradient stops, and the title lockup at the top — the child's
 * name large, the rest of the title around it. Sized in cqw of its own box, so it renders
 * identically on a 3D board, a tablet screen or a phone.
 */
export function CoverFace({ imageUrl, title, childName, subtitle, fallbackColor, priority }: CoverFaceProps) {
  const lockup = coverLockup(title, childName);
  return (
    <div className={s.coverFace} style={{ backgroundColor: fallbackColor }}>
      {imageUrl ? (
        // Plain <img>: children's art comes from signed URLs that must not go through the optimizer
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          className={s.coverImg}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          decoding="async"
          draggable={false}
        />
      ) : (
        <div className={s.coverFallback} />
      )}
      <div className={s.coverScrim} />
      <div className={s.coverTitle}>
        {lockup.kind === "split" ? (
          <>
            {lockup.split.pre && (
              <p className={s.coverRest} style={{ fontSize: `${lockup.restCqw}cqw` }}>{lockup.split.pre}</p>
            )}
            <p className={s.coverHero} style={{ fontSize: `${lockup.heroCqw}cqw` }}>{lockup.split.hero}</p>
            {lockup.split.post && (
              <p className={s.coverRest} style={{ fontSize: `${lockup.restCqw}cqw` }}>{lockup.split.post}</p>
            )}
          </>
        ) : (
          <>
            <p className={s.coverRest} style={{ fontSize: `${lockup.sizeCqw}cqw` }}>{title}</p>
            {subtitle && childName && (
              <p className={s.coverSubtitle}>
                {subtitle}{subtitle.endsWith("'") ? "" : " "}<strong>{childName}</strong>
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
