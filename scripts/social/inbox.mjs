// Read-only community inbox of the Meapica accounts (Instagram, TikTok, Facebook) through Zernio:
// comments without an answer from us and conversations (DMs) with unread messages, as JSON.
//   node scripts/social/inbox.mjs
// Zernio caches comment listings for up to 10 minutes; DMs exist for Instagram and Facebook only.
// ponytail: listing only. Replies (POST /inbox/comments/{postId}, POST /inbox/conversations/{id}/messages)
// are added with the reply routine once there is a first comment to test them against.
import { PROFILE_ID, api } from "./zernio.mjs";

const PLATFORMS = ["instagram", "tiktok", "facebook"];
const get = async (path) => {
  const r = await api("GET", path);
  if (r.status !== 200) throw new Error(`${path}: HTTP ${r.status} ${JSON.stringify(r.json).slice(0, 300)}`);
  return r.json;
};

const posts = (await get(`/inbox/comments?profileId=${PROFILE_ID}&minComments=1&limit=50`)).data.filter((p) => PLATFORMS.includes(p.platform));
const comments = [];
for (const p of posts) {
  const thread = await get(`/inbox/comments/${encodeURIComponent(p.id)}?accountId=${p.accountId}&limit=50`);
  for (const c of thread.comments ?? []) {
    if (c.from?.isOwner || c.isHidden) continue;
    if ((c.replies ?? []).some((r) => r.from?.isOwner)) continue; // already answered by us
    comments.push({ platform: p.platform, postId: p.id, accountId: p.accountId, permalink: p.permalink, commentId: c.id, from: c.from?.username ?? c.from?.name, at: c.createdTime, message: c.message });
  }
}

const conversations = (await get(`/inbox/conversations?profileId=${PROFILE_ID}&status=active&limit=50`)).data
  .filter((c) => PLATFORMS.includes(c.platform) && (c.unreadCount ?? 0) > 0)
  .map((c) => ({ platform: c.platform, conversationId: c.id, accountId: c.accountId, from: c.participantName, at: c.updatedTime, unread: c.unreadCount, lastMessage: c.lastMessage }));

console.log(JSON.stringify({ comments, conversations }, null, 2));
