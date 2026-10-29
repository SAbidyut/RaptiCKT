"""Two characters written touching (a 30 run together, a 5V, a 2k) for the hand-writing glyph
classifier's extra class 'pair': a blot that is two characters, not one. The reader then cuts
it apart rather than read it as some wide single character (a run-together 30 as a 9). Written
like hand.py's (one writer's slant and pen for both), spoiled like a phone photo. Output as
render.py's, the class index after the shared classes (train.py EXTRA=pair).

    python3 pairs.py OUT_DIR [PREVIEW.png]

N (environment) sets the number of pairs (default 6000).
"""
import os, random, struct, sys
import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(__file__))
from render import CLASSES, degrade  # noqa: E402
from hand import HAND, TAILS, write  # noqa: E402

PAIR = len(CLASSES)  # the class index of a pair
FIRST = list('0123456789')
SECOND = list('0123456789') * 2 + ['Ω', 'Ω', 'k', 'v', 'm', 'A', 'F', 'H', 'μ']


def ink_box(im):
    a = np.asarray(im) > 127
    ys, xs = np.nonzero(a)
    return a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def pair(rnd):
    """Two characters, one writer, side by side and touching: white on black."""
    a, b = rnd.choice(FIRST), rnd.choice(SECOND)
    hand = {'slant': rnd.uniform(-0.12, 0.42), 'sx': rnd.uniform(0.72, 1.32)}
    hand['pen'] = max(2, int(round(80 * (rnd.uniform(0.045, 0.15) if rnd.random() < 0.8 else rnd.uniform(0.15, 0.21)))))
    A = ink_box(write(rnd.choice(HAND[a]), rnd, a in TAILS, hand))
    B = ink_box(write(rnd.choice(HAND[b]), rnd, b in TAILS, hand))
    # small letters sit on the line, a little lower than a digit is tall
    h = max(A.shape[0], B.shape[0])
    # they touch: the second starts where the first ends, or a little before
    over = int(round(rnd.uniform(0.0, 0.22) * min(A.shape[1], B.shape[1]))) + hand['pen'] // 2
    W = A.shape[1] + B.shape[1] - over
    out = np.zeros((h + 8, W + 8), bool)
    out[4 + h - A.shape[0]:4 + h, 4:4 + A.shape[1]] |= A
    x = 4 + A.shape[1] - over
    out[4 + h - B.shape[0]:4 + h, x:x + B.shape[1]] |= B
    im = Image.fromarray((out * 255).astype(np.uint8))
    # only a touching pair is one blot: fill from the first one's ink, and the second's is reached
    ys, xs = np.nonzero(out[:, :x])
    if not len(xs): return None
    filled = im.copy()
    ImageDraw.floodfill(filled, (int(xs[0]), int(ys[0])), 128)
    f = np.asarray(filled)
    if not (f[:, x + B.shape[1] // 2:] == 128).any(): return None
    return im


def main():
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    rnd = random.Random(71)
    n, want, sheet = 0, int(os.environ.get('N', '6000')), []
    with open(os.path.join(out, 'glyphs.bin'), 'wb') as f:
        while n < want:
            im = pair(rnd)
            if im is None: continue
            if len(sheet) < 96: sheet.append(im)
            b = degrade(im, rnd)
            if b is None: continue
            h, w = b.shape
            f.write(struct.pack('BBB', PAIR, w, h)); f.write(b.astype(np.uint8).tobytes()); n += 1
    print('pairs', n)
    if len(sys.argv) > 2:
        cell, cols = 96, 16
        S = Image.new('L', (cols * cell, ((len(sheet) + cols - 1) // cols) * cell), 0)
        for k, im in enumerate(sheet):
            im = im.copy(); im.thumbnail((cell - 4, cell - 4))
            S.paste(im, ((k % cols) * cell + 2, (k // cols) * cell + 2))
        S.save(sys.argv[2])


if __name__ == '__main__':
    main()
