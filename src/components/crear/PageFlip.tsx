"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";

const DURATION = 800; // ms — matches CSS animation

interface PageFlipProps {
  /** Current step number — change triggers animation */
  page: number;
  /** Disable animation entirely (e.g. catalog mode) */
  disabled?: boolean;
  children: ReactNode;
}

/**
 * Wraps wizard step content and animates transitions like turning a book page.
 *
 * Captures a DOM clone of the outgoing page so that local component state
 * (e.g. active tab in Step4Solo) is preserved in the animation snapshot.
 */
export default function PageFlip({ page, disabled, children }: PageFlipProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const snapshotHtmlRef = useRef<string>("");
  const [prevPage, setPrevPage] = useState(page);
  const [outgoingHtml, setOutgoingHtml] = useState<string>("");
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [phase, setPhase] = useState<"idle" | "animating">("idle");

  // Detect page change DURING RENDER (synchronous — no flash).
  if (page !== prevPage) {
    if (!disabled) {
      setDirection(page > prevPage ? "forward" : "back");
      setOutgoingHtml(snapshotHtmlRef.current);
      setPhase("animating");
    }
    setPrevPage(page);
  }

  // Capture DOM innerHTML as snapshot while idle.
  useEffect(() => {
    if (phase === "idle" && contentRef.current) {
      snapshotHtmlRef.current = contentRef.current.innerHTML;
    }
  });

  // End animation after duration
  useEffect(() => {
    if (phase === "animating") {
      const timer = setTimeout(() => {
        setPhase("idle");
        setOutgoingHtml("");
      }, DURATION);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  if (phase === "idle") {
    return (
      <div className="page-flip-viewport" ref={contentRef}>
        {children}
      </div>
    );
  }

  const isForward = direction === "forward";

  return (
    <div className="page-flip-viewport page-flip-active">
      {/* Incoming page — static underneath, revealed as outgoing flips away */}
      <div
        className={`page-flip-layer ${isForward ? "pf-in-forward" : "pf-in-back"}`}
        aria-hidden
      >
        {children}
      </div>

      {/* Outgoing page — on top, flips away (DOM snapshot preserves component state) */}
      <div
        className={`page-flip-layer ${isForward ? "pf-out-forward" : "pf-out-back"}`}
        aria-hidden
      >
        <div dangerouslySetInnerHTML={{ __html: outgoingHtml }} />
        {/* Spine shadow for depth */}
        <div className={`page-flip-shadow ${isForward ? "pf-shadow-forward" : "pf-shadow-back"}`} />
      </div>
    </div>
  );
}
