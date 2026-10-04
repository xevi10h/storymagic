// Daily social runner: keeps Zernio's schedule filled from docs/social/posts/<YYYY-MM-DD>/post.json
// (Instagram, TikTok, Facebook, YouTube Shorts and Pinterest). Zernio publishes at the scheduled time, so this only has to run
// once a day (launchd com.casmar.meapica-social, see docs/stack.md › Social). Safe to re-run: a post
// already in Zernio for that day with the same caption is skipped.
//
//   node scripts/social/schedule.mjs               # dry run: check every upcoming post, print the plan. Creates nothing.
//   node scripts/social/schedule.mjs --schedule    # upload media + schedule every post due in the next 6 days
//   options: --date=2026-10-05  only that day
//
// post.json: { id, time: "20:30" (Europe/Madrid), lang, title (YouTube + Pinterest, ≤ 100 chars),
//              media: [{ file, type: "video" | "image", alt? }], ig, fb, tiktok, tiktokTitle (image posts, ≤ 90 chars),
//              coverMs?, aiVideo? (synthetic voice or people: platform AI label), madeForKids (videos: YouTube COPPA flag) }
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { PROFILE_ID, api, buildPostBody, idemKey, meapicaAccounts, uploadMedia } from "./zernio.mjs";

const POSTS_DIR = `${process.cwd()}/docs/social/posts`;
// Zernio temp uploads expire after 7 days: a post further out is scheduled by a later run.
const WINDOW_DAYS = 6;
const args = process.argv.slice(2);
const SCHEDULE = args.includes("--schedule");
const ONLY_DATE = args.find((a) => a.startsWith("--date="))?.split("=")[1];

const madrid = (d) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid", dateStyle: "short", timeStyle: "short" }).format(d); // "2026-10-04 09:12"
const addDays = (date, n) => new Date(Date.parse(`${date}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const [today] = madrid(new Date()).split(" ");
const lastDay = addDays(today, WINDOW_DAYS);

/** Local checks: everything a post needs before it may go out unattended. Returns a list of problems. */
export function checkPost(p, dir) {
  const errors = [];
  for (const k of ["id", "time", "lang", "title", "ig", "fb", "tiktok"]) if (typeof p[k] !== "string" || !p[k].trim()) errors.push(`missing "${k}"`);
  if (p.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(p.time)) errors.push(`time "${p.time}" is not HH:MM`);
  if (p.title?.length > 100) errors.push("title over 100 chars");
  if (!/https:\/\/meapica\.shop\S*utm_source=facebook\S*org_fb_/.test(p.fb ?? "")) errors.push("fb caption needs the UTM link (utm_source=facebook, utm_content=org_fb_…)");
  if (!Array.isArray(p.media) || p.media.length === 0) errors.push("no media");
  else {
    const isVideo = p.media[0].type === "video";
    if (isVideo && p.media.length > 1) errors.push("a video post takes exactly one file");
    if (isVideo && typeof p.madeForKids !== "boolean") errors.push("video posts must set madeForKids (true for stories a child watches)");
    if (!isVideo && p.media.length > 10) errors.push("Instagram carousels take at most 10 images");
    if (!isVideo && !(p.tiktokTitle?.length > 0 && p.tiktokTitle.length <= 90)) errors.push("image posts need a tiktokTitle of 1-90 chars");
    for (const m of p.media) {
      if (!["video", "image"].includes(m.type) || (m.type === "video") !== isVideo) errors.push(`media type of ${m.file}`);
      if (!existsSync(`${dir}/${m.file}`)) errors.push(`media file missing: ${m.file}`);
      if (m.type === "image" && !m.alt) errors.push(`alt text missing: ${m.file}`);
    }
  }
  for (const k of ["title", "ig", "fb", "tiktok", "tiktokTitle"]) {
    const text = p[k] ?? "";
    // B2C rule: every price carries its VAT note right next to the number.
    if (/€(?!\s*IVA incl)/.test(text)) errors.push(`${k}: a price without "IVA incluido / IVA inclòs" next to it`);
    if (/\b(IA|AI)\b/.test(text)) errors.push(`${k}: mentions IA/AI (not a selling angle)`);
    if (/—/.test(text)) errors.push(`${k}: em-dash`);
  }
  if (p.ig?.length > 2200) errors.push("ig caption over 2200 chars");
  if (p.tiktok?.length > 2200) errors.push("tiktok caption over 2200 chars");
  return errors;
}

function loadPosts() {
  if (!existsSync(POSTS_DIR)) return [];
  return readdirSync(POSTS_DIR)
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && existsSync(`${POSTS_DIR}/${d}/post.json`))
    .sort()
    .map((date) => {
      const dir = `${POSTS_DIR}/${date}`;
      let post, errors;
      try {
        post = JSON.parse(readFileSync(`${dir}/post.json`, "utf8"));
        errors = checkPost(post, dir);
      } catch (e) {
        errors = [`post.json: ${e.message}`];
      }
      return { date, dir, post, errors };
    });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(`${SCHEDULE ? "MODE: SCHEDULE" : "MODE: dry run (nothing is created)"} · today ${today} · window → ${lastDay}`);
  const all = loadPosts().filter((x) => (ONLY_DATE ? x.date === ONLY_DATE : x.date >= today));
  const due = all.filter((x) => x.date <= lastDay);
  let failed = 0;

  const accounts = await meapicaAccounts();
  for (const [platform, a] of Object.entries(accounts)) {
    console.log(`  ${platform}: ${a ? `@${a.username} health=${a.health}${a.health !== "healthy" ? ` ${JSON.stringify(a.healthIssues)}` : ""}` : "account NOT FOUND"}`);
    if (!a || a.health === "error") failed++;
  }
  if (failed && SCHEDULE) {
    console.error("Aborted: an account is missing or unhealthy (reconnect it in Zernio). Nothing was scheduled; the next run retries.");
    process.exit(1);
  }

  // What Zernio already holds: same caption on the same Madrid day = this post.
  // ponytail: reads the 100 most recent posts of the profile; paginate if we ever schedule more than that ahead.
  const list = await api("GET", `/posts?profileId=${PROFILE_ID}&limit=100&sortBy=created-desc`);
  if (list.status !== 200) throw new Error(`posts: HTTP ${list.status} ${JSON.stringify(list.json)}`);
  const existing = new Set(
    list.json.posts
      .filter((x) => !["failed", "cancelled"].includes(x.status) && x.scheduledFor)
      .map((x) => `${madrid(new Date(x.scheduledFor)).split(" ")[0]}|${x.content}`),
  );

  for (const x of all) {
    const head = `${x.date} ${x.post?.time ?? "--:--"} ${x.post?.id ?? "?"}`;
    if (x.errors.length) {
      console.log(`✗ ${head}: ${x.errors.join("; ")}`);
      failed++;
      continue;
    }
    if (existing.has(`${x.date}|${x.post.ig}`)) { console.log(`= ${head}: already in Zernio`); continue; }
    if (!due.includes(x)) { console.log(`· ${head}: outside the ${WINDOW_DAYS}-day window, a later run schedules it`); continue; }
    if (!SCHEDULE) { console.log(`→ ${head}: would schedule (${x.post.media.length} ${x.post.media[0].type})`); continue; }

    try {
      const urls = {};
      for (const m of x.post.media) {
        urls[m.file] = await uploadMedia(`${x.dir}/${m.file}`);
        const v = await api("POST", "/tools/validate/media", { url: urls[m.file] });
        if (v.json.valid === false) throw new Error(`media ${m.file} invalid: ${v.json.error ?? JSON.stringify(v.json)}`);
      }
      // A time already past today is published by Zernio right away (catch-up after a missed run).
      const body = { ...buildPostBody(x.post, accounts, urls), scheduledFor: `${x.date}T${x.post.time}:00` };
      const v = await api("POST", "/tools/validate/post", body);
      if (v.json.valid === false) throw new Error(`validate: ${JSON.stringify(v.json.errors)}`);
      const r = await api("POST", "/posts", body, { "Idempotency-Key": idemKey(`meapica-${x.post.id}-${x.date}`) });
      if (r.status >= 300 || !r.json.post?._id) throw new Error(`HTTP ${r.status} ${JSON.stringify(r.json).slice(0, 400)}`);
      console.log(`✓ ${head}: ${r.json.post.status} for ${r.json.post.scheduledFor} (${r.json.post._id}) warnings=${JSON.stringify(v.json.warnings ?? [])}`);
    } catch (e) {
      console.log(`✗ ${head}: ${e.message}`);
      failed++;
    }
  }

  // The agent producing content needs to know when the folder is running dry.
  const lastPlanned = all.at(-1)?.date ?? "none";
  console.log(`last planned post: ${lastPlanned}${lastPlanned < addDays(today, 3) ? "  ← WARNING: fewer than 3 days of content left" : ""}`);
  process.exit(failed ? 1 : 0);
}
