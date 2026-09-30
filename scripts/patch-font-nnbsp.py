#!/usr/bin/env python3
"""
Adds U+202F NARROW NO-BREAK SPACE to a TrueType font (used by scripts/build-pdf-fonts.mjs).

Why: the Google Fonts builds of Fredoka and Plus Jakarta Sans have no U+202F glyph. French
typography puts it before ? ! ; (and often :), and inside « guillemets ». With no glyph in
any font of the stack, @react-pdf draws the .notdef glyph with no advance, so "Oui !"
printed as a glued "Oui!" with a stray mark.

The added glyph is empty (a space) and its advance is the font's own THIN SPACE (U+2009)
when it has one, else 1/5 em (the usual thin-space width). It is appended at the end of the
glyph order, so every existing glyph keeps its id and every existing text renders exactly as
before. Idempotent: a font that already maps U+202F is copied unchanged.

    python3 scripts/patch-font-nnbsp.py in.ttf out.ttf
    python3 scripts/patch-font-nnbsp.py --web patched.ttf public/fonts/print-spaces.woff2

--web writes a U+202F-only WOFF2 of a patched font: the web book viewer lists it first in its
font stacks (unicode-range U+202F, src/app/globals.css), because the Google web fonts lack the
glyph too and the browser would otherwise borrow a system font's (much narrower) space.
"""

import shutil
import sys

from fontTools.ttLib import TTFont
from fontTools.ttLib.tables._g_l_y_f import Glyph

NNBSP = 0x202F
THIN_SPACE = 0x2009


def patch(src: str, dst: str) -> str:
    font = TTFont(src, recalcTimestamp=False, recalcBBoxes=False)  # keep every existing table value as it was
    cmap = font.getBestCmap()
    if NNBSP in cmap:
        font.close()
        shutil.copyfile(src, dst)
        return "already has U+202F"
    if "glyf" not in font:
        raise SystemExit(f"{src}: only TrueType (glyf) fonts are supported")

    upm = font["head"].unitsPerEm
    thin = cmap.get(THIN_SPACE)
    advance = font["hmtx"][thin][0] if thin else round(upm / 5)

    name = "uni202F"
    glyf = font["glyf"]
    order = list(font.getGlyphOrder())
    if name in order:
        raise SystemExit(f"{src}: glyph {name} exists but is not mapped")
    order.append(name)  # appended → every existing glyph keeps its id
    font.setGlyphOrder(order)
    glyf.setGlyphOrder(order)
    glyf.glyphs[name] = Glyph()  # empty outline
    font["hmtx"][name] = (advance, 0)
    mapped = 0
    for table in font["cmap"].tables:
        if table.isUnicode():
            table.cmap[NNBSP] = name
            mapped += 1
    if mapped == 0:
        raise SystemExit(f"{src}: no Unicode cmap subtable")
    font.save(dst)
    font.close()
    return f"added U+202F (advance {advance}/{upm} em{' = thin space' if thin else ''})"


def web_subset(src: str, dst: str) -> str:
    from fontTools import subset

    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = []
    # Browsers sanitise web fonts (OTS): keep a real .notdef outline (an all-empty glyf table is
    # rejected) and drop layout/STAT tables that would point at removed glyphs or names.
    options.notdef_outline = True
    options.drop_tables += ["GSUB", "GPOS", "GDEF", "STAT"]
    font = TTFont(src)
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=[NNBSP])
    subsetter.subset(font)
    subset.save_font(font, dst, options)
    return f"wrote U+202F web subset {dst}"


if __name__ == "__main__":
    if len(sys.argv) == 4 and sys.argv[1] == "--web":
        print(web_subset(sys.argv[2], sys.argv[3]))
    elif len(sys.argv) == 3:
        print(patch(sys.argv[1], sys.argv[2]))
    else:
        raise SystemExit("usage: patch-font-nnbsp.py in.ttf out.ttf | --web patched.ttf out.woff2")
