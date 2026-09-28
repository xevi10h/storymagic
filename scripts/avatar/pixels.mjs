// Pixel utilities for the watercolor avatar matrix (scripts/avatar/generate-matrix.mjs).
//
// gpt-image masks are guidance only (the model repaints the whole canvas), so
// every derived portrait is REGISTERED to its parent (scale + translation) and
// the parent's inner face is COMPOSITED back pixel-exactly. That is what keeps
// the eyes at the same pixel in every variant, so glasses / freckles / eye
// colour overlays line up without per-image placement.

import sharp from "sharp";

export const SIZE = 1024;

/** @typedef {{ data: Buffer, w: number, h: number }} Img  RGBA, 8 bit */

export async function load(input) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

export function toSharp(img) {
  return sharp(img.data, { raw: { width: img.w, height: img.h, channels: 4 } });
}

export const toPng = (img) => toSharp(img).png().toBuffer();

// ── Masks ────────────────────────────────────────────────────────────────────

/** Soft ellipse weight in [0,1]: 1 inside, 0 beyond `feather` px outside the edge. */
export function ellipseWeights(w, h, { cx, cy, rx, ry }, feather) {
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      const d = Math.sqrt(dx * dx + dy * dy); // 1 on the edge
      const px = (d - 1) * Math.min(rx, ry); // ~px outside the edge
      out[y * w + x] = px <= 0 ? 1 : px >= feather ? 0 : 1 - smooth(px / feather);
    }
  return out;
}

export function rectWeights(w, h, { x0, y0, x1, y1 }, feather) {
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const dx = Math.max(x0 - x, 0, x - x1);
      const dy = Math.max(y0 - y, 0, y - y1);
      const d = Math.sqrt(dx * dx + dy * dy);
      out[y * w + x] = d >= feather ? 0 : 1 - smooth(d / feather);
    }
  return out;
}

const smooth = (t) => t * t * (3 - 2 * t);
const smoothstep = (a, b, v) => (v <= a ? 0 : v >= b ? 1 : smooth((v - a) / (b - a)));

// ── Registration ─────────────────────────────────────────────────────────────

function lumaDownsample(img, f) {
  const w = Math.floor(img.w / f);
  const h = Math.floor(img.h / f);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let yy = 0; yy < f; yy++)
        for (let xx = 0; xx < f; xx++) {
          const i = ((y * f + yy) * img.w + (x * f + xx)) * 4;
          s += 0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2];
        }
      out[y * w + x] = s / (f * f);
    }
  return { v: out, w, h };
}

/** Gradient magnitude — skin tone changes shift brightness, edges stay put. */
function gradient({ v, w, h }) {
  const out = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const gx = v[y * w + x + 1] - v[y * w + x - 1];
      const gy = v[(y + 1) * w + x] - v[(y - 1) * w + x];
      out[y * w + x] = Math.sqrt(gx * gx + gy * gy);
    }
  return { v: out, w, h };
}

function sample(g, x, y) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  if (x0 < 0 || y0 < 0 || x0 >= g.w - 1 || y0 >= g.h - 1) return 0;
  const fx = x - x0;
  const fy = y - y0;
  const i = y0 * g.w + x0;
  return (g.v[i] * (1 - fx) + g.v[i + 1] * fx) * (1 - fy) + (g.v[i + g.w] * (1 - fx) + g.v[i + g.w + 1] * fx) * fy;
}

/**
 * Refines a similarity transform (scale about (cx,cy) + translation) mapping
 * `child` onto `parent`, minimising gradient differences inside `roi`
 * (full-res rect). `init` usually comes from the pupils (alignFromPupils).
 * parentPoint = c + s * (childPoint - c) + (dx, dy)
 */
export function register(parent, child, roi, init) {
  let best = { s: init.s, dx: init.dx, dy: init.dy };
  const { cx, cy } = init;
  let err = Infinity;
  let errInit = Infinity;
  for (const f of [2, 1]) {
    const P = gradient(lumaDownsample(parent, f));
    const C = gradient(lumaDownsample(child, f));
    const range = f === 2 ? 3 : 1.5; // ±6 px, then ±1.5 px
    const step = 0.5;
    const ds = f === 2 ? [-0.02, -0.01, 0, 0.01, 0.02] : [-0.005, 0, 0.005];
    const cost = (s, dx, dy) => {
      let e = 0;
      let n = 0;
      for (let y = roi.y0 / f; y < roi.y1 / f; y += 1)
        for (let x = roi.x0 / f; x < roi.x1 / f; x += 1) {
          const chx = (cx + (x * f - cx - dx) / s) / f;
          const chy = (cy + (y * f - cy - dy) / s) / f;
          const d = sample(P, x, y) - sample(C, chx, chy);
          e += d * d;
          n++;
        }
      return e / n;
    };
    if (f === 1) errInit = cost(init.s, init.dx, init.dy);
    let local = { ...best, e: Infinity };
    for (const d of ds)
      for (let oy = -range; oy <= range; oy += step)
        for (let ox = -range; ox <= range; ox += step) {
          const s = best.s + d;
          const dx = best.dx + ox * f;
          const dy = best.dy + oy * f;
          const e = cost(s, dx, dy);
          if (e < local.e) local = { s, dx, dy, e };
        }
    best = { s: local.s, dx: local.dx, dy: local.dy };
    err = local.e;
  }
  return { ...best, cx, cy, err, errInit };
}

/**
 * Initial transform from the two pupils: child pupils are searched ±`search`
 * px around the parent's. Returns null when a pupil cannot be found plausibly.
 */
export function alignFromPupils(parentEyes, child, search = 16) {
  const find = (p) => findPupil(child, { x0: p.x - search, y0: p.y - search, x1: p.x + search, y1: p.y + search });
  const l = find(parentEyes.left);
  const r = find(parentEyes.right);
  const dp = parentEyes.right.x - parentEyes.left.x;
  const dc = r.x - l.x;
  if (dc < dp * 0.85 || dc > dp * 1.15 || Math.abs(l.y - r.y) > 12) return null;
  const s = dp / dc;
  const cx = (parentEyes.left.x + parentEyes.right.x) / 2;
  const cy = (parentEyes.left.y + parentEyes.right.y) / 2;
  const mcx = (l.x + r.x) / 2;
  const mcy = (l.y + r.y) / 2;
  return { s, cx, cy, dx: s * (cx - mcx), dy: s * (cy - mcy), childEyes: { left: l, right: r } };
}

/** Resamples `child` into the parent's frame with the transform from `register`. */
export function warp(child, t) {
  const { w, h } = child;
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const sx = Math.min(w - 1.001, Math.max(0, t.cx + (x - t.cx - t.dx) / t.s));
      const sy = Math.min(h - 1.001, Math.max(0, t.cy + (y - t.cy - t.dy) / t.s));
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const fx = sx - x0;
      const fy = sy - y0;
      for (let c = 0; c < 4; c++) {
        const i = (y0 * w + x0) * 4 + c;
        const a = child.data[i] * (1 - fx) + child.data[i + 4] * fx;
        const b = child.data[i + w * 4] * (1 - fx) + child.data[i + w * 4 + 4] * fx;
        out[(y * w + x) * 4 + c] = Math.round(a * (1 - fy) + b * fy);
      }
    }
  return { data: out, w, h };
}

/** result = keep·weight + fill·(1-weight) */
export function blend(keep, fill, weights) {
  const out = Buffer.alloc(keep.data.length);
  for (let i = 0; i < weights.length; i++) {
    const k = weights[i];
    for (let c = 0; c < 3; c++) out[i * 4 + c] = Math.round(keep.data[i * 4 + c] * k + fill.data[i * 4 + c] * (1 - k));
    out[i * 4 + 3] = 255;
  }
  return { data: out, w: keep.w, h: keep.h };
}

// ── Overlays ─────────────────────────────────────────────────────────────────

/**
 * Glasses: alpha layer from the difference between the edited and the
 * unedited (registered) canonical portrait inside `roiWeights`. Colour = the
 * edited pixel, so frames keep their watercolour texture; skin under the lenses
 * stays transparent, so the layer sits on any skin tone.
 */
export function extractAlphaOverlay(base, edited, roiWeights, { lo = 18, hi = 50 } = {}) {
  const out = Buffer.alloc(base.data.length);
  for (let i = 0; i < roiWeights.length; i++) {
    const r = roiWeights[i];
    if (r <= 0) continue;
    // Only pixels the edit made DARKER: frames are painted dark (tinted later);
    // lighter differences are re-rendered highlights (nose tip, eye glints).
    const lum = (img) => 0.299 * img.data[i * 4] + 0.587 * img.data[i * 4 + 1] + 0.114 * img.data[i * 4 + 2];
    const d = lum(base) - lum(edited);
    const a = smoothstep(lo, hi, d) * r;
    if (a <= 0) continue;
    for (let c = 0; c < 3; c++) out[i * 4 + c] = edited.data[i * 4 + c];
    out[i * 4 + 3] = Math.round(a * 255);
  }
  return { data: out, w: base.w, h: base.h };
}

/**
 * Keeps only the big connected shapes of an alpha overlay (the frame is one
 * connected ring pair); drops re-render noise such as hair strands at the band
 * edges or ghosted eyelids inside the lenses.
 */
export function keepLargestComponents(overlay, { minAlpha = 0.25, minFraction = 0.15, dilate = 3 } = {}) {
  const { w, h } = overlay;
  const on = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) on[i] = overlay.data[i * 4 + 3] >= minAlpha * 255 ? 1 : 0;
  const label = new Int32Array(w * h);
  const sizes = [0];
  const stack = [];
  for (let i = 0; i < w * h; i++) {
    if (!on[i] || label[i]) continue;
    const id = sizes.length;
    let n = 0;
    stack.push(i);
    label[i] = id;
    while (stack.length) {
      const p = stack.pop();
      n++;
      const x = p % w;
      const y = (p - x) / w;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1], [x + 1, y + 1], [x - 1, y - 1], [x + 1, y - 1], [x - 1, y + 1]]) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const q = ny * w + nx;
        if (on[q] && !label[q]) {
          label[q] = id;
          stack.push(q);
        }
      }
    }
    sizes.push(n);
  }
  const largest = Math.max(0, ...sizes);
  const keepIds = new Set(sizes.map((n, id) => (id && n >= largest * minFraction ? id : -1)).filter((id) => id > 0));
  // keep mask, dilated so the soft low-alpha edges around kept shapes survive
  const keep = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) if (keepIds.has(label[i])) keep[i] = 1;
  const grown = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!keep[y * w + x]) continue;
      for (let dy = -dilate; dy <= dilate; dy++)
        for (let dx = -dilate; dx <= dilate; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < w && ny < h) grown[ny * w + nx] = 1;
        }
    }
  const out = Buffer.from(overlay.data);
  for (let i = 0; i < w * h; i++) if (!grown[i]) out[i * 4 + 3] = 0;
  return { data: out, w, h };
}

/**
 * Freckles: MULTIPLY layer (white = no change) from edited/base per channel.
 * Rendered with mix-blend-mode: multiply, so the dots darken any skin tone
 * proportionally instead of pasting one skin colour.
 */
export function extractMultiplyOverlay(base, edited, roiWeights, { lo = 0.03, hi = 0.12, gain = 1.8 } = {}) {
  const out = Buffer.alloc(base.data.length, 255);
  for (let i = 0; i < roiWeights.length; i++) {
    const r = roiWeights[i];
    if (r <= 0) continue;
    const ratios = [0, 1, 2].map((c) => Math.min(1, (edited.data[i * 4 + c] + 1) / (base.data[i * 4 + c] + 1)));
    const lum = 0.299 * ratios[0] + 0.587 * ratios[1] + 0.114 * ratios[2];
    const k = smoothstep(lo, hi, 1 - lum) * r;
    // gain > 1 deepens the dots (ratio^gain) so they read at avatar size.
    for (let c = 0; c < 3; c++) out[i * 4 + c] = Math.round(255 * (1 - k * (1 - ratios[c] ** gain)));
  }
  return { data: out, w: base.w, h: base.h };
}

/** Recolours an alpha overlay: keeps its luminance texture, maps it onto `rgb`. */
export function tintOverlay(overlay, [r, g, b]) {
  const out = Buffer.from(overlay.data);
  for (let i = 0; i < out.length; i += 4) {
    if (!out[i + 3]) continue;
    const l = (0.299 * out[i] + 0.587 * out[i + 1] + 0.114 * out[i + 2]) / 255; // dark frame ≈ 0.1–0.3
    const k = 0.55 + l * 0.9; // keep the wash variation
    out[i] = Math.min(255, Math.round(r * k));
    out[i + 1] = Math.min(255, Math.round(g * k));
    out[i + 2] = Math.min(255, Math.round(b * k));
  }
  return { data: out, w: overlay.w, h: overlay.h };
}

/** Darkest-blob centre (pupil) inside a search window. */
export function findPupil(img, { x0, y0, x1, y1 }) {
  // darkest 13 px blob, with a mild pull towards the window centre so a dark
  // lash corner on deep skin tones never wins over the pupil
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2;
  const reach = Math.max(x1 - x0, y1 - y0) / 2;
  let best = { x: 0, y: 0, v: Infinity };
  const r = 6;
  for (let y = y0; y < y1; y += 2)
    for (let x = x0; x < x1; x += 2) {
      let s = 0;
      for (let yy = -r; yy <= r; yy += 2)
        for (let xx = -r; xx <= r; xx += 2) {
          const i = ((y + yy) * img.w + (x + xx)) * 4;
          s += img.data[i] + img.data[i + 1] + img.data[i + 2];
        }
      const v = s * (1 + 0.25 * (Math.hypot(x - mx, y - my) / reach) ** 2);
      if (v < best.v) best = { x, y, v };
    }
  return { x: best.x, y: best.y };
}

/** 512 px webp for the web (hard size cap handled by the caller). */
export async function webp(img, { size = 512, quality = 78, alpha = false } = {}) {
  let s = toSharp(img).resize(size, size, { kernel: "lanczos3" });
  if (!alpha) s = s.removeAlpha();
  return s.webp({ quality, alphaQuality: 90, effort: 6, smartSubsample: true }).toBuffer();
}

/** Mean luminance inside a disc. */
export function meanLuma(img, cx, cy, r) {
  let s = 0;
  let n = 0;
  for (let y = Math.round(cy - r); y <= Math.round(cy + r); y++)
    for (let x = Math.round(cx - r); x <= Math.round(cx + r); x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 > r * r || x < 0 || y < 0 || x >= img.w || y >= img.h) continue;
      const i = (y * img.w + x) * 4;
      s += 0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2];
      n++;
    }
  return n ? s / n : 0;
}

/**
 * Iris recolour layer: every pixel the edit changed inside the iris discs, with
 * the edited (watercolour) pixel as colour. Glints and pupils the model kept
 * stay transparent, so the base's own highlights show through.
 */
export function extractDiffOverlay(base, edited, roiWeights, { lo = 8, hi = 30 } = {}) {
  const out = Buffer.alloc(base.data.length);
  for (let i = 0; i < roiWeights.length; i++) {
    const r = roiWeights[i];
    if (r <= 0) continue;
    let d = 0;
    for (let c = 0; c < 3; c++) d = Math.max(d, Math.abs(edited.data[i * 4 + c] - base.data[i * 4 + c]));
    const a = smoothstep(lo, hi, d) * r;
    if (a <= 0) continue;
    for (let c = 0; c < 3; c++) out[i * 4 + c] = edited.data[i * 4 + c];
    out[i * 4 + 3] = Math.round(a * 255);
  }
  return { data: out, w: base.w, h: base.h };
}

/**
 * Which pixels of the CANONICAL eyes can be pasted onto any skin tone: the dark
 * iris / pupil / lash line (clearly darker than the canonical skin) and, when
 * `sclera`, the bright unsaturated whites. Lid skin and crease shadows are
 * excluded, so no light patch appears around the eyes on darker skins.
 */
export function eyeWeights(canon, eyes, radius, skinLuma, { sclera = true } = {}) {
  const { w, h } = canon;
  const raw = new Float32Array(w * h);
  for (const p of [eyes.left, eyes.right])
    for (let y = Math.floor(p.y - radius); y <= Math.ceil(p.y + radius); y++)
      for (let x = Math.floor(p.x - radius); x <= Math.ceil(p.x + radius); x++) {
        const d = Math.hypot(x - p.x, y - p.y);
        if (d > radius) continue;
        const i = (y * w + x) * 4;
        const [r, g, b] = [canon.data[i], canon.data[i + 1], canon.data[i + 2]];
        const L = 0.299 * r + 0.587 * g + 0.114 * b;
        const sat = (Math.max(r, g, b) - Math.min(r, g, b)) / Math.max(1, Math.max(r, g, b));
        const dark = smoothstep(0, 1, (skinLuma - 45 - L) / 20);
        const white = sclera ? smoothstep(0, 1, (L - skinLuma - 8) / 15) * smoothstep(0, 1, (0.22 - sat) / 0.08) : 0;
        const edge = smoothstep(0, 1, (radius - d) / 2);
        raw[y * w + x] = Math.max(raw[y * w + x], Math.max(dark, white) * edge);
      }
  // 3×3 box blur: soft watercolour edges instead of a cut-out
  const out = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      let s = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += raw[(y + dy) * w + x + dx];
      out[y * w + x] = s / 9;
    }
  return out;
}

/**
 * Face-keep weights for a hair edit: the whole inner-face ellipse inside the
 * core (eyes, nose, mouth — always the parent's pixels, so overlays align),
 * and towards the ellipse rim only where the edit did NOT paint something new
 * (hair falling beside the jaw, a fringe over the forehead). Without this the
 * parent's paper background leaks back as pale wedges under the jaw.
 */
export function faceKeepWeights(parent, edit, ellipse, core, { feather = 26, lo = 40, hi = 85 } = {}) {
  const { w, h } = parent;
  const e = ellipseWeights(w, h, ellipse, feather);
  const c = ellipseWeights(w, h, core, 16);
  const raw = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (e[i] <= 0) continue;
    let d = 0;
    for (let k = 0; k < 3; k++) d = Math.max(d, Math.abs(parent.data[i * 4 + k] - edit.data[i * 4 + k]));
    raw[i] = e[i] * Math.max(c[i], 1 - smoothstep(lo, hi, d));
  }
  // 5×5 box blur: no speckle along the hair edge
  const out = new Float32Array(w * h);
  for (let y = 2; y < h - 2; y++)
    for (let x = 2; x < w - 2; x++) {
      let s = 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) s += raw[(y + dy) * w + x + dx];
      out[y * w + x] = s / 25;
    }
  return out;
}
