// Analog ICs: operational amplifier macromodel, comparator, 555 timer,
// linear voltage regulators.

import { Element, register, GRID } from './base.js';
import { CapState } from './semis.js';
import { fmtShort } from '../engine/units.js';

const G = GRID;

const OPAMP_PRESETS = {
  Ideal: { a0: 1e6, gbw: 0, sr: 0, vpos: 15, vneg: -15, drop: 0, rout: 0 },
  LM741: { a0: 2e5, gbw: 1e6, sr: 0.5e6, vpos: 15, vneg: -15, drop: 1.5, rout: 75 },
  LM358: { a0: 1e5, gbw: 1e6, sr: 0.3e6, vpos: 5, vneg: 0, drop: 0.02, rout: 50 },
  TL071: { a0: 2e5, gbw: 3e6, sr: 13e6, vpos: 15, vneg: -15, drop: 1.5, rout: 50 },
  OPA2134: { a0: 1e6, gbw: 8e6, sr: 20e6, vpos: 15, vneg: -15, drop: 1, rout: 30 },
  'Rail-to-rail 5V': { a0: 1e5, gbw: 10e6, sr: 10e6, vpos: 5, vneg: 0, drop: 0.01, rout: 20 },
};

/** smooth symmetric saturation with unity slope near 0 */
function sat(u, h) {
  if (h <= 0) return { y: 0, d: 0 };
  const P = 20;
  const r = Math.abs(u / h);
  if (r > 60) return { y: Math.sign(u) * h, d: 0 };
  const q = 1 + Math.pow(r, P);
  const y = u / Math.pow(q, 1 / P);
  const d = 1 / Math.pow(q, 1 / P + 1);
  return { y, d };
}

export class OpAmp extends Element {
  static type = 'opamp'; static title = 'Op-Amp'; static category = 'Analog ICs';
  static prefix = 'U'; static keywords = 'operational amplifier opamp lm741 lm358 tl071 amplifier';
  static props = [
    { key: 'model', label: 'Model', type: 'select', def: 'Ideal', options: Object.keys(OPAMP_PRESETS).map((k) => [k, k]).concat([['custom', 'Custom']]), preset: OPAMP_PRESETS },
    { key: 'a0', label: 'Open-loop gain A₀', unit: 'V/V', def: 1e6, min: 1, max: 1e9, log: true },
    { key: 'gbw', label: 'Gain-bandwidth (0 = ∞)', unit: 'Hz', def: 0, min: 0, max: 1e10 },
    { key: 'sr', label: 'Slew rate (0 = ∞)', unit: 'V/s', def: 0, min: 0, max: 1e12 },
    { key: 'vpos', label: 'Positive supply', unit: 'V', def: 15, min: -1000, max: 1000, knob: true },
    { key: 'vneg', label: 'Negative supply', unit: 'V', def: -15, min: -1000, max: 1000 },
    { key: 'drop', label: 'Output headroom', unit: 'V', def: 0, min: 0, max: 10 },
    { key: 'rout', label: 'Output resistance', unit: 'Ω', def: 0, min: 0, max: 1e4 },
  ];
  static description = 'Operational amplifier macromodel: finite open-loop gain, single-pole GBW, slew-rate limiting, output swing limited to the supply rails (implicit supply pins).';
  nonlinear = true;
  constructor(x, y) { super(x, y); this.postCurrents = [0, 0, 0]; this.cx = new CapState(); }
  // posts: 0 = inverting (−), 1 = non-inverting (+), 2 = output
  localPosts() { return [[-2 * G, -G], [-2 * G, G], [2 * G, 0]]; }
  localBox() { return [-2 * G, -1.8 * G, 2 * G, 1.8 * G]; }
  leads() { return [[0, -2 * G, -G, -1.3 * G, -G], [1, -2 * G, G, -1.3 * G, G], [2, 2 * G, 0, 1.3 * G, 0]]; }
  connectivity() { return [[0, 1], [2, 'gnd', 'i0']]; }
  internalNodeCount() { return 1; }
  branchCount() { return 1; }
  labelPos() { return [0, -2.3 * G]; }
  valueLabel() { return this.p.model === 'custom' ? '' : this.p.model; }
  limits() {
    const hi = this.p.vpos - this.p.drop, lo = this.p.vneg + this.p.drop;
    return { mid: (hi + lo) / 2, half: Math.max(1e-3, (hi - lo) / 2) };
  }
  tau() { return this.p.gbw > 0 ? this.p.a0 / (2 * Math.PI * this.p.gbw) : 0; }
  reset() { this.cx.reset(0); this.postCurrents = [0, 0, 0]; this.i = 0; this.vdOld = 0; }
  stamp(s) {
    const x = this.inodes[0], k = this.branches[0], out = this.nodes[2];
    s.addG(x, 0, 1);
    this.cx.stamp(s, x, 0, this.tau());
    s.addBranchKCL(out, 0, k);
    s.addA(k, out - 1, 1);
    if (this.p.rout > 0) s.addA(k, k, -this.p.rout);
  }
  stampStep(s) { this.cx.step(s, this.inodes[0], 0, this.tau()); }
  drive(vd) {
    const { mid, half } = this.limits();
    const a0 = this.p.a0;
    if (this.p.gbw > 0) {
      const isat = this.p.sr > 0 ? this.p.sr * this.tau() : 4 * half * a0;
      const u = (a0 * vd) / isat;
      const th = Math.tanh(u);
      return { f: mid + isat * th, df: a0 * (1 - th * th) };
    }
    const u = (a0 * vd) / half;
    const th = Math.tanh(u);
    return { f: mid + half * th, df: a0 * (1 - th * th) };
  }
  stampNL(s) {
    const [inn, inp] = this.nodes, x = this.inodes[0], k = this.branches[0];
    let vd = s.v(inp) - s.v(inn);
    const { mid, half } = this.limits();
    // input step limiting keeps Newton from overshooting the tanh knee
    const lim = (4 * half) / this.p.a0 + 0.5;
    if (Math.abs(vd - this.vdOld) > lim) { vd = this.vdOld + Math.sign(vd - this.vdOld) * lim; s.limited = true; }
    this.vdOld = vd;
    const { f, df } = this.drive(vd);
    // current f injected from ground into x: equivalent to current flowing x -> ground of -f
    s.addNLCurrent(0, x, f, [[inp, inn, df, vd]]);
    // anti-windup clamps on the integrator node
    if (this.p.gbw > 0) {
      const xv = s.v(x), m = 1.25 * half, vc = 0.05 * half + 0.01;
      const up = Math.exp(Math.min(60, (xv - mid - m) / vc)), dn = Math.exp(Math.min(60, (mid - m - xv) / vc));
      const gc = 1e3;
      const ic = gc * vc * (up - dn), gcl = gc * (up + dn);
      s.addNLCurrent(x, 0, ic, [[x, 0, gcl, xv]]);
    }
    // output = mid + sat(x - mid)
    const xv = s.v(x);
    const st = this.p.gbw > 0 ? sat(xv - mid, half) : { y: xv - mid, d: 1 };
    s.addA(k, x - 1, -st.d);
    s.b[k] += mid + st.y - st.d * xv;
    this.smd = st.d; this.smdf = df;
  }
  accept(s) {
    const [inn, inp] = this.nodes, x = this.inodes[0];
    this.vdOld = s.v(inp) - s.v(inn);
    this.cx.accept(s, x, 0, this.tau());
    const io = s.x[this.branches[0]];
    this.postCurrents = [0, 0, io];
    this.i = io;
    const xv = s.v(x), { mid, half } = this.limits();
    this.smd = this.p.gbw > 0 ? sat(xv - mid, half).d : 1;
    this.smdf = this.drive(this.vdOld).df;
  }
  stampAC(ac) {
    const [inn, inp, out] = this.nodes, x = this.inodes[0], k = this.branches[0];
    ac.addY(x, 0, 1, ac.omega * this.tau());
    ac.addVCCS(0, x, inp, inn, this.smdf ?? this.p.a0);
    ac.addBranchKCL(out, 0, k);
    ac.addA(k, out - 1, 1);
    if (this.p.rout > 0) ac.addA(k, k, -this.p.rout);
    ac.addA(k, x - 1, -(this.smd ?? 1));
  }
  readings(s) {
    const [inn, inp, out] = this.nodes;
    return [['V+', s.v(inp), 'V'], ['V−', s.v(inn), 'V'], ['Vdiff', s.v(inp) - s.v(inn), 'V'], ['Vout', s.v(out), 'V'], ['Iout', -this.i, 'A']];
  }
  spice(n) {
    const p = this.p;
    return `* ${this.name}: op-amp macromodel A0=${p.a0} GBW=${p.gbw} rails ${p.vneg}..${p.vpos}\nE${this.name} ${n[2]} 0 ${n[1]} ${n[0]} ${p.a0}`;
  }
  draw(g) {
    g.poly([[-1.3 * G, -1.7 * G], [1.5 * G, 0], [-1.3 * G, 1.7 * G]], { stroke: g.body, width: g.lw, fill: g.fill, close: true, join: 'round' });
    g.text('−', -0.95 * G, -G, { size: 13, color: g.text2, bold: true });
    g.text('+', -0.95 * G, G, { size: 13, color: g.text2, bold: true });
    g.line(1.3 * G, 0, 1.5 * G, 0, g.vc(g.pv(2)), g.lw);
  }
}
register(OpAmp);

export class Comparator extends Element {
  static type = 'comparator'; static title = 'Comparator'; static category = 'Analog ICs';
  static prefix = 'U'; static keywords = 'comparator lm393 lm339 schmitt threshold';
  static props = [
    { key: 'vhigh', label: 'Output high', unit: 'V', def: 5, min: -100, max: 100 },
    { key: 'vlow', label: 'Output low', unit: 'V', def: 0, min: -100, max: 100 },
    { key: 'hyst', label: 'Hysteresis', unit: 'V', def: 0.01, min: 0, max: 10, knob: true },
    { key: 'rout', label: 'Output resistance', unit: 'Ω', def: 10, min: 0.01, max: 1e5 },
  ];
  static description = 'Voltage comparator with hysteresis: output is high when V+ > V−.';
  constructor(x, y) { super(x, y); this.postCurrents = [0, 0, 0]; this.state = false; }
  localPosts() { return [[-2 * G, -G], [-2 * G, G], [2 * G, 0]]; }
  localBox() { return [-2 * G, -1.8 * G, 2 * G, 1.8 * G]; }
  leads() { return [[0, -2 * G, -G, -1.3 * G, -G], [1, -2 * G, G, -1.3 * G, G], [2, 2 * G, 0, 1.3 * G, 0]]; }
  connectivity() { return [[0, 1], [2, 'gnd']]; }
  valueLabel() { return ''; }
  reset() { this.state = false; }
  evalState(s) {
    const vd = s.v(this.nodes[1]) - s.v(this.nodes[0]), h = this.p.hyst / 2;
    return this.state ? vd > -h : vd > h;
  }
  preStep(s) { this.state = this.evalState(s); }
  digitalSettle(s) { const n = this.evalState(s); if (n !== this.state) { this.state = n; return true; } return false; }
  stamp(s) { s.addG(this.nodes[2], 0, 1 / this.p.rout); }
  stampStep(s) { s.addI(0, this.nodes[2], (this.state ? this.p.vhigh : this.p.vlow) / this.p.rout); }
  accept(s) {
    const io = (s.v(this.nodes[2]) - (this.state ? this.p.vhigh : this.p.vlow)) / this.p.rout;
    this.postCurrents = [0, 0, io]; this.i = io;
    const ns = this.evalState(s);
    if (ns !== this.state) s.event = true;
  }
  stampAC(ac) { ac.addY(this.nodes[2], 0, 1 / this.p.rout); }
  draw(g) {
    g.poly([[-1.3 * G, -1.7 * G], [1.5 * G, 0], [-1.3 * G, 1.7 * G]], { stroke: g.body, width: g.lw, fill: g.fill, close: true, join: 'round' });
    g.text('−', -0.95 * G, -G, { size: 13, color: g.text2, bold: true });
    g.text('+', -0.95 * G, G, { size: 13, color: g.text2, bold: true });
    g.poly([[-0.4 * G, 0.3 * G], [-0.1 * G, 0.3 * G], [-0.1 * G, -0.3 * G], [0.3 * G, -0.3 * G]], { stroke: this.state ? g.hi : g.muted, width: g.lw * 0.7 });
    g.line(1.3 * G, 0, 1.5 * G, 0, g.vc(g.pv(2)), g.lw);
  }
}
register(Comparator);

// ---------------------------------------------------------------- 555 timer
export class Timer555 extends Element {
  static type = 'timer555'; static title = '555 Timer'; static category = 'Analog ICs';
  static prefix = 'U'; static keywords = '555 ne555 timer astable monostable oscillator';
  static props = [
    { key: 'rout', label: 'Output resistance', unit: 'Ω', def: 10, min: 0.1, max: 1e4 },
    { key: 'vdrop', label: 'Output high drop', unit: 'V', def: 1.7, min: 0, max: 5 },
  ];
  static description = 'NE555 timer: internal 5k/5k/5k divider, two comparators, SR flip-flop, output stage and discharge transistor.';
  static pins = ['VCC', 'GND', 'TRIG', 'THR', 'CTRL', 'RST', 'OUT', 'DIS'];
  constructor(x, y) { super(x, y); this.postCurrents = new Array(8).fill(0); this.q = false; }
  localPosts() {
    // VCC, GND, TRIG, THR, CTRL, RST, OUT, DIS  (DIS/THR/TRIG on the left for clean astable wiring)
    return [[-G, -4 * G], [0, 4 * G], [-3 * G, 2 * G], [-3 * G, 0], [3 * G, 2 * G], [G, -4 * G], [3 * G, -2 * G], [-3 * G, -2 * G]];
  }
  localBox() { return [-3 * G, -4 * G, 3 * G, 4 * G]; }
  leads() {
    return this.localPosts().map(([x, y], i) => [i, x, y, Math.abs(x) === 3 * G ? Math.sign(x) * 2 * G : x, Math.abs(y) === 4 * G ? Math.sign(y) * 3 * G : y]);
  }
  internalNodeCount() { return 1; }
  valueLabel() { return ''; }
  labelPos() { return [0, 4.6 * G]; }
  reset() { this.q = false; this.vccPrev = 0; }
  evalQ(s) {
    const [vcc, gnd, trig, thr, ctrl, rst] = this.nodes;
    const vg = s.v(gnd), vtr = s.v(this.inodes[0]);
    if (s.v(rst) - vg < 0.7) return false;
    if (s.v(trig) < vtr) return true;
    if (s.v(thr) > s.v(ctrl)) return false;
    return this.q;
  }
  preStep(s) {
    const q = this.evalQ(s);
    if (q !== this.q) { this.q = q; s.markEvent(); }
    this.vccPrev = s.v(this.nodes[0]);
  }
  digitalSettle(s) { const q = this.evalQ(s); if (q !== this.q) { this.q = q; s.dirty = true; return true; } return false; }
  stamp(s) {
    const [vcc, gnd, , , ctrl, , out, dis] = this.nodes, n1 = this.inodes[0];
    s.addG(vcc, ctrl, 1 / 5000); s.addG(ctrl, n1, 1 / 5000); s.addG(n1, gnd, 1 / 5000);
    const go = 1 / this.p.rout;
    if (this.q) s.addG(vcc, out, go); else s.addG(out, gnd, go);
    s.addG(dis, gnd, this.q ? 1e-9 : 1 / 10);
    s.addG(vcc, gnd, 1 / 2e4); // quiescent current
  }
  stampStep(s) {
    const [vcc, gnd, , , , , out] = this.nodes, go = 1 / this.p.rout;
    if (this.q) s.addI(vcc, out, -go * this.p.vdrop); else s.addI(out, gnd, -go * 0.05);
  }
  accept(s) {
    const [vcc, gnd, trig, thr, ctrl, rst, out, dis] = this.nodes, n1 = this.inodes[0];
    const V = (n) => s.v(n), go = 1 / this.p.rout;
    const iDiv1 = (V(vcc) - V(ctrl)) / 5000, iDiv3 = (V(n1) - V(gnd)) / 5000;
    const iq = (V(vcc) - V(gnd)) / 2e4;
    const iout = this.q ? go * (V(vcc) - V(out) - this.p.vdrop) : -go * (V(out) - V(gnd) - 0.05);
    const idis = (V(dis) - V(gnd)) * (this.q ? 1e-9 : 0.1);
    const ictrl = (V(ctrl) - V(vcc)) / 5000 + (V(ctrl) - V(n1)) / 5000;
    this.postCurrents = [iDiv1 + iq + (this.q ? iout : 0), -(iDiv3 + iq + (this.q ? 0 : -iout) + idis), 0, 0, ictrl, 0, -iout, idis];
    this.i = iout;
    if (this.evalQ(s) !== this.q) s.event = true;
  }
  stampAC(ac) {
    const [vcc, gnd, , , ctrl, , out, dis] = this.nodes, n1 = this.inodes[0];
    ac.addY(vcc, ctrl, 1 / 5000); ac.addY(ctrl, n1, 1 / 5000); ac.addY(n1, gnd, 1 / 5000);
    ac.addY(out, this.q ? vcc : gnd, 1 / this.p.rout);
    ac.addY(dis, gnd, this.q ? 1e-9 : 0.1);
  }
  readings(s) {
    const [vcc, gnd, trig, thr, ctrl, , out] = this.nodes;
    return [['Output', this.q ? 'HIGH' : 'LOW', ''], ['VCC', s.v(vcc) - s.v(gnd), 'V'], ['TRIG', s.v(trig), 'V'], ['THR', s.v(thr), 'V'], ['CTRL', s.v(ctrl), 'V'], ['OUT', s.v(out), 'V']];
  }
  draw(g) {
    g.box(-2 * G, -3 * G, 2 * G, 3 * G, { stroke: g.body, width: g.lw * 0.9, fill: g.fill, r: 5 });
    g.text('555', 0.15 * G, -0.9 * G, { size: 15, color: g.accent, bold: true });
    g.circle(0.15 * G, 0.9 * G, 4, { fill: this.q ? g.hi : g.lo });
    const lab = (t, x, y, al) => g.text(t, x, y, { size: 8, color: g.muted, align: al });
    lab('VCC', -G, -2.55 * G, 'center'); lab('RST', G, -2.55 * G, 'center'); lab('GND', 0, 2.55 * G, 'center');
    lab('DIS', -1.85 * G, -2 * G, 'left'); lab('THR', -1.85 * G, 0, 'left'); lab('TRIG', -1.85 * G, 2 * G, 'left');
    lab('OUT', 1.85 * G, -2 * G, 'right'); lab('CTRL', 1.85 * G, 2 * G, 'right');
  }
}
register(Timer555);

// ------------------------------------------------------------ regulators
function smin(a, b, e) {
  const d = a - b, r = Math.sqrt(d * d + e * e);
  return { y: (a + b - r) / 2, da: 0.5 * (1 - d / r), db: 0.5 * (1 + d / r) };
}

export class Regulator extends Element {
  static type = 'reg78'; static title = '78xx Regulator'; static category = 'Analog ICs';
  static prefix = 'U'; static keywords = 'regulator 7805 7812 ldo linear voltage regulator power supply';
  static props = [
    { key: 'vout', label: 'Output voltage', unit: 'V', def: 5, min: 0.5, max: 60, knob: true },
    { key: 'vdo', label: 'Dropout voltage', unit: 'V', def: 2, min: 0.05, max: 5 },
    { key: 'ilim', label: 'Current limit', unit: 'A', def: 1.5, min: 1e-3, max: 20, log: true },
  ];
  static description = 'Fixed linear regulator (7805 family): Vout = min(Vset, Vin − Vdropout) with current limiting.';
  nonlinear = true;
  adj = false;
  constructor(x, y) { super(x, y); this.postCurrents = [0, 0, 0]; }
  // posts: IN, OUT, GND/ADJ
  localPosts() { return [[-2 * G, 0], [2 * G, 0], [0, 2 * G]]; }
  localBox() { return [-2 * G, -G, 2 * G, 2 * G]; }
  leads() { return [[0, -2 * G, 0, -1.2 * G, 0], [1, 2 * G, 0, 1.2 * G, 0], [2, 0, 2 * G, 0, 0.8 * G]]; }
  branchCount() { return 1; }
  labelPos() { return [0, -1.5 * G]; }
  valueLabel() { return this.adj ? 'LM317' : fmtShort(this.p.vout, 'V'); }
  vset() { return this.adj ? 1.25 : this.p.vout; }
  reset() { this.postCurrents = [0, 0, 0]; }
  stamp(s) {
    const [inp, out] = this.nodes, k = this.branches[0];
    s.addBranchKCL(inp, out, k);
    s.addA(k, out - 1, 1);
  }
  stampNL(s) {
    const [inp, out, gnd] = this.nodes, k = this.branches[0];
    const vin = s.v(inp), vg = s.v(gnd), io = s.x[k];
    // current limit: effective set point droops when io exceeds ilim
    const over = Math.max(0, io - this.p.ilim);
    const vs = this.vset() - over * 50;
    const m1 = smin(vs, vin - vg - this.p.vdo, 0.05);
    const m2 = smin(-m1.y, 0.02, 0.02); // smooth max(y, -0.02) = -smin(-y, 0.02)
    const y = -m2.y, dy = m2.da; // d(-smin(-y))/dy = da
    const dvin = dy * m1.db, dvs = dy * m1.da;
    const dio = over > 0 ? -50 * dvs : 0;
    // row: v_out - v_g - y(vin - vg, io) = 0
    s.addA(k, gnd - 1, -1 + dvin);
    s.addA(k, inp - 1, -dvin);
    s.addA(k, k, -dio);
    s.b[k] += y - dvin * (vin - vg) - dio * io;
    this.dy = { dvin };
  }
  accept(s) {
    const io = s.x[this.branches[0]];
    this.postCurrents = [io, -io, 0];
    this.i = io;
  }
  stampAC(ac) {
    const [inp, out, gnd] = this.nodes, k = this.branches[0];
    const dvin = this.dy ? this.dy.dvin : 0;
    ac.addBranchKCL(inp, out, k);
    ac.addA(k, out - 1, 1); ac.addA(k, gnd - 1, -1 + dvin); ac.addA(k, inp - 1, -dvin);
  }
  readings(s) {
    const [inp, out, gnd] = this.nodes;
    return [['Vin', s.v(inp) - s.v(gnd), 'V'], ['Vout', s.v(out) - s.v(gnd), 'V'], ['Iout', this.i, 'A'], ['Dissipation', (s.v(inp) - s.v(out)) * this.i, 'W']];
  }
  draw(g) {
    g.box(-1.2 * G, -0.8 * G, 1.2 * G, 0.8 * G, { stroke: g.body, width: g.lw * 0.9, fill: g.fill, r: 4 });
    g.text(this.adj ? '317' : '78xx', 0, -0.15 * G, { size: 10, color: g.accent, bold: true });
    g.text('IN', -0.85 * G, 0.4 * G, { size: 7, color: g.muted, align: 'left' });
    g.text('OUT', 0.85 * G, 0.4 * G, { size: 7, color: g.muted, align: 'right' });
    g.text(this.adj ? 'ADJ' : 'GND', 0, 0.55 * G, { size: 7, color: g.muted });
  }
}
register(Regulator);

export class LM317 extends Regulator {
  static type = 'lm317'; static title = 'LM317 Adjustable'; static keywords = 'lm317 adjustable regulator';
  static props = [
    { key: 'vdo', label: 'Dropout voltage', unit: 'V', def: 1.5, min: 0.05, max: 5 },
    { key: 'ilim', label: 'Current limit', unit: 'A', def: 1.5, min: 1e-3, max: 20, log: true },
  ];
  static description = 'Adjustable regulator: keeps 1.25 V between OUT and ADJ. Vout = 1.25·(1 + R2/R1).';
  adj = true;
}
register(LM317);
