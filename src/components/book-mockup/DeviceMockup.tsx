import type { ReactNode } from "react";
import { CoverFace, type CoverFaceProps } from "./CoverFace";
import s from "./book-mockup.module.css";

/**
 * Digital (PDF) format: the cover on a tablet, with a phone in front showing an inner page
 * (or the cover again when no page is given) — "read it on any screen".
 */
export function DeviceMockup({ cover, phonePage }: { cover: CoverFaceProps; phonePage?: ReactNode }) {
  return (
    <div className={s.devices}>
      <div className={s.deviceShadowTablet} />
      <div className={s.deviceShadowPhone} />
      <div className={s.tablet}>
        <div className={s.tabletEdge} />
        <div className={s.tabletBody}>
          <div className={s.tabletScreen}>
            <div className={s.readerBar} />
            <div className={s.readerPage}>
              <CoverFace {...cover} />
            </div>
            <div className={s.readerProgress}><span /></div>
          </div>
          <div className={s.screenGlass} />
        </div>
      </div>
      <div className={s.phone}>
        <div className={s.phoneEdge} />
        <div className={s.phoneBody}>
          <div className={s.phoneScreen}>
            <div className={s.phonePage}>{phonePage ?? <CoverFace {...cover} priority={false} />}</div>
            <span className={s.phoneIsland} />
          </div>
          <div className={s.screenGlass} />
        </div>
      </div>
    </div>
  );
}
