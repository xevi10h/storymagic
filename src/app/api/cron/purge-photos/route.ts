import { NextResponse } from "next/server";
import { childPhotoAdmin, purgeExpiredChildPhotos } from "@/lib/privacy/child-photo";

/**
 * Child photo purge. Hourly (vercel.json): deletes every object in the private
 * child-photos bucket older than 24 h (orphans included) and marks the consent
 * rows deleted_at. Backs the public promise "la borramos en menos de 24 horas";
 * the normal path deletes the photo right after the avatar / child sheet.
 *
 * Runs regardless of NEXT_PUBLIC_PHOTO_UPLOAD_ENABLED (turning the flag off must
 * never leave photos behind). Logs counts only — never paths' content or URLs.
 *
 * Vercel sends `Authorization: Bearer $CRON_SECRET`.
 */
export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron/purge-photos] CRON_SECRET not configured — purge disabled");
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await purgeExpiredChildPhotos(childPhotoAdmin());
    console.log(
      `[cron/purge-photos] cutoff ${result.cutoff}: removed ${result.removed}, consents marked ${result.consentsMarked}, failed ${result.failed}`,
    );
    return NextResponse.json(result, { status: result.failed > 0 ? 500 : 200 });
  } catch (error: unknown) {
    console.error(`[cron/purge-photos] failed: ${error instanceof Error ? error.message : "unknown"}`);
    return NextResponse.json({ error: "purge_failed" }, { status: 500 });
  }
}
