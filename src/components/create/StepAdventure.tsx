"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import {
  STORY_TEMPLATES,
  getRecommendedTemplates,
  type CharacterData,
  type StoryDecisions,
  type TreeChoice,
} from "@/lib/create-store";
import { loadStoryTree, tx } from "@/lib/story-trees/loaders";
import type { StoryTree, TreeNode, TreeOption } from "@/lib/story-trees/types";
import { PATH_ART } from "@/lib/story-trees/art-manifest";
import { ADVENTURE_CHAPTERS } from "@/lib/creation-flow";
import { buttonClass } from "@/components/ui";
import LiveCover from "./LiveCover";
import CreationFooterNav from "./CreationFooterNav";
import { BrandLoader } from "@/components/ui/BrandLoader";

interface StepAdventureProps {
  character: CharacterData;
  selectedTemplate: string | null;
  decisions: StoryDecisions;
  saving: boolean;
  onSelectTemplate: (id: string) => void;
  onSetTreePath: (path: TreeChoice[]) => void;
  onCreate: () => void;
  onBack: () => void;
}

/** Walk the saved path and return the node asked at each chapter (1-based). */
function nodesAlongPath(tree: StoryTree, path: TreeChoice[]): TreeNode[] {
  const nodes: TreeNode[] = [];
  let node: TreeNode | undefined = tree.nodes[tree.root];
  for (let chapter = 1; chapter <= ADVENTURE_CHAPTERS && node && node.options.length > 0; chapter++) {
    nodes.push(node);
    const choice: TreeChoice | undefined = path[chapter - 1];
    if (!choice || choice.nodeId !== node.id) break;
    const option: TreeOption | undefined = node.options.find((o) => o.id === choice.optionId);
    node = option?.next ? tree.nodes[option.next] : undefined;
  }
  return nodes;
}

/** Only the prefix of the path that is still valid for this tree. */
function validPath(tree: StoryTree, path: TreeChoice[]): TreeChoice[] {
  const nodes = nodesAlongPath(tree, path);
  const out: TreeChoice[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const c = path[i];
    if (!c || c.nodeId !== nodes[i].id || !nodes[i].options.some((o) => o.id === c.optionId)) break;
    out.push(c);
  }
  return out;
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Screen 3 — the adventure: world + the 3 chapter decisions of its branching
 * tree, all on one screen. Every choice is editable in place; changing an
 * earlier chapter keeps nothing that no longer follows from it.
 */
export default function StepAdventure({
  character,
  selectedTemplate,
  decisions,
  saving,
  onSelectTemplate,
  onSetTreePath,
  onCreate,
  onBack,
}: StepAdventureProps) {
  const t = useTranslations("crear.adventure");
  const td = useTranslations("data");
  const locale = useLocale();
  const name = character.name.trim();
  const fill = (s: string) => s.replaceAll("{name}", name);

  const worlds = useMemo(
    () => getRecommendedTemplates(character.age ?? 6, character.interests ?? []),
    [character.age, character.interests],
  );

  // The selected world's tree, loaded as its own chunk. Results are keyed by
  // template so a stale load never shows under another world.
  const [loaded, setLoaded] = useState<{ templateId: string; tree: StoryTree } | null>(null);
  const [failedFor, setFailedFor] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    if (!selectedTemplate) return;
    let alive = true;
    const pending = loadStoryTree(selectedTemplate) ?? Promise.reject(new Error("no_tree"));
    pending
      .then((tree) => {
        if (!alive) return;
        setLoaded({ templateId: selectedTemplate, tree });
        setFailedFor(null);
      })
      .catch((err) => {
        console.warn("[create] story tree failed to load:", err);
        if (alive) setFailedFor(selectedTemplate);
      });
    return () => {
      alive = false;
    };
  }, [selectedTemplate, reloadKey]);
  const tree = loaded && loaded.templateId === selectedTemplate ? loaded.tree : null;
  const treeError = !!selectedTemplate && failedFor === selectedTemplate && !tree;

  const rawPath = useMemo(() => decisions.treePath ?? [], [decisions.treePath]);
  const path = tree && tree.templateId === selectedTemplate ? validPath(tree, rawPath) : [];
  const chapters = tree && tree.templateId === selectedTemplate ? nodesAlongPath(tree, path) : [];
  const complete = !!selectedTemplate && path.length === ADVENTURE_CHAPTERS;

  // Drop choices that no longer belong to this tree (e.g. restored stale draft)
  useEffect(() => {
    if (!tree || tree.templateId !== selectedTemplate) return;
    const valid = validPath(tree, rawPath);
    if (valid.length !== rawPath.length) onSetTreePath(valid);
  }, [tree, selectedTemplate, rawPath, onSetTreePath]);

  // Bring the next open question into view after each choice
  const sectionRefs = useRef<Record<number, HTMLElement | null>>({});
  const pendingScroll = useRef<number | null>(null);
  useEffect(() => {
    const target = pendingScroll.current;
    if (target == null) return;
    const el = sectionRefs.current[target];
    if (!el) return;
    pendingScroll.current = null;
    el.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  });

  const chooseWorld = (id: string) => {
    if (id !== selectedTemplate) {
      onSelectTemplate(id);
      pendingScroll.current = 1;
    }
  };

  const choose = (chapterIndex: number, node: TreeNode, option: TreeOption) => {
    const next = path.slice(0, chapterIndex);
    next.push({ nodeId: node.id, optionId: option.id });
    onSetTreePath(next);
    pendingScroll.current = chapterIndex + 2 <= ADVENTURE_CHAPTERS ? chapterIndex + 2 : 99;
  };

  const themeGradient =
    STORY_TEMPLATES.find((x) => x.id === selectedTemplate)?.themeGradient ?? "from-amber-500 to-orange-600";

  const sectionClass = "scroll-mt-[calc(var(--creation-header-h,0px)+1rem)]";

  return (
    <>
      <main className="step-in mx-auto flex w-full max-w-[1200px] flex-1 flex-col px-4 pb-10 pt-4 sm:px-6 lg:flex-row lg:gap-12 lg:pt-8">
        {/* Desktop: the cover follows the parent's choices */}
        <aside className="hidden lg:block lg:w-[360px] lg:shrink-0">
          <div className="sticky" style={{ top: "calc(var(--creation-header-h, 0px) + 2rem)" }}>
            <LiveCover name={name} gender={character.gender} templateId={selectedTemplate} sizes="360px" />
            <ol className="mt-5 flex flex-col gap-2 text-sm" aria-label={t("summaryLabel")}>
              <li className="flex items-center gap-2">
                <span aria-hidden className={`material-symbols-outlined text-lg ${selectedTemplate ? "text-brand-text" : "text-create-text-sub/50"}`}>
                  {selectedTemplate ? "check_circle" : "radio_button_unchecked"}
                </span>
                <span className="font-bold text-create-text">{t("worldLabel")}</span>
                {selectedTemplate && <span className="truncate text-create-text-sub">{td(`templates.${selectedTemplate}.title`)}</span>}
              </li>
              {Array.from({ length: ADVENTURE_CHAPTERS }, (_, i) => {
                const choice = path[i];
                const opt = choice ? chapters[i]?.options.find((o) => o.id === choice.optionId) : undefined;
                return (
                  <li key={i} className="flex items-center gap-2">
                    <span aria-hidden className={`material-symbols-outlined text-lg ${opt ? "text-brand-text" : "text-create-text-sub/50"}`}>
                      {opt ? "check_circle" : "radio_button_unchecked"}
                    </span>
                    <span className="font-bold text-create-text">{t("chapter", { n: i + 1 })}</span>
                    {opt && <span className="truncate text-create-text-sub">{tx(opt.title, locale)}</span>}
                  </li>
                );
              })}
            </ol>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-8">
          {/* Heading (+ mini cover on mobile) */}
          <div className="flex items-center gap-4">
            <div className="w-[84px] shrink-0 lg:hidden">
              <LiveCover name={name} gender={character.gender} templateId={selectedTemplate} sizes="84px" />
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-[24px] font-bold leading-tight text-create-text-dark sm:text-4xl">
                {t("title", { name })}
              </h1>
              <p className="mt-1 text-sm font-medium text-create-text-sub sm:text-base">{t("subtitle")}</p>
            </div>
          </div>

          {/* World */}
          <section aria-labelledby="adv-world" className={sectionClass}>
            <h2 id="adv-world" className="mb-3 font-display text-lg font-bold text-create-text-dark sm:text-xl">
              {t("worldQuestion", { name })}
            </h2>
            <div
              role="radiogroup"
              aria-labelledby="adv-world"
              className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 xl:grid-cols-5"
            >
              {worlds.map((w) => {
                const selected = w.id === selectedTemplate;
                return (
                  <button
                    key={w.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => chooseWorld(w.id)}
                    className={`group relative flex w-[38vw] max-w-[168px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border-2 bg-white text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-create-primary sm:w-auto sm:max-w-none ${
                      selected ? "border-create-primary" : "border-transparent hover:border-create-primary/40"
                    }`}
                  >
                    <span className="relative block aspect-square w-full bg-create-neutral">
                      <Image src={w.image} alt="" fill sizes="(max-width:640px) 38vw, 180px" className="object-cover" />
                      {selected && (
                        <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-create-primary text-white shadow">
                          <span aria-hidden className="material-symbols-outlined text-base">check</span>
                        </span>
                      )}
                      {w.isRecommended && (
                        <span className="absolute left-1.5 top-1.5 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-brand-text shadow-sm">
                          {t("recommended")}
                        </span>
                      )}
                    </span>
                    <span className={`px-2.5 py-2 font-display text-[13px] font-semibold leading-tight ${selected ? "text-brand-text" : "text-create-text-dark"}`}>
                      {td(`templates.${w.id}.title`)}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Chapters */}
          {selectedTemplate && !tree && !treeError && (
            <div className="flex items-center justify-center py-10">
              <BrandLoader size="md" label={t("loading")} />
            </div>
          )}
          {treeError && (
            <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl bg-white p-6 text-center">
              <p className="text-sm text-create-text">{t("loadError")}</p>
              <button
                type="button"
                onClick={() => {
                  setFailedFor(null);
                  setReloadKey((k) => k + 1);
                }}
                className={buttonClass({ size: "sm" })}
              >
                {t("retry")}
              </button>
            </div>
          )}

          {chapters.map((node, i) => {
            const chosenId = path[i]?.optionId;
            const headingId = `adv-ch-${i + 1}`;
            return (
              <section
                key={node.id}
                ref={(el) => {
                  sectionRefs.current[i + 1] = el;
                }}
                aria-labelledby={headingId}
                className={`chapter-in ${sectionClass}`}
              >
                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-brand-text">{t("chapter", { n: i + 1 })}</p>
                <h2 id={headingId} className="mb-3 font-display text-lg font-bold leading-snug text-create-text-dark sm:text-xl">
                  {fill(tx(node.question, locale))}
                </h2>
                <div role="radiogroup" aria-labelledby={headingId} className="grid gap-2.5 sm:grid-cols-3 sm:gap-4">
                  {node.options.map((o, oi) => {
                    const selected = o.id === chosenId;
                    const art = PATH_ART[o.imageSeed];
                    return (
                      <button
                        key={o.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => choose(i, node, o)}
                        className={`group flex overflow-hidden rounded-2xl border-2 bg-white text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-create-primary sm:flex-col ${
                          selected
                            ? "border-create-primary"
                            : chosenId
                              ? "border-transparent opacity-70 hover:opacity-100"
                              : "border-transparent hover:border-create-primary/40"
                        }`}
                      >
                        <span className="relative block w-[96px] shrink-0 bg-create-neutral sm:aspect-[3/2] sm:w-full">
                          {art ? (
                            <Image src={art} alt="" fill sizes="(max-width:640px) 96px, 260px" className="object-cover" />
                          ) : (
                            <span className={`absolute inset-0 flex items-center justify-center bg-gradient-to-br ${themeGradient}`}>
                              <span aria-hidden className="material-symbols-outlined text-3xl text-white">{o.icon}</span>
                            </span>
                          )}
                          {selected && (
                            <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-create-primary text-white shadow">
                              <span aria-hidden className="material-symbols-outlined text-base">check</span>
                            </span>
                          )}
                        </span>
                        <span className="flex min-h-[84px] flex-col justify-center gap-0.5 px-3 py-2.5 sm:min-h-0 sm:px-4 sm:py-3">
                          <span className={`font-display text-[15px] font-semibold leading-tight ${selected ? "text-brand-text" : "text-create-text-dark"}`}>
                            {fill(tx(o.title, locale))}
                          </span>
                          <span className="line-clamp-2 text-xs leading-snug text-create-text-sub">{fill(tx(o.desc, locale))}</span>
                        </span>
                        <span className="sr-only">{t("optionN", { n: oi + 1 })}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}

          {complete && (
            <p
              ref={(el) => {
                sectionRefs.current[99] = el;
              }}
              className={`chapter-in rounded-2xl bg-white px-4 py-3 text-center text-sm font-medium text-create-text ${sectionClass}`}
            >
              {t("ready", { name })}
            </p>
          )}
        </div>
      </main>

      <CreationFooterNav
        onBack={onBack}
        onNext={onCreate}
        nextLabel={t("create")}
        nextLoading={saving}
        nextDisabled={!complete}
        nextDisabledTooltip={selectedTemplate ? t("chooseChapters") : t("chooseWorld")}
      />
    </>
  );
}
