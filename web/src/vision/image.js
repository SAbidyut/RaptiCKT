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
 * Typical line thickness of the big line-drawing pieces (paper grain and small print left out):
 * every ink pixel's shorter run (across or down) is the width of the stroke it is in; the median
 * of those is the line width. Ragged JPEG edges do not move it, and it follows the picture's
 * size exactly.
 */
export function strokeWidth(ink, w, h) {
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
  const hist = new Uint32Array(256);
  let tot = 0;
  for (let i = 0; i < w * h; i++) {
    if (!ink[i] || !use[labels[i]]) continue;
    hist[Math.min(255, Math.min(hr[i], vr[i]))]++;
    tot++;
  }
  if (!tot) return 1;
  let acc = 0, k = 0;
  while (k < 255 && acc + hist[k] < tot / 2) acc += hist[k++];
  // the median, read between whole pixels
  return Math.max(1, k - 0.5 + (tot / 2 - acc) / Math.max(1, hist[k]));
}

/**
 * From a picture to ink at a working scale where strokes are about `target` px thick.
 * Returns { w, h, scale (working px per source px), ink, dark (the resampled darkness), sw }.
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
  const first = inkMask(d, w, h, Math.max(16, Math.round(Math.max(w, h) / 60)));
  const sw0 = strokeWidth(first.ink, w, h);
  let k = Math.min(3, Math.max(0.15, target / Math.max(0.8, sw0)));
  if (Math.max(w, h) * k > maxSide) k = maxSide / Math.max(w, h);
  if (Math.abs(k - 1) < 0.12) k = 1;
  const W = Math.round(w * k), H = Math.round(h * k);
  const dd = k === 1 ? d : resample(d, w, h, W, H);
  const { ink, contrast } = k === 1 ? first : inkMask(dd, W, H, Math.max(16, Math.round(Math.max(W, H) / 60)));
  const sw = strokeWidth(ink, W, H);
  // the sharper of the two images for reading text: the source (when the working image is a
  // reduction of it) or the working image itself
  const src = k < 1 ? { d, w, h, k } : { d: dd, w: W, h: H, k: 1 };
  return { w: W, h: H, scale: pre * k, ink, dark: dd, contrast, sw, src };
}
