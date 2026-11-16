/**
 * Watercolour-ish holly sprig, the one Christmas ornament of the site (gift season only).
 * Decorative: always aria-hidden. Size it with className (width; height follows the viewBox).
 * ── CHRISTMAS 2026: shown only while seasonBanner(today) is on (1 Nov – 5 Jan) ──
 */
export function HollySprig({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 132 110" fill="none" className={className}>
      <path d="M66 58C50 30 22 22 6 34c10 4 9 16 22 18-9 9-4 20 7 24 4-14 18-19 31-18z" fill="#2E5E4E" opacity=".92" />
      <path d="M66 58c14-28 42-38 60-28-10 5-8 17-21 20 9 9 5 20-6 25-5-14-19-18-33-17z" fill="#3B7362" opacity=".92" />
      <path d="M66 58C50 30 22 22 6 34M66 58c14-28 42-38 60-28" stroke="#1F4D3F" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="58" cy="64" r="8" fill="#C0392B" />
      <circle cx="74" cy="66" r="8" fill="#B03A2E" />
      <circle cx="66" cy="78" r="8" fill="#A93226" />
      <circle cx="55" cy="61" r="2.2" fill="#fff" opacity=".6" />
      <circle cx="71" cy="63" r="2.2" fill="#fff" opacity=".6" />
    </svg>
  );
}

/** Small gold star outline (season kickers and badges). */
export function SeasonStar({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 2l2.4 5.6L20 8.2l-4.3 3.9 1.3 5.9L12 15l-5 3 1.3-5.9L4 8.2l5.6-.6z" />
    </svg>
  );
}
