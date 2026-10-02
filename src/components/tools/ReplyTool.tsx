"use client";

import { useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { setHeroName } from "@/components/landing/HeroNameStore";
import { Button, ChoiceChip, Eyebrow, cx } from "@/components/ui";
import { formatChildName } from "@/lib/child-name";
import { TOOL_CUSTOM_MAX, TOOL_MAX_ACHIEVEMENTS, TOOL_NAME_PATTERN, TOOL_PS_MAX } from "@/lib/tools/limits";
import type { ToolLocale } from "@/lib/tools/registry";
import { ACHIEVEMENT_IDS, CHALLENGE_IDS, composeReply, type AchievementId, type ChallengeId } from "@/lib/tools/reply-templates";
import type { ReplyInput } from "@/lib/tools/schema";
import AvatarPicker, { DEFAULT_TOOL_AVATAR, type ToolAvatarState } from "./AvatarPicker";
import ToolDownload, { ReminderOptIn } from "./ToolDownload";
import { FieldGroup, ToolNameField, ToolPortrait, type NameError } from "./ToolFields";

const textareaClass =
  "w-full rounded-2xl border-2 border-line bg-surface px-4 py-3 text-base leading-relaxed text-ink outline-none transition-colors placeholder:text-ink-muted/60 focus:border-brand";

function Counter({ value, max }: { value: string; max: number }) {
  return (
    <span aria-hidden className="tabular-nums">
      {value.length}/{max}
    </span>
  );
}

export default function ReplyTool({ locale, reyesYear }: { locale: ToolLocale; reyesYear: number }) {
  const t = useTranslations("tools.common");
  const tr = useTranslations("tools.reply");
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<ToolAvatarState>({ ...DEFAULT_TOOL_AVATAR, ageBand: "big" });
  const [achievements, setAchievements] = useState<AchievementId[]>([]);
  const [customAchievement, setCustom] = useState("");
  const [challenge, setChallenge] = useState<ChallengeId | null>(null);
  const [moment, setMoment] = useState<"before" | "morning">("before");
  const [postscript, setPostscript] = useState("");
  const [variant, setVariant] = useState(0);
  const [nameError, setNameError] = useState<NameError>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const display = formatChildName(name);
  const portraitAlt = display ? t("portraitAlt", { name: display }) : t("portraitAltNoName");
  const full = achievements.length >= TOOL_MAX_ACHIEVEMENTS;

  // Exactly the text the PDF prints (same pure composer as the server).
  const reply = useMemo(
    () =>
      composeReply(
        { locale, name: display || "…", gender: avatar.gender, achievements, customAchievement, challenge, moment, postscript, variant },
        reyesYear,
      ),
    [locale, display, avatar.gender, achievements, customAchievement, challenge, moment, postscript, variant, reyesYear],
  );

  const toggleAchievement = (id: AchievementId) =>
    setAchievements((list) => (list.includes(id) ? list.filter((a) => a !== id) : list.length >= TOOL_MAX_ACHIEVEMENTS ? list : [...list, id]));

  const buildInput = (): ReplyInput | null => {
    if (!name.trim() || !TOOL_NAME_PATTERN.test(name.trim())) return null;
    return {
      tool: "reply",
      locale,
      name: name.trim(),
      avatar,
      achievements,
      customAchievement: customAchievement.trim(),
      challenge,
      moment,
      postscript: postscript.trim(),
      variant,
    };
  };

  return (
    <div className="grid gap-6 [grid-template-areas:'form'_'preview'_'actions'] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-x-12 lg:[grid-template-areas:'form_preview'_'actions_preview']">
      <div className="flex min-w-0 flex-col gap-6 [grid-area:form]">
        {/* Phone: portrait + name strip, sticky under the header while the picker scrolls */}
        <div
          className="sticky z-20 -mx-4 -mt-2 flex items-center gap-3 border-b border-line bg-surface/95 px-4 py-2 backdrop-blur-md sm:-mx-6 sm:px-6 lg:hidden"
          style={{ top: "var(--landing-nav-h, 56px)" }}
        >
          <ToolPortrait avatar={avatar} alt={portraitAlt} className="w-14 ring-2" />
          <div className="min-w-0">
            {display && <p className="truncate font-display text-lg font-bold leading-tight text-ink">{display}</p>}
            <p className="text-xs text-ink-muted">{tr("previewHeading")}</p>
          </div>
        </div>

        <ToolNameField
          ref={nameRef}
          id="reply-name"
          value={name}
          error={nameError}
          onChange={(v) => {
            setName(v);
            setHeroName(v);
            if (nameError) setNameError(null);
          }}
        />

        <FieldGroup id="reply-portrait" title={t("portraitHeading")} hint={t("portraitHint")}>
          <AvatarPicker value={avatar} onChange={setAvatar} showGenderHint />
        </FieldGroup>

        <FieldGroup id="reply-achievements" title={tr("achievementsLabel")} hint={tr("achievementsHint")}>
          <div role="group" aria-labelledby="reply-achievements" className="flex flex-wrap gap-2">
            {ACHIEVEMENT_IDS.map((id) => {
              const selected = achievements.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={selected}
                  aria-disabled={!selected && full ? true : undefined}
                  onClick={() => toggleAchievement(id)}
                  className={cx(
                    "flex min-h-11 items-center gap-1.5 rounded-xl border-2 px-3 py-2 text-sm font-bold leading-tight transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                    selected
                      ? "border-brand bg-brand-tint text-brand-text"
                      : full
                        ? "border-line bg-surface text-ink-muted opacity-60"
                        : "border-line bg-surface text-ink-soft hover:border-brand/40",
                  )}
                >
                  {selected && (
                    <span aria-hidden className="material-symbols-outlined !text-base">
                      check
                    </span>
                  )}
                  {tr(`achievements.${id}`)}
                </button>
              );
            })}
          </div>
          {full && (
            <p role="status" className="text-xs text-ink-muted">
              {tr("maxReached")}
            </p>
          )}
          <div className="flex flex-col gap-2">
            <Eyebrow as="label" htmlFor="reply-custom">
              {tr("customLabel")}
            </Eyebrow>
            <textarea
              id="reply-custom"
              rows={2}
              maxLength={TOOL_CUSTOM_MAX}
              value={customAchievement}
              placeholder={tr("customPlaceholder")}
              onChange={(e) => setCustom(e.target.value)}
              aria-describedby="reply-custom-hint"
              className={textareaClass}
              data-testid="reply-custom"
            />
            <p id="reply-custom-hint" className="flex justify-between gap-3 text-xs text-ink-muted">
              <span>{tr("customHint")}</span>
              <Counter value={customAchievement} max={TOOL_CUSTOM_MAX} />
            </p>
          </div>
        </FieldGroup>

        <FieldGroup id="reply-challenge" title={tr("challengeLabel")}>
          <div role="radiogroup" aria-labelledby="reply-challenge" className="flex flex-wrap gap-2">
            <ChoiceChip selected={challenge === null} onClick={() => setChallenge(null)}>
              {tr("challengeNone")}
            </ChoiceChip>
            {CHALLENGE_IDS.map((id) => (
              <ChoiceChip key={id} selected={challenge === id} onClick={() => setChallenge(id)}>
                {tr(`challenges.${id}`)}
              </ChoiceChip>
            ))}
          </div>
        </FieldGroup>

        <FieldGroup id="reply-moment" title={tr("momentLabel")}>
          <div role="radiogroup" aria-labelledby="reply-moment" className="grid gap-2 sm:grid-cols-2">
            {(["before", "morning"] as const).map((m) => (
              <ChoiceChip key={m} selected={moment === m} onClick={() => setMoment(m)}>
                {tr(m === "before" ? "momentBefore" : "momentMorning")}
              </ChoiceChip>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <Eyebrow as="label" htmlFor="reply-ps">
              {tr("psLabel")}
            </Eyebrow>
            <textarea
              id="reply-ps"
              rows={2}
              maxLength={TOOL_PS_MAX}
              value={postscript}
              placeholder={tr("psPlaceholder")}
              onChange={(e) => setPostscript(e.target.value)}
              aria-describedby="reply-ps-hint"
              className={textareaClass}
              data-testid="reply-ps"
            />
            <p id="reply-ps-hint" className="flex justify-between gap-3 text-xs text-ink-muted">
              <span>{tr("psHint")}</span>
              <Counter value={postscript} max={TOOL_PS_MAX} />
            </p>
          </div>
        </FieldGroup>
      </div>

      {/* Live letter: below the fields on phones, sticky column on desktop */}
      <aside aria-labelledby="reply-preview-title" className="min-w-0 [grid-area:preview] lg:sticky lg:self-start" style={{ top: "calc(var(--landing-nav-h, 64px) + 1.5rem)" }}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <h3 id="reply-preview-title" className="font-display text-lg font-semibold text-ink">
            {tr("previewHeading")}
          </h3>
          <Button variant="secondary" size="sm" leadingIcon="refresh" onClick={() => setVariant((v) => (v + 1) % 1000)} data-testid="reply-variant">
            {tr("anotherVersion")}
          </Button>
        </div>
        <article
          className="rounded-lg border border-line bg-white px-5 py-6 shadow-card sm:px-8 sm:py-8 lg:max-h-[calc(100dvh-var(--landing-nav-h,64px)-7rem)] lg:overflow-y-auto"
          data-testid="reply-preview"
        >
          <p className="text-center text-[10px] font-bold uppercase tracking-[0.14em] text-brand-text">{reply.eyebrow}</p>
          <p className="mt-4 text-right text-xs italic text-ink-muted">{reply.dateLine}</p>
          <div className="mt-2 flex items-center justify-between gap-4">
            <p className="min-w-0 break-words font-display text-2xl font-bold leading-tight text-ink">{reply.salutation}</p>
            <ToolPortrait avatar={avatar} alt={portraitAlt} className="hidden w-16 ring-2 lg:block" />
          </div>
          {!display && <p className="mt-2 text-xs text-ink-muted">{tr("previewHint")}</p>}
          <div className="mt-4 flex flex-col gap-3 text-[15px] leading-relaxed text-ink-soft">
            {reply.paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            {reply.postscript && <p className="italic text-ink-body">{reply.postscript}</p>}
            <p>{reply.signOff}</p>
          </div>
          <p className="mt-4 grid grid-cols-3 text-center font-display text-base font-semibold text-brand-deep">
            {reply.kings.map((k) => (
              <span key={k}>{k}</span>
            ))}
          </p>
        </article>
      </aside>

      <div className="flex flex-col gap-4 border-t border-line pt-6 [grid-area:actions]">
        <ToolDownload
          tool="reply"
          label={tr("download")}
          buildInput={buildInput}
          onInvalid={() => {
            setNameError(name.trim() ? "invalid" : "required");
            nameRef.current?.focus();
          }}
        />
        <ReminderOptIn />
      </div>
    </div>
  );
}
