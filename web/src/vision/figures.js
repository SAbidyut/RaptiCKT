// Which ink is a circuit: the connected pieces that carry long straight lines (wires), grouped
// into figures (a textbook page can hold several), and the rest of the ink near each figure
// (labels, signs, arrows, the loose plates of grounds and batteries).

import { components } from './image.js';
import { arrowOf } from './arrow.js';

/** Longest horizontal and vertical ink run inside each component (per component id). */
function longestRuns(ink, labels, w, h, count) {
  const hr = new Float32Array(count + 1), vr = new Float32Array(count + 1);
  for (let y = 0; y < h; y++) {
    let run = 0, id = 0;
    for (let x = 0; x <= w; x++) {
      const i = y * w + x;
      const l = x < w && ink[i] ? labels[i] : 0;
      if (l && l === id) run++;
      else { if (id && run > hr[id]) hr[id] = run; id = l; run = l ? 1 : 0; }
    }
  }
  for (let x = 0; x < w; x++) {
    let run = 0, id = 0;
    for (let y = 0; y <= h; y++) {
      const i = y * w + x;
      const l = y < h && ink[i] ? labels[i] : 0;
      if (l && l === id) run++;
      else { if (id && run > vr[id]) vr[id] = run; id = l; run = l ? 1 : 0; }
    }
  }
  return { hr, vr };
}

/**
 * Split the ink into figures. Returns { labels, comps, figures: [{ box, parts: [component ids],
 * near: [component ids of the other ink in its label area] }] }.
 */
export function findFigures(ink, w, h, sw) {
  const { labels, comps } = components(ink, w, h);
  const { hr, vr } = longestRuns(ink, labels, w, h, comps.length);
  for (const c of comps) {
    const bw = c.x1 - c.x0 + 1, bh = c.y1 - c.y0 + 1;
    c.fill = c.area / (bw * bh);
    c.hrun = hr[c.id]; c.vrun = vr[c.id];
    // a wire drawing: long straight runs, thin lines, not a solid block of ink
    c.lineArt = Math.max(c.hrun, c.vrun) >= 9 * sw && Math.max(bw, bh) >= 12 * sw && c.fill < 0.3 && c.area >= 40 * sw;
    // (but a current arrow drawn long, by hand, marks a current: it goes with the labels)
    if (c.lineArt && Math.max(bw, bh) <= 25 * sw && Math.max(bw, bh) >= 2 * Math.min(bw, bh) && arrowOf({ labels, w, sw }, { ids: [c.id], ...c })) c.lineArt = false;
  }
  // figures: line-art pieces close to each other (a capacitor's two halves, a broken wire)
  const art = comps.filter((c) => c.lineArt);
  const parent = art.map((_, k) => k);
  const find = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  const gap = 5 * sw;
  for (let i = 0; i < art.length; i++) {
    for (let j = i + 1; j < art.length; j++) {
      const a = art[i], b = art[j];
      const dx = Math.max(0, Math.max(a.x0, b.x0) - Math.min(a.x1, b.x1)), dy = Math.max(0, Math.max(a.y0, b.y0) - Math.min(a.y1, b.y1));
      if (dx <= gap && dy <= gap) parent[find(i)] = find(j);
    }
  }
  const groups = new Map();
  art.forEach((c, k) => { const r = find(k); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(c); });
  const figures = [];
  for (const g0 of groups.values()) {
    // a small piece with a long stroke standing apart from the rest of the drawing is writing (a
    // hand-written Ω on long feet), not a broken bit of wire, which ends close to where it goes on
    const sep = (a, b) => Math.max(Math.max(a.x0, b.x0) - Math.min(a.x1, b.x1), Math.max(a.y0, b.y0) - Math.min(a.y1, b.y1));
    const g = g0.filter((c) => g0.length < 2 || Math.max(c.x1 - c.x0, c.y1 - c.y0) + 1 > 20 * sw || g0.some((o) => o !== c && sep(c, o) <= 3 * sw));
    for (const c of g0) if (!g.includes(c)) c.lineArt = false;
    const box = [Math.min(...g.map((c) => c.x0)), Math.min(...g.map((c) => c.y0)), Math.max(...g.map((c) => c.x1)), Math.max(...g.map((c) => c.y1))];
    // a figure has both directions of wire and some size
    const hasH = g.some((c) => c.hrun >= 9 * sw), hasV = g.some((c) => c.vrun >= 9 * sw);
    if (!hasH || !hasV) continue;
    figures.push({ box, parts: g.map((c) => c.id) });
  }
  // a source body drawn by hand, its wires stopping just short of it: a ring beside a drawing,
  // bigger than any letter, with the drawing's ink close by (ink all round its middle at about
  // one distance, not an open curve)
  for (const c of comps) {
    if (c.lineArt) continue;
    const bw = c.x1 - c.x0 + 1, bh = c.y1 - c.y0 + 1;
    if (Math.min(bw, bh) < 12 * sw || Math.max(bw, bh) > 60 * sw || bw > 1.7 * bh || bh > 1.7 * bw || c.fill > 0.3) continue;
    const cx = (c.x0 + c.x1) / 2, cy = (c.y0 + c.y1) / 2, R = (bw + bh) / 4;
    let round = 0;
    for (let k = 0; k < 24; k++) {
      const a = (k * Math.PI) / 12;
      let far = 0;
      for (let t = 0.3 * R; t <= 1.3 * R; t += 1) {
        const x = Math.round(cx + t * Math.cos(a)), y = Math.round(cy + t * Math.sin(a));
        if (x >= 0 && y >= 0 && x < w && y < h && labels[y * w + x] === c.id) far = t;
      }
      if (far >= 0.75 * R && far <= 1.25 * R) round++;
    }
    if (round < 21) continue;
    const m = Math.round(3 * sw);
    const f = figures.find((g) => {
      const own = new Set(g.parts);
      for (let y = Math.max(0, c.y0 - m); y <= Math.min(h - 1, c.y1 + m); y++) for (let x = Math.max(0, c.x0 - m); x <= Math.min(w - 1, c.x1 + m); x++) if (own.has(labels[y * w + x])) return true;
      return false;
    });
    if (!f) continue;
    f.parts.push(c.id);
    c.lineArt = true;
    f.box = [Math.min(f.box[0], c.x0), Math.min(f.box[1], c.y0), Math.max(f.box[2], c.x1), Math.max(f.box[3], c.y1)];
  }
  // the other ink near each figure: within a margin of its box, and nearer to it than to any other
  const margin = (f) => Math.max(26 * sw, 0.3 * Math.min(f.box[2] - f.box[0], f.box[3] - f.box[1]));
  for (const f of figures) f.near = [];
  const taken = new Uint8Array(comps.length + 1);
  for (const c of comps) {
    if (c.lineArt) continue;
    const cx = (c.x0 + c.x1) / 2, cy = (c.y0 + c.y1) / 2;
    let best = null, bd = Infinity;
    for (const f of figures) {
      const m = margin(f), [x0, y0, x1, y1] = f.box;
      const dx = Math.max(0, x0 - cx, cx - x1), dy = Math.max(0, y0 - cy, cy - y1);
      if (dx > m || dy > m) continue;
      const d = Math.hypot(dx, dy);
      if (d < bd) { bd = d; best = f; }
    }
    if (best) { best.near.push(c.id); taken[c.id] = 1; }
  }
  // and the rest of a word written past that margin (a label written large, by hand): characters
  // on the line of one already in, right beside it (a few at most: not a line of the page's text)
  const loose = comps.filter((c) => !c.lineArt && !taken[c.id] && c.area >= 2 * sw * sw);
  for (let round = 0; round < 3; round++) {
    for (const f of figures) {
      const add = [];
      for (const c of loose) {
        if (taken[c.id]) continue;
        const ch = c.y1 - c.y0 + 1;
        const by = f.near.some((id) => {
          const d = comps[id - 1], dh = d.y1 - d.y0 + 1;
          if (ch > 3 * dh || dh > 3 * ch || Math.max(ch, dh) < 2 * sw) return false;
          const gap = Math.max(c.x0, d.x0) - Math.min(c.x1, d.x1), ov = Math.min(c.y1, d.y1) - Math.max(c.y0, d.y0) + 1;
          return gap <= 0.8 * Math.max(ch, dh) && ov >= 0.5 * Math.min(ch, dh);
        });
        if (by) add.push(c);
      }
      for (const c of add) { f.near.push(c.id); taken[c.id] = 1; }
    }
  }
  return { labels, comps, figures };
}
