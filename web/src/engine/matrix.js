// Dense LU factorisation with partial pivoting (real and complex).
// Circuits built on a phone rarely exceed a few hundred unknowns, where a
// cache-friendly dense solver beats a general sparse one.

export class RealLU {
  constructor(n) {
    this.n = n;
    this.a = new Float64Array(n * n);
    this.perm = new Int32Array(n);
    this.singularRow = -1;
  }

  /** Factor matrix m (Float64Array n*n, row major) in place into this.a. Returns false if singular. */
  factor(m) {
    const n = this.n, a = this.a, perm = this.perm;
    a.set(m);
    this.singularRow = -1;
    for (let i = 0; i < n; i++) perm[i] = i;
    for (let k = 0; k < n; k++) {
      let p = k, maxv = Math.abs(a[k * n + k]);
      for (let i = k + 1; i < n; i++) {
        const v = Math.abs(a[i * n + k]);
        if (v > maxv) { maxv = v; p = i; }
      }
      if (maxv < 1e-30) { this.singularRow = perm[k]; return false; }
      if (p !== k) {
        for (let j = 0; j < n; j++) {
          const t = a[k * n + j]; a[k * n + j] = a[p * n + j]; a[p * n + j] = t;
        }
        const t = perm[k]; perm[k] = perm[p]; perm[p] = t;
      }
      const piv = a[k * n + k];
      for (let i = k + 1; i < n; i++) {
        const f = a[i * n + k] / piv;
        if (f === 0) continue;
        a[i * n + k] = f;
        const ri = i * n, rk = k * n;
        for (let j = k + 1; j < n; j++) a[ri + j] -= f * a[rk + j];
      }
    }
    return true;
  }

  /**
   * Solve and apply iterative refinement against the original matrix m.
   * MNA matrices mix conductances of 1e-12 S with inductor/transformer rows of
   * 1e5 Ω; refinement restores component-wise accuracy for such badly scaled
   * systems at the cost of one extra O(n²) pass.
   */
  solveRefined(m, b, x, steps = 2) {
    const n = this.n;
    this.solve(b, x);
    if (!this.r) { this.r = new Float64Array(n); this.dx = new Float64Array(n); }
    const r = this.r, dx = this.dx;
    for (let s = 0; s < steps; s++) {
      let big = 0;
      for (let i = 0; i < n; i++) {
        // Kahan-compensated residual
        let sum = b[i], c = 0;
        const ri = i * n;
        for (let j = 0; j < n; j++) {
          const a = m[ri + j];
          if (a === 0) continue;
          const y = -a * x[j] - c;
          const t = sum + y;
          c = (t - sum) - y;
          sum = t;
        }
        r[i] = sum;
        if (sum !== 0) big = 1;
      }
      if (!big) break;
      this.solve(r, dx);
      for (let i = 0; i < n; i++) x[i] += dx[i];
    }
    return x;
  }

  /** Solve with the current factorisation. b is not modified; result written to x. */
  solve(b, x) {
    const n = this.n, a = this.a, perm = this.perm;
    for (let i = 0; i < n; i++) x[i] = b[perm[i]];
    for (let i = 0; i < n; i++) {
      let s = x[i];
      const ri = i * n;
      for (let j = 0; j < i; j++) s -= a[ri + j] * x[j];
      x[i] = s;
    }
    for (let i = n - 1; i >= 0; i--) {
      let s = x[i];
      const ri = i * n;
      for (let j = i + 1; j < n; j++) s -= a[ri + j] * x[j];
      x[i] = s / a[ri + i];
    }
    return x;
  }
}

/** Complex dense solve (Gaussian elimination, partial pivoting). re/im are n*n; br/bi length n. */
export function complexSolve(n, re, im, br, bi) {
  const xr = new Float64Array(n), xi = new Float64Array(n);
  const ar = Float64Array.from(re), ai = Float64Array.from(im);
  const vr = Float64Array.from(br), vi = Float64Array.from(bi);
  for (let k = 0; k < n; k++) {
    let p = k, maxv = -1;
    for (let i = k; i < n; i++) {
      const v = Math.hypot(ar[i * n + k], ai[i * n + k]);
      if (v > maxv) { maxv = v; p = i; }
    }
    if (maxv < 1e-30) return null;
    if (p !== k) {
      for (let j = 0; j < n; j++) {
        let t = ar[k * n + j]; ar[k * n + j] = ar[p * n + j]; ar[p * n + j] = t;
        t = ai[k * n + j]; ai[k * n + j] = ai[p * n + j]; ai[p * n + j] = t;
      }
      let t = vr[k]; vr[k] = vr[p]; vr[p] = t;
      t = vi[k]; vi[k] = vi[p]; vi[p] = t;
    }
    const pr = ar[k * n + k], pi = ai[k * n + k];
    const den = pr * pr + pi * pi;
    for (let i = k + 1; i < n; i++) {
      const cr = ar[i * n + k], ci = ai[i * n + k];
      if (cr === 0 && ci === 0) continue;
      // f = c / piv
      const fr = (cr * pr + ci * pi) / den, fi = (ci * pr - cr * pi) / den;
      for (let j = k; j < n; j++) {
        const kr = ar[k * n + j], ki = ai[k * n + j];
        ar[i * n + j] -= fr * kr - fi * ki;
        ai[i * n + j] -= fr * ki + fi * kr;
      }
      vr[i] -= fr * vr[k] - fi * vi[k];
      vi[i] -= fr * vi[k] + fi * vr[k];
    }
  }
  for (let i = n - 1; i >= 0; i--) {
    let sr = vr[i], si = vi[i];
    for (let j = i + 1; j < n; j++) {
      const mr = ar[i * n + j], mi = ai[i * n + j];
      sr -= mr * xr[j] - mi * xi[j];
      si -= mr * xi[j] + mi * xr[j];
    }
    const pr = ar[i * n + i], pi = ai[i * n + i];
    const den = pr * pr + pi * pi;
    xr[i] = (sr * pr + si * pi) / den;
    xi[i] = (si * pr - sr * pi) / den;
  }
  return { re: xr, im: xi };
}
