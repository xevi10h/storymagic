/** Answers to "¿Qué te frena?" on the book preview (DB check constraint: preview_feedback.reason). */
export const PREVIEW_FEEDBACK_REASONS = ["price", "likeness", "story", "later", "browsing"] as const;
export type PreviewFeedbackReason = (typeof PREVIEW_FEEDBACK_REASONS)[number];
/** Seconds on the preview, without a pay click, before the question shows. */
export const PREVIEW_FEEDBACK_DELAY_S = 45;
