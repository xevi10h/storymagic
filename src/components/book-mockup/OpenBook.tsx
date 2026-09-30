import type { ReactNode } from "react";
import s from "./book-mockup.module.css";

/** An image URL, or any node rendered inside the square page (e.g. a text page). */
export type PageSource = string | ReactNode;

/** Two facing pages, or one panoramic 2:1 image across both (spread_left / spread_right). */
export type SpreadSource = { left: PageSource; right: PageSource } | { panorama: string };

function PageContent({ source, side, panorama }: { source: PageSource; side: "left" | "right"; panorama?: boolean }) {
  if (typeof source === "string") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={source}
        alt=""
        className={panorama ? `${s.pageImg} ${s.pagePanorama}` : s.pageImg}
        data-side={side}
        loading="lazy"
        decoding="async"
        draggable={false}
      />
    );
  }
  return <div className={s.pageNode}>{source}</div>;
}

function PageHalf({ side, children }: { side: "left" | "right"; children: ReactNode }) {
  return (
    <div className={s.pageHalf} data-side={side}>
      <div className={s.pageFace}>
        {children}
        <div className={s.gutterShade} />
      </div>
      {/* Page-block thickness: front edge and outer (fore) edge of this half */}
      <div className={s.stackFront} />
      <div className={s.stackOuter} />
    </div>
  );
}

/** A book lying open on the table: boards (cover colour) under two gently arched page halves. */
export function OpenBook({ spread, spineColor }: { spread: SpreadSource; spineColor: string }) {
  const panorama = "panorama" in spread;
  const left = panorama ? spread.panorama : spread.left;
  const right = panorama ? spread.panorama : spread.right;
  return (
    <div className={s.openBook}>
      <div className={s.openShadow} />
      <div className={s.openBoards} style={{ backgroundColor: spineColor }} />
      <div className={s.openBoardEdge} style={{ backgroundColor: spineColor }} />
      <PageHalf side="left">
        <PageContent source={left} side="left" panorama={panorama} />
      </PageHalf>
      <PageHalf side="right">
        <PageContent source={right} side="right" panorama={panorama} />
      </PageHalf>
    </div>
  );
}
