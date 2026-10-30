// Labels printed along a slanting part (a delta's or a star's sides: "x₁ = 2.5Ω" running up
// beside its resistor): the writing beside each slanting part, turned level, is read as a line
// of its own, and taken where it reads better than it did as level writing.

import { components } from './image.js';
import { findText } from './text.js';
import { readWords } from './labels.js';

/**
 * img: the prepared picture with its labels (as for findText), fig, S: the figure and its
 * structure, words: its words as read level ([{ …word, read }]), H: their height. Returns the
 * words with those that read better turned in place of the level ones.
 */
export function slantedWords(img, fig, S, words, H) {
  const parts = S.parts.filter((p) => p.axis === 'd' && p.a != null && p.type !== 'loose');
  if (!parts.length) return words;
  const { comps, labels, w } = img;
  // each piece of writing goes with the slanting part it lies closest beside
  const lines = parts.map((p) => {
    const A = S.vertices[p.a], B = S.vertices[p.b];
    let t = Math.atan2(B.y - A.y, B.x - A.x);
    if (t > Math.PI / 2) t -= Math.PI; else if (t <= -Math.PI / 2) t += Math.PI;
    return { p, t, cx: (A.x + B.x) / 2, cy: (A.y + B.y) / 2, L: Math.hypot(B.x - A.x, B.y - A.y), ids: [] };
  });
  // (a label's characters together: those close to each other go with one part, as the label
  // lies, though its first character alone may lie nearer another)
  const ids = fig.near.filter((id) => { const c = comps[id - 1]; return c.area >= 0.3 * img.sw * img.sw && Math.max(c.x1 - c.x0, c.y1 - c.y0) <= 3 * H; });
  const up = new Map(ids.map((id) => [id, id]));
  const find = (id) => { while (up.get(id) !== id) id = up.get(id); return id; };
  for (const a of ids) {
    for (const b of ids) {
      const p = comps[a - 1], q = comps[b - 1];
      if (a < b && Math.max(p.x0 - q.x1, q.x0 - p.x1, p.y0 - q.y1, q.y0 - p.y1) <= 0.3 * H) up.set(find(a), find(b));
    }
  }
  const groups = new Map();
  for (const id of ids) { const r = find(id); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(id); }
  for (const list of groups.values()) {
    const area = list.reduce((t, id) => t + comps[id - 1].area, 0);
    const x = list.reduce((t, id) => t + comps[id - 1].area * (comps[id - 1].x0 + comps[id - 1].x1) / 2, 0) / area;
    const y = list.reduce((t, id) => t + comps[id - 1].area * (comps[id - 1].y0 + comps[id - 1].y1) / 2, 0) / area;
    let best = null, bd = Infinity;
    for (const l of lines) {
      const u = (x - l.cx) * Math.cos(l.t) + (y - l.cy) * Math.sin(l.t), v = -(x - l.cx) * Math.sin(l.t) + (y - l.cy) * Math.cos(l.t);
      if (Math.abs(u) > l.L / 2 + 4 * H || Math.abs(v) > 4 * H) continue;
      if (Math.abs(v) < bd) { bd = Math.abs(v); best = l; }
    }
    if (best) best.ids.push(...list);
  }
  const { src } = img;
  // the writing of one part's side turned by t, read: { R, C, PW, u0, v0, f, c, s, from, good }
  const turned = (l, t) => {
    const own = new Set(l.ids), c = Math.cos(t), s = Math.sin(t);
    // the patch, turned level, twice as fine as the working picture
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const id of l.ids) {
      const q = comps[id - 1];
      for (const [x, y] of [[q.x0, q.y0], [q.x1, q.y0], [q.x0, q.y1], [q.x1, q.y1]]) {
        const u = (x - l.cx) * c + (y - l.cy) * s, v = -(x - l.cx) * s + (y - l.cy) * c;
        u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v);
      }
    }
    const f = 2, m = 0.5 * H;
    u0 -= m; v0 -= m; u1 += m; v1 += m;
    const PW = Math.ceil((u1 - u0) * f), PH = Math.ceil((v1 - v0) * f);
    if (PW * PH > 4e6) return null;
    const ink = new Uint8Array(PW * PH), dark = new Uint8Array(PW * PH), from = new Int32Array(PW * PH);
    for (let j = 0; j < PH; j++) {
      for (let i = 0; i < PW; i++) {
        const u = u0 + (i + 0.5) / f, v = v0 + (j + 0.5) / f;
        const x = l.cx + u * c - v * s, y = l.cy + u * s + v * c;
        const X = Math.round(x), Y = Math.round(y);
        if (X < 0 || Y < 0 || X >= w || Y >= img.h) continue;
        // how dark, from the sharper source picture (all of it: where the characters stand
        // apart in it, as a decimal point blurred into the next digit may)
        const sx = Math.min(src.w - 1, Math.max(0, Math.round(x / src.k))), sy = Math.min(src.h - 1, Math.max(0, Math.round(y / src.k)));
        dark[j * PW + i] = src.d[sy * src.w + sx];
        const id = labels[Y * w + X];
        if (!own.has(id)) continue;
        ink[j * PW + i] = 1;
        from[j * PW + i] = id;
      }
    }
    const C = components(ink, PW, PH);
    const pic = { w: PW, h: PH, ink, labels: C.labels, comps: C.comps, sw: img.sw * f, src: { d: dark, w: PW, h: PH, k: 1 }, erased: null };
    const T = findText(pic, { box: [0, 0, PW - 1, PH - 1], parts: [], near: C.comps.map((q) => q.id) }, { shapes: [], usedBars: [], tilt: 0 });
    if (!T.words.length) return null;
    const R = readWords(T.words, T.height, pic, 0, { named: true });
    // how well it reads: its values with their units, read surely
    const good = R.reads.reduce((g, r) => g + (r.type === 'value' && r.unit && r.score > -2 ? 2 + r.score : 0), 0);
    return { R, C, PW, u0, v0, f, c, s, from, good };
  };
  let out = words;
  for (const l of lines) {
    if (l.ids.length < 2) continue;
    // written along the part, or across it
    const tries = [l.t, l.t > 0 ? l.t - Math.PI / 2 : l.t + Math.PI / 2].map((t) => turned(l, t)).filter(Boolean);
    if (!tries.length) continue;
    const { R, C, PW, u0, v0, f, c, s, from } = tries.reduce((a, b) => (b.good > a.good ? b : a));
    R.words.forEach((tw, k) => {
      const r = R.reads[k];
      if (!r?.type || r.type === 'caption' || r.type === 'sign' || !(r.score > -2)) return;
      // the pieces of writing it is made of, and where it lies in the picture
      const ids = new Set();
      for (const g of tw.glyphs) {
        for (const pid of g.ids) {
          const q = C.comps[pid - 1];
          for (let y = q.y0; y <= q.y1; y++) for (let x = q.x0; x <= q.x1; x++) if (C.labels[y * PW + x] === pid) ids.add(from[y * PW + x]);
        }
      }
      const pts = [[tw.x0, tw.y0], [tw.x1, tw.y0], [tw.x0, tw.y1], [tw.x1, tw.y1]].map(([i, j]) => { const u = u0 + i / f, v = v0 + j / f; return [l.cx + u * c - v * s, l.cy + u * s + v * c]; });
      const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
      // (a resistance is positive: a minus before it is half of an "=" in "y₁ = 5Ω")
      if (r.type === 'value' && r.value < 0 && (r.unit === 'Ω' || r.unit === 'S')) Object.assign(r, { value: -r.value, text: r.text.replace(/^−/, '') });
      const nw = { glyphs: [], x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys), read: { ...r, slant: true }, slant: Math.atan2(s, c) };
      nw.cx = (nw.x0 + nw.x1) / 2; nw.cy = (nw.y0 + nw.y1) / 2;
      // the level words made of the same writing: kept if one of them reads as well, as the
      // same kind of label (a value with its unit, read turned, outweighs bits of it read level
      // as other things; a name read turned, a value read level)
      const level = out.filter((x) => x.glyphs.some((g) => g.ids.some((id) => ids.has(id))));
      const kind = (q) => (q?.type === 'value' && q.unit ? 2 : q?.type && q.type !== 'sign' ? 1 : 0);
      // (beside a slanting part, writing is likelier to run along it: the turned reading is
      // given a little more weight)
      if (level.some((x) => kind(x.read) > kind(r) || (kind(x.read) === kind(r) && x.read.score >= r.score + 0.7))) return;
      // (nor does a bit of a value read level with its unit, its characters standing level,
      // replace the whole of it)
      const flat = (x) => {
        const c = x.glyphs.map((g) => [(g.x0 + g.x1) / 2, (g.y0 + g.y1) / 2]), n = c.length;
        const mx = c.reduce((t, q) => t + q[0], 0) / n, my = c.reduce((t, q) => t + q[1], 0) / n;
        const sxx = c.reduce((t, q) => t + (q[0] - mx) ** 2, 0), sxy = c.reduce((t, q) => t + (q[0] - mx) * (q[1] - my), 0);
        return n >= 2 && sxx > 0 && Math.abs(sxy / sxx) < 0.25;
      };
      if (level.some((x) => kind(x.read) === 2 && flat(x) && !x.glyphs.every((g) => g.ids.every((id) => ids.has(id))))) return;
      out = [...out.filter((x) => !level.includes(x)), nw];
    });
  }
  return out;
}
