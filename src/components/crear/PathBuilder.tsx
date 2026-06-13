"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useTranslations, useLocale } from "next-intl";
import {
  STORY_TEMPLATES,
  getRecommendedTemplates,
  getTemplateBeats,
  beatDecisionField,
  type StoryBeat,
  type StoryDecisions,
  type TreeChoice,
  type CharacterData,
} from "@/lib/create-store";
import { loadStoryTree, templateHasTree, tx } from "@/lib/story-trees/loaders";
import type { StoryTree } from "@/lib/story-trees/types";
import { PATH_ART } from "@/lib/story-trees/art-manifest";
import type { TreeNode, TreeOption } from "@/lib/story-trees/types";
import CreationHeader from "@/components/crear/CreationHeader";

interface PathBuilderProps {
  character: CharacterData;
  selectedTemplate: string | null;
  decisions: StoryDecisions;
  portraitUrl?: string | null;
  onSelectTemplate: (id: string) => void;
  onUpdateDecisions: (partial: Partial<StoryDecisions>) => void;
  onRegeneratePortrait?: () => void;
  onComplete: () => void;
  onBack: () => void;
  onStepClick?: (step: number) => void;
  canStepNavigate?: (step: number) => boolean;
}

type OptionCard = {
  id: string;
  title: string;
  subtitle?: string;
  /** Photo/illustration (world cards only). */
  image?: string;
  /** Material Symbols icon rendered on a themed gradient (decision cards). */
  icon?: string;
  recommended?: boolean;
};

/** Deterministic sparkle layouts so sibling cards don't look identical. */
const SPARKLES: ReadonlyArray<ReadonlyArray<readonly [number, number, number]>> = [
  [[14, 22, 2.4], [82, 16, 1.6], [68, 74, 2], [26, 78, 1.4], [90, 55, 1.2]],
  [[20, 14, 1.6], [76, 26, 2.4], [12, 62, 1.4], [62, 82, 1.8], [88, 70, 1.2]],
  [[30, 18, 1.4], [86, 38, 1.8], [16, 44, 2.2], [72, 66, 1.4], [44, 86, 1.8]],
];

function OptionVisual({
  icon,
  gradient,
  variant,
  compact,
}: {
  icon?: string;
  gradient: string;
  variant: number;
  compact?: boolean;
}) {
  const dots = SPARKLES[variant % SPARKLES.length];
  return (
    <span
      className={`relative flex w-full items-center justify-center overflow-hidden bg-gradient-to-br ${gradient} ${
        compact ? "h-28" : "aspect-4/3"
      }`}
    >
      <span
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 45%, rgba(255,255,255,.28), transparent 70%)",
        }}
      />
      <svg aria-hidden className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        {dots.map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} fill="white" opacity={0.3} />
        ))}
      </svg>
      <span className="material-symbols-outlined relative text-[44px] text-white drop-shadow-[0_4px_12px_rgba(0,0,0,.35)] transition-transform duration-500 group-hover:scale-110">
        {icon ?? "auto_awesome"}
      </span>
    </span>
  );
}

/** Live-measured element width (px) via a callback ref + ResizeObserver. */
function useMeasureWidth() {
  const [width, setWidth] = useState(0);
  const roRef = useRef<ResizeObserver | null>(null);
  const ref = useCallback((node: HTMLElement | null) => {
    if (roRef.current) {
      roRef.current.disconnect();
      roRef.current = null;
    }
    if (!node) return;
    setWidth(node.getBoundingClientRect().width);
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (cr) setWidth(cr.width);
    });
    ro.observe(node);
    roRef.current = ro;
  }, []);
  return [ref, width] as const;
}

/** Smooth S-curve through vertically-stacked points (vertical tangents). */
function smoothVerticalPath(points: ReadonlyArray<{ x: number; y: number }>): string {
  if (points.length < 2) return "";
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 1; i < points.length; i++) {
    const p0 = points[i - 1];
    const p1 = points[i];
    const my = (p0.y + p1.y) / 2;
    d += ` C ${p0.x.toFixed(1)} ${my.toFixed(1)}, ${p1.x.toFixed(1)} ${my.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
  }
  return d;
}

export default function PathBuilder({
  character,
  selectedTemplate,
  decisions,
  portraitUrl,
  onSelectTemplate,
  onUpdateDecisions,
  onRegeneratePortrait,
  onComplete,
  onBack,
  onStepClick,
  canStepNavigate,
}: PathBuilderProps) {
  const t = useTranslations("crear.path");
  const td = useTranslations("data");
  const locale = useLocale();
  const name = character.name?.trim() || t("protagonist");
  const fill = (s: string) => s.replaceAll("{name}", name);

  // branching tree — loaded as its own client chunk when a template is chosen
  const expectsTree = templateHasTree(selectedTemplate ?? "");
  const [tree, setTree] = useState<StoryTree | null>(null);
  const [treeFailed, setTreeFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    setTreeFailed(false);
    if (!selectedTemplate) {
      setTree(null);
      return;
    }
    const pending = loadStoryTree(selectedTemplate);
    if (!pending) {
      setTree(null);
      return;
    }
    pending
      .then((loaded) => {
        if (alive) setTree(loaded);
      })
      .catch((err) => {
        // chunk failed to load (offline / deploy skew) — fall back to the
        // legacy flat-decision flow instead of spinning forever
        console.error("[PathBuilder] tree chunk failed, using legacy flow:", err);
        if (alive) setTreeFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [selectedTemplate]);
  const treeMode = !!tree;
  // chunk still in flight for the chosen template — render a quiet hold state
  const treeLoading = expectsTree && !tree && !treeFailed;

  // legacy flat-decision beats (templates without a tree yet)
  const beats: StoryBeat[] = useMemo(
    () => [{ id: "world", kind: "world" }, ...getTemplateBeats(selectedTemplate)],
    [selectedTemplate],
  );

  const tpl = selectedTemplate;
  const tKey = tpl ? `templates.${tpl}` : null;

  const worldOptions = useMemo<OptionCard[]>(
    () =>
      getRecommendedTemplates(character.age ?? 6, character.interests ?? []).map((r) => ({
        id: r.id,
        title: td(`templates.${r.id}.title`),
        image: r.image,
        recommended: r.isRecommended,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [character.age, character.interests],
  );

  const hasRecommended = useMemo(
    () => worldOptions.some((o) => o.recommended),
    [worldOptions],
  );

  // ---- legacy helpers (only used when !treeMode) ----
  function legacyOptions(beat: StoryBeat): OptionCard[] {
    if (beat.kind === "world") return worldOptions;
    const template = STORY_TEMPLATES.find((x) => x.id === tpl);
    if (!template) return [];
    if (beat.kind === "decision" && beat.decisionKey) {
      const dp = template.decisions.find((d) => d.key === beat.decisionKey);
      return (dp?.options ?? []).map((o) => ({
        id: o.id,
        title: td(`${tKey}.decisions.${beat.decisionKey}.${o.id}.title`),
        subtitle: td(`${tKey}.decisions.${beat.decisionKey}.${o.id}.subtitle`),
        icon: o.icon,
      }));
    }
    const list =
      beat.atmosphereSub === "time"
        ? template.atmosphere.timeOptions
        : template.atmosphere.settingOptions;
    return list.map((o) => ({
      id: o.id,
      title: td(`${tKey}.atmosphere.${beat.atmosphereSub}.${o.id}`),
      icon: o.icon,
    }));
  }

  function legacyQuestion(beat: StoryBeat): string {
    if (beat.kind === "world") return t("worldQuestion", { name });
    if (beat.kind === "decision" && beat.decisionKey)
      return td(`${tKey}.decisions.${beat.decisionKey}.question`, { name });
    return beat.atmosphereSub === "time"
      ? t("timeQuestion", { name })
      : t("settingQuestion", { name });
  }

  function legacyChapterLabel(index: number, beat: StoryBeat): string {
    if (beat.kind === "world") return t("worldChapter");
    if (beat.kind === "atmosphere") return t("ambientLabel");
    return t("chapter", { n: index });
  }

  function legacyChosenIndex(beat: StoryBeat): number {
    const opts = legacyOptions(beat);
    const val =
      beat.kind === "world"
        ? selectedTemplate
        : (() => {
            const f = beatDecisionField(beat);
            return f ? decisions[f] : undefined;
          })();
    return opts.findIndex((o) => o.id === val);
  }

  // ---- route state ----
  // route[0] = start (null); route[k] = chosen option index made AT step k-1.
  // step 0 = world (template). step >=1 = tree node (treeMode) or beats[step] (legacy).
  const initial = useMemo(() => {
    const r: (number | null)[] = [null];
    if (selectedTemplate) {
      const wi = worldOptions.findIndex((o) => o.id === selectedTemplate);
      r.push(wi >= 0 ? wi : 0);
      if (tree) {
        let node: TreeNode | null = tree.nodes[tree.root];
        for (const choice of decisions.treePath ?? []) {
          if (!node) break;
          const idx = node.options.findIndex((o) => o.id === choice.optionId);
          if (idx < 0) break;
          r.push(idx);
          const nx: string | null = node.options[idx]?.next ?? null;
          node = nx ? tree.nodes[nx] ?? null : null;
        }
      } else {
        for (let i = 1; i < beats.length; i++) {
          const oi = legacyChosenIndex(beats[i]);
          if (oi < 0) break;
          r.push(oi);
        }
      }
    }
    return { route: r, active: r.length - 1 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [route, setRoute] = useState<(number | null)[]>(initial.route);
  const [active, setActive] = useState<number>(initial.active);

  // Restored drafts: the tree chunk arrives after mount, so the saved treePath
  // couldn't be replayed in `initial`. Rebuild the route once the tree lands,
  // but only while the user hasn't navigated beyond the world step themselves.
  const [replayedTreeId, setReplayedTreeId] = useState<string | null>(null);
  useEffect(() => {
    if (!tree || !selectedTemplate || replayedTreeId === tree.templateId) return;
    setReplayedTreeId(tree.templateId);
    const saved = decisions.treePath ?? [];
    if (!saved.length || route.length > 2) return;
    const r: (number | null)[] = [null];
    const wi = worldOptions.findIndex((o) => o.id === selectedTemplate);
    r.push(wi >= 0 ? wi : 0);
    let node: TreeNode | null = tree.nodes[tree.root];
    for (const choice of saved) {
      if (!node) break;
      const idx = node.options.findIndex((o) => o.id === choice.optionId);
      if (idx < 0) break;
      r.push(idx);
      const nx: string | null = node.options[idx]?.next ?? null;
      node = nx ? tree.nodes[nx] ?? null : null;
    }
    setRoute(r);
    setActive(r.length - 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree, selectedTemplate]);

  // Resolve the tree node reached at a given step (treeMode only).
  function treeNodeAtStep(s: number): TreeNode | null {
    if (!tree || s < 1) return null;
    let node: TreeNode | null = tree.nodes[tree.root];
    for (let i = 2; i <= s; i++) {
      if (!node) return null;
      const idx = route[i];
      if (idx == null) return null;
      const opt: TreeOption | undefined = node.options[idx];
      if (!opt || !opt.next) return null;
      node = tree.nodes[opt.next] ?? null;
    }
    return node;
  }

  // ---- step-based accessors (tree + legacy) ----
  function optionsAtStep(s: number): OptionCard[] {
    if (s === 0) return worldOptions;
    if (treeMode) {
      const node = treeNodeAtStep(s);
      if (!node) return [];
      return node.options.map((o) => ({
        id: o.id,
        title: tx(o.title, locale),
        subtitle: tx(o.desc, locale),
        image: PATH_ART[o.imageSeed],
        icon: o.icon,
      }));
    }
    return s < beats.length ? legacyOptions(beats[s]) : [];
  }

  function questionAtStep(s: number): string {
    if (s === 0) return t("worldQuestion", { name });
    if (treeMode) {
      const node = treeNodeAtStep(s);
      return node ? fill(tx(node.question, locale)) : "";
    }
    return s < beats.length ? legacyQuestion(beats[s]) : "";
  }

  function chapterLabelAtStep(s: number): string {
    if (s === 0) return t("worldChapter");
    if (treeMode) {
      const node = treeNodeAtStep(s);
      return node ? t("chapter", { n: node.chapter }) : t("worldChapter");
    }
    return s < beats.length ? legacyChapterLabel(s, beats[s]) : t("worldChapter");
  }

  function hasStepOptions(s: number): boolean {
    if (s === 0) return true;
    if (treeMode) {
      const node = treeNodeAtStep(s);
      return !!node && node.options.length > 0;
    }
    return s < beats.length;
  }

  // chosen option (card) for a decided step
  function chosenAtStep(s: number): OptionCard | null {
    const idx = route[s + 1];
    if (idx == null) return null;
    return optionsAtStep(s)[idx] ?? null;
  }

  function handleSelect(optionId: string, optIdx: number) {
    if (active === 0) {
      if (optionId !== selectedTemplate) {
        onUpdateDecisions({
          encounter: undefined,
          companion: undefined,
          challenge: undefined,
          timeOfDay: undefined,
          setting: undefined,
          treePath: undefined,
        });
      }
      onSelectTemplate(optionId);
    } else if (treeMode) {
      const node = treeNodeAtStep(active);
      if (node) {
        const choice: TreeChoice = { nodeId: node.id, optionId };
        const path = (decisions.treePath ?? []).slice(0, active - 1);
        path.push(choice);
        onUpdateDecisions({ treePath: path });
      }
    } else {
      const f = beatDecisionField(beats[active]);
      if (f) onUpdateDecisions({ [f]: optionId });
    }
    const next = route.slice(0, active + 1);
    next.push(optIdx);
    setRoute(next);
    setActive(active + 1);
  }

  function goTo(i: number) {
    if (i >= 0) setActive(i);
  }
  function goBackChapter() {
    if (active <= 0) onBack();
    else setActive(active - 1);
  }

  const isWorld = active === 0;
  const showOptions = hasStepOptions(active);
  const options = showOptions ? optionsAtStep(active) : [];
  const selectedIdx = route[active + 1] ?? -1; // highlights a prior choice when revisiting
  const themeGradient =
    STORY_TEMPLATES.find((x) => x.id === tpl)?.themeGradient ?? "from-amber-500 to-orange-600";

  // Serpentine trail geometry: the world node sits centered, then each chosen
  // chapter zig-zags left/right so the path visibly winds down the page.
  // Drawn in real pixel coordinates (1:1 viewBox) so the line lands exactly on
  // each medallion centre — no aspect-ratio distortion.
  const TRAIL_PITCH = 92; // px between consecutive node centres
  const NODE_TOP = 6; // px from the top of a node row to the medallion top
  const NODE_R = 24; // medallion radius (h/w = 48)
  const trailXPct = (i: number) => (i === 0 ? 0.5 : i % 2 === 1 ? 0.72 : 0.28);
  const nodeCenterY = (s: number) => s * TRAIL_PITCH + NODE_TOP + NODE_R;

  const [trailRef, trailW] = useMeasureWidth();
  const [forkRef, forkW] = useMeasureWidth();

  // Total trail height: last node centre + a tail that descends to centre so the
  // path flows straight into the "you are here" marker / finished-book node.
  const trailHeight = active > 0 ? nodeCenterY(active - 1) + (TRAIL_PITCH - NODE_R) : 0;
  const trailPathD = useMemo(() => {
    if (active < 1 || trailW <= 0) return "";
    const pts = Array.from({ length: active }, (_, s) => ({
      x: trailXPct(s) * trailW,
      y: nodeCenterY(s),
    }));
    pts.push({ x: trailW / 2, y: trailHeight }); // tail → centre-bottom
    return smoothVerticalPath(pts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, trailW, trailHeight]);

  /** One option as a big illustrated card (shared by the world grid + forks). */
  function renderCard(o: OptionCard, i: number, world: boolean) {
    const selected = i === selectedIdx;
    return (
      <button
        key={o.id}
        type="button"
        onClick={() => handleSelect(o.id, i)}
        style={{ animationDelay: `${i * 0.07}s` }}
        className={`cp-fanin group flex flex-col overflow-hidden rounded-2xl border-2 bg-white text-left shadow-[0_18px_36px_-26px_rgba(0,0,0,.45)] transition-all duration-300 hover:-translate-y-1.5 hover:border-create-primary hover:shadow-[0_28px_50px_-26px_rgba(232,108,58,.55)] ${
          selected ? "border-create-primary ring-2 ring-create-primary/30" : "border-transparent"
        }`}
      >
        <span
          className={`relative block w-full overflow-hidden bg-create-neutral ${
            world ? "aspect-4/3" : o.image ? "aspect-3/2" : "h-28"
          }`}
        >
          {o.image ? (
            <Image
              src={o.image}
              alt={o.title}
              fill
              sizes={world ? "(max-width:640px) 50vw, 20vw" : "(max-width:640px) 100vw, 33vw"}
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <OptionVisual icon={o.icon} gradient={themeGradient} variant={i} compact={!world} />
          )}
          {selected && (
            <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-create-primary text-white shadow">
              <span className="material-symbols-outlined text-base">check</span>
            </span>
          )}
          {o.recommended && (
            <span className="absolute left-2 top-2 rounded-full bg-create-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow">
              {t("recommendedBadge")}
            </span>
          )}
        </span>
        <span
          className={`flex flex-col gap-0.5 sm:gap-1 ${
            world ? "px-3 py-2.5" : "px-2 py-2 sm:px-4 sm:py-3"
          }`}
        >
          <span
            className={`font-display font-semibold leading-tight text-create-text-dark ${
              world ? "text-sm" : "text-[12px] sm:text-[15px]"
            }`}
          >
            {o.title}
          </span>
          {o.subtitle && (
            <span
              className={`leading-snug text-create-text-sub ${
                world ? "text-xs" : "line-clamp-2 text-[10px] sm:text-xs"
              }`}
            >
              {o.subtitle}
            </span>
          )}
        </span>
      </button>
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-create-bg">
      <CreationHeader
        currentStep={2}
        totalSteps={3}
        rightAction="close"
        portraitUrl={portraitUrl}
        characterName={character.name}
        characterAge={character.age}
        onRegeneratePortrait={onRegeneratePortrait}
        onStepClick={onStepClick}
        canStepNavigate={canStepNavigate}
      />

      <main className="relative flex flex-1 flex-col items-center px-4 pb-10 pt-4 sm:px-6">
        {isWorld ? (
          /* ============ World pick: full template grid (the path starts here) ============ */
          <div key="world" className="path-chapter flex w-full flex-1 flex-col items-center pt-2">
            <h2 className="mx-auto mb-2 max-w-2xl text-center font-display text-2xl font-bold leading-tight text-create-text-dark sm:text-[28px]">
              {questionAtStep(0)}
            </h2>
            {hasRecommended ? (
              <p className="mx-auto mb-6 max-w-xl text-center text-sm text-create-text-sub">
                {t("worldRecommendHint", { name })}
              </p>
            ) : (
              <div className="mb-5" />
            )}
            <div className="grid w-full max-w-5xl grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {options.map((o, i) => renderCard(o, i, true))}
            </div>
          </div>
        ) : (
          /* ============ Chapter flow: the winding adventure trail ============ */
          <div key={active} className="path-chapter flex w-full flex-1 flex-col items-center">
            {/* The serpentine trail of choices made so far */}
            {active > 0 && (
              <div
                ref={trailRef}
                className="relative w-full max-w-[19rem]"
                style={{ height: trailHeight }}
                aria-label={t("trailLabel")}
              >
                {/* the winding line — drawn in real px so it lands dead-centre on every medallion */}
                <svg
                  aria-hidden
                  className="pointer-events-none absolute inset-0 overflow-visible"
                  width={trailW || 1}
                  height={trailHeight}
                  viewBox={`0 0 ${trailW || 1} ${trailHeight}`}
                >
                  <path d={trailPathD} className="trail-line" />
                </svg>
                {Array.from({ length: active }).map((_, s) => {
                  const chosen = chosenAtStep(s);
                  return (
                    <button
                      key={`trail-${s}`}
                      type="button"
                      onClick={() => goTo(s)}
                      title={chosen?.title}
                      style={{
                        left: `${trailXPct(s) * 100}%`,
                        top: s * TRAIL_PITCH + NODE_TOP,
                        animationDelay: `${s * 0.08}s`,
                      }}
                      className="trail-pop group absolute z-10 -ml-14 flex w-28 flex-col items-center"
                    >
                      <span className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border-[3px] border-white bg-create-neutral shadow-[0_8px_20px_-8px_rgba(0,0,0,.55)] transition-transform group-hover:scale-110">
                        {chosen?.image ? (
                          <Image src={chosen.image} alt="" fill sizes="48px" className="object-cover" />
                        ) : (
                          <span
                            className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${themeGradient}`}
                          >
                            <span className="material-symbols-outlined text-[20px] text-white">
                              {chosen?.icon ?? "public"}
                            </span>
                          </span>
                        )}
                      </span>
                      <span className="mt-1.5 max-w-full truncate text-center text-[11px] font-semibold leading-tight text-create-text-dark group-hover:text-create-primary">
                        {chosen?.title ?? chapterLabelAtStep(s)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {treeLoading ? (
              // tree chunk in flight — quiet hold
              <div className="flex flex-1 items-center justify-center py-16">
                <span
                  className="material-symbols-outlined animate-spin text-3xl text-create-primary/50"
                  style={{ animationDuration: "1.2s" }}
                >
                  progress_activity
                </span>
              </div>
            ) : showOptions ? (
              <>
                {/* "you are here" — the fork the child is deciding now (sits on the trail's tail) */}
                <span
                  className={`cp-pulse -mt-2 mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br ${themeGradient} text-white ring-4 ring-white`}
                >
                  <span className="material-symbols-outlined text-[20px]">explore</span>
                </span>

                <h2 className="mx-auto mb-7 max-w-2xl text-center font-display text-2xl font-bold leading-tight text-create-text-dark sm:text-[28px]">
                  {questionAtStep(active)}
                </h2>

                {/* cards + the fork lines branching into them (desktop), measured in real px */}
                <div ref={forkRef} className="relative w-full max-w-3xl">
                  <svg
                    aria-hidden
                    className="pointer-events-none absolute -top-8 left-0 hidden h-8 w-full overflow-visible sm:block"
                    width={forkW || 1}
                    height={32}
                    viewBox={`0 0 ${forkW || 1} 32`}
                  >
                    {options.map((_, i) => {
                      const w = forkW || 0;
                      const cx = ((i + 0.5) / options.length) * w;
                      const cls =
                        selectedIdx < 0 ? "trail-fork" : i === selectedIdx ? "trail-fork win" : "trail-fork dim";
                      return (
                        <path key={i} d={`M ${w / 2} 0 C ${w / 2} 20, ${cx} 12, ${cx} 32`} className={cls} />
                      );
                    })}
                  </svg>
                  <div className="grid w-full grid-cols-3 gap-2 sm:gap-4">
                    {options.map((o, i) => renderCard(o, i, false))}
                  </div>
                </div>
              </>
            ) : (
              // ---- end of path: the trail arrives at the finished book ----
              <>
                <div className="-mt-3 flex flex-col items-center justify-center pb-4 text-center">
                  <span
                    className={`cp-rise mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br ${themeGradient} text-white shadow-[0_18px_40px_-18px_rgba(0,0,0,.45)] ring-4 ring-white`}
                  >
                    <span className="material-symbols-outlined text-4xl">auto_stories</span>
                  </span>
                  <h2 className="mb-2 font-display text-2xl font-bold text-create-text-dark sm:text-3xl">
                    {t("completeTitle", { name })}
                  </h2>
                  <p className="mb-7 max-w-md text-sm text-create-text-sub">{t("completeSubtitle")}</p>
                  <button
                    type="button"
                    onClick={onComplete}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-create-primary px-9 py-3.5 text-lg font-bold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:bg-create-primary-hover"
                  >
                    {t("completeCta")}
                    <span className="material-symbols-outlined">arrow_forward</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Back */}
        <button
          type="button"
          onClick={goBackChapter}
          className="mt-8 inline-flex items-center gap-1.5 rounded-full border border-create-neutral bg-white px-5 py-2.5 text-sm font-bold text-create-primary shadow-sm transition-colors hover:bg-create-bg"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          {t("backToStart")}
        </button>
      </main>
    </div>
  );
}
