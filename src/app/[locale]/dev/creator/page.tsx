import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { CreatorTab } from "@/components/dashboard/CreatorTab";
import type { CreatorPanel } from "@/lib/growth/creators";

/**
 * DEV-ONLY visual harness for the creator panel with fixture data (404 in production builds).
 * /es/dev/creator                → balance 34,56 €, sales in every state
 * /es/dev/creator?state=new      → just registered: nothing sold yet
 * /es/dev/creator?state=saved    → saved payout details, a transfer requested, two codes
 * /es/dev/creator?state=small    → 15 € available (10 € option + "todo")
 * Never reads the database; the sheets POST to the real API (404 for a non-creator).
 */
const day = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString();

const LIMITS: CreatorPanel["limits"] = { payoutMinCents: 2000, creditMinCents: 100, creditMaxCents: 2495, creditMultiplier: 2 };

const SALES: CreatorPanel["sales"] = [
  { id: "s1", createdAt: day(1), format: "hardcover", orderStatus: "shipped", paidCents: 4491, commissionCents: 432, state: "pending" },
  { id: "s2", createdAt: day(2), format: "hardcover", orderStatus: "producing", paidCents: 4491, commissionCents: 432, state: "pending" },
  { id: "s3", createdAt: day(4), format: "softcover", orderStatus: "paid", paidCents: 3141, commissionCents: 302, state: "pending" },
  { id: "s4", createdAt: day(9), format: "hardcover", orderStatus: "delivered", paidCents: 4491, commissionCents: 432, state: "available" },
  { id: "s5", createdAt: day(11), format: "softcover", orderStatus: "delivered", paidCents: 3141, commissionCents: 302, state: "available" },
  { id: "s6", createdAt: day(12), format: "digital_pdf", orderStatus: "delivered", paidCents: 891, commissionCents: 86, state: "available" },
  { id: "s7", createdAt: day(16), format: "hardcover", orderStatus: "refunded", paidCents: 4491, commissionCents: 0, state: "void" },
  ...Array.from({ length: 6 }, (_, i) => ({
    id: `s${8 + i}`,
    createdAt: day(18 + i * 4),
    format: "hardcover",
    orderStatus: "delivered",
    paidCents: 4491,
    commissionCents: 432,
    state: "available" as const,
  })),
];

const FIXTURES: Record<string, CreatorPanel> = {
  default: {
    creator: { handle: "totdemare", code: "TOTDEMARE10" },
    balance: { pendingCents: 1166, availableCents: 3456, requestedCents: 0, paidOutCents: 0, spentCents: 0 },
    limits: LIMITS,
    sales: SALES,
    payouts: [],
    credits: [],
    payoutDefaults: null,
  },
  new: {
    creator: { handle: "mama_y_maestra", code: "MAMAYMAESTRA10" },
    balance: { pendingCents: 0, availableCents: 0, requestedCents: 0, paidOutCents: 0, spentCents: 0 },
    limits: LIMITS,
    sales: [],
    payouts: [],
    credits: [],
    payoutDefaults: null,
  },
  saved: {
    creator: { handle: "totdemare", code: "TOTDEMARE10" },
    balance: { pendingCents: 864, availableCents: 2210, requestedCents: 2300, paidOutCents: 4120, spentCents: 1500 },
    limits: LIMITS,
    sales: SALES,
    payouts: [
      { id: "p2", createdAt: day(3), amountCents: 2300, status: "requested", paidAt: null, iban: "ES91 •••• 1332" },
      { id: "p1", createdAt: day(40), amountCents: 4120, status: "paid", paidAt: day(36), iban: "ES91 •••• 1332" },
    ],
    credits: [
      { id: "c2", createdAt: day(2), amountCents: 1000, discountCents: 2000, code: "MEA7K3P9QXW2", ready: true },
      { id: "c1", createdAt: day(20), amountCents: 500, discountCents: 1000, code: "MEAH4TR8ZN5B", ready: false },
    ],
    payoutDefaults: { holderName: "Marina Puig Soler", taxId: "•••••678Z", iban: "ES91 •••• 1332" },
  },
  small: {
    creator: { handle: "lara_mamaestra", code: "LARA10" },
    balance: { pendingCents: 432, availableCents: 1500, requestedCents: 0, paidOutCents: 0, spentCents: 0 },
    limits: LIMITS,
    sales: SALES.slice(0, 5),
    payouts: [],
    credits: [],
    payoutDefaults: null,
  },
};

export default async function CreatorDevPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const { locale } = await params;
  setRequestLocale(locale);
  const { state = "default" } = await searchParams;
  return (
    <main className="min-h-screen bg-cream">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <CreatorTab initialPanel={FIXTURES[state] ?? FIXTURES.default} />
      </div>
    </main>
  );
}
