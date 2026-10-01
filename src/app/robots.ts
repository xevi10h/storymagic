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
    host: "https://meapica.shop",
  };
}
