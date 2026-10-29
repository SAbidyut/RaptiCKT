// LU factorisation with partial pivoting (real and complex). The matrices are stored dense
// (circuits built on a phone rarely exceed a few hundred unknowns), but the elimination and
// the solves skip the zeros, and SchurLU orders the unknowns to keep the factors sparse.

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
    const cols = this.cols || (this.cols = new Int32Array(n));
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
      const piv = a[k * n + k], rk = k * n;
      // circuit matrices are sparse: update only the columns where the pivot row is non-zero
      let nz = 0;
      for (let j = k + 1; j < n; j++) if (a[rk + j] !== 0) cols[nz++] = j;
      for (let i = k + 1; i < n; i++) {
        const ri = i * n, f = a[ri + k] / piv;
        if (f === 0) continue;
        a[ri + k] = f;
        for (let q = 0; q < nz; q++) { const j = cols[q]; a[ri + j] -= f * a[rk + j]; }
      }
    }
    this.index();
    return true;
  }

  /** Row-wise lists of the non-zeros of L (below the diagonal) and U (above it), for fast solves. */
  index() {
    const n = this.n, a = this.a;
    if (!this.lp) { this.lp = new Int32Array(n + 1); this.up = new Int32Array(n + 1); this.li = new Int32Array(n * n); this.ui = new Int32Array(n * n); }
    const { lp, up, li, ui } = this;
    let nl = 0, nu = 0;
    for (let i = 0; i < n; i++) {
      const ri = i * n;
      lp[i] = nl; up[i] = nu;
      for (let j = 0; j < i; j++) if (a[ri + j] !== 0) li[nl++] = j;
      for (let j = i + 1; j < n; j++) if (a[ri + j] !== 0) ui[nu++] = j;
    }
    lp[n] = nl; up[n] = nu;
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
    // the non-zeros of m, row by row (looked up once, used by every refinement pass)
    if (!this.mp) { this.mp = new Int32Array(n + 1); this.mi = new Int32Array(n * n); }
    const mp = this.mp, mi = this.mi;
    let nm = 0;
    for (let i = 0; i < n; i++) { mp[i] = nm; const ri = i * n; for (let j = 0; j < n; j++) if (m[ri + j] !== 0) mi[nm++] = j; }
    mp[n] = nm;
    for (let s = 0; s < steps; s++) {
      let big = 0;
      for (let i = 0; i < n; i++) {
        // Kahan-compensated residual
        let sum = b[i], c = 0;
        const ri = i * n;
        for (let q = mp[i], qe = mp[i + 1]; q < qe; q++) {
          const j = mi[q], a = m[ri + j];
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
    const { lp, up, li, ui } = this;
    for (let i = 0; i < n; i++) x[i] = b[perm[i]];
    for (let i = 0; i < n; i++) {
      let s = x[i];
      const ri = i * n;
      for (let q = lp[i], qe = lp[i + 1]; q < qe; q++) { const j = li[q]; s -= a[ri + j] * x[j]; }
      x[i] = s;
    }
    for (let i = n - 1; i >= 0; i--) {
      let s = x[i];
      const ri = i * n;
      for (let q = up[i], qe = up[i + 1]; q < qe; q++) { const j = ui[q]; s -= a[ri + j] * x[j]; }
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

/**
 * LU for a system whose matrix changes only in a few rows and columns between solves (the
 * Newton iterations of a circuit with a handful of nonlinear parts). The unknowns in `tail`
 * are ordered last; the linear matrix is eliminated once up to them, leaving the small Schur
 * complement S0. A Newton iteration then only adds the changed tail block to S0 and factors
 * that (k × k) instead of the whole matrix.
 */
export class SchurLU {
  constructor(n, tail) {
    const inTail = new Uint8Array(n);
    for (const i of tail) inTail[i] = 1;
    const order = [];
    for (let i = 0; i < n; i++) if (!inTail[i]) order.push(i);
    for (const i of tail) order.push(i);
    this.n = n; this.n1 = n - tail.length; this.k = tail.length;
    this.order = Int32Array.from(order);
    this.ordered = false;
    this.a = new Float64Array(n * n);
    this.perm = new Int32Array(this.n1);
    this.S = new Float64Array(this.k * this.k);
    this.Slu = new RealLU(this.k);
    this.y = new Float64Array(n);
    this.y2 = new Float64Array(this.k);
    this.x2 = new Float64Array(this.k);
    this.tail = Int32Array.from(tail);
  }

  /**
   * Minimum-degree order for the linear unknowns (on the pattern of m + mᵀ): eliminating the
   * least-connected unknown first keeps the factors sparse, so the solves stay cheap.
   */
  minDegree(m) {
    const { n, n1, order } = this;
    const adj = [];
    for (let p = 0; p < n1; p++) adj.push(new Set());
    const pos = new Int32Array(n).fill(-1);
    for (let p = 0; p < n1; p++) pos[order[p]] = p;
    for (let p = 0; p < n1; p++) {
      const i = order[p], ri = i * n;
      for (let q = 0; q < n1; q++) {
        if (q === p) continue;
        const j = order[q];
        if (m[ri + j] !== 0 || m[j * n + i] !== 0) { adj[p].add(q); adj[q].add(p); }
      }
    }
    const done = new Uint8Array(n1), out = [];
    for (let s = 0; s < n1; s++) {
      let best = -1, bd = Infinity;
      for (let p = 0; p < n1; p++) if (!done[p] && adj[p].size < bd) { bd = adj[p].size; best = p; }
      done[best] = 1; out.push(order[best]);
      const nb = [...adj[best]];
      for (const u of nb) { adj[u].delete(best); for (const v of nb) if (v !== u) adj[u].add(v); }
    }
    for (let p = 0; p < n1; p++) order[p] = out[p];
    this.ordered = true;
  }

  /** Eliminate the linear matrix m (original order) up to the tail. False if that part is singular. */
  factorLinear(m) {
    if (!this.ordered) this.minDegree(m);
    const { n, n1, order, a, perm } = this;
    for (let i = 0; i < n; i++) { const ri = order[i] * n, pi = i * n; for (let j = 0; j < n; j++) a[pi + j] = m[ri + order[j]]; }
    for (let i = 0; i < n1; i++) perm[i] = i;
    const cols = this.cols || (this.cols = new Int32Array(n));
    for (let k = 0; k < n1; k++) {
      // pivots come from the linear rows only, so the tail rows stay where they are
      let p = k, maxv = Math.abs(a[k * n + k]);
      for (let i = k + 1; i < n1; i++) { const v = Math.abs(a[i * n + k]); if (v > maxv) { maxv = v; p = i; } }
      if (maxv < 1e-30) return false;
      if (p !== k) {
        for (let j = 0; j < n; j++) { const t = a[k * n + j]; a[k * n + j] = a[p * n + j]; a[p * n + j] = t; }
        const t = perm[k]; perm[k] = perm[p]; perm[p] = t;
      }
      const rk = k * n, piv = a[rk + k];
      let nz = 0;
      for (let j = k + 1; j < n; j++) if (a[rk + j] !== 0) cols[nz++] = j;
      for (let i = k + 1; i < n; i++) {
        const ri = i * n, f = a[ri + k] / piv;
        if (f === 0) continue;
        a[ri + k] = f;
        for (let q = 0; q < nz; q++) { const j = cols[q]; a[ri + j] -= f * a[rk + j]; }
      }
    }
    // non-zeros of L (rows: all, columns < n1) and of U11 / U12, row by row
    const lp = this.lp = new Int32Array(n + 1), up = this.up = new Int32Array(n1 + 1);
    const li = [], ui = [];
    for (let i = 0; i < n; i++) {
      lp[i] = li.length;
      const ri = i * n;
      for (let j = 0; j < Math.min(i, n1); j++) if (a[ri + j] !== 0) li.push(j);
    }
    lp[n] = li.length;
    for (let i = 0; i < n1; i++) {
      up[i] = ui.length;
      const ri = i * n;
      for (let j = i + 1; j < n; j++) if (a[ri + j] !== 0) ui.push(j);
    }
    up[n1] = ui.length;
    this.li = Int32Array.from(li); this.ui = Int32Array.from(ui);
    // where the full matrix can be non-zero: the linear pattern plus the tail block
    const isT = new Uint8Array(n);
    for (const t of this.tail) isT[t] = 1;
    const mp = this.mp = new Int32Array(n + 1), mi = [];
    for (let i = 0; i < n; i++) {
      mp[i] = mi.length;
      const ri = i * n;
      for (let j = 0; j < n; j++) if (m[ri + j] !== 0 || (isT[i] && isT[j])) mi.push(j);
    }
    mp[n] = mi.length;
    this.mi = Int32Array.from(mi);
    return true;
  }

  /** Solve, then refine against the full matrix m (Kahan-compensated residual, as RealLU). */
  solveRefined(m, b, x, steps = 2) {
    const { n, mp, mi } = this;
    this.solve(b, x);
    if (!this.r) { this.r = new Float64Array(n); this.dx = new Float64Array(n); }
    const r = this.r, dx = this.dx;
    for (let s = 0; s < steps; s++) {
      let big = 0;
      for (let i = 0; i < n; i++) {
        let sum = b[i], c = 0;
        const ri = i * n;
        for (let q = mp[i], qe = mp[i + 1]; q < qe; q++) {
          const j = mi[q], y = -m[ri + j] * x[j] - c, t = sum + y;
          c = (t - sum) - y; sum = t;
        }
        r[i] = sum;
        if (sum !== 0) big = 1;
      }
      if (!big) break;
      this.solve(r, dx);
      let more = 0;
      for (let i = 0; i < n; i++) { if (Math.abs(dx[i]) > 1e-13 * Math.abs(x[i]) + 1e-300) more = 1; x[i] += dx[i]; }
      if (!more) break; // already exact to rounding: a further pass changes nothing
    }
    return x;
  }

  /**
   * Factor for the full matrix m, which differs from the linear one only in the tail block
   * (lin is the linear matrix). False if the Schur complement is singular.
   */
  factor(m, lin) {
    const { n, n1, k, a, S, tail } = this;
    for (let r = 0; r < k; r++) {
      const ra = (n1 + r) * n + n1, rm = tail[r] * n;
      for (let c = 0; c < k; c++) { const j = tail[c]; S[r * k + c] = a[ra + c] + (m[rm + j] - lin[rm + j]); }
    }
    return this.Slu.factor(S);
  }

  /** Reset the tail block of m to the linear matrix lin (the rest of m is never changed). */
  restoreTail(m, lin) {
    const { n, tail } = this;
    for (const r of tail) { const ri = r * n; for (const c of tail) m[ri + c] = lin[ri + c]; }
  }

  /** Solve with the current factorisation (b and x in the original order). */
  solve(b, x) {
    const { n, n1, k, a, order, perm, lp, li, up, ui, y, y2, x2 } = this;
    for (let i = 0; i < n1; i++) y[i] = b[order[perm[i]]];
    for (let i = n1; i < n; i++) y[i] = b[order[i]];
    for (let i = 0; i < n; i++) {
      let s = y[i];
      const ri = i * n;
      for (let q = lp[i], qe = lp[i + 1]; q < qe; q++) { const j = li[q]; s -= a[ri + j] * y[j]; }
      y[i] = s;
    }
    if (k) {
      for (let r = 0; r < k; r++) y2[r] = y[n1 + r];
      this.Slu.solve(y2, x2);
      for (let r = 0; r < k; r++) y[n1 + r] = x2[r];
    }
    for (let i = n1 - 1; i >= 0; i--) {
      let s = y[i];
      const ri = i * n;
      for (let q = up[i], qe = up[i + 1]; q < qe; q++) { const j = ui[q]; s -= a[ri + j] * y[j]; }
      y[i] = s / a[ri + i];
    }
    for (let i = 0; i < n; i++) x[order[i]] = y[i];
    return x;
  }
}
