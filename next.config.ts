import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
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
