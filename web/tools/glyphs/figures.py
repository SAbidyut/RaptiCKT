"""Textbook-style circuit drawings for the offline reader's tests (tests/fixtures/*.png, *.jpg).

Each figure is drawn on a grid with the usual symbols (zigzag resistors, circle sources with
+/− or an arrow, diamond dependent sources, capacitor and battery plates, coils, grounds, open
terminals) and labels in a Times-like font, then also saved as a 'photo': grey uneven paper,
grain, a slight turn and blur, JPEG; some also as a rough photo (turned further, dusty, small,
squeezed hard).

The sketch-* figures are the same symbols drawn by hand (SketchFig): lines that wobble and bow
and stop short of or run past their corners, rings that do not quite close, zigzags of any
number of turns, two-stroke arrowheads, labels written with the strokes of hand.py in one
writer's hand; their photos are coloured pen on grey paper.

    python3 figures.py OUT_DIR
"""
import math, os, random, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

sys.path.insert(0, os.path.dirname(__file__))
import hand  # noqa: E402

SERIF = '/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf'
ITALIC = '/usr/share/fonts/truetype/liberation/LiberationSerif-Italic.ttf'
BOLD = '/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf'
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
        self.fb = ImageFont.truetype(BOLD, 36)
        self.fbs = ImageFont.truetype(BOLD, 26)

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

    def tight(self, a, b, label=None, side=1):
        """a resistor printed small, its zigzag's teeth as close as the line is thick: they run
        together into a band"""
        c, u, n = self._ends(a, b, 44)
        pts = [c - u * 22] + [c - u * 22 + u * (2 + 4 * k) + n * (4 if k % 2 == 0 else -4) for k in range(10)] + [c + u * 22]
        self.d.line([tuple(p) for p in pts], fill=0, width=LW, joint='curve')
        if label: self.text(tuple(c + n * 40 * side), label)

    def along(self, a, b, parts, side=1, off=50):
        """a label printed along a slanting part, turned to its slant ("x₁ = 2.5Ω" up a delta's
        side): parts are (text, font, raised) pieces in a row"""
        A, B = np.array(self.P(*a), float), np.array(self.P(*b), float)
        c, u = (A + B) / 2, (B - A) / np.linalg.norm(B - A)
        if u[0] < 0: u = -u
        n = np.array([-u[1], u[0]])
        fonts = {'f': self.f, 'i': self.fi, 's': self.fs}
        widths = [self.d.textlength(t, font=fonts[f]) for t, f, _ in parts]
        pad = 12
        lay = Image.new('L', (int(sum(widths)) + 2 * pad, 64), 0)
        ld = ImageDraw.Draw(lay)
        x = pad
        for (t, f, raised), wd in zip(parts, widths):
            ld.text((x, 32 + (12 if raised else 0)), t, font=fonts[f], fill=255, anchor='lm')
            x += wd
        lay = lay.rotate(math.degrees(math.atan2(-u[1], u[0])), resample=Image.BICUBIC, expand=True)
        at = c + n * off * side
        ink = Image.new('L', lay.size, 0)
        self.im.paste(ink, (int(at[0] - lay.width / 2), int(at[1] - lay.height / 2)), lay)

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

    def isource_through(self, a, b, label, to_b=True, side=-1):
        """a current source drawn with its wire running on through the ring, a solid head on it"""
        A, B = np.array(self.P(*a), float), np.array(self.P(*b), float)
        c = (A + B) / 2
        u = (B - A) / np.linalg.norm(B - A)
        n = np.array([-u[1], u[0]])
        d = u if to_b else -u
        self.d.line([tuple(A), tuple(B)], fill=0, width=LW)
        self.d.ellipse([c[0] - 30, c[1] - 30, c[0] + 30, c[1] + 30], outline=0, width=LW)
        h = c + d * 14
        self.d.polygon([tuple(h), tuple(h - d * 26 + n * 13), tuple(h - d * 26 - n * 13)], fill=0)
        self.text(tuple(c + n * 66 * side), label)

    def mark(self, a, b, at=0.5, to_b=True):
        """a current's direction drawn on the wire from a to b: an outlined arrowhead"""
        A, B = np.array(self.P(*a), float), np.array(self.P(*b), float)
        u = (B - A) / np.linalg.norm(B - A)
        n = np.array([-u[1], u[0]])
        d = u if to_b else -u
        c = A + (B - A) * at
        tip, notch = c + d * 12, c - d * 2
        self.d.line([tuple(A), tuple(notch if to_b else tip)], fill=0, width=LW)
        self.d.line([tuple(tip if to_b else notch), tuple(B)], fill=0, width=LW)
        pts = [tip, tip - d * 22 + n * 16, tip - d * 30 + n * 16, notch, tip - d * 30 - n * 16, tip - d * 22 - n * 16]
        self.d.polygon([tuple(p) for p in pts], outline=0, width=3)

    def frac(self, xy, num, den, unit):
        """a value printed as a fraction: the number over the number, a bar between, the unit after"""
        x, y = xy
        f = ImageFont.truetype(SERIF, 26)
        wn = max(self.d.textlength(num, font=f), self.d.textlength(den, font=f))
        self.d.text((x, y - 4), num, font=f, fill=0, anchor='mb')
        self.d.line([(x - wn / 2 - 2, y), (x + wn / 2 + 2, y)], fill=0, width=2)
        self.d.text((x, y + 4), den, font=f, fill=0, anchor='mt')
        self.d.text((x + wn / 2 + 10, y), unit, font=self.f, fill=0, anchor='lm')

    def mesh(self, c, name, sub):
        """a mesh current: a round arrow turning clockwise in the middle of its mesh, named beside it"""
        x, y = self.P(*c)
        r = 50
        self.d.arc([x - r, y - r, x + r, y + r], 200, 120, fill=0, width=LW)
        # the head at the arc's end (120°), pointing on round the clock
        a = math.radians(120)
        tip = np.array([x + r * math.cos(a), y + r * math.sin(a)])
        t = np.array([-math.sin(a), math.cos(a)])
        n = np.array([math.cos(a), math.sin(a)])
        self.d.polygon([tuple(tip + t * 12), tuple(tip - t * 9 + n * 10), tuple(tip - t * 9 - n * 10)], fill=0)
        self.label((x, y), name, sub)

    def name(self, xy, s, sub):
        """an upright bold name with a capital subscript (I_A), as some books print it"""
        x, y = xy
        self.d.text((x, y), s, font=self.fb, fill=0, anchor='rm')
        self.d.text((x + 1, y + 8), sub, font=self.fbs, fill=0, anchor='lm')

    def capacitor(self, a, b, label, side=1):
        c, u, n = self._ends(a, b, 16)
        for s in (-8, 8):
            p = c + u * s
            self.d.line([tuple(p - n * 26), tuple(p + n * 26)], fill=0, width=LW)
        if label: self.text(tuple(c + n * 80 * side), label)

    def battery(self, a, b, label, plus_at_a=True, side=1, cells=1):
        c, u, n = self._ends(a, b, 16 + 32 * (cells - 1))
        for k in range(cells):
            o = (k - (cells - 1) / 2) * 32
            lp = c + u * (o - 8) if plus_at_a else c - u * (o - 8)
            sp = c + u * (o + 8) if plus_at_a else c - u * (o + 8)
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
        if label: self.text(tuple(c + n * 50 * side), label)

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


# what to write for a character: its class in hand.HAND and the ways of writing it that fit
# (a capital V is a v drawn full height)
WRITE = {'V': ('v', [0, 3]), 'v': ('v', [1, 2]), 'X': ('x', [1]), 'x': ('x', [0, 2]), 'O': ('o', [1]), 'o': ('o', [0]),
         'C': ('c', [1]), 'c': ('c', [0]), 'S': ('s', [1]), 's': ('s', [0]), 'K': ('k', [0]), 'k': ('k', [1, 2]),
         'l': ('I', [0, 2]), '−': ('-', None)}
# letters of a caption that the reader has no class for
EXTRA = {'d': [[hand.arc(.22, .71, .22, .29, 330, -30) + [(.44, .5)], [(.44, 0), (.44, 1)]]]}


class SketchDraw:
    """ImageDraw's calls that Fig makes, drawn by hand with a pen of one width: lines wobble and
    bow a little and start or stop a little off their marks (`gap`: how far short at most), rings
    are a little out of round and do not quite close, corners are a little off, and text is
    written with the strokes of hand.py in one writer's hand."""

    def __init__(self, im, rnd, pen, gap):
        self.im, self.rnd, self.pen, self.gap = im, rnd, pen, gap
        self.d = ImageDraw.Draw(im)
        self.hand = {'slant': rnd.uniform(-0.05, 0.3), 'sx': rnd.uniform(0.85, 1.2), 'size': rnd.uniform(1.0, 1.3)}
        self.last = None

    def _stroke(self, pts, fill):
        pts = [(float(x), float(y)) for x, y in pts]
        self.d.line(pts, fill=fill, width=self.pen, joint='curve')
        r = self.pen / 2
        for x, y in (pts[0], pts[-1]):
            self.d.ellipse([x - r, y - r, x + r, y + r], fill=fill)

    def _seg(self, A, B):
        """the points of a line drawn by hand from A to B"""
        rnd = self.rnd
        A, B = np.array(A, float), np.array(B, float)
        L = float(np.linalg.norm(B - A))
        if L < 2: return [tuple(A), tuple(B)]
        u = (B - A) / L
        n = np.array([-u[1], u[0]])
        reach = min(3.0, 0.12 * L)
        A = A - u * rnd.uniform(-self.gap, reach) + n * rnd.uniform(-1, 1)
        B = B + u * rnd.uniform(-self.gap, reach) + n * rnd.uniform(-1, 1)
        L = float(np.linalg.norm(B - A))
        u = (B - A) / L
        n = np.array([-u[1], u[0]])
        bow = rnd.uniform(-1, 1) * min(4.0, 0.015 * L)
        amp, f, ph = rnd.uniform(0.2, 0.9), rnd.uniform(0.5, 2) * L / 150, rnd.uniform(0, 6.3)
        k = max(2, int(L / 5))
        return [tuple(A + u * L * t + n * (bow * math.sin(math.pi * t) + amp * math.sin(2 * math.pi * f * t + ph) * math.sin(math.pi * t)))
                for t in (j / k for j in range(k + 1))]

    def line(self, xy, fill=0, width=0, joint=None):
        pts = [(float(x), float(y)) for x, y in xy]
        if len(pts) == 2:
            self._stroke(self._seg(*pts), fill)
            return
        # a zigzag in one go: each turn a little off, sometimes rounded
        rnd = self.rnd
        pts = [pts[0]] + [(x + rnd.uniform(-1.2, 1.2), y + rnd.uniform(-1.2, 1.2)) for x, y in pts[1:-1]] + [pts[-1]]
        if rnd.random() < 0.5:
            r = [pts[0]]
            for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
                r += [(0.75 * x0 + 0.25 * x1, 0.75 * y0 + 0.25 * y1), (0.25 * x0 + 0.75 * x1, 0.25 * y0 + 0.75 * y1)]
            pts = r + [pts[-1]]
        self._stroke(pts, fill)

    def ellipse(self, xy, fill=None, outline=None, width=0):
        x0, y0, x1, y1 = xy
        cx, cy, rx, ry = (x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2
        rnd = self.rnd
        if outline is None:
            # a dot: a blob
            ph = rnd.uniform(0, 6.3)
            pts = []
            for j in range(12):
                a = 2 * math.pi * j / 12
                s = 1 + 0.15 * math.sin(3 * a + ph)
                pts.append((cx + rx * s * math.cos(a), cy + ry * s * math.sin(a)))
            self.d.polygon(pts, fill=fill)
            return
        if fill is not None: self.d.ellipse(xy, fill=fill)
        # a ring: a little out of round, its end past or short of its start
        a0 = rnd.uniform(0, 2 * math.pi)
        sweep = 2 * math.pi + math.radians(rnd.uniform(-4, 30))
        e, ph, drift = rnd.uniform(0, 0.06), rnd.uniform(0, 6.3), rnd.uniform(-0.06, 0.06)
        k = max(16, int(sweep * max(rx, ry) / 4))
        pts = []
        for j in range(k + 1):
            t = j / k
            a = a0 + sweep * t
            s = 1 + e * math.sin(2 * a + ph) + drift * t
            pts.append((cx + rx * s * math.cos(a), cy + ry * s * math.sin(a)))
        self._stroke(pts, outline)

    def polygon(self, xy, fill=None, outline=None, width=0):
        rnd = self.rnd
        pts = [(x + rnd.uniform(-1.5, 1.5), y + rnd.uniform(-1.5, 1.5)) for x, y in xy]
        if fill is not None: self.d.polygon(pts, fill=fill)
        if outline is not None:
            for a, b in zip(pts, pts[1:] + pts[:1]): self._stroke(self._seg(a, b), outline)

    def arc(self, xy, start, end, fill=0, width=0):
        x0, y0, x1, y1 = xy
        cx, cy, rx, ry = (x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2
        rnd = self.rnd
        s0, s1 = math.radians(start) + rnd.uniform(-0.1, 0.1), math.radians(end) + rnd.uniform(-0.1, 0.1)
        sc = rnd.uniform(0.9, 1.12)
        k = max(6, int(abs(s1 - s0) * max(rx, ry) / 3))
        self._stroke([(cx + rx * sc * math.cos(s0 + (s1 - s0) * j / k), cy + ry * sc * math.sin(s0 + (s1 - s0) * j / k)) for j in range(k + 1)], fill)

    def _word(self, s, size):
        """s written by hand, its digits about size × 0.72 px tall: (mask, top row, line row)"""
        rnd = self.rnd
        h = size * 0.72
        k = h / 80
        style = {'slant': self.hand['slant'], 'sx': self.hand['sx'], 'pen': max(2, int(round(self.pen / k)))}
        items, x = [], 0.0
        for ch in s:
            if ch == ' ':
                x += h * rnd.uniform(0.2, 0.6)
                continue
            cls, ways = WRITE.get(ch, (ch, None))
            opts = hand.HAND.get(cls) or EXTRA[ch]
            info = {}
            g = hand.write(opts[rnd.choice(ways) if ways else rnd.randrange(len(opts))], rnd, cls in hand.TAILS, hand=style, info=info)
            g = g.resize((max(1, round(g.width * k)), max(1, round(g.height * k))), Image.LANCZOS)
            a = np.asarray(g)
            cols = np.nonzero(a.max(axis=0) > 60)[0]
            if not len(cols): continue
            a = a[:, cols[0]:cols[-1] + 1]
            items.append((x, a, info['line'] * k + rnd.uniform(-0.06, 0.06) * h))
            x += a.shape[1] + h * rnd.uniform(0.08, 0.25)
        if not items: return Image.new('L', (1, 1), 0), 0, 0
        line = max(l for _, _, l in items)
        H = int(math.ceil(max(line - l + a.shape[0] for _, a, l in items))) + 1
        out = np.zeros((H, int(x) + 2), np.uint8)
        for X, a, l in items:
            Y, X = int(round(line - l)), int(round(X))
            out[Y:Y + a.shape[0], X:X + a.shape[1]] = np.maximum(out[Y:Y + a.shape[0], X:X + a.shape[1]], a)
        cols = np.nonzero(out.max(axis=0))[0]
        out = out[:, :cols[-1] + 1]
        return Image.fromarray(out), line - h, line

    def text(self, xy, s, font=None, fill=0, anchor='mm'):
        size = (font.size if font else 34) * self.hand['size']
        mask, top, line = self._word(s, size)
        x, y = xy
        w, h = mask.size
        X = int(round(x - (0 if anchor[0] == 'l' else w / 2 if anchor[0] == 'm' else w)))
        Y = int(round(y - (top + line) / 2))
        # (written on the page: a long label squeezes in rather than runs off it)
        X = max(8, min(X, self.im.width - w - 8))
        self.im.paste(fill, (X, Y, X + w, Y + h), mask)
        self.last = (tuple(xy), s, (X, Y + top, X + w, Y + line))

    def textbbox(self, xy, s, font=None, anchor='mm'):
        if self.last and self.last[0] == tuple(xy) and self.last[1] == s: return self.last[2]
        size = (font.size if font else 34) * self.hand['size']
        w, h = 0.6 * size * len(s), 0.72 * size
        x, y = xy
        X = x - (0 if anchor[0] == 'l' else w / 2 if anchor[0] == 'm' else w)
        return (X, y - h / 2, X + w, y + h / 2)


class SketchFig(Fig):
    """A figure drawn by hand with a pen `pen` px wide (lines `gap` px short of their marks at
    most), with room round it for labels written large, photographed in colour."""

    def __init__(self, cols, rows, rnd, pen=4, gap=0.5, margin=190):
        super().__init__(cols, rows)
        self.m = margin
        self.w, self.h = 2 * margin + U * cols, 2 * margin + U * rows
        self.im = Image.new('L', (self.w, self.h), 255)
        self.rnd = rnd
        self.d = SketchDraw(self.im, rnd, pen, gap)

    def P(self, x, y):
        return (self.m + x * U, self.m + y * U)

    def resistor(self, a, b, label=None, side=1):
        # any number of turns, any height
        rnd = self.rnd
        body, k, amp = rnd.uniform(46, 74), rnd.randint(4, 7), rnd.uniform(6, 12)
        c, u, n = self._ends(a, b, body)
        s = rnd.choice([-1, 1])
        pts = [c - u * body / 2] + [c - u * body / 2 + u * body * (j + 0.5) / k + n * amp * s * (1 if j % 2 == 0 else -1) for j in range(k)] + [c + u * body / 2]
        self.d.line([tuple(p) for p in pts], fill=0, width=LW, joint='curve')
        if label: self._label(a, b, label, side, amp + rnd.uniform(8, 18))

    def _label(self, a, b, label, side, clear):
        """a part's label on its side, `clear` px from its middle line, however long the label"""
        A, B = np.array(self.P(*a), float), np.array(self.P(*b), float)
        u = (B - A) / np.linalg.norm(B - A)
        c, d = (A + B) / 2, np.array([-u[1], u[0]]) * side
        if abs(d[0]) > abs(d[1]): self.text(tuple(c + d * clear), label, anchor='lm' if d[0] > 0 else 'rm')
        else: self.text(tuple(c + d * (clear + 22)), label)

    # the parts with their labels clear of them (written labels are wider than printed ones)
    def vsource(self, a, b, label, plus_at_a=True, side=-1):
        super().vsource(a, b, '', plus_at_a, side)
        self._label(a, b, label, side, 32 + self.rnd.uniform(8, 20))

    def isource(self, a, b, label, to_b=True, side=-1):
        super().isource(a, b, '', to_b, side)
        self._label(a, b, label, side, 32 + self.rnd.uniform(8, 20))

    def capacitor(self, a, b, label, side=1):
        super().capacitor(a, b, '', side)
        self._label(a, b, label, side, 26 + self.rnd.uniform(8, 18))

    def battery(self, a, b, label, plus_at_a=True, side=1):
        super().battery(a, b, '', plus_at_a, side)
        self._label(a, b, label, side, 28 + self.rnd.uniform(8, 18))

    def inductor(self, a, b, label, side=1):
        # bumps in one stroke, a little bigger than print's
        rnd = self.rnd
        k, r = rnd.randint(3, 5), rnd.uniform(10, 14)
        c, u, n = self._ends(a, b, 2 * r * k)
        pts = []
        for j in range(k):
            cc, rr = c + u * r * (2 * j + 1 - k), r * rnd.uniform(0.9, 1.1)
            pts += [tuple(cc + u * rr * math.cos(math.radians(t)) - n * rr * math.sin(math.radians(t))) for t in range(180, -1, -15)]
        self.d.line(pts, fill=0)
        self._label(a, b, label, side, (r if side < 0 else 0) + rnd.uniform(12, 20))

    def _arrow(self, c, u, L=24, head=11):
        # a head of two strokes
        t, h = c - u * L, c + u * L
        n = np.array([-u[1], u[0]])
        self.d.line([tuple(t), tuple(h)], fill=0)
        for s in (1, -1): self.d.line([tuple(h), tuple(h - u * head * 1.4 + n * head * 0.9 * s)], fill=0)

    def save(self, out, name, ink, turn=None):
        self.im.save(os.path.join(out, name + '.png'), optimize=True)
        # (a phone takes the page at twice the drawing's detail)
        big = self.im.resize((2 * self.w, 2 * self.h), Image.LANCZOS)
        sketch_photo(big, self.rnd, ink, turn).save(os.path.join(out, name + '-photo.jpg'), quality=80)


def sketch_photo(im, rnd, ink, turn=None):
    """A drawing in coloured pen as a phone photo: grey paper with blotches and grain, light
    falling off across it and sometimes a soft shadow over an edge, ink laid down unevenly, a
    turn and a little blur."""
    a = np.asarray(im).astype(np.float32) / 255
    h, w = a.shape
    rng = np.random.default_rng(rnd.randrange(1 << 30))
    yy, xx = np.mgrid[0:h, 0:w]
    light = 0.8 + rnd.uniform(-0.1, 0.1) * (xx / w - 0.5) + rnd.uniform(-0.08, 0.08) * (yy / h - 0.5)
    shadow = rnd.choice(['bottom', 'left', None])
    if shadow == 'bottom': light *= 1 - 0.3 * np.clip((yy / h - 0.8) / 0.2, 0, 1) ** 1.5
    if shadow == 'left': light *= 1 - 0.25 * np.clip((0.15 - xx / w) / 0.15, 0, 1) ** 1.5

    def smooth(cell):
        z = (rng.random((h // cell + 2, w // cell + 2)) * 255).astype(np.uint8)
        return np.asarray(Image.fromarray(z).resize((w + 2 * cell, h + 2 * cell), Image.BICUBIC))[cell:cell + h, cell:cell + w].astype(np.float32) / 255
    cov = (1 - a) * (0.8 + 0.2 * smooth(6))
    paper, inkc = np.array([0.97, 0.965, 0.95]), np.array(ink)
    rgb = (paper * (1 - cov[..., None]) + inkc * cov[..., None]) * light[..., None]
    rgb += (smooth(24)[..., None] - 0.5) * 0.05 + rng.normal(0, 0.03, (h, w, 1)) + rng.normal(0, 0.01, rgb.shape)
    for _ in range(int(w * h / 5000)):
        x, y, r = rnd.randrange(w), rnd.randrange(h), rnd.choice([1, 1, 2])
        rgb[max(0, y - r):y + r, max(0, x - r):x + r] *= rnd.uniform(0.6, 0.9)
    out = Image.fromarray(np.clip(rgb * 255, 0, 255).astype(np.uint8), 'RGB')
    angle = rnd.uniform(-2.5, 2.5) if turn is None else turn
    out = out.rotate(angle, resample=Image.BICUBIC, fillcolor=tuple(int(204 * c) for c in paper))
    return out.filter(ImageFilter.GaussianBlur(rnd.uniform(0.9, 1.3)))


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

    # drawn by hand (a hand of its own, so the figures above stay as they were)
    sk = random.Random(41)
    RED, BLUE, BLACK = (0.78, 0.2, 0.22), (0.16, 0.24, 0.62), (0.16, 0.16, 0.2)

    # 6. a divider like a homework sketch, the asked voltage marked + Vo − across the 3 Ω: 9 V
    f = SketchFig(3, 2, sk)
    f.vsource((0, 0), (0, 2), '18 V', plus_at_a=True, side=1)
    f.resistor((0, 0), (1.5, 0), '2 Ω', side=-1)
    f.wire((1.5, 0), (3, 0))
    f.resistor((1.5, 0), (1.5, 2), '3 Ω', side=-1)
    f.resistor((3, 0), (3, 2), '6 Ω', side=-1)
    f.wire((0, 2), (3, 2))
    f.ground((1.5, 2))
    x = f.P(1.5, 0)[0] - 44
    f.text((x, f.P(0, 0.62)[1]), '+')
    f.label((x - 8, f.P(0, 1)[1]), 'V', 'o')
    f.text((x, f.P(0, 1.38)[1]), '−')
    f.text(f.P(1.3, 2.7), 'Find Vo')
    f.save(out, 'sketch-divider', RED)

    # 7. a battery and a current source, i marked down the 4 Ω: i = 7/3 A
    f = SketchFig(4, 2, sk, gap=1.5)
    f.battery((0, 2), (0, 0), '10 V', plus_at_a=False, side=-1)
    f.resistor((0, 0), (2, 0), '2 Ω', side=-1)
    f.resistor((2, 0), (2, 2), '4 Ω', side=-1)
    f.wire((2, 0), (4, 0))
    f.isource((4, 2), (4, 0), '2 A', to_b=True, side=1)
    f.wire((0, 2), (4, 2))
    f.iarrow((f.P(2, 0.3)[0] + 22, f.P(2, 0.3)[1]), down=True)
    f.save(out, 'sketch-mesh', BLUE)

    # 8. a coil and a capacitor with their units, written small and squeezed
    f = SketchFig(3, 2, sk)
    f.vsource((0, 0), (0, 2), '5 V', plus_at_a=True)
    f.resistor((0, 0), (1.5, 0), '1 kΩ', side=-1)
    f.inductor((1.5, 0), (3, 0), '2 mH', side=1)
    f.capacitor((3, 0), (3, 2), '10 μF', side=1)
    f.wire((0, 2), (3, 2))
    f.ground((1.5, 2))
    f.save(out, 'sketch-rlc', BLACK)

    # 9. a practice problem printed in a book's own style: a two-cell battery, a current source
    # with its wire run on through it, the currents asked for marked by arrowheads on the wires
    # and named in bold with capital subscripts (I_A, I_B): I_A = 2 A, I_B = −0.5 A
    f = Fig(3, 3)
    f.wire((0, 0), (3, 0))
    f.battery((0, 0), (0, 3), '7 V', plus_at_a=True, side=1, cells=2)
    f.resistor((1.2, 0), (1.2, 1.5), '1 Ω', side=1)
    f.isource_through((1.2, 1.5), (1.2, 2.25), '7 A', to_b=True, side=1)
    f.resistor((1.2, 2.25), (1.2, 3), '2 Ω', side=1)
    f.mark((1.2, 1.5), (1.7, 1.5), at=0.5, to_b=True)
    f.resistor((1.7, 1.5), (3, 1.5), '3 Ω', side=-1)
    f.name(f.P(1.45, 1.22), 'I', 'B')
    f.resistor((3, 0), (3, 1.5), '2 Ω', side=1)
    f.resistor((3, 1.5), (3, 2.4), '1 Ω', side=1)
    f.mark((3, 2.4), (3, 3), at=0.5, to_b=True)
    f.name(f.P(2.75, 2.7), 'I', 'A')
    f.wire((0, 3), (3, 3))
    f.save(out, 'practice', random.Random(61))

    # 10. a bridge drawn as a diamond, its sides slanting: 10 V across it, the 5 Ω between its
    # middle corners; the 2 Ω carries 71/46 A, the 4 Ω 29/23 A, the 5 Ω 9/23 A
    f = Fig(4, 2)
    f.vsource((0, 0), (0, 2), '10 V', plus_at_a=True)
    f.wire((0, 0), (2.5, 0)); f.wire((0, 2), (2.5, 2))
    T, L, R, B = (2.5, 0), (1.5, 1), (3.5, 1), (2.5, 2)
    f.resistor(T, L, '6 Ω', side=1)
    f.resistor(T, R, '3 Ω', side=-1)
    f.resistor(L, B, '2 Ω', side=1)
    f.resistor(R, B, '4 Ω', side=-1)
    f.resistor(L, R, '5 Ω', side=-1)
    f.save(out, 'bridge', random.Random(71))

    # 11. conductances in siemens, as nodal problems give them: 6 A into 2 S and 4 S, 1 V across
    f = Fig(3, 2)
    f.isource((0, 2), (0, 0), '6 A', to_b=True)
    f.wire((0, 0), (3, 0)); f.wire((0, 2), (3, 2))
    f.resistor((1.5, 0), (1.5, 2), '2 S', side=-1)
    f.resistor((3, 0), (3, 2), '4 S', side=-1)
    f.save(out, 'siemens', random.Random(81))

    # 12. two meshes, each with its mesh current drawn as a round arrow inside it (i₁, i₂): 12 V
    # into 2 Ω, then 6 Ω beside 3 Ω + 3 Ω, 1.2 A down each branch
    f = Fig(4, 2)
    f.vsource((0, 0), (0, 2), '12 V', plus_at_a=True)
    f.resistor((0, 0), (2, 0), '2 Ω', side=-1)
    f.resistor((2, 0), (2, 2), '6 Ω', side=-1)
    f.resistor((2, 0), (4, 0), '3 Ω', side=-1)
    f.resistor((4, 0), (4, 2), '3 Ω', side=-1)
    f.wire((0, 2), (4, 2))
    f.mesh((1, 1), 'i', '1')
    f.mesh((3, 1), 'i', '2')
    # (cut close round it, as the crop step leaves a figure: its three upright wires, evenly
    # spaced, run down most of the picture)
    f.im = f.im.crop((100, 70, 830, 470))
    f.save(out, 'meshcurrents', random.Random(91))

    # 13. a coil and a capacitor whose values are printed as fractions: ½ H, ¼ F
    f = Fig(3, 2)
    f.vsource((0, 0), (0, 2), '6 V', plus_at_a=True)
    f.resistor((0, 0), (1.5, 0), '2 Ω', side=-1)
    f.inductor((1.5, 0), (3, 0), None)
    f.frac((f.P(2.25, 0)[0] - 14, f.P(2.25, 0)[1] - 62), '1', '2', 'H')
    f.capacitor((3, 0), (3, 2), None)
    f.frac((f.P(3, 1)[0] + 56, f.P(3, 1)[1]), '1', '4', 'F')
    f.wire((0, 2), (3, 2))
    f.save(out, 'fractions', random.Random(101))

    # 14. a delta drawn as a triangle, its slanting sides' values printed along them ("x₁ = 4Ω",
    # the name before the value) and its base a resistor printed small, its zigzag run together:
    # 12 V across the 4 Ω, 3 A through it and 2 A round the other two
    f = Fig(4, 2)
    f.vsource((0, 0), (0, 2), '12 V', plus_at_a=True)
    T, L, R = (2, 0), (1, 2), (3, 2)
    f.wire((0, 0), T); f.wire((0, 2), L)
    f.resistor(T, L, None)
    f.along(T, L, [('x', 'i', False), ('1', 's', True), (' = 4Ω', 'f', False)], side=-1)
    f.resistor(T, R, None)
    f.along(T, R, [('2.5Ω', 'f', False)], side=-1)
    f.tight(L, R, '3.5 Ω', side=1)
    f.save(out, 'delta', random.Random(111))
    print('ok')


if __name__ == '__main__':
    main()
