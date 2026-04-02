"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useTranslations, useLocale } from "next-intl";
import Image from "next/image";
import BrandLogo from "@/components/BrandLogo";
import LocaleSwitcher from "@/components/LocaleSwitcher";

type ShowcaseBook = {
  id: string;
  title: string;
  coverUrl: string;
  characterName: string;
  characterAge: number;
};

export default function WaitlistPage() {
  const t = useTranslations("waitlist");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error" | "duplicate"
  >("idle");
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    setVisible(true);
  }, []);

  const SUPABASE = "https://rmxjtugoyfaxxkiiayss.supabase.co/storage/v1/object/public/illustrations";
  const books: ShowcaseBook[] = [
    {
      id: "teo",
      title: t("bookTeo"),
      coverUrl: `${SUPABASE}/f6b7a973-e2de-41f9-9b80-bd86c21febca/cover-1774593946858.png`,
      characterName: "Teo",
      characterAge: 7,
    },
    {
      id: "elena",
      title: t("bookElena"),
      coverUrl: `${SUPABASE}/waitlist-covers/elena.png`,
      characterName: "Elena",
      characterAge: 9,
    },
    {
      id: "amara",
      title: t("bookAmara"),
      coverUrl: `${SUPABASE}/waitlist-covers/amara.png`,
      characterName: "Amara",
      characterAge: 6,
    },
    {
      id: "kai",
      title: t("bookKai"),
      coverUrl: `${SUPABASE}/waitlist-covers/kai.png`,
      characterName: "Kai",
      characterAge: 4,
    },
  ];

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setStatus("loading");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name: name || undefined, locale }),
      });

      if (res.ok) {
        setStatus("success");
      } else if (res.status === 409) {
        setStatus("duplicate");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  const BOOK_ROTATIONS = ["-3", "1.5", "-1", "2.5", "-2"];

  return (
    <div className="relative min-h-screen overflow-hidden bg-cream">
      {/* Paper texture */}
      <div className="texture-overlay" />

      {/* Ambient warm blurs */}
      <div className="pointer-events-none absolute -top-40 right-0 h-[700px] w-[700px] translate-x-1/3 rounded-full bg-primary-light/12 blur-[140px]" />
      <div className="pointer-events-none absolute -bottom-20 left-0 h-[600px] w-[600px] -translate-x-1/4 rounded-full bg-badge-bg/25 blur-[120px]" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-sand/40 blur-[100px]" />

      {/* ─── Top bar ─── */}
      <nav className="relative z-20 flex items-center justify-between px-6 py-6 md:px-12">
        <BrandLogo className="h-7 text-secondary" />
        <LocaleSwitcher />
      </nav>

      {/* ─── Hero ─── */}
      <section
        className={`relative z-10 flex flex-col items-center px-6 pt-6 pb-6 md:pt-12 md:pb-10 transition-all duration-700 ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
        }`}
      >
        {/* Badge */}
        <div className="mb-6 inline-flex items-center gap-2.5 rounded-full border border-badge-border bg-white/80 px-5 py-2 shadow-sm backdrop-blur-sm">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
          </span>
          <span className="text-xs font-bold uppercase tracking-widest text-secondary">
            {t("badge")}
          </span>
        </div>

        {/* Headline */}
        <h1 className="max-w-3xl text-center font-display text-4xl font-bold leading-[1.1] tracking-tight text-secondary sm:text-5xl md:text-6xl lg:text-7xl">
          {t("titleStart")}{" "}
          <span className="italic text-primary">{t("titleHighlight")}</span>
          {t("titleEnd") && (
            <>
              <br />
              {t("titleEnd")}
            </>
          )}
        </h1>

        {/* Subtitle */}
        <p className="mt-5 max-w-xl text-center text-lg leading-relaxed text-text-soft md:text-xl">
          {t("subtitle")}
        </p>

        {/* Form / Success */}
        {status === "success" ? (
          <div className="mt-8 flex flex-col items-center gap-4 animate-fade-in">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-success/10">
              <span className="material-symbols-outlined text-4xl text-success">
                check_circle
              </span>
            </div>
            <h2 className="font-display text-2xl font-bold text-secondary">
              {t("success")}
            </h2>
            <p className="max-w-sm text-center text-text-soft">
              {t("successMessage")}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 w-full max-w-lg">
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("namePlaceholder")}
                className="h-14 flex-1 rounded-xl border border-border-light bg-white/90 px-5 text-text-main shadow-sm backdrop-blur-sm placeholder:text-text-muted transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("emailPlaceholder")}
                required
                className="h-14 flex-[1.5] rounded-xl border border-border-light bg-white/90 px-5 text-text-main shadow-sm backdrop-blur-sm placeholder:text-text-muted transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={status === "loading"}
              className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary text-lg font-bold text-white shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-xl hover:shadow-primary/25 active:translate-y-0 disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-lg"
            >
              {status === "loading" ? (
                <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <>
                  {t("cta")}
                  <span className="material-symbols-outlined text-xl">
                    arrow_forward
                  </span>
                </>
              )}
            </button>
            {status === "duplicate" && (
              <p className="mt-3 text-center text-sm font-medium text-primary">
                {t("alreadyRegistered")}
              </p>
            )}
            {status === "error" && (
              <p className="mt-3 text-center text-sm font-medium text-error">
                {t("error")}
              </p>
            )}
          </form>
        )}

        {/* Trust signals — right below CTA */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-medium text-text-muted">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-base text-success">
              forest
            </span>
            <span>{t("feature1Title")}</span>
          </div>
          <span className="hidden text-border-light sm:inline">|</span>
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-base text-primary">
              palette
            </span>
            <span>{t("feature2Title")}</span>
          </div>
          <span className="hidden text-border-light sm:inline">|</span>
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-base text-primary-hover">
              local_shipping
            </span>
            <span>{t("feature3Title")}</span>
          </div>
        </div>
      </section>

      {/* ─── Showcase Books ─── */}
      {books.length > 0 && (
        <section className="relative z-10 py-8 md:py-14">
          <h2 className="mb-8 text-center font-display text-2xl font-bold text-secondary md:mb-10 md:text-3xl">
            {t("previewTitle")}
          </h2>

          {/* Books grid — 2 cols mobile, 4 cols desktop */}
          <div className="mx-auto grid max-w-4xl grid-cols-2 gap-6 px-8 sm:grid-cols-4 sm:gap-8">
            {books.map((book, i) => (
              <BookCard
                key={book.id}
                book={book}
                rotate={BOOK_ROTATIONS[i % BOOK_ROTATIONS.length]}
                madeForLabel={t("madeFor")}
                yearsLabel={t("years")}
              />
            ))}
          </div>
        </section>
      )}

      {/* ─── Features (detailed) ─── */}
      <section className="relative z-10 pb-12 md:pb-16">
        <div className="mx-auto flex max-w-4xl flex-col gap-5 px-6 sm:flex-row sm:gap-6">
          <FeatureCard
            icon="forest"
            title={t("feature1Title")}
            description={t("feature1Description")}
          />
          <FeatureCard
            icon="palette"
            title={t("feature2Title")}
            description={t("feature2Description")}
          />
          <FeatureCard
            icon="local_shipping"
            title={t("feature3Title")}
            description={t("feature3Description")}
          />
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="relative z-10 border-t border-border-light py-8 text-center text-sm text-text-muted">
        {t("copyright")}
      </footer>
    </div>
  );
}

/* ─── Sub-components ─── */

function BookCard({
  book,
  rotate,
  madeForLabel,
  yearsLabel,
}: {
  book: ShowcaseBook;
  rotate: string;
  madeForLabel: string;
  yearsLabel: string;
}) {
  return (
    <div className="group">
      <div
        className="mx-auto w-full max-w-[200px] transition-all duration-500 group-hover:rotate-0 group-hover:-translate-y-2"
        style={{ transform: `rotate(${rotate}deg)` }}
      >
        {/* Book cover */}
        <div className="relative aspect-[3/4] overflow-hidden rounded-[2px_8px_8px_2px] shadow-[−5px_5px_15px_rgba(44,24,16,0.2),−1px_1px_4px_rgba(44,24,16,0.1)] book-shadow">
          {/* Spine highlight */}
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-3 bg-gradient-to-r from-black/15 to-transparent" />
          <Image
            src={book.coverUrl}
            alt={book.title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 640px) 160px, 192px"
          />
        </div>

        {/* Book info */}
        <div className="mt-3 px-1">
          <p className="truncate text-sm font-bold text-secondary">
            {book.title}
          </p>
          {book.characterName && (
            <p className="mt-0.5 text-xs text-text-muted">
              {madeForLabel} {book.characterName}, {book.characterAge}{" "}
              {yearsLabel}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex-1 rounded-2xl border border-border-light bg-white/60 p-6 backdrop-blur-sm transition-all hover:border-border-medium hover:shadow-md">
      <span className="material-symbols-outlined mb-3 text-3xl text-primary">
        {icon}
      </span>
      <h3 className="mb-2 font-display text-lg font-bold text-secondary">
        {title}
      </h3>
      <p className="text-sm leading-relaxed text-text-soft">{description}</p>
    </div>
  );
}
