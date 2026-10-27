// Runnable check for the Advent calendar (no deps, no test runner):
//   node --experimental-strip-types src/lib/advent/advent.check.mjs
// Covers: door unlocking by Spain date, the cron's which-door / idempotency rules, and the
// name + gender substitution of all 24 stories in es and ca (no leftover tokens, native
// Catalan articles, no broken contractions).
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import {
  ADVENT_DOORS_COUNT,
  adventAnnounced,
  compilationReady,
  doorDate,
  doorState,
  emailDoorFor,
  isDoorOpen,
  mayResendConfirmation,
  openDoorCount,
  owesDoor,
} from "./calendar.ts";
import { fillTemplate, nameForms, renderStory } from "./render.ts";
import { ADVENT_DOORS } from "./stories.ts";
import { catalanArticle } from "../name-grammar.ts";

// ── Door unlocking ──────────────────────────────────────────────────────────
assert.equal(openDoorCount("2026-11-30"), 0, "teaser before 1 Dec");
assert.equal(openDoorCount("2026-12-01"), 1);
assert.equal(openDoorCount("2026-12-05"), 5);
assert.equal(openDoorCount("2026-12-24"), 24);
assert.equal(openDoorCount("2026-12-31"), 24, "after the 24th everything stays open");
assert.equal(openDoorCount("2027-03-01"), 24);
assert.equal(doorState(5, "2026-12-05"), "today");
assert.equal(doorState(4, "2026-12-05"), "open", "past doors stay openable");
assert.equal(doorState(6, "2026-12-05"), "locked", "future doors are locked");
assert.equal(doorState(1, "2026-11-20"), "locked");
assert.equal(doorState(24, "2026-12-26"), "open", "no 'today' badge after the 24th");
assert.equal(isDoorOpen(5, "2026-12-05"), true);
assert.equal(isDoorOpen(6, "2026-12-05"), false);
assert.equal(isDoorOpen(0, "2026-12-30"), false);
assert.equal(isDoorOpen(25, "2026-12-30"), false);
assert.equal(isDoorOpen(2.5, "2026-12-30"), false);
assert.equal(doorDate(5), "2026-12-05");
assert.equal(compilationReady("2026-12-23"), false);
assert.equal(compilationReady("2026-12-24"), true);

// ── Announcement window ─────────────────────────────────────────────────────
assert.equal(adventAnnounced("2026-11-14", "es"), false);
assert.equal(adventAnnounced("2026-11-15", "es"), true);
assert.equal(adventAnnounced("2026-12-24", "ca"), true);
assert.equal(adventAnnounced("2026-12-25", "es"), false);
assert.equal(adventAnnounced("2026-12-01", "en"), false, "en/fr never link to it");
assert.equal(adventAnnounced("2026-12-01", "fr"), false);

// ── Cron: which door, idempotency ───────────────────────────────────────────
assert.equal(emailDoorFor("2026-11-30"), null);
assert.equal(emailDoorFor("2026-12-01"), 1);
assert.equal(emailDoorFor("2026-12-24"), 24);
assert.equal(emailDoorFor("2026-12-25"), null, "no email after the 24th");
const sub = { last_sent_day: 0, unsubscribed_at: null, confirmed_at: "2026-11-20T10:00:00Z" };
assert.equal(owesDoor(sub, 1), true);
assert.equal(owesDoor({ ...sub, last_sent_day: 1 }, 1), false, "same day twice = no second email");
assert.equal(owesDoor({ ...sub, last_sent_day: 4 }, 10), true, "late sign-up / missed run: today's door only");
assert.equal(owesDoor({ ...sub, last_sent_day: 12 }, 10), false, "never backwards");
assert.equal(owesDoor({ ...sub, unsubscribed_at: "2026-12-02T08:00:00Z" }, 3), false, "unsubscribed");
assert.equal(owesDoor(sub, null), false, "outside 1–24 Dec");
assert.equal(owesDoor({ ...sub, confirmed_at: null }, 5), false, "double opt-in: pending rows get nothing");
// Confirmation re-send throttle (10 min)
const t0 = new Date("2026-12-05T10:00:00Z");
assert.equal(mayResendConfirmation(null, t0), true, "first confirmation");
assert.equal(mayResendConfirmation("2026-12-05T09:55:00Z", t0), false, "5 min ago");
assert.equal(mayResendConfirmation("2026-12-05T09:50:00Z", t0), true, "10 min ago");

// ── Name forms ──────────────────────────────────────────────────────────────
const ca = (name, gender) => ({ locale: "ca", name, gender, article: catalanArticle(name, gender) });
assert.deepEqual(nameForms(ca("Noa", "girl")), { N: "La Noa", n: "la Noa", v: "Noa", de: "de la Noa", a: "a la Noa" });
assert.deepEqual(nameForms(ca("Pau", "boy")), { N: "En Pau", n: "en Pau", v: "Pau", de: "d'en Pau", a: "a en Pau" });
assert.deepEqual(nameForms(ca("Anna", "girl")), { N: "L'Anna", n: "l'Anna", v: "Anna", de: "de l'Anna", a: "a l'Anna" });
assert.deepEqual(nameForms(ca("Àlex", "neutral")), { N: "L'Àlex", n: "l'Àlex", v: "Àlex", de: "de l'Àlex", a: "a l'Àlex" });
assert.deepEqual(nameForms(ca("Noa", "neutral")), { N: "Noa", n: "Noa", v: "Noa", de: "de Noa", a: "a Noa" }, "unknown article: literary register");
assert.deepEqual(nameForms(ca("Irene", "girl")), { N: "La Irene", n: "la Irene", v: "Irene", de: "de la Irene", a: "a la Irene" });
assert.deepEqual(nameForms({ locale: "es", name: "Lucía", gender: "girl", article: null }).de, "de Lucía");
assert.equal(fillTemplate("[a|b|c]", { locale: "es", name: "X", gender: "girl", article: null }), "b");
assert.equal(fillTemplate("[a|b|c]", { locale: "es", name: "X", gender: "neutral", article: null }), "c");

// ── All 24 stories × es/ca × names × genders ────────────────────────────────
assert.equal(ADVENT_DOORS.length, ADVENT_DOORS_COUNT);
const NAMES = ["Noa", "Pau", "Anna", "Àlex", "Irene", "María José", "Ot", "Hugo"];
const GENDERS = ["girl", "boy", "neutral"];
const LEFTOVER = /[{}[\]|]/;
// Broken Catalan contractions / doubled articles / stray spaces.
const word = (x) => new RegExp(`(?<![\\p{L}'])${x}(?![\\p{L}])`, "iu");
const CA_BAD = [word("de en"), word("de el"), word("a el"), word("la la"), word("en en"), /\bde l' /i, /d'de/i, word("de d'"), /  /, / [,.;:!?]/];
const ES_BAD = [word("de el"), word("a el"), /  /, / [,.;:!?]/];

for (let i = 0; i < ADVENT_DOORS.length; i++) {
  const door = ADVENT_DOORS[i];
  assert.match(door.art, /^\/images\/path\/[a-z]+\/[a-z0-9-]+\.webp$/, `door ${i + 1} art path`);
  assert.ok(existsSync(new URL(`../../../public${door.art}`, import.meta.url)), `door ${i + 1} art file missing: ${door.art}`);
  for (const locale of ["es", "ca"]) {
    assert.ok(door.artAlt[locale]?.length > 10, `door ${i + 1} ${locale} alt`);
    const tpl = door.stories[locale];
    // Words of the story itself (title excluded): ~120–200 per door.
    const words = [...tpl.paragraphs, tpl.question].join(" ").split(/\s+/).filter(Boolean).length;
    assert.ok(words >= 110 && words <= 215, `door ${i + 1} ${locale}: ${words} words`);
    for (const name of NAMES) {
      for (const gender of GENDERS) {
        const ctx = locale === "ca" ? ca(name, gender) : { locale, name, gender, article: null };
        const s = renderStory(i + 1, tpl, ctx);
        const all = [s.title, s.teaser, ...s.paragraphs, s.question];
        for (const text of all) {
          assert.ok(!LEFTOVER.test(text), `door ${i + 1} ${locale} ${name}/${gender}: leftover token in "${text}"`);
          for (const bad of locale === "ca" ? CA_BAD : ES_BAD) {
            assert.ok(!bad.test(text), `door ${i + 1} ${locale} ${name}/${gender}: ${bad} in "${text}"`);
          }
        }
        assert.ok(s.title.includes(name), `door ${i + 1} ${locale}: the title names the child`);
        assert.ok(all.join(" ").split(name).length >= 3, `door ${i + 1} ${locale}: the child is in the story`);
        // Every sentence starts with a capital (no lowercase article at the start).
        for (const text of [s.title, s.teaser, ...s.paragraphs, s.question]) {
          const first = text.replace(/^[«—¿¡("\s]+/u, "").charAt(0);
          assert.equal(first, first.toUpperCase(), `door ${i + 1} ${locale}: "${text.slice(0, 30)}" starts lowercase`);
        }
      }
    }
  }
}

// Catalan with a known gender always uses the article; Spanish never does.
const noaCa = renderStory(5, ADVENT_DOORS[4].stories.ca, ca("Noa", "girl"));
assert.equal(noaCa.title, "La Noa i el camell que no sabia estar-se quiet");
assert.ok(noaCa.paragraphs[1].includes("li va dir a la Noa"));
const pauCa = renderStory(24, ADVENT_DOORS[23].stories.ca, ca("Pau", "boy"));
assert.ok(pauCa.paragraphs[1].includes("la carta d'en Pau"));
const noaEs = renderStory(5, ADVENT_DOORS[4].stories.es, { locale: "es", name: "Noa", gender: "girl", article: null });
assert.equal(noaEs.title, "Noa y el camello que no sabía estarse quieto");
assert.ok(noaEs.paragraphs[1].includes("le dijo a Noa"));
const q13 = (gender) => renderStory(13, ADVENT_DOORS[12].stories.es, { locale: "es", name: "Noa", gender, article: null }).question;
assert.ok(q13("boy").includes("quieto") && q13("girl").includes("quieta") && q13("neutral").includes("sin moverte"));

console.log("advent: all checks passed");
