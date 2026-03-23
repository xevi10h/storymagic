import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/*/crear/",
          "/*/dashboard",
          "/*/perfil",
          "/*/auth/",
          "/*/checkout/",
        ],
      },
    ],
    sitemap: "https://meapica.com/sitemap.xml",
    host: "https://meapica.com",
  };
}
