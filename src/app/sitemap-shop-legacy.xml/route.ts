import sitemap from "../sitemap";

/**
 * TEMPORARY (remove after 2027-03-31, or earlier once Search Console for sc-domain:meapica.shop
 * shows no indexed pages): the old meapica.shop URLs, so Google recrawls them and sees their 308.
 *
 * meapica.es became the primary domain on 2026-10-23 and meapica.shop 308s to it (a Vercel domain
 * redirect, so nothing in this app answers on .shop). On 2026-11-21 Google still held .shop pages
 * it had not recrawled since mid-October: meapica.shop/es/gifts had 246 impressions in 90 days
 * while meapica.es/es/gifts was "URL is unknown to Google", and for /es/personalized-books/in-catalan
 * Google chose the .shop URL as canonical over the .es one. Google's site-move guide asks for a
 * sitemap of the old URLs next to the new one for exactly this.
 *
 * The list is the live sitemap with the host swapped. Every URL was checked on 2026-11-21: .shop
 * answers 308 to the same path on .es, which answers 200, self-canonical, no noindex. Same paths on
 * both domains, so the two lists cannot drift apart. Submit it as
 * `https://meapica.shop/sitemap-shop-legacy.xml` in the sc-domain:meapica.shop property (it
 * follows the 308 here, as it already does for sitemap.xml). Not linked from robots.txt or the
 * main sitemap: it lists another domain's URLs, which only a Search Console submission validates.
 */
export const dynamic = "force-static";
export const revalidate = 3600;

const NEW_ORIGIN = "https://meapica.es/";
const OLD_ORIGIN = "https://meapica.shop/";

const escapeXml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function GET() {
  const urls = (await sitemap())
    .map((entry) => entry.url)
    .filter((url) => url.startsWith(NEW_ORIGIN))
    .map((url) => OLD_ORIGIN + url.slice(NEW_ORIGIN.length));

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((url) => `<url><loc>${escapeXml(url)}</loc></url>`),
    "</urlset>",
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
