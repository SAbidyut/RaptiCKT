// Communication and signal-processing blocks (behavioural — no firmware):
//  - analog filter block: low/high/band-pass/band-stop, Butterworth /
//    Chebyshev (1 dB) / Bessel, order 1–8 (exact AC response, implicit
//    time-domain cascade of biquads)
//  - RF amplifier, mixer, envelope detector, antenna, EMI line filter
//  - audio preamplifier and Baxandall-style tone control
//  - UART transmitter / receiver, RS-485, RS-232 and CAN transceivers
//  - wireless link with protocol presets (path loss, sensitivity, latency),
//    RFID reader (125 kHz, UART output) and fibre-optic link

import { Element, register, getType, GRID } from './base.js';
import { VBlock } from './blocks.js';
import { LTI, withChip, Composite } from './kit.js';
import { Chip, P } from './digital2.js';
import { DIGI_PROPS } from './digital.js';
import { Capacitor, Resistor } from './passive.js';
import { fmtQty, fmtShort } from '../engine/units.js';

const G = GRID;
const TAU = 2 * Math.PI;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const db = (x) => Math.pow(10, x / 20);

// ============================================================ filter design
// complex helpers
const C = (re, im = 0) => ({ re, im });
const cmul = (a, b) => C(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
const cdiv = (a, b) => { const d = b.re * b.re + b.im * b.im; return C((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d); };
const cadd = (a, b) => C(a.re + b.re, a.im + b.im);
const csub = (a, b) => C(a.re - b.re, a.im - b.im);
const cabs = (a) => Math.hypot(a.re, a.im);
const csqrt = (a) => { const r = cabs(a), re = Math.sqrt(Math.max(0, (r + a.re) / 2)), im = Math.sign(a.im || 1) * Math.sqrt(Math.max(0, (r - a.re) / 2)); return C(re, im); };

/** roots of a real polynomial (coefficients low → high) by Durand–Kerner */
function roots(c) {
  const n = c.length - 1, a = c.map((v) => v / c[n]);
  let z = Array.from({ length: n }, (_, k) => cmul(C(0.4, 0.9), C(Math.cos(k), Math.sin(k))));
  const ev = (x) => { let r = C(a[n]); for (let k = n - 1; k >= 0; k--) r = cadd(cmul(r, x), C(a[k])); return r; };
  for (let it = 0; it < 500; it++) {
    let move = 0;
    z = z.map((zi, i) => {
      let den = C(1);
      z.forEach((zj, j) => { if (j !== i) den = cmul(den, csub(zi, zj)); });
      const d = cdiv(ev(zi), den);
      move = Math.max(move, cabs(d));
      return csub(zi, d);
    });
    if (move < 1e-14) break;
  }
  return z;
}
const fact = (n) => (n <= 1 ? 1 : n * fact(n - 1));

/** normalised low-pass prototype poles (cut-off 1 rad/s) and gain factor */
function prototype(resp, n) {
  if (resp === 'cheby') {
    const eps = Math.sqrt(Math.pow(10, 0.1) - 1), v = Math.asinh(1 / eps) / n;
    const p = Array.from({ length: n }, (_, k) => { const th = (Math.PI * (2 * k + 1)) / (2 * n); return C(-Math.sinh(v) * Math.sin(th), Math.cosh(v) * Math.cos(th)); });
    return { p, k: n % 2 ? 1 : 1 / Math.sqrt(1 + eps * eps) };
  }
  if (resp === 'bessel') {
    const c = Array.from({ length: n + 1 }, (_, k) => fact(2 * n - k) / (Math.pow(2, n - k) * fact(k) * fact(n - k)));
    let p = roots(c);
    // normalise to −3 dB at 1 rad/s
    const mag = (w, pp) => pp.reduce((m, q) => m * cabs(q) / cabs(csub(C(0, w), q)), 1);
    let lo = 0.1, hi = 10;
    for (let it = 0; it < 80; it++) { const m = Math.sqrt(lo * hi); if (mag(m, p) > Math.SQRT1_2) lo = m; else hi = m; }
    const w3 = Math.sqrt(lo * hi);
    p = p.map((q) => C(q.re / w3, q.im / w3));
    return { p, k: 1 };
  }
  return { p: Array.from({ length: n }, (_, k) => { const th = (Math.PI * (2 * k + n + 1)) / (2 * n); return C(Math.cos(th), Math.sin(th)); }), k: 1 };
}

/**
 * Real s-domain sections [{b:[b0,b1,b2], a:[a0,a1,a2]}] for the requested
 * filter. fc: cut-off (LP/HP) or centre frequency (BP/BS) in Hz, bw in Hz.
 */
export function designFilter(type, resp, order, fc, bw) {
  const n = clamp(Math.round(order), 1, 8), wc = TAU * fc, B = TAU * Math.max(bw, 1e-9);
  const { p, k } = prototype(resp, n);
  // keep one of each conjugate pair (im ≥ 0) plus the real poles
  const poles = p.filter((q) => q.im > 1e-9 || Math.abs(q.im) <= 1e-9).map((q) => (Math.abs(q.im) <= 1e-9 ? C(q.re, 0) : q));
  const secs = [];
  for (const q of poles) {
    const real = q.im === 0, m2 = q.re * q.re + q.im * q.im, m = Math.sqrt(m2);
    if (type === 'lp') secs.push(real ? { b: [-q.re * wc, 0, 0], a: [-q.re * wc, 1, 0] } : { b: [m2 * wc * wc, 0, 0], a: [m2 * wc * wc, -2 * q.re * wc, 1] });
    else if (type === 'hp') {
      // s → wc/s : pole q → wc/q
      if (real) secs.push({ b: [0, 1, 0], a: [wc / -q.re, 1, 0] });
      else { const w0 = wc / m, Q = m / (-2 * q.re); secs.push({ b: [0, 0, 1], a: [w0 * w0, w0 / Q, 1] }); }
    } else {
      const w0 = wc;
      if (type === 'bp') {
        // (−q)·B·s / (s² − qB s + w0²)
        if (real) secs.push({ b: [0, -q.re * B, 0], a: [w0 * w0, -q.re * B, 1] });
        else {
          const qb = C(q.re * B, q.im * B), disc = csub(cmul(qb, qb), C(4 * w0 * w0)), sq = csqrt(disc);
          for (const r of [C((qb.re + sq.re) / 2, (qb.im + sq.im) / 2), C((qb.re - sq.re) / 2, (qb.im - sq.im) / 2)]) secs.push({ b: [0, m * B, 0], a: [r.re * r.re + r.im * r.im, -2 * r.re, 1] });
        }
      } else {
        // (s² + w0²) / (s² − (B/q) s + w0²)
        if (real) secs.push({ b: [w0 * w0, 0, 1], a: [w0 * w0, -B / q.re, 1] });
        else {
          const bq = cdiv(C(B), q), disc = csub(cmul(bq, bq), C(4 * w0 * w0)), sq = csqrt(disc);
          for (const r of [C((bq.re + sq.re) / 2, (bq.im + sq.im) / 2), C((bq.re - sq.re) / 2, (bq.im - sq.im) / 2)]) secs.push({ b: [w0 * w0, 0, 1], a: [r.re * r.re + r.im * r.im, -2 * r.re, 1] });
        }
      }
    }
  }
  if (secs.length) secs[0] = { ...secs[0], b: secs[0].b.map((v) => v * k) };
  return secs;
}
/** H(jω) of a section list */
export function freqResp(secs, w) {
  let h = C(1);
  for (const { b, a } of secs) {
    const s = C(0, w), s2 = cmul(s, s);
    const num = cadd(cadd(C(b[0]), cmul(C(b[1]), s)), cmul(C(b[2]), s2)), den = cadd(cadd(C(a[0]), cmul(C(a[1]), s)), cmul(C(a[2]), s2));
    h = cmul(h, cdiv(num, den));
  }
  return h;
}
function secLTI({ b, a }) {
  if (a[2]) { const a0 = a[0] / a[2], a1 = a[1] / a[2], b0 = b[0] / a[2], b1 = b[1] / a[2], b2 = b[2] / a[2]; return new LTI([[0, 1], [-a0, -a1]], [0, 1], [b0 - b2 * a0, b1 - b2 * a1], b2); }
  if (a[1]) { const a0 = a[0] / a[1], b0 = b[0] / a[1], b1 = b[1] / a[1]; return new LTI([[-a0]], [1], [b0 - b1 * a0], b1); }
  return new LTI([[0]], [0], [0], b[0] / a[0]);
}

/**
 * Signal block: input (to ground, Zin), output = clip(H(s)·u) through Rout.
 * H is a cascade of real biquads; the AC analysis uses the exact H(jω).
 */
class SigChain extends VBlock {
  static category = 'Communication';
  constructor(x, y) { super(x, y); this.build(); }
  sections() { return []; }
  gain() { return 1; }
  zin() { return 1e9; }
  rout() { return this.p.rout ?? 0; }
  clipLevel() { return 0; }
  build() { this.secs = this.sections(); this.ltis = this.secs.map(secLTI); }
  onParamChange() { this.build(); }
  reset() { this.build(); for (const l of this.ltis) l.reset(); }
  chain(s) { let a = this.gain(), c = 0; for (const l of this.ltis) { const k = l.coeffs(s); a *= k.a; c = k.a * c + k.c; } return { a, c }; }
  eval(xs, s) {
    const { a, c } = this.chain(s), y = a * xs[0] + c, L = this.clipLevel();
    if (!(L > 0)) return { y, d: [a] };
    const t = Math.tanh(y / L);
    return { y: L * t, d: [a * (1 - t * t)] };
  }
  post(xs, s) {
    let u = xs[0] * this.gain();
    for (const l of this.ltis) { l.accept(s, u); u = l.output(u); }
  }
  stamp(s) { super.stamp(s); if (this.zin() < 1e9) s.addG(this.nodes[0], 0, 1 / this.zin()); }
  stampAC(ac) {
    const o = this.nodes[this.outPost()], k = this.branches[0], h = freqResp(this.secs, ac.omega);
    ac.addBranchKCL(o, 0, k); ac.addA(k, o - 1, 1);
    if (this.rout() > 0) ac.addA(k, k, -this.rout());
    ac.addA(k, this.nodes[0] - 1, -h.re * this.gain(), -h.im * this.gain());
    if (this.zin() < 1e9) ac.addY(this.nodes[0], 0, 1 / this.zin());
  }
  accept(s) {
    super.accept(s);
    if (this.zin() < 1e9) this.postCurrents[0] = s.v(this.nodes[0]) / this.zin();
  }
  readings(s) { return [['Input', s.v(this.nodes[0]), 'V'], ['Output', s.v(this.nodes[1]), 'V']]; }
}

const RESP = { key: 'resp', label: 'Response', type: 'select', def: 'butter', options: [['butter', 'Butterworth (maximally flat)'], ['cheby', 'Chebyshev (1 dB ripple, sharp)'], ['bessel', 'Bessel (linear phase)']] };
export class FilterBlock extends SigChain {
  static type = 'filterblk'; static title = 'Active Filter Block';
  static keywords = 'filter low pass high pass band pass band stop notch butterworth chebyshev bessel order active filter anti aliasing';
  static props = [
    { key: 'fc', label: 'Cut-off / centre frequency', unit: 'Hz', def: 1000, min: 1e-3, max: 1e9, log: true, knob: true },
    { key: 'type', label: 'Type', type: 'select', def: 'lp', options: [['lp', 'Low-pass'], ['hp', 'High-pass'], ['bp', 'Band-pass'], ['bs', 'Band-stop (notch)']] },
    RESP,
    { key: 'order', label: 'Order', unit: '', def: 4, min: 1, max: 8 },
    { key: 'bw', label: 'Bandwidth (band-pass / stop)', unit: 'Hz', def: 200, min: 1e-3, max: 1e9, log: true },
    { key: 'gdb', label: 'Pass-band gain', unit: 'dB', def: 0, min: -60, max: 60 },
    { key: 'rout', label: 'Output resistance', unit: 'Ω', def: 0, min: 0, max: 1e6 },
  ];
  static description = 'Ideal active filter of order 1–8: Butterworth (flat pass band), Chebyshev (1 dB ripple, steepest roll-off) or Bessel (constant group delay, no overshoot). Low/high-pass use the cut-off frequency (−3 dB, or the ripple edge for Chebyshev); band-pass/stop use it as the centre with the given bandwidth. Roll-off = 20 dB/decade per order. Input: high impedance to ground; output: voltage source. Use the AC analysis (Bode plot) to see the exact response.';
  static nin = 1;
  sections() { return designFilter(this.p.type, this.p.resp, this.p.order, this.p.fc, this.p.bw); }
  gain() { return db(this.p.gdb); }
  glyph() { return { lp: 'LPF', hp: 'HPF', bp: 'BPF', bs: 'BSF' }[this.p.type] || 'F'; }
  valueLabel() { return `${fmtShort(this.p.fc, 'Hz')} n=${Math.round(this.p.order)}`; }
  draw(g) {
    super.draw(g);
    const ctx = g.ctx, t = this.p.type, f = (x) => (t === 'lp' ? x < 0.5 : t === 'hp' ? x > 0.5 : t === 'bp' ? Math.abs(x - 0.5) < 0.15 : Math.abs(x - 0.5) > 0.15);
    ctx.beginPath();
    for (let k = 0; k <= 20; k++) { const x = k / 20, y = f(x) ? -0.75 : -0.35; const px = -0.9 * G + x * 1.8 * G, py = y * G; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    ctx.strokeStyle = g.muted; ctx.lineWidth = g.lw * 0.5; ctx.stroke();
  }
}
register(FilterBlock);

export class RFAmp extends SigChain {
  static type = 'rfamp'; static title = 'RF Amplifier (tuned)';
  static keywords = 'rf amplifier lna tuned amplifier gain noise figure p1db compression 50 ohm band pass';
  static props = [
    { key: 'gdb', label: 'Gain', unit: 'dB', def: 20, min: -20, max: 60, knob: true },
    { key: 'f0', label: 'Centre frequency', unit: 'Hz', def: 1e6, min: 1, max: 1e10, log: true },
    { key: 'bw', label: 'Bandwidth', unit: 'Hz', def: 2e5, min: 1, max: 1e10, log: true },
    { key: 'vsat', label: 'Output limit (≈P1dB)', unit: 'V', def: 1, min: 1e-3, max: 100, log: true },
    { key: 'nf', label: 'Noise figure', unit: 'dB', def: 2, min: 0, max: 20 },
  ];
  static description = 'Tuned (band-pass) RF amplifier with 50 Ω input and output: gain at the centre frequency, 2nd-order band-pass response, and soft compression towards the output limit (gain falls 1 dB near the P1dB point). The noise figure is shown for link-budget work.';
  sections() { return designFilter('bp', 'butter', 1, this.p.f0, this.p.bw); }
  gain() { return db(this.p.gdb); }
  zin() { return 50; }
  rout() { return 50; }
  clipLevel() { return this.p.vsat * 1.15; }
  glyph() { return 'RF'; }
  valueLabel() { return `${Math.round(this.p.gdb)} dB ${fmtShort(this.p.f0, 'Hz')}`; }
  readings(s) { return [...super.readings(s), ['Gain', this.p.gdb, 'dB'], ['Noise figure', this.p.nf, 'dB'], ['Output P1dB (50 Ω)', 10 * Math.log10((this.p.vsat ** 2 / 100) / 1e-3), 'dBm']]; }
  draw(g) {
    g.poly([[-1.2 * G, -1.1 * G], [1.2 * G, 0], [-1.2 * G, 1.1 * G]], { stroke: g.body, width: g.lw * 0.9, fill: g.fill, close: true });
    g.upright(() => g.text('RF', 0, 0.5, { size: 8, color: g.accent, bold: true }), -0.45 * G, 0);
  }
}
register(RFAmp);

export class Preamp extends SigChain {
  static type = 'preamp'; static title = 'Audio Preamplifier'; static category = 'Output';
  static keywords = 'audio preamplifier preamp microphone line amplifier gain bandwidth 20hz 20khz clipping';
  static props = [
    { key: 'gdb', label: 'Gain', unit: 'dB', def: 30, min: -20, max: 80, knob: true },
    { key: 'fl', label: 'Low cut-off', unit: 'Hz', def: 20, min: 0.1, max: 1e4, log: true },
    { key: 'fh', label: 'High cut-off', unit: 'Hz', def: 20000, min: 100, max: 1e6, log: true },
    { key: 'vsat', label: 'Clipping level', unit: 'V', def: 10, min: 0.1, max: 100 },
  ];
  static description = 'Audio preamplifier: flat gain between the low and high cut-off frequencies (1st-order roll-offs), 47 kΩ input, 100 Ω output, soft clipping near the supply rails. Raises microphone / pickup levels (mV) to line level (≈1 V).';
  sections() { return [...designFilter('hp', 'butter', 1, this.p.fl, 0), ...designFilter('lp', 'butter', 1, this.p.fh, 0)]; }
  gain() { return db(this.p.gdb); }
  zin() { return 47e3; }
  rout() { return 100; }
  clipLevel() { return this.p.vsat; }
  glyph() { return 'PRE'; }
  valueLabel() { return `${Math.round(this.p.gdb)} dB`; }
  draw(g) {
    g.poly([[-1.2 * G, -1.1 * G], [1.2 * G, 0], [-1.2 * G, 1.1 * G]], { stroke: g.body, width: g.lw * 0.9, fill: g.fill, close: true });
    g.upright(() => g.text('PRE', 0, 0.5, { size: 7, color: g.accent, bold: true }), -0.45 * G, 0);
  }
}
register(Preamp);

export class ToneControl extends SigChain {
  static type = 'tonectl'; static title = 'Tone Control (bass / treble)'; static category = 'Output';
  static keywords = 'tone control bass treble baxandall equalizer shelving audio';
  static props = [
    { key: 'bass', label: 'Bass', unit: 'dB', def: 6, min: -15, max: 15, knob: true },
    { key: 'treble', label: 'Treble', unit: 'dB', def: 0, min: -15, max: 15 },
    { key: 'fb', label: 'Bass turnover', unit: 'Hz', def: 200, min: 10, max: 2000, log: true },
    { key: 'ft', label: 'Treble turnover', unit: 'Hz', def: 3000, min: 500, max: 20000, log: true },
    { key: 'vol', label: 'Volume', unit: 'dB', def: 0, min: -60, max: 20 },
  ];
  static description = 'Baxandall-style tone control: first-order shelving boost/cut below the bass turnover and above the treble turnover (±15 dB), flat in the middle, plus a volume setting. 47 kΩ input, 100 Ω output.';
  sections() {
    const gb = db(this.p.bass), gt = db(this.p.treble), wb = TAU * this.p.fb / Math.sqrt(gb), wt = TAU * this.p.ft * Math.sqrt(gt);
    return [{ b: [gb * wb, 1, 0], a: [wb, 1, 0] }, { b: [wt, gt, 0], a: [wt, 1, 0] }];
  }
  gain() { return db(this.p.vol); }
  zin() { return 47e3; }
  rout() { return 100; }
  glyph() { return 'TONE'; }
  valueLabel() { return `B${this.p.bass >= 0 ? '+' : ''}${Math.round(this.p.bass)} T${this.p.treble >= 0 ? '+' : ''}${Math.round(this.p.treble)}`; }
}
register(ToneControl);

// ------------------------------------------------------- mixer / detector
export class Mixer extends VBlock {
  static type = 'mixer'; static title = 'RF Mixer (RF × LO)'; static category = 'Communication';
  static keywords = 'mixer rf lo if frequency conversion superheterodyne multiplier double balanced';
  static nin = 2;
  static inLabels = ['RF', 'LO'];
  static props = [{ key: 'k', label: 'Conversion gain (per volt of LO)', unit: '1/V', def: 1, min: 1e-3, max: 100, log: true, knob: true }];
  static description = 'Ideal double-balanced mixer: IF = k·RF·LO. Two input tones f_RF and f_LO give the sum and difference frequencies (f_RF ± f_LO) — the heart of the superheterodyne receiver; follow it with a filter to keep the IF.';
  eval(xs) { const k = this.p.k; return { y: k * xs[0] * xs[1], d: [k * xs[1], k * xs[0]] }; }
  glyph() { return '⊗'; }
  draw(g) {
    g.circle(0, 0, 1.1 * G, { stroke: g.body, width: g.lw * 0.9, fill: g.fill });
    const d = 0.75 * G;
    g.line(-d, -d, d, d, g.body, g.lw * 0.8); g.line(-d, d, d, -d, g.body, g.lw * 0.8);
    g.text('RF', -1.0 * G, -1.3 * G, { size: 6, color: g.muted }); g.text('LO', -1.0 * G, 1.45 * G, { size: 6, color: g.muted });
  }
}
register(Mixer);

export class EnvelopeDetector extends VBlock {
  static type = 'envdet'; static title = 'Envelope Detector'; static category = 'Communication';
  static keywords = 'envelope detector am demodulator peak detector diode detector crystal radio';
  static props = [
    { key: 'tau', label: 'Discharge time constant RC', unit: 's', def: 2e-4, min: 1e-9, max: 10, log: true, knob: true },
    { key: 'vd', label: 'Diode drop', unit: 'V', def: 0, min: 0, max: 1 },
    { key: 'mode', label: 'Rectification', type: 'select', def: 'half', options: [['half', 'Half-wave (single diode)'], ['full', 'Full-wave']] },
  ];
  static description = 'Diode + RC envelope (peak) detector as an ideal block: the output follows the input peaks and decays with the RC time constant in between. Choose 1/f_carrier ≪ RC ≪ 1/f_audio to recover the audio from an AM signal without diagonal clipping.';
  reset() { this.yv = 0; this.ys = 0; }
  decayed(s) { return s.mode === 'dc' ? this.ys : this.ys * Math.exp(-s.dt / this.p.tau); }
  inp(x) { return (this.p.mode === 'full' ? Math.abs(x) : x) - this.p.vd; }
  eval(xs, s) {
    const u = this.inp(xs[0]), dcy = this.decayed(s);
    if (u > dcy) return { y: u, d: [this.p.mode === 'full' ? Math.sign(xs[0]) : 1] };
    return { y: Math.max(0, dcy), d: [0] };
  }
  post(xs, s) { this.ys = Math.max(0, Math.max(this.inp(xs[0]), this.decayed(s))); }
  glyph() { return 'ENV'; }
  draw(g) {
    super.draw(g);
    const h = 0.28 * G;
    g.poly([[-0.35 * G, 0.55 * G - h], [0.15 * G, 0.55 * G], [-0.35 * G, 0.55 * G + h]], { stroke: g.muted, width: g.lw * 0.6, close: true });
    g.line(0.15 * G, 0.55 * G - h, 0.15 * G, 0.55 * G + h, g.muted, g.lw * 0.6);
  }
}
register(EnvelopeDetector);

// ---------------------------------------------------------------- antenna
const ANT = { 'Half-wave dipole': { rr: 73, heff: 0.318 }, 'Quarter-wave monopole': { rr: 36.5, heff: 0.159 }, 'Small loop (ferrite rod)': { rr: 5, heff: 0.02 } };
export class Antenna extends Element {
  static type = 'antenna'; static title = 'Antenna'; static category = 'Communication';
  static prefix = 'ANT'; static keywords = 'antenna aerial dipole monopole radiation resistance receive transmit field strength';
  static props = [
    { key: 'e', label: 'Incident field strength (peak)', unit: 'V/m', def: 0.001, min: 0, max: 100, log: true, knob: true },
    { key: 'f', label: 'Signal frequency', unit: 'Hz', def: 1e6, min: 1, max: 1e10, log: true },
    { key: 'kind', label: 'Type', type: 'select', def: 'Half-wave dipole', options: Object.keys(ANT).map((k) => [k, k]).concat([['custom', 'Custom']]), preset: ANT },
    { key: 'rr', label: 'Radiation resistance', unit: 'Ω', def: 73, min: 0.01, max: 1e4, log: true },
    { key: 'heff', label: 'Effective length (fraction of λ)', unit: '', def: 0.318, min: 1e-4, max: 1 },
  ];
  static description = 'Antenna between its feed point and ground: as a receiver it is a source of V = E·h_eff (effective length = fraction × wavelength) behind its radiation resistance; driven by a transmitter, the power in the radiation resistance is radiated. A half-wave dipole: 73 Ω, h_eff = λ/π.';
  constructor(x, y) { super(x, y); this.postCurrents = [0]; }
  localPosts() { return [[0, 2 * G]]; }
  localBox() { return [-G, -1.6 * G, G, 2 * G]; }
  leads() { return [[0, 0, 2 * G, 0, 0.4 * G]]; }
  connectivity() { return [[0, 'gnd']]; }
  branchCount() { return 1; }
  refNode = undefined;
  reset() { this.postCurrents = [0]; this.prad = 0; }
  heff() { return this.p.heff * (3e8 / this.p.f); }
  stamp(s) { const a = this.nodes[0], k = this.branches[0]; s.addBranchKCL(a, 0, k); s.addA(k, a - 1, 1); s.addA(k, k, -this.p.rr); }
  stampStep(s) { if (s.mode !== 'dc') s.b[this.branches[0]] += this.p.e * this.heff() * Math.sin(TAU * this.p.f * s.tNext); }
  stampAC(ac) { const a = this.nodes[0], k = this.branches[0]; ac.addBranchKCL(a, 0, k); ac.addA(k, a - 1, 1); ac.addA(k, k, -this.p.rr); }
  accept(s) {
    const i = s.x[this.branches[0]];
    this.postCurrents = [i]; this.i = i;
    if (s.mode !== 'dc') this.prad += (i * i * this.p.rr - this.prad) * Math.min(1, s.dt / 1e-3);
  }
  valueLabel() { return fmtShort(this.p.f, 'Hz'); }
  readings(s) {
    const v = this.p.e * this.heff();
    return [['Open-circuit voltage (peak)', v, 'V'], ['Available power', 10 * Math.log10(Math.max(1e-30, (v * v) / (8 * this.p.rr)) / 1e-3), 'dBm'], ['Power in radiation resistance', this.prad || 0, 'W'], ['Wavelength', 3e8 / this.p.f, 'm']];
  }
  draw(g) {
    g.line(0, 0.4 * G, 0, -1.4 * G, g.body, g.lw);
    g.poly([[-0.8 * G, -1.4 * G], [0, -0.4 * G], [0.8 * G, -1.4 * G]], { stroke: g.body, width: g.lw * 0.9, close: true });
    if (g.running) for (const r of [0.5, 0.8]) { const ctx = g.ctx; ctx.beginPath(); ctx.arc(0, -1.4 * G, r * G, -Math.PI * 0.8, -Math.PI * 0.2); ctx.strokeStyle = g.accent; ctx.lineWidth = g.lw * 0.5; ctx.stroke(); }
  }
}
register(Antenna);

// ------------------------------------------------------------ EMI filter
export class EMIFilter extends withChip(Composite) {
  static type = 'emifilter'; static title = 'EMI Line Filter'; static category = 'Communication';
  static prefix = 'FL'; static keywords = 'emi filter rfi mains line filter common mode choke x capacitor y capacitor emc noise suppression';
  static props = [
    { key: 'lcm', label: 'Common-mode choke (each winding)', unit: 'H', def: 0.01, min: 1e-6, max: 1, log: true, knob: true },
    { key: 'cx', label: 'X capacitors', unit: 'F', def: 1e-7, min: 1e-10, max: 1e-5, log: true },
    { key: 'cy', label: 'Y capacitors', unit: 'F', def: 2.2e-9, min: 1e-12, max: 1e-7, log: true },
  ];
  static pins = [['L', 'L'], ['N', 'L'], ['PE', 'L'], ['L′', 'R'], ['N′', 'R']];
  static description = 'Mains EMI filter: X capacitors across the line (input and output), a common-mode choke (two tightly coupled windings that cancel for the normal load current but block common-mode noise) and Y capacitors from each output line to PE, with a bleeder resistor. Passes 50 Hz unchanged; attenuates conducted noise above ≈100 kHz (see the AC analysis).';
  parts() {
    const CL = getType('coupledl');
    return [[new Capacitor(0, 0), [0, 1]], [new Resistor(0, 0), [0, 1]], [new CL(0, 0), [0, 3, 1, 4]], [new Capacitor(0, 0), [3, 4]], [new Capacitor(0, 0), [3, 2]], [new Capacitor(0, 0), [4, 2]]];
  }
  sync() {
    if (!this.subs) return;
    const [cx1, rb, cm, cx2, cy1, cy2] = this.subs.map((s) => s.el);
    cx1.p.c = this.p.cx; cx2.p.c = this.p.cx; cy1.p.c = this.p.cy; cy2.p.c = this.p.cy; rb.p.r = 1e6;
    Object.assign(cm.p, { l1: this.p.lcm, l2: this.p.lcm, k: 0.995, r1: 0.05, r2: 0.05 });
  }
  valueLabel() { return ''; }
  readings(s) { return [['Line current', this.postCurrents[0], 'A'], ['V(L′–N′)', s.v(this.nodes[3]) - s.v(this.nodes[4]), 'V'], ['Leakage to PE', this.postCurrents[2], 'A']]; }
  draw(g) { this.drawChip(g, 'EMI'); }
}
register(EMIFilter);

// ====================================================== serial interfaces
/** frame bits for one byte: start 0, 8 data LSB first, optional parity, stop 1s */
function frame(byte, parity, stops) {
  const b = [0];
  let ones = 0;
  for (let k = 0; k < 8; k++) { const v = (byte >> k) & 1; b.push(v); ones += v; }
  if (parity === 'even') b.push(ones & 1);
  if (parity === 'odd') b.push((ones & 1) ^ 1);
  for (let k = 0; k < stops; k++) b.push(1);
  return b;
}
const UART_PROPS = [
  { key: 'baud', label: 'Baud rate', unit: 'Bd', def: 9600, min: 50, max: 1e7, log: true },
  { key: 'parity', label: 'Parity', type: 'select', def: 'none', options: [['none', 'None (8N1)'], ['even', 'Even'], ['odd', 'Odd']] },
  { key: 'stops', label: 'Stop bits', unit: '', def: 1, min: 1, max: 2 },
];
const printable = (c) => (c >= 32 && c < 127 ? String.fromCharCode(c) : '·');

export class UARTTx extends Chip {
  static type = 'uarttx'; static title = 'UART Transmitter'; static category = 'Communication';
  static chip = 'UART TX'; static keywords = 'uart serial transmitter tx asynchronous 8n1 baud rs232 ttl serial data frame';
  static pins = [P('EN', 'L', 'i'), P('TX', 'R', 'o')];
  static props = [
    { key: 'text', label: 'Message', type: 'text', def: 'HELLO' },
    ...UART_PROPS,
    { key: 'gap', label: 'Pause between messages', unit: 's', def: 2e-3, min: 0, max: 10 },
    { key: 'repeat', label: 'Repeat', type: 'bool', def: true },
    ...DIGI_PROPS,
  ];
  static description = 'Asynchronous serial transmitter (behavioural, no code): sends the message as UART frames — line idles high, each character is a start bit (0), 8 data bits LSB first, optional parity and stop bit(s) — at the set baud rate, then pauses and repeats. EN must be high (100 kΩ pull-up: unconnected = enabled).';
  resetState() { this.bits = null; this.t0 = null; this.k = -1; }
  makeBits() {
    const bits = [1, 1], txt = String(this.p.text ?? '');
    for (const ch of txt) bits.push(...frame(ch.charCodeAt(0) & 255, this.p.parity, Math.round(this.p.stops)));
    const idle = Math.ceil(this.p.gap * this.p.baud);
    for (let k = 0; k < idle; k++) bits.push(1);
    this.bits = bits;
  }
  // EN has a 100 kΩ pull-up to 5 V: unconnected means enabled
  stamp(s) { super.stamp(s); s.addG(this.nodes[0], 0, 1e-5); }
  stampStep(s) { super.stampStep(s); s.addI(0, this.nodes[0], 5e-5); }
  stampAC(ac) { super.stampAC(ac); ac.addY(this.nodes[0], 0, 1e-5); }
  readInputs(s) { const v = s.v(this.nodes[0]); return [this.inState[0] ? v > 1.5 : v > 2.5]; }
  compute() { return [true]; }
  preStep(s) {
    const en = this.readInputs(s)[0];
    this.inState = [en];
    if (s.mode === 'dc') return;
    if (!this.bits) this.makeBits();
    if (!en) { this.t0 = null; if (!this.out[0]) { this.out = [true]; s.event = true; } return; }
    this.t0 ??= s.tNext;
    let k = Math.floor((s.tNext - this.t0) * this.p.baud);
    if (k >= this.bits.length) k = this.p.repeat ? k % this.bits.length : this.bits.length - 1;
    this.k = k;
    const o = !!this.bits[k];
    if (o !== this.out[0]) { this.out = [o]; s.event = true; }
  }
  accept(s) { super.accept(s); this.postCurrents[0] = (s.v(this.nodes[0]) - 5) * 1e-5; }
  shown() { const txt = String(this.p.text ?? ''); return txt.length > 8 ? txt.slice(0, 7) + '…' : txt; }
  readings() { return [['Message', String(this.p.text ?? ''), ''], ['Transmitting', this.inState?.[0] ? 'yes' : 'no (EN low)', ''], ['Bit time', 1 / this.p.baud, 's']]; }
}
register(UARTTx);

export class UARTRx extends Chip {
  static type = 'uartrx'; static title = 'UART Receiver (terminal)'; static category = 'Communication';
  static chip = 'UART RX'; static keywords = 'uart receiver rx serial monitor terminal decoder baud framing error';
  static pins = [P('RX', 'L', 'i'), P('RDY', 'R', 'o')];
  static props = [...UART_PROPS, ...DIGI_PROPS];
  static description = 'Serial receiver / terminal: detects each start bit on RX, samples the data bits in the middle of each bit time at the set baud rate and shows the received text (framing and parity errors are counted). RDY pulses high for one bit time after every received character. Baud rate and format must match the transmitter.';
  resetState() { this.st = 'idle'; this.rx = ''; this.errs = 0; this.tS = 0; this.bitsIn = []; this.rdyUntil = 0; this.last = null; }
  compute(ins, settle) { return [false]; }
  preStep(s) {
    const ins = this.readInputs(s), t = s.tNext, Tb = 1 / this.p.baud, rx = ins[0];
    const prev = this.inState[0];
    this.inState = ins;
    if (s.mode === 'dc') return;
    const nData = 8 + (this.p.parity !== 'none' ? 1 : 0);
    if (this.st === 'idle') {
      if (prev && !rx) { this.st = 'rx'; this.tS = t; this.bitsIn = []; }
    } else {
      const k = this.bitsIn.length; // next sample: bit k+1 (after start) at its middle
      const tSample = this.tS + (k + 1.5) * Tb;
      if (t >= tSample) {
        this.bitsIn.push(rx ? 1 : 0);
        if (this.bitsIn.length === nData + 1) {
          const data = this.bitsIn.slice(0, 8), stop = this.bitsIn[nData];
          const byte = data.reduce((a, b, i) => a | (b << i), 0), ones = data.reduce((a, b) => a + b, 0);
          let ok = stop === 1;
          if (this.p.parity === 'even') ok = ok && ((ones + this.bitsIn[8]) & 1) === 0;
          if (this.p.parity === 'odd') ok = ok && ((ones + this.bitsIn[8]) & 1) === 1;
          if (ok) { this.rx = (this.rx + printable(byte)).slice(-64); this.last = byte; this.rdyUntil = t + Tb; } else this.errs++;
          this.st = 'idle';
        }
      }
    }
    const o = t < this.rdyUntil;
    if (o !== this.out[0]) { this.out = [o]; s.event = true; }
  }
  shown() { return this.rx.slice(-8); }
  readings() { return [['Received text', this.rx || '—', ''], ['Last byte', this.last == null ? '—' : `0x${this.last.toString(16).toUpperCase().padStart(2, '0')}`, ''], ['Framing / parity errors', this.errs, '']]; }
}
register(UARTRx);

// -------------------------------------------------- line transceivers
/** logic inputs with hysteresis + Norton-driven outputs */
class Xcvr extends withChip(Element) {
  static category = 'Communication';
  static prefix = 'U';
  static chipOpts = { dense: true };
  constructor(x, y) { super(x, y); this.postCurrents = new Array(this.localPosts().length).fill(0); }
  connectivity() { return null; }
  logicIns() { return []; }
  drives() { return []; } // [[post, V, G]] Norton drives (V through 1/G to ground)
  reset() { this.li = this.logicIns().map(() => false); this.resetX?.(); this.dv = this.drives(); this.postCurrents.fill(0); }
  readLogic(s) { return this.logicIns().map((pi, k) => { const v = s.v(this.nodes[pi]); return this.li[k] ? v > 1.3 : v > 2.0; }); }
  stamp(s) {
    for (const pi of this.logicIns()) s.addG(this.nodes[pi], 0, 1e-5);
    for (const [pi, , g] of this.dv) s.addG(this.nodes[pi], 0, g);
  }
  stampStep(s) { for (const [pi, v, g] of this.dv) s.addI(0, this.nodes[pi], v * g * (s.srcScale ?? 1)); }
  stampAC(ac) { for (const pi of this.logicIns()) ac.addY(this.nodes[pi], 0, 1e-5); for (const [pi, , g] of this.dv) ac.addY(this.nodes[pi], 0, g); }
  update(s) {
    const dv = this.drives();
    const gch = dv.some((d, k) => d[2] !== this.dv[k]?.[2]), vch = dv.some((d, k) => d[1] !== this.dv[k]?.[1]);
    this.dv = dv;
    if (gch) s.markEvent(); else if (vch) s.event = true;
  }
  preStep(s) { this.li = this.readLogic(s); this.logic(s); this.update(s); }
  digitalSettle(s) { const before = JSON.stringify(this.dv); this.li = this.readLogic(s); this.logic(s); this.dv = this.drives(); const ch = JSON.stringify(this.dv) !== before; if (ch) s.dirty = true; return ch; }
  logic() {}
  accept(s) {
    this.postCurrents.fill(0);
    for (const pi of this.logicIns()) this.postCurrents[pi] += s.v(this.nodes[pi]) * 1e-5;
    for (const [pi, v, g] of this.dv) this.postCurrents[pi] += (s.v(this.nodes[pi]) - v) * g;
  }
  valueLabel() { return ''; }
}

export class RS485 extends Xcvr {
  static type = 'rs485'; static title = 'RS-485 Transceiver'; static keywords = 'rs485 rs-485 max485 transceiver differential bus modbus half duplex industrial';
  static pins = [['DI', 'L'], ['DE', 'L'], ['RO', 'L'], ['A', 'R'], ['B', 'R']];
  static description = 'Half-duplex RS-485 transceiver (MAX485 style). DE high: the driver puts DI on the differential pair (A − B ≈ +3.4 V open, ≥ 1.5 V into a 54 Ω terminated bus for DI = 1; reversed for 0). DE low: the driver is off and A/B present one unit load (12 kΩ to 2.5 V). The receiver output RO = 1 when A − B > −50 mV (fail-safe: idle or terminated bus reads 1), 0 below −200 mV. Terminate both bus ends with 120 Ω.';
  logicIns() { return [0, 1]; }
  resetX() { this.ro = true; }
  logic(s) {
    const vd = s.v(this.nodes[3]) - s.v(this.nodes[4]);
    this.ro = this.ro ? vd > -0.2 : vd > -0.05;
  }
  drives() {
    const [di, de] = this.li || [false, false], ro = this.ro ?? true;
    const bus = de ? [[3, di ? 4.2 : 0.8, 1 / 25], [4, di ? 0.8 : 4.2, 1 / 25]] : [[3, 2.5, 1 / 12e3], [4, 2.5, 1 / 12e3]];
    return [[2, ro ? 5 : 0, 1 / 25], ...bus];
  }
  readings(s) { return [['Driver', this.li?.[1] ? (this.li[0] ? 'ON (1)' : 'ON (0)') : 'off (receiving)', ''], ['A − B', s.v(this.nodes[3]) - s.v(this.nodes[4]), 'V'], ['RO', this.ro ? 1 : 0, '']]; }
  draw(g) { this.drawChip(g, 'RS485'); }
}
register(RS485);

export class RS232 extends Xcvr {
  static type = 'rs232'; static title = 'RS-232 Transceiver (MAX232)'; static keywords = 'rs232 rs-232 max232 serial port com port level converter ±12v db9';
  static pins = [['TIN', 'L'], ['ROUT', 'L'], ['TOUT', 'R'], ['RIN', 'R']];
  static description = 'TTL ⇄ RS-232 level converter with built-in charge pumps: TIN (TTL) → TOUT at ±9 V, inverted (logic 1 = mark = −9 V); RIN (RS-232, 5 kΩ input) → ROUT (TTL, inverted) with thresholds ≈1.0 / 1.7 V. Cross TOUT→RIN between two of them to link two UARTs over a cable.';
  logicIns() { return [0]; }
  resetX() { this.rout = true; }
  logic(s) { const v = s.v(this.nodes[3]); this.rout = this.rout ? v < 1.7 : v < 1.0; }
  drives() { const tin = this.li?.[0] ?? false; return [[1, (this.rout ?? true) ? 5 : 0, 1 / 25], [2, tin ? -9 : 9, 1 / 300], [3, 0, 1 / 5e3]]; }
  readings(s) { return [['TOUT', s.v(this.nodes[2]), 'V'], ['RIN', s.v(this.nodes[3]), 'V'], ['ROUT', this.rout ? 1 : 0, '']]; }
  draw(g) { this.drawChip(g, 'RS232'); }
}
register(RS232);

export class CANXcvr extends Xcvr {
  static type = 'can'; static title = 'CAN Bus Transceiver'; static keywords = 'can bus transceiver mcp2551 tja1050 canh canl automotive dominant recessive differential';
  static pins = [['TXD', 'L'], ['RXD', 'L'], ['CANH', 'R'], ['CANL', 'R']];
  static description = 'High-speed CAN transceiver (TJA1050 style): TXD low = dominant — CANH is driven towards 3.5 V and CANL towards 1.5 V (≈2 V differential on a 60 Ω bus); TXD high = recessive — both lines float at 2.5 V through the bias resistors, so any dominant node wins (wired-AND arbitration). RXD = 0 when CANH − CANL > 0.9 V, 1 below 0.5 V. Terminate both bus ends with 120 Ω.';
  logicIns() { return [0]; }
  resetX() { this.rxd = true; }
  logic(s) { const vd = s.v(this.nodes[2]) - s.v(this.nodes[3]); this.rxd = this.rxd ? vd < 0.9 : vd < 0.5; }
  drives() {
    const dom = !(this.li?.[0] ?? true);
    return [[1, (this.rxd ?? true) ? 5 : 0, 1 / 25], ...(dom ? [[2, 4.0, 1 / 15], [3, 1.0, 1 / 15]] : [[2, 2.5, 1 / 25e3], [3, 2.5, 1 / 25e3]])];
  }
  reset() { super.reset(); this.li = [true]; this.dv = this.drives(); }
  readings(s) { return [['Bus state', this.rxd ? 'recessive' : 'dominant', ''], ['CANH − CANL', s.v(this.nodes[2]) - s.v(this.nodes[3]), 'V'], ['RXD', this.rxd ? 1 : 0, '']]; }
  draw(g) { this.drawChip(g, 'CAN'); }
}
register(CANXcvr);

// ------------------------------------------------------ delayed digital links
/** input history → output delayed by `delay`, pulses shorter than `minw` dropped */
class DelayLine {
  constructor() { this.reset(false); }
  reset(v) { this.q = []; this.cur = v; this.out = v; }
  push(t, v) { if (v !== this.cur) { this.cur = v; this.q.push([t, v]); } }
  at(t, delay, minw) {
    while (this.q.length && this.q[0][0] + delay <= t) {
      const [t0, v] = this.q.shift();
      // glitch filter: drop a change that is undone within minw
      if (this.q.length && this.q[0][0] - t0 < minw) { this.q.shift(); continue; }
      this.out = v;
    }
    return this.out;
  }
}

const RADIOS = {
  '433 MHz ASK module': { f: 433.92e6, ptx: 10, sens: -105, rate: 4800, lat: 5e-4 },
  'nRF24L01 (2.4 GHz)': { f: 2.44e9, ptx: 0, sens: -94, rate: 250e3, lat: 2e-4 },
  'Bluetooth LE': { f: 2.44e9, ptx: 4, sens: -95, rate: 1e6, lat: 7.5e-3 },
  'Wi-Fi (802.11n)': { f: 2.437e9, ptx: 20, sens: -82, rate: 65e6, lat: 2e-3 },
  'LoRa (SF7, 868 MHz)': { f: 868e6, ptx: 14, sens: -123, rate: 5470, lat: 0.05 },
  'Zigbee (2.4 GHz)': { f: 2.44e9, ptx: 3, sens: -100, rate: 250e3, lat: 0.01 },
};
const ENV = { free: 2, indoor: 3, urban: 3.5 };
export class WirelessLink extends withChip(Element) {
  static type = 'wireless'; static title = 'Wireless Link (TX → RX)'; static category = 'Communication';
  static prefix = 'RF'; static keywords = 'wireless link radio module 433mhz nrf24 bluetooth wifi lora zigbee transmitter receiver range rssi path loss';
  static props = [
    { key: 'd', label: 'Distance', unit: 'm', def: 20, min: 0.1, max: 1e5, log: true, knob: true },
    { key: 'proto', label: 'Radio', type: 'select', def: '433 MHz ASK module', options: Object.keys(RADIOS).map((k) => [k, k]).concat([['custom', 'Custom']]), preset: RADIOS },
    { key: 'env', label: 'Environment', type: 'select', def: 'indoor', options: [['free', 'Line of sight (n = 2)'], ['indoor', 'Indoor (n = 3)'], ['urban', 'Urban / obstructed (n = 3.5)']] },
    { key: 'f', label: 'Frequency', unit: 'Hz', def: 433.92e6, min: 1e3, max: 1e11, log: true },
    { key: 'ptx', label: 'Transmit power', unit: 'dBm', def: 10, min: -40, max: 40 },
    { key: 'sens', label: 'Receiver sensitivity', unit: 'dBm', def: -105, min: -150, max: 0 },
    { key: 'rate', label: 'Data rate', unit: 'bit/s', def: 4800, min: 1, max: 1e9, log: true },
    { key: 'lat', label: 'Latency', unit: 's', def: 5e-4, min: 0, max: 10 },
    { key: 'gant', label: 'Antenna gains (TX + RX)', unit: 'dBi', def: 0, min: -20, max: 40 },
    { key: 'mode', label: 'Signal', type: 'select', def: 'digital', options: [['digital', 'Digital (logic levels)'], ['analog', 'Analog (audio / sensor value)']] },
    ...DIGI_PROPS,
  ];
  static pins = [['IN', 'L'], ['OUT', 'R']];
  static description = 'Behavioural radio link (transmitter + receiver as one part, no firmware): received power = Ptx + antenna gains − path loss, with path loss = free-space loss at 1 m + 10·n·log10(d). If it is above the receiver sensitivity the output reproduces the input after the radio’s latency (digital: pulses shorter than one bit at the data rate are lost; analog: received with noise that grows as the margin shrinks); out of range the output stays low. Presets: 433 MHz ASK, nRF24L01, Bluetooth LE, Wi-Fi, LoRa, Zigbee.';
  constructor(x, y) { super(x, y); this.postCurrents = [0, 0]; this.dl = new DelayLine(); }
  connectivity() { return [[0, 'gnd'], [1, 'gnd']]; }
  pl() { const lam = 3e8 / this.p.f; return 20 * Math.log10((4 * Math.PI) / lam) + 10 * (ENV[this.p.env] || 3) * Math.log10(Math.max(this.p.d, 0.01)); }
  rssi() { return this.p.ptx + this.p.gant - this.pl(); }
  margin() { return this.rssi() - this.p.sens; }
  reset() { this.dl.reset(false); this.hist = []; this.vout = 0; this.inHi = false; this.seed = 12345; this.postCurrents = [0, 0]; }
  rnd() { this.seed = (this.seed * 1103515245 + 12345) % 2147483648; return this.seed / 2147483648 - 0.5; }
  stamp(s) { s.addG(this.nodes[0], 0, 1e-6); s.addG(this.nodes[1], 0, 1 / this.p.rout); }
  stampStep(s) { s.addI(0, this.nodes[1], (this.vout * (s.srcScale ?? 1)) / this.p.rout); }
  stampAC(ac) { ac.addY(this.nodes[0], 0, 1e-6); ac.addY(this.nodes[1], 0, 1 / this.p.rout); }
  preStep(s) {
    if (s.mode === 'dc') return;
    const t = s.tNext, vin = s.v(this.nodes[0]), up = this.margin() >= 0;
    let v;
    if (this.p.mode === 'digital') {
      const th = this.p.vdd / 2;
      this.inHi = this.inHi ? vin > th * 0.8 : vin > th * 1.2;
      this.dl.push(s.t, this.inHi);
      const o = this.dl.at(t, this.p.lat, 1 / this.p.rate);
      v = up && o ? this.p.vdd : 0;
    } else {
      this.hist.push([s.t, vin]);
      while (this.hist.length > 2 && this.hist[1][0] <= t - this.p.lat) this.hist.shift();
      const x = this.hist[0][0] <= t - this.p.lat ? this.hist[0][1] : 0;
      const nrms = up ? 0.3 * Math.pow(10, -this.margin() / 20) : 0.3;
      v = (up ? x : 0) + nrms * this.rnd();
    }
    if (v !== this.vout) { if (this.p.mode === 'digital') s.event = true; this.vout = v; }
  }
  accept(s) { const io = (s.v(this.nodes[1]) - this.vout) / this.p.rout, ii = s.v(this.nodes[0]) * 1e-6; this.postCurrents = [ii, io]; this.i = io; }
  valueLabel() { return `${fmtQty(this.p.d, 'm')} ${this.margin() >= 0 ? 'OK' : 'NO LINK'}`; }
  readings() {
    return [['Received power (RSSI)', this.rssi(), 'dBm'], ['Path loss', this.pl(), 'dB'], ['Link margin', this.margin(), 'dB'], ['Link', this.margin() >= 0 ? 'up' : 'out of range', ''], ['Data rate', this.p.rate, 'bit/s']];
  }
  draw(g) {
    this.drawChip(g, 'RF LINK');
    const ok = this.margin() >= 0, ctx = g.ctx;
    for (const r of [0.25, 0.45]) { ctx.beginPath(); ctx.arc(0, 0.35 * G, r * G, -Math.PI * 0.75, -Math.PI * 0.25); ctx.strokeStyle = ok ? g.accent : g.lo; ctx.lineWidth = g.lw * 0.6; ctx.stroke(); }
  }
}
register(WirelessLink);

export class RFIDReader extends Chip {
  static type = 'rfid'; static title = 'RFID Reader (125 kHz, UART out)'; static category = 'Communication';
  static chip = 'RFID'; static keywords = 'rfid reader rdm6300 em4100 125khz tag card uart access control';
  static pins = [P('TX', 'R', 'o'), P('TAG', 'R', 'o')];
  static props = [
    { key: 'd', label: 'Tag distance', unit: 'cm', def: 10, min: 0, max: 50, knob: true },
    { key: 'id', label: 'Tag ID (10 hex digits)', type: 'text', def: '0A1B2C3D4E' },
    { key: 'range', label: 'Read range', unit: 'cm', def: 5, min: 0.5, max: 20 },
    { key: 'baud', label: 'Baud rate', unit: 'Bd', def: 9600, min: 300, max: 115200, log: true },
    ...DIGI_PROPS,
  ];
  static description = 'Behavioural 125 kHz RFID reader (RDM6300 style): while a tag is within the read range, TAG goes high and the tag ID is sent on TX as UART text (9600 8N1) framed by STX/ETX, repeated every 0.1 s. Connect TX to a UART receiver to see the ID.';
  resetState() { this.bits = null; this.t0 = null; }
  compute(ins, settle) { return [true, false]; }
  inRange() { return this.p.d <= this.p.range; }
  preStep(s) {
    if (s.mode === 'dc') return;
    const t = s.tNext, near = this.inRange();
    if (!this.bits) {
      const bits = [1, 1, ...frame(2, 'none', 1)];
      for (const ch of String(this.p.id ?? '')) bits.push(...frame(ch.charCodeAt(0) & 255, 'none', 1));
      bits.push(...frame(3, 'none', 1));
      const idle = Math.max(0, Math.ceil(0.1 * this.p.baud) - bits.length);
      for (let k = 0; k < idle; k++) bits.push(1);
      this.bits = bits;
    }
    let tx = true;
    if (near) { this.t0 ??= t; tx = !!this.bits[Math.floor((t - this.t0) * this.p.baud) % this.bits.length]; } else this.t0 = null;
    const o = [tx, near];
    if (o[0] !== this.out[0] || o[1] !== this.out[1]) { this.out = o; s.event = true; }
  }
  shown() { return this.inRange() ? String(this.p.id ?? '').slice(0, 10) : ''; }
  readings() { return [['Tag', this.inRange() ? 'in range' : 'out of range', ''], ['Tag ID', String(this.p.id ?? ''), ''], ['Distance', this.p.d, 'cm']]; }
}
register(RFIDReader);

const FIBERS = {
  'Plastic POF (650 nm)': { att: 200, ptx: -3, sens: -25 },
  'Multimode glass (850 nm)': { att: 3, ptx: -10, sens: -30 },
  'Single-mode (1310 nm)': { att: 0.35, ptx: -5, sens: -34 },
};
export class FiberLink extends Chip {
  static type = 'fiber'; static title = 'Fibre-Optic Link'; static category = 'Communication';
  static chip = 'FIBRE'; static keywords = 'fiber fibre optic link transmitter receiver pof multimode single mode attenuation optical power budget';
  static pins = [P('IN', 'L', 'i'), P('OUT', 'R', 'o')];
  static props = [
    { key: 'len', label: 'Fibre length', unit: 'm', def: 20, min: 0.01, max: 2e5, log: true, knob: true },
    { key: 'fib', label: 'Fibre', type: 'select', def: 'Plastic POF (650 nm)', options: Object.keys(FIBERS).map((k) => [k, k]).concat([['custom', 'Custom']]), preset: FIBERS },
    { key: 'att', label: 'Attenuation', unit: 'dB/km', def: 200, min: 0.1, max: 1000, log: true },
    { key: 'ptx', label: 'Transmitter power', unit: 'dBm', def: -3, min: -40, max: 10 },
    { key: 'sens', label: 'Receiver sensitivity', unit: 'dBm', def: -25, min: -60, max: 0 },
    { key: 'conn', label: 'Connector losses', unit: 'dB', def: 2, min: 0, max: 20 },
    ...DIGI_PROPS,
  ];
  static description = 'Optical link: LED/laser transmitter → fibre → photodiode receiver with a comparator. Received power = Ptx − attenuation × length − connector losses; above the receiver sensitivity the output reproduces the input after the propagation delay (≈4.9 ns per metre, n = 1.47); below it the output stays low. Immune to electrical noise and provides galvanic isolation.';
  resetState() { this.dl = new DelayLine(); }
  prx() { return this.p.ptx - (this.p.att * this.p.len) / 1000 - this.p.conn; }
  compute(ins, settle) { return [settle ? (this.prx() >= this.p.sens && ins[0]) : this.out[0]]; }
  preStep(s) {
    const ins = this.readInputs(s);
    this.inState = ins;
    if (s.mode === 'dc') return;
    this.dl.push(s.t, ins[0]);
    const o = this.prx() >= this.p.sens && this.dl.at(s.tNext, (this.p.len * 1.47) / 3e8, 0);
    if (o !== this.out[0]) { this.out = [o]; s.event = true; }
  }
  readings(s) { return [['Received power', this.prx(), 'dBm'], ['Margin', this.prx() - this.p.sens, 'dB'], ['Delay', (this.p.len * 1.47) / 3e8, 's'], ...super.readings(s)]; }
}
register(FiberLink);
