"use client";

import { useCallback, useEffect, useState, type RefObject } from "react";

const HINT_KEY = "meapica:mockup-turned";

/** Degrees turned by a drag across the whole stage width */
const DEG_PER_STAGE = 210;
/** Vertical tilt range (deg, added to the camera pitch): never low enough to see the book's underside */
const TILT_MIN = -9;
const TILT_MAX = 7;
const TILT_PER_PX = 0.09;
/** Glide friction per millisecond after release (0.992^16 ≈ 0.88 per frame) */
const FRICTION = 0.992;
/** Pause before settling back, longer when the reader has turned it to the back cover */
const HOLD_MS = 650;
const HOLD_BACK_MS = 1500;

function readHintSeen(): boolean {
  try {
    return localStorage.getItem(HINT_KEY) === "1";
  } catch {
    return false;
  }
}

function markHintSeen() {
  try {
    localStorage.setItem(HINT_KEY, "1");
  } catch {
    // storage unavailable: the hint just shows again next time
  }
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Drag-to-rotate for the closed book mockup. Pointer events on the stage (touch and mouse);
 * the stage has `touch-action: pan-y`, so a vertical swipe keeps scrolling the page (the
 * browser cancels the pointer) while a horizontal one turns the book around its vertical
 * axis — spine, page block, back cover at the extremes (rubber-banded past ±180° of the
 * book's facing) — with a slight tilt from the vertical movement. On release it glides with
 * inertia, holds, then eases back to its resting pose. Reduced motion: no inertia, no
 * settling animation, no peek; it stays where the reader leaves it.
 *
 * Only `transform` on `spinRef` is written (from rAF), plus data attributes on the stage
 * when the state flips (dragging / interacting / turned), so it stays on the compositor.
 */
export function useDragRotate({
  stageRef,
  spinRef,
  enabled,
  restYaw,
  hint,
}: {
  stageRef: RefObject<HTMLDivElement | null>;
  spinRef: RefObject<HTMLDivElement | null>;
  enabled: boolean;
  /** The book's resting yaw (deg): the turn is limited to ±180° of facing the reader */
  restYaw: number;
  /** Show the one-time affordance */
  hint: boolean;
}): { hintVisible: boolean } {
  const [hintVisible, setHintVisible] = useState(false);
  const dismissHint = useCallback(() => {
    setHintVisible(false);
    markHintSeen();
  }, []);

  useEffect(() => {
    if (!hint || !enabled || readHintSeen()) return;
    // Client-only (localStorage), after hydration.
    const id = requestAnimationFrame(() => setHintVisible(true));
    return () => cancelAnimationFrame(id);
  }, [hint, enabled]);

  useEffect(() => {
    const stage = stageRef.current;
    const spin = spinRef.current;
    if (!stage || !spin) return;
    if (!enabled) {
      spin.style.transform = "";
      stage.dataset.turned = "false";
      stage.dataset.interacting = "false";
      stage.dataset.dragging = "false";
      return;
    }

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const min = -180 - restYaw;
    const max = 180 - restYaw;

    let yaw = 0;
    let tilt = 0;
    let turned = false;
    let pointerId: number | null = null;
    let pointerType = "";
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startYaw = 0;
    let startTilt = 0;
    let degPerPx = 1;
    let vel = 0; // deg / ms
    let lastYaw = 0;
    let lastT = 0;
    let frame = 0;
    let loop = 0;
    let holdTimer: ReturnType<typeof setTimeout> | undefined;
    let peek: Animation | null = null;
    let peekTimer: ReturnType<typeof setTimeout> | undefined;

    const setFlag = (name: "dragging" | "interacting" | "turned", value: boolean) => {
      const v = String(value);
      if (stage.dataset[name] !== v) stage.dataset[name] = v;
    };

    const write = () => {
      frame = 0;
      spin.style.transform = `rotateX(${tilt.toFixed(2)}deg) rotateY(${yaw.toFixed(2)}deg)`;
      const nowTurned = Math.abs(yaw) > 4;
      if (nowTurned !== turned) {
        turned = nowTurned;
        setFlag("turned", turned);
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(write);
    };

    // Past the limits the book follows the finger at a third of the speed (rubber band)
    const rubber = (v: number) => {
      if (v < min) return Math.max(min - 30, min - (min - v) * 0.3);
      if (v > max) return Math.min(max + 30, max + (v - max) * 0.3);
      return v;
    };

    const stopMotion = () => {
      cancelAnimationFrame(loop);
      loop = 0;
      clearTimeout(holdTimer);
      if (peek) {
        peek.cancel();
        peek = null;
      }
      clearTimeout(peekTimer);
    };

    const settle = () => {
      const fromYaw = yaw;
      const fromTilt = tilt;
      const duration = Math.min(1100, 450 + Math.abs(fromYaw) * 3);
      const t0 = performance.now();
      const step = (now: number) => {
        const p = Math.min(1, (now - t0) / duration);
        const e = easeOutCubic(p);
        yaw = fromYaw * (1 - e);
        tilt = fromTilt * (1 - e);
        write();
        if (p < 1) {
          loop = requestAnimationFrame(step);
        } else {
          loop = 0;
          yaw = 0;
          tilt = 0;
          spin.style.transform = "";
          setFlag("turned", (turned = false));
          setFlag("interacting", false);
        }
      };
      loop = requestAnimationFrame(step);
    };

    const glide = () => {
      let prev = performance.now();
      const step = (now: number) => {
        const dt = Math.min(48, now - prev);
        prev = now;
        yaw += vel * dt;
        vel *= Math.pow(FRICTION, dt);
        if (yaw < min || yaw > max) {
          yaw = Math.max(min, Math.min(max, yaw));
          vel = 0;
        }
        write();
        if (Math.abs(vel) > 0.01) {
          loop = requestAnimationFrame(step);
        } else {
          loop = 0;
          holdTimer = setTimeout(settle, Math.abs(yaw + restYaw) > 120 ? HOLD_BACK_MS : HOLD_MS);
        }
      };
      loop = requestAnimationFrame(step);
    };

    const onDown = (e: PointerEvent) => {
      // A second finger never takes over a drag in progress
      if (dragging) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      stopMotion();
      pointerId = e.pointerId;
      pointerType = e.pointerType;
      dragging = false;
      startX = e.clientX;
      startY = e.clientY;
      startYaw = yaw;
      startTilt = tilt;
      degPerPx = DEG_PER_STAGE / Math.max(stage.clientWidth, 1);
      vel = 0;
      lastYaw = yaw;
      lastT = e.timeStamp;
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!dragging) {
        // Touch: only a mostly-horizontal move turns the book (vertical ones scroll the page)
        const start = pointerType === "mouse" ? Math.hypot(dx, dy) > 4 : Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy);
        if (!start) return;
        dragging = true;
        try {
          stage.setPointerCapture(e.pointerId);
        } catch {
          // pointer already gone
        }
        setFlag("dragging", true);
        setFlag("interacting", true);
        if (hint) dismissHint();
      }
      yaw = rubber(startYaw + dx * degPerPx);
      tilt = Math.max(TILT_MIN, Math.min(TILT_MAX, startTilt - dy * TILT_PER_PX));
      const dt = e.timeStamp - lastT;
      if (dt > 0) {
        vel = 0.75 * ((yaw - lastYaw) / dt) + 0.25 * vel;
        lastYaw = yaw;
        lastT = e.timeStamp;
      }
      schedule();
    };

    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      pointerId = null;
      if (!dragging) return;
      dragging = false;
      setFlag("dragging", false);
      // Held still before letting go: no fling
      if (e.timeStamp - lastT > 90) vel = 0;
      vel = Math.max(-2.5, Math.min(2.5, vel));
      if (reduce) {
        // Stay where the reader leaves it (within the limits)
        yaw = Math.max(min, Math.min(max, yaw));
        schedule();
        return;
      }
      glide();
    };

    // Only the stage losing capture ends a drag: taking capture from the touched child
    // (implicit touch capture) fires lostpointercapture on that child, which bubbles here.
    const onLostCapture = (e: PointerEvent) => {
      if (e.target === stage) onUp(e);
    };

    // Once, while the hint is up: a small turn towards the spine and back, so the book reads as 3D.
    let io: IntersectionObserver | null = null;
    if (hint && !reduce && !readHintSeen() && typeof IntersectionObserver !== "undefined" && typeof spin.animate === "function") {
      io = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting) return;
          io?.disconnect();
          peekTimer = setTimeout(() => {
            if (pointerId !== null || yaw !== 0) return;
            peek = spin.animate(
              [
                { transform: "rotateY(0deg)" },
                { transform: "rotateY(34deg)", offset: 0.42 },
                { transform: "rotateY(-6deg)", offset: 0.78 },
                { transform: "rotateY(0deg)" },
              ],
              { duration: 1900, easing: "cubic-bezier(.45,0,.25,1)" },
            );
            peek.onfinish = () => {
              peek = null;
            };
          }, 700);
        },
        { threshold: 0.6 },
      );
      io.observe(stage);
    }

    stage.addEventListener("pointerdown", onDown);
    stage.addEventListener("pointermove", onMove);
    stage.addEventListener("pointerup", onUp);
    stage.addEventListener("pointercancel", onUp);
    stage.addEventListener("lostpointercapture", onLostCapture);
    return () => {
      stopMotion();
      cancelAnimationFrame(frame);
      io?.disconnect();
      stage.removeEventListener("pointerdown", onDown);
      stage.removeEventListener("pointermove", onMove);
      stage.removeEventListener("pointerup", onUp);
      stage.removeEventListener("pointercancel", onUp);
      stage.removeEventListener("lostpointercapture", onLostCapture);
      spin.style.transform = "";
      stage.dataset.turned = "false";
      stage.dataset.interacting = "false";
      stage.dataset.dragging = "false";
    };
  }, [stageRef, spinRef, enabled, restYaw, hint, dismissHint]);

  return { hintVisible };
}
