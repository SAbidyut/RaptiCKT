"""Real hand-written characters for the hand-writing glyph classifier, from HASYv2, the HASY
handwritten symbol dataset by Martin Thoma (Open Database License 1.0,
https://zenodo.org/record/259444): the classes the labels use (digits, + and -, Ω, μ, the unit
and prefix letters ...), as many people wrote them. Each sample is drawn again with a pen of
its own width, then turned, slanted and spoiled like a phone photo (render.degrade), several
copies each. Same output as render.py and hand.py (OUT_DIR/glyphs.bin), so features.mjs reads
it alike and train.py takes it with the others.

    python3 hasy.py HASY_DIR OUT_DIR [HOLDOUT_DIR]

HASY_DIR: HASYv2.tar.bz2 unpacked (hasy-data-labels.csv, hasy-data/). With HOLDOUT_DIR, every
tenth writer is kept out of OUT_DIR and written there instead (one copy each), to check the
model on writers it has not seen. COPIES (environment): copies per sample (default 6).
"""
import csv, os, random, struct, sys
import numpy as np
from PIL import Image, ImageFilter

sys.path.insert(0, os.path.dirname(__file__))
from render import CLASSES, degrade  # noqa: E402

# HASY's symbol (its LaTeX name) → the class it is read as (capitals that look like their small
# letter share its class, as in render.py)
CLASS_OF = {**{d: d for d in '0123456789'}, '+': '+', '-': '-', '\\Omega': 'Ω', 'v': 'v', 'V': 'v', 'A': 'A', 'k': 'k',
            'K': 'k', 'm': 'm', 'M': 'M', '\\mu': 'μ', 'F': 'F', 'H': 'H', 'i': 'i', 'x': 'x', 'X': 'x', 'o': 'o',
            'O': 'o', 'I': 'I', 'l': 'I', '|': 'I', 'R': 'R', 'a': 'a', 'b': 'b', 'L': 'L', 'c': 'c', 'C': 'c',
            'j': 'j', 's': 's', 'S': 's', 'g': 'g', 'u': 'u', 'r': 'r', 'e': 'e', 'n': 'n', 't': 't'}
U = 80  # px per glyph height, as hand.py writes


def pen_copy(ink, rnd):
    """The sample (32 x 32, True = ink) drawn again white on black at U px high, with a pen from
    a fine liner to a marker."""
    ys, xs = np.nonzero(ink)
    a = ink[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    h, w = a.shape
    # the size it has (a dot, a minus: as written next to a digit, not blown up to a digit's)
    k = U / 32 * rnd.uniform(0.9, 1.1)
    im = Image.fromarray((a * 255).astype(np.uint8)).resize((max(1, int(w * k * rnd.uniform(0.9, 1.1))), max(1, int(h * k))), Image.BILINEAR)
    pad = 24
    big = Image.new('L', (im.width + 2 * pad, im.height + 2 * pad), 0)
    big.paste(im, (pad, pad))
    # the sample's own line is about 1.5 px of 32: thicken it to the pen
    pen = U * (rnd.uniform(0.045, 0.15) if rnd.random() < 0.8 else rnd.uniform(0.15, 0.21))
    grow = max(0, int(round((pen - 1.5 * k) / 2)))
    if grow: big = big.filter(ImageFilter.MaxFilter(2 * grow + 1))
    return big.filter(ImageFilter.GaussianBlur(0.8)).point(lambda v: 255 if v > 100 else 0)


def main():
    src, out = sys.argv[1], sys.argv[2]
    hold = sys.argv[3] if len(sys.argv) > 3 else None
    copies = int(os.environ.get('COPIES', '6'))
    rnd = random.Random(53)
    rows = [r for r in csv.DictReader(open(os.path.join(src, 'hasy-data-labels.csv'))) if r['latex'] in CLASS_OF]
    os.makedirs(out, exist_ok=True)
    if hold: os.makedirs(hold, exist_ok=True)
    n = {out: 0, hold: 0}
    files = {out: open(os.path.join(out, 'glyphs.bin'), 'wb')}
    if hold: files[hold] = open(os.path.join(hold, 'glyphs.bin'), 'wb')
    for r in rows:
        ci = CLASSES.index(CLASS_OF[r['latex']])
        ink = np.asarray(Image.open(os.path.join(src, r['path'])).convert('L')) < 128
        if ink.sum() < 3: continue
        dest = hold if hold and int(r['user_id']) % 10 == 0 else out
        for _ in range(1 if dest == hold else copies):
            b = degrade(pen_copy(ink, rnd), rnd)
            if b is None: continue
            h, w = b.shape
            files[dest].write(struct.pack('BBB', ci, w, h)); files[dest].write(b.astype(np.uint8).tobytes()); n[dest] += 1
    for f in files.values(): f.close()
    print('HASY samples', n[out], 'held out', n[hold] if hold else 0)


if __name__ == '__main__':
    main()
