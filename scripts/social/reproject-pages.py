# Same photo, other pages: finds where the generated photo shows a known page (feature matching), then prints any
# other real page in that exact place with the photo's light and with fingers kept in front.
# usage: python3 -I pages.py <generated.jpg> <out prefix> <match left.png> <match right.png> <left.png> <right.png> [...]
import sys, cv2, numpy as np
gen = cv2.imread(sys.argv[1]).astype(np.float32); prefix = sys.argv[2]
match = sys.argv[3:5]; spreads = [sys.argv[i:i + 2] for i in range(5, len(sys.argv), 2)]
size = (gen.shape[1], gen.shape[0]); k = (0, 0)
sift = cv2.SIFT_create(6000); bf = cv2.BFMatcher()
kg, dg = sift.detectAndCompute(cv2.cvtColor(gen.astype(np.uint8), cv2.COLOR_BGR2GRAY), None)
slots = []
for path in match:
    ref = cv2.imread(path); h, w = ref.shape[:2]
    kr, dr = sift.detectAndCompute(cv2.cvtColor(ref, cv2.COLOR_BGR2GRAY), None)
    good = [m for m, n in bf.knnMatch(dr, dg, k=2) if m.distance < 0.72 * n.distance]
    H, inl = cv2.findHomography(np.float32([kr[m.queryIdx].pt for m in good]), np.float32([kg[m.trainIdx].pt for m in good]), cv2.RANSAC, 4.0)
    assert inl.sum() >= 25, f"{path}: only {int(inl.sum())} inliers"
    warp = cv2.warpPerspective(ref, H, size, flags=cv2.INTER_AREA).astype(np.float32)
    mask = cv2.erode(cv2.warpPerspective(np.full((h, w), 255, np.uint8), H, size), np.ones((5, 5), np.uint8))
    m = mask.astype(np.float32) / 255
    ratio = np.clip((cv2.GaussianBlur(gen * m[..., None], k, 28) + 1) / (cv2.GaussianBlur(warp * m[..., None], k, 28) + 1), 0.55, 1.45)
    diff = cv2.GaussianBlur(np.abs(gen - np.clip(warp * ratio, 0, 255)).max(axis=2), k, 3)
    occ = cv2.morphologyEx(((diff > 62) & (mask > 0)).astype(np.uint8), cv2.MORPH_OPEN, np.ones((9, 9), np.uint8))
    edge = cv2.dilate((mask == 0).astype(np.uint8), np.ones((31, 31), np.uint8))
    n, lab, stats, _ = cv2.connectedComponentsWithStats(occ)
    keep = np.zeros_like(occ)
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] > 900 and (edge[lab == i] > 0).any(): keep[lab == i] = 1
    alpha = cv2.GaussianBlur(m * (1 - cv2.dilate(keep, np.ones((7, 7), np.uint8))), k, 1.6)[..., None]
    slots.append((H, ratio, alpha, (w, h)))
for j, pair in enumerate(spreads):
    out = gen.copy()
    for path, (H, ratio, alpha, (w, h)) in zip(pair, slots):
        page = cv2.resize(cv2.imread(path), (w, h), interpolation=cv2.INTER_AREA)
        lit = np.clip(cv2.warpPerspective(page, H, size, flags=cv2.INTER_AREA).astype(np.float32) * ratio, 0, 255)
        out = out * (1 - alpha) + lit * alpha
    cv2.imwrite(f"{prefix}{j}.png", out.astype(np.uint8))
    print(f"{prefix}{j}.png", pair)
