import type { ReactNode } from "react";

/** One FAQ row: native <details>/<summary> (keyboard + screen-reader accessible, works without JS). */
export default function FaqItem({ question, answer, children }: { question: string; answer: string; children?: ReactNode }) {
  return (
    <details className="group">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-display text-base font-semibold leading-snug text-ink transition-colors hover:text-brand-text focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand sm:px-6 sm:text-lg [&::-webkit-details-marker]:hidden">
        {question}
        <span
          aria-hidden
          className="material-symbols-outlined shrink-0 text-2xl text-ink-muted transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
        >
          expand_more
        </span>
      </summary>
      <div className="px-5 pb-5 sm:px-6">
        <p className="max-w-prose text-base leading-relaxed text-ink-body">{answer}</p>
        {children}
      </div>
    </details>
  );
}
