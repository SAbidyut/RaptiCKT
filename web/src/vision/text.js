// The writing around a figure: characters (connected bits of ink that are not the circuit),
// joined into words ("20 Ω", "0.1vₓ", "4iₓ"), with each character cut out sharply for reading;
// and the loose arrows that mark currents.

import { arrowOf } from './arrow.js';
import { inTriangle } from './shapes.js';

const median = (a) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[b.length >> 1] : 0; };

/**
 * Characters and words near a figure. img: { w, h, labels, comps, sw, src }, fig: from
 * findFigures, S: from readStructure (source bodies and used bars are left out).
 * Returns { words: [{ glyphs, x0, y0, x1, y1 }], arrows: [{ x0, y0, x1, y1, dir: [dx, dy], cx, cy }], height, tilt }.
 */
export function findText(img, fig, S) {
  const { sw, comps } = img;
  const skip = new Set(S.usedBars || []);
  const cands = [], angles = [];
  for (const id of fig.near) {
    if (skip.has(id)) continue;
    const c = comps[id - 1];
    // a phasor's angle sign (∠) is no character the reader knows: kept apart, joined later
    if (c.angle) { angles.push({ x0: c.x0, y0: c.y0, x1: c.x1, y1: c.y1 }); continue; }
    const cw = c.x1 - c.x0 + 1, ch = c.y1 - c.y0 + 1;
    // grain (a decimal point can be as small as the line is thick: keep that)
    if (c.area < 0.3 * sw * sw || Math.max(cw, ch) < 0.6 * sw) continue;
    const cx = (c.x0 + c.x1) / 2, cy = (c.y0 + c.y1) / 2;
    // the signs and arrows drawn inside a source (or an op amp) belong to it
    // (a diode's or a transistor's labels sit close beside it, and are read)
    if (S.shapes.some((s) => s.kind !== 'device' && (s.kind === 'triangle' ? inTriangle(s, cx, cy, 0) : (s.kind === 'circle' ? Math.hypot(cx - s.cx, cy - s.cy) : (Math.abs(cx - s.cx) + Math.abs(cy - s.cy)) / 1.2) < s.r))) continue;
    cands.push({ ids: [id], x0: c.x0, y0: c.y0, x1: c.x1, y1: c.y1, area: c.area });
  }
  const hs = cands.map((g) => g.y1 - g.y0 + 1).filter((v) => v >= 2 * sw && v <= 20 * sw);
  const H = Math.max(2.5 * sw, median(hs) || 5 * sw);
  const tilt = S.tilt || 0;
  // current arrows: long thin pieces with a head
  const arrows = [];
  const glyphs = [];
  for (const g of cands) {
    const gw = g.x1 - g.x0 + 1, gh = g.y1 - g.y0 + 1;
    const long = Math.max(gw, gh), short = Math.min(gw, gh);
    if (long >= 1.3 * H && long >= 2 * short) {
      const a = arrowOf(img, g);
      if (a) { arrows.push(a); continue; }
    }
    if (long > 4 * H) continue; // a stray line, not writing
    glyphs.push(g);
  }
  // the dot of an i or j joins the stem under it: a small round solid dot, right over a narrow
  // stem of one stroke (paper grain over a wide letter, or over an 8, must not)
  glyphs.sort((a, b) => a.area - b.area);
  for (const d of glyphs) {
    if (d.dead) continue;
    const dw = d.x1 - d.x0 + 1, dh = d.y1 - d.y0 + 1;
    if (Math.max(dw, dh) > 0.4 * H || Math.max(dw, dh) > 2.2 * Math.min(dw, dh) || d.area < 0.45 * dw * dh) continue;
    let best = null, bd = Infinity;
    for (const s of glyphs) {
      if (s === d || s.dead) continue;
      const sh = s.y1 - s.y0 + 1, sw2 = s.x1 - s.x0 + 1;
      // (the stem starts under the dot, or level with its lower edge: a dot may sit a pixel low)
      if (sh < 1.8 * dh || s.y0 <= (d.y0 + d.y1) / 2 || sw2 > 0.6 * sh || dw > 1.3 * sw2 || !oneStroke(img, s)) continue;
      const gap = s.y0 - d.y1;
      const dx = Math.max(0, s.x0 - d.x1, d.x0 - s.x1);
      if (gap > 0.45 * sh || dx > 0.15 * H) continue;
      if (gap + dx < bd) { bd = gap + dx; best = s; }
    }
    if (best) {
      best.ids.push(...d.ids);
      best.x0 = Math.min(best.x0, d.x0); best.y0 = Math.min(best.y0, d.y0); best.x1 = Math.max(best.x1, d.x1); best.y1 = Math.max(best.y1, d.y1);
      best.area += d.area; best.dotted = true;
      d.dead = true;
    }
  }
  const live = glyphs.filter((g) => !g.dead);
  // words: each character joined to its nearest neighbour on the right when they share a line,
  // or when the right one is a subscript of the left one
  live.sort((a, b) => a.x0 - b.x0);
  const parent = live.map((_, k) => k);
  const find = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  for (let i = 0; i < live.length; i++) {
    const f = live[i], fh = f.y1 - f.y0 + 1;
    let best = -1, bg = Infinity;
    for (let j = 0; j < live.length; j++) {
      if (j === i) continue;
      const g = live[j], gh = g.y1 - g.y0 + 1;
      const gap = g.x0 - f.x1 - 1;
      if (g.x0 <= f.x0) continue;
      // italic letters may tuck under: a subscript under the arm of a V, a little way
      const deep = gap < -0.6 * Math.min(fh, gh);
      const overlap = Math.min(f.y1, g.y1) - Math.max(f.y0, g.y0) + 1;
      const sameLine = overlap >= 0.35 * Math.min(fh, gh) && gap <= 0.8 * Math.max(Math.min(fh, gh), 0.6 * H) && gap >= -0.3 * Math.min(fh, gh);
      const fcy = (f.y0 + f.y1) / 2, gcy = (g.y0 + g.y1) / 2;
      // a subscript sits lower, its top inside the lower part of the letter before it
      const sub = gh <= 1.05 * fh && gap <= 0.45 * fh && gcy - fcy >= 0.25 * fh && g.y0 > f.y0 + 0.2 * fh && g.y0 < f.y1 + 0.15 * fh &&
        (!deep || (gh < 0.7 * fh && g.x1 > f.x1 && (g.x0 + g.x1) / 2 > (f.x0 + f.x1) / 2 + 0.3 * (f.x1 - f.x0 + 1)));
      if (!sameLine && !sub) continue;
      if (gap < bg) { bg = gap; best = j; }
    }
    if (best >= 0) parent[find(i)] = find(best);
  }
  // a fraction (¹⁄₄ F): the numbers over and under its bar go with it, and so with the unit after
  live.forEach((b, i) => {
    const bh = b.y1 - b.y0 + 1, bw = b.x1 - b.x0 + 1;
    if (bh > 0.2 * H || bw < 2.5 * bh || bw > 2.5 * H) return;
    const over = [], under = [];
    live.forEach((g, j) => {
      const cx = (g.x0 + g.x1) / 2, gh = g.y1 - g.y0 + 1;
      if (j === i || cx < b.x0 || cx > b.x1 || gh < 0.4 * H || gh > 1.2 * H) return;
      if (g.y1 < b.y0 && b.y0 - g.y1 <= 0.4 * H) over.push(j);
      if (g.y0 > b.y1 && g.y0 - b.y1 <= 0.4 * H) under.push(j);
    });
    if (over.length && under.length) for (const j of [...over, ...under]) parent[find(j)] = find(i);
  });
  const groups = new Map();
  live.forEach((g, k) => { const r = find(k); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(g); });
  const words = [];
  for (const raw of groups.values()) {
    // pieces stacked in one character's column are one character (a 2 printed in two parts)
    raw.sort((a, b) => a.x0 - b.x0);
    const list = [];
    for (const g of raw) {
      const prev = list.find((q) => {
        const ov = Math.min(q.x1, g.x1) - Math.max(q.x0, g.x0) + 1;
        const vgap = Math.max(q.y0, g.y0) - Math.min(q.y1, g.y1) - 1;
        const hh = Math.max(q.y1, g.y1) - Math.min(q.y0, g.y0) + 1;
        // stacked: one above the other, hardly overlapping in height (a point beside a serif is not)
        const vov = Math.min(q.y1, g.y1) - Math.max(q.y0, g.y0) + 1;
        // both real strokes (a speck under a letter is grain, not half of it)
        const big = (r) => Math.max(r.x1 - r.x0 + 1, r.y1 - r.y0 + 1) >= 0.3 * H;
        // (a fraction's bar, clear of the numbers over and under it, is no part of them)
        const bar = (r) => r.y1 - r.y0 + 1 <= 0.2 * H && r.x1 - r.x0 + 1 >= 2.5 * (r.y1 - r.y0 + 1);
        if ((bar(q) || bar(g)) && vgap >= 0.06 * H) return false;
        return big(q) && big(g) && ov >= 0.6 * Math.min(q.x1 - q.x0 + 1, g.x1 - g.x0 + 1) && vgap <= 0.35 * H && vov <= 0.3 * Math.min(q.y1 - q.y0 + 1, g.y1 - g.y0 + 1) && hh <= 1.35 * H;
      });
      if (prev) {
        prev.ids.push(...g.ids);
        prev.x0 = Math.min(prev.x0, g.x0); prev.y0 = Math.min(prev.y0, g.y0); prev.x1 = Math.max(prev.x1, g.x1); prev.y1 = Math.max(prev.y1, g.y1);
        prev.area += g.area;
      } else list.push(g);
    }
    for (const g of list) g.bitmap = cutGlyph(img, g);
    words.push(word(list, H, tilt));
  }
  return { words, arrows, angles, height: H, tilt };
}

/**
 * A word of characters (with their bitmaps): its box, and each character marked small or low
 * (a subscript) against the others, in print (low) and by hand (lowHand). H: the figure's text
 * height; tilt: the photo's.
 */
export function word(list, H, tilt = 0) {
  list.sort((a, b) => a.x0 - b.x0);
  const x0 = Math.min(...list.map((g) => g.x0)), y0 = Math.min(...list.map((g) => g.y0));
  const x1 = Math.max(...list.map((g) => g.x1)), y1 = Math.max(...list.map((g) => g.y1));
  // the line's main height: the lower middle of its bigger characters (one blot with grain
  // stuck on it must not make the others look small)
  const tall = Math.max(...list.map((g) => g.y1 - g.y0 + 1));
  const hs2 = list.map((g) => g.y1 - g.y0 + 1).filter((v) => v >= 0.5 * tall).sort((a, b) => a - b);
  const top = hs2[(hs2.length - 1) >> 1];
  list.forEach((g, k) => {
    const gh = g.y1 - g.y0 + 1;
    // (a word of small letters alone, like vₓ, has no tall ones to compare with)
    g.small = gh < 0.72 * top || gh < 0.55 * H;
    // a subscript sits lower than the character before it (a lowercase letter on the line,
    // like the m of "2 mH", does not); the next character at its level is one too. A speck
    // before it is no character to measure by
    let j = k - 1;
    while (j >= 0 && list[j].y1 - list[j].y0 + 1 < 0.3 * top && list[j].x1 - list[j].x0 + 1 < 0.3 * top) j--;
    const prev = list[j];
    if (!prev) { g.low = g.lowHand = false; } else {
      const ph = prev.y1 - prev.y0 + 1;
      // heights as if the photo were straight (a tilted line climbs or falls along the word)
      const dy = tilt * ((g.x0 + g.x1) / 2 - (prev.x0 + prev.x1) / 2);
      const gy0 = g.y0 - dy, gy1 = g.y1 - dy;
      const level = Math.abs(gy1 - prev.y1) < 0.35 * Math.max(gh, ph) && gy0 > prev.y0 - 0.3 * ph;
      const smaller = gh < 0.8 * ph && gy1 > prev.y1 + 0.12 * ph && gy0 > prev.y0 + 0.3 * ph;
      g.low = prev.low ? level : (gy1 > prev.y1 + 0.2 * ph && gy0 > prev.y0 + 0.1 * ph) || smaller;
      // (written by hand, a line wanders: a character a little lower is a subscript only if it
      // is smaller too)
      g.lowHand = prev.lowHand ? level : smaller;
    }
  });
  return { glyphs: list, x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

/** Is a glyph one upright stroke (the stem of an i or j), not a round letter or digit like an 8? */
function oneStroke(img, g) {
  const { labels, w } = img;
  const own = new Set(g.ids);
  let rows = 0, two = 0;
  for (let y = g.y0; y <= g.y1; y++) {
    let runs = 0, inRun = false;
    for (let x = g.x0; x <= g.x1; x++) {
      const on = own.has(labels[y * w + x]);
      if (on && !inRun) runs++;
      inRun = on;
    }
    if (runs) rows++;
    if (runs >= 2) two++;
  }
  return two <= 0.2 * rows;
}

/**
 * A character cut out of the sharper source image: { w, h, data (0/1), oy, k }, only the ink of
 * this character's own pieces.
 */
export function cutGlyph(img, g) {
  const { src, labels, w } = img;
  const k = src.k; // source px → working px
  const own = new Set(g.ids);
  const X0 = Math.max(0, Math.floor(g.x0 / k) - 1), Y0 = Math.max(0, Math.floor(g.y0 / k) - 1);
  const X1 = Math.min(src.w - 1, Math.ceil((g.x1 + 1) / k)), Y1 = Math.min(src.h - 1, Math.ceil((g.y1 + 1) / k));
  const W = X1 - X0 + 1, H = Y1 - Y0 + 1;
  // the paper and the ink of this patch
  const vals = [];
  for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) vals.push(src.d[y * src.w + x]);
  vals.sort((a, b) => a - b);
  const paper = vals[Math.floor(vals.length * 0.15)], inkv = vals[Math.floor(vals.length * 0.97)];
  // small print is soft-edged: a lower cut keeps its thin strokes and serifs
  const small = (Y1 - Y0 + 1) < 26;
  const thr = paper + Math.max(18, (small ? 0.3 : 0.45) * (inkv - paper));
  // a faint stroke of tiny print (the far side of an italic o) may have missed the binarization:
  // follow the dark pixels out from the character's own ink, a little beyond its box
  const M = small ? Math.max(2, Math.round(0.35 * H)) : 0;
  const EX0 = Math.max(0, X0 - M), EY0 = Math.max(0, Y0 - M);
  const EX1 = Math.min(src.w - 1, X1 + M), EY1 = Math.min(src.h - 1, Y1 + M);
  const EW = EX1 - EX0 + 1, EH = EY1 - EY0 + 1;
  // what the working image says about a source pixel: 1 this character's ink (or next to it),
  // 2 another piece's ink (or next to it), or a ruled line taken out, 0 paper
  const whose = (x, y, r) => {
    const wx = Math.min(img.w - 1, Math.floor(x * k)), wy = Math.min(img.h - 1, Math.floor(y * k));
    if (img.erased?.[wy * w + wx]) return 2;
    let res = 0;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const X = wx + dx, Y = wy + dy;
      if (X < 0 || Y < 0 || X >= img.w || Y >= img.h) continue;
      const l = labels[Y * w + X];
      if (own.has(l)) res = 1;
      else if (l && !res) res = 2;
    }
    return res;
  };
  const data = new Uint8Array(EW * EH);
  const stack = [];
  const r = small ? 2 : 1;
  for (let y = Y0; y <= Y1; y++) {
    for (let x = X0; x <= X1; x++) {
      // keep the pixel when it is dark and belongs to (or touches) this character's ink
      if (src.d[y * src.w + x] >= thr && whose(x, y, r) === 1) { data[(y - EY0) * EW + (x - EX0)] = 1; stack.push(x, y); }
    }
  }
  if (!stack.length) return { w: 1, h: 1, data: new Uint8Array(1), oy: 0, k };
  if (M) {
    while (stack.length) {
      const y = stack.pop(), x = stack.pop();
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const X = x + dx, Y = y + dy;
        if (X < EX0 || Y < EY0 || X > EX1 || Y > EY1 || data[(Y - EY0) * EW + (X - EX0)]) continue;
        if (src.d[Y * src.w + X] < thr || whose(X, Y, 1) === 2) continue;
        data[(Y - EY0) * EW + (X - EX0)] = 1;
        stack.push(X, Y);
      }
    }
  }
  despeck(data, EW, EH);
  // trim to the ink
  let a = EW, b = EH, c = -1, d = -1;
  for (let y = 0; y < EH; y++) for (let x = 0; x < EW; x++) if (data[y * EW + x]) { if (x < a) a = x; if (x > c) c = x; if (y < b) b = y; if (y > d) d = y; }
  const tw = c - a + 1, th = d - b + 1, out = new Uint8Array(tw * th);
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) out[y * tw + x] = data[(y + b) * EW + (x + a)];
  // oy: the top row in source pixels (k: working px per source px), to crop it by rows later
  return { w: tw, h: th, data: out, oy: b + EY0, k };
}

/**
 * Clear specks of grain caught with a character (they stretch its box, and a 2 with a speck under
 * it reads as a 7): bits much smaller than the rest. The dot of an i is big enough to stay.
 */
export function despeck(data, w, h) {
  const lab = new Int32Array(w * h);
  const sizes = [0];
  const stack = [];
  let total = 0;
  for (let i = 0; i < w * h; i++) {
    if (!data[i] || lab[i]) continue;
    const id = sizes.length;
    let n = 0;
    lab[i] = id;
    stack.push(i);
    while (stack.length) {
      const j = stack.pop(), x = j % w, y = (j / w) | 0;
      n++;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const X = x + dx, Y = y + dy;
        if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
        const k = Y * w + X;
        if (data[k] && !lab[k]) { lab[k] = id; stack.push(k); }
      }
    }
    sizes.push(n);
    total += n;
  }
  if (sizes.length <= 2) return;
  const big = Math.max(...sizes);
  for (let i = 0; i < w * h; i++) {
    const n = sizes[lab[i]];
    if (data[i] && n < Math.max(3, 0.04 * total) && n < 0.15 * big) data[i] = 0;
  }
}

