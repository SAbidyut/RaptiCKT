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
