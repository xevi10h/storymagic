"use client";

import { useEffect, useRef, useId } from "react";

interface WritingAnimationProps {
  onComplete?: () => void;
  className?: string;
  /** Total animation duration in ms (default 2552) */
  duration?: number;
}

// ─── Stroke paths ────────────────────────────────────────────────────────────
//
// ViewBox: 0 0 1013 255
// baseline y=200  |  x-height y=108  |  cap y=38  |  descender y=250
// strokeWidth=28, round linecap/join
//
// All curves use proper bezier ellipse control points (k=0.5523):
//   ellipse center cy=154, ry=46  →  k·ry ≈ 25
//   rx=59–60                      →  k·rx ≈ 33
//
// Letter x-ranges:
//   M  55-207   e  235-352   a  364-482   p  496-616
//   i  628-672  c  684-802   a  814-932

const STROKES = [
  // ── M ──────────────────────────────────────────────────────────────────────
  // left leg straight down
  { d: "M 55,38 L 55,200",                                                                  t: 0,    dt: 120 },
  // from top-left: arc to deep valley then back up to top-right → right leg down
  { d: "M 55,38 Q 93,158 131,158 Q 169,158 207,38 L 207,200",                              t: 120,  dt: 305 },

  // ── e ──────────────────────────────────────────────────────────────────────
  // crossbar right→left, then sweep CCW: up → right → down, ending open
  { d: "M 348,140 L 235,140 C 234,108 258,108 292,108 C 325,108 352,129 352,154 C 352,179 325,200 292,200 C 258,200 235,190 235,174",
                                                                                             t: 455,  dt: 320 },

  // ── a ──────────────────────────────────────────────────────────────────────
  // bowl: top → left → bottom → right-center (3/4 CCW ellipse)
  { d: "M 423,108 C 390,108 364,129 364,154 C 364,179 390,200 423,200 C 456,200 482,179 482,154",
                                                                                             t: 805,  dt: 295 },
  // right stem
  { d: "M 482,108 L 482,200",                                                               t: 1100, dt: 80  },

  // ── p ──────────────────────────────────────────────────────────────────────
  // stem: x-height top down to descender
  { d: "M 496,108 L 496,250",                                                               t: 1200, dt: 130 },
  // D-bowl: top-left → top → right → bottom → back left (CW half-ellipse)
  { d: "M 496,108 C 556,108 616,129 616,154 C 616,179 556,200 496,200",                    t: 1330, dt: 300 },

  // ── i ──────────────────────────────────────────────────────────────────────
  // dot: two-arc circle above x-height
  { d: "M 638,72 C 638,60 662,60 662,72 C 662,84 638,84 638,72",                           t: 1660, dt: 65  },
  // stem
  { d: "M 650,108 L 650,200",                                                               t: 1725, dt: 92  },

  // ── c ──────────────────────────────────────────────────────────────────────
  // arc: upper-right → top → left → bottom → lower-right (open at right)
  { d: "M 800,128 C 800,108 772,108 743,108 C 714,108 684,129 684,154 C 684,179 714,200 743,200 C 772,200 800,175 800,175",
                                                                                             t: 1847, dt: 300 },

  // ── a (second) ─────────────────────────────────────────────────────────────
  // bowl: top → left → bottom → right-center (3/4 CCW ellipse)
  { d: "M 873,108 C 840,108 814,129 814,154 C 814,179 840,200 873,200 C 906,200 932,179 932,154",
                                                                                             t: 2177, dt: 295 },
  // right stem
  { d: "M 932,108 L 932,200",                                                               t: 2472, dt: 80  },
] as const;

const BASE_DURATION = 2552; // 2472 + 80

// ─── Component ───────────────────────────────────────────────────────────────

export default function WritingAnimation({
  onComplete,
  className = "h-10 text-secondary",
  duration = BASE_DURATION,
}: WritingAnimationProps) {
  const svgRef  = useRef<SVGSVGElement>(null);
  const uid     = useId().replace(/:/g, "");
  const scale   = duration / BASE_DURATION;
  const cbRef   = useRef(onComplete);
  cbRef.current = onComplete;

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const paths = Array.from(svg.querySelectorAll<SVGPathElement>("path[data-s]"));

    // ① Freeze all paths invisible (reset any residual transitions first)
    paths.forEach((p) => {
      const len = p.getTotalLength();
      p.style.transition       = "none";
      p.style.strokeDasharray  = `${len}`;
      p.style.strokeDashoffset = `${len}`;
    });

    // ② Double-rAF: let browser commit the hidden state, then start transitions
    let r1: number, r2: number;
    r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => {
        paths.forEach((p, i) => {
          const { t, dt } = STROKES[i];
          p.style.transition       = `stroke-dashoffset ${dt * scale}ms cubic-bezier(0.4,0,0.2,1) ${t * scale}ms`;
          p.style.strokeDashoffset = "0";
        });
      });
    });

    const tid = setTimeout(() => cbRef.current?.(), duration + 200);

    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
      clearTimeout(tid);
    };
  }, [scale, duration]);

  // Pen-nib cursor glides left→right over the full duration
  const nibKey = `wa-nib-${uid}`;

  return (
    <>
      <style>{`
        @keyframes ${nibKey} {
          0%   { transform: translate(0px,0px);   opacity: 1; }
          96%  { opacity: 1; }
          100% { transform: translate(877px,0px); opacity: 0; }
        }
      `}</style>

      <svg
        ref={svgRef}
        viewBox="0 0 1013 255"
        fill="none"
        stroke="currentColor"
        strokeWidth={28}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-label="Meapica"
        role="img"
        className={`w-auto ${className}`}
      >
        {STROKES.map((s, i) => (
          <path key={i} data-s={i} d={s.d} />
        ))}

        {/* Quill-nib cursor at the leading edge */}
        <g
          style={{
            animation: `${nibKey} ${duration}ms cubic-bezier(0.4,0,0.2,1) forwards`,
            transformOrigin: "55px 38px",
          }}
        >
          <path d="M 55,22 L 70,36 L 52,46 Z" fill="currentColor" stroke="none" opacity="0.65" />
          <circle cx="50" cy="49" r="3.5" fill="currentColor" opacity="0.3" />
        </g>
      </svg>
    </>
  );
}
