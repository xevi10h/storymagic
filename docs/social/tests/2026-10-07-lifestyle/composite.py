# Re-projects the real book page(s) onto a generated photo so the printed art and text are exactly ours.
# usage: python3 -I composite.py <generated.jpg> <out.jpg> <ref page png> [<ref page png> ...]
import sys, cv2, numpy as np
gen = cv2.imread(sys.argv[1]); out = gen.copy().astype(np.float32)
sift = cv2.SIFT_create(6000); bf = cv2.BFMatcher()
kg, dg = sift.detectAndCompute(cv2.cvtColor(gen, cv2.COLOR_BGR2GRAY), None)
for path in sys.argv[3:]:
    ref = cv2.imread(path); h, w = ref.shape[:2]
    kr, dr = sift.detectAndCompute(cv2.cvtColor(ref, cv2.COLOR_BGR2GRAY), None)
    good = [m for m, n in bf.knnMatch(dr, dg, k=2) if m.distance < 0.72 * n.distance]
    if len(good) < 20: print(path, "too few matches", len(good)); continue
    H, inl = cv2.findHomography(np.float32([kr[m.queryIdx].pt for m in good]), np.float32([kg[m.trainIdx].pt for m in good]), cv2.RANSAC, 4.0)
    n = int(inl.sum()); print(path, "matches", len(good), "inliers", n)
    if n < 25: print("  skipped: not reliable"); continue
    size = (gen.shape[1], gen.shape[0])
    warp = cv2.warpPerspective(ref, H, size, flags=cv2.INTER_AREA).astype(np.float32)
    mask = cv2.warpPerspective(np.full((h, w), 255, np.uint8), H, size)
    mask = cv2.erode(mask, np.ones((5, 5), np.uint8))
    m = mask.astype(np.float32) / 255
    # Lighting: carry the photo's low-frequency light and colour cast onto the flat page.
    k = (0, 0); s = 28
    gl = cv2.GaussianBlur(out * m[..., None], k, s); wl = cv2.GaussianBlur(warp * m[..., None], k, s)
    ratio = np.clip((gl + 1) / (wl + 1), 0.55, 1.45)
    lit = np.clip(warp * ratio, 0, 255)
    # Occluders (fingers, ribbon, paper): where the photo differs a lot from the lit page, in blobs that reach the page edge.
    diff = cv2.GaussianBlur(np.abs(out - lit).max(axis=2), k, 3)
    occ = ((diff > 62) & (mask > 0)).astype(np.uint8)
    occ = cv2.morphologyEx(occ, cv2.MORPH_OPEN, np.ones((9, 9), np.uint8))
    edge = cv2.dilate((mask == 0).astype(np.uint8), np.ones((31, 31), np.uint8))
    nlab, lab, stats, _ = cv2.connectedComponentsWithStats(occ)
    keep = np.zeros_like(occ)
    for i in range(1, nlab):
        comp = lab == i
        if stats[i, cv2.CC_STAT_AREA] > 900 and (edge[comp] > 0).any(): keep[comp] = 1
    keep = cv2.dilate(keep, np.ones((7, 7), np.uint8))
    a = cv2.GaussianBlur(m * (1 - keep), k, 1.6)[..., None]
    out = out * (1 - a) + lit * a
    print("  occluded px", int(keep.sum()))
cv2.imwrite(sys.argv[2], out.astype(np.uint8), [cv2.IMWRITE_JPEG_QUALITY, 93])
