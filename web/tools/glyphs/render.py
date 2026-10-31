"""Synthetic printed characters for the offline circuit reader's glyph classifier.

Renders every class in many fonts (Times-like, Computer Modern, sans, italic, bold) and
degrades each copy the way a phone photo or a page screenshot does: random size, blur and
threshold (thicker or thinner strokes), slant, rotation, noise, specks and broken strokes.
Writes glyphs.bin: per sample [class u8][w u8][h u8][w*h bytes 0/1].

    python3 render.py OUT_DIR [EXTRA_FONT_DIR ...]

EXTRA_FONT_DIR: e.g. the fonts/ttf folder of a matplotlib wheel (STIX, cmr10, cmmi10 ...).
PER (environment) sets the copies per font and class (default 40).
"""
import glob, os, random, struct, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

CLASSES = list('0123456789') + ['.', '+', '-', 'Ω', 'v', 'A', 'k', 'm', 'M', 'μ', 'F', 'H', 'i', 'x', 'o', 'I', 'R', 'a', 'b', 'L', 'c', 'j', 's', 'g', 'u', 'r', 'e', 'n', 't']
# what to draw for a class (several shapes share one class: v/V, o/O, c/C, s/S, x/X, I/l)
DRAW = {'v': 'vV', 'o': 'oO', 'c': 'cC', 's': 'sS', 'x': 'xX', 'I': 'Il|', '-': ['-', chr(0x2212)], 'μ': [chr(0x3bc), chr(0xb5)], 'k': 'kK'}
# code points no font here has: what a font draws for a missing character
MISSING = [chr(0xffff), chr(0x378), chr(0xe000), chr(0x4e00), chr(0x1f600)]
# fonts whose punctuation and digits are other symbols: letters only; fonts with their own
# encoding above ASCII (TeX's Computer Modern): ASCII only
LETTERS_ONLY = ('cmmi10',)
ASCII_ONLY = ('/cm',)


def fonts(extra):
    pats = ['/usr/share/fonts/truetype/liberation/LiberationS*.ttf', '/usr/share/fonts/truetype/freefont/FreeSerif*.ttf',
            '/usr/share/fonts/truetype/freefont/FreeSans*.ttf', '/usr/share/fonts/truetype/dejavu/DejaVu*.ttf',
            '/usr/share/fonts/truetype/crosextra/*.ttf', '/usr/share/fonts/X11/Type1/c063*.pfb', '/usr/share/fonts/X11/Type1/c064*.pfb',
            '/usr/share/fonts/opentype/inter/Inter-Regular.otf', '/usr/share/fonts/opentype/inter/Inter-Italic.otf',
            '/usr/share/fonts/opentype/inter/Inter-Bold.otf', '/usr/share/fonts/opentype/inter/Inter-SemiBoldItalic.otf']
    for d in extra:
        for n in ['STIXGeneral.ttf', 'STIXGeneralItalic.ttf', 'STIXGeneralBol.ttf', 'STIXGeneralBolIta.ttf', 'cmr10.ttf', 'cmmi10.ttf', 'cmb10.ttf', 'cmti10.ttf', 'cmss10.ttf',
                  'DejaVuSerif-Italic.ttf', 'DejaVuSerif-BoldItalic.ttf', 'DejaVuSans-Oblique.ttf', 'DejaVuSans-BoldOblique.ttf']:
            p = os.path.join(d, n)
            if os.path.exists(p): pats.append(p)
    out = []
    for pat in pats:
        for p in sorted(glob.glob(pat)):
            if 'Mono' in p or p in out: continue
            out.append(p)
    return out


def draw(font, ch):
    im = Image.new('L', (120, 120), 0)
    ImageDraw.Draw(im).text((20, 10), ch, font=font, fill=255)
    return np.asarray(im)


def has(font, ch, notdefs):
    a = draw(font, ch)
    return a.max() > 0 and not any(np.array_equal(a, n) for n in notdefs)


def base(font, ch):
    im = Image.new('L', (160, 160), 0)
    ImageDraw.Draw(im).text((40, 30), ch, font=font, fill=255)
    return im


def degrade(im, rnd):
    """One degraded binary copy of a white-on-black glyph image."""
    w, h = im.size
    # slant and turn
    sh = rnd.uniform(-0.16, 0.16)
    im = im.transform((w, h), Image.AFFINE, (1, sh, -sh * h / 2, 0, 1, 0), resample=Image.BILINEAR)
    im = im.rotate(rnd.uniform(-4, 4), resample=Image.BILINEAR)
    # thicker or thinner strokes: blur then threshold (never so thin that strokes vanish)
    ref = (np.asarray(im) > 127).sum()
    if rnd.random() < 0.8: im = im.filter(ImageFilter.GaussianBlur(rnd.uniform(0.3, 2.8)))
    g = np.asarray(im).astype(np.float32) / 255
    t = rnd.uniform(0.2, 0.65)
    a = g > t
    while a.sum() < 0.6 * ref and t > 0.15:
        t -= 0.08
        a = g > t
    a = a.astype(np.float32)
    ys, xs = np.nonzero(a)
    if not len(xs): return None
    a = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    # to the size it will have in a picture (glyph height 8-70 px), squeezed a little
    H = int(round(np.exp(rnd.uniform(np.log(8), np.log(70)))))
    k = H / max(1, a.shape[0])
    W = max(1, int(round(a.shape[1] * k * rnd.uniform(0.88, 1.12))))
    Hh = max(1, int(round(a.shape[0] * k)))
    small = Image.fromarray((a * 255).astype(np.uint8)).resize((W, Hh), Image.BOX)
    rng = np.random.default_rng(rnd.randrange(1 << 30))
    s = np.asarray(small).astype(np.float32) / 255
    s = s + rng.normal(0, rnd.uniform(0, 0.12), s.shape)
    b = s > rnd.uniform(0.35, 0.6)
    # broken strokes and specks stuck to the glyph
    if rnd.random() < 0.12: b &= rng.random(b.shape) > rnd.uniform(0.02, 0.07)
    if rnd.random() < 0.15 and b.size > 30:
        ys, xs = np.nonzero(b)
        if len(xs):
            i = rnd.randrange(len(xs))
            r = max(1, int(round(max(b.shape) * rnd.uniform(0.03, 0.08))))
            y0, x0 = ys[i] + rnd.randint(-r, r), xs[i] + rnd.randint(-r, r)
            b[max(0, y0 - r):y0 + r + 1, max(0, x0 - r):x0 + r + 1] = True
    ys, xs = np.nonzero(b)
    if not len(xs): return None
    b = b[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    if b.shape[0] > 255 or b.shape[1] > 255: return None
    return b


def main():
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    rnd = random.Random(7)
    fl = fonts(sys.argv[2:])
    print(len(fl), 'fonts')
    per = int(os.environ.get('PER', '40'))
    n = 0
    with open(os.path.join(out, 'glyphs.bin'), 'wb') as f:
        for path in fl:
            try: font = ImageFont.truetype(path, 72)
            except Exception: continue
            notdefs = [draw(font, c) for c in MISSING]
            for ci, cls in enumerate(CLASSES):
                if any(t in path for t in LETTERS_ONLY) and not cls.isalpha(): continue
                if any(t in path for t in ASCII_ONLY) and ord(cls[0]) > 127: continue
                shapes = [c for c in DRAW.get(cls, cls) if has(font, c, notdefs)]
                if not shapes: continue
                for k in range(per):
                    b = degrade(base(font, shapes[k % len(shapes)]), rnd)
                    if b is None: continue
                    h, w = b.shape
                    f.write(struct.pack('BBB', ci, w, h)); f.write(b.astype(np.uint8).tobytes()); n += 1
            print(os.path.basename(path), n, flush=True)
    print('samples', n)


if __name__ == '__main__':
    main()
