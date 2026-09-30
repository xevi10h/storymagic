/**
 * The book's ornaments for the screen — SVG twins of src/lib/pdf/decorations.tsx (and the
 * trait icons of book-template.tsx AboutReaderPage): same view boxes, paths and opacities.
 * Sizes are in pt and rendered in container units (BookPrintPage `u`).
 */

import { BOOK } from "@/lib/book/print-spec";

const u = (pt: number) => `${((pt * 100) / BOOK.trimWidth).toFixed(4)}cqi`;

export function OrnamentalDivider({ color = "#D4AF37", width = 120 }: { color?: string; width?: number }) {
  return (
    <svg viewBox="0 0 200 30" style={{ width: u(width), height: u(width * 0.15), display: "block" }} aria-hidden>
      <path d="M100 5 L107 15 L100 25 L93 15 Z" fill={color} opacity={0.8} />
      <path d="M90 15 Q70 5 50 15 Q30 25 10 15" stroke={color} strokeWidth={1.5} fill="none" opacity={0.6} />
      <path d="M85 15 Q70 8 55 15" stroke={color} strokeWidth={1} fill="none" opacity={0.4} />
      <path d="M110 15 Q130 5 150 15 Q170 25 190 15" stroke={color} strokeWidth={1.5} fill="none" opacity={0.6} />
      <path d="M115 15 Q130 8 145 15" stroke={color} strokeWidth={1} fill="none" opacity={0.4} />
      <circle cx={8} cy={15} r={2} fill={color} opacity={0.5} />
      <circle cx={192} cy={15} r={2} fill={color} opacity={0.5} />
    </svg>
  );
}

export function StarCluster({ color = "#D4AF37", size = 30 }: { color?: string; size?: number }) {
  return (
    <svg viewBox="0 0 40 40" style={{ width: u(size), height: u(size), display: "block" }} aria-hidden>
      <g opacity={0.6}>
        <path d="M20 8 L22 16 L30 16 L24 20 L26 28 L20 24 L14 28 L16 20 L10 16 L18 16 Z" fill={color} />
      </g>
      <g opacity={0.3}>
        <circle cx={6} cy={10} r={1.5} fill={color} />
        <circle cx={34} cy={12} r={1} fill={color} />
        <circle cx={8} cy={32} r={1.2} fill={color} />
        <circle cx={32} cy={30} r={1.8} fill={color} />
      </g>
    </svg>
  );
}

export function WavyDots({ color = "#E6C9A8", size = 4 }: { color?: string; size?: number }) {
  return (
    <svg viewBox="0 0 30 6" style={{ width: u(size * 5), height: u(size), display: "block" }} aria-hidden>
      <circle cx={5} cy={3} r={2} fill={color} opacity={0.4} />
      <circle cx={15} cy={3} r={2} fill={color} opacity={0.6} />
      <circle cx={25} cy={3} r={2} fill={color} opacity={0.4} />
    </svg>
  );
}

export function HeartIcon({ color = "#D4AF37", size = 10, opacity = 1 }: { color?: string; size?: number; opacity?: number }) {
  return (
    <svg viewBox="0 0 24 24" style={{ width: u(size), height: u(size), display: "block" }} aria-hidden>
      <path
        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
        fill={color}
        opacity={opacity}
      />
    </svg>
  );
}

export function PetsIcon({ color, size }: { color: string; size: number }) {
  return (
    <svg viewBox="0 0 24 24" style={{ width: u(size), height: u(size), display: "block", flexShrink: 0 }} aria-hidden>
      <circle cx="4.5" cy="9.5" r="2.5" fill={color} />
      <circle cx="9" cy="5.5" r="2.5" fill={color} />
      <circle cx="15" cy="5.5" r="2.5" fill={color} />
      <circle cx="19.5" cy="9.5" r="2.5" fill={color} />
      <path d="M17.34 14.86c-.87-1.02-1.6-1.89-2.48-2.91-.46-.54-1.17-.86-1.86-.86-.69 0-1.39.32-1.85.86-.87 1.02-1.61 1.89-2.48 2.91-1.31 1.31-2.92 2.76-2.62 4.79.29 1.02 1.02 2.0 2.09 2.35.75.29 1.57.0 2.36-.23.56-.16 1.14-.34 1.64-.34.49 0 1.09.19 1.65.35.79.23 1.61.52 2.36.23 1.07-.35 1.8-1.32 2.09-2.35.3-2.03-1.31-3.48-2.62-4.79z" fill={color} />
    </svg>
  );
}

export function PaletteIcon({ color, size }: { color: string; size: number }) {
  return (
    <svg viewBox="0 0 24 24" style={{ width: u(size), height: u(size), display: "block", flexShrink: 0 }} aria-hidden>
      <path d="M12 2C6.49 2 2 6.49 2 12s4.49 10 10 10c1.38 0 2.5-1.12 2.5-2.5 0-.61-.23-1.2-.64-1.67-.08-.1-.13-.21-.13-.33 0-.28.22-.5.5-.5H16c3.31 0 6-2.69 6-6 0-4.96-4.49-9-10-9zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 8 6.5 8 8 8.67 8 9.5 7.33 11 6.5 11zm3-4C8.67 7 8 6.33 8 5.5S8.67 4 9.5 4s1.5.67 1.5 1.5S10.33 7 9.5 7zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 4 14.5 4s1.5.67 1.5 1.5S15.33 7 14.5 7zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 8 17.5 8s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" fill={color} />
    </svg>
  );
}
