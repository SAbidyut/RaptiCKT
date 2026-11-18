// Shared building blocks for component models:
//  - compileExpr: safe arithmetic expression compiler (no eval)
//  - Composite:   a part assembled from other element models (e.g. Darlington, optocoupler)
//  - Windings:    N magnetically coupled windings (transformers, LVDT, machines)
//  - LTI:         discretised single-input linear state-space system (control blocks)
//  - CycleMeter:  period / RMS / mean / phase measurement from a sampled signal
//  - Chip:        pin layout + drawing for IC-style boxes

import { Element, GRID } from './base.js';

const G = GRID;

// ------------------------------------------------------------ expressions
const FUNCS = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan, atan2: Math.atan2,
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh, exp: Math.exp, ln: Math.log, log: Math.log, log10: Math.log10,
  sqrt: (x) => Math.sqrt(Math.max(0, x)), abs: Math.abs, sign: Math.sign, floor: Math.floor, ceil: Math.ceil, round: Math.round,
  min: Math.min, max: Math.max, pow: Math.pow, sqr: (x) => x * x, if: (c, a, b) => (c ? a : b),
  step: (x) => (x >= 0 ? 1 : 0), u: (x) => (x >= 0 ? 1 : 0), limit: (x, a, b) => Math.min(Math.max(x, a), b),
  frac: (x) => x - Math.floor(x), mod: (a, b) => a - b * Math.floor(a / b),
  square: (x) => (x - 2 * Math.PI * Math.floor(x / (2 * Math.PI)) < Math.PI ? 1 : -1),
  tri: (x) => { const f = x / (2 * Math.PI) - Math.floor(x / (2 * Math.PI)); return f < 0.5 ? 4 * f - 1 : 3 - 4 * f; },
};
const CONSTS = { pi: Math.PI, e: Math.E };
const SI = { T: 1e12, G: 1e9, M: 1e6, k: 1e3, m: 1e-3, u: 1e-6, 'µ': 1e-6, n: 1e-9, p: 1e-12, f: 1e-15 };

/**
 * Compile an expression such as "5*sin(2*pi*50*t) + 0.1*v" into a function of a
 * variables object. Throws Error with a readable message on syntax errors.
 */
export function compileExpr(src, varNames = []) {
  const s = String(src);
  let i = 0;
  const vars = new Set(varNames);
  const peek = () => { while (s[i] === ' ' || s[i] === '\t') i++; return s[i]; };
  const fail = (m) => { throw new Error(`${m} at position ${i + 1}`); };
  const eat = (c) => { if (peek() === c) { i++; return true; } return false; };

  function number() {
    const m = /^(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?/.exec(s.slice(i));
    if (!m) fail('number expected');
    i += m[0].length;
    let v = parseFloat(m[0]);
    const c = s[i];
    // SI suffix directly after the number (not the start of an identifier like "k1")
    if (c && SI[c] !== undefined && !/[A-Za-z0-9_]/.test(s[i + 1] || '')) { v *= SI[c]; i++; }
    return () => v;
  }
  function primary() {
    const c = peek();
    if (c === '(') { i++; const e = ternary(); if (!eat(')')) fail("')' expected"); return e; }
    if (/[\d.]/.test(c || '')) return number();
    const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(s.slice(i));
    if (!m) fail(c ? `unexpected '${c}'` : 'unexpected end');
    i += m[0].length;
    const name = m[0];
    if (peek() === '(') {
      i++;
      const fn = FUNCS[name];
      if (!fn) fail(`unknown function ${name}`);
      const args = [];
      if (!eat(')')) {
        do { args.push(ternary()); } while (eat(','));
        if (!eat(')')) fail("')' expected");
      }
      return (v) => fn(...args.map((a) => a(v)));
    }
    if (vars.has(name)) return (v) => v[name];
    if (name in CONSTS) { const k = CONSTS[name]; return () => k; }
    fail(`unknown name ${name}`);
  }
  function power() {
    const b = primary();
    if (eat('^')) { const e = unary(); return (v) => Math.pow(b(v), e(v)); }
    return b;
  }
  function unary() {
    if (eat('-')) { const a = unary(); return (v) => -a(v); }
    if (eat('+')) return unary();
    if (eat('!')) { const a = unary(); return (v) => (a(v) ? 0 : 1); }
    return power();
  }
  function term() {
    let a = unary();
    for (;;) {
      if (eat('*')) { const l = a, r = unary(); a = (v) => l(v) * r(v); } else if (eat('/')) { const l = a, r = unary(); a = (v) => l(v) / r(v); } else if (eat('%')) { const l = a, r = unary(); a = (v) => FUNCS.mod(l(v), r(v)); } else return a;
    }
  }
  function sum() {
    let a = term();
    for (;;) {
      if (eat('+')) { const l = a, r = term(); a = (v) => l(v) + r(v); } else if (eat('-')) { const l = a, r = term(); a = (v) => l(v) - r(v); } else return a;
    }
  }
  function compare() {
    let a = sum();
    for (;;) {
      peek();
      const op = /^(<=|>=|==|!=|<|>)/.exec(s.slice(i));
      if (!op) return a;
      i += op[0].length;
      const l = a, r = sum();
      a = { '<': (v) => +(l(v) < r(v)), '>': (v) => +(l(v) > r(v)), '<=': (v) => +(l(v) <= r(v)), '>=': (v) => +(l(v) >= r(v)), '==': (v) => +(l(v) === r(v)), '!=': (v) => +(l(v) !== r(v)) }[op[0]];
    }
  }
  function ternary() {
    const c = compare();
    if (eat('?')) { const a = ternary(); if (!eat(':')) fail("':' expected"); const b = ternary(); return (v) => (c(v) ? a(v) : b(v)); }
    return c;
  }
  const f = ternary();
  if (peek() !== undefined) fail(`unexpected '${peek()}'`);
  return (v) => { const y = f(v); return Number.isFinite(y) ? y : 0; };
}

/** Cached compile that never throws: returns [fn, error]. */
const exprCache = new Map();
export function exprFn(src, vars) {
  const k = src + '|' + vars.join(',');
  if (!exprCache.has(k)) {
    try { exprCache.set(k, [compileExpr(src, vars), null]); } catch (e) { exprCache.set(k, [() => 0, e.message]); }
  }
  return exprCache.get(k);
}

// ------------------------------------------------------------- composite
/**
 * A part made of other element models. Subclasses implement parts() returning
 * [[element, map], ...] where map lists, for each sub-element post, a reference:
 * an own post index (number), 'iK' for the composite's K-th internal node, or 'g'.
 * sync() copies the composite's parameters into the sub-elements.
 */
export class Composite extends Element {
  constructor(x, y) {
    super(x, y);
    this.subs = this.parts().map(([el, map]) => ({ el, map }));
    this.nonlinear = this.subs.some((s) => s.el.nonlinear);
    this.postCurrents = new Array(this.localPosts().length).fill(0);
    this.sync();
  }
  parts() { return []; }
  ownInternal() { return 0; }
  ownBranches() { return 0; }
  sync() {}
  onParamChange() { this.sync(); for (const s of this.subs) s.el.onParamChange?.(); }
  internalNodeCount() { return this.ownInternal() + this.subs.reduce((a, s) => a + (s.el.internalNodeCount ? s.el.internalNodeCount() : 0), 0); }
  branchCount() { return this.ownBranches() + this.subs.reduce((a, s) => a + (s.el.branchCount ? s.el.branchCount() : 0), 0); }
  wire() {
    const key = this.nodes.join(',') + '|' + this.inodes.join(',') + '|' + this.branches.join(',');
    if (key === this._wired) return;
    this._wired = key;
    let ni = this.ownInternal(), bi = this.ownBranches();
    for (const s of this.subs) {
      const e = s.el;
      e.nodes = s.map.map((r) => (r === 'g' ? 0 : typeof r === 'string' ? this.inodes[+r.slice(1)] : this.nodes[r]));
      const ci = e.internalNodeCount ? e.internalNodeCount() : 0, cb = e.branchCount ? e.branchCount() : 0;
      e.inodes = this.inodes.slice(ni, ni + ci); ni += ci;
      e.branches = this.branches.slice(bi, bi + cb); bi += cb;
      e.name = this.name;
    }
  }
  reset(s) { this.wire(); this.sync(); for (const x of this.subs) x.el.reset?.(s); this.postCurrents.fill(0); this.i = 0; }
  stamp(s) { this.wire(); for (const x of this.subs) x.el.stamp?.(s); }
  stampStep(s) { for (const x of this.subs) x.el.stampStep?.(s); }
  stampNL(s) { for (const x of this.subs) if (x.el.nonlinear) x.el.stampNL(s); }
  preStep(s) { for (const x of this.subs) x.el.preStep?.(s); }
  digitalSettle(s) { let c = false; for (const x of this.subs) if (x.el.digitalSettle?.(s)) c = true; return c; }
  stampAC(ac) { this.wire(); for (const x of this.subs) if (x.el.stampAC) x.el.stampAC(ac); else openBranchesAC(ac, x.el); }
  accept(s) {
    this.postCurrents.fill(0);
    for (const x of this.subs) {
      x.el.accept?.(s);
      x.map.forEach((r, j) => { if (typeof r === 'number') this.postCurrents[r] += x.el.postCurrents[j] || 0; });
    }
    this.i = this.postCurrents[0];
  }
}

/** AC fallback for elements without a small-signal model: their branch currents are zero. */
export function openBranchesAC(ac, e) { for (const k of e.branches || []) ac.addA(k, k, 1); }

// -------------------------------------------------------------- windings
/**
 * N coupled windings. ends[k] = [nodeP, nodeN], br[k] = branch index carrying the
 * winding current (flowing P → N through the winding). L is the N×N inductance
 * matrix (self on the diagonal, mutual off-diagonal), R the winding resistances.
 * Trapezoidal / backward-Euler companion model, identical in form to the inductor.
 */
export class Windings {
  constructor(n) { this.n = n; this.reset(); }
  reset(i0) { this.i = new Float64Array(this.n); this.vl = new Float64Array(this.n); if (i0) this.i.set(i0); }
  f(s) { return s.mode === 'dc' ? 0 : (s.method === 'be' ? 1 : 2) / s.dt; }
  stamp(s, ends, br, L, R) {
    const f = this.f(s);
    for (let k = 0; k < this.n; k++) {
      const [p, q] = ends[k], bk = br[k];
      s.addBranchKCL(p, q, bk);
      s.addA(bk, p - 1, 1); s.addA(bk, q - 1, -1);
      s.addA(bk, bk, -Math.max(R[k], 1e-9));
      for (let j = 0; j < this.n; j++) if (L[k][j]) s.addA(bk, br[j], -f * L[k][j]);
    }
  }
  stampStep(s, br, L) {
    if (s.mode === 'dc') return;
    const f = this.f(s), tr = s.method === 'be' ? 0 : 1;
    for (let k = 0; k < this.n; k++) {
      let psi = 0;
      for (let j = 0; j < this.n; j++) psi += L[k][j] * this.i[j];
      s.b[br[k]] += -f * psi - tr * this.vl[k];
    }
  }
  accept(s, ends, br, R) {
    for (let k = 0; k < this.n; k++) {
      const [p, q] = ends[k];
      this.i[k] = s.x[br[k]];
      this.vl[k] = s.mode === 'dc' ? 0 : s.v(p) - s.v(q) - Math.max(R[k], 1e-9) * this.i[k];
    }
  }
  stampAC(ac, ends, br, L, R) {
    const w = ac.omega;
    for (let k = 0; k < this.n; k++) {
      const [p, q] = ends[k], bk = br[k];
      ac.addBranchKCL(p, q, bk);
      ac.addA(bk, p - 1, 1); ac.addA(bk, q - 1, -1);
      ac.addA(bk, bk, -Math.max(R[k], 1e-9));
      for (let j = 0; j < this.n; j++) if (L[k][j]) ac.addA(bk, br[j], 0, -w * L[k][j]);
    }
  }
}

// ------------------------------------------------------------ LTI blocks
function solveSmall(M, b) {
  // Gaussian elimination for tiny systems (n ≤ 4)
  const n = b.length, A = M.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    const d = A[c][c] || 1e-300;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = A[r][c] / d;
      for (let k = c; k <= n; k++) A[r][k] -= f * A[c][k];
    }
  }
  return A.map((r, i) => r[n] / (r[i] || 1e-300));
}

/**
 * Single-input single-output x' = A x + B u, y = C x + D u.
 * For each step: y_n = a·u_n + c, with (a, c) from the trapezoidal (or backward
 * Euler) discretisation — implicit, so algebraic feedback loops solve exactly.
 */
export class LTI {
  constructor(A, B, C, D) { this.set(A, B, C, D); this.reset(); }
  set(A, B, C, D) { this.A = A; this.B = B; this.C = C; this.D = D; this.n = B.length; this.key = null; }
  reset(x0) { this.x = x0 ? [...x0] : new Array(this.n).fill(0); this.u = 0; }
  prep(s) {
    const key = s.mode + s.dt + s.method;
    if (key === this.key) return;
    this.key = key;
    const n = this.n, { A, B } = this;
    if (s.mode === 'dc') {
      this.dc = true;
      // steady state x = −A⁻¹B·u exists only if A is invertible (no integrators)
      const z = solveSmall(A, B.map((v) => -v));
      this.zdc = z.every((v) => Number.isFinite(v) && Math.abs(v) < 1e12) ? z : null;
      return;
    }
    this.dc = false;
    const h = s.method === 'be' ? s.dt : s.dt / 2;
    const I = (r, c) => (r === c ? 1 : 0);
    const Mm = A.map((row, r) => row.map((v, c) => I(r, c) - h * v));
    // M1 = Mm⁻¹ (I + h'A) where for BE the explicit part is I; M2 = Mm⁻¹ h B
    this.M1 = [];
    for (let c = 0; c < n; c++) {
      const col = A.map((row, r) => I(r, c) + (s.method === 'be' ? 0 : h * row[c]));
      this.M1.push(solveSmall(Mm, col));
    }
    this.M2 = solveSmall(Mm, B.map((v) => h * v));
    this.be = s.method === 'be';
  }
  /** Returns {a, c} with y = a·u + c for the step being solved. */
  coeffs(s) {
    this.prep(s);
    const { C, D, n } = this;
    if (this.dc) {
      if (this.zdc) return { a: D + C.reduce((acc, cv, i) => acc + cv * this.zdc[i], 0), c: 0 };
      return { a: D, c: C.reduce((acc, cv, i) => acc + cv * this.x[i], 0) }; // integrators hold their state
    }
    // x_n = M1 x_{n-1} + M2 (u_n + [trap] u_{n-1})
    const xp = new Array(n).fill(0);
    for (let c = 0; c < n; c++) for (let r = 0; r < n; r++) xp[r] += this.M1[c][r] * this.x[c];
    let a = D, c0 = 0;
    for (let r = 0; r < n; r++) {
      const base = xp[r] + (this.be ? 0 : this.M2[r] * this.u);
      c0 += C[r] * base;
      a += C[r] * this.M2[r];
    }
    return { a, c: c0 };
  }
  accept(s, u) {
    this.prep(s);
    if (this.dc) {
      if (this.zdc) this.x = this.zdc.map((v) => v * u);
      this.u = u;
      return;
    }
    const n = this.n, xn = new Array(n).fill(0);
    for (let c = 0; c < n; c++) for (let r = 0; r < n; r++) xn[r] += this.M1[c][r] * this.x[c];
    for (let r = 0; r < n; r++) xn[r] += this.M2[r] * (u + (this.be ? 0 : this.u));
    this.x = xn; this.u = u;
  }
  output(u) { return this.C.reduce((a, c, i) => a + c * this.x[i], 0) + this.D * u; }
}

// ------------------------------------------------------------ measurement
/**
 * Tracks a periodic signal: detects rising crossings of its AC component (with
 * hysteresis) and reports, over the last complete period, frequency, mean, RMS
 * and the mean of an optional product signal (for real power).
 */
export class CycleMeter {
  constructor(tau = 0.2) { this.tau = tau; this.reset(); }
  reset() {
    this.t0 = null; this.hi = false; this.prevU = 0; this.freq = 0; this.period = 0;
    this.sx = 0; this.sxx = 0; this.sp = 0; this.sy = 0; this.syy = 0; this.acc = 0;
    this.mean = 0; this.rms = 0; this.pmean = 0; this.ymean = 0; this.yrms = 0; this.amp = 0;
    this.ema = 0; this.ema2 = 0; this.emaP = 0; this.emaY = 0; this.emaY2 = 0; this.lastCross = null; this.valid = false;
    this.lastT = 0;
  }
  /** x: signal, y: optional second signal (its mean/RMS and mean(x·y) are tracked too) */
  push(t, dt, x, y = 0) {
    // slow averages keep readings meaningful for DC or before the first full cycle
    const a = Math.min(1, dt / this.tau);
    this.ema += (x - this.ema) * a; this.ema2 += (x * x - this.ema2) * a;
    this.emaP += (x * y - this.emaP) * a; this.emaY += (y - this.emaY) * a; this.emaY2 += (y * y - this.emaY2) * a;
    const u = x - (this.valid ? this.mean : this.ema);
    this.amp = Math.max(this.amp * (1 - a * 0.2), Math.abs(u));
    const h = Math.max(1e-9, 0.04 * this.amp);
    let crossed = null;
    if (!this.hi && u > h) {
      this.hi = true;
      // interpolate the zero crossing between the previous and current sample
      const du = u - this.prevU;
      crossed = du > 0 ? t - dt * Math.min(1, Math.max(0, u / du)) : t;
    } else if (this.hi && u < -h) this.hi = false;
    this.prevU = u;
    if (crossed !== null) {
      if (this.t0 !== null && crossed > this.t0) {
        const T = crossed - this.t0;
        if (this.acc > 0) {
          this.period = T; this.freq = 1 / T;
          this.mean = this.sx / this.acc; this.rms = Math.sqrt(Math.max(0, this.sxx / this.acc));
          this.pmean = this.sp / this.acc; this.ymean = this.sy / this.acc; this.yrms = Math.sqrt(Math.max(0, this.syy / this.acc));
          this.valid = true;
        }
      }
      this.t0 = crossed; this.lastCross = crossed;
      this.sx = this.sxx = this.sp = this.sy = this.syy = this.acc = 0;
    }
    if (this.t0 !== null) {
      this.sx += x * dt; this.sxx += x * x * dt; this.sp += x * y * dt; this.sy += y * dt; this.syy += y * y * dt; this.acc += dt;
    }
    // no crossings for a long time: the signal is (quasi) DC
    if (this.valid && this.t0 !== null && t - this.t0 > Math.max(4 * this.period, 0.5)) this.valid = false;
    this.lastT = t;
  }
  get vmean() { return this.valid ? this.mean : this.ema; }
  get vrms() { return this.valid ? this.rms : Math.sqrt(Math.max(0, this.ema2)); }
  get pavg() { return this.valid ? this.pmean : this.emaP; }
  get irms() { return this.valid ? this.yrms : Math.sqrt(Math.max(0, this.emaY2)); }
  get f() { return this.valid ? this.freq : 0; }
}

/** Phase of b relative to a in degrees (−180…180], from their last rising crossings. */
export function phaseDeg(ma, mb) {
  if (!ma.valid || !mb.valid || ma.lastCross === null || mb.lastCross === null) return NaN;
  const T = ma.period;
  let d = ((ma.lastCross - mb.lastCross) / T) * 360; // b leads if it crossed earlier
  d = ((d % 360) + 360) % 360;
  if (d > 180) d -= 360;
  return d;
}

// ------------------------------------------------------------------ chips
/**
 * Pin layout for IC-style boxes. pins: [[label, side], ...] with side 'L','R','T','B'.
 * Posts sit on the grid; leads run from each post to the box edge.
 */
export function chipGeom(pins, opts = {}) {
  const side = { L: [], R: [], T: [], B: [] };
  pins.forEach(([, sd], i) => side[sd].push(i));
  // two pins on a side are spread to ±G; otherwise one grid step apart
  const ys = (n) => {
    if (n === 1) return [0];
    if (n === 2 && !opts.dense) return [-G, G];
    return Array.from({ length: n }, (_, k) => (k - Math.floor((n - 1) / 2)) * G);
  };
  const posts = new Array(pins.length);
  const lys = ys(side.L.length), rys = ys(side.R.length);
  const allY = [...lys, ...rys, 0];
  const nTB = Math.max(side.T.length, side.B.length);
  const bwMin = Math.max(opts.w ?? 1.3 * G, nTB > 0 ? (nTB * G) / 2 + 0.3 * G : 0);
  const px = Math.max(2 * G, Math.ceil((bwMin + 0.6 * G) / G) * G);
  const bw = px - 0.7 * G;
  const top0 = Math.min(...allY) - (opts.title === false ? 0.8 * G : 1.5 * G);
  const bot0 = Math.max(...allY) + (opts.h ?? 0.8 * G);
  const xsTB = (n) => Array.from({ length: n }, (_, k) => (k - Math.floor((n - 1) / 2)) * G);
  const tops = xsTB(side.T.length), bots = xsTB(side.B.length);
  const ty = Math.floor((top0 - 0.5 * G) / G) * G, by = Math.ceil((bot0 + 0.5 * G) / G) * G;
  const top = ty + 0.7 * G, bot = by - 0.7 * G;
  const leads = [];
  side.L.forEach((pi, k) => { posts[pi] = [-px, lys[k]]; leads.push([pi, -px, lys[k], -bw, lys[k]]); });
  side.R.forEach((pi, k) => { posts[pi] = [px, rys[k]]; leads.push([pi, px, rys[k], bw, rys[k]]); });
  side.T.forEach((pi, k) => { posts[pi] = [tops[k], ty]; leads.push([pi, tops[k], ty, tops[k], top]); });
  side.B.forEach((pi, k) => { posts[pi] = [bots[k], by]; leads.push([pi, bots[k], by, bots[k], bot]); });
  const box = [-px, side.T.length ? ty : top - 2, px, side.B.length ? by : bot + 2];
  return { posts, leads, box, bw, top, bot, px, pins };
}

/** Mixin giving an element an IC-style pin layout from `static pins` and a drawChip() helper. */
export function withChip(Base) {
  return class extends Base {
    geom() {
      const C = this.constructor;
      if (!Object.prototype.hasOwnProperty.call(C, '_geom')) C._geom = chipGeom(C.pins, C.chipOpts || {});
      return C._geom;
    }
    localPosts() { return this.geom().posts; }
    localBox() { return this.geom().box; }
    leads() { return this.geom().leads; }
    labelSide() { return [0, this.constructor.labelBelow ? 1 : -1]; }
    pinNames() { return this.constructor.pins.map((p) => p[0]); }
    drawChip(g, title, o = {}) {
      const { bw, top, bot, pins, posts } = this.geom();
      g.box(-bw, top, bw, bot, { stroke: g.body, width: g.lw * 0.9, fill: o.fill || g.fill, r: 4 });
      const ty = pins.some((p) => p[1] === 'T') ? top + 1.05 * G : top + 0.62 * G;
      if (title) g.text(title, 0, ty, { size: o.titleSize || 8.5, color: g.accent, bold: true, follow: true });
      pins.forEach(([lab, sd], i) => {
        if (!lab) return;
        const [x, y] = posts[i];
        const o2 = { size: 7, color: g.muted };
        if (sd === 'L') g.text(lab, -bw + 0.22 * G, y, { ...o2, align: 'left' });
        else if (sd === 'R') g.text(lab, bw - 0.22 * G, y, { ...o2, align: 'right' });
        // top / bottom pin names turn with the chip like the side ones, so they stay inside it
        else if (sd === 'T') g.text(lab, x, top + 0.42 * G, { ...o2, follow: true });
        else g.text(lab, x, bot - 0.42 * G, { ...o2, follow: true });
      });
    }
  };
}

/** Numerical derivative helper for behavioural models. */
export function numDeriv(f, xs, k) {
  const h = 1e-6 * Math.max(1, Math.abs(xs[k]));
  const a = [...xs], b = [...xs];
  a[k] += h; b[k] -= h;
  return (f(a) - f(b)) / (2 * h);
}

