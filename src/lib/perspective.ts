/** A point in the photo's pixel space. */
export type Point = readonly [number, number];
/** Corners clockwise from top-left: TL, TR, BR, BL. */
export type Quad = readonly [Point, Point, Point, Point];

/**
 * CSS `matrix3d` that maps a w × h element (transform-origin 0 0) onto `quad`, i.e. the projective
 * transform from its rectangle to four arbitrary corners (Heckbert, square-to-quad). Used to lay a
 * DOM face, like the cover, onto a book in a photo.
 */
export function quadMatrix3d(w: number, h: number, quad: Quad): string {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = quad;
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  const den = dx1 * dy2 - dx2 * dy1;
  const g = (dx3 * dy2 - dx2 * dy3) / den;
  const k = (dx1 * dy3 - dx3 * dy1) / den;
  const a = (x1 - x0 + g * x1) / w, b = (x3 - x0 + k * x3) / h;
  const d = (y1 - y0 + g * y1) / w, e = (y3 - y0 + k * y3) / h;
  const m = [a, d, 0, g / w, b, e, 0, k / h, 0, 0, 1, 0, x0, y0, 0, 1];
  return `matrix3d(${m.map((v) => +v.toFixed(8)).join(",")})`;
}
