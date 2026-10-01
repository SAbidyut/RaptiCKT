// Control & math blocks (signal-flow blocks for control systems and research):
// gain, summers, multiplier, divider, integrator, differentiator, 1st/2nd-order
// transfer functions, PID, saturation, abs, sqrt, power, log, exp, trig,
// transport delay, zero-order hold, rate limiter, relay with hysteresis and a
// user function block.
//
// Inputs are voltages referred to ground (infinite impedance); the output is an
// ideal voltage source to ground. Dynamic blocks are discretised implicitly
// (trapezoidal / backward Euler, kit.LTI) so feedback loops solve exactly.

import { Element, register, GRID } from './base.js';
import { LTI, exprFn, numDeriv } from './kit.js';
import { fmtShort } from '../engine/units.js';

const G = GRID;

/** Behavioural voltage-output element; subclasses implement f(xs, s) → y. */
export class VBlock extends Element {
  static category = 'Control & Math';
  static prefix = 'B';
  static nin = 1;
  nonlinear = true;
  constructor(x, y) { super(x, y); this.postCurrents = new Array(this.localPosts().length).fill(0); this.dy = []; }
  nIn() { return this.constructor.nin; }
  inPosts() { return Array.from({ length: this.nIn() }, (_, i) => i); }
  outPost() { return this.nIn(); }
  outRef() { return 0; }
  rout() { return 0; }
  localPosts() {
    const n = this.nIn(), ys = n === 1 ? [0] : n === 2 ? [-G, G] : n === 3 ? [-G, 0, G] : Array.from({ length: n }, (_, i) => (i - Math.floor(n / 2)) * G);
    return [...ys.map((y) => [-2 * G, y]), [2 * G, 0]];
  }
  localBox() { const n = this.nIn(), h = n <= 2 ? 1.3 * G : n === 3 ? 1.6 * G : ((n + 1) / 2) * G; return [-2 * G, -h, 2 * G, h]; }
  leads() { return this.localPosts().map(([x, y], i) => [i, x, y, Math.sign(x) * 1.2 * G, y]); }
  connectivity() { return [[this.outPost(), 'gnd']]; }
  branchCount() { return 1; }
  xs(s) { return this.inPosts().map((p) => s.v(this.nodes[p])); }
  f() { return 0; }
  /** y and dy/dx (numerical by default) */
  eval(xs, s) {
    const y = this.f(xs, s);
    const d = xs.map((_, k) => numDeriv((z) => this.f(z, s), xs, k));
    return { y, d };
  }
  stamp(s) {
    const o = this.nodes[this.outPost()], k = this.branches[0], r = this.outRef();
    s.addBranchKCL(o, r, k); s.addA(k, o - 1, 1); s.addA(k, r - 1, -1);
    if (this.rout() > 0) s.addA(k, k, -this.rout());
  }
  stampNL(s) {
    const k = this.branches[0], xs = this.xs(s), { y, d } = this.eval(xs, s);
    let c = y;
    this.inPosts().forEach((p, i) => { const dd = Number.isFinite(d[i]) ? Math.max(-1e9, Math.min(1e9, d[i])) : 0; s.addA(k, this.nodes[p] - 1, -dd); c -= dd * xs[i]; });
    s.b[k] += Number.isFinite(c) ? c : 0;
    this.dy = d;
  }
  accept(s) {
    const xs = this.xs(s), io = s.x[this.branches[0]];
    this.post(xs, s);
    this.postCurrents.fill(0); this.postCurrents[this.outPost()] = io; this.i = io;
    this.yv = s.v(this.nodes[this.outPost()]);
  }
  post() {}
  stampAC(ac) {
    const o = this.nodes[this.outPost()], k = this.branches[0], r = this.outRef();
    ac.addBranchKCL(o, r, k); ac.addA(k, o - 1, 1); ac.addA(k, r - 1, -1);
    if (this.rout() > 0) ac.addA(k, k, -this.rout());
    this.inPosts().forEach((p, i) => { if (this.dy[i]) ac.addA(k, this.nodes[p] - 1, -this.dy[i]); });
  }
  valueLabel() { return ''; }
  readings(s) {
    const xs = this.xs(s), names = this.constructor.inNames || ['u', 'v', 'w'];
    return [...xs.map((x, i) => [`Input ${names[i] || i + 1}`, x, 'V']), ['Output', s.v(this.nodes[this.outPost()]), 'V']];
  }
  glyph() { return this.constructor.glyph || '?'; }
  draw(g) {
    const [, y1, , y2] = this.localBox();
    g.box(-1.2 * G, y1 + 3, 1.2 * G, y2 - 3, { stroke: g.body, width: g.lw * 0.9, fill: g.fill, r: 3 });
    const gl = this.glyph();
    g.upright(() => g.text(gl, 0, 0.5, { size: gl.length > 4 ? 7.5 : gl.length > 2 ? 9 : 12, color: g.accent, bold: true, mono: gl.length > 4 }));
    const names = this.constructor.inLabels;
    // pin names just inside the left edge, pulled toward the middle so they clear the corners
    const ys = this.localPosts().slice(0, this.nIn()).map(([, y]) => y), lim = Math.max(0, (y2 - y1) / 2 - 0.55 * G);
    if (names) ys.forEach((y, i) => g.text(names[i], -0.98 * G, Math.max(-lim, Math.min(lim, y)), { size: 7, color: g.muted, align: 'left' }));
  }
}

/** Block whose dynamics are a single-input LTI system driven by u = Σ wᵢ·xᵢ. */
class LTIBlock extends VBlock {
  constructor(x, y) { super(x, y); this.lti = this.makeLTI(); }
  weights() { return [1]; }
  makeLTI() { return new LTI([[0]], [0], [0], 1); }
  onParamChange() { const x = this.lti?.x; this.lti = this.makeLTI(); if (x && x.length === this.lti.n) this.lti.x = x; }
  reset() { this.lti = this.makeLTI(); this.lti.reset(this.x0?.()); }
  u(xs) { const w = this.weights(); return xs.reduce((a, x, i) => a + (w[i] ?? 0) * x, 0); }
  clampY(y) { return y; }
  eval(xs, s) {
    const { a, c } = this.lti.coeffs(s), w = this.weights();
    const y = a * this.u(xs) + c, yc = this.clampY(y);
    const sl = yc === y ? 1 : 0;
    return { y: yc, d: xs.map((_, i) => sl * a * (w[i] ?? 0)) };
  }
  post(xs, s) { this.lti.accept(s, this.u(xs)); }
}

const K = (def = 1, label = 'Gain K') => ({ key: 'k', label, unit: '', def, min: -1e9, max: 1e9, knob: true });

// ------------------------------------------------------------- algebraic
export class GainBlock extends VBlock {
  static type = 'gain'; static title = 'Gain Block K'; static glyph = 'K';
  static keywords = 'gain block amplifier scale constant multiply control';
  static props = [K(2)];
  static description = 'y = K·u';
  eval(xs) { return { y: this.p.k * xs[0], d: [this.p.k] }; }
  glyph() { return `×${+this.p.k.toPrecision(3)}`; }
  draw(g) {
    g.poly([[-1.2 * G, -1.1 * G], [1.2 * G, 0], [-1.2 * G, 1.1 * G]], { stroke: g.body, width: g.lw * 0.9, fill: g.fill, close: true });
    g.upright(() => g.text('K', 0, 0.5, { size: 10, color: g.accent, bold: true }), -0.4 * G, 0);
  }
  valueLabel() { return `K=${+this.p.k.toPrecision(4)}`; }
}
register(GainBlock);

export class Sum2 extends VBlock {
  static type = 'sum2'; static title = 'Summer Σ (2 inputs)'; static nin = 2; static glyph = 'Σ';
  static keywords = 'summer sum adder subtract difference error comparator summing junction block';
  static props = [{ key: 'k1', label: 'Weight of input 1', unit: '', def: 1, min: -1e6, max: 1e6 }, { key: 'k2', label: 'Weight of input 2', unit: '', def: -1, min: -1e6, max: 1e6 }];
  static inLabels = ['+', '−'];
  static description = 'y = k1·u1 + k2·u2 (default u1 − u2: an error signal).';
  eval(xs) { return { y: this.p.k1 * xs[0] + this.p.k2 * xs[1], d: [this.p.k1, this.p.k2] }; }
  draw(g) {
    g.circle(0, 0, 1.05 * G, { stroke: g.body, width: g.lw * 0.9, fill: g.fill });
    g.upright(() => g.text('Σ', 0, 0.5, { size: 13, color: g.accent, bold: true }));
    const sg = (k) => (k >= 0 ? '+' : '−');
    g.text(sg(this.p.k1), -1.45 * G, -1.35 * G, { size: 9, color: g.muted, bold: true });
    g.text(sg(this.p.k2), -1.45 * G, 0.65 * G, { size: 9, color: g.muted, bold: true });
  }
}
register(Sum2);

export class Sum3 extends VBlock {
  static type = 'sum3'; static title = 'Summer Σ (3 inputs)'; static nin = 3; static glyph = 'Σ';
  static keywords = 'summer three input adder mixer';
  static props = [1, 2, 3].map((i) => ({ key: 'k' + i, label: `Weight of input ${i}`, unit: '', def: 1, min: -1e6, max: 1e6 }));
  static description = 'y = k1·u1 + k2·u2 + k3·u3';
  eval(xs) { return { y: this.p.k1 * xs[0] + this.p.k2 * xs[1] + this.p.k3 * xs[2], d: [this.p.k1, this.p.k2, this.p.k3] }; }
}
register(Sum3);

export class MultBlock extends VBlock {
  static type = 'mult'; static title = 'Multiplier ×'; static nin = 2; static glyph = '×';
  static keywords = 'multiplier product mixer modulator multiply block';
  static props = [K(1, 'Scale')];
  static description = 'y = K·u1·u2 (ideal multiplier — mixers, modulators, power calculation).';
  eval(xs) { const k = this.p.k; return { y: k * xs[0] * xs[1], d: [k * xs[1], k * xs[0]] }; }
}
register(MultBlock);

export class DivBlock extends VBlock {
  static type = 'div'; static title = 'Divider ÷'; static nin = 2; static glyph = '÷';
  static keywords = 'divider division ratio block';
  static props = [K(1, 'Scale'), { key: 'eps', label: 'Minimum |denominator|', unit: 'V', def: 1e-6, min: 1e-15, max: 1 }];
  static inLabels = ['n', 'd'];
  static description = 'y = K·u1 / u2 (denominator limited to ±ε to avoid division by zero).';
  eval(xs) {
    const e = this.p.eps, d = Math.abs(xs[1]) < e ? (xs[1] >= 0 ? e : -e) : xs[1], k = this.p.k;
    return { y: (k * xs[0]) / d, d: [k / d, Math.abs(xs[1]) < e ? 0 : (-k * xs[0]) / (d * d)] };
  }
}
register(DivBlock);

export class Saturation extends VBlock {
  static type = 'limiter'; static title = 'Saturation / Limiter'; static glyph = '⊓';
  static keywords = 'saturation limiter clamp clip bound block nonlinearity';
  static props = [{ key: 'hi', label: 'Upper limit', unit: 'V', def: 5, min: -1e6, max: 1e6, knob: true }, { key: 'lo', label: 'Lower limit', unit: 'V', def: -5, min: -1e6, max: 1e6 }];
  static description = 'y = clamp(u, lower, upper).';
  eval(xs) { const u = xs[0]; return u > this.p.hi ? { y: this.p.hi, d: [0] } : u < this.p.lo ? { y: this.p.lo, d: [0] } : { y: u, d: [1] }; }
  glyph() { return '⌐¬'; }
}
register(Saturation);

function fnBlock(type, title, glyph, keywords, desc, f, props = []) {
  const C = class extends VBlock {};
  Object.assign(C, { type, title, glyph, keywords, description: desc, props });
  C.prototype.f = f;
  register(C);
  return C;
}
fnBlock('absb', 'Absolute Value |u|', '|u|', 'absolute value rectifier magnitude block', 'y = |u| (ideal full-wave rectifier).', function (xs) { return Math.abs(xs[0]); });
fnBlock('sqrtb', 'Square Root √u', '√u', 'square root block', 'y = √u (0 for negative inputs).', function (xs) { return Math.sqrt(Math.max(0, xs[0])); });
fnBlock('powb', 'Power uⁿ', 'uⁿ', 'power exponent square cube block', 'y = sign(u)·|u|ⁿ (odd-symmetric), or |u|ⁿ when "even" is set.', function (xs) {
  const u = xs[0], m = Math.pow(Math.abs(u), this.p.n); return this.p.even ? m : Math.sign(u) * m;
}, [{ key: 'n', label: 'Exponent n', unit: '', def: 2, min: -10, max: 10, knob: true }, { key: 'even', label: 'Even (|u|ⁿ)', type: 'bool', def: true }]);
fnBlock('logb', 'Logarithm', 'log', 'logarithm ln log10 log amplifier block decibel', 'y = K·log(max(u, ε)) — natural or base-10.', function (xs) {
  const u = Math.max(xs[0], 1e-12); return this.p.k * (this.p.base === '10' ? Math.log10(u) : Math.log(u));
}, [K(1, 'Scale'), { key: 'base', label: 'Base', type: 'select', def: 'e', options: [['e', 'Natural (ln)'], ['10', 'Base 10']] }]);
fnBlock('expb', 'Exponential eᵘ', 'eᵘ', 'exponential antilog block', 'y = K·e^u (u limited to 80).', function (xs) { return this.p.k * Math.exp(Math.min(80, xs[0])); }, [K(1, 'Scale')]);
fnBlock('trigb', 'Trig Function', 'sin', 'sine cosine tangent arctangent trigonometric block', 'y = K·trig(u) with u in radians.', function (xs) {
  const u = xs[0]; return this.p.k * ({ sin: Math.sin, cos: Math.cos, tan: Math.tan, atan: Math.atan }[this.p.fn] || Math.sin)(u);
}, [K(1, 'Scale'), { key: 'fn', label: 'Function', type: 'select', def: 'sin', options: [['sin', 'sin'], ['cos', 'cos'], ['tan', 'tan'], ['atan', 'atan']] }]);

export class FuncBlock extends VBlock {
  static type = 'fcn'; static title = 'Function Block f(u,v,t)'; static nin = 2; static glyph = 'f(u,v)';
  static keywords = 'function block expression formula custom nonlinear math behavioural arbitrary';
  static props = [{ key: 'expr', label: 'y =', type: 'text', def: 'u*v + 0.5*sin(2*pi*50*t)' }, K(1, 'Parameter k')];
  static inLabels = ['u', 'v'];
  static description = 'Output from any formula of the inputs u, v, time t and parameter k (same functions as the Function Source). Derivatives are computed numerically for Newton’s method.';
  f(xs, s) { const [fn] = exprFn(this.p.expr, ['u', 'v', 't', 'k']); return fn({ u: xs[0], v: xs[1], t: s.mode === 'dc' ? 0 : s.tNext ?? s.t, k: this.p.k }); }
  readings(s) { const [, err] = exprFn(this.p.expr, ['u', 'v', 't', 'k']); return err ? [['Formula error', err, '']] : super.readings(s); }
}
register(FuncBlock);

// ---------------------------------------------------------------- dynamic
export class Integrator extends LTIBlock {
  static type = 'integ'; static title = 'Integrator ∫'; static glyph = '∫';
  static keywords = 'integrator integral block accumulate control';
  static props = [K(1, 'Gain Ki (1/s)'), { key: 'y0', label: 'Initial output', unit: 'V', def: 0, min: -1e6, max: 1e6 },
    { key: 'lim', label: 'Output limit ± (0 = none)', unit: 'V', def: 0, min: 0, max: 1e6 }];
  static description = 'y = Ki·∫u dt + y0 (trapezoidal integration, optional output limit with anti-windup).';
  makeLTI() { return new LTI([[0]], [this.p.k], [1], 0); }
  x0() { return [this.p.y0]; }
  clampY(y) { const L = this.p.lim; return L > 0 ? Math.max(-L, Math.min(L, y)) : y; }
  post(xs, s) {
    super.post(xs, s);
    const L = this.p.lim;
    if (L > 0) this.lti.x[0] = Math.max(-L, Math.min(L, this.lti.x[0]));
  }
  glyph() { return '1/s'; }
}
register(Integrator);

export class Differentiator extends LTIBlock {
  static type = 'deriv'; static title = 'Differentiator d/dt'; static glyph = 'du/dt';
  static keywords = 'differentiator derivative block rate';
  static props = [K(1, 'Gain Kd (s)'), { key: 'tau', label: 'Filter time constant', unit: 's', def: 1e-4, min: 1e-12, max: 100, log: true }];
  static description = 'y = Kd·s/(τs + 1)·u — a derivative with a small first-order filter so it stays well-behaved.';
  makeLTI() { const t = this.p.tau, k = this.p.k; return new LTI([[-1 / t]], [1 / t], [-k / t], k / t); }
  glyph() { return 's'; }
}
register(Differentiator);

export class TF1 extends LTIBlock {
  static type = 'tf1'; static title = 'Transfer Function (1st order)'; static glyph = 'K/(τs+1)';
  static keywords = 'transfer function first order low pass lag plant time constant laplace';
  static props = [K(1, 'DC gain K'), { key: 'tau', label: 'Time constant τ', unit: 's', def: 1e-3, min: 1e-12, max: 1e6, log: true }];
  static description = 'G(s) = K / (τs + 1): first-order lag (e.g. a plant, sensor or low-pass filter).';
  makeLTI() { const t = this.p.tau; return new LTI([[-1 / t]], [this.p.k / t], [1], 0); }
}
register(TF1);

export class TF2 extends LTIBlock {
  static type = 'tf2'; static title = 'Transfer Function (2nd order)'; static glyph = 'ωn²/(s²…)';
  static keywords = 'transfer function second order resonance damping ratio natural frequency plant';
  static props = [K(1, 'DC gain K'), { key: 'fn', label: 'Natural frequency fn', unit: 'Hz', def: 100, min: 1e-6, max: 1e9, log: true },
    { key: 'zeta', label: 'Damping ratio ζ', unit: '', def: 0.3, min: 0, max: 20 }];
  static description = 'G(s) = K·ωn² / (s² + 2ζωn·s + ωn²): standard second-order system — step response overshoot, resonance.';
  makeLTI() { const w = 2 * Math.PI * this.p.fn, z = this.p.zeta; return new LTI([[0, 1], [-w * w, -2 * z * w]], [0, w * w], [this.p.k, 0], 0); }
}
register(TF2);

export class PIDBlock extends LTIBlock {
  static type = 'pid'; static title = 'PID Controller'; static nin = 2; static glyph = 'PID';
  static keywords = 'pid controller proportional integral derivative closed loop control';
  static props = [
    { key: 'kp', label: 'Kp', unit: '', def: 1, min: 0, max: 1e6, knob: true },
    { key: 'ki', label: 'Ki (1/s)', unit: '', def: 10, min: 0, max: 1e9 },
    { key: 'kd', label: 'Kd (s)', unit: '', def: 0, min: 0, max: 1e3 },
    { key: 'tf', label: 'Derivative filter τ', unit: 's', def: 1e-3, min: 1e-9, max: 10, log: true },
    { key: 'umax', label: 'Output max', unit: 'V', def: 10, min: -1e6, max: 1e6 },
    { key: 'umin', label: 'Output min', unit: 'V', def: -10, min: -1e6, max: 1e6 },
  ];
  static inLabels = ['SP', 'PV'];
  static description = 'Parallel PID on the error e = SP − PV: u = Kp·e + Ki∫e + Kd·de/dt (filtered), with output limits and integrator anti-windup.';
  weights() { return [1, -1]; }
  makeLTI() { const { kp, ki, kd, tf } = this.p; return new LTI([[0, 0], [0, -1 / tf]], [1, 1 / tf], [ki, -kd / tf], kp + kd / tf); }
  clampY(y) { return Math.max(this.p.umin, Math.min(this.p.umax, y)); }
  post(xs, s) {
    const xi = this.lti.x[0];
    super.post(xs, s);
    // anti-windup: do not integrate further into saturation
    const y = this.lti.output(this.u(xs)), e = this.u(xs);
    if ((y > this.p.umax && e > 0) || (y < this.p.umin && e < 0)) this.lti.x[0] = xi;
  }
  valueLabel() { return `Kp${+this.p.kp.toPrecision(3)} Ki${+this.p.ki.toPrecision(3)} Kd${+this.p.kd.toPrecision(3)}`; }
}
register(PIDBlock);

export class TransportDelay extends VBlock {
  static type = 'delay'; static title = 'Transport Delay'; static glyph = 'e⁻ˢᵀ';
  static keywords = 'transport delay dead time lag block';
  static props = [{ key: 'td', label: 'Delay T', unit: 's', def: 1e-3, min: 0, max: 100, knob: true }];
  static description = 'y(t) = u(t − T): pure time delay (dead time).';
  reset() { this.h = []; }
  eval(xs, s) {
    const t = (s.mode === 'dc' ? 0 : s.tNext) - this.p.td, h = this.h || [];
    if (s.mode === 'dc' || !h.length) return { y: s.mode === 'dc' ? xs[0] : h.length ? h[0][1] : 0, d: [s.mode === 'dc' ? 1 : 0] };
    if (t <= h[0][0]) return { y: h[0][1], d: [0] };
    let i = h.length - 1;
    while (i > 0 && h[i - 1][0] > t) i--;
    const [t0, y0] = h[Math.max(0, i - 1)], [t1, y1] = h[i];
    return { y: t >= t1 ? y1 : y0 + ((y1 - y0) * (t - t0)) / Math.max(1e-30, t1 - t0), d: [0] };
  }
  post(xs, s) {
    if (s.mode === 'dc') { this.h = [[0, xs[0]]]; return; }
    this.h.push([s.t, xs[0]]);
    while (this.h.length > 2 && this.h[1][0] < s.t - this.p.td * 1.2 - 1e-9) this.h.shift();
  }
  valueLabel() { return fmtShort(this.p.td, 's'); }
}
register(TransportDelay);

export class ZOH extends VBlock {
  static type = 'zoh'; static title = 'Zero-Order Hold (sampler)'; static glyph = 'ZOH';
  static keywords = 'zero order hold sampler sample and hold discrete digital control sampling';
  static props = [{ key: 'ts', label: 'Sample period', unit: 's', def: 1e-3, min: 1e-9, max: 100, knob: true }];
  static description = 'Samples the input every Ts and holds it — models the sampling of a digital controller or ADC.';
  reset() { this.hold = 0; this.next = 0; }
  eval(xs, s) { return s.mode === 'dc' ? { y: xs[0], d: [1] } : { y: this.hold, d: [0] }; }
  post(xs, s) {
    if (s.mode === 'dc') { this.hold = xs[0]; this.next = this.p.ts; return; }
    if (s.t >= this.next - 1e-12) { if (this.hold !== xs[0]) s.event = true; this.hold = xs[0]; this.next = s.t + this.p.ts; }
  }
  valueLabel() { return fmtShort(this.p.ts, 's'); }
}
register(ZOH);

export class RateLimiter extends VBlock {
  static type = 'ratelim'; static title = 'Rate Limiter'; static glyph = '⟋';
  static keywords = 'rate limiter slew rate ramp limit soft start block';
  static props = [{ key: 'r', label: 'Max rate', unit: 'V/s', def: 1000, min: 1e-6, max: 1e12, log: true, knob: true }];
  static description = 'Output follows the input but changes no faster than ±R (slew-rate limit / soft start).';
  reset() { this.yp = null; }
  eval(xs, s) {
    if (s.mode === 'dc' || this.yp === null) return { y: xs[0], d: [1] };
    const m = this.p.r * s.dt, d = xs[0] - this.yp;
    return Math.abs(d) <= m ? { y: xs[0], d: [1] } : { y: this.yp + Math.sign(d) * m, d: [0] };
  }
  post(xs, s) { this.yp = this.eval(xs, s).y; if (s.mode === 'dc') this.yp = xs[0]; }
  valueLabel() { return `${fmtShort(this.p.r, 'V')}/s`; }
}
register(RateLimiter);

export class RelayBlock extends VBlock {
  static type = 'hystb'; static title = 'Relay (Hysteresis)'; static glyph = '⊐⊏';
  static keywords = 'relay hysteresis bang bang on off control schmitt block thermostat';
  static props = [
    { key: 'on', label: 'Switch-on point', unit: 'V', def: 0.5, min: -1e6, max: 1e6, knob: true },
    { key: 'off', label: 'Switch-off point', unit: 'V', def: -0.5, min: -1e6, max: 1e6 },
    { key: 'yon', label: 'Output when on', unit: 'V', def: 1, min: -1e6, max: 1e6 },
    { key: 'yoff', label: 'Output when off', unit: 'V', def: 0, min: -1e6, max: 1e6 },
  ];
  static description = 'Two-level relay with hysteresis (bang-bang control): turns on when u > on-point, off when u < off-point.';
  reset() { this.st = false; }
  eval() { return { y: this.st ? this.p.yon : this.p.yoff, d: [0] }; }
  preStep(s) { const u = this.xs(s)[0], n = this.st ? u > this.p.off : u > this.p.on; if (n !== this.st) { this.st = n; s.event = true; } }
  digitalSettle(s) { const u = this.xs(s)[0], n = this.st ? u > this.p.off : u > this.p.on; if (n !== this.st) { this.st = n; return true; } return false; }
}
register(RelayBlock);
