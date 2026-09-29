import type { ReactElement } from "react";
import type { BookColors } from "@/lib/template-colors";

/**
 * Meapica endpaper — web twin of the printed EndpaperPage (src/lib/pdf/book-template.tsx):
 * light paper in the theme's tint with a gently scattered half-drop lattice of sparkles,
 * crescent moons, small stars and dots in solid inks mixed toward the ground.
 *
 * Replicated (not imported) because book-template.tsx is a @react-pdf module that cannot
 * ship to the browser. Same page geometry (208 mm bleed page, in pt), same deterministic
 * hash, same inks — keep the two in step when the print pattern changes.
 */

const MM_TO_PT = 72 / 25.4;
const W = 208 * MM_TO_PT;
const H = 208 * MM_TO_PT;
const GOLD = "#D4AF37";
const BLEED = 4 * MM_TO_PT; // the viewer shows the trimmed page
const STEP = 50; // half-drop lattice: neighbours ≈ 35 pt (12 mm) apart

/** Solid mix of two #rrggbb colours (t = 0 → a, 1 → b). */
function mixHex(a: string, b: string, t: number): string {
  const parse = (h: string) => {
    const n = /^#[0-9a-f]{6}$/i.test(h) ? parseInt(h.slice(1), 16) : 0xfdf8f0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const [x, y] = [parse(a), parse(b)];
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
}

function hash(r: number, c: number, salt: number): number {
  let h = (Math.imul(r, 374761393) + Math.imul(c, 668265263) + Math.imul(salt, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Crescent: outer circle minus an offset inner one (opening to the upper right). */
function moon(x: number, y: number, R: number): string {
  const r2 = R * 0.85;
  const [dx, dy] = [R * 0.45, -R * 0.35];
  const d = Math.hypot(dx, dy);
  const [ux, uy] = [dx / d, dy / d];
  const a = (R * R - r2 * r2 + d * d) / (2 * d);
  const h = Math.sqrt(R * R - a * a);
  const p1 = [x + a * ux - h * uy, y + a * uy + h * ux].map((v) => v.toFixed(2)).join(" ");
  const p2 = [x + a * ux + h * uy, y + a * uy - h * ux].map((v) => v.toFixed(2)).join(" ");
  return `M${p1} A${R} ${R} 0 1 1 ${p2} A${r2} ${r2} 0 0 0 ${p1} Z`;
}

export default function EndpaperPattern({ colors, offsetX = 0 }: { colors: BookColors; offsetX?: number }) {
  const ground = mixHex(colors.pageTint, colors.accentLight, 0.7);
  const ink = {
    sparkle: mixHex(ground, colors.ornamentColor, 0.85),
    moon: mixHex(ground, colors.accent, 0.38),
    star: mixHex(ground, GOLD, 0.62),
    dot: mixHex(ground, colors.ornamentColor, 0.6),
  };
  const first = Math.floor(offsetX / STEP) - 1;
  const cols = Math.ceil(W / STEP) + 3;
  const rows = Math.ceil(H / (STEP / 2)) + 2;
  const marks: ReactElement[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = first; c < first + cols; c++) {
      const x = c * STEP + (r % 2 ? STEP / 2 : 0) - offsetX + (hash(r, c, 1) - 0.5) * 7;
      const y = r * (STEP / 2) - 8 + (hash(r, c, 2) - 0.5) * 7;
      if (x < -10 || x > W + 10) continue;
      const key = `${r}:${c}`;
      const pick = hash(r, c, 3);
      if (pick < 0.34) {
        const k = 4.2;
        marks.push(<path key={key} d={`M${x} ${y - k} Q${x} ${y} ${x + k} ${y} Q${x} ${y} ${x} ${y + k} Q${x} ${y} ${x - k} ${y} Q${x} ${y} ${x} ${y - k} Z`} fill={ink.sparkle} />);
      } else if (pick < 0.5) {
        marks.push(<path key={key} d={moon(x, y, 3.9)} fill={ink.moon} />);
      } else if (pick < 0.78) {
        const o = 2.5;
        const pts = Array.from({ length: 10 }, (_, i) => {
          const ang = (Math.PI / 5) * i - Math.PI / 2;
          const rr = i % 2 ? o * 0.45 : o;
          return `${(x + rr * Math.cos(ang)).toFixed(2)} ${(y + rr * Math.sin(ang)).toFixed(2)}`;
        });
        marks.push(<path key={key} d={`M${pts.join(" L")} Z`} fill={ink.star} />);
      } else {
        marks.push(<circle key={key} cx={x} cy={y} r={1.2} fill={ink.dot} />);
      }
    }
  }
  return (
    <div className="absolute inset-0" style={{ backgroundColor: ground }} aria-hidden>
      <svg className="absolute inset-0 h-full w-full" viewBox={`${BLEED} ${BLEED} ${W - 2 * BLEED} ${H - 2 * BLEED}`} preserveAspectRatio="xMidYMid slice">
        {marks}
      </svg>
    </div>
  );
}
