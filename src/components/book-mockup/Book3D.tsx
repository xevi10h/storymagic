import BrandLogo from "@/components/BrandLogo";
import { CoverFace, type CoverFaceProps } from "./CoverFace";
import { BackCoverFace, type BackCoverSource } from "./BackCoverFace";
import s from "./book-mockup.module.css";

export interface Book3DProps extends CoverFaceProps {
  /** Spine / board-edge colour (theme `gradientStart`, as printed) */
  spineColor: string;
  /** Hardcover shows the spine title (print skips it on spines under 5 mm, i.e. softcover) */
  spineTitle: boolean;
  showScale: boolean;
  scaleLabel: string;
  /** Printed back cover, seen when the book is turned round (drag-to-rotate) */
  back?: BackCoverSource;
}

/**
 * Closed square book built from CSS 3D planes. Geometry (all from CSS variables set by the
 * stage for the current format): --w/--h board size, --d total thickness, --b board thickness,
 * --oh board overhang past the page block. Faces that point away from the camera are culled
 * with backface-visibility, so the same model serves the "spine" and "pages" poses.
 */
export function Book3D({ spineColor, spineTitle, showScale, scaleLabel, back, ...cover }: Book3DProps) {
  const edge = { backgroundColor: spineColor };
  return (
    <div className={s.book}>
      {/* Shadow on the table */}
      <div className={s.floorShadow} />

      {/* Inside of the back board (endpaper) — only seen through the overhang gaps */}
      <div className={`${s.face} ${s.backInner}`} />

      {/* Outside of the back board — faces away until the book is turned round */}
      <div className={`${s.face} ${s.backCover}`} style={back ? undefined : edge}>
        {back && <BackCoverFace back={back} title={cover.title} childName={cover.childName} />}
        <div className={s.frontLight} />
        <div className={s.frontGrain} />
        <div className={s.hinge} />
      </div>

      {/* Top edge: page block recessed between the two boards */}
      <div className={`${s.face} ${s.topPages}`} />
      <div className={`${s.face} ${s.topBoardFront}`} style={edge} />
      <div className={`${s.face} ${s.topBoardBack}`} style={edge} />

      {/* Fore-edge (right): page block + board edges */}
      <div className={`${s.face} ${s.forePages}`} />
      <div className={`${s.face} ${s.foreBoardFront}`} style={edge} />
      <div className={`${s.face} ${s.foreBoardBack}`} style={edge} />

      {/* Spine */}
      <div className={`${s.face} ${s.spine}`} style={edge}>
        <div className={s.spineShade} />
        <div className={s.spineText} data-visible={spineTitle}>
          <BrandLogo className={s.spineLogo} />
          <span>{cover.title}</span>
        </div>
      </div>

      {/* Front board */}
      <div className={`${s.face} ${s.front}`}>
        <CoverFace {...cover} />
        <div className={s.frontLight} />
        <div className={s.frontGrain} />
        <div className={s.hinge} />
      </div>

      {showScale && (
        <>
          <div className={`${s.dimension} ${s.dimensionH}`} aria-hidden>
            <span className={s.dimLine} />
            <span className={s.dimLabel}>{scaleLabel}</span>
            <span className={s.dimLine} />
          </div>
          <div className={`${s.dimension} ${s.dimensionV}`} aria-hidden>
            <span className={s.dimLine} />
            <span className={s.dimLabel}>{scaleLabel}</span>
            <span className={s.dimLine} />
          </div>
        </>
      )}
    </div>
  );
}
