/**
 * Synthesizes a subtle page-turn sound using Web Audio API.
 * No external audio files needed — generates white noise burst
 * shaped to mimic paper rustling.
 * Respects prefers-reduced-motion (no sound when enabled).
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;

  // Respect reduced motion preference
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;
  if (prefersReducedMotion) return null;

  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

export function playPageTurnSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  // Resume context if suspended (autoplay policy)
  if (ctx.state === "suspended") {
    ctx.resume();
  }

  const duration = 0.25;
  const sampleRate = ctx.sampleRate;
  const frameCount = Math.floor(sampleRate * duration);

  // Create white noise buffer
  const buffer = ctx.createBuffer(1, frameCount, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frameCount; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.3;
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  // Bandpass filter to sound like paper (800-2500 Hz range)
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 1600;
  filter.Q.value = 0.8;

  // Envelope: quick attack, fast decay — mimics a page swoosh
  const gain = ctx.createGain();
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.08, now + 0.03); // soft attack
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration); // fast decay

  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  source.start(now);
  source.stop(now + duration);
}
