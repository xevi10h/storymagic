"use client";

import React, { useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/lib/supabase/client";
import { STORY_TEMPLATES, getRecommendedTemplates } from "@/lib/create-store";
import { useTranslations, useLocale } from "next-intl";
import BrandLogo from "@/components/BrandLogo";
import BrandIcon from "@/components/BrandIcon";

// ── Types ──────────────────────────────────────────────────────────────────

interface DashboardStory {
  id: string;
  title: string | null;
  template_id: string;
  creation_mode: string;
  status: string;
  generated_text: { bookTitle?: string } | null;
  pdf_url: string | null;
  created_at: string;
  characters: { name: string; gender: string; age: number } | null;
}

interface DashboardOrder {
  id: string;
  format: string;
  status: string;
  subtotal: number;
  total: number;
  tracking_number: string | null;
  tracking_url: string | null;
  shipping_name: string | null;
  created_at: string;
  story_id: string;
  stories: {
    generated_text: { bookTitle?: string } | null;
    characters: { name: string } | null;
  } | null;
}

interface CharacterStory {
  id: string;
  title: string | null;
  status: string;
  template_id: string | null;
  generated_text: { bookTitle?: string; synopsis?: string } | null;
}

interface DashboardCharacter {
  id: string;
  name: string;
  gender: string;
  age: number;
  hair_color: string;
  skin_tone: string;
  hairstyle: string | null;
  interests: string[];
  avatar_url: string | null;
  created_at: string;
  stories: CharacterStory[];
}

interface DashboardData {
  stories: DashboardStory[];
  orders: DashboardOrder[];
  characters: DashboardCharacter[];
}

type TabId = "stories" | "orders" | "characters";

// ── Status helpers ─────────────────────────────────────────────────────────

const STORY_STATUS_STYLES: Record<string, { color: string; icon: string }> = {
  draft: { color: "bg-amber-100 text-amber-700", icon: "edit_note" },
  generating: { color: "bg-blue-100 text-blue-700", icon: "hourglass_top" },
  preview: { color: "bg-cyan-100 text-cyan-700", icon: "visibility" },
  completing: { color: "bg-blue-100 text-blue-700", icon: "hourglass_top" },
  ready: { color: "bg-emerald-100 text-emerald-700", icon: "check_circle" },
  ordered: { color: "bg-purple-100 text-purple-700", icon: "shopping_bag" },
  shipped: { color: "bg-indigo-100 text-indigo-700", icon: "local_shipping" },
  delivered: { color: "bg-emerald-100 text-emerald-700", icon: "inventory" },
};

const ORDER_STATUS_STYLES: Record<string, { color: string; icon: string }> = {
  pending: { color: "bg-amber-100 text-amber-700", icon: "schedule" },
  paid: { color: "bg-emerald-100 text-emerald-700", icon: "paid" },
  completed: { color: "bg-emerald-100 text-emerald-700", icon: "check_circle" },
  producing: { color: "bg-blue-100 text-blue-700", icon: "precision_manufacturing" },
  shipped: { color: "bg-indigo-100 text-indigo-700", icon: "local_shipping" },
  delivered: { color: "bg-emerald-100 text-emerald-700", icon: "inventory" },
  cancelled: { color: "bg-red-100 text-red-700", icon: "cancel" },
};

function StatusBadge({
  status,
  label,
  styleMap,
}: {
  status: string;
  label: string;
  styleMap: Record<string, { color: string; icon: string }>;
}) {
  const info = styleMap[status] ?? { color: "bg-gray-100 text-gray-600", icon: "help" };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${info.color}`}>
      <span className="material-symbols-outlined text-sm">{info.icon}</span>
      {label}
    </span>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("stories");
  const t = useTranslations("dashboard");
  const locale = useLocale();

  function formatDate(iso: string): string {
    return new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(iso));
  }

  useEffect(() => {
    if (authLoading) return;
    if (!user) return;

    async function fetchDashboard() {
      try {
        const res = await fetch("/api/dashboard");
        if (!res.ok) throw new Error("Failed to fetch dashboard");
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error loading dashboard");
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, [user, authLoading]);

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border-light border-t-primary" />
      </div>
    );
  }

  if (error || (!loading && data === null)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-cream px-4">
        <span className="material-symbols-outlined text-5xl text-red-400">error</span>
        <p className="mt-4 text-base text-text-main">
          {error ?? t("loadError")}
        </p>
        <Link href="/" className="mt-6 text-sm text-primary hover:underline">
          {t("backHome")}
        </Link>
      </div>
    );
  }

  const tabs: { id: TabId; label: string; icon?: string; IconComponent?: React.ComponentType<{ className?: string }>; count: number }[] = [
    { id: "stories", label: t("tabs.stories"), IconComponent: BrandIcon, count: data?.stories.length ?? 0 },
    { id: "orders", label: t("tabs.orders"), icon: "shopping_bag", count: data?.orders.length ?? 0 },
    { id: "characters", label: t("tabs.characters"), icon: "face", count: data?.characters.length ?? 0 },
  ];

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border-light bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center">
            <BrandLogo className="h-5 text-secondary" />
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/crear"
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white transition-all hover:bg-primary-hover active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-lg">add</span>
              <span className="hidden sm:inline">{t("newStory")}</span>
            </Link>
            <Link
              href="/perfil"
              className="flex h-9 w-9 items-center justify-center rounded-full text-text-soft transition-colors hover:bg-cream hover:text-text-main"
              aria-label={t("tabs.characters")}
            >
              <span className="material-symbols-outlined text-xl">settings</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Welcome section */}
      <div className="mx-auto max-w-5xl px-4 pt-8 sm:px-6">
        <h1 className="font-display text-2xl font-bold text-secondary sm:text-3xl">
          {t("greeting", { name: user?.user_metadata?.full_name || user?.email?.split("@")[0] || t("greetingDefault") })}
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          {t("subtitle")}
        </p>
      </div>

      {/* Tabs */}
      <div className="mx-auto max-w-5xl px-4 pt-6 sm:px-6">
        <div className="flex gap-1 rounded-xl border border-border-light bg-white p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-primary text-white shadow-sm"
                  : "text-text-soft hover:bg-cream hover:text-text-main"
              }`}
            >
              {tab.IconComponent ? (
                <tab.IconComponent className="h-4.5 w-auto" />
              ) : (
                <span className="material-symbols-outlined text-lg">{tab.icon}</span>
              )}
              <span className="hidden sm:inline">{tab.label}</span>
              {tab.count > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    activeTab === tab.id
                      ? "bg-white/20 text-white"
                      : "bg-badge-bg text-text-soft"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        {activeTab === "stories" && (
          <StoriesTab
            stories={data?.stories ?? []}
            t={t}
            formatDate={formatDate}
            onTitleUpdate={(storyId, newTitle) => {
              if (!data) return;
              setData({
                ...data,
                stories: data.stories.map((s) =>
                  s.id === storyId ? { ...s, title: newTitle } : s
                ),
              });
            }}
          />
        )}
        {activeTab === "orders" && <OrdersTab orders={data?.orders ?? []} t={t} formatDate={formatDate} />}
        {activeTab === "characters" && <CharactersTab characters={data?.characters ?? []} t={t} formatDate={formatDate} />}
      </div>
    </div>
  );
}

// ── Stories Tab ─────────────────────────────────────────────────────────────

function StoriesTab({
  stories,
  t,
  formatDate,
  onTitleUpdate,
}: {
  stories: DashboardStory[];
  t: ReturnType<typeof useTranslations<"dashboard">>;
  formatDate: (iso: string) => string;
  onTitleUpdate: (storyId: string, newTitle: string) => void;
}) {
  if (stories.length === 0) {
    return (
      <EmptyState
        IconComponent={BrandIcon}
        title={t("emptyStories.title")}
        description={t("emptyStories.description")}
        ctaLabel={t("emptyStories.cta")}
        ctaHref="/crear"
      />
    );
  }

  return (
    <div className="space-y-3">
      {stories.map((story) => (
        <StoryCard
          key={story.id}
          story={story}
          t={t}
          formatDate={formatDate}
          onTitleUpdate={onTitleUpdate}
        />
      ))}
    </div>
  );
}

function StoryCard({
  story,
  t,
  formatDate,
  onTitleUpdate,
}: {
  story: DashboardStory;
  t: ReturnType<typeof useTranslations<"dashboard">>;
  formatDate: (iso: string) => string;
  onTitleUpdate: (storyId: string, newTitle: string) => void;
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [downloading, setDownloading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const td = useTranslations("data");
  const template = STORY_TEMPLATES.find((tpl) => tpl.id === story.template_id);
  const templateTitle = template ? td(`templates.${template.id}.title`) : undefined;
  const title = story.title ?? story.generated_text?.bookTitle ?? templateTitle ?? t("untitledStory");
  const characterName = story.characters?.name ?? t("character");
  const hasReadyPdf = (story.status === "ready" || story.status === "ordered") && story.pdf_url;

  const actionHref =
    story.status === "preview"
      ? `/crear/${story.id}/preview`
      : story.status === "ready" || story.status === "ordered"
        ? `/crear/${story.id}/preview`
        : story.status === "generating" || story.status === "completing"
          ? `/crear/${story.id}/generar`
          : `/crear/${story.id}/generar`;

  const actionLabel =
    story.status === "preview" ? t("storyActions.viewPreview") :
    story.status === "ready" ? t("storyActions.viewStory") :
    story.status === "ordered" ? t("storyActions.viewStory") :
    story.status === "generating" || story.status === "completing" ? t("storyActions.viewProgress") :
    t("storyActions.continue");

  const statusLabel = t(`storyStatus.${story.status}` as "storyStatus.draft" | "storyStatus.generating" | "storyStatus.preview" | "storyStatus.completing" | "storyStatus.ready" | "storyStatus.ordered");

  function startEditing() {
    setTitleDraft(title);
    setEditingTitle(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  async function saveTitle() {
    const trimmed = titleDraft.trim();
    if (!trimmed || trimmed === title) {
      setEditingTitle(false);
      return;
    }

    const { error } = await supabase
      .from("stories")
      .update({ title: trimmed })
      .eq("id", story.id);

    if (!error) {
      onTitleUpdate(story.id, trimmed);
    }
    setEditingTitle(false);
  }

  async function handleDownloadPdf() {
    setDownloading(true);
    try {
      const res = await fetch(`/api/stories/${story.id}/pdf`);
      if (!res.ok) throw new Error("PDF generation failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title.replace(/[^a-zA-Z0-9\s]/g, "").trim() || "story"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF download error:", err);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="rounded-xl border border-border-light bg-white p-4 transition-shadow hover:shadow-sm">
      <div className="flex items-center gap-4">
        {/* Template icon */}
        <div className="hidden h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg sm:flex">
          {template?.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={template.image}
              alt={templateTitle ?? ""}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-cream">
              <BrandIcon className="h-7 w-auto text-text-muted" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          {editingTitle ? (
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveTitle();
                  if (e.key === "Escape") setEditingTitle(false);
                }}
                onBlur={saveTitle}
                className="w-full rounded-lg border border-primary/40 bg-white px-2 py-1 text-sm font-bold text-text-main outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          ) : (
            <div className="group flex items-center gap-1.5">
              <h3 className="truncate text-sm font-bold text-text-main">{title}</h3>
              <button
                onClick={startEditing}
                className="shrink-0 opacity-60 sm:opacity-0 transition-opacity group-hover:opacity-100"
                aria-label={t("editTitle")}
              >
                <span className="material-symbols-outlined text-base text-text-muted hover:text-primary">
                  edit
                </span>
              </button>
            </div>
          )}
          <p className="mt-0.5 text-xs text-text-muted">
            {characterName} · {formatDate(story.created_at)}
          </p>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-2">
          {/* PDF download */}
          {hasReadyPdf && (
            <button
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="flex items-center gap-1.5 rounded-lg border border-border-light px-3 py-1.5 text-xs font-medium text-text-soft transition-colors hover:bg-cream hover:text-text-main disabled:opacity-50"
              aria-label={t("downloadPdf")}
            >
              {downloading ? (
                <span className="material-symbols-outlined animate-spin text-sm leading-none">progress_activity</span>
              ) : (
                <span className="material-symbols-outlined text-sm leading-none">download</span>
              )}
              <span>PDF</span>
            </button>
          )}

          <Link
            href={actionHref}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              story.status === "ready" || story.status === "ordered"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                : story.status === "preview"
                  ? "bg-cyan-50 text-cyan-700 border border-cyan-200 hover:bg-cyan-100"
                  : "border border-border-light text-text-soft hover:bg-cream hover:text-text-main"
            }`}
          >
            {actionLabel}
            <span className="material-symbols-outlined text-sm leading-none">arrow_forward</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Orders Tab ─────────────────────────────────────────────────────────────

function OrdersTab({
  orders,
  t,
  formatDate,
}: {
  orders: DashboardOrder[];
  t: ReturnType<typeof useTranslations<"dashboard">>;
  formatDate: (iso: string) => string;
}) {
  if (orders.length === 0) {
    return (
      <EmptyState
        icon="shopping_bag"
        title={t("emptyOrders.title")}
        description={t("emptyOrders.description")}
        ctaLabel={t("emptyOrders.cta")}
        ctaHref="/crear"
      />
    );
  }

  // Order lifecycle steps for physical orders
  const STEPS = ["paid", "producing", "shipped", "delivered"] as const;

  function getStepIndex(status: string): number {
    const idx = STEPS.indexOf(status as typeof STEPS[number]);
    // cancelled/pending → show at step 0
    return idx >= 0 ? idx : 0;
  }

  return (
    <div className="space-y-4">
      {orders.map((order) => {
        const bookTitle =
          order.stories?.generated_text?.bookTitle ?? t("untitledStory");
        const characterName = order.stories?.characters?.name ?? "";
        const formatLabel = order.format === "hardcover" ? t("orderFormat.hardcover") : t("orderFormat.softcover");
        const isCancelled = order.status === "cancelled";
        const currentStep = getStepIndex(order.status);

        return (
          <div
            key={order.id}
            className="rounded-xl border border-border-light bg-white p-5 transition-shadow hover:shadow-sm"
          >
            {/* Header: title + price */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-bold text-text-main">
                  {bookTitle}
                </h3>
                <p className="mt-0.5 text-xs text-text-muted">
                  {characterName && `${characterName} · `}
                  {formatLabel} · {formatDate(order.created_at)}
                </p>
              </div>
              <span className="shrink-0 text-sm font-bold text-text-main tabular-nums">
                {order.total.toFixed(2)} €
              </span>
            </div>

            {/* Step tracker */}
            {!isCancelled ? (
              <div className="mt-5">
                <div className="flex items-center">
                  {STEPS.map((step, i) => {
                    const isCompleted = i < currentStep;
                    const isActive = i === currentStep;
                    const isLast = i === STEPS.length - 1;
                    const stepLabel = t(`orderStatus.${step}` as "orderStatus.paid" | "orderStatus.producing" | "orderStatus.shipped" | "orderStatus.delivered");

                    return (
                      <div key={step} className={`flex items-center ${isLast ? "" : "flex-1"}`}>
                        {/* Step circle */}
                        <div className="flex flex-col items-center">
                          <div
                            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs transition-colors ${
                              isCompleted
                                ? "bg-emerald-500 text-white"
                                : isActive
                                  ? "bg-primary text-white ring-4 ring-primary/15"
                                  : "bg-gray-100 text-gray-400"
                            }`}
                          >
                            {isCompleted ? (
                              <span className="material-symbols-outlined text-[16px]">check</span>
                            ) : (
                              <span className="material-symbols-outlined text-[16px]">
                                {step === "paid" && "receipt_long"}
                                {step === "producing" && "precision_manufacturing"}
                                {step === "shipped" && "local_shipping"}
                                {step === "delivered" && "inventory"}
                              </span>
                            )}
                          </div>
                          <span
                            className={`mt-1.5 text-[10px] font-medium whitespace-nowrap ${
                              isCompleted
                                ? "text-emerald-600"
                                : isActive
                                  ? "text-primary font-semibold"
                                  : "text-gray-400"
                            }`}
                          >
                            {stepLabel}
                          </span>
                        </div>

                        {/* Connector line */}
                        {!isLast && (
                          <div
                            className={`mx-1.5 h-0.5 flex-1 rounded-full transition-colors ${
                              i < currentStep ? "bg-emerald-500" : "bg-gray-200"
                            }`}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2">
                <span className="material-symbols-outlined text-base text-red-500">cancel</span>
                <span className="text-xs font-medium text-red-700">{t("orderStatus.cancelled")}</span>
              </div>
            )}

            {/* Tracking info (shown when shipped or delivered) */}
            {order.tracking_number && (
              <div className="mt-4 flex items-center gap-2.5 rounded-lg bg-indigo-50/70 px-3.5 py-2.5">
                <span className="material-symbols-outlined text-base text-indigo-500">
                  package_2
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-400">
                    {t("trackingNumber")}
                  </p>
                  {order.tracking_url ? (
                    <a
                      href={order.tracking_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-indigo-700 underline decoration-indigo-300 underline-offset-2 hover:text-indigo-900 transition-colors"
                    >
                      {order.tracking_number}
                    </a>
                  ) : (
                    <p className="text-xs font-mono text-indigo-700">
                      {order.tracking_number}
                    </p>
                  )}
                </div>
                {order.tracking_url && (
                  <a
                    href={order.tracking_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 rounded-md bg-indigo-100 px-2.5 py-1.5 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-200 transition-colors"
                  >
                    {t("orderStatus.shipped") === "Enviado" ? "Seguir envío" : "Track"}
                    <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                  </a>
                )}
              </div>
            )}

            {/* Shipping name (before tracking is available) */}
            {order.shipping_name && !order.tracking_number && order.status !== "cancelled" && (
              <p className="mt-3 text-xs text-text-muted">
                {t("shippingTo", { name: order.shipping_name })}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Characters Tab ─────────────────────────────────────────────────────────

const INTEREST_STYLE: Record<string, { bg: string; text: string }> = {
  space:     { bg: "bg-indigo-50",  text: "text-indigo-700" },
  animals:   { bg: "bg-emerald-50", text: "text-emerald-700" },
  sports:    { bg: "bg-sky-50",     text: "text-sky-700" },
  castles:   { bg: "bg-purple-50",  text: "text-purple-700" },
  dinosaurs: { bg: "bg-lime-50",    text: "text-lime-700" },
  music:     { bg: "bg-amber-50",   text: "text-amber-700" },
};

/** Portrait image or initial-letter fallback */
function CharacterPortrait({ char, size }: { char: DashboardCharacter; size: number }) {
  if (char.avatar_url) {
    return (
      <img
        src={char.avatar_url}
        alt={char.name}
        className="rounded-full object-cover ring-2 ring-border-light"
        style={{ width: size, height: size }}
      />
    );
  }
  // Fallback: initial letter circle
  return (
    <div
      className="rounded-full bg-cream flex items-center justify-center ring-2 ring-border-light"
      style={{ width: size, height: size }}
    >
      <span className="font-display font-bold text-text-muted" style={{ fontSize: size * 0.4 }}>
        {char.name.charAt(0).toUpperCase()}
      </span>
    </div>
  );
}

function getStoryTitle(story: CharacterStory, fallback: string): string {
  return story.title ?? story.generated_text?.bookTitle ?? fallback;
}

function getStoryHref(story: CharacterStory): string {
  return story.status === "preview" || story.status === "ready" || story.status === "ordered"
    ? `/crear/${story.id}/preview`
    : `/crear/${story.id}/generar`;
}

function CharactersTab({
  characters,
  t,
  formatDate,
}: {
  characters: DashboardCharacter[];
  t: ReturnType<typeof useTranslations<"dashboard">>;
  formatDate: (iso: string) => string;
}) {
  const [selectedCharacter, setSelectedCharacter] = useState<DashboardCharacter | null>(null);
  const td = useTranslations("data");

  if (characters.length === 0) {
    return (
      <EmptyState
        icon="face"
        title={t("emptyCharacters.title")}
        description={t("emptyCharacters.description")}
        ctaLabel={t("emptyCharacters.cta")}
        ctaHref="/crear"
      />
    );
  }

  const genderLabel = (g: string) =>
    g === "boy" ? t("gender.boy") : g === "girl" ? t("gender.girl") : t("gender.neutral");

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        {characters.map((char) => {
          const storyCount = char.stories?.length ?? 0;
          const recentStories = (char.stories ?? []).slice(0, 3);

          return (
            <div
              key={char.id}
              className="flex flex-col rounded-xl border border-border-light bg-white overflow-hidden transition-shadow hover:shadow-md"
            >
              {/* Card header */}
              <div className="flex items-center gap-4 p-4">
                {/* Avatar */}
                <div className="shrink-0">
                  <CharacterPortrait char={char} size={64} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-base font-bold text-text-main">{char.name}</h3>
                  <p className="text-xs text-text-muted">
                    {genderLabel(char.gender)} · {char.age} {t("yearsOld")}
                  </p>
                  {char.interests.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {char.interests.slice(0, 4).map((interest) => {
                        const style = INTEREST_STYLE[interest] ?? { bg: "bg-badge-bg", text: "text-text-soft" };
                        return (
                          <span
                            key={interest}
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${style.bg} ${style.text}`}
                          >
                            {td(`interests.${interest}`)}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Stories section */}
              {storyCount > 0 ? (
                <div className="border-t border-border-light px-4 py-3 space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                    {t("bookCount", { count: storyCount })}
                  </p>
                  {recentStories.map((story) => (
                    <Link
                      key={story.id}
                      href={getStoryHref(story)}
                      className="flex items-center justify-between rounded-lg bg-cream px-3 py-2 transition-colors hover:bg-border-light"
                    >
                      <span className="truncate text-xs font-medium text-text-main">
                        {getStoryTitle(story, t("untitledStory"))}
                      </span>
                      <span className={`ml-2 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        story.status === "ready" || story.status === "ordered"
                          ? "bg-emerald-100 text-emerald-700"
                          : story.status === "preview"
                            ? "bg-cyan-100 text-cyan-700"
                            : "bg-amber-100 text-amber-700"
                      }`}>
                        {t(`storyStatus.${story.status}` as "storyStatus.draft")}
                      </span>
                    </Link>
                  ))}
                  {storyCount > 3 && (
                    <p className="text-[10px] text-text-muted pl-1">
                      {t("moreBooks", { count: storyCount - 3 })}
                    </p>
                  )}
                </div>
              ) : (
                <div className="border-t border-border-light px-4 py-3">
                  <p className="text-xs text-text-muted italic">{t("noBooksYet")}</p>
                </div>
              )}

              {/* Footer actions */}
              <div className="flex items-center gap-2 border-t border-border-light p-3 mt-auto">
                <button
                  onClick={() => setSelectedCharacter(char)}
                  className="flex-1 rounded-lg border border-border-light px-3 py-2 text-xs font-medium text-text-soft transition-colors hover:bg-cream hover:text-text-main"
                >
                  {t("viewDetail")}
                </button>
                <Link
                  href="/crear"
                  className="flex-1 rounded-lg bg-primary px-3 py-2 text-center text-xs font-bold text-white transition-colors hover:bg-primary-hover"
                >
                  {t("createBook")}
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Character detail modal */}
      {selectedCharacter && (
        <CharacterDetailModal
          character={selectedCharacter}
          t={t}
          formatDate={formatDate}
          onClose={() => setSelectedCharacter(null)}
        />
      )}
    </>
  );
}

// ── Character Detail Modal ──────────────────────────────────────────────────

function CharacterDetailModal({
  character,
  t,
  formatDate,
  onClose,
}: {
  character: DashboardCharacter;
  t: ReturnType<typeof useTranslations<"dashboard">>;
  formatDate: (iso: string) => string;
  onClose: () => void;
}) {
  const td = useTranslations("data");
  const genderLabel = (g: string) =>
    g === "boy" ? t("gender.boy") : g === "girl" ? t("gender.girl") : t("gender.neutral");

  // Suggested templates: scored by age+interests, excluding already-done ones
  const usedTemplateIds = new Set(
    (character.stories ?? []).map((s) => s.template_id).filter(Boolean)
  );
  const suggestedTemplates = getRecommendedTemplates(character.age, character.interests)
    .filter((tpl) => !usedTemplateIds.has(tpl.id))
    .slice(0, 3);

  // Close on Escape
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl bg-white max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-5 p-6 pb-5">
          <div className="shrink-0">
            <CharacterPortrait char={character} size={88} />
          </div>
          <div className="min-w-0 flex-1 pt-1">
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-display text-xl font-bold text-secondary">{character.name}</h2>
              <button
                onClick={onClose}
                className="shrink-0 rounded-lg p-1 text-text-muted transition-colors hover:bg-cream hover:text-text-main"
                aria-label="Cerrar"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>
            <p className="mt-0.5 text-sm text-text-muted">
              {genderLabel(character.gender)} · {character.age} {t("yearsOld")}
            </p>
            {character.interests.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {character.interests.map((interest) => {
                  const style = INTEREST_STYLE[interest] ?? { bg: "bg-badge-bg", text: "text-text-soft" };
                  return (
                    <span
                      key={interest}
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${style.bg} ${style.text}`}
                    >
                      {td(`interests.${interest}`)}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Stories lived */}
        <div className="border-t border-border-light px-6 py-5">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            {t("storiesLived")} {(character.stories ?? []).length > 0 && `(${character.stories.length})`}
          </p>
          {(character.stories ?? []).length === 0 ? (
            <p className="text-sm text-text-muted italic">{t("noStoriesYet")}</p>
          ) : (
            <div className="space-y-3">
              {(character.stories ?? []).map((story) => {
                const synopsis = story.generated_text?.synopsis;
                return (
                  <Link
                    key={story.id}
                    href={getStoryHref(story)}
                    onClick={onClose}
                    className="group block rounded-xl bg-cream px-4 py-3.5 transition-colors hover:bg-border-light"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-text-main leading-snug">
                        {getStoryTitle(story, t("untitledStory"))}
                      </p>
                      <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${
                          story.status === "ready" || story.status === "ordered"
                            ? "bg-emerald-100 text-emerald-700"
                            : story.status === "preview"
                              ? "bg-cyan-100 text-cyan-700"
                              : "bg-amber-100 text-amber-700"
                        }`}>
                          {t(`storyStatus.${story.status}` as "storyStatus.draft")}
                        </span>
                        <span className="material-symbols-outlined text-sm text-text-muted transition-transform group-hover:translate-x-0.5">
                          arrow_forward
                        </span>
                      </div>
                    </div>
                    {synopsis && (
                      <p className="mt-1.5 text-xs text-text-muted line-clamp-2 leading-relaxed">
                        {synopsis}
                      </p>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Suggested new adventures */}
        {suggestedTemplates.length > 0 && (
          <div className="border-t border-border-light px-6 py-5 pb-6">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              {t("newAdventuresFor", { name: character.name })}
            </p>
            <p className="mb-4 text-xs text-text-muted">{t("newAdventuresHint")}</p>
            <div className="space-y-3">
              {suggestedTemplates.map((tpl, idx) => (
                <div key={tpl.id} className="relative">
                  {idx === 0 && (
                    <div className="mb-1.5 flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-semibold text-amber-700">
                        <span className="material-symbols-outlined text-[12px]">kid_star</span>
                        {t("recommendedFor", { name: character.name })}
                      </span>
                    </div>
                  )}
                  <Link
                    href={`/crear?template=${tpl.id}&characterId=${character.id}`}
                    onClick={onClose}
                    className="group flex items-center gap-4 rounded-xl border border-border-light bg-white p-4 transition-all hover:border-transparent hover:shadow-md"
                    style={{ borderLeftWidth: "4px", borderLeftColor: tpl.themeColor }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-text-main">
                          {td(`templates.${tpl.id}.title`)}
                        </p>
                        <span className="shrink-0 rounded-full bg-cream px-2 py-0.5 text-[10px] font-medium text-text-muted">
                          {tpl.ageRange}
                        </span>
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-xs text-text-muted">
                        {td(`templates.${tpl.id}.description`)}
                      </p>
                    </div>
                    <span className="material-symbols-outlined shrink-0 text-sm text-text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-primary">
                      arrow_forward
                    </span>
                  </Link>
                </div>
              ))}
            </div>

            {/* Fallback CTA when all templates are done */}
          </div>
        )}

        {/* If all templates used, show simple CTA */}
        {suggestedTemplates.length === 0 && (
          <div className="border-t border-border-light px-6 py-5">
            <p className="mb-3 text-sm text-text-muted">{t("allAdventuresDone", { name: character.name })}</p>
            <Link
              href={`/crear?characterId=${character.id}`}
              onClick={onClose}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-white transition-colors hover:bg-primary-hover active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-lg">add</span>
              {t("createBook")}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Empty State ────────────────────────────────────────────────────────────

function EmptyState({
  icon,
  IconComponent,
  title,
  description,
  ctaLabel,
  ctaHref,
}: {
  icon?: string;
  IconComponent?: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-light bg-white py-16 px-4 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-cream">
        {IconComponent ? (
          <IconComponent className="h-9 w-auto text-text-muted" />
        ) : (
          <span className="material-symbols-outlined text-3xl text-text-muted">{icon}</span>
        )}
      </div>
      <h3 className="font-display text-lg font-bold text-secondary">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-text-muted">{description}</p>
      <Link
        href={ctaHref}
        className="mt-6 flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-primary-hover active:scale-[0.98]"
      >
        <span className="material-symbols-outlined text-lg">add</span>
        {ctaLabel}
      </Link>
    </div>
  );
}
