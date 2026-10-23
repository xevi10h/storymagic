import type { MetadataRoute } from "next";

// Private and transactional paths: the same for every crawler.
const DISALLOW = ["/api/", "/*/create/", "/*/dashboard", "/*/profile", "/*/auth/", "/*/checkout/"];

/**
 * AI search, assistant and training crawlers, named explicitly so the policy is visible
 * (we want answer engines to read and cite the site). A crawler that matches a named
 * group ignores the `*` group, so this group repeats the same disallows. Tokens checked
 * against the official docs on 2026-10-19:
 * - OpenAI (developers.openai.com/api/docs/bots): GPTBot, OAI-SearchBot, ChatGPT-User
 * - Perplexity (docs.perplexity.ai/guides/bots): PerplexityBot, Perplexity-User
 * - Anthropic (support.claude.com, article 8896518): ClaudeBot, Claude-SearchBot, Claude-User
 * - Google (developers.google.com, common crawlers): Google-Extended (Gemini training and grounding)
 * - Apple (support.apple.com/en-us/119829): Applebot (search), Applebot-Extended (training)
 * - Microsoft: Bingbot (Bing index, also used by Copilot)
 */
const AI_AND_SEARCH_BOTS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "PerplexityBot",
  "Perplexity-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "Google-Extended",
  "Applebot",
  "Applebot-Extended",
  "Bingbot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: DISALLOW },
      { userAgent: AI_AND_SEARCH_BOTS, allow: "/", disallow: DISALLOW },
    ],
    sitemap: "https://meapica.es/sitemap.xml",
    // No `Host:` line: Yandex-only and non-standard (Google ignores it); the
    // canonical host is enforced by the middleware 308s and <link rel="canonical">.
  };
}
