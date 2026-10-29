"""Textbook-style circuit drawings for the offline reader's tests (tests/fixtures/*.png, *.jpg).

Each figure is drawn on a grid with the usual symbols (zigzag resistors, circle sources with
+/− or an arrow, diamond dependent sources, capacitor and battery plates, coils, grounds, open
terminals) and labels in a Times-like font, then also saved as a 'photo': grey uneven paper,
grain, a slight turn and blur, JPEG; some also as a rough photo (turned further, dusty, small,
squeezed hard).

    python3 figures.py OUT_DIR
"""
import math, os, random, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

SERIF = '/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf'
ITALIC = '/usr/share/fonts/truetype/liberation/LiberationSerif-Italic.ttf'
U = 150      # grid unit, px
LW = 4       # line width
M = 140      # margin


class Fig:
    def __init__(self, cols, rows):
        self.w, self.h = M * 2 + U * cols, M * 2 + U * rows
        self.im = Image.new('L', (self.w, self.h), 255)
        self.d = ImageDraw.Draw(self.im)
        self.f = ImageFont.truetype(SERIF, 34)
        self.fi = ImageFont.truetype(ITALIC, 36)
        self.fs = ImageFont.truetype(ITALIC, 24)

    def P(self, x, y):
        return (M + x * U, M + y * U)

    def line(self, a, b):
        self.d.line([self.P(*a), self.P(*b)], fill=0, width=LW)

    def wire(self, *pts):
        for a, b in zip(pts, pts[1:]): self.line(a, b)

    def text(self, xy, s, font=None, anchor='mm'):
        self.d.text(xy, s, font=font or self.f, fill=0, anchor=anchor)

    def label(self, xy, s, sub=None, anchor='mm'):
        """an italic name with an optional subscript (vₓ, iₓ, V₀)"""
        x, y = xy
        self.d.text((x, y), s, font=self.fi, fill=0, anchor=anchor)
        if sub:
            bb = self.d.textbbox((x, y), s, font=self.fi, anchor=anchor)
            self.d.text((bb[2] + 1, bb[3] + 1), sub, font=self.fs, fill=0, anchor='lm')

    def _ends(self, a, b, body):
        """leads from a and b to a body of length `body` centred between them; returns centre, unit vectors"""
        A, B = np.array(self.P(*a), float), np.array(self.P(*b), float)
        c = (A + B) / 2
        u = (B - A) / np.linalg.norm(B - A)
        n = np.array([-u[1], u[0]])
        self.d.line([tuple(A), tuple(c - u * body / 2)], fill=0, width=LW)
        self.d.line([tuple(c + u * body / 2), tuple(B)], fill=0, width=LW)
        return c, u, n

    def resistor(self, a, b, label=None, side=1):
        c, u, n = self._ends(a, b, 66)
        pts = [c - u * 33]
        for k in range(6):
            pts.append(c - u * 33 + u * (5.5 + 11 * k) + n * (11 if k % 2 == 0 else -11))
        pts.append(c + u * 33)
        self.d.line([tuple(p) for p in pts], fill=0, width=LW, joint='curve')
        if label: self.text(tuple(c + n * 46 * side), label)

    def vsource(self, a, b, label, plus_at_a=True, side=-1):
        c, u, n = self._ends(a, b, 64)
        r = 32
        self.d.ellipse([c[0] - r, c[1] - r, c[0] + r, c[1] + r], outline=0, width=LW)
        p = c - u * 13 if plus_at_a else c + u * 13
        m = c + u * 13 if plus_at_a else c - u * 13
        self.d.line([(p[0] - 8, p[1]), (p[0] + 8, p[1])], fill=0, width=3)
        self.d.line([(p[0], p[1] - 8), (p[0], p[1] + 8)], fill=0, width=3)
        self.d.line([(m[0] - 8, m[1]), (m[0] + 8, m[1])], fill=0, width=3)
        self.text(tuple(c + n * 70 * side), label)

    def _arrow(self, c, u, L=24, head=11):
        t, h = c - u * L, c + u * L
        self.d.line([tuple(t), tuple(h - u * head)], fill=0, width=3)
        n = np.array([-u[1], u[0]])
        self.d.polygon([tuple(h), tuple(h - u * head * 1.6 + n * head * 0.8), tuple(h - u * head * 1.6 - n * head * 0.8)], fill=0)

    def isource(self, a, b, label, to_b=True, side=-1):
        c, u, n = self._ends(a, b, 64)
        r = 32
        self.d.ellipse([c[0] - r, c[1] - r, c[0] + r, c[1] + r], outline=0, width=LW)
        self._arrow(c, u if to_b else -u)
        self.text(tuple(c + n * 70 * side), label)

    def dsource(self, a, b, label, kind='i', to_b=True, side=-1, label_xy=None):
        c, u, n = self._ends(a, b, 76)
        r = 38
        pts = [c - u * r, c + n * r, c + u * r, c - n * r]
        self.d.polygon([tuple(p) for p in pts], outline=0, width=LW)
        if kind == 'i': self._arrow(c, u if to_b else -u, L=18, head=9)
        else:
            p = c - u * 14 if to_b else c + u * 14
            m = c + u * 14 if to_b else c - u * 14
            self.d.line([(p[0] - 7, p[1]), (p[0] + 7, p[1])], fill=0, width=3)
            self.d.line([(p[0], p[1] - 7), (p[0], p[1] + 7)], fill=0, width=3)
            self.d.line([(m[0] - 7, m[1]), (m[0] + 7, m[1])], fill=0, width=3)
        coef, var, sub = label
        xy = label_xy or tuple(c + n * 84 * side)
        bb = self.d.textbbox(xy, coef, font=self.f, anchor='rm')
        self.text(xy, coef, anchor='rm')
        self.label((xy[0] + 2, xy[1]), var, sub, anchor='lm')

    def capacitor(self, a, b, label, side=1):
        c, u, n = self._ends(a, b, 16)
        for s in (-8, 8):
            p = c + u * s
            self.d.line([tuple(p - n * 26), tuple(p + n * 26)], fill=0, width=LW)
        self.text(tuple(c + n * 80 * side), label)

    def battery(self, a, b, label, plus_at_a=True, side=1):
        c, u, n = self._ends(a, b, 16)
        lp = c - u * 8 if plus_at_a else c + u * 8
        sp = c + u * 8 if plus_at_a else c - u * 8
        self.d.line([tuple(lp - n * 28), tuple(lp + n * 28)], fill=0, width=LW)
        self.d.line([tuple(sp - n * 14), tuple(sp + n * 14)], fill=0, width=LW + 3)
        self.text(tuple(c + n * 56 * side), label)

    def inductor(self, a, b, label, side=1):
        c, u, n = self._ends(a, b, 72)
        start = c - u * 36
        for k in range(4):
            cc = start + u * (9 + 18 * k)
            box = [cc[0] - 9, cc[1] - 9, cc[0] + 9, cc[1] + 9]
            # half circles bulging to -n
            ang = math.degrees(math.atan2(u[1], u[0]))
            self.d.arc(box, start=ang + 180, end=ang + 360, fill=0, width=LW)
        self.text(tuple(c + n * 50 * side), label)

    def ground(self, a):
        x, y = self.P(*a)
        self.d.line([(x, y), (x, y + 24)], fill=0, width=LW)
        for k, half in enumerate((22, 14, 6)):
            yy = y + 24 + k * 9
            self.d.line([(x - half, yy), (x + half, yy)], fill=0, width=LW)

    def iarrow(self, xy, down=True, name='i', sub=None):
        x, y = xy
        u = np.array([0.0, 1.0 if down else -1.0])
        self._arrow(np.array([x, y], float), u, L=22, head=9)
        self.label((x + 20, y), name, sub, anchor='lm')

    def dot(self, a):
        x, y = self.P(*a)
        self.d.ellipse([x - 6, y - 6, x + 6, y + 6], fill=0)

    def terminal(self, a, name):
        """an open terminal at a wire's end: a small ring, its letter beside it"""
        x, y = self.P(*a)
        self.d.ellipse([x, y - 9, x + 18, y + 9], outline=0, width=LW, fill=255)
        self.text((x + 40, y), name)

    def save(self, out, name, rnd, rough=None):
        self.im.save(os.path.join(out, name + '.png'), optimize=True)
        photo(self.im, rnd).save(os.path.join(out, name + '-photo.jpg'), quality=80)
        if rough:
            # a harder one: turned further, dusty, small and squeezed hard
            p = photo(self.im, rough, turn=4.0, dust=3)
            p = p.resize((int(p.width * 0.6), int(p.height * 0.6)), Image.LANCZOS)
            p.save(os.path.join(out, name + '-rough.jpg'), quality=60)


def photo(im, rnd, turn=None, dust=1):
    """The drawing as a phone photo of a printed page: grey uneven paper, grain, turn, blur."""
    a = np.asarray(im).astype(np.float32) / 255
    h, w = a.shape
    yy, xx = np.mgrid[0:h, 0:w]
    light = 0.78 + 0.1 * (xx / w) - 0.06 * (yy / h) + 0.04 * np.sin(xx / w * 3)
    ink = 0.18
    g = light * (ink + (1 - ink) * a)
    rng = np.random.default_rng(rnd.randrange(1 << 30))
    g += rng.normal(0, 0.035, g.shape)
    # specks (dust: more of them, and bigger)
    for _ in range(int(dust * w * h / 4000)):
        x, y = rnd.randrange(w), rnd.randrange(h)
        r = rnd.choice([1, 1, 2] if dust == 1 else [1, 2, 2, 3])
        g[max(0, y - r):y + r, max(0, x - r):x + r] *= rnd.uniform(0.55, 0.85)
    out = Image.fromarray(np.clip(g * 255, 0, 255).astype(np.uint8))
    angle = rnd.uniform(-1.5, 1.5) if turn is None else rnd.choice([-1, 1]) * rnd.uniform(0.75, 1) * turn
    out = out.rotate(angle, resample=Image.BICUBIC, fillcolor=int(255 * 0.8))
    out = out.filter(ImageFilter.GaussianBlur(1.1))
    return out.convert('RGB')


def main():
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    rnd = random.Random(11)
    rough = random.Random(23)

    # 1. a dependent current source controlled by a node voltage: vx = 25 V
    f = Fig(4, 2)
    f.wire((0, 0), (0, 0))
    f.resistor((0, 0), (1, 0), '20 Ω', side=-1)
    f.wire((1, 0), (4, 0))
    f.wire((0, 2), (4, 2))
    f.vsource((0, 0), (0, 2), '20 V', plus_at_a=True)
    f.isource((1.4, 2), (1.4, 0), '4 A', to_b=True, side=1)
    f.resistor((2.6, 0), (2.6, 2), '4 Ω', side=-1)
    f.dsource((4, 2), (4, 0), ('0.1', 'v', 'x'), kind='i', to_b=True, side=-1, label_xy=f.P(4.62, 1))
    f.label(f.P(1.9, -0.3), 'v', 'x')
    f.ground((2.6, 2))
    f.save(out, 'depsource', rnd, rough)

    # 2. three meshes: i = 2 A down the 3 Ω
    f = Fig(4, 3)
    f.vsource((0, 0), (1.6, 0), '24 V', plus_at_a=True, side=-1)
    f.resistor((1.6, 0), (4, 0), '8 Ω', side=-1)
    f.wire((0, 0), (0, 1)); f.wire((4, 0), (4, 1))
    f.resistor((0, 1), (2, 1), '4 Ω', side=-1)
    f.resistor((2, 1), (4, 1), '4 Ω', side=-1)
    f.resistor((2, 1.15), (2, 3), '3 Ω', side=1)
    f.wire((2, 1), (2, 1.15))
    f.vsource((0, 1), (0, 3), '12 V', plus_at_a=True)
    f.isource((4, 3), (4, 1), '3 A', to_b=True, side=1)
    f.wire((0, 3), (4, 3))
    f.iarrow((f.P(2, 1.32)[0] + 22, f.P(2, 1.32)[1]), down=True)
    f.save(out, 'meshes', rnd, rough)

    # 3. capacitor, coil and battery
    f = Fig(3, 2)
    f.battery((0, 2), (0, 0), '9 V', plus_at_a=False, side=-1)
    f.resistor((0, 0), (1.5, 0), '1 kΩ', side=-1)
    f.inductor((1.5, 0), (3, 0), '2 mH', side=1)
    f.capacitor((3, 0), (3, 2), '10 μF', side=-1)  # label to the right, clear of the plates
    f.wire((0, 2), (3, 2))
    f.ground((1.5, 2))
    f.save(out, 'rlc', rnd)

    # 4. a current-controlled voltage source in the bottom wire
    f = Fig(4, 2)
    f.wire((0, 0), (4, 0))
    f.resistor((0, 0), (0, 2), '2 Ω', side=-1)
    f.isource((1.3, 2), (1.3, 0), '6 A', to_b=True, side=1)
    f.resistor((4, 0), (4, 2), '8 Ω', side=1)
    f.wire((0, 2), (1.3, 2)); f.wire((2.7, 2), (4, 2))
    f.dsource((1.3, 2), (2.7, 2), ('4', 'i', 'x'), kind='v', to_b=True, side=1, label_xy=f.P(2.0, 2.45))
    f.iarrow((f.P(0, 0.25)[0] + 26, f.P(0, 0.25)[1]), down=True, name='i', sub='x')
    f.save(out, 'ccvs', rnd, rough)

    # 5. open terminals a and b (a Thevenin problem): the wires just end there
    f = Fig(4, 2)
    f.vsource((0, 0), (0, 2), '12 V', plus_at_a=True)
    f.resistor((0, 0), (2, 0), '4 Ω', side=-1)
    f.resistor((2, 0), (2, 2), '6 Ω', side=1)
    f.wire((2, 0), (3.2, 0))
    f.wire((0, 2), (3.2, 2))
    f.terminal((3.2, 0), 'a')
    f.terminal((3.2, 2), 'b')
    f.save(out, 'thevenin', rnd)
    print('ok')


if __name__ == '__main__':
    main()
