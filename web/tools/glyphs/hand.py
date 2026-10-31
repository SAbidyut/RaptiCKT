"""Hand-written characters for the offline circuit reader's glyph classifier.

Every class is drawn as pen strokes, in the few ways people write it (a 4 open or closed, or
open with its bar ending at the stem, an ohm as "_∩_" with short or long feet, a 1 with or
without its flag), and every copy is written differently: slant, turn, width, wobble, strokes a
little too long or too short, pen from a fine liner to a marker. Each copy is then spoiled like
a phone photo (render.degrade). Same output as render.py (OUT_DIR/glyphs.bin, per sample
[class u8][w u8][h u8][w*h bytes 0/1]), so features.mjs reads it alike and train.py takes both
folders.

    python3 hand.py OUT_DIR [PREVIEW.png]

PER (environment) sets the copies per way of writing a class (default 160).
"""
import math, os, random, struct, sys
import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(__file__))
from render import CLASSES, degrade  # noqa: E402


# ------------------------------------------------------------------ the strokes
# a glyph: x to the right, y down; capitals and digits from y = 0 (top) to 1 (the line), small
# letters from 0.42, descenders to 1.3


def arc(cx, cy, rx, ry, a0, a1):
    """points along an ellipse from angle a0 to a1 (degrees: 0 right, 90 down, 270 up)"""
    n = max(4, int(abs(a1 - a0) / 9))
    return [(cx + rx * math.cos(math.radians(a0 + (a1 - a0) * k / n)), cy + ry * math.sin(math.radians(a0 + (a1 - a0) * k / n))) for k in range(n + 1)]


def dot(x, y):
    return [(x, y), (x + 0.01, y + 0.005)]


HAND = {
    '0': [[arc(.28, .5, .27, .5, -90, 275)], [arc(.24, .5, .2, .5, -100, 268)]],
    '1': [[[(.25, 0), (.25, 1)]], [[(.04, .24), (.28, 0), (.28, 1)]], [[(.04, .22), (.28, 0), (.28, 1)], [(.04, 1), (.52, 1)]]],
    '2': [[arc(.27, .28, .25, .26, 195, 380) + [(.02, 1), (.56, 1)]],
          [arc(.27, .27, .25, .26, 200, 365) + [(.08, .92)] + arc(.1, .94, .08, .06, 270, 450) + [(.56, 1)]],
          [arc(.3, .27, .25, .27, 190, 375) + [(.12, .82)] + arc(.1, .9, .1, .1, 300, 640) + [(.3, .96), (.75, .93)]],
          [arc(.28, .26, .25, .25, 185, 370) + [(.1, .86)] + arc(.08, .92, .06, .06, 300, 640) + [(.6, .98), (.9, .95)]],
          [[(.02, .12), (.3, 0), (.52, .14), (.5, .32), (.04, 1), (.58, .97)]]],
    '3': [[arc(.27, .26, .23, .24, 200, 450) + arc(.27, .74, .27, .26, 270, 520)],
          [arc(.25, .22, .2, .2, 190, 440) + arc(.27, .7, .3, .3, 260, 525)],
          [arc(.28, .24, .26, .22, 200, 380) + [(.3, .44), (.06, .49), (.3, .51)] + arc(.28, .74, .28, .25, 290, 520)],
          [arc(.3, .22, .26, .2, 215, 395) + [(.14, .47), (.36, .5)] + arc(.3, .74, .27, .25, 280, 515)],
          [[(.05, 0), (.5, 0), (.22, .42)] + arc(.27, .72, .27, .28, 250, 520)]],
    '4': [[[(.42, 1), (.42, 0), (0, .66), (.6, .66)]], [[(.12, 0), (0, .62), (.6, .62)], [(.45, .25), (.45, 1)]],
          # open at the top, the stem no longer than its arm, the bar ending at the stem (a "Ч")
          [[(.04, 0), (0, .45), (.5, .45)], [(.5, 0), (.5, 1)]],
          [[(.04, 0), (.03, .3), (.12, .43), (.3, .45), (.52, .4)], [(.52, 0), (.54, 1)]]],
    '5': [[[(.5, 0), (.1, 0), (.06, .45)] + arc(.27, .7, .27, .3, 220, 500)],
          [[(.1, 0), (.06, .45)] + arc(.27, .7, .27, .3, 220, 500), [(.1, 0), (.52, 0)]]],
    '6': [[arc(.32, .5, .3, .5, 290, 90) + arc(.3, .72, .27, .28, 90, -180)],
          [[(.46, 0), (.12, .45)] + arc(.3, .72, .28, .28, 200, -160)],
          [arc(.4, .5, .36, .5, 280, 115) + arc(.3, .84, .16, .16, 120, -200)],
          [[(.5, .1)] + arc(.36, .14, .12, .1, 0, 200) + [(.1, .5)] + arc(.26, .82, .17, .18, 200, -150)]],
    '7': [[[(0, 0), (.55, 0), (.2, 1)]], [[(0, 0), (.55, 0), (.22, 1)], [(.1, .5), (.45, .5)]],
          [[(0, .05), (.55, 0), (.42, .38), (.3, .72), (.22, 1)]]],
    '8': [[arc(.27, .25, .21, .25, 0, 360), arc(.27, .74, .26, .26, 0, 360)],
          [arc(.27, .25, .21, .25, 330, 90) + arc(.27, .75, .26, .25, 270, 630) + arc(.27, .25, .21, .25, 90, -30)],
          [arc(.3, .27, .3, .27, 340, 90) + arc(.36, .76, .2, .24, 270, 630) + arc(.3, .27, .3, .27, 90, -20)],
          [[(.5, .05)] + arc(.28, .25, .24, .22, 320, 160) + [(.45, .62)] + arc(.36, .78, .16, .2, 290, 600) + [(.5, .05)]],
          [[(.52, .14)] + arc(.3, .2, .22, .19, 340, 160) + [(.3, .5), (.52, .74)] + arc(.3, .8, .22, .2, 0, 200) + [(.08, .72), (.3, .5), (.5, .2)]],
          [[(.5, .12)] + arc(.28, .22, .25, .22, 330, 170) + [(.28, .5), (.5, .75)] + arc(.28, .82, .22, .18, 10, 190) + [(.1, .66), (.48, .18)]]],
    '9': [[arc(.28, .28, .25, .28, 0, 360), [(.53, .28), (.48, 1)]],
          [arc(.32, .2, .17, .18, 20, 380) + [(.48, .28), (.34, 1)]],
          [arc(.28, .28, .25, .28, 10, 370) + [(.5, .7)] + arc(.3, .82, .2, .18, 0, 150)]],
    '.': [[dot(.0, .95)]],
    '+': [[[(0, .5), (.6, .5)], [(.3, .2), (.3, .8)]], [[(.05, .55), (.6, .48)], [(.3, .15), (.33, .85)]],
          [[(0, .58), (.04, .5), (.6, .5)], [(.3, .2), (.3, .8)]]],
    '-': [[[(0, .6), (.5, .6)]], [[(0, .62), (.5, .56)]]],
    'Ω': [[[(0, 1), (.17, 1), (.23, .85)] + arc(.38, .45, .3, .42, 120, 420) + [(.55, .85), (.6, 1), (.78, 1)]],
          [[(0, 1), (.2, 1), (.2, .45)] + arc(.42, .45, .22, .42, 180, 360) + [(.64, .45), (.64, 1), (.85, 1)]],
          [[(-.3, 1), (.2, 1), (.2, .45)] + arc(.42, .45, .22, .42, 180, 360) + [(.64, .45), (.64, 1), (1.15, 1)]],
          [[(0, 1), (.18, 1), (.2, .5)] + arc(.42, .5, .22, .45, 180, 360) + [(.64, .5), (.6, .95), (.88, .78)]],
          [[(-.15, .98), (.15, 1)] + arc(.38, .55, .26, .45, 150, 400) + [(.6, .9), (.68, 1), (1.05, .98)]],
          [[(-.35, 1), (.12, 1), (.14, .62)] + arc(.32, .62, .18, .2, 180, 360) + [(.5, .62), (.5, 1), (.95, .98)]],
          [[(-.2, 1), (.1, .98), (.12, .7)] + arc(.3, .66, .18, .24, 180, 360) + [(.48, .7), (.46, .95), (.75, .72)]]],
    'v': [[[(0, 0), (.3, 1), (.6, 0)]], [[(0, .42), (.25, 1), (.5, .42)]], [[(0, .45), (.22, 1), (.45, .45), (.56, .4)]],
          [[(0, 0), (.22, .85)] + arc(.3, .85, .09, .15, 160, 20) + [(.55, 0)]]],
    'A': [[[(0, 1), (.3, 0), (.6, 1)], [(.13, .62), (.47, .62)]], [[(0, 1), (.3, 0), (.6, 1)], [(.05, .7), (.55, .55)]]],
    'k': [[[(0, 0), (0, 1)], [(.5, 0), (0, .55), (.5, 1)]], [[(0, 0), (0, 1)], [(.42, .42), (0, .7), (.45, 1)]],
          [[(0, 0), (0, 1)], [(.4, .45), (.05, .72), (.15, .7), (.45, 1)]]],
    'm': [[[(0, 1), (0, .45)] + arc(.16, .58, .16, .15, 180, 360) + [(.32, 1), (.32, .6)] + arc(.48, .58, .16, .15, 180, 360) + [(.64, 1)]]],
    'M': [[[(0, 1), (0, 0), (.35, .65), (.7, 0), (.7, 1)]], [[(0, 1), (.08, 0), (.35, .7), (.62, 0), (.7, 1)]]],
    'μ': [[[(0, .42), (0, 1.3)], [(0, .78)] + arc(.2, .8, .2, .2, 180, 0) + [(.4, .42), (.4, .95), (.48, 1)]],
          [[(0, .42), (0, .85)] + arc(.2, .85, .2, .15, 180, 0) + [(.4, .42), (.42, 1)], [(0, .8), (-.03, 1.3)]]],
    'F': [[[(0, 1), (0, 0), (.5, 0)], [(0, .48), (.38, .48)]]],
    'H': [[[(0, 0), (0, 1)], [(.55, 0), (.55, 1)], [(0, .5), (.55, .5)]]],
    'i': [[[(.05, .45), (.05, 1)], dot(.05, .2)], [[(.05, .45), (.05, .9), (.15, 1)], dot(.05, .22)]],
    'x': [[[(0, .42), (.45, 1)], [(.45, .42), (0, 1)]], [[(0, 0), (.55, 1)], [(.55, 0), (0, 1)]],
          [arc(.12, .71, .12, .29, 290, 430), arc(.36, .71, .12, .29, 250, 110)]],
    'o': [[arc(.22, .71, .22, .29, -90, 275)], [arc(.3, .5, .3, .5, -90, 275)]],
    'I': [[[(.1, 0), (.1, 1)]], [[(0, 0), (.25, 0)], [(.12, 0), (.12, 1)], [(0, 1), (.25, 1)]], [[(.1, 0), (.1, .9), (.2, 1)]]],
    'R': [[[(0, 1), (0, 0), (.3, 0)] + arc(.3, .25, .22, .25, 270, 450) + [(.3, .5), (0, .5)], [(.15, .5), (.5, 1)]]],
    'a': [[arc(.22, .71, .22, .29, 300, -60) + [(.44, .45), (.44, 1)]], [arc(.22, .71, .22, .29, 330, -30) + [(.44, .5), (.46, .95), (.52, 1)]]],
    'b': [[[(0, 0), (0, 1)], arc(.22, .72, .22, .28, 0, 360)]],
    'L': [[[(0, 0), (0, 1), (.45, 1)]]],
    'c': [[arc(.22, .71, .22, .29, 320, 40)], [arc(.3, .5, .3, .5, 320, 40)]],
    'j': [[[(.25, .45), (.25, 1.15)] + arc(.1, 1.15, .15, .15, 0, 135), dot(.25, .2)]],
    's': [[arc(.2, .57, .18, .15, 330, 90) + arc(.2, .86, .2, .15, 270, 510)], [arc(.28, .25, .26, .25, 330, 90) + arc(.28, .75, .28, .25, 270, 510)]],
    'g': [[arc(.2, .66, .2, .24, 330, -30) + [(.4, .42), (.4, 1.15)] + arc(.22, 1.15, .18, .15, 0, 150)]],
    'u': [[[(0, .42), (0, .8)] + arc(.2, .8, .2, .2, 180, 0) + [(.4, .8), (.4, .42), (.42, 1)]]],
    'r': [[[(0, .42), (0, 1)], [(0, .65)] + arc(.18, .6, .18, .15, 180, 300)]],
    'e': [[[(0, .72), (.42, .72)] + arc(.21, .72, .21, .28, 360, 40)]],
    'n': [[[(0, .42), (0, 1)], [(0, .62)] + arc(.19, .6, .19, .16, 180, 360) + [(.38, .6), (.38, 1)]]],
    't': [[[(.15, .08), (.15, .9)] + arc(.27, .9, .12, .1, 180, 90), [(0, .42), (.35, .42)]]],
}


# ------------------------------------------------------------------ writing it down
def resample(pts, step):
    """points every `step` along a polyline"""
    out = [pts[0]]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        d = math.hypot(x1 - x0, y1 - y0)
        n = max(1, int(d / step))
        for k in range(1, n + 1):
            out.append((x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n))
    return out


# what people end with a flourish (a closed 0 or 8 has no tail to run on)
TAILS = set('12345779Ωvaektmnurx') | {'L', 'i'}


def write(strokes, rnd, tail=False, hand=None, info=None):
    """One hand-written copy, white on black (like render.base). hand: one writer's habits for
    every character of a figure ({'slant', 'sx', 'pen'}: pen in px at 80 px a glyph) instead of
    new ones each time; info: a dict that gets the rows of the glyph's top and line ('top',
    'line')."""
    U = 80                      # px per glyph height
    slant = rnd.uniform(-0.12, 0.42)
    turn = math.radians(rnd.uniform(-8, 8))
    sx = rnd.uniform(0.72, 1.32)
    wob = rnd.uniform(0.004, 0.03)
    pen = max(2, int(round(U * (rnd.uniform(0.045, 0.15) if rnd.random() < 0.8 else rnd.uniform(0.15, 0.21)))))
    if hand:
        slant = hand['slant'] + rnd.uniform(-0.06, 0.06)
        turn = math.radians(rnd.uniform(-3, 3))
        sx = hand['sx'] * rnd.uniform(0.9, 1.1)
        pen = hand['pen']
    ct, st = math.cos(turn), math.sin(turn)
    # no two hands make the parts alike: the top wider or narrower than the bottom, one side taller
    xs0 = [x for s in strokes for x, _ in s]
    x0, x1 = min(xs0), max(xs0)
    ww = max(0.2, x1 - x0)
    q = [(rnd.uniform(-.15, .15) * ww, rnd.uniform(-.12, .12)) for _ in range(4)]

    # and bends it here and there (a waist further left, one bowl rounder)
    el = [(rnd.uniform(0, 0.05), rnd.uniform(0.6, 1.6), rnd.uniform(0.6, 1.6), rnd.uniform(0, 6.3)) for _ in range(2)]

    def warp(x, y):
        u, v = (x - x0) / ww, min(1.3, max(0.0, y))
        dx = (1 - u) * (1 - v) * q[0][0] + u * (1 - v) * q[1][0] + (1 - u) * v * q[2][0] + u * v * q[3][0]
        dy = (1 - u) * (1 - v) * q[0][1] + u * (1 - v) * q[1][1] + (1 - u) * v * q[2][1] + u * v * q[3][1]
        dx += el[0][0] * math.sin(6.283 * (el[0][1] * v + el[0][2] * u) + el[0][3])
        dy += el[1][0] * math.sin(6.283 * (el[1][1] * u + el[1][2] * v) + el[1][3])
        return x + dx, y + dy
    strokes = [list(s) for s in strokes]
    # a flourish: the last stroke runs on
    if tail and rnd.random() < 0.35 and len(strokes[-1]) > 1:
        (ax, ay), (bx, by) = strokes[-1][-2], strokes[-1][-1]
        d = math.hypot(bx - ax, by - ay) or 1
        k = rnd.uniform(0.1, 0.6)
        strokes[-1].append((bx + (bx - ax) / d * k, by + (by - ay) / d * k * 0.4))
    paths = []
    for s in strokes:
        pts = [warp(x, y) for x, y in resample(s, 0.02)]
        # a stroke starts a little early or late and stops short or runs on
        def stretch(p, q, f):
            return (p[0] + (p[0] - q[0]) * f, p[1] + (p[1] - q[1]) * f)
        if len(pts) > 3:
            pts[0] = stretch(pts[0], pts[2], rnd.uniform(-0.6, 0.8))
            pts[-1] = stretch(pts[-1], pts[-3], rnd.uniform(-0.6, 0.8))
        # the hand wanders: slow smooth wobble across the stroke
        f1, f2 = rnd.uniform(2, 6), rnd.uniform(6, 14)
        p1, p2 = rnd.uniform(0, 6.3), rnd.uniform(0, 6.3)
        out = []
        for k, (x, y) in enumerate(pts):
            t = k * 0.02
            x += wob * (math.sin(f1 * t + p1) + 0.4 * math.sin(f2 * t + p2))
            y += wob * (math.cos(f1 * t + p2) + 0.4 * math.cos(f2 * t + p1))
            x = x * sx + slant * (1 - y)
            X, Y = x * ct - y * st, x * st + y * ct
            out.append((X, Y))
        paths.append(out)
    xs = [x for p in paths for x, _ in p]
    ys = [y for p in paths for _, y in p]
    w = int((max(xs) - min(xs)) * U) + 2 * pen + 20
    h = int((max(ys) - min(ys)) * U) + 2 * pen + 20
    im = Image.new('L', (max(w, 8), max(h, 8)), 0)
    d = ImageDraw.Draw(im)
    ox, oy = -min(xs) * U + pen + 10, -min(ys) * U + pen + 10
    if info is not None:
        xm = (x0 + x1) / 2 * sx
        info['top'], info['line'] = xm * st * U + oy, (xm * st + ct) * U + oy
    for p in paths:
        q = [(x * U + ox, y * U + oy) for x, y in p]
        if len(q) > 1: d.line(q, fill=255, width=pen, joint='curve')
        for x, y in (q[0], q[-1]):
            d.ellipse([x - pen / 2, y - pen / 2, x + pen / 2, y + pen / 2], fill=255)
    return im


def main():
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    rnd = random.Random(31)
    per = int(os.environ.get('PER', '160'))
    n = 0
    sheet = []
    with open(os.path.join(out, 'glyphs.bin'), 'wb') as f:
        for ci, cls in enumerate(CLASSES):
            for ai, strokes in enumerate(HAND.get(cls, [])):
                for k in range(per):
                    im = write(strokes, rnd, cls in TAILS)
                    if k < 6: sheet.append(im)
                    b = degrade(im, rnd)
                    if b is None: continue
                    h, w = b.shape
                    f.write(struct.pack('BBB', ci, w, h)); f.write(b.astype(np.uint8).tobytes()); n += 1
    print('hand samples', n)
    if len(sys.argv) > 2:
        # a sheet of copies to look at
        cell = 64
        cols = 24
        rows = (len(sheet) + cols - 1) // cols
        S = Image.new('L', (cols * cell, rows * cell), 0)
        for k, im in enumerate(sheet):
            im = im.copy(); im.thumbnail((cell - 4, cell - 4))
            S.paste(im, ((k % cols) * cell + 2, (k // cols) * cell + 2))
        S.save(sys.argv[2])


if __name__ == '__main__':
    main()
