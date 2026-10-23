"use client";

import { useId, useState, useSyncExternalStore } from "react";
import { useLocale, useTranslations } from "next-intl";
import Sheet from "@/components/create/Sheet";
import { Button, cx } from "@/components/ui";
import { formatPrice } from "@/lib/pricing";
import { REFERRAL_ROUTE } from "@/lib/promo-codes";
import { cleanHolderName, isValidIban, isValidTaxId, weeklyBookCounts } from "@/lib/creators";
import type { CreatorPanel } from "@/lib/growth/creators";

// Creator panel (invite-only creators, src/lib/growth/creators.ts). Data = GET /api/creator;
// the sheets POST to the same route, which answers with the fresh panel. Never shows buyer data.

type Sale = CreatorPanel["sales"][number];
type T = ReturnType<typeof useTranslations<"dashboard.creator">>;

const SALES_PREVIEW = 4;
const ERROR_KEYS = ["invalid_iban", "invalid_tax_id", "invalid_name", "insufficient_balance"] as const;

function useMoney() {
  const locale = useLocale();
  return (cents: number) => formatPrice(cents, locale);
}

function useDate() {
  const locale = useLocale();
  const f = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "Europe/Madrid" });
  return (iso: string) => f.format(new Date(iso));
}

/** Copy to the clipboard; falls back to a prompt (old in-app browsers). */
function useCopy(): [string | null, (key: string, text: string) => Promise<void>] {
  const [copied, setCopied] = useState<string | null>(null);
  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 2500);
    } catch {
      window.prompt("", text);
    }
  }
  return [copied, copy];
}

async function postCreator(body: Record<string, unknown>): Promise<{ panel: CreatorPanel } | { error: string }> {
  try {
    const res = await fetch("/api/creator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => null)) as (CreatorPanel & { error?: string }) | null;
    if (res.ok && data && "balance" in data) return { panel: data };
    return { error: data?.error ?? "generic" };
  } catch {
    return { error: "generic" };
  }
}

const card = "flex flex-col rounded-3xl border border-line bg-surface p-5";
const noSubscribe = () => () => {};

export function CreatorTab({ initialPanel }: { initialPanel: CreatorPanel }) {
  const t = useTranslations("dashboard.creator");
  // Every POST answers with the fresh panel.
  const [panel, onPanel] = useState(initialPanel);
  const [sheet, setSheet] = useState<"spend" | "payout" | null>(null);
  const [payoutSent, setPayoutSent] = useState(false);
  const books = panel.sales.filter((s) => s.state !== "void").length;

  return (
    <div className="flex flex-col gap-5" data-testid="creator-panel">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-brand-text">{t("kicker")}</p>
        <h2 className="mt-1 font-display text-lg font-semibold text-ink">
          {t("summary", { handle: panel.creator.handle, count: books })}
        </h2>
      </div>

      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        <div className="flex min-w-0 flex-col gap-5">
          <CodeCard code={panel.creator.code} t={t} />
          <BalanceCard
            panel={panel}
            payoutSent={payoutSent}
            onSpend={() => setSheet("spend")}
            onPayout={() => setSheet("payout")}
            t={t}
          />
          {panel.credits.length > 0 && <CreditCodes credits={panel.credits} t={t} />}
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <WeeklyChart sales={panel.sales} t={t} />
          <SalesList sales={panel.sales} t={t} />
        </div>
      </div>

      <SpendSheet open={sheet === "spend"} panel={panel} onPanel={onPanel} onClose={() => setSheet(null)} t={t} />
      <PayoutSheet
        open={sheet === "payout"}
        panel={panel}
        onPanel={(p) => {
          onPanel(p);
          setPayoutSent(true);
          setSheet(null);
        }}
        onSpendInstead={() => setSheet("spend")}
        onClose={() => setSheet(null)}
        t={t}
      />
    </div>
  );
}

// ── Code + link ─────────────────────────────────────────────────────────────

function CodeCard({ code, t }: { code: string; t: T }) {
  const locale = useLocale();
  const [copied, copy] = useCopy();
  const path = `/${locale}${REFERRAL_ROUTE}/${code}`;
  // The host is known on the client only ("" on the server: no hydration mismatch).
  const host = useSyncExternalStore(noSubscribe, () => window.location.host, () => "");

  return (
    <section className={cx(card, "gap-3")} aria-labelledby="creator-code-label">
      <p id="creator-code-label" className="text-xs font-bold uppercase tracking-wide text-ink-soft">
        {t("code.label")}
      </p>
      {/* Never break the code: on a narrow screen the button wraps under it instead. */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <span className="whitespace-nowrap font-display text-[clamp(20px,6vw,28px)] font-bold leading-tight tracking-wide text-ink" data-testid="creator-code">
          {code}
        </span>
        <Button size="sm" leadingIcon={copied === "code" ? "check" : "content_copy"} onClick={() => copy("code", code)} className="shrink-0">
          <span aria-live="polite">{copied === "code" ? t("code.copied") : t("code.copy")}</span>
        </Button>
      </div>
      <p className="text-sm leading-relaxed text-ink-body">{t("code.line")}</p>
      <div className="flex items-center gap-2 rounded-xl border border-line bg-paper py-1.5 pr-1.5 pl-3">
        <span className="min-w-0 flex-1 truncate text-[13px] text-ink-soft" data-testid="creator-link">
          {host}
          {path}
        </span>
        <Button
          size="sm"
          variant="secondary"
          leadingIcon={copied === "link" ? "check" : undefined}
          onClick={() => copy("link", `${window.location.origin}${path}`)}
          className="shrink-0 !min-h-10 !px-4"
        >
          <span aria-live="polite">{copied === "link" ? t("code.linkCopied") : t("code.copyLink")}</span>
        </Button>
      </div>
      <p className="text-xs text-ink-muted">{t("code.linkHint")}</p>
    </section>
  );
}

// ── Balance ─────────────────────────────────────────────────────────────────

function BalanceCard({
  panel,
  payoutSent,
  onSpend,
  onPayout,
  t,
}: {
  panel: CreatorPanel;
  payoutSent: boolean;
  onSpend: () => void;
  onPayout: () => void;
  t: T;
}) {
  const money = useMoney();
  const date = useDate();
  const { balance, limits } = panel;
  const available = Math.max(0, balance.availableCents);
  const canSpend = available >= limits.creditMinCents;
  const canPayout = available >= limits.payoutMinCents;
  const requested = panel.payouts.find((p) => p.status === "requested");

  const tile = (label: string, cents: number) => (
    <div className="flex flex-col gap-0.5 rounded-xl bg-paper px-3 py-2.5">
      <span className="text-xs text-ink-muted">{label}</span>
      <strong className="text-[15px] tabular-nums text-ink">{money(cents)}</strong>
    </div>
  );

  return (
    <section className={cx(card, "gap-4")} aria-label={t("balance.available")}>
      <div className="flex flex-col gap-0.5">
        <span className="text-[13px] font-semibold text-ink-muted">{t("balance.available")}</span>
        <span className="font-display text-[40px] font-bold leading-none tabular-nums text-brand-deep" data-testid="creator-available">
          {money(available)}
        </span>
        {available > 0 && (
          <span className="mt-1 text-sm font-semibold text-success">
            {t("balance.worth", { amount: money(available * limits.creditMultiplier) })}
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {tile(t("balance.pending"), balance.pendingCents)}
        {tile(t("balance.paidOut"), balance.paidOutCents)}
        {tile(t("balance.spent"), balance.spentCents)}
      </div>
      {(requested || payoutSent) && (
        <p role="status" className="rounded-xl bg-success/10 px-3 py-2.5 text-[13px] leading-snug text-ink">
          {requested ? t("balance.requested", { amount: money(requested.amountCents), date: date(requested.createdAt) }) : t("balance.payoutSent")}
        </p>
      )}
      <Button block onClick={onSpend} disabled={!canSpend} data-testid="creator-spend">
        {t("balance.spend")}
      </Button>
      <Button block variant="secondary" onClick={onPayout} disabled={!canPayout} data-testid="creator-payout">
        {t("balance.payout")}
      </Button>
      <p className="text-xs leading-relaxed text-ink-muted">
        {!canPayout && `${t("balance.payoutMin", { min: money(limits.payoutMinCents) })} `}
        {t("balance.hint")}
      </p>
    </section>
  );
}

function CreditCodes({ credits, t }: { credits: CreatorPanel["credits"]; t: T }) {
  const money = useMoney();
  const date = useDate();
  const [copied, copy] = useCopy();
  return (
    <section className={cx(card, "gap-1")}>
      <h3 className="mb-1 font-display text-lg font-bold text-ink">{t("codes.title")}</h3>
      {credits.map((c) => (
        <div key={c.id} className="flex items-center justify-between gap-3 border-b border-line py-2.5 last:border-b-0">
          <div className="min-w-0">
            <p className="select-all font-mono text-[15px] font-bold tracking-wider text-ink">{c.code}</p>
            <p className="text-xs text-ink-muted">
              {c.ready ? t("codes.item", { amount: money(c.discountCents), date: date(c.createdAt) }) : t("codes.preparing")}
            </p>
          </div>
          {c.ready && (
            <Button size="sm" variant="secondary" leadingIcon={copied === c.id ? "check" : "content_copy"} onClick={() => copy(c.id, c.code)} className="shrink-0 !min-h-10 !px-4">
              <span aria-live="polite">{copied === c.id ? t("code.copied") : t("code.copy")}</span>
            </Button>
          )}
        </div>
      ))}
      <p className="mt-1 text-xs leading-relaxed text-ink-muted">{t("codes.hint")}</p>
    </section>
  );
}

// ── Weekly bars ─────────────────────────────────────────────────────────────

function WeeklyChart({ sales, t }: { sales: Sale[]; t: T }) {
  const locale = useLocale();
  const [now] = useState(() => Date.now());
  const weeks = weeklyBookCounts(sales.filter((s) => s.state !== "void").map((s) => s.createdAt), now);
  const max = Math.max(1, ...weeks.map((w) => w.count));
  const label = new Intl.DateTimeFormat(locale, { day: "numeric", month: "numeric", timeZone: "UTC" });
  const current = weeks[weeks.length - 1];

  return (
    <section className={cx(card, "gap-3")}>
      <div className="flex items-baseline justify-between">
        <h3 className="font-display text-lg font-bold text-ink">{t("chart.title")}</h3>
        <span className="text-[13px] text-ink-muted">{t("chart.range")}</span>
      </div>
      <svg role="img" aria-label={t("chart.aria", { counts: weeks.map((w) => w.count).join(", ") })} viewBox="0 0 330 124" className="h-auto w-full">
        {weeks.map((w, i) => {
          const x = i * 58;
          const h = w.count === 0 ? 1 : Math.max(6, Math.round((w.count / max) * 80));
          const last = i === weeks.length - 1;
          return (
            <g key={w.weekStart}>
              <rect x={x} y={100 - h} width={40} height={h} rx={w.count === 0 ? 0 : 6} className={w.count === 0 ? "fill-line" : last ? "fill-brand" : "fill-line-warm"} />
              <text x={x + 20} y={118} textAnchor="middle" fontSize={11} className="fill-ink-muted">
                {label.format(new Date(`${w.weekStart}T00:00:00Z`))}
              </text>
            </g>
          );
        })}
        <text x={5 * 58 + 20} y={100 - (current.count === 0 ? 1 : Math.max(6, Math.round((current.count / max) * 80))) - 6} textAnchor="middle" fontSize={12} fontWeight={700} className="fill-ink">
          {current.count}
        </text>
      </svg>
    </section>
  );
}

// ── Sales ───────────────────────────────────────────────────────────────────

const BADGE: Record<Sale["state"], string> = {
  pending: "bg-line text-ink-soft",
  available: "bg-success/10 text-success",
  void: "bg-line text-ink-muted",
};

function SalesList({ sales, t }: { sales: Sale[]; t: T }) {
  const money = useMoney();
  const date = useDate();
  const [all, setAll] = useState(false);
  const shown = all ? sales : sales.slice(0, SALES_PREVIEW);
  const known = (key: string, group: "format" | "status") => (t.has(`${group}.${key}`) ? t(`${group}.${key}`) : key);

  return (
    <section className={cx(card, "gap-1")}>
      <h3 className="mb-2 font-display text-lg font-bold text-ink">{t("sales.title")}</h3>
      {sales.length === 0 && <p className="py-2 text-sm text-ink-muted">{t("sales.empty")}</p>}
      <ul>
        {shown.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-3 border-b border-line py-2.5 last:border-b-0" data-testid="creator-sale">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">
                {known(s.format, "format")} · {date(s.createdAt)}
              </p>
              <p className="text-xs text-ink-muted">
                {t("sales.paid", { amount: money(s.paidCents) })} · {known(s.orderStatus, "status")}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <strong className={cx("text-sm tabular-nums", s.state === "void" ? "text-ink-muted line-through" : "text-ink")}>
                +{money(s.commissionCents)}
              </strong>
              <span className={cx("rounded-full px-2 py-0.5 text-[11px] font-bold", BADGE[s.state])}>{t(`sales.badge.${s.state}`)}</span>
            </div>
          </li>
        ))}
      </ul>
      {!all && sales.length > SALES_PREVIEW && (
        <button type="button" onClick={() => setAll(true)} className="mt-2 self-start text-sm font-bold text-brand-text hover:underline">
          {t("sales.showAll", { count: sales.length })}
        </button>
      )}
      <p className="mt-1 text-xs leading-relaxed text-ink-muted">{t("sales.privacy")}</p>
    </section>
  );
}

// ── Spend sheet (×2) ────────────────────────────────────────────────────────

/** 10 € and 20 € when the balance covers them, then the maximum (one hardcover) or, below it, everything. */
function spendOptions(available: number, min: number, max: number): { cents: number; kind: "fixed" | "max" | "all" }[] {
  if (available < min) return [];
  const out: { cents: number; kind: "fixed" | "max" | "all" }[] = [1000, 2000]
    .filter((c) => c <= available && c < max)
    .map((cents) => ({ cents, kind: "fixed" }));
  if (available >= max) out.push({ cents: max, kind: "max" });
  else if (!out.some((o) => o.cents === available)) out.push({ cents: available, kind: "all" });
  return out;
}

function SpendSheet({ open, panel, onPanel, onClose, t }: { open: boolean; panel: CreatorPanel; onPanel: (p: CreatorPanel) => void; onClose: () => void; t: T }) {
  const money = useMoney();
  const legendId = useId();
  const { limits } = panel;
  const available = Math.max(0, panel.balance.availableCents);
  const options = spendOptions(available, limits.creditMinCents, limits.creditMaxCents);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [selected, setSelected] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<CreatorPanel["credits"][number] | null>(null);
  const [copied, copy] = useCopy();
  // New idempotency key + default choice (the largest) on every opening.
  if (open && !openKey) {
    setOpenKey(crypto.randomUUID());
    setSelected(options.at(-1)?.cents ?? 0);
  }
  if (!open && openKey) setOpenKey(null);

  function close() {
    if (busy) return;
    setError(null);
    setDone(null);
    onClose();
  }

  async function create() {
    if (busy || !openKey || !selected) return;
    setBusy(true);
    setError(null);
    const r = await postCreator({ action: "credit", requestKey: openKey, amountCents: selected });
    setBusy(false);
    if ("error" in r) {
      setError((ERROR_KEYS as readonly string[]).includes(r.error) ? t(`errors.${r.error as (typeof ERROR_KEYS)[number]}`) : t("errors.generic"));
      return;
    }
    onPanel(r.panel);
    setDone(r.panel.credits[0] ?? null);
  }

  const value = selected * limits.creditMultiplier;
  return (
    <Sheet
      open={open}
      title={done ? t("spend.doneTitle", { amount: money(done.discountCents) }) : t("spend.title")}
      onClose={close}
      closeLabel={t("spend.close")}
      // Done: no footer button where the CTA was (the second click of a double click would close it).
      footer={
        done ? undefined : (
          <>
            <Button size="lg" block onClick={() => void create()} loading={busy} disabled={!selected} data-testid="creator-spend-submit">
              {t("spend.cta", { amount: money(value) })}
            </Button>
            {error && (
              <p className="mt-2 text-center text-xs text-red-700" role="alert">
                {error}
              </p>
            )}
            <p className="mt-2 text-center text-xs text-ink-muted">{t("spend.noCash")}</p>
          </>
        )
      }
    >
      {done ? (
        <div className="flex flex-col gap-4" data-testid="creator-spend-done">
          {done.ready ? (
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-2xl border-2 border-brand bg-brand-tint px-4 py-3.5">
              <span className="select-all whitespace-nowrap font-mono text-lg font-bold tracking-wider text-ink">{done.code}</span>
              <Button size="sm" variant="secondary" leadingIcon={copied ? "check" : "content_copy"} onClick={() => copy("done", done.code)} className="shrink-0">
                <span aria-live="polite">{copied ? t("spend.copied") : t("spend.copy")}</span>
              </Button>
            </div>
          ) : (
            <p className="rounded-xl bg-paper px-4 py-3 text-sm text-ink-soft">{t("codes.preparing")}</p>
          )}
          <p className="text-sm leading-relaxed text-ink-body">{t("spend.doneLine")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm leading-relaxed text-ink-body">{t("spend.intro")}</p>
          <div role="radiogroup" aria-labelledby={legendId} className="flex flex-col gap-2">
            <p id={legendId} className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-soft">
              {t("spend.legend")}
            </p>
            {options.map((o) => {
              const on = o.cents === selected;
              return (
                <button
                  key={o.kind + o.cents}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setSelected(o.cents)}
                  className={cx(
                    "flex items-center justify-between gap-3 rounded-2xl border-2 px-4 py-3 text-left text-[15px] transition-colors",
                    on ? "border-brand bg-brand/[0.04]" : "border-line bg-surface hover:border-brand/40",
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span aria-hidden className={cx("size-[18px] shrink-0 rounded-full border-2", on ? "border-[5px] border-brand" : "border-line-warm")} />
                    <span className="min-w-0">
                      <span className="block font-semibold tabular-nums text-ink">
                        {o.kind === "max" ? t("spend.max", { amount: money(o.cents) }) : o.kind === "all" ? t("spend.all", { amount: money(o.cents) }) : money(o.cents)}
                      </span>
                      {o.kind === "max" && <span className="block text-xs text-ink-muted">{t("spend.maxNote")}</span>}
                    </span>
                  </span>
                  <strong className="shrink-0 tabular-nums text-ink">→ {money(o.cents * limits.creditMultiplier)}</strong>
                </button>
              );
            })}
          </div>
          <div className="flex flex-col gap-1 rounded-2xl bg-paper px-4 py-3.5">
            <span className="text-sm font-semibold text-ink">{t("spend.youGet", { amount: money(value) })}</span>
            <span className="text-[13px] leading-relaxed text-ink-muted">{t("spend.terms")}</span>
            {available > limits.creditMaxCents && <span className="mt-1 text-[13px] leading-relaxed text-ink-muted">{t("spend.more")}</span>}
          </div>
        </div>
      )}
    </Sheet>
  );
}

// ── Payout sheet ────────────────────────────────────────────────────────────

const INPUT =
  "min-h-12 w-full rounded-xl border-2 border-line bg-surface px-3.5 text-base text-ink placeholder:text-ink-muted focus:border-brand focus:outline-none aria-[invalid=true]:border-red-300";

function PayoutSheet({
  open,
  panel,
  onPanel,
  onSpendInstead,
  onClose,
  t,
}: {
  open: boolean;
  panel: CreatorPanel;
  onPanel: (p: CreatorPanel) => void;
  onSpendInstead: () => void;
  onClose: () => void;
  t: T;
}) {
  const money = useMoney();
  const ids = { holder: useId(), taxId: useId(), iban: useId(), hint: useId() };
  const saved = panel.payoutDefaults;
  const amount = Math.max(0, panel.balance.availableCents);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [holder, setHolder] = useState("");
  const [taxId, setTaxId] = useState("");
  const [iban, setIban] = useState("");
  const [editSaved, setEditSaved] = useState(false);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // New idempotency key + prefill on every opening.
  if (open && !openKey) {
    setOpenKey(crypto.randomUUID());
    setHolder(saved?.holderName ?? "");
    setTaxId("");
    setIban("");
    setEditSaved(!saved);
    setChecked(false);
    setError(null);
  }
  if (!open && openKey) setOpenKey(null);

  const invalid = {
    holder: !cleanHolderName(holder),
    taxId: editSaved && !isValidTaxId(taxId),
    iban: editSaved && !isValidIban(iban),
  };

  async function submit() {
    if (busy || !openKey) return;
    setChecked(true);
    if (invalid.holder || invalid.taxId || invalid.iban) return;
    setBusy(true);
    setError(null);
    const r = await postCreator({
      action: "payout",
      requestKey: openKey,
      amountCents: amount,
      holderName: holder,
      ...(editSaved ? { taxId, iban } : {}),
    });
    setBusy(false);
    if ("error" in r) {
      setError((ERROR_KEYS as readonly string[]).includes(r.error) ? t(`errors.${r.error as (typeof ERROR_KEYS)[number]}`) : t("errors.generic"));
      return;
    }
    onPanel(r.panel);
  }

  const field = (id: string, label: string, bad: boolean, errorText: string, input: React.ReactNode, hint?: React.ReactNode) => (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-bold text-ink-soft">
        {label}
      </label>
      {input}
      {checked && bad && <p className="mt-1 text-xs text-red-700">{errorText}</p>}
      {hint}
    </div>
  );

  return (
    <Sheet
      open={open}
      title={t("payout.title", { amount: money(amount) })}
      onClose={() => !busy && onClose()}
      closeLabel={t("payout.close")}
      footer={
        <>
          <Button size="lg" block onClick={() => void submit()} loading={busy} data-testid="creator-payout-submit">
            {t("payout.cta", { amount: money(amount) })}
          </Button>
          {error && (
            <p className="mt-2 text-center text-xs text-red-700" role="alert">
              {error}
            </p>
          )}
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <p className="text-sm leading-relaxed text-ink-body">{t("payout.intro", { min: money(panel.limits.payoutMinCents) })}</p>
        {field(
          ids.holder,
          t("payout.holder"),
          invalid.holder,
          t("errors.invalid_name"),
          <input id={ids.holder} value={holder} onChange={(e) => setHolder(e.target.value)} autoComplete="name" maxLength={80} aria-invalid={checked && invalid.holder} className={INPUT} />,
        )}
        {editSaved ? (
          <>
            {field(
              ids.taxId,
              t("payout.taxId"),
              invalid.taxId,
              t("errors.invalid_tax_id"),
              <input id={ids.taxId} value={taxId} onChange={(e) => setTaxId(e.target.value)} placeholder="12345678Z" autoComplete="off" autoCapitalize="characters" maxLength={20} aria-invalid={checked && invalid.taxId} className={cx(INPUT, "uppercase")} />,
            )}
            {field(
              ids.iban,
              t("payout.iban"),
              invalid.iban,
              t("errors.invalid_iban"),
              <input id={ids.iban} value={iban} onChange={(e) => setIban(e.target.value)} placeholder="ES00 0000 0000 0000 0000 0000" autoComplete="off" autoCapitalize="characters" inputMode="text" maxLength={42} aria-invalid={checked && invalid.iban} aria-describedby={ids.hint} className={cx(INPUT, "uppercase tracking-wide")} />,
              <p id={ids.hint} className="mt-1 text-xs text-ink-muted">
                {t("payout.ibanHint")}
              </p>,
            )}
          </>
        ) : (
          saved && (
            <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-line bg-paper px-3.5 py-2.5">
              <dl className="min-w-0 text-sm">
                <div className="flex gap-2">
                  <dt className="font-bold text-ink-soft">{t("payout.taxId")}</dt>
                  <dd className="tabular-nums text-ink">{saved.taxId}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="font-bold text-ink-soft">{t("payout.iban")}</dt>
                  <dd className="tabular-nums text-ink">{saved.iban}</dd>
                </div>
              </dl>
              <button type="button" onClick={() => setEditSaved(true)} className="shrink-0 text-sm font-bold text-brand-text hover:underline">
                {t("payout.change")}
              </button>
            </div>
          )
        )}
        <button
          type="button"
          onClick={onSpendInstead}
          className="flex items-center gap-3 rounded-2xl bg-success/10 px-3.5 py-3 text-left transition-colors hover:bg-success/15"
          data-testid="creator-payout-nudge"
        >
          <span className="flex-1 text-sm leading-snug text-ink">
            {t.rich("payout.nudge", {
              amount: money(amount),
              double: money(amount * panel.limits.creditMultiplier),
              b: (chunks) => <strong>{chunks}</strong>,
            })}
          </span>
          <span className="shrink-0 text-sm font-bold text-success">{t("payout.nudgeCta")}</span>
        </button>
      </form>
    </Sheet>
  );
}
