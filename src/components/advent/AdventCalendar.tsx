"use client";

// Advent calendar page body (/[locale]/advent, es + ca). Approved design: Main.dc.html
// (desktop with a child), DoorMobile.dc.html (an opened door), NoCharacterMobile.dc.html
// (no child yet). The server sends the 24 doors (story templates only for open ones); the
// child is resolved here: the signed-in visitor's saved character (GET /api/advent/me) or
// a name kept in this browser. Stories are personalised in the browser (no AI, no request).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { cx, focusRing } from "@/components/ui";
import { trackEvent } from "@/lib/tracking/consent";
import type { AdventOffer } from "@/lib/advent/email";
import type { AdventLocale } from "@/lib/advent/render";
import { adventDeName, adventNameIn, personalizeStory } from "@/lib/advent/personalize";
import { readStoredChild, resolveChild, writeStoredChild, type AdventAccountState, type StoredNameChild } from "./child-store";
import { ChildPortrait, DoorArt, formatDoorDate, type AdventDoorData } from "./shared";
import ChildChooser from "./ChildChooser";
import CharacterBuilder from "./CharacterBuilder";
import AdventSignup from "./AdventSignup";
import DoorReader from "./DoorReader";
import { AdventBookBand } from "./AdventBookBand";
import { pdfHref } from "./links";

export type { AdventDoorData } from "./shared";

export interface AdventCalendarProps {
  locale: AdventLocale;
  /** Dev-only "?now=" date, forwarded to the PDF route. */
  devNow: string | null;
  doors: AdventDoorData[];
  offer: AdventOffer;
  /** Reyes world still on sale: its last day, formatted ("6 de enero"); else null. */
  reyesUntil: string | null;
  compilation: boolean;
  signupOpen: boolean;
}

function readDoorParam(doors: AdventDoorData[]): number | null {
  const n = Number(new URLSearchParams(window.location.search).get("door"));
  return Number.isInteger(n) && doors[n - 1] && doors[n - 1].state !== "locked" ? n : null;
}

const NO_ACCOUNT: AdventAccountState = { signedIn: false, portraitEmail: null, character: null };

/** GET /api/advent/me; any failure = an anonymous visitor (name-only still works). */
async function fetchAccount(): Promise<AdventAccountState> {
  try {
    const res = await fetch("/api/advent/me", { cache: "no-store" });
    return res.ok ? ((await res.json()) as AdventAccountState) : NO_ACCOUNT;
  } catch {
    return NO_ACCOUNT;
  }
}

export default function AdventCalendar({ locale, devNow, doors, offer, reyesUntil, compilation, signupOpen }: AdventCalendarProps) {
  const t = useTranslations("advent");
  const openCount = doors.filter((d) => d.state !== "locked").length;
  const todayDoor = doors.find((d) => d.state === "today")?.door ?? null;

  const [account, setAccount] = useState<AdventAccountState | null>(null);
  const [stored, setStored] = useState<StoredNameChild | null>(null);
  const [ready, setReady] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [selected, setSelected] = useState<number>(todayDoor ?? Math.max(openCount, 1));
  const [reading, setReading] = useState<number | null>(null);
  const [pickPrompt, setPickPrompt] = useState(false);
  const chooserRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const loadAccount = useCallback(async () => setAccount(await fetchAccount()), []);

  useEffect(() => {
    void fetchAccount().then((data) => {
      setAccount(data);
      setStored(readStoredChild());
      setReady(true);
      // An email link (?door=5) opens that door directly.
      const fromUrl = readDoorParam(doors);
      if (fromUrl) {
        setSelected(fromUrl);
        setReading(fromUrl);
      }
    });
    const onPop = () => setReading(readDoorParam(doors));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [doors]);

  const child = useMemo(() => (ready && !choosing ? resolveChild(account, stored) : null), [ready, choosing, account, stored]);
  const deName = child ? adventDeName(locale, child.name, child.gender) : "";
  // Inside a sentence ("amb la Noa"): Catalan takes the personal article.
  const nameIn = child ? adventNameIn(locale, child.name, child.gender) : "";

  const story = useCallback(
    (n: number) => {
      const d = doors[n - 1];
      return d?.template && child ? personalizeStory(n, d.template, locale, child.name, child.gender) : null;
    },
    [doors, child, locale],
  );

  // ── Navigation between the calendar and an open door (history-backed) ──
  const openReader = useCallback(
    (n: number) => {
      const url = new URL(window.location.href);
      url.searchParams.set("door", String(n));
      window.history.pushState({ adventDoor: n }, "", url);
      setSelected(n);
      setReading(n);
      window.scrollTo({ top: 0 });
      trackEvent("door_open", { door: n });
    },
    [],
  );
  const closeReader = useCallback(() => {
    if ((window.history.state as { adventDoor?: number } | null)?.adventDoor) {
      window.history.back();
    } else {
      const url = new URL(window.location.href);
      url.searchParams.delete("door");
      window.history.replaceState(null, "", url);
      setReading(null);
    }
    window.scrollTo({ top: 0 });
  }, []);

  // An email link (?door=5) counts as a door open once the child is known.
  const trackedUrlDoor = useRef(false);
  useEffect(() => {
    if (reading && child && !trackedUrlDoor.current) {
      trackedUrlDoor.current = true;
      if (!(window.history.state as { adventDoor?: number } | null)?.adventDoor) trackEvent("door_open", { door: reading, source: "link" });
    }
  }, [reading, child]);

  const askForChild = useCallback(() => {
    setPickPrompt(true);
    chooserRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => nameInputRef.current?.focus({ preventScroll: true }), 350);
  }, []);

  const onDoorClick = useCallback(
    (n: number) => {
      if (!child) return askForChild();
      setSelected(n);
      // Phones and tablets: the door card sits below the grid, so open the door itself.
      if (!window.matchMedia("(min-width: 1024px)").matches) openReader(n);
    },
    [child, askForChild, openReader],
  );

  const chooseName = useCallback((name: string, gender: StoredNameChild["gender"]) => {
    const next = { name, gender, override: true };
    writeStoredChild(next);
    setStored(next);
    setChoosing(false);
    setPickPrompt(false);
  }, []);

  const backToSavedCharacter = useCallback(() => {
    writeStoredChild(null);
    setStored(null);
    setChoosing(false);
    setPickPrompt(false);
  }, []);

  const onCharacterSaved = useCallback(async () => {
    writeStoredChild(null);
    setStored(null);
    await loadAccount();
    setBuilderOpen(false);
    setChoosing(false);
    setPickPrompt(false);
  }, [loadAccount]);

  // ── Reader (DoorMobile.dc.html) ──
  if (reading && child) {
    const s = story(reading);
    const d = doors[reading - 1];
    if (s && d) {
      return (
        <DoorReader
          locale={locale}
          door={d}
          story={s}
          child={child}
          deName={deName}
          nameIn={nameIn}
          isToday={d.state === "today"}
          pdfUrl={pdfHref({ locale, door: reading, child, devNow })}
          offer={offer}
          reyesUntil={reyesUntil}
          onBack={closeReader}
        />
      );
    }
  }

  const sel = doors[selected - 1];
  const selStory = sel ? story(sel.door) : null;
  const beforeStart = openCount === 0;

  return (
    <div className="mx-auto max-w-[1200px] px-4 pb-16 pt-8 sm:px-6 sm:pt-12 lg:pb-20">
      {/* Hero + who the stories are for */}
      <section className="flex flex-wrap items-end justify-between gap-6 lg:gap-8">
        <div className="min-w-0 max-w-[680px] flex-[1_1_520px]">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-brand-text sm:text-[13px]">{t("eyebrow")}</p>
          <h1 className="mt-3 text-balance font-display text-[34px] font-semibold leading-[1.08] text-ink sm:text-[44px] lg:text-[52px]">
            {child ? t("h1WithName", { name: nameIn }) : t("h1")}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-ink-body sm:text-lg">{t("lead")}</p>
        </div>
        {child ? (
          <div className="flex w-full flex-[0_1_360px] items-center gap-3.5 rounded-[20px] border border-line bg-surface p-4" data-testid="advent-child-card">
            {child.source === "character" && (
              <ChildPortrait child={child} size={64} ring={3} alt={t("portraitAlt", { name: child.name, deName })} className="ring-2 ring-line-warm" priority />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs text-ink-muted">{t("storiesFor")}</p>
              <p className="mt-0.5 truncate font-display text-[22px] font-semibold text-ink" data-testid="advent-child-name">
                {child.name}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setChoosing(true)}
              className={cx(
                "min-h-11 rounded-full border border-brand/30 bg-brand-tint px-4 text-sm font-semibold text-brand-text transition-colors hover:border-brand",
                focusRing,
              )}
            >
              {t("change")}
            </button>
          </div>
        ) : !ready ? (
          <div aria-hidden className="h-[98px] w-full flex-[0_1_360px] animate-pulse rounded-[20px] border border-line bg-surface" />
        ) : null}
      </section>

      <section className="mt-8 flex flex-col gap-6 lg:mt-10 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:grid-rows-[auto_1fr] lg:gap-x-8 lg:gap-y-4">
        {/* Doors */}
        <div className="order-2 min-w-0 lg:col-start-1 lg:row-span-2 lg:row-start-1">
          <div className="mb-3 flex items-baseline justify-between lg:hidden">
            <h2 className="font-display text-xl font-semibold text-ink">{t("gridHeading")}</h2>
            {beforeStart && <span className="text-[13px] text-ink-muted">{t("opensOn")}</span>}
          </div>
          <ol className="grid grid-cols-4 gap-2.5 sm:grid-cols-6 sm:gap-3" data-testid="advent-grid">
            {doors.map((d) => (
              <li key={d.door}>
                {d.state === "locked" ? (
                  <div
                    aria-label={t("door.locked", { n: d.door, date: formatDoorDate(locale, d.door) })}
                    className="flex aspect-square flex-col items-center justify-center gap-0.5 rounded-2xl border-[1.5px] border-dashed border-line-warm bg-surface"
                    data-state="locked"
                  >
                    <span className="font-display text-[22px] font-semibold text-brand-deep sm:text-[28px]">{d.door}</span>
                    <span className="hidden text-xs text-ink-muted sm:block">{t("door.opens", { day: d.door })}</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onDoorClick(d.door)}
                    aria-label={t("door.open", { n: d.door })}
                    aria-pressed={child ? d.door === selected : undefined}
                    data-state={d.state}
                    className={cx(
                      "relative block aspect-square w-full overflow-hidden rounded-2xl bg-surface transition-colors",
                      focusRing,
                      child && d.door === selected ? "border-[3px] border-brand" : "border-[1.5px] border-line hover:border-brand",
                    )}
                  >
                    <DoorArt door={d} sizes="(min-width: 1024px) 120px, 25vw" />
                    <span className="absolute left-1.5 top-1.5 flex h-7 min-w-7 items-center justify-center rounded-full bg-paper px-2 font-display text-[15px] font-semibold text-ink sm:left-2 sm:top-2 sm:h-[30px] sm:min-w-[30px] sm:text-base">
                      {d.door}
                    </span>
                    {d.state === "today" && (
                      <span className="absolute bottom-1.5 left-1.5 rounded-full border border-brand bg-brand-tint px-2 py-0.5 text-[11px] font-bold text-brand-text sm:bottom-2 sm:left-2 sm:text-xs">
                        {t("door.today")}
                      </span>
                    )}
                  </button>
                )}
              </li>
            ))}
          </ol>
          <p className="mt-3.5 text-[13px] text-ink-muted">{t("gridNote")}</p>
          {compilation && child && (
            <a
              href={pdfHref({ locale, door: "all", child, devNow })}
              download
              className={cx("mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border-[1.5px] border-line-warm bg-surface px-4 text-[15px] font-semibold text-ink-soft hover:border-brand", focusRing)}
              data-testid="advent-compilation"
            >
              <span aria-hidden className="material-symbols-outlined !text-lg" data-icon="menu_book" />
              {t("compilation.cta")}
            </a>
          )}
        </div>

        {/* Aside: chooser or today's door, then the daily email */}
        {ready && !child && (
          <div ref={chooserRef} className="order-1 lg:col-start-2 lg:row-start-1">
            <ChildChooser
              prompt={pickPrompt || reading !== null}
              nameInputRef={nameInputRef}
              onCreate={() => setBuilderOpen(true)}
              onName={chooseName}
              onCancel={choosing && resolveChild(account, stored) ? () => setChoosing(false) : undefined}
              savedName={stored?.override && account?.character ? account.character.name : undefined}
              onUseSaved={backToSavedCharacter}
            />
          </div>
        )}

        {child && sel && (
          <div className="order-3 overflow-hidden rounded-[20px] border border-line bg-surface lg:col-start-2 lg:row-start-1 lg:self-start" data-testid="advent-door-card">
            <div className="relative">
              <div className="relative h-[200px] w-full">
                <DoorArt door={sel} sizes="(min-width: 1024px) 400px, 100vw" />
              </div>
              {child.source === "character" && <ChildPortrait child={child} size={72} ring={4} alt="" className="absolute -bottom-7 right-4" />}
            </div>
            <div className="p-5">
              {beforeStart || !selStory ? (
                <>
                  <p className="text-xs font-bold uppercase tracking-[0.06em] text-brand-text">{t("teaser.kicker")}</p>
                  <h2 className="mt-2 pr-16 font-display text-2xl font-semibold leading-tight text-ink">{t("teaser.title")}</h2>
                  <p className="mt-2.5 text-[15px] leading-relaxed text-ink-body">{t("teaser.text")}</p>
                </>
              ) : (
                <>
                  <p className="text-xs font-bold uppercase tracking-[0.06em] text-brand-text">
                    {t("door.kicker", { n: sel.door, date: formatDoorDate(locale, sel.door) })}
                  </p>
                  <h2 className="mt-2 pr-16 font-display text-2xl font-semibold leading-tight text-ink">{selStory.title}</h2>
                  <p className="mt-2.5 text-[15px] leading-relaxed text-ink-body">{selStory.teaser}</p>
                  <div className="mt-4 flex flex-wrap gap-2.5">
                    <button
                      type="button"
                      onClick={() => openReader(sel.door)}
                      className={cx(
                        "min-h-12 flex-auto rounded-[14px] bg-brand px-4 py-3 text-[19px] font-bold text-white transition-colors hover:bg-brand-hover",
                        focusRing,
                      )}
                      data-testid="advent-read"
                    >
                      {t("door.read")}
                    </button>
                    <a
                      href={pdfHref({ locale, door: sel.door, child, devNow })}
                      download
                      className={cx(
                        "flex min-h-12 items-center gap-1.5 rounded-[14px] border-[1.5px] border-line-warm bg-surface px-3.5 text-[15px] font-semibold text-ink-soft transition-colors hover:border-brand",
                        focusRing,
                      )}
                    >
                      <span aria-hidden className="material-symbols-outlined !text-lg" data-icon="download" />
                      {t("door.pdf")}
                    </a>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {signupOpen && (
          <div className="order-4 lg:col-start-2 lg:row-start-2 lg:self-start">
            <AdventSignup
              locale={locale}
              child={child}
              portraitEmail={account?.portraitEmail ?? null}
              beforeStart={beforeStart}
              onNeedName={askForChild}
            />
          </div>
        )}
      </section>

      <AdventBookBand locale={locale} child={child} nameIn={nameIn} deName={deName} offer={offer} variant="wide" />

      <CharacterBuilder open={builderOpen} locale={locale} initialName={stored?.name ?? ""} onClose={() => setBuilderOpen(false)} onSaved={onCharacterSaved} />
    </div>
  );
}
