import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/*/create/",
          "/*/dashboard",
          "/*/profile",
          "/*/auth/",
          "/*/checkout/",
        ],
      },
    ],
    sitemap: "https://meapica.shop/sitemap.xml",
    // No `Host:` line: Yandex-only and non-standard (Google ignores it); the
    // canonical host is enforced by the middleware 308s and <link rel="canonical">.
  };
}
