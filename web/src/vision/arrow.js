// Which way an arrow points, from the width of its ink along its length: the head is the wide
// part; the shaft is the long narrow part on one side of it, so the tip is on the other side.

/**
 * width: ink width at each step along the arrow (index 0 → the far end). Returns +1 when the tip
 * is at the far end, -1 when at index 0, 0 when it cannot tell (no head, or a bar).
 */
export function arrowTip(width, sw) {
  const L = width.length;
  const nz = [...width].filter((v) => v > 0).sort((a, b) => a - b);
  if (nz.length < 4) return 0;
  const shaft = Math.max(1, nz[nz.length >> 2]);
  let max = 0;
  for (const v of width) max = Math.max(max, v);
  if (max < Math.max(1.6 * shaft, shaft + 1.1 * sw)) return 0;
  // the head: the longest run of wide steps
  const wide = (v) => v > shaft + 0.4 * (max - shaft);
  let best = null;
  for (let t = 0; t < L;) {
    if (!wide(width[t])) { t++; continue; }
    let e = t;
    while (e + 1 < L && (wide(width[e + 1]) || (e + 2 < L && wide(width[e + 2])))) e++;
    if (!best || e - t > best[1] - best[0]) best = [t, e];
    t = e + 1;
  }
  // the shaft: the side with the longer narrow stretch
  const narrow = (v) => v > 0 && v <= shaft + 0.25 * (max - shaft);
  let lo = 0, hi = 0;
  for (let t = 0; t < best[0]; t++) if (narrow(width[t])) lo++;
  for (let t = best[1] + 1; t < L; t++) if (narrow(width[t])) hi++;
  if (Math.abs(hi - lo) < 2) return 0;
  return hi > lo ? -1 : 1;
}

/**
 * A current arrow drawn on its own (shaft with a head at one end, the head spread to both sides
 * of the shaft), or null. img: { labels, w, sw }; g: { ids, x0, y0, x1, y1 }, its pieces.
 */
export function arrowOf(img, g) {
  const { labels, w, sw } = img;
  const own = new Set(g.ids);
  const horiz = g.x1 - g.x0 >= g.y1 - g.y0;
  const L = horiz ? g.x1 - g.x0 + 1 : g.y1 - g.y0 + 1;
  // the ink across the arrow, all along it: its two edges and width
  const lo = new Float32Array(L), hi = new Float32Array(L), width = new Float32Array(L);
  for (let t = 0; t < L; t++) {
    let a = Infinity, b = -Infinity;
    const n = horiz ? g.y1 - g.y0 + 1 : g.x1 - g.x0 + 1;
    for (let q = 0; q < n; q++) {
      const x = horiz ? g.x0 + t : g.x0 + q, y = horiz ? g.y0 + q : g.y0 + t;
      if (own.has(labels[y * w + x])) { a = Math.min(a, q); b = Math.max(b, q); }
    }
    lo[t] = a; hi[t] = b;
    width[t] = b >= a ? b - a + 1 : 0;
  }
  const sorted = [...width].sort((x, y) => x - y);
  const shaft = Math.max(1, sorted[sorted.length >> 1]);
  const thin = [];
  for (let t = 0; t < L; t++) if (width[t] > 0 && width[t] <= 1.5 * shaft) thin.push(t);
  if (thin.length < 0.35 * L) return null; // no shaft
  const tip = arrowTip(width, sw);
  if (!tip) return null; // no head: a plain bar
  const toEnd = tip > 0;
  // its tail is thin (an I with serifs, or a 1 with its foot, has a bar at either end)
  const n = Math.max(2, Math.round(0.15 * L));
  for (let k = 0; k < n; k++) if (width[toEnd ? k : L - 1 - k] > 1.5 * shaft) return null;
  // the shaft: one straight line along the tail's half
  const tail = thin.filter((t) => (toEnd ? t < L / 2 : t >= L / 2));
  if (tail.length < 0.2 * L) return null;
  let st = 0, sc = 0, stt = 0, stc = 0;
  for (const t of tail) { const c = (lo[t] + hi[t]) / 2; st += t; sc += c; stt += t * t; stc += t * c; }
  const m = tail.length, den = m * stt - st * st;
  const slope = den ? (m * stc - st * sc) / den : 0, mid = (t) => (sc - slope * st) / m + slope * t;
  if (tail.some((t) => Math.abs((lo[t] + hi[t]) / 2 - mid(t)) > Math.max(2, 0.8 * sw))) return null;
  // the head reaches out on both sides of that line, however slanted (a 1's flag, or a hook, on
  // one side only) and narrows to a point on it (the far edge of a 3 standing on a stroke is two
  // ends of its arcs, off to one side)
  let left = 0, right = 0;
  for (let t = 0; t < L; t++) if (width[t] > 1.5 * shaft) { left = Math.max(left, mid(t) - lo[t]); right = Math.max(right, hi[t] - mid(t)); }
  if (Math.min(left, right) < 0.35 * Math.max(left, right)) return null;
  const head = 2 * Math.max(left, right);
  for (let k = 0; k < Math.max(2, Math.round(0.05 * L)); k++) {
    const t = toEnd ? L - 1 - k : k;
    if (width[t] && (width[t] > 0.5 * head || Math.abs((lo[t] + hi[t]) / 2 - mid(t)) > 0.3 * head)) return null;
  }
  return {
    x0: g.x0, y0: g.y0, x1: g.x1, y1: g.y1, cx: (g.x0 + g.x1) / 2, cy: (g.y0 + g.y1) / 2,
    dir: horiz ? [toEnd ? 1 : -1, 0] : [0, toEnd ? 1 : -1], ids: g.ids,
  };
}
