"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

interface SheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  closeLabel: string;
  children: React.ReactNode;
  /** Optional footer (actions), pinned to the bottom of the sheet. */
  footer?: React.ReactNode;
}

/**
 * Bottom sheet on mobile, centred dialog on desktop. Edits happen in place, so
 * the parent never leaves the page (and never loses state) to change something.
 * Esc / backdrop close it; focus moves into the sheet and back on close.
 */
export default function Sheet({ open, title, onClose, closeLabel, children, footer }: SheetProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    // Focus the first field (or the panel) once mounted
    requestAnimationFrame(() => {
      const target = panelRef.current?.querySelector<HTMLElement>("textarea, input, button:not([data-sheet-close])");
      (target ?? panelRef.current)?.focus();
    });
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        aria-label={closeLabel}
        tabIndex={-1}
        onClick={onClose}
        className="sheet-backdrop absolute inset-0 bg-[#2c1810]/45"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="sheet-panel relative flex max-h-[88dvh] w-full flex-col rounded-t-3xl bg-white shadow-2xl outline-none sm:max-w-lg sm:rounded-3xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-create-neutral px-5 py-4">
          <h2 id={titleId} className="font-display text-lg font-bold text-create-text-dark">
            {title}
          </h2>
          <button
            type="button"
            data-sheet-close
            onClick={onClose}
            aria-label={closeLabel}
            className="flex h-9 w-9 items-center justify-center rounded-full text-create-text-sub transition-colors hover:bg-create-neutral"
          >
            <span aria-hidden className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="border-t border-create-neutral px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  );
}
