"use client";

import { useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/lib/supabase/client";
import { STORY_TEMPLATES } from "@/lib/create-store";
import { useTranslations, useLocale } from "next-intl";
import LogoIcon from "@/components/LogoIcon";

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
  shipping_name: string | null;
  created_at: string;
  story_id: string;
  stories: {
    generated_text: { bookTitle?: string } | null;
    characters: { name: string } | null;
  } | null;
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
  created_at: string;
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
        <span className="material-symbols-outlined animate-spin text-4xl text-primary">
          progress_activity
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-cream px-4">
        <span className="material-symbols-outlined text-5xl text-red-400">error</span>
        <p className="mt-4 text-base text-text-main">{error}</p>
        <Link href="/" className="mt-6 text-sm text-primary hover:underline">
          {t("backHome")}
        </Link>
      </div>
    );
  }

  const tabs: { id: TabId; label: string; icon: string; count: number }[] = [
    { id: "stories", label: t("tabs.stories"), icon: "auto_stories", count: data?.stories.length ?? 0 },
    { id: "orders", label: t("tabs.orders"), icon: "shopping_bag", count: data?.orders.length ?? 0 },
    { id: "characters", label: t("tabs.characters"), icon: "face", count: data?.characters.length ?? 0 },
  ];

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border-light bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <LogoIcon className="h-7 w-7 text-primary" />
            <span className="font-display text-lg font-bold tracking-tight text-secondary">
              meapica
            </span>
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
              <span className="material-symbols-outlined text-lg">{tab.icon}</span>
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
        {activeTab === "characters" && <CharactersTab characters={data?.characters ?? []} t={t} />}
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
        icon="auto_stories"
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
              <span className="material-symbols-outlined text-xl text-text-muted">
                auto_stories
              </span>
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

        {/* Status + actions */}
        <div className="flex shrink-0 items-center gap-2">
          <StatusBadge status={story.status} label={statusLabel} styleMap={STORY_STATUS_STYLES} />

          {/* PDF download */}
          {hasReadyPdf && (
            <button
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="flex items-center gap-1.5 rounded-lg border border-border-light px-3 py-1.5 text-xs font-medium text-text-soft transition-colors hover:bg-cream hover:text-text-main disabled:opacity-50"
              aria-label={t("downloadPdf")}
            >
              {downloading ? (
                <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
              ) : (
                <span className="material-symbols-outlined text-sm">download</span>
              )}
              <span className="hidden sm:inline">PDF</span>
            </button>
          )}

          <Link
            href={actionHref}
            className="rounded-lg border border-border-light px-3 py-1.5 text-xs font-medium text-text-soft transition-colors hover:bg-cream hover:text-text-main"
          >
            <span className="hidden sm:inline">{actionLabel}</span>
            <span className="material-symbols-outlined text-sm sm:hidden">
              {story.status === "draft" ? "edit" : "visibility"}
            </span>
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

  return (
    <div className="space-y-3">
      {orders.map((order) => {
        const bookTitle =
          order.stories?.generated_text?.bookTitle ?? t("untitledStory");
        const characterName = order.stories?.characters?.name ?? "";
        const formatLabel = order.format === "hardcover" ? t("orderFormat.hardcover") : t("orderFormat.softcover");

        const statusLabel = t(`orderStatus.${order.status}` as "orderStatus.pending" | "orderStatus.paid" | "orderStatus.producing" | "orderStatus.shipped" | "orderStatus.delivered" | "orderStatus.cancelled");

        return (
          <div
            key={order.id}
            className="rounded-xl border border-border-light bg-white p-4 transition-shadow hover:shadow-sm"
          >
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
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-sm font-bold text-secondary tabular-nums">
                  {order.total.toFixed(2)} €
                </span>
                <StatusBadge status={order.status} label={statusLabel} styleMap={ORDER_STATUS_STYLES} />
              </div>
            </div>

            {/* Tracking info */}
            {order.tracking_number && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-cream p-3">
                <span className="material-symbols-outlined text-lg text-primary">
                  local_shipping
                </span>
                <div>
                  <p className="text-xs font-medium text-text-main">
                    {t("trackingNumber")}
                  </p>
                  <p className="text-xs text-text-muted font-mono">
                    {order.tracking_number}
                  </p>
                </div>
              </div>
            )}

            {order.shipping_name && !order.tracking_number && (
              <p className="mt-2 text-xs text-text-muted">
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

function CharactersTab({
  characters,
  t,
}: {
  characters: DashboardCharacter[];
  t: ReturnType<typeof useTranslations<"dashboard">>;
}) {
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
    <div className="grid gap-3 sm:grid-cols-2">
      {characters.map((char) => (
        <div
          key={char.id}
          className="rounded-xl border border-border-light bg-white p-4 transition-shadow hover:shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cream">
              <span className="material-symbols-outlined text-xl text-primary">
                {char.gender === "boy" ? "boy" : char.gender === "girl" ? "girl" : "face"}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-sm font-bold text-text-main">{char.name}</h3>
              <p className="text-xs text-text-muted">
                {genderLabel(char.gender)} · {char.age} {t("yearsOld")}
              </p>
            </div>
          </div>
          {char.interests.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {char.interests.map((interest) => (
                <span
                  key={interest}
                  className="rounded-full bg-badge-bg px-2 py-0.5 text-[10px] font-medium text-text-soft capitalize"
                >
                  {interest}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Empty State ────────────────────────────────────────────────────────────

function EmptyState({
  icon,
  title,
  description,
  ctaLabel,
  ctaHref,
}: {
  icon: string;
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-light bg-white py-16 px-4 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-cream">
        <span className="material-symbols-outlined text-3xl text-text-muted">{icon}</span>
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
