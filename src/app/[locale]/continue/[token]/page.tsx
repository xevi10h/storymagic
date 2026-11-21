import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { verifyStoryClaimToken } from "@/lib/share/story-claim-token";
import ClaimStory from "@/components/share/ClaimStory";

// "Continue your book" link from the owner's own email (src/lib/share/story-claim-token.ts).
// Side-effect free on GET (mail scanners open links): the move happens in the browser,
// after a real session exists (POST /api/stories/claim). Never cached or indexed.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string; token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "claimStory" });
  return {
    title: t("metaTitle"),
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
    // The token is in the URL: never leak it through the Referer header.
    referrer: "no-referrer",
    alternates: { canonical: null },
  };
}

export default async function ContinueStoryPage({ params }: Props) {
  const { token } = await params;
  // Same answer for a bad, tampered or expired link: no hint which part failed.
  return <ClaimStory token={token} valid={verifyStoryClaimToken(token).ok} />;
}
