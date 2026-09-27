// placeholder: replaced by avatar agent
//
// Minimal client-side SVG stand-in for the pre-rendered watercolor avatars, with
// the exact public contract the real component will keep: `{ traits: AvatarTraits }`.
// Every trait change re-renders synchronously (no network), so the creation UI
// behaves exactly as it will with the real asset swap.

import { useId } from "react";
import type { CharacterData } from "@/lib/create-store";

export type AvatarTraits = Pick<
  CharacterData,
  "gender" | "age" | "skinTone" | "hairColor" | "hairstyle" | "eyeColor" | "glasses" | "freckles"
>;

interface WatercolorAvatarProps {
  traits: AvatarTraits;
  className?: string;
}

/** Back hair (behind the head) per hairstyle. */
function hairBack(style: string, color: string) {
  switch (style) {
    case "long":
    case "braids":
      return <path d="M52 92c-6 40 2 74 10 92h76c8-18 16-52 10-92-8-36-88-36-96 0z" fill={color} />;
    case "bob":
      return <path d="M50 96c-4 26 0 46 8 56h84c8-10 12-30 8-56-8-40-92-40-100 0z" fill={color} />;
    case "curly":
    case "afro":
      return (
        <g fill={color}>
          {[
            [60, 70, 26], [100, 52, 30], [140, 70, 26], [48, 104, 22], [152, 104, 22],
            [56, 132, 18], [144, 132, 18],
          ].map(([cx, cy, r], i) => (
            <circle key={i} cx={cx} cy={cy} r={style === "afro" ? r + 6 : r} />
          ))}
        </g>
      );
    case "pigtails":
      return (
        <g fill={color}>
          <ellipse cx="42" cy="118" rx="16" ry="26" />
          <ellipse cx="158" cy="118" rx="16" ry="26" />
        </g>
      );
    case "ponytail":
      return <path d="M138 70c34 6 40 50 22 86-4-30-12-50-30-64z" fill={color} />;
    case "bun":
      return <circle cx="100" cy="38" r="20" fill={color} />;
    default:
      return null;
  }
}

/** Fringe / top hair (over the forehead) per hairstyle. */
function hairFront(style: string, color: string) {
  switch (style) {
    case "buzz":
      return <path d="M58 92c0-34 20-48 42-48s42 14 42 48c-10-14-26-20-42-20s-32 6-42 20z" fill={color} opacity="0.85" />;
    case "spiky":
      return <path d="M56 94l4-30 12 12 8-26 12 18 10-24 10 22 12-16 6 26 14-8-4 26c-12-14-30-20-42-20s-30 6-42 20z" fill={color} />;
    case "mohawk":
      return (
        <g fill={color}>
          <path d="M90 86c-2-30 4-50 10-58 6 8 12 28 10 58z" />
          <path d="M60 92c4-20 18-30 40-30s36 10 40 30c-12-10-26-14-40-14s-28 4-40 14z" opacity="0.5" />
        </g>
      );
    case "curly":
    case "afro":
      return (
        <g fill={color}>
          {[[70, 72, 16], [90, 64, 17], [112, 64, 17], [132, 74, 15]].map(([cx, cy, r], i) => (
            <circle key={i} cx={cx} cy={cy} r={r} />
          ))}
        </g>
      );
    default:
      return <path d="M54 100c0-40 22-58 46-58s46 18 46 58c-8-18-22-30-46-30-14 0-26 4-34 12-4-6-8-6-12 18z" fill={color} />;
  }
}

export default function WatercolorAvatar({ traits, className }: WatercolorAvatarProps) {
  const uid = useId().replace(/:/g, "");
  const { skinTone, hairColor, hairstyle, eyeColor, glasses, freckles } = traits;
  const paper = `wc-paper-${uid}`;

  return (
    <svg viewBox="0 0 200 200" role="img" aria-hidden="true" className={className}>
      <defs>
        {/* Soft watercolor edge: tiny turbulence displacement, no glow */}
        <filter id={paper} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="4" />
          <feDisplacementMap in="SourceGraphic" scale="3" />
        </filter>
      </defs>

      <g filter={`url(#${paper})`}>
        {hairBack(hairstyle, hairColor)}
        {/* Shirt + neck */}
        <path d="M44 200c4-34 26-48 56-48s52 14 56 48z" fill="#e8a27c" />
        <path d="M86 140h28v20c-8 6-20 6-28 0z" fill={skinTone} />
        {/* Ears + head */}
        <ellipse cx="56" cy="110" rx="9" ry="12" fill={skinTone} />
        <ellipse cx="144" cy="110" rx="9" ry="12" fill={skinTone} />
        <ellipse cx="100" cy="104" rx="44" ry="48" fill={skinTone} />
        {hairFront(hairstyle, hairColor)}
      </g>

      {/* Face */}
      <g>
        <ellipse cx="82" cy="108" rx="6" ry="7" fill="#fff" />
        <ellipse cx="118" cy="108" rx="6" ry="7" fill="#fff" />
        <circle cx="82" cy="109" r="4.2" fill={eyeColor} />
        <circle cx="118" cy="109" r="4.2" fill={eyeColor} />
        <circle cx="83.3" cy="107.6" r="1.3" fill="#fff" />
        <circle cx="119.3" cy="107.6" r="1.3" fill="#fff" />
        <ellipse cx="72" cy="124" rx="8" ry="5" fill="#e8846b" opacity="0.28" />
        <ellipse cx="128" cy="124" rx="8" ry="5" fill="#e8846b" opacity="0.28" />
        <path d="M90 130c6 6 14 6 20 0" fill="none" stroke="#8a4b3a" strokeWidth="2.4" strokeLinecap="round" />
        {freckles && (
          <g fill="#9c5b3f" opacity="0.55">
            {[[70, 118], [76, 122], [66, 124], [124, 118], [130, 122], [134, 116], [73, 114], [127, 125]].map(
              ([cx, cy], i) => (
                <circle key={i} cx={cx} cy={cy} r="1.2" />
              ),
            )}
          </g>
        )}
        {glasses === "round" && (
          <g fill="none" stroke="#3b2a24" strokeWidth="2.6">
            <circle cx="82" cy="108" r="12" />
            <circle cx="118" cy="108" r="12" />
            <path d="M94 107c4-3 8-3 12 0" />
          </g>
        )}
        {glasses === "square" && (
          <g fill="none" stroke="#3b2a24" strokeWidth="2.6" strokeLinejoin="round">
            <rect x="69" y="98" width="26" height="20" rx="4" />
            <rect x="105" y="98" width="26" height="20" rx="4" />
            <path d="M95 106h10" />
          </g>
        )}
      </g>
    </svg>
  );
}
