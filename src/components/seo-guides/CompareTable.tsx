import { cx } from "@/components/ui";

export interface CompareTableColumn {
  id: string;
  name: string;
  /** Highlight (our own column). */
  own?: boolean;
}

export interface CompareTableCell {
  text: string;
  /** 1-based number of the source in the sources list (rendered as a link to #source-n). */
  source?: number;
}

/**
 * Dated comparison table. Rows are facts, columns brands. Below md it scrolls
 * horizontally inside its own box (sticky first column), never the page.
 */
export default function CompareTable({
  caption,
  columns,
  rows,
  sourceLabel,
  scrollHint,
}: {
  caption: string;
  columns: CompareTableColumn[];
  rows: { label: string; cells: Record<string, CompareTableCell> }[];
  /** Accessible name of a source link, e.g. "Fuente 3". */
  sourceLabel: (n: number) => string;
  /** Phones only: tells the reader the table scrolls sideways. */
  scrollHint?: string;
}) {
  return (
    <>
      {scrollHint && (
        <p className="mb-3 flex items-center gap-1 text-sm text-ink-muted lg:hidden">
          {scrollHint}
          <span aria-hidden className="material-symbols-outlined !text-lg">
            arrow_forward
          </span>
        </p>
      )}
      <div
        className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0"
        role="region"
        aria-label={caption}
        tabIndex={0}
      >
        <table className="w-full min-w-[860px] border-separate border-spacing-0 text-left text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-10 w-28 border-b-2 border-line bg-surface p-3 sm:w-40"
              />
              {columns.map((c) => (
                <th
                  key={c.id}
                  scope="col"
                  className={cx(
                    "border-b-2 p-3 align-bottom font-display text-base font-semibold text-ink",
                    c.own ? "border-brand bg-brand-tint" : "border-line",
                  )}
                >
                  {c.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <th
                  scope="row"
                  className="sticky left-0 z-10 w-28 border-b border-line bg-surface p-3 pl-0 align-top text-[13px] font-semibold leading-snug text-ink sm:w-40 sm:pl-3"
                >
                  {row.label}
                </th>
                {columns.map((c) => {
                  const cell = row.cells[c.id];
                  return (
                    <td
                      key={c.id}
                      className={cx(
                        "border-b border-line p-3 align-top leading-snug text-ink-soft",
                        c.own && "bg-brand/[0.04]",
                      )}
                    >
                      {cell?.text}
                      {cell?.source && (
                        <a
                          href={`#source-${cell.source}`}
                          aria-label={sourceLabel(cell.source)}
                          className="ml-1 rounded px-0.5 align-super text-[11px] font-bold text-brand-text underline decoration-brand/30 underline-offset-2"
                        >
                          [{cell.source}]
                        </a>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
