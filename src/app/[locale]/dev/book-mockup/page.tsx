import { notFound } from "next/navigation";
import { BookMockupHarness } from "./BookMockupHarness";

/**
 * DEV-ONLY visual harness for src/components/book-mockup (404 in production builds).
 * /es/dev/book-mockup                     → interactive playground
 * /es/dev/book-mockup?format=softcover&variant=open&pose=pages&solo=1 → one clean instance (screenshots)
 * Optional overrides for product shots (scripts/build-merchant-feed-images.mts):
 * &cover=<url>&title=<text>&name=<text>&spine=<hex>&panorama=<url>&scale=0 (no dimension lines)
 */
export default async function BookMockupDevPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const q = await searchParams;
  return (
    <BookMockupHarness
      initialFormat={q.format === "softcover" || q.format === "pdf" ? q.format : "hardcover"}
      initialVariant={q.variant === "open" ? "open" : "closed"}
      initialPose={q.pose === "pages" ? "pages" : "spine"}
      solo={q.solo === "1"}
      noCover={q.nocover === "1"}
      longTitle={q.long === "1"}
      pair={q.spread === "pair"}
      coverOverride={q.cover}
      titleOverride={q.title}
      nameOverride={q.name}
      spineOverride={q.spine}
      panoramaOverride={q.panorama}
      showScale={q.scale !== "0"}
    />
  );
}
