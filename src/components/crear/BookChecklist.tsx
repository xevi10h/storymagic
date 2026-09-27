"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import ProtagonistAvatar, { type ProtagonistLook } from "@/components/avatar/ProtagonistAvatar";
import { INITIAL_STATE, type Gender } from "@/lib/create-store";
import { readStoredDraft } from "@/lib/creation-flow";
import { useDedicationAutosave } from "@/hooks/useDedicationAutosave";
import DedicationEditor from "./DedicationEditor";
import Sheet from "./Sheet";

interface StoryCharacter {
  name: string;
  age: number;
  gender: string;
  hair_color: string | null;
  skin_tone: string | null;
  eye_color: string | null;
  hairstyle: string | null;
}

interface BookChecklistProps {
  storyId: string;
  childName: string;
  character: StoryCharacter;
  /** The local draft created this story → it holds the exact look (glasses, freckles). */
  useDraftLook: boolean;
  title: string;
  titleSuggestions: string[];
  dedication: string;
  senderName: string;
  onTitleSaved: (title: string) => void;
  onDedicationSaved: (v: { dedication: string; senderName: string }) => void;
  onChangeLook: () => void;
}

type Panel = "protagonist" | "dedication" | "cover" | null;

const HEX = /^#[0-9a-f]{6}$/i;

function traitsFor(character: StoryCharacter, useDraftLook: boolean): ProtagonistLook {
  const draft = useDraftLook ? readStoredDraft() : null;
  if (draft) {
    const c = draft.character;
    return { gender: c.gender, age: c.age, skinTone: c.skinTone, hairColor: c.hairColor, hairstyle: c.hairstyle, eyeColor: c.eyeColor, glasses: c.glasses, freckles: c.freckles };
  }
  const d = INITIAL_STATE.character;
  return {
    gender: (["boy", "girl", "neutral"].includes(character.gender) ? character.gender : "neutral") as Gender,
    age: character.age,
    skinTone: character.skin_tone && HEX.test(character.skin_tone) ? character.skin_tone : d.skinTone,
    hairColor: character.hair_color && HEX.test(character.hair_color) ? character.hair_color : d.hairColor,
    hairstyle: character.hairstyle ?? d.hairstyle,
    eyeColor: character.eye_color && HEX.test(character.eye_color) ? character.eye_color : d.eyeColor,
    glasses: "none",
    freckles: false,
  };
}

/**
 * Screen 5 checklist (✓ Protagonista · ✓ Dedicatoria · Portada). Each chip opens
 * a sheet that edits in place; the parent never leaves the book to fix something.
 */
export default function BookChecklist({
  storyId,
  childName,
  character,
  useDraftLook,
  title,
  titleSuggestions,
  dedication,
  senderName,
  onTitleSaved,
  onDedicationSaved,
  onChangeLook,
}: BookChecklistProps) {
  const t = useTranslations("crear.checklist");
  const [open, setOpen] = useState<Panel>(null);
  const close = useCallback(() => setOpen(null), []);

  // "Portada" is ✓ once the parent has looked at / confirmed the title
  const reviewedKey = `meapica_cover_reviewed_${storyId}`;
  const [coverReviewed, setCoverReviewed] = useState(false);
  useEffect(() => {
    try {
      setCoverReviewed(sessionStorage.getItem(reviewedKey) === "1");
    } catch {
      // storage unavailable
    }
  }, [reviewedKey]);
  const markCoverReviewed = useCallback(() => {
    setCoverReviewed(true);
    try {
      sessionStorage.setItem(reviewedKey, "1");
    } catch {
      // storage unavailable
    }
  }, [reviewedKey]);

  // Dedication sheet state (autosaved)
  const ded = useDedicationAutosave(storyId, onDedicationSaved);
  const { init: initDed } = ded;
  useEffect(() => {
    initDed({ dedication, senderName });
  }, [initDed, dedication, senderName]);

  // Title sheet state
  const [titleDraft, setTitleDraft] = useState(title);
  const [savingTitle, setSavingTitle] = useState(false);
  const [titleError, setTitleError] = useState(false);
  useEffect(() => {
    if (open === "cover") {
      setTitleDraft(title);
      setTitleError(false);
    }
  }, [open, title]);

  const saveTitle = async () => {
    const next = titleDraft.trim();
    if (!next) return;
    if (next === title) {
      markCoverReviewed();
      return close();
    }
    setSavingTitle(true);
    setTitleError(false);
    try {
      const res = await fetch(`/api/stories/${storyId}/title`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: next }),
      });
      if (!res.ok) throw new Error(`title_${res.status}`);
      onTitleSaved(next);
      markCoverReviewed();
      close();
    } catch (err) {
      console.warn("[preview] saving title failed:", err);
      setTitleError(true);
    } finally {
      setSavingTitle(false);
    }
  };

  const hasDedication = (ded.values?.dedication ?? dedication).trim().length > 0;
  const items: { id: Exclude<Panel, null>; label: string; value: string; done: boolean }[] = [
    { id: "protagonist", label: t("protagonist"), value: childName, done: true },
    { id: "dedication", label: t("dedication"), value: hasDedication ? t("dedicationDone") : t("dedicationTodo"), done: hasDedication },
    { id: "cover", label: t("cover"), value: coverReviewed ? t("coverDone") : t("coverTodo"), done: coverReviewed },
  ];

  const primaryBtn =
    "rounded-full bg-create-primary px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-create-primary-hover disabled:opacity-60";

  return (
    <>
      <ul className="grid grid-cols-3 gap-1.5 sm:flex sm:justify-center sm:gap-2" aria-label={t("label")}>
        {items.map((item) => (
          <li key={item.id} className="min-w-0">
            <button
              type="button"
              onClick={() => setOpen(item.id)}
              data-testid={`chip-${item.id}`}
              className="flex w-full min-w-0 items-center gap-1 rounded-xl border-2 border-create-neutral bg-white px-1.5 py-2 text-left transition-colors sm:gap-2 sm:pl-2.5 sm:pr-3.5 hover:border-create-primary/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-create-primary"
            >
              <span
                aria-hidden
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full sm:h-6 sm:w-6 ${item.done ? "bg-create-primary text-white" : "border-2 border-create-neutral text-transparent"}`}
              >
                <span className="material-symbols-outlined text-xs sm:text-sm">check</span>
              </span>
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="truncate text-[11px] font-bold text-create-text-dark sm:text-xs">{item.label}</span>
                <span className="truncate text-[10px] text-create-text-sub sm:max-w-[150px] sm:text-[11px]">{item.value}</span>
              </span>
              <span className="sr-only">{item.done ? t("doneSr") : t("todoSr")}</span>
            </button>
          </li>
        ))}
      </ul>

      <Sheet
        open={open === "protagonist"}
        title={t("protagonistTitle", { name: childName })}
        onClose={close}
        closeLabel={t("close")}
        footer={
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={close} className="rounded-full px-5 py-2.5 text-sm font-bold text-create-text-sub hover:text-create-text">
              {t("keepLook")}
            </button>
            <button type="button" onClick={onChangeLook} className={primaryBtn}>
              {t("changeLook")}
            </button>
          </div>
        }
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="relative aspect-square w-40 overflow-hidden rounded-full bg-[#fbeee2] ring-4 ring-white shadow-md">
            <ProtagonistAvatar look={traitsFor(character, useDraftLook)} alt={childName} className="absolute inset-0 h-full w-full" />
          </div>
          <p className="font-display text-xl font-bold text-create-text-dark">{childName}</p>
          <p className="text-sm leading-relaxed text-create-text-sub">{t("changeLookNote", { name: childName })}</p>
        </div>
      </Sheet>

      <Sheet
        open={open === "dedication"}
        title={t("dedicationTitle")}
        onClose={() => {
          void ded.flush();
          close();
        }}
        closeLabel={t("close")}
        footer={
          <div className="flex justify-end">
            <button
              type="button"
              onClick={async () => {
                await ded.flush();
                close();
              }}
              className={primaryBtn}
            >
              {t("done")}
            </button>
          </div>
        }
      >
        {ded.values && (
          <DedicationEditor
            name={childName}
            dedication={ded.values.dedication}
            senderName={ded.values.senderName}
            saveState={ded.saveState}
            onChange={ded.update}
          />
        )}
      </Sheet>

      <Sheet
        open={open === "cover"}
        title={t("coverTitle")}
        onClose={close}
        closeLabel={t("close")}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => void saveTitle()}
              disabled={savingTitle || !titleDraft.trim()}
              className={primaryBtn}
            >
              {savingTitle ? t("saving") : titleDraft.trim() === title ? t("keepTitle") : t("saveTitle")}
            </button>
          </div>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void saveTitle();
          }}
          className="flex flex-col gap-3"
        >
          <label htmlFor="book-title" className="text-xs font-bold uppercase tracking-wide text-create-text">
            {t("titleLabel")}
          </label>
          <input
            id="book-title"
            type="text"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            maxLength={120}
            className="h-12 w-full rounded-2xl border-2 border-create-neutral bg-white px-4 text-base text-create-text-dark outline-none focus:border-create-primary"
          />
          {titleSuggestions.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {titleSuggestions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setTitleDraft(option)}
                  className={`rounded-full border-2 px-3 py-1.5 text-left text-xs font-semibold transition-colors ${
                    titleDraft === option
                      ? "border-create-primary bg-create-primary/10 text-create-primary"
                      : "border-create-neutral text-create-text hover:border-create-primary/40"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          )}
          {titleError && (
            <p role="alert" className="text-sm text-red-700">
              {t("titleError")}
            </p>
          )}
        </form>
      </Sheet>
    </>
  );
}
