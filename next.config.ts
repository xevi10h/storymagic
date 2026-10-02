import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Legacy Spanish route slugs (renamed to English 2026-10-01). Keep these
// redirects forever: old emails, Stripe cancel URLs, ads and bookmarks still
// point at them. Each rule is emitted with and without the locale prefix;
// `:path*` matches zero or more segments and the query string is passed on.
const LOCALE_PARAM = ":locale(es|ca|en|fr)";
const LEGACY_SLUG_REDIRECTS: Array<[from: string, to: string]> = [
  // Most specific first: the nested /generar segment was renamed too.
  ["/crear/:storyId/generar", "/create/:storyId/generate"],
  // Exact paths first: `:path*` with zero segments leaves a trailing slash (extra hop).
  ["/crear", "/create"],
  ["/ejemplo", "/examples"],
  ["/perfil", "/profile"],
  ["/crear/:path+", "/create/:path+"],
  ["/ejemplo/:path+", "/examples/:path+"],
  ["/perfil/:path+", "/profile/:path+"],
];

const nextConfig: NextConfig = {
  // PostHog EU through our own domain (ad blockers drop *.posthog.com). Keep in sync
  // with api_host "/ingest" in src/lib/tracking/posthog.ts and the middleware matcher.
  async rewrites() {
    return [
      { source: "/ingest/static/:path*", destination: "https://eu-assets.i.posthog.com/static/:path*" },
      { source: "/ingest/array/:path*", destination: "https://eu-assets.i.posthog.com/array/:path*" },
      { source: "/ingest/:path*", destination: "https://eu.i.posthog.com/:path*" },
    ];
  },
  // PostHog API paths end in "/": no trailing-slash redirect on them.
  skipTrailingSlashRedirect: true,
  async redirects() {
    return LEGACY_SLUG_REDIRECTS.flatMap(([from, to]) => [
      { source: `/${LOCALE_PARAM}${from}`, destination: `/:locale${to}`, permanent: true },
      { source: from, destination: to, permanent: true },
    ]);
  },
  serverExternalPackages: ["sharp", "@react-pdf/renderer"],
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      // PUBLIC objects only (showcase / marketing). Signed URLs of the private
      // `illustrations` bucket (/storage/v1/object/sign/...) are deliberately NOT
      // optimizable: the optimizer caches by full URL for max(minimumCacheTTL,
      // upstream max-age = 1 year), which would outlive the signature. Children's
      // images are rendered with plain <img>.
      {
        protocol: "https",
        hostname: "rmxjtugoyfaxxkiiayss.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      // MOCK_MODE placeholder images (dev/test only)
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
      {
        protocol: "https",
        hostname: "fastly.picsum.photos",
      },
    ],
  },
};

export default withNextIntl(nextConfig);
