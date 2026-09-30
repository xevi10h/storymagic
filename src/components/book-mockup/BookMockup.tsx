"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Book3D } from "./Book3D";
import { OpenBook, type SpreadSource } from "./OpenBook";
import { DeviceMockup } from "./DeviceMockup";
import type { BackCoverSource } from "./BackCoverFace";
import { useDragRotate } from "./useDragRotate";
import s from "./book-mockup.module.css";

export type BookMockupFormat = "hardcover" | "softcover" | "pdf";
type PhysicalFormat = Exclude<BookMockupFormat, "pdf">;

export interface BookMockupProps {
  /** Front-cover art URL (square). `null` shows the theme colour. */
  coverUrl: string | null;
  /** Full book title, e.g. "Teo y el Viaje a las Estrellas" */
  title: string;
  /** Child's name — set large on the cover when the title contains it */
  childName: string;
  /** Selected format; changing it animates the mockup */
  format: BookMockupFormat;
  /** Accessible description of the whole mockup (it is exposed as one image) */
  alt: string;
  /** "closed" (default) or "open" — the open book needs `spread` */
  variant?: "closed" | "open";
  /** Interior spread for the open variant (also shown on the phone for "pdf") */
  spread?: SpreadSource;
  /** Line under a title that does not contain the name: "Una historia personalizada para" */
  subtitle?: string;
  /** Spine / board colour — pass getBookColors(templateId, gender, favoriteColor).gradientStart */
  spineColor?: string;
  /** Closed-book angle: "spine" shows the spine title, "pages" shows the fore-edge */
  pose?: "spine" | "pages";
  /** Dimension lines on the closed physical book (default true) */
  showScale?: boolean;
  /** Label on each dimension line (default "20 cm") */
  scaleLabel?: string;
  /** Pointer-follow tilt on devices with a fine pointer (default true; off with reduced motion) */
  interactive?: boolean;
  /** Load the cover eagerly with high priority (above the fold) */
  priority?: boolean;
  /**
   * Drag (touch or mouse) turns the closed book round — spine, page block, back cover —
   * with inertia, then it settles back. Vertical swipes still scroll the page.
   */
  rotatable?: boolean;
  /** One-time hint shown on a rotatable book until the first drag, e.g. "Gíralo" */
  rotateLabel?: string;
  /** The printed back cover (seen when turned round); without it the board is plain */
  back?: BackCoverSource;
  className?: string;
}

const DEFAULT_SPINE = "#3e2a20";

function phonePageFor(spread: SpreadSource | undefined): ReactNode | undefined {
  if (!spread) return undefined;
  const src = "panorama" in spread ? spread.panorama : spread.right;
  if (typeof src !== "string") return src;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className={"panorama" in spread ? `${s.pageImg} ${s.pagePanorama}` : s.pageImg}
      data-side="right"
      loading="lazy"
      decoding="async"
      draggable={false}
    />
  );
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Photographic mockup of the physical book (CSS 3D, no WebGL) for the preview → purchase
 * screen: hardcover / softcover closed or open, or the PDF on a tablet + phone.
 * The stage has a fixed 5:4 aspect box, so switching format or variant never shifts layout.
 */
export function BookMockup({
  coverUrl,
  title,
  childName,
  format,
  alt,
  variant = "closed",
  spread,
  subtitle,
  spineColor = DEFAULT_SPINE,
  pose = "spine",
  showScale = true,
  scaleLabel = "20 cm",
  interactive = true,
  priority = false,
  rotatable = false,
  rotateLabel,
  back,
  className,
}: BookMockupProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const nudgeRef = useRef<HTMLDivElement>(null);
  const spinRef = useRef<HTMLDivElement>(null);

  // The physical model keeps its last physical format while the PDF devices are shown,
  // so it does not morph as it fades out.
  const [physical, setPhysical] = useState<PhysicalFormat>(format === "pdf" ? "hardcover" : format);
  if (format !== "pdf" && format !== physical) setPhysical(format);

  const isDigital = format === "pdf";
  // Devices mount the first time the PDF format is picked (no tablet/phone images before that)
  // and then stay mounted, so switching back fades them out instead of cutting.
  const [digitalSeen, setDigitalSeen] = useState(isDigital);
  if (isDigital && !digitalSeen) setDigitalSeen(true);
  const open = variant === "open" && !!spread;
  const canRotate = rotatable && !open && !isDigital;
  const { hintVisible } = useDragRotate({
    stageRef,
    spinRef,
    enabled: canRotate,
    restYaw: pose === "pages" ? -29 : 31,
    hint: !!rotateLabel,
  });

  // Hardcover ↔ softcover: a short lift-and-turn so the change of thickness reads.
  // Compared with the previous value (not a first-render flag) so StrictMode's double effect
  // run in development does not play it on mount.
  const shownPhysical = useRef(physical);
  useEffect(() => {
    if (shownPhysical.current === physical) return;
    shownPhysical.current = physical;
    const el = nudgeRef.current;
    if (!el || prefersReducedMotion() || typeof el.animate !== "function") return;
    el.animate(
      [
        { transform: "translateY(0) rotateY(0deg) rotateX(0deg)" },
        { transform: "translateY(-2cqw) rotateY(-9deg) rotateX(4deg)", offset: 0.45 },
        { transform: "translateY(0) rotateY(0deg) rotateX(0deg)" },
      ],
      { duration: 900, easing: "cubic-bezier(.3,.7,.2,1)" },
    );
  }, [physical]);

  // Pointer-follow tilt (mouse / trackpad only — touch keeps scrolling the page).
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !interactive) return;
    if (prefersReducedMotion() || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    let frame = 0;
    const set = (x: number, y: number) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        stage.style.setProperty("--tilt-y", `${(x * 14).toFixed(2)}deg`);
        stage.style.setProperty("--tilt-x", `${(-y * 7).toFixed(2)}deg`);
      });
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || stage.dataset.interacting === "true") return;
      const r = stage.getBoundingClientRect();
      set((e.clientX - r.left) / r.width - 0.5, (e.clientY - r.top) / r.height - 0.5);
    };
    const onLeave = () => set(0, 0);
    stage.addEventListener("pointermove", onMove);
    stage.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(frame);
      stage.removeEventListener("pointermove", onMove);
      stage.removeEventListener("pointerleave", onLeave);
    };
  }, [interactive]);

  const cover = { imageUrl: coverUrl, title, childName, subtitle, fallbackColor: spineColor, priority };

  return (
    <div
      ref={stageRef}
      className={className ? `${s.stage} ${className}` : s.stage}
      data-format={physical}
      data-digital={isDigital}
      data-variant={open ? "open" : "closed"}
      data-pose={pose}
      data-rotatable={canRotate}
      role="img"
      aria-label={alt}
    >
      <div className={s.backdrop} />

      <div className={s.layer} data-active={!isDigital}>
        <div className={s.camera}>
          <div ref={nudgeRef} className={s.nudge}>
            <div ref={spinRef} className={s.spin}>
              <div className={s.sway}>
                {open ? (
                  <OpenBook spread={spread!} spineColor={spineColor} />
                ) : (
                  <Book3D
                    {...cover}
                    spineColor={spineColor}
                    spineTitle={physical === "hardcover"}
                    showScale={showScale}
                    scaleLabel={scaleLabel}
                    back={back}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={s.layer} data-active={isDigital}>
        {digitalSeen && <DeviceMockup cover={cover} phonePage={phonePageFor(spread)} />}
      </div>

      {rotateLabel && (
        <span aria-hidden className={s.rotateHint} data-hidden={!(canRotate && hintVisible)} data-testid="mockup-rotate-hint">
          <span className={`material-symbols-outlined ${s.rotateHintIcon}`}>360</span>
          {rotateLabel}
        </span>
      )}
    </div>
  );
}
