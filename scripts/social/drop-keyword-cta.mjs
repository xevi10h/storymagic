// One-off (owner 2026-10-27): the CUENTO/CONTE comment automations are paused, so the "Comenta CUENTO…" line is removed
// from every scheduled post (the captions already carry "link en la bio" on Instagram and the URL on Facebook), in Zernio
// AND in docs/social/posts/<date>/post.json at once: schedule.mjs matches Zernio posts by caption, so both must stay equal.
//   node scripts/social/drop-keyword-cta.mjs [--apply] [--only=<zernio post id>]
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { PROFILE_ID, api } from "./zernio.mjs";

const LINES = ["\nComenta CUENTO y te envío el enlace por privado.", "\nComenta CONTE i t'envio l'enllaç per privat."];
const swap = (text) => LINES.reduce((t, l) => t.split(l).join(""), text ?? "");
const APPLY = process.argv.includes("--apply");
const ONLY = process.argv.find((a) => a.startsWith("--only="))?.slice(7);
const madridDay = (iso) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });

const list = await api("GET", `/posts?profileId=${PROFILE_ID}&status=scheduled&limit=100`);
if (list.status !== 200) throw new Error(`posts: HTTP ${list.status}`);
for (const p of list.json.posts) {
  if (ONLY && p._id !== ONLY) continue;
  if (!/\b(CUENTO|CONTE)\b/.test(JSON.stringify(p))) continue;
  const day = madridDay(p.scheduledFor);
  const file = `docs/social/posts/${day}/post.json`;
  if (!existsSync(file)) { console.log(`✗ ${p._id} ${day}: no ${file}, skipped`); continue; }
  const post = JSON.parse(readFileSync(file, "utf8"));
  if (post.ig !== p.content) { console.log(`✗ ${p._id} ${day}: repo caption differs from Zernio, skipped`); continue; }
  const content = swap(p.content);
  const platforms = p.platforms.map(({ platform, accountId, customContent, customMedia, platformSpecificData }) => ({
    platform, accountId: accountId?._id ?? accountId, platformSpecificData, ...(customMedia?.length ? { customMedia } : {}),
    ...(customContent ? { customContent: swap(customContent) } : {}),
  }));
  const left = /\b(CUENTO|CONTE)\b/.test(content + platforms.map((x) => x.customContent ?? "").join(""));
  console.log(`${APPLY ? "→" : "·"} ${p._id} ${day}${left ? " (keyword still present elsewhere, check by hand)" : ""}`);
  if (!APPLY) continue;
  const r = await api("PUT", `/posts/${p._id}`, { content, platforms });
  if (r.status !== 200) { console.log(`  ✗ HTTP ${r.status} ${JSON.stringify(r.json).slice(0, 400)}`); continue; }
  post.ig = content;
  for (const k of ["fb", "tiktok"]) if (post[k]) post[k] = swap(post[k]);
  writeFileSync(file, `${JSON.stringify(post, null, 2)}\n`);
  console.log("  ✓ Zernio + repo");
}
