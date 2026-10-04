// More analog ICs and blocks: open-collector comparator (LM393/LM339),
// op-amp application blocks built from the op-amp macromodel and real
// resistors (voltage follower, differential amplifier, transimpedance and power
// amplifier), current amplifier, 556 dual timer, CD4046 PLL, LM337 negative
// adjustable regulator and ceramic resonator.

import { Element, register, GRID } from './base.js';
import { OpAmp, Comparator, Timer555 } from './analog.js';
import { Reg79 } from './analog2.js';
import { Resistor, Capacitor } from './passive.js';
import { Crystal } from './passive2.js';
import { Composite, withChip } from './kit.js';
import { fmtShort } from '../engine/units.js';

const G = GRID;

// ---------------------------------------------------- open-collector comparator
export class ComparatorOC extends Comparator {
  static type = 'comparatoroc'; static title = 'Comparator LM393 / LM339 (open collector)';
  static keywords = 'comparator lm393 lm339 lm311 open collector open drain pull up window';
  static props = [
    { key: 'hyst', label: 'Hysteresis', unit: 'V', def: 0.005, min: 0, max: 10, knob: true },
    { key: 'rsat', label: 'Output saturation resistance', unit: 'Ω', def: 30, min: 0.1, max: 1e4, log: true },
  ];
  static description = 'LM393/LM339-type comparator with an open-collector output: when V+ < V− the output transistor pulls OUT to ground; when V+ > V− the output is off (high impedance), so you need a pull-up resistor to the logic supply. Several outputs can be wired together (wired-AND).';
  g() { return this.state ? 1e-9 : 1 / this.p.rsat; }
  preStep(s) { const n = this.evalState(s); if (n !== this.state) { this.state = n; s.dirty = true; } }
  digitalSettle(s) { const n = this.evalState(s); if (n !== this.state) { this.state = n; s.dirty = true; return true; } return false; }
  stamp(s) { s.addG(this.nodes[2], 0, this.g()); }
  stampStep() {}
  accept(s) {
    const io = s.v(this.nodes[2]) * this.g();
    this.postCurrents = [0, 0, io]; this.i = io;
    if (this.evalState(s) !== this.state) s.event = true;
  }
  stampAC(ac) { ac.addY(this.nodes[2], 0, this.g()); }
  readings(s) { return [['Output', this.state ? 'OFF (high-Z, pulled up)' : 'ON (sinking to GND)', ''], ['V+', s.v(this.nodes[1]), 'V'], ['V−', s.v(this.nodes[0]), 'V'], ['Vout', s.v(this.nodes[2]), 'V']]; }
  draw(g) {
    super.draw(g);
    g.text('OC', 0.1 * G, 0.95 * G, { size: 6, color: g.muted, bold: true, follow: true });
  }
}
register(ComparatorOC);

// ------------------------------------------------------ op-amp based blocks
const RAILS = (vp, vn) => [
  { key: 'vpos', label: 'Positive supply', unit: 'V', def: vp, min: -1000, max: 1000 },
  { key: 'vneg', label: 'Negative supply', unit: 'V', def: vn, min: -1000, max: 1000 },
];
const AMP = (gbw, sr, drop = 1.2) => [
  { key: 'gbw', label: 'Gain-bandwidth', unit: 'Hz', def: gbw, min: 1, max: 1e10, log: true },
  { key: 'sr', label: 'Slew rate', unit: 'V/s', def: sr, min: 1e3, max: 1e12, log: true },
  { key: 'drop', label: 'Output headroom', unit: 'V', def: drop, min: 0, max: 10, hidden: true },
];
function syncAmp(opamp, p, rout = 0) {
  Object.assign(opamp.p, { model: 'custom', a0: 2e5, gbw: p.gbw, sr: p.sr, vpos: p.vpos, vneg: p.vneg, drop: p.drop ?? 1.2, rout: p.rout ?? rout });
}
function drawTri(g, txt) {
  g.poly([[-1.3 * G, -1.3 * G], [1.4 * G, 0], [-1.3 * G, 1.3 * G]], { stroke: g.body, width: g.lw, fill: g.fill, close: true, join: 'round' });
  g.upright(() => g.text(txt, 0, 0, { size: txt.length > 3 ? 7 : 9, color: g.accent, bold: true }), -0.35 * G, 0);
}

export class VoltageFollower extends Composite {
  static type = 'follower'; static title = 'Voltage Follower (Buffer Amp)'; static category = 'Analog ICs';
  static prefix = 'U'; static keywords = 'voltage follower buffer amplifier unity gain impedance converter';
  static props = [...RAILS(15, -15), ...AMP(1e6, 0.5e6)];
  static description = 'Op-amp with its output tied to the inverting input: OUT = IN with almost infinite input impedance and very low output impedance, so a weak source can drive a heavy load. Limited by the supply rails and slew rate.';
  parts() { return [[new OpAmp(0, 0), [1, 0, 1]]]; }
  sync() { if (this.subs) syncAmp(this.subs[0].el, this.p); }
  localPosts() { return [[-2 * G, 0], [2 * G, 0]]; }
  localBox() { return [-2 * G, -1.4 * G, 2 * G, 1.4 * G]; }
  leads() { return [[0, -2 * G, 0, -1.3 * G, 0], [1, 2 * G, 0, 1.4 * G, 0]]; }
  valueLabel() { return '×1'; }
  readings(s) { return [['Vin', s.v(this.nodes[0]), 'V'], ['Vout', s.v(this.nodes[1]), 'V'], ['Iout', -this.postCurrents[1], 'A']]; }
  draw(g) { drawTri(g, '×1'); }
}
register(VoltageFollower);

export class DiffAmp extends Composite {
  static type = 'diffamp'; static title = 'Differential Amplifier'; static category = 'Analog ICs';
  static prefix = 'U'; static keywords = 'differential amplifier subtractor difference amplifier ina105 four resistor';
  static props = [
    { key: 'gain', label: 'Differential gain', unit: 'V/V', def: 10, min: 0.01, max: 1e4, log: true, knob: true },
    { key: 'r1', label: 'Input resistors R1', unit: 'Ω', def: 10000, min: 10, max: 1e8, log: true },
    ...RAILS(15, -15), ...AMP(1e6, 0.5e6),
  ];
  static description = 'Classic four-resistor difference amplifier: OUT = G·(V2 − V1) + REF, with R1 inputs and G·R1 feedback. Rejects the common-mode voltage on both inputs. Input impedance is R1 (V1) and R1 + G·R1 (V2).';
  ownInternal() { return 2; }
  parts() { return [[new OpAmp(0, 0), ['i0', 'i1', 2]], [new Resistor(0, 0), [0, 'i0']], [new Resistor(0, 0), ['i0', 2]], [new Resistor(0, 0), [1, 'i1']], [new Resistor(0, 0), ['i1', 3]]]; }
  sync() {
    if (!this.subs) return;
    const [a, r1, rf, r3, r4] = this.subs.map((s) => s.el);
    syncAmp(a, this.p);
    r1.p.r = this.p.r1; r3.p.r = this.p.r1; rf.p.r = this.p.r1 * this.p.gain; r4.p.r = this.p.r1 * this.p.gain;
  }
  localPosts() { return [[-2 * G, -G], [-2 * G, G], [2 * G, 0], [0, 2 * G]]; }
  pinNames() { return ['V1 (−)', 'V2 (+)', 'OUT', 'REF']; }
  localBox() { return [-2 * G, -1.4 * G, 2 * G, 2 * G]; }
  leads() { return [[0, -2 * G, -G, -1.3 * G, -G], [1, -2 * G, G, -1.3 * G, G], [2, 2 * G, 0, 1.4 * G, 0], [3, 0, 2 * G, 0, 0.62 * G]]; }
  valueLabel() { return `×${fmtShort(this.p.gain, '')}`; }
  readings(s) { const [a, b, o, r] = this.nodes; return [['V2 − V1', s.v(b) - s.v(a), 'V'], ['Vout', s.v(o), 'V'], ['Ideal G·(V2−V1)+REF', this.p.gain * (s.v(b) - s.v(a)) + s.v(r), 'V']]; }
  draw(g) { drawTri(g, 'ΔV'); g.text('−', -1.05 * G, -G, { size: 11, color: g.text2, bold: true }); g.text('+', -1.05 * G, G, { size: 11, color: g.text2, bold: true }); }
}
register(DiffAmp);

export class TIA extends Composite {
  static type = 'tia'; static title = 'Transimpedance Amplifier'; static category = 'Analog ICs';
  static prefix = 'U'; static keywords = 'transimpedance amplifier tia current to voltage photodiode amplifier i to v converter';
  static props = [
    { key: 'rf', label: 'Feedback resistance Rf', unit: 'Ω', def: 100000, min: 1, max: 1e10, log: true, knob: true },
    { key: 'cf', label: 'Feedback capacitance Cf', unit: 'F', def: 10e-12, min: 0, max: 1e-6 },
    ...RAILS(5, -5), ...AMP(10e6, 10e6, 0.2),
  ];
  static description = 'Current-to-voltage converter: the input sits at virtual ground and OUT = −Iin · Rf. Cf across Rf sets the bandwidth (≈ 1/(2π·Rf·Cf)) and keeps it stable — the standard photodiode amplifier.';
  parts() { return [[new OpAmp(0, 0), [0, 'g', 1]], [new Resistor(0, 0), [0, 1]], [new Capacitor(0, 0), [0, 1]]]; }
  sync() {
    if (!this.subs) return;
    const [a, r, c] = this.subs.map((s) => s.el);
    syncAmp(a, this.p); r.p.r = this.p.rf; c.p.c = Math.max(this.p.cf, 1e-18);
  }
  localPosts() { return [[-2 * G, 0], [2 * G, 0]]; }
  localBox() { return [-2 * G, -1.4 * G, 2 * G, 1.4 * G]; }
  leads() { return [[0, -2 * G, 0, -1.3 * G, 0], [1, 2 * G, 0, 1.4 * G, 0]]; }
  valueLabel() { return fmtShort(this.p.rf, 'Ω'); }
  readings(s) { return [['Iin (into IN)', this.postCurrents[0], 'A'], ['Vout', s.v(this.nodes[1]), 'V'], ['V(IN) (virtual ground)', s.v(this.nodes[0]), 'V']]; }
  draw(g) { drawTri(g, 'I→V'); }
}
register(TIA);

export class PowerAmp extends Composite {
  static type = 'poweramp'; static title = 'Power Amplifier (TDA2030)'; static category = 'Analog ICs';
  static prefix = 'U'; static keywords = 'power amplifier audio power amp tda2030 class ab speaker driver lm1875';
  static props = [
    { key: 'gain', label: 'Voltage gain', unit: 'V/V', def: 32, min: 1, max: 1000, log: true, knob: true },
    ...RAILS(16, -16), ...AMP(7e6, 8e6, 1.8),
    { key: 'rout', label: 'Output resistance', unit: 'Ω', def: 0.05, min: 0, max: 100, hidden: true },
  ];
  static description = 'Class-AB audio power amplifier (TDA2030-like): non-inverting gain set by internal feedback (default ×32 = 30 dB), split ±16 V supply, swings to about 1.8 V from each rail and drives a 4–8 Ω speaker directly. Clips when the output reaches the rails.';
  ownInternal() { return 1; }
  parts() { return [[new OpAmp(0, 0), ['i0', 0, 1]], [new Resistor(0, 0), ['i0', 1]], [new Resistor(0, 0), ['i0', 'g']]]; }
  sync() {
    if (!this.subs) return;
    const [a, rf, r1] = this.subs.map((s) => s.el);
    syncAmp(a, this.p, 0.05); r1.p.r = 680; rf.p.r = 680 * Math.max(this.p.gain - 1, 1e-6);
  }
  localPosts() { return [[-2 * G, 0], [2 * G, 0]]; }
  localBox() { return [-2 * G, -1.4 * G, 2 * G, 1.4 * G]; }
  leads() { return [[0, -2 * G, 0, -1.3 * G, 0], [1, 2 * G, 0, 1.4 * G, 0]]; }
  valueLabel() { return `×${fmtShort(this.p.gain, '')}`; }
  readings(s) { const vo = s.v(this.nodes[1]), io = -this.postCurrents[1]; return [['Vin', s.v(this.nodes[0]), 'V'], ['Vout', vo, 'V'], ['Iout', io, 'A'], ['Output power (instant)', vo * io, 'W']]; }
  draw(g) { drawTri(g, 'PA'); }
}
register(PowerAmp);

// --------------------------------------------------------- current amplifier
export class CurrentAmp extends Element {
  static type = 'curramp'; static title = 'Current Amplifier'; static category = 'Analog ICs';
  static prefix = 'U'; static keywords = 'current amplifier current mirror cccs current gain';
  static props = [
    { key: 'gain', label: 'Current gain', unit: 'A/A', def: 10, min: -1e6, max: 1e6, knob: true },
    { key: 'vc', label: 'Output compliance', unit: 'V', def: 12, min: 0.1, max: 1e4 },
    { key: 'rout', label: 'Output resistance', unit: 'Ω', def: 1e6, min: 1, max: 1e12, log: true },
  ];
  static description = 'Current amplifier: the input IN+ → IN− is a short (zero-volt sense); OUT sources A × Iin into the load (to ground) as long as the output voltage stays within ±compliance, then it saturates like a real current mirror.';
  nonlinear = true;
  constructor(x, y) { super(x, y); this.postCurrents = [0, 0, 0]; }
  localPosts() { return [[-2 * G, -G], [-2 * G, G], [2 * G, 0]]; }
  pinNames() { return ['IN+', 'IN−', 'OUT']; }
  localBox() { return [-2 * G, -1.5 * G, 2 * G, 1.5 * G]; }
  leads() { return [[0, -2 * G, -G, -G, -G], [1, -2 * G, G, -G, G], [2, 2 * G, 0, G, 0]]; }
  connectivity() { return [[0, 1], [2, 'gnd']]; }
  branchCount() { return 1; }
  reset() { this.postCurrents = [0, 0, 0]; this.iout = 0; }
  comp(v) {
    const w = 0.02 * this.p.vc + 0.01, u = (Math.abs(v) - this.p.vc) / w;
    const c = u > 40 ? 0 : 1 / (1 + Math.exp(u));
    return { c, dc: -c * (1 - c) * Math.sign(v) / w };
  }
  stamp(s) {
    const [a, b, o] = this.nodes, k = this.branches[0];
    s.addBranchKCL(a, b, k); s.addA(k, a - 1, 1); s.addA(k, b - 1, -1);
    s.addG(o, 0, 1 / this.p.rout);
  }
  stampNL(s) {
    const o = this.nodes[2], k = this.branches[0], ik = s.x[k], v = s.v(o), A = this.p.gain;
    const { c, dc } = this.comp(v), f = A * ik * c, dfi = A * c, dfv = A * ik * dc;
    s.addA(o - 1, k, -dfi); s.addA(o - 1, o - 1, -dfv);
    if (o > 0) s.b[o - 1] += f - dfi * ik - dfv * v;
  }
  accept(s) {
    const o = this.nodes[2], ik = s.x[this.branches[0]], v = s.v(o);
    this.iout = this.p.gain * ik * this.comp(v).c - v / this.p.rout;
    this.postCurrents = [ik, -ik, -this.iout]; this.i = ik;
  }
  stampAC(ac) {
    const [a, b, o] = this.nodes, k = this.branches[0];
    ac.addBranchKCL(a, b, k); ac.addA(k, a - 1, 1); ac.addA(k, b - 1, -1);
    ac.addY(o, 0, 1 / this.p.rout); ac.addA(o - 1, k, -this.p.gain);
  }
  valueLabel() { return `×${fmtShort(this.p.gain, '')}`; }
  readings(s) { return [['Iin', this.i, 'A'], ['Iout (into load)', this.iout || 0, 'A'], ['Vout', s.v(this.nodes[2]), 'V']]; }
  draw(g) {
    g.box(-G, -1.2 * G, G, 1.2 * G, { stroke: g.body, width: g.lw * 0.9, fill: g.fill, r: 4 });
    g.circle(0.35 * G, 0, 0.45 * G, { stroke: g.accent, width: g.lw * 0.8 });
    g.line(0.35 * G, 0.25 * G, 0.35 * G, -0.25 * G, g.accent, g.lw * 0.8);
    g.poly([[0.25 * G, -0.12 * G], [0.35 * G, -0.3 * G], [0.45 * G, -0.12 * G]], { fill: g.accent });
    g.text('Ai', -0.45 * G, 0, { size: 8, color: g.text2, bold: true, follow: true });
  }
}
register(CurrentAmp);

// ---------------------------------------------------------- 556 dual timer
export class Timer556 extends withChip(Composite) {
  static type = 'timer556'; static title = '556 Dual Timer'; static category = 'Analog ICs';
  static prefix = 'U'; static keywords = '556 ne556 dual timer two 555 sequential timer';
  static props = Timer555.props;
  static pins = [['VCC', 'T'], ['GND', 'B'], ['TRIG1', 'L'], ['THR1', 'L'], ['CTRL1', 'L'], ['RST1', 'L'], ['OUT1', 'L'], ['DIS1', 'L'],
    ['TRIG2', 'R'], ['THR2', 'R'], ['CTRL2', 'R'], ['RST2', 'R'], ['OUT2', 'R'], ['DIS2', 'R']];
  static chipOpts = { dense: true };
  static description = 'Two independent 555 timers sharing VCC and GND (NE556). Each half has its own trigger, threshold, control, reset, output and discharge pins — e.g. one astable driving another monostable.';
  parts() { return [[new Timer555(0, 0), [0, 1, 2, 3, 4, 5, 6, 7]], [new Timer555(0, 0), [0, 1, 8, 9, 10, 11, 12, 13]]]; }
  sync() { if (this.subs) for (const x of this.subs) Object.assign(x.el.p, this.p); }
  valueLabel() { return ''; }
  readings(s) { const n = this.nodes; return [['OUT1', s.v(n[6]) - s.v(n[1]), 'V'], ['OUT2', s.v(n[12]) - s.v(n[1]), 'V'], ['VCC', s.v(n[0]) - s.v(n[1]), 'V']]; }
  draw(g) { this.drawChip(g, '556'); }
}
register(Timer556);

// ------------------------------------------------------------- CD4046 PLL
export class PLL4046 extends withChip(Element) {
  static type = 'pll4046'; static title = 'PLL (CD4046)'; static category = 'Analog ICs';
  static prefix = 'U'; static keywords = 'pll phase locked loop cd4046 74hc4046 vco phase detector frequency synthesizer';
  static props = [
    { key: 'fmin', label: 'VCO frequency at 0 V', unit: 'Hz', def: 500, min: 0, max: 1e8 },
    { key: 'fmax', label: 'VCO frequency at VDD', unit: 'Hz', def: 5000, min: 1e-3, max: 1e8, log: true, knob: true },
    { key: 'vdd', label: 'Supply / logic level', unit: 'V', def: 5, min: 1, max: 18 },
    { key: 'rout', label: 'Output resistance', unit: 'Ω', def: 200, min: 1, max: 1e5, log: true },
  ];
  static pins = [['SIG', 'L'], ['COMP', 'L'], ['VCOIN', 'L'], ['PC1', 'R'], ['PC2', 'R'], ['VCO', 'R']];
  static description = 'Phase-locked loop: VCO whose frequency goes from fmin (0 V) to fmax (VDD) with VCOIN, phase comparator 1 (XOR of SIG and COMP) and phase comparator 2 (edge-triggered phase-frequency detector with a tri-state output: high = VCO too slow, low = too fast, high-Z = in lock). Close the loop: VCO → COMP, PC2 → RC low-pass filter → VCOIN, and the VCO locks to the frequency on SIG.';
  constructor(x, y) { super(x, y); this.postCurrents = new Array(6).fill(0); }
  connectivity() { return [[3, 4, 5, 'gnd']]; }
  reset() { this.ph = 0; this.vco = false; this.sig = false; this.cmp = false; this.pc2 = 0; this.tLast = 0; this.f = this.p.fmin; this.tSig = null; this.fsig = 0; this.postCurrents.fill(0); }
  levels() { const V = this.p.vdd; return [this.sig !== this.cmp ? V : 0, this.pc2 > 0 ? V : 0, this.vco ? V : 0]; }
  drives() { return [true, this.pc2 !== 0, true]; }
  stamp(s) { const d = this.drives(); [3, 4, 5].forEach((pi, k) => s.addG(this.nodes[pi], 0, d[k] ? 1 / this.p.rout : 1e-9)); s.addG(this.nodes[2], 0, 1e-9); }
  stampStep(s) { const L = this.levels(), d = this.drives(); [3, 4, 5].forEach((pi, k) => { if (d[k]) s.addI(0, this.nodes[pi], (L[k] * (s.srcScale ?? 1)) / this.p.rout); }); }
  preStep(s) {
    const V = this.p.vdd, th = (st, v) => (st ? v > 0.4 * V : v > 0.6 * V);
    const sig = th(this.sig, s.v(this.nodes[0])), cmp = th(this.cmp, s.v(this.nodes[1]));
    const t = s.mode === 'dc' ? 0 : s.tNext, dt = Math.max(0, t - this.tLast);
    const x = Math.min(1, Math.max(0, s.v(this.nodes[2]) / V));
    this.f = this.p.fmin + (this.p.fmax - this.p.fmin) * x;
    this.ph += this.f * dt; this.ph -= Math.floor(this.ph);
    const vco = this.ph < 0.5;
    let pc2 = this.pc2;
    if (sig && !this.sig) { pc2 = pc2 < 0 ? 0 : 1; if (this.tSig !== null && t > this.tSig) this.fsig = 1 / (t - this.tSig); this.tSig = t; }
    if (cmp && !this.cmp) pc2 = pc2 > 0 ? 0 : -1;
    const oldL = this.levels(), oldD = this.drives();
    this.sig = sig; this.cmp = cmp; this.vco = vco; this.pc2 = pc2;
    const L = this.levels(), D = this.drives();
    if (L.some((v, k) => v !== oldL[k])) s.event = true;
    if (D.some((v, k) => v !== oldD[k])) s.dirty = true;
    this.tLast = t;
  }
  accept(s) {
    const L = this.levels(), D = this.drives();
    [3, 4, 5].forEach((pi, k) => { this.postCurrents[pi] = D[k] ? (s.v(this.nodes[pi]) - L[k]) / this.p.rout : s.v(this.nodes[pi]) * 1e-9; });
  }
  stampAC(ac) { const d = this.drives(); [3, 4, 5].forEach((pi, k) => ac.addY(this.nodes[pi], 0, d[k] ? 1 / this.p.rout : 1e-9)); }
  valueLabel() { return ''; }
  readings(s) {
    return [['VCO frequency', this.f || 0, 'Hz'], ['SIG frequency', this.fsig || 0, 'Hz'], ['VCOIN', s.v(this.nodes[2]), 'V'],
      ['PC2', this.pc2 > 0 ? 'HIGH (VCO too slow)' : this.pc2 < 0 ? 'LOW (VCO too fast)' : 'high-Z (in phase)', '']];
  }
  draw(g) { this.drawChip(g, '4046'); }
}
register(PLL4046);

// ------------------------------------------------------- regulators, resonator
export class LM337 extends Reg79 {
  static chipName = 'LM337';
  static type = 'lm337'; static title = 'LM337 Negative Adjustable';
  static keywords = 'lm337 negative adjustable regulator split supply';
  static props = [
    { key: 'vdo', label: 'Dropout voltage', unit: 'V', def: 1.5, min: 0.05, max: 5 },
    { key: 'ilim', label: 'Current limit', unit: 'A', def: 1.5, min: 1e-3, max: 20, log: true },
    { key: 'vout', label: 'Reference', unit: 'V', def: 1.25, min: 1.25, max: 1.25, hidden: true },
  ];
  static description = 'Negative adjustable regulator: keeps OUT 1.25 V below ADJ. With R1 from OUT to ADJ and R2 from ADJ to ground, Vout = −1.25·(1 + R2/R1). The negative partner of the LM317.';
  adj = true;
  pinNames() { return ['IN', 'OUT', 'ADJ']; }
  valueLabel() { return ''; }
}
register(LM337);

const CER = {
  '455 kHz': { f: 455e3, rm: 20, cm: 17.5e-12, c0: 280e-12 },
  '4 MHz': { f: 4e6, rm: 7, cm: 4e-12, c0: 20e-12 },
  '8 MHz': { f: 8e6, rm: 8, cm: 4e-12, c0: 18e-12 },
  '16 MHz': { f: 16e6, rm: 10, cm: 3e-12, c0: 15e-12 },
};
export class CeramicResonator extends Crystal {
  static type = 'ceramicres'; static title = 'Ceramic Resonator';
  static keywords = 'ceramic resonator murata cstls 455khz 4mhz 8mhz 16mhz clock oscillator';
  static props = [
    { key: 'model', label: 'Frequency', type: 'select', def: '4 MHz', options: Object.keys(CER).map((k) => [k, k]).concat([['custom', 'Custom']]), preset: CER },
    { key: 'f', label: 'Series resonance', unit: 'Hz', def: 4e6, min: 1, max: 1e9, log: true, knob: true },
    { key: 'rm', label: 'Motional resistance Rm', unit: 'Ω', def: 7, min: 1e-3, max: 1e6, log: true },
    { key: 'cm', label: 'Motional capacitance Cm', unit: 'F', def: 4e-12, min: 1e-18, max: 1e-6, log: true },
    { key: 'c0', label: 'Shunt capacitance C0', unit: 'F', def: 20e-12, min: 1e-15, max: 1e-6, log: true },
  ];
  static description = 'Piezo-ceramic resonator: same Butterworth–Van Dyke model as a crystal but with a much lower Q (≈1000 instead of ≈100 000), so it starts faster and is cheaper but only about ±0.5 % accurate — used as microcontroller and IF-filter clock.';
}
register(CeramicResonator);
