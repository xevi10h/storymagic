/**
 * Plays a page-turn sound effect using a pre-generated MP3 file.
 * Respects prefers-reduced-motion (silent when enabled).
 */

let audio: HTMLAudioElement | null = null;

export function playPageTurnSound() {
  if (typeof window === "undefined") return;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  // Lazy-init the audio element (reuse across flips)
  if (!audio) {
    audio = new Audio("/sounds/page-flip.mp3");
    audio.volume = 0.5;
  }

  // Reset and play (allows rapid successive flips)
  audio.currentTime = 0;
  audio.play().catch(() => {
    // Ignore autoplay policy errors — sound is non-essential
  });
}
