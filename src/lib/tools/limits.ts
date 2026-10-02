// Field limits of the free Reyes printables, shared by the forms and the API
// schema (schema.ts). No zod here, so client components stay light.

export const TOOL_NAME_MAX = 40;
export const TOOL_CUSTOM_MAX = 110;
export const TOOL_PS_MAX = 140;
export const TOOL_MAX_ACHIEVEMENTS = 3;
export const TOOL_AGE_MIN = 2;
export const TOOL_AGE_MAX = 12;

/** Letters (any script, with accents), spaces and the joiners names use: ' ’ - . · (Pol·la, D'Artagnan). Emoji/symbols would print as blank boxes. */
export const TOOL_NAME_PATTERN = /^[\p{L}\p{M}\s'’.·-]+$/u;
