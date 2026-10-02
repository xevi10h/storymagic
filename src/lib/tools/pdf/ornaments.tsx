// Line ornaments for the Reyes printables: crowns, stars and the Kings' seals.
// Outline-first (light ink on a home printer), drawn as SVG paths, no images.

import { Svg, Path, Circle, G, View, Text } from "@react-pdf/renderer";
import { FONT_FAMILY } from "@/lib/pdf/fonts";

export const INK = {
  ink: "#1b120e",
  soft: "#4a3b32",
  body: "#6b5850",
  muted: "#7a6963",
  deep: "#5D4037",
  brand: "#E86C3A",
  brandText: "#b94f1f",
  gold: "#C9A227",
  warm: "#E6C9A8",
  rule: "#DCC7B3",
} as const;

/** Five-point star path centred on (cx, cy). */
export function starPath(cx: number, cy: number, outer: number, inner = outer * 0.45): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join(" L")} Z`;
}

/** A crown outline in a 24 × 18 box. */
const CROWN = "M2.5 15.5 L1.5 5.5 L7 10 L12 2.5 L17 10 L22.5 5.5 L21.5 15.5 Z";

export function Star({ size = 10, color = INK.gold, filled = true }: { size?: number; color?: string; filled?: boolean }) {
  return (
    <Svg viewBox="0 0 20 20" style={{ width: size, height: size }}>
      <Path d={starPath(10, 10.6, 9.4)} fill={filled ? color : "none"} stroke={color} strokeWidth={filled ? 0 : 1.1} />
    </Svg>
  );
}

/** Three crowns, the centre one taller, under a small guiding star. */
export function ThreeCrowns({ width = 120, color = INK.gold }: { width?: number; color?: string }) {
  return (
    <Svg viewBox="0 0 120 44" style={{ width, height: (width * 44) / 120 }}>
      <Path d={starPath(60, 6, 5.5)} fill={color} />
      <G transform="translate(14 22) scale(0.9)">
        <Path d={CROWN} fill="none" stroke={color} strokeWidth={1.3} strokeLinejoin="round" />
        <Path d="M3 17.5 L21 17.5" stroke={color} strokeWidth={1.3} strokeLinecap="round" />
      </G>
      <G transform="translate(45 14) scale(1.25)">
        <Path d={CROWN} fill="none" stroke={color} strokeWidth={1.1} strokeLinejoin="round" />
        <Path d="M3 17.5 L21 17.5" stroke={color} strokeWidth={1.1} strokeLinecap="round" />
        <Circle cx={12} cy={11.5} r={1.3} fill={color} />
      </G>
      <G transform="translate(84.4 22) scale(0.9)">
        <Path d={CROWN} fill="none" stroke={color} strokeWidth={1.3} strokeLinejoin="round" />
        <Path d="M3 17.5 L21 17.5" stroke={color} strokeWidth={1.3} strokeLinecap="round" />
      </G>
      <Path d="M2 37 L40 37" stroke={color} strokeWidth={0.6} opacity={0.7} />
      <Path d="M80 37 L118 37" stroke={color} strokeWidth={0.6} opacity={0.7} />
      <Path d={starPath(60, 37, 3)} fill={color} opacity={0.85} />
    </Svg>
  );
}

/** A thin rule with a star in the middle. */
export function StarRule({ width = 200, color = INK.gold }: { width?: number; color?: string }) {
  return (
    <Svg viewBox="0 0 200 10" style={{ width, height: (width * 10) / 200 }}>
      <Path d="M0 5 L88 5" stroke={color} strokeWidth={0.7} />
      <Path d="M112 5 L200 5" stroke={color} strokeWidth={0.7} />
      <Path d={starPath(100, 5.3, 4.6)} fill={color} />
      <Circle cx={93} cy={5} r={0.9} fill={color} />
      <Circle cx={107} cy={5} r={0.9} fill={color} />
    </Svg>
  );
}

/** A King's seal: double ring, dotted band, a small crown and his initial. Outline only. */
export function RoyalSeal({ initial, size = 50, color = INK.brandText }: { initial: string; size?: number; color?: string }) {
  const dots = Array.from({ length: 16 }, (_, i) => {
    const a = (i * Math.PI * 2) / 16;
    return { x: 25 + 19.8 * Math.cos(a), y: 25 + 19.8 * Math.sin(a) };
  });
  const k = size / 50;
  return (
    <View style={{ width: size, height: size, position: "relative" }}>
      <Svg viewBox="0 0 50 50" style={{ width: size, height: size }}>
        <Circle cx={25} cy={25} r={23.4} fill="none" stroke={color} strokeWidth={1.3} />
        <Circle cx={25} cy={25} r={16.6} fill="none" stroke={color} strokeWidth={0.6} />
        {dots.map((d, i) => (
          <Circle key={i} cx={d.x} cy={d.y} r={0.75} fill={color} />
        ))}
        <G transform="translate(19 10.4) scale(0.5)">
          <Path d={CROWN} fill={color} />
        </G>
      </Svg>
      <Text
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 19.5 * k,
          textAlign: "center",
          fontFamily: [FONT_FAMILY.display, FONT_FAMILY.body],
          fontWeight: 600,
          fontSize: 14 * k,
          lineHeight: 1,
          color,
        }}
      >
        {initial}
      </Text>
    </View>
  );
}

/** A pen flourish under a signature. */
export function Flourish({ width = 96, color = INK.deep }: { width?: number; color?: string }) {
  return (
    <Svg viewBox="0 0 120 14" style={{ width, height: (width * 14) / 120 }}>
      <Path
        d="M4 9 C 22 2, 34 13, 52 7 S 84 2, 100 8 C 106 10, 112 9, 116 5"
        fill="none"
        stroke={color}
        strokeWidth={1}
        strokeLinecap="round"
      />
    </Svg>
  );
}
