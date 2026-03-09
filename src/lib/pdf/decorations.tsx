/**
 * Decorative SVG elements for PDF book pages.
 * Ornamental dividers, corner flourishes, and page borders.
 */

import { Svg, Path, Circle, G } from "@react-pdf/renderer";

// ── Ornamental Divider ─────────────────────────────────────────────────────
// A symmetric floral/scroll divider for between sections

export function OrnamentalDivider({
  color = "#D4AF37",
  width = 120,
}: {
  color?: string;
  width?: number;
}) {
  const h = width * 0.15;
  return (
    <Svg viewBox="0 0 200 30" style={{ width, height: h }}>
      {/* Center diamond */}
      <Path
        d="M100 5 L107 15 L100 25 L93 15 Z"
        fill={color}
        opacity={0.8}
      />
      {/* Left scroll */}
      <Path
        d="M90 15 Q70 5 50 15 Q30 25 10 15"
        stroke={color}
        strokeWidth={1.5}
        fill="none"
        opacity={0.6}
      />
      <Path
        d="M85 15 Q70 8 55 15"
        stroke={color}
        strokeWidth={1}
        fill="none"
        opacity={0.4}
      />
      {/* Right scroll */}
      <Path
        d="M110 15 Q130 5 150 15 Q170 25 190 15"
        stroke={color}
        strokeWidth={1.5}
        fill="none"
        opacity={0.6}
      />
      <Path
        d="M115 15 Q130 8 145 15"
        stroke={color}
        strokeWidth={1}
        fill="none"
        opacity={0.4}
      />
      {/* End dots */}
      <Circle cx={8} cy={15} r={2} fill={color} opacity={0.5} />
      <Circle cx={192} cy={15} r={2} fill={color} opacity={0.5} />
    </Svg>
  );
}

// ── Corner Flourish ────────────────────────────────────────────────────────
// A delicate corner decoration for page frames

export function CornerFlourish({
  color = "#E6C9A8",
  size = 40,
  rotation = 0,
}: {
  color?: string;
  size?: number;
  rotation?: number;
}) {
  return (
    <Svg
      viewBox="0 0 50 50"
      style={{
        width: size,
        height: size,
        transform: `rotate(${rotation}deg)`,
      }}
    >
      <Path
        d="M5 5 Q5 25 25 25 Q25 5 45 5"
        stroke={color}
        strokeWidth={1.2}
        fill="none"
        opacity={0.5}
      />
      <Path
        d="M5 5 Q15 15 25 25"
        stroke={color}
        strokeWidth={0.8}
        fill="none"
        opacity={0.3}
      />
      <Circle cx={5} cy={5} r={2.5} fill={color} opacity={0.6} />
      <Circle cx={25} cy={25} r={1.5} fill={color} opacity={0.4} />
    </Svg>
  );
}

// ── Star cluster ───────────────────────────────────────────────────────────
// Small decorative star pattern

export function StarCluster({
  color = "#D4AF37",
  size = 30,
}: {
  color?: string;
  size?: number;
}) {
  return (
    <Svg viewBox="0 0 40 40" style={{ width: size, height: size }}>
      <G opacity={0.6}>
        {/* Main star */}
        <Path
          d="M20 8 L22 16 L30 16 L24 20 L26 28 L20 24 L14 28 L16 20 L10 16 L18 16 Z"
          fill={color}
        />
      </G>
      <G opacity={0.3}>
        {/* Small stars */}
        <Circle cx={6} cy={10} r={1.5} fill={color} />
        <Circle cx={34} cy={12} r={1} fill={color} />
        <Circle cx={8} cy={32} r={1.2} fill={color} />
        <Circle cx={32} cy={30} r={1.8} fill={color} />
      </G>
    </Svg>
  );
}

// ── Page frame border ──────────────────────────────────────────────────────
// Elegant thin border with rounded inner corners

export function PageFrameBorder({
  color = "#E6C9A8",
  width,
  height,
  inset = 30,
}: {
  color?: string;
  width: number;
  height: number;
  inset?: number;
}) {
  const x = inset;
  const y = inset;
  const w = width - inset * 2;
  const h = height - inset * 2;
  const r = 6;

  return (
    <Svg
      viewBox={`0 0 ${width} ${height}`}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width,
        height,
      }}
    >
      <Path
        d={`M${x + r} ${y} L${x + w - r} ${y} Q${x + w} ${y} ${x + w} ${y + r} L${x + w} ${y + h - r} Q${x + w} ${y + h} ${x + w - r} ${y + h} L${x + r} ${y + h} Q${x} ${y + h} ${x} ${y + h - r} L${x} ${y + r} Q${x} ${y} ${x + r} ${y} Z`}
        stroke={color}
        strokeWidth={0.75}
        fill="none"
        opacity={0.4}
      />
    </Svg>
  );
}

// ── Wavy dots (3 dots in a row — matches web WavyDots component) ─────────

export function WavyDots({
  color = "#E6C9A8",
  size = 4,
}: {
  color?: string;
  size?: number;
}) {
  const w = size * 5;
  const h = size;
  return (
    <Svg viewBox="0 0 30 6" style={{ width: w, height: h }}>
      <Circle cx={5} cy={3} r={2} fill={color} opacity={0.4} />
      <Circle cx={15} cy={3} r={2} fill={color} opacity={0.6} />
      <Circle cx={25} cy={3} r={2} fill={color} opacity={0.4} />
    </Svg>
  );
}

// ── Wavy line ──────────────────────────────────────────────────────────────

export function WavyLine({
  color = "#E6C9A8",
  width = 80,
}: {
  color?: string;
  width?: number;
}) {
  const h = width * 0.075;
  return (
    <Svg viewBox="0 0 100 8" style={{ width, height: h }}>
      <Path
        d="M0 4 Q12.5 0 25 4 T50 4 T75 4 T100 4"
        stroke={color}
        strokeWidth={1}
        fill="none"
        opacity={0.5}
      />
    </Svg>
  );
}
