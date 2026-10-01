// IndexNow: tell Bing (and Yandex, Seznam, Naver…) every sitemap URL changed, so the
// Bing index (also used by Copilot / ChatGPT search) picks them up fast.
// The key file is public/2ecdea1c8139eed8afa1e608880f24f7.txt (served at https://meapica.shop/2ecdea1c8139eed8afa1e608880f24f7.txt).
// Run after a deploy: node scripts/indexnow-ping.mjs  [--dry-run]  [sitemap url]
const KEY = "2ecdea1c8139eed8afa1e608880f24f7";
const HOST = "meapica.shop";
const dryRun = process.argv.includes("--dry-run");
const sitemapUrl = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? `https://${HOST}/sitemap.xml`;

const keyRes = await fetch(`https://${HOST}/${KEY}.txt`);
if (!keyRes.ok || (await keyRes.text()).trim() !== KEY) {
  console.error(`Key file not live at https://${HOST}/${KEY}.txt (deploy first).`);
  process.exit(1);
}

const xml = await (await fetch(sitemapUrl)).text();
const urls = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)]
  .map((m) => m[1].replace(/&amp;/g, "&"))
  .filter((u) => new URL(u).host === HOST);
console.log(`${urls.length} URLs from ${sitemapUrl}`);
if (dryRun || urls.length === 0) process.exit(0);

// 10,000 URLs max per request.
for (let i = 0; i < urls.length; i += 10_000) {
  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList: urls.slice(i, i + 10_000) }),
  });
  // 200 = accepted, 202 = accepted (key validation pending).
  console.log(`batch ${i / 10_000 + 1}: ${res.status} ${await res.text()}`);
  if (res.status >= 300) process.exitCode = 1;
}
