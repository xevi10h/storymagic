// Face anchor of the FINAL book (BookImagePlan.avatarUrl) — pure, no I/O.
//
// Avatar mode: the pre-rendered avatar (or the user's own portrait) the parent approved.
// Photo mode has no avatar: the anchor is the preview child sheet that was drawn FROM the
// photo during character creation (an illustration in the private `illustrations` bucket;
// the photo itself is deleted right after that sheet). Without it the final pipeline would
// redraw the child from the Character Bible text alone and the printed book would lose the
// likeness the parent saw in the preview.

export function finalFaceAnchor(
  avatarUrl: string | null,
  childSheet: { url: string; fromPhoto?: boolean },
): string | null {
  if (avatarUrl) return avatarUrl;
  return childSheet.fromPhoto ? childSheet.url : null;
}
