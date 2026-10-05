// Shared Zernio helpers for the social scripts (publish-first-posts.mjs, schedule.mjs, inbox.mjs).
// API: https://zernio.com/api/v1 (OpenAPI v1.211.1 at https://zernio.com/openapi.json, read 2026-10-04).
// Key: $ZERNIO_API_KEY or ~/.config/zernio/api_key (never printed).
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, extname } from "node:path";

export const API = "https://zernio.com/api/v1";
/** Zernio profile "Default" (shared with the Licita-IA LinkedIn account: always filter by Meapica accounts). */
export const PROFILE_ID = "6abe71b148592fa1769c3511";

let KEY = null;
export async function api(method, path, body, extraHeaders = {}) {
  KEY ??= process.env.ZERNIO_API_KEY?.trim() || readFileSync(`${homedir()}/.config/zernio/api_key`, "utf8").trim();
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, ...(body ? { "Content-Type": "application/json" } : {}), ...extraHeaders },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 500) }; }
  return { status: res.status, json };
}

/** Deterministic UUID from a string: a retry with the same key never double-posts within Zernio's 24 h window. */
export function idemKey(s) {
  const h = createHash("sha1").update(s).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

const MIME = { ".mp4": "video/mp4", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg" };

/** Uploads a local file to Zernio temp storage (expires after 7 days) and returns its public URL. */
export async function uploadMedia(path) {
  const contentType = MIME[extname(path).toLowerCase()];
  if (!contentType) throw new Error(`unsupported media type: ${path}`);
  const pre = await api("POST", "/media/presign", { filename: basename(path), contentType, size: statSync(path).size });
  if (pre.status !== 200 || !pre.json.uploadUrl) throw new Error(`presign ${path}: HTTP ${pre.status} ${JSON.stringify(pre.json)}`);
  const put = await fetch(pre.json.uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: readFileSync(path) });
  if (!put.ok) throw new Error(`upload ${path}: HTTP ${put.status}`);
  return pre.json.publicUrl;
}

/** The Meapica accounts with their health: { instagram, tiktok, facebook, youtube, pinterest } → account (+ .health) or undefined. */
export async function meapicaAccounts() {
  const acc = await api("GET", "/accounts");
  if (acc.status !== 200) throw new Error(`accounts: HTTP ${acc.status}`);
  const pick = (platform, match) => acc.json.accounts.find((a) => a.platform === platform && match(a));
  const accounts = {
    instagram: pick("instagram", (a) => a.username === "meapica_books"),
    tiktok: pick("tiktok", (a) => a.username === "meapica_books"),
    facebook: pick("facebook", (a) => a.displayName === "Meapica"),
    youtube: pick("youtube", (a) => a.username === "meapica"),
    pinterest: pick("pinterest", (a) => a.username === "meapica"),
  };
  for (const a of Object.values(accounts)) {
    if (!a) continue;
    const h = await api("GET", `/accounts/${a._id}/health`);
    a.health = h.json.status ?? `HTTP ${h.status}`;
    a.healthIssues = h.json.issues ?? [];
  }
  return accounts;
}

/**
 * Body of POST /v1/posts for one post on the given accounts (checked against the OpenAPI spec).
 * p: { lang, media: [{ file, type: "video" | "image", alt? }], title, ig, fb, tiktok, tiktokTitle?, coverMs?, aiVideo?, madeForKids? }
 * YouTube takes videos only (under 3 min = Short); Pinterest takes the video or the first image, linked to the site.
 * urls: { [file]: public media URL }. The caller adds publishNow or scheduledFor.
 */
export function buildPostBody(p, accounts, urls) {
  const isVideo = p.media[0].type === "video";
  const mediaItems = p.media.map((m) => ({ type: m.type, url: urls[m.file], ...(m.alt ? { altText: m.alt } : {}) }));
  // Captions rarely get a click: the link also goes in the first comment where the platform allows one.
  const comment = (source) => {
    const link = p.fb.match(/https:\/\/meapica\.shop\S+/)?.[0]?.replace("utm_source=facebook", `utm_source=${source}`).replace("org_fb_", `org_${source.slice(0, 2)}c_`);
    if (!link) return {};
    return { firstComment: p.lang === "ca" ? `Crea el seu conte amb el seu nom i mira'l abans de pagar: ${link}` : `Crea su cuento con su nombre y míralo antes de pagar: ${link}` };
  };
  const platforms = [];
  if (accounts.instagram) {
    platforms.push({
      platform: "instagram",
      accountId: accounts.instagram._id,
      // 1 video = Reel, 2-10 items = carousel, 1 image = feed post (Zernio infers it; contentType only takes "story").
      platformSpecificData: isVideo ? { shareToFeed: true, thumbOffset: p.coverMs ?? 0, isAiGenerated: !!p.aiVideo } : {},
    });
  }
  if (accounts.facebook) {
    platforms.push({
      platform: "facebook",
      accountId: accounts.facebook._id,
      customContent: p.fb,
      // Video as a Page Reel (9:16, ≤ 60 s); images as a multi-image feed post (≤ 10).
      platformSpecificData: { ...(isVideo ? { contentType: "reel" } : {}), ...comment("facebook") },
    });
  }
  if (accounts.tiktok) {
    const tt = {
      privacyLevel: "PUBLIC_TO_EVERYONE", // creator-info: the only level for Business-lane videos
      allowComment: true,
      commercialContentType: "brand_organic", // our own brand promoting its product ("Your brand")
      contentPreviewConfirmed: true,
      expressConsentGiven: true,
    };
    if (isVideo) Object.assign(tt, { mediaType: "video", allowDuet: true, allowStitch: true, videoCoverTimestampMs: p.coverMs ?? 0, videoMadeWithAi: !!p.aiVideo });
    else Object.assign(tt, { mediaType: "photo", photoCoverIndex: 0, description: p.tiktok });
    platforms.push({
      platform: "tiktok",
      accountId: accounts.tiktok._id,
      // Photo posts: content becomes the ≤ 90-char title (hashtags/URLs stripped), the caption goes in description.
      customContent: isVideo ? p.tiktok : p.tiktokTitle,
      platformSpecificData: tt,
    });
  }
  // YouTube and Pinterest descriptions: the Facebook caption, which carries the full link instead of "link en la bio".
  const linked = (source) => p.fb.replace("utm_source=facebook", `utm_source=${source}`).replace("org_fb_", `org_${source.slice(0, 2)}_`);
  if (accounts.youtube && isVideo) {
    platforms.push({
      platform: "youtube",
      accountId: accounts.youtube._id,
      customContent: linked("youtube"),
      // madeForKids is a legal declaration (COPPA): true for stories a child watches, false for content aimed at parents.
      // Videos declared as made for kids have comments switched off by YouTube.
      platformSpecificData: { title: p.title, visibility: "public", madeForKids: !!p.madeForKids, containsSyntheticMedia: !!p.aiVideo, categoryId: "27", ...(p.madeForKids ? {} : comment("youtube")) },
    });
  }
  if (accounts.pinterest) {
    const link = linked("pinterest").match(/https:\/\/meapica\.shop\S+/)?.[0];
    platforms.push({
      platform: "pinterest",
      accountId: accounts.pinterest._id,
      customContent: linked("pinterest"),
      ...(isVideo ? {} : { customMedia: mediaItems.slice(0, 1) }),
      // No boardId: Zernio uses the account's default board.
      platformSpecificData: { title: p.title, link, isAiGenerated: !!p.aiVideo, ...(isVideo ? { coverImageKeyFrameTime: Math.round((p.coverMs ?? 0) / 1000) } : {}) },
    });
  }
  return { content: p.ig, mediaItems, platforms, timezone: "Europe/Madrid" };
}
