// Which ink is a circuit: the connected pieces that carry long straight lines (wires), grouped
// into figures (a textbook page can hold several), and the rest of the ink near each figure
// (labels, signs, arrows, the loose plates of grounds and batteries).

import { components } from './image.js';

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
  for (const g of groups.values()) {
    const box = [Math.min(...g.map((c) => c.x0)), Math.min(...g.map((c) => c.y0)), Math.max(...g.map((c) => c.x1)), Math.max(...g.map((c) => c.y1))];
    // a figure has both directions of wire and some size
    const hasH = g.some((c) => c.hrun >= 9 * sw), hasV = g.some((c) => c.vrun >= 9 * sw);
    if (!hasH || !hasV) continue;
    figures.push({ box, parts: g.map((c) => c.id) });
  }
  // the other ink near each figure: within a margin of its box, and nearer to it than to any other
  const margin = (f) => Math.max(26 * sw, 0.3 * Math.min(f.box[2] - f.box[0], f.box[3] - f.box[1]));
  for (const f of figures) f.near = [];
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
    if (best) best.near.push(c.id);
  }
  return { labels, comps, figures };
}
