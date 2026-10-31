// The features a character is read by (shared by the app and the training tools).

export const N = 16;

/** Features of a 0/1 bitmap { w, h, data }: N·N coverage values, log aspect, ink share. */
export function glyphFeatures({ w, h, data }) {
  const s = N / Math.max(w, h);
  const ox = (N - w * s) / 2, oy = (N - h * s) / 2;
  const f = new Float32Array(N * N + 2);
  let ink = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!data[y * w + x]) continue;
      ink++;
      const fx0 = ox + x * s, fx1 = fx0 + s, fy0 = oy + y * s, fy1 = fy0 + s;
      for (let cy = Math.max(0, Math.floor(fy0)); cy < Math.min(N, Math.ceil(fy1)); cy++) {
        const ky = Math.min(fy1, cy + 1) - Math.max(fy0, cy);
        if (ky <= 0) continue;
        for (let cx = Math.max(0, Math.floor(fx0)); cx < Math.min(N, Math.ceil(fx1)); cx++) {
          const kx = Math.min(fx1, cx + 1) - Math.max(fx0, cx);
          if (kx > 0) f[cy * N + cx] += kx * ky;
        }
      }
    }
  }
  for (let i = 0; i < N * N; i++) f[i] = Math.min(1, f[i]);
  f[N * N] = Math.log(w / h);
  f[N * N + 1] = ink / (w * h);
  return f;
}

export const HAND_N = 32, HAND_CELLS = 5, HAND_DIRS = 8;

/**
 * Features of a hand-written character { w, h, data }: which way its strokes run where — the
 * edges' directions (8, without sign) in a 5 × 5 grid, from the bitmap scaled into 32 × 32 —
 * plus an 8 × 8 coverage grid, log aspect, ink share and the holes it encloses. Directions and
 * holes hardly change with the pen: a thick and a thin 8 cross alike, round two holes.
 */
export function glyphFeaturesHand(bm) {
  const { w, h, data } = bm;
  const M = HAND_N;
  // coverage image, the glyph centred and scaled to fit
  const s = (M - 2) / Math.max(w, h);
  const ox = (M - w * s) / 2, oy = (M - h * s) / 2;
  const g = new Float32Array(M * M);
  let ink = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!data[y * w + x]) continue;
      ink++;
      const fx0 = ox + x * s, fx1 = fx0 + s, fy0 = oy + y * s, fy1 = fy0 + s;
      for (let cy = Math.max(0, Math.floor(fy0)); cy < Math.min(M, Math.ceil(fy1)); cy++) {
        const ky = Math.min(fy1, cy + 1) - Math.max(fy0, cy);
        if (ky <= 0) continue;
        for (let cx = Math.max(0, Math.floor(fx0)); cx < Math.min(M, Math.ceil(fx1)); cx++) {
          const kx = Math.min(fx1, cx + 1) - Math.max(fx0, cx);
          if (kx > 0) g[cy * M + cx] += kx * ky;
        }
      }
    }
  }
  for (let i = 0; i < M * M; i++) g[i] = Math.min(1, g[i]);
  // a little blur, so that edges have a direction
  const b = new Float32Array(M * M);
  for (let y = 0; y < M; y++) {
    for (let x = 0; x < M; x++) {
      let t = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const X = x + dx, Y = y + dy;
        if (X < 0 || Y < 0 || X >= M || Y >= M) continue;
        const k = dx && dy ? 1 : dx || dy ? 2 : 4;
        t += k * g[Y * M + X]; n += k;
      }
      b[y * M + x] = t / n;
    }
  }
  const C = HAND_CELLS, D = HAND_DIRS;
  const f = new Float32Array(C * C * D + 64 + 2 + 9);
  let total = 0;
  for (let y = 1; y < M - 1; y++) {
    for (let x = 1; x < M - 1; x++) {
      const at = (X, Y) => b[Y * M + X];
      const gx = at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1);
      const gy = at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1);
      const m = Math.hypot(gx, gy);
      if (m < 1e-3) continue;
      // the edge's direction without its sign, in bins of 22.5°, shared between the two nearest
      let a = Math.atan2(gy, gx);
      if (a < 0) a += Math.PI;
      const t = (a / Math.PI) * D, k0 = Math.floor(t) % D, k1 = (k0 + 1) % D, w1 = t - Math.floor(t);
      // and between the nearest cells
      const cx = (x / M) * C - 0.5, cy = (y / M) * C - 0.5;
      const ix = Math.floor(cx), iy = Math.floor(cy), fx = cx - ix, fy = cy - iy;
      for (const [jx, wx] of [[ix, 1 - fx], [ix + 1, fx]]) {
        if (jx < 0 || jx >= C) continue;
        for (const [jy, wy] of [[iy, 1 - fy], [iy + 1, fy]]) {
          if (jy < 0 || jy >= C) continue;
          const base = (jy * C + jx) * D;
          f[base + k0] += m * wx * wy * (1 - w1);
          f[base + k1] += m * wx * wy * w1;
        }
      }
      total += m;
    }
  }
  // as shares of all the edge there is (square-rooted: a long stroke must not drown the rest)
  for (let i = 0; i < C * C * D; i++) f[i] = Math.sqrt(f[i] / (total || 1));
  // coverage in 8 × 8
  for (let y = 0; y < M; y++) for (let x = 0; x < M; x++) f[C * C * D + (y >> 2) * 8 + (x >> 2)] += g[y * M + x] / 16;
  f[C * C * D + 64] = Math.log(w / h);
  f[C * C * D + 65] = ink / (w * h);
  // the holes it encloses (a 3 none, a 9 one up top, an 8 two): how many, where, how big
  const holes = holesOf(g, M);
  const H0 = C * C * D + 66;
  f[H0 + Math.min(2, holes.length)] = 1;
  holes.slice(0, 2).forEach((o, k) => { f[H0 + 3 + 3 * k] = o.x; f[H0 + 4 + 3 * k] = o.y; f[H0 + 5 + 3 * k] = o.size; });
  return f;
}

/** Enclosed background of an M × M coverage image (ink ≥ 0.4): biggest first, { x, y, size } in 0…1. */
function holesOf(g, M) {
  const lab = new Int32Array(M * M);
  const fill = (s, id) => {
    const st = [s];
    lab[s] = id;
    let n = 0, sx = 0, sy = 0;
    while (st.length) {
      const i = st.pop(), x = i % M, y = (i / M) | 0;
      n++; sx += x; sy += y;
      for (const j of [x > 0 ? i - 1 : -1, x < M - 1 ? i + 1 : -1, y > 0 ? i - M : -1, y < M - 1 ? i + M : -1]) {
        if (j < 0 || lab[j] || g[j] >= 0.4) continue;
        lab[j] = id;
        st.push(j);
      }
    }
    return { n, x: sx / n / M, y: sy / n / M };
  };
  for (let i = 0; i < M; i++) {
    for (const j of [i, (M - 1) * M + i, i * M, i * M + M - 1]) if (!lab[j] && g[j] < 0.4) fill(j, -1);
  }
  const out = [];
  for (let i = 0; i < M * M; i++) {
    if (lab[i] || g[i] >= 0.4) continue;
    const o = fill(i, out.length + 1);
    if (o.n >= 3) out.push({ x: o.x, y: o.y, size: Math.sqrt(o.n) / M });
  }
  return out.sort((a, b) => b.size - a.size);
}
