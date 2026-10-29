// Raster basics for reading a circuit picture on the phone, with no network: ink from a photo
// or a screenshot, at a scale where lines are about 3–4 px thick, and its connected pieces.
// Plain typed arrays only, so the same code runs on canvas ImageData in the app and in Node.

/**
 * How dark each pixel is (0 = white paper, 255 = black ink). Coloured lines count a little
 * darker than their brightness alone, while light colour fills (a yellow source) stay paper.
 */
export function darkness({ width: w, height: h, data }) {
  const d = new Uint8Array(w * h);
  for (let i = 0, j = 0; i < d.length; i++, j += 4) {
    const a = data[j + 3] / 255;
    // a transparent pixel is white paper
    const r = data[j] * a + 255 * (1 - a), g = data[j + 1] * a + 255 * (1 - a), b = data[j + 2] * a + 255 * (1 - a);
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    const sat = Math.max(r, g, b) - Math.min(r, g, b);
    d[i] = Math.min(255, Math.max(0, Math.round(255 - y + 0.2 * sat)));
  }
  return d;
}

/** Resample a one-channel image to W × H: box average when shrinking, bilinear when enlarging. */
export function resample(src, w, h, W, H) {
  const out = new Uint8Array(W * H);
  if (W <= w && H <= h) {
    const fx = w / W, fy = h / H;
    const row = new Float32Array(W);
    for (let Y = 0; Y < H; Y++) {
      const y0 = Y * fy, y1 = (Y + 1) * fy;
      row.fill(0);
      let wy = 0;
      for (let y = Math.floor(y0); y < Math.min(h, Math.ceil(y1)); y++) {
        const ky = Math.min(y + 1, y1) - Math.max(y, y0);
        if (ky <= 0) continue;
        wy += ky;
        const base = y * w;
        for (let X = 0; X < W; X++) {
          const x0 = X * fx, x1 = (X + 1) * fx;
          let s = 0, wx = 0;
          for (let x = Math.floor(x0); x < Math.min(w, Math.ceil(x1)); x++) {
            const kx = Math.min(x + 1, x1) - Math.max(x, x0);
            if (kx > 0) { s += src[base + x] * kx; wx += kx; }
          }
          row[X] += (s / (wx || 1)) * ky;
        }
      }
      for (let X = 0; X < W; X++) out[Y * W + X] = Math.round(row[X] / (wy || 1));
    }
    return out;
  }
  for (let Y = 0; Y < H; Y++) {
    const sy = Math.min(h - 1, Math.max(0, (Y + 0.5) * h / H - 0.5)), y0 = Math.floor(sy), y1 = Math.min(h - 1, y0 + 1), ty = sy - y0;
    for (let X = 0; X < W; X++) {
      const sx = Math.min(w - 1, Math.max(0, (X + 0.5) * w / W - 0.5)), x0 = Math.floor(sx), x1 = Math.min(w - 1, x0 + 1), tx = sx - x0;
      const a = src[y0 * w + x0] * (1 - tx) + src[y0 * w + x1] * tx;
      const b = src[y1 * w + x0] * (1 - tx) + src[y1 * w + x1] * tx;
      out[Y * W + X] = Math.round(a * (1 - ty) + b * ty);
    }
  }
  return out;
}

/**
 * The paper's own darkness under each pixel (shadows, a grey page): a low percentile of every
 * block, smoothed over the neighbouring blocks and interpolated in between.
 */
export function paperLevel(d, w, h, block) {
  const bw = Math.max(1, Math.ceil(w / block)), bh = Math.max(1, Math.ceil(h / block));
  const lv = new Float32Array(bw * bh);
  const hist = new Uint32Array(256);
  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      hist.fill(0);
      let n = 0;
      for (let y = by * block; y < Math.min(h, (by + 1) * block); y++) {
        for (let x = bx * block; x < Math.min(w, (bx + 1) * block); x++) { hist[d[y * w + x]]++; n++; }
      }
      // most of any block is paper: its 30th percentile is the paper, not the ink
      let k = 0, acc = 0;
      const want = n * 0.3;
      while (k < 255 && acc + hist[k] < want) acc += hist[k++];
      lv[by * bw + bx] = k;
    }
  }
  // a block full of ink (a heading bar, a big black symbol) must not read as paper: take the
  // lower median of each block's 3 × 3 neighbourhood
  const sm = new Float32Array(bw * bh);
  const nb = [];
  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      nb.length = 0;
      for (let y = Math.max(0, by - 1); y <= Math.min(bh - 1, by + 1); y++) for (let x = Math.max(0, bx - 1); x <= Math.min(bw - 1, bx + 1); x++) nb.push(lv[y * bw + x]);
      nb.sort((a, b) => a - b);
      sm[by * bw + bx] = nb[Math.floor((nb.length - 1) / 2)];
    }
  }
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const fy = Math.min(bh - 1, Math.max(0, (y + 0.5) / block - 0.5)), y0 = Math.floor(fy), y1 = Math.min(bh - 1, y0 + 1), ty = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = Math.min(bw - 1, Math.max(0, (x + 0.5) / block - 0.5)), x0 = Math.floor(fx), x1 = Math.min(bw - 1, x0 + 1), tx = fx - x0;
      const a = sm[y0 * bw + x0] * (1 - tx) + sm[y0 * bw + x1] * tx;
      const b = sm[y1 * bw + x0] * (1 - tx) + sm[y1 * bw + x1] * tx;
      out[y * w + x] = Math.round(a * (1 - ty) + b * ty);
    }
  }
  return out;
}

/** Otsu's threshold of a 256-bin histogram. */
export function otsu(hist) {
  let total = 0, sum = 0;
  for (let i = 0; i < 256; i++) { total += hist[i]; sum += i * hist[i]; }
  let wB = 0, sB = 0, best = 0, t = 0;
  for (let i = 0; i < 256; i++) {
    wB += hist[i];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sB += i * hist[i];
    const mB = sB / wB, mF = (sum - sB) / wF, v = wB * wF * (mB - mF) * (mB - mF);
    if (v > best) { best = v; t = i; }
  }
  return t;
}

/**
 * Ink mask from a darkness image: darkness above the local paper, thresholded with hysteresis
 * (faint parts of a line are kept when they touch a clearly dark part).
 * Returns { ink (0/1), contrast, threshold }.
 */
export function inkMask(d, w, h, block) {
  const bg = paperLevel(d, w, h, block);
  const c = new Uint8Array(w * h);
  const hist = new Uint32Array(256);
  for (let i = 0; i < c.length; i++) { const v = Math.max(0, d[i] - bg[i]); c[i] = v; hist[v]++; }
  // Otsu over the pixels that differ from the paper at all; never so low that paper grain counts
  for (let i = 0; i < 12; i++) hist[i] = 0;
  const hi = Math.max(40, otsu(hist));
  const lo = Math.max(28, Math.round(hi * 0.55));
  const weak = new Uint8Array(w * h);
  for (let i = 0; i < c.length; i++) weak[i] = c[i] >= lo ? 1 : 0;
  const { labels, comps } = components(weak, w, h);
  const keep = new Uint8Array(comps.length + 1);
  for (let i = 0; i < c.length; i++) if (c[i] >= hi && labels[i]) keep[labels[i]] = 1;
  const ink = new Uint8Array(w * h);
  for (let i = 0; i < c.length; i++) if (labels[i] && keep[labels[i]]) ink[i] = 1;
  return { ink, contrast: c, threshold: hi };
}

/**
 * 8-connected components of a 0/1 mask. labels: Int32Array (0 = background, k = component k);
 * comps[k-1] = { id: k, area, x0, y0, x1, y1 } (inclusive box).
 */
export function components(mask, w, h) {
  const labels = new Int32Array(w * h);
  const parent = [0];
  const find = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  const union = (a, b) => { a = find(a); b = find(b); if (a !== b) { if (a < b) parent[b] = a; else parent[a] = b; } };
  let next = 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!mask[i]) continue;
      let l = 0;
      // already-visited neighbours: W, NW, N, NE
      const nbs = [x > 0 ? labels[i - 1] : 0, x > 0 && y > 0 ? labels[i - w - 1] : 0, y > 0 ? labels[i - w] : 0, x < w - 1 && y > 0 ? labels[i - w + 1] : 0];
      for (const n of nbs) {
        if (!n) continue;
        if (!l) l = n; else if (n !== l) union(l, n);
      }
      if (!l) { l = next++; parent.push(l); }
      labels[i] = l;
    }
  }
  const map = new Int32Array(next);
  let count = 0;
  for (let k = 1; k < next; k++) { const r = find(k); if (!map[r]) map[r] = ++count; map[k] = map[r]; }
  const comps = [];
  for (let k = 0; k < count; k++) comps.push({ id: k + 1, area: 0, x0: w, y0: h, x1: -1, y1: -1 });
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!labels[i]) continue;
      const k = map[labels[i]];
      labels[i] = k;
      const c = comps[k - 1];
      c.area++;
      if (x < c.x0) c.x0 = x; if (x > c.x1) c.x1 = x;
      if (y < c.y0) c.y0 = y; if (y > c.y1) c.y1 = y;
    }
  }
  return { labels, comps };
}

/**
 * Fill the pinholes of a 0/1 mask in place: bits of paper of at most maxArea pixels shut in by
 * ink (where two pen strokes cross or overlap, a fleck of glare on a thick line). Thinned, each
 * would be a little loop in the line.
 */
export function fillPinholes(mask, w, h, maxArea) {
  const seen = new Uint8Array(w * h);
  const stack = [], piece = [];
  for (let i = 0; i < w * h; i++) {
    if (mask[i] || seen[i]) continue;
    piece.length = 0;
    let open = false;
    seen[i] = 1;
    stack.push(i);
    while (stack.length) {
      const j = stack.pop();
      piece.push(j);
      const x = j % w, y = (j - x) / w;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) open = true;
      for (const k of [x > 0 ? j - 1 : -1, x < w - 1 ? j + 1 : -1, y > 0 ? j - w : -1, y < h - 1 ? j + w : -1]) {
        if (k >= 0 && !mask[k] && !seen[k]) { seen[k] = 1; stack.push(k); }
      }
    }
    if (!open && piece.length <= maxArea) for (const j of piece) mask[j] = 1;
  }
}

/**
 * Typical line thickness of the big line-drawing pieces (paper grain and small print left out):
 * every ink pixel's shorter run (across or down) is the width of the stroke it is in; the median
 * of those is the line width. Ragged JPEG edges do not move it, and it follows the picture's
 * size exactly.
 */
export function strokeWidth(ink, w, h) {
  return strokeInfo(ink, w, h).sw;
}

/**
 * The stroke width and whether it was taken from the thin lines among thick ink (mixed): only
 * with `contrast` (the ink mask's), and not when `mixed` is false.
 */
function strokeInfo(ink, w, h, { mixed = true, contrast = null } = {}) {
  const { labels, comps } = components(ink, w, h);
  const big = Math.max(20, 0.04 * Math.max(w, h));
  const use = new Uint8Array(comps.length + 1);
  let any = false;
  for (const c of comps) {
    const bw = c.x1 - c.x0 + 1, bh = c.y1 - c.y0 + 1;
    if (Math.max(bw, bh) >= big && c.area < 0.35 * bw * bh) { use[c.id] = 1; any = true; }
  }
  if (!any) for (const c of comps) if (c.area >= 20) use[c.id] = 1;
  const hr = new Uint16Array(w * h), vr = new Uint16Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w;) {
      if (!ink[y * w + x]) { x++; continue; }
      let e = x;
      while (e < w && ink[y * w + e]) e++;
      for (let k = x; k < e; k++) hr[y * w + k] = Math.min(65535, e - x);
      x = e;
    }
  }
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h;) {
      if (!ink[y * w + x]) { y++; continue; }
      let e = y;
      while (e < h && ink[e * w + x]) e++;
      for (let k = y; k < e; k++) vr[k * w + x] = Math.min(65535, e - y);
      y = e;
    }
  }
  // (a block filled solid within a piece, as a book's heading tab on its rule, is no stroke: a
  // run across half the piece's narrow side or more is left out, where such runs are much of
  // the piece)
  const thin = new Float32Array(comps.length + 1);
  for (const c of comps) thin[c.id] = 0.5 * Math.min(c.x1 - c.x0 + 1, c.y1 - c.y0 + 1);
  const thick = new Uint32Array(comps.length + 1);
  for (let i = 0; i < w * h; i++) if (ink[i] && use[labels[i]] && Math.min(hr[i], vr[i]) > thin[labels[i]]) thick[labels[i]]++;
  for (const c of comps) if (thick[c.id] < 0.15 * c.area) thin[c.id] = Infinity;
  const hist = new Uint32Array(256);
  let tot = 0;
  for (let pass = 0; pass < 2 && !tot; pass++) {
    for (let i = 0; i < w * h; i++) {
      if (!ink[i] || !use[labels[i]]) continue;
      const r = Math.min(hr[i], vr[i]);
      if (!pass && r > thin[labels[i]]) continue;
      hist[Math.min(255, r)]++;
      tot++;
    }
  }
  if (!tot) return { sw: 1, mixed: false };
  // the median, read between whole pixels
  const median = (H, n) => {
    let t = 0;
    for (let r = 0; r < n; r++) t += H[r];
    let acc = 0, k = 0;
    while (k < n - 1 && acc + H[k] < t / 2) acc += H[k++];
    return Math.max(1, k - 0.5 + (t / 2 - acc) / Math.max(1e-9, H[k]));
  };
  const all = median(hist, 256);
  // thin lines with thick ink among them (a book's bus bars, the leads of a meter drawn by them):
  // by the length of line, not the ink in it, the thin ones are most of the drawing — then they
  // are its lines
  const along = Float64Array.from(hist, (v, r) => (r ? v / r : 0));
  const fine = median(along, 256);
  if (mixed && contrast && all > 2.2 * fine) {
    // (as dark as the thick ink: a page's faint printed lines or the paper's grain are thin
    // too, and no drawing's)
    const cut = 2.5 * fine, ct = new Uint32Array(256), ck = new Uint32Array(256);
    for (let i = 0; i < w * h; i++) {
      if (!ink[i] || !use[labels[i]]) continue;
      const r = Math.min(hr[i], vr[i]);
      if (r > thin[labels[i]]) continue;
      (r <= cut ? ct : ck)[contrast[i]]++;
    }
    if (median(ct, 256) >= 0.95 * median(ck, 256)) return { sw: median(hist, Math.min(256, Math.floor(cut) + 1)), mixed: true };
  }
  return { sw: all, mixed: false };
}

/**
 * Erase the printed lines of ruled or squared paper from an ink mask, in place: straight lines
 * near level or upright across most of the picture, three or more evenly spaced (a circuit's own
 * wires turn at their ends and are not a ruled family). A pen stroke crossing a line stays, and
 * where the pen is clearly darker than the lines, a wire drawn along one stays too. Returns how
 * many it erased.
 */
export function eraseRules(ink, contrast, w, h) {
  const n = eraseLevelRules(ink, contrast, w, h);
  const T = (a) => { const t = new Uint8Array(w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) t[x * h + y] = a[y * w + x]; return t; };
  const ti = T(ink), m = eraseLevelRules(ti, T(contrast), h, w);
  if (m) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) ink[y * w + x] = ti[x * h + y];
  return n + m;
}

function eraseLevelRules(ink, contrast, w, h) {
  // a Hough over small slopes (a page photographed a little turned, its lines a little apart)
  const NS = 81, off = Math.ceil(0.1 * w) + 2, n = h + 2 * off;
  const acc = new Uint32Array(NS * n);
  const slope = (k) => -0.1 + (0.2 * k) / (NS - 1);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!ink[y * w + x]) continue;
      for (let k = 0; k < NS; k++) acc[k * n + Math.round(y - slope(k) * x) + off]++;
    }
  }
  const peaks = [];
  for (let k = 0; k < NS; k++) {
    for (let c = 1; c < n - 1; c++) {
      const v = acc[k * n + c] + Math.max(acc[k * n + c - 1], acc[k * n + c + 1]);
      if (v >= 0.4 * w && acc[k * n + c] >= acc[k * n + c - 1] && acc[k * n + c] >= acc[k * n + c + 1]) peaks.push({ s: slope(k), c: c - off, v });
    }
  }
  peaks.sort((a, b) => b.v - a.v);
  const mid = (q) => q.c + q.s * w / 2;
  // the vertical ink run through (x, y)
  const runAt = (x, y) => { let a = y, b = y; while (a > 0 && ink[(a - 1) * w + x]) a--; while (b < h - 1 && ink[(b + 1) * w + x]) b++; return [a, b]; };
  // a line: thin runs on it across most of the width that no stronger line has taken already
  const claimed = new Uint8Array(w * h);
  const lines = [];
  for (const q of peaks) {
    if (lines.length > 60) break;
    let cover = 0;
    const runs = [];
    for (let x = 0; x < w; x++) {
      const yp = Math.round(q.c + q.s * x);
      for (let d = 0; d <= 3; d = d > 0 ? -d : 1 - d) {
        const y = yp + d;
        if (y < 0 || y >= h || !ink[y * w + x] || claimed[y * w + x]) continue;
        const [a, b] = runAt(x, y);
        if (b - a + 1 <= 9) { cover++; runs.push(b - a + 1); }
        break;
      }
    }
    if (cover < 0.45 * w) continue;
    runs.sort((p1, p2) => p1 - p2);
    const line = { ...q, thick: runs[Math.floor(runs.length * 0.75)], cover: cover / w };
    lines.push(line);
    for (let x = 0; x < w; x++) for (let d = -3; d <= 3; d++) { const y = Math.round(q.c + q.s * x) + d; if (y >= 0 && y < h) claimed[y * w + x] = 1; }
  }
  if (lines.length < 3) return 0;
  // the evenly spaced family: gaps one (or two, a line lost) times their usual gap
  lines.sort((a, b) => mid(a) - mid(b));
  const gaps = lines.slice(1).map((q, k) => mid(q) - mid(lines[k])).sort((a, b) => a - b);
  const g = gaps[gaps.length >> 1];
  const even = (d) => [1, 2].some((m) => Math.abs(d - m * g) <= 0.2 * g);
  const fam = lines.filter((q, k) => (k > 0 && even(mid(q) - mid(lines[k - 1]))) || (k < lines.length - 1 && even(mid(lines[k + 1]) - mid(q))));
  // (and printed: at least two of them right across the page, not just across a drawing)
  if (fam.length < 3 || fam.filter((q) => q.cover >= 0.7).length < 2) return 0;
  // (a few long wires of a circuit cut out close round it, evenly spaced as a textbook draws
  // them, end at its corners short of the picture's edges; a page's lines run off them)
  const reach = (q) => {
    let x0 = -1, x1 = -1;
    for (let x = 0; x < w; x++) {
      const yp = Math.round(q.c + q.s * x);
      for (let d = -3; d <= 3; d++) { const y = yp + d; if (y >= 0 && y < h && ink[y * w + x]) { if (x0 < 0) x0 = x; x1 = x; break; } }
    }
    return x0 >= 0 && x0 <= 0.03 * w && x1 >= 0.97 * w;
  };
  // (and a circuit's wires are as dark as the rest of its ink; a page's lines are fainter than
  // what is written on it)
  const near = new Uint8Array(w * h);
  for (const q of fam) for (let x = 0; x < w; x++) for (let d = -3; d <= 3; d++) { const y = Math.round(q.c + q.s * x) + d; if (y >= 0 && y < h) near[y * w + x] = 1; }
  const cf = new Uint32Array(256), co = new Uint32Array(256);
  for (let i = 0; i < w * h; i++) if (ink[i]) (near[i] ? cf : co)[contrast[i]]++;
  const med = (H) => { let t = 0; for (const v of H) t += v; let a = 0, k = 0; while (k < 255 && a + H[k] < t / 2) a += H[k++]; return t ? k : 0; };
  if (fam.length <= 4 && !fam.some(reach) && med(cf) >= 0.85 * med(co)) return 0;
  // each line along its course (a page bends a little: follow it): per column its own thin run
  // and how dark it is (a run thicker than a line is a stroke across it, and stays)
  const prof = fam.map((q) => {
    let drift = 0;
    const at = new Array(w).fill(null);
    for (let x = 0; x < w; x++) {
      const yp = q.c + q.s * x + drift;
      let best = -1, bd = Infinity;
      for (let y = Math.max(0, Math.round(yp - 3)); y <= Math.min(h - 1, Math.round(yp + 3)); y++) if (ink[y * w + x] && Math.abs(y - yp) < bd) { bd = Math.abs(y - yp); best = y; }
      if (best < 0) continue;
      const [a, b] = runAt(x, best);
      if (b - a + 1 > q.thick + 1) continue;
      drift = Math.max(-4, Math.min(4, drift + 0.3 * ((a + b) / 2 - yp)));
      let c = 0;
      for (let y = a; y <= b; y++) c = Math.max(c, contrast[y * w + x]);
      at[x] = { a, b, c };
    }
    return at;
  });
  // how dark each line is around each point (light and focus change across a page)
  const sm = prof.map((at, i) => {
    const R = Math.max(4, 3 * fam[i].thick), sum = new Float64Array(w + 1), cnt = new Uint32Array(w + 1);
    for (let x = 0; x < w; x++) { sum[x + 1] = sum[x] + (at[x] ? at[x].c : 0); cnt[x + 1] = cnt[x] + (at[x] ? 1 : 0); }
    const out = new Float32Array(w).fill(NaN);
    for (let x = 0; x < w; x++) {
      const a = Math.max(0, x - R), b = Math.min(w, x + R + 1), n = cnt[b] - cnt[a];
      if (n >= R) out[x] = (sum[b] - sum[a]) / n;
    }
    return out;
  });
  // erase the bare lines; a pen drawn along one (a wire on squared paper) is darker there than
  // the lines beside it, and stays
  fam.forEach((q, i) => {
    const nb = [i - 2, i - 1, i + 1, i + 2].filter((j) => j >= 0 && j < fam.length);
    for (let x = 0; x < w; x++) {
      const r = prof[i][x];
      if (!r) continue;
      const refs = nb.map((j) => sm[j][x]).filter((v) => v === v).sort((p1, p2) => p1 - p2);
      const ref = refs.length ? refs[refs.length >> 1] : 0;
      if (ref && sm[i][x] >= 1.3 * ref) continue;
      // (and a pen stroke much darker than the line keeps its own pixels: a letter's bar on it)
      for (let y = r.a; y <= r.b; y++) if (!ref || contrast[y * w + x] < 1.6 * ref) ink[y * w + x] = 0;
    }
  });
  return fam.length;
}

/**
 * How far a line drawing is turned (radians, within ±30°; positive: its level lines run down to
 * the right): the turn that lines its ink up best with rows and columns.
 */
export function skewOf(ink, w, h) {
  let n = 0;
  for (let i = 0; i < w * h; i++) n += ink[i];
  const every = Math.max(1, Math.round(n / 60000)), pts = [];
  for (let i = 0, c = 0; i < w * h; i++) if (ink[i] && c++ % every === 0) pts.push(i % w - w / 2, Math.floor(i / w) - h / 2);
  const D = Math.ceil(Math.hypot(w, h) / 2) + 2, hr = new Float64Array(2 * D + 1), hc = new Float64Array(2 * D + 1);
  // ink piled up in few rows and columns: lines along them
  const score = (deg) => {
    const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
    hr.fill(0); hc.fill(0);
    for (let k = 0; k < pts.length; k += 2) { const x = pts[k], y = pts[k + 1]; hr[Math.round(y * c - x * s) + D]++; hc[Math.round(x * c + y * s) + D]++; }
    let t = 0;
    for (let i = 0; i < hr.length; i++) t += hr[i] * hr[i] + hc[i] * hc[i];
    return t;
  };
  let best = 0, bs = -1;
  for (let deg = -30; deg <= 30; deg++) { const v = score(deg); if (v > bs) { bs = v; best = deg; } }
  let fine = best;
  for (let deg = best - 0.9; deg <= best + 0.95; deg += 0.1) { const v = score(deg); if (v > bs) { bs = v; fine = deg; } }
  return (fine * Math.PI) / 180;
}

/**
 * A one-channel image turned back by a (radians, as skewOf gives it) about its middle, on a
 * canvas that holds all of it; what lies beyond the picture's edge repeats its edge.
 */
export function unturn(src, w, h, a) {
  const c = Math.cos(a), s = Math.sin(a);
  const W = Math.ceil(Math.abs(w * c) + Math.abs(h * s)), H = Math.ceil(Math.abs(w * s) + Math.abs(h * c));
  const out = new Uint8Array(W * H);
  for (let Y = 0; Y < H; Y++) {
    for (let X = 0; X < W; X++) {
      const dx = X - W / 2, dy = Y - H / 2;
      const x = Math.min(w - 1.001, Math.max(0, c * dx - s * dy + w / 2)), y = Math.min(h - 1.001, Math.max(0, s * dx + c * dy + h / 2));
      const x0 = Math.floor(x), y0 = Math.floor(y), tx = x - x0, ty = y - y0, i = y0 * w + x0;
      out[Y * W + X] = Math.round((src[i] * (1 - tx) + src[i + 1] * tx) * (1 - ty) + (src[i + w] * (1 - tx) + src[i + w + 1] * tx) * ty);
    }
  }
  return { d: out, w: W, h: H };
}

/**
 * From a picture to ink at a working scale where strokes are about `target` px thick.
 * Returns { w, h, scale (working px per source px), turned (null, or how the picture was
 * straightened: { a, w, h, W, H }, the turn and its size before and after, shrunk to at most
 * 2600 px a side), ink, erased (null, or the ruled paper's lines taken out of the ink), dark (the
 * resampled darkness), sw }.
 */
export function prepare(img, { target = 4.5, maxSide = 3200 } = {}) {
  let w = img.width, h = img.height;
  let d = darkness(img);
  let pre = 1;
  if (Math.max(w, h) > 2600) {
    pre = 2600 / Math.max(w, h);
    const W = Math.round(w * pre), H = Math.round(h * pre);
    d = resample(d, w, h, W, H); w = W; h = H;
  }
  let first = inkMask(d, w, h, Math.max(16, Math.round(Math.max(w, h) / 60)));
  // a photo taken well turned: straighten it, so the wires run level and upright (a few degrees
  // the reading takes in its stride, sharper for not being resampled)
  const turn = skewOf(first.ink, w, h);
  let turned = null;
  if (Math.abs(turn) > (6 * Math.PI) / 180) {
    const r = unturn(d, w, h, turn);
    turned = { a: turn, w, h, W: r.w, H: r.h };
    d = r.d; w = r.w; h = r.h;
    first = inkMask(d, w, h, Math.max(16, Math.round(Math.max(w, h) / 60)));
  }
  // a page of ruled paper: its lines are not the drawing's (nor is their width its line width)
  const before = first.ink.slice();
  const ruled = eraseRules(first.ink, first.contrast, w, h);
  // (on ruled paper, what is left of its lines is thin: no drawing's lines)
  const first0 = strokeInfo(first.ink, w, h, { mixed: !ruled, contrast: first.contrast }), sw0 = first0.sw;
  let k = Math.min(3, Math.max(0.15, target / Math.max(0.8, sw0)));
  if (Math.max(w, h) * k > maxSide) k = maxSide / Math.max(w, h);
  if (Math.abs(k - 1) < 0.12) k = 1;
  const W = Math.round(w * k), H = Math.round(h * k);
  const dd = k === 1 ? d : resample(d, w, h, W, H);
  const { ink, contrast } = k === 1 ? first : inkMask(dd, W, H, Math.max(16, Math.round(Math.max(W, H) / 60)));
  // (what was erased: the rest of a line crossing a label is no part of its characters)
  let erased = null;
  if (ruled) {
    const was = k === 1 ? before : ink.slice();
    if (k !== 1) eraseRules(ink, contrast, W, H);
    erased = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) erased[i] = was[i] && !ink[i] ? 1 : 0;
  }
  // (measured again at the new size the same way: the bits of a page's lines left after they
  // are erased are no thin lines of the drawing's)
  const sw = strokeInfo(ink, W, H, { mixed: first0.mixed, contrast }).sw;
  // the sharper of the two images for reading text: the source (when the working image is a
  // reduction of it) or the working image itself
  const src = k < 1 ? { d, w, h, k } : { d: dd, w: W, h: H, k: 1 };
  return { w: W, h: H, scale: pre * k, turned, ink, erased, dark: dd, contrast, sw, src };
}
