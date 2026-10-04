// Additional sources: batteries with state of charge, mains and three-phase
// supplies, bench / dual power supplies, PV module, signal generators
// (AM, FM, PWM, step, exponential, PWL, damped sine, arbitrary f(t)) and
// earth / chassis grounds.

import { Element, TwoTerm, register, GRID } from './base.js';
import { VoltageSource } from './sources.js';
import { Ground } from './passive.js';
import { SolarCell } from './sensors.js';
import { exprFn } from './kit.js';
import { fmtShort, parseSI } from '../engine/units.js';

const G = GRID;
const TAU = 2 * Math.PI;

// ------------------------------------------------------------- batteries
export const interp = (tbl, x) => {
  if (x <= tbl[0][0]) return tbl[0][1];
  for (let k = 1; k < tbl.length; k++) {
    if (x <= tbl[k][0]) { const [x0, y0] = tbl[k - 1], [x1, y1] = tbl[k]; return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0); }
  }
  return tbl[tbl.length - 1][1];
};

export const CHEM = {
  alkaline: [[0, 0.9], [0.1, 1.15], [0.3, 1.25], [0.6, 1.35], [0.9, 1.5], [1, 1.58]],
  liion: [[0, 3.0], [0.05, 3.3], [0.1, 3.45], [0.2, 3.6], [0.3, 3.68], [0.4, 3.73], [0.5, 3.78], [0.6, 3.85], [0.7, 3.92], [0.8, 4.0], [0.9, 4.08], [1, 4.2]],
  leadacid: [[0, 1.93], [0.2, 1.98], [0.5, 2.03], [0.8, 2.08], [1, 2.12]],
  nimh: [[0, 1.0], [0.1, 1.2], [0.2, 1.24], [0.5, 1.27], [0.8, 1.3], [0.9, 1.33], [1, 1.4]],
  lithium: [[0, 2.0], [0.05, 2.6], [0.15, 2.85], [0.5, 2.95], [0.9, 3.0], [1, 3.2]],
};

export class Battery extends TwoTerm {
  static category = 'Sources';
  static prefix = 'BT';
  static chem = 'alkaline'; static cells = 1;
  static description = 'Battery: open-circuit voltage follows the state of charge (chemistry curve), with internal resistance. Charge is integrated while simulating: I·t / capacity.';
  static mkProps(soc, ah, r) {
    return [
      { key: 'soc', label: 'State of charge', unit: '%', def: soc, min: 0, max: 100, knob: true },
      { key: 'ah', label: 'Capacity', unit: 'Ah', def: ah, min: 1e-4, max: 1e4, log: true },
      { key: 'rint', label: 'Internal resistance', unit: 'Ω', def: r, min: 1e-4, max: 1e4, log: true },
    ];
  }
  refNode = 1;
  branchCount() { return 1; }
  reset() { this.q = this.p.soc / 100; this.setCurrent(0); }
  ocv(q = this.q ?? this.p.soc / 100) { return this.constructor.cells * interp(CHEM[this.constructor.chem], Math.min(1, Math.max(0, q))); }
  stamp(s) {
    const k = this.branches[0], [a, b] = this.nodes;
    s.addBranchKCL(a, b, k); s.addA(k, a - 1, 1); s.addA(k, b - 1, -1); s.addA(k, k, -this.p.rint);
  }
  stampStep(s) { s.b[this.branches[0]] += this.ocv() * (s.srcScale ?? 1); }
  accept(s) {
    const i = s.x[this.branches[0]];
    this.setCurrent(i);
    // branch current > 0 flows into + : charging
    if (s.mode !== 'dc') this.q = Math.min(1, Math.max(0, this.q + (i * s.dt) / (3600 * this.p.ah)));
  }
  stampAC(ac) {
    const k = this.branches[0], [a, b] = this.nodes;
    ac.addBranchKCL(a, b, k); ac.addA(k, a - 1, 1); ac.addA(k, b - 1, -1); ac.addA(k, k, -this.p.rint);
  }
  valueLabel() { return fmtShort(this.constructor.nominal ?? this.ocv(this.p.soc / 100), 'V'); }
  readings(s) {
    const v = this.voltageDiff(s);
    return [['Terminal voltage', v, 'V'], ['Open-circuit voltage', this.ocv(), 'V'], ['Current (out of +)', -this.i, 'A'],
      ['State of charge', (this.q ?? 0) * 100, '%'], ['Power delivered', -v * this.i, 'W']];
  }
  spice(n) { return `V${this.name} ${n[0]} ${n[1]} DC ${this.ocv()} Rser=${this.p.rint}`; }
  leads() { return [[0, -2 * G, 0, -0.9 * G, 0], [1, 2 * G, 0, 0.9 * G, 0]]; }
  localBox() { return [-2 * G, -0.8 * G, 2 * G, 0.8 * G]; }
  draw(g) {
    // two-cell battery symbol (long plate = +)
    const c0 = g.vc(g.pv(0)), c1 = g.vc(g.pv(1));
    g.line(-0.9 * G, 0, -0.55 * G, 0, c0, g.lw);
    g.line(-0.55 * G, -0.7 * G, -0.55 * G, 0.7 * G, c0, g.lw * 1.2);
    g.line(-0.25 * G, -0.38 * G, -0.25 * G, 0.38 * G, c0, g.lw * 2.2);
    g.line(0.25 * G, -0.7 * G, 0.25 * G, 0.7 * G, c1, g.lw * 1.2);
    g.line(0.55 * G, -0.38 * G, 0.55 * G, 0.38 * G, c1, g.lw * 2.2);
    g.line(0.55 * G, 0, 0.9 * G, 0, c1, g.lw);
    g.line(-0.13 * G, 0, 0.13 * G, 0, g.muted, g.lw * 0.6);
    g.text('+', -0.95 * G, -0.55 * G, { size: 11, color: g.pos, bold: true });
    if (g.running) {
      const q = this.q ?? 0;
      g.box(-0.5 * G, 0.95 * G - 4, 0.5 * G, 0.95 * G, { fill: 'rgba(120,140,160,0.35)' });
      g.box(-0.5 * G, 0.95 * G - 4, -0.5 * G + G * q, 0.95 * G, { fill: q > 0.2 ? g.pos : g.neg });
    }
  }
}

export function battery(type, title, chem, cells, soc, ah, r, keywords, desc) {
  const C = class extends Battery {};
  Object.assign(C, { type, title, chem, cells, keywords, props: Battery.mkProps(soc, ah, r) });
  if (desc) C.description = desc;
  C.nominal = NOMINAL[type]; // labels show the nominal rating
  register(C);
  return C;
}

const NOMINAL = { cellaa: 1.5, bat9v: 9, coincell: 3, nimh: 1.2, liion: 3.7, lipo2s: 7.4, leadacid: 12 };

battery('cellaa', 'AA Cell 1.5 V', 'alkaline', 1, 100, 2.5, 0.15, 'aa aaa alkaline cell 1.5v battery pencil', 'Alkaline AA cell: 1.58 V fresh, falling to 0.9 V at end of life; about 0.15 Ω internal resistance.');
battery('bat9v', '9 V Battery', 'alkaline', 6, 100, 0.55, 1.7, '9v pp3 battery alkaline');
battery('coincell', 'Coin Cell CR2032', 'lithium', 1, 100, 0.22, 15, 'cr2032 coin cell button lithium 3v', 'CR2032 lithium coin cell: 3 V nominal, high internal resistance (≈15 Ω), so it cannot deliver large currents.');
battery('nimh', 'NiMH Cell 1.2 V', 'nimh', 1, 100, 2.0, 0.03, 'nimh rechargeable cell 1.2v');
battery('liion', 'Li-ion Cell 3.7 V', 'liion', 1, 80, 2.5, 0.05, 'li-ion lithium 18650 cell 3.7v rechargeable', 'Li-ion 18650 cell: 4.2 V full, 3.7 V nominal, 3.0 V empty. Charging (current into +) raises the state of charge.');
battery('lipo2s', 'Li-Po Pack 2S 7.4 V', 'liion', 2, 80, 2.2, 0.03, 'lipo lithium polymer pack 2s 7.4v rc');
battery('leadacid', 'Lead-Acid Battery 12 V', 'leadacid', 6, 90, 7, 0.03, 'lead acid sla car battery 12v ups', '12 V lead-acid (6 cells): 12.7 V full, about 11.6 V discharged. Very low internal resistance, so it can supply high currents.');

// ----------------------------------------------------------------- mains
const MAINS = {
  'BD/IN/UK 230 V 50 Hz': { vrms: 230, freq: 50 },
  'EU 230 V 50 Hz': { vrms: 230, freq: 50 },
  'US 120 V 60 Hz': { vrms: 120, freq: 60 },
  'JP 100 V 50 Hz': { vrms: 100, freq: 50 },
};

export class Mains extends TwoTerm {
  static type = 'mains'; static title = 'AC Mains (1-phase)'; static category = 'Sources';
  static prefix = 'AC'; static keywords = 'mains supply 230v 220v 50hz line neutral wall socket grid single phase';
  static props = [
    { key: 'std', label: 'Standard', type: 'select', def: 'BD/IN/UK 230 V 50 Hz', options: Object.keys(MAINS).map((k) => [k, k]).concat([['custom', 'Custom']]), preset: MAINS },
    { key: 'vrms', label: 'Voltage (RMS)', unit: 'V', def: 230, min: 0, max: 1e5, knob: true },
    { key: 'freq', label: 'Frequency', unit: 'Hz', def: 50, min: 1, max: 1000 },
    { key: 'zs', label: 'Source impedance', unit: 'Ω', def: 0.2, min: 0, max: 100 },
    { key: 'earthed', label: 'Neutral earthed at source (TN)', type: 'bool', def: true },
  ];
  static description = 'Single-phase mains supply between L (left) and N (right). The value is RMS (peak = √2·Vrms). Neutral is bonded to earth at the source, so earth faults return through ground — needed for RCD/RCCB tests.';
  refNode = 1;
  branchCount() { return 1; }
  reset() { this.setCurrent(0); }
  stamp(s) {
    const k = this.branches[0], [a, b] = this.nodes;
    s.addBranchKCL(a, b, k); s.addA(k, a - 1, 1); s.addA(k, b - 1, -1);
    if (this.p.zs > 0) s.addA(k, k, -this.p.zs);
    if (this.p.earthed) s.addG(b, 0, 2);
  }
  stampStep(s) {
    // an AC supply has no DC component: the operating point sees 0 V and the
    // transient is a true switch-on at t = 0
    if (s.mode === 'dc') return;
    s.b[this.branches[0]] += Math.SQRT2 * this.p.vrms * Math.sin(TAU * this.p.freq * s.tNext);
  }
  accept(s) { this.setCurrent(s.x[this.branches[0]]); }
  stampAC(ac) {
    const k = this.branches[0], [a, b] = this.nodes;
    ac.addBranchKCL(a, b, k); ac.addA(k, a - 1, 1); ac.addA(k, b - 1, -1);
    if (this.p.zs > 0) ac.addA(k, k, -this.p.zs);
    if (this.p.earthed) ac.addY(b, 0, 2);
    if (ac.input === this) ac.addB(k, 1);
  }
  valueLabel() { return `${+this.p.vrms.toPrecision(4)}V ${+this.p.freq.toPrecision(3)}Hz`; }
  readings(s) {
    const v = this.voltageDiff(s);
    return [['Voltage (inst.)', v, 'V'], ['RMS', this.p.vrms, 'V'], ['Peak', this.p.vrms * Math.SQRT2, 'V'], ['Current (out of L)', -this.i, 'A'], ['Power (inst.)', -v * this.i, 'W']];
  }
  spice(n) { return `V${this.name} ${n[0]} ${n[1]} SIN(0 ${this.p.vrms * Math.SQRT2} ${this.p.freq})`; }
  leads() { return [[0, -2 * G, 0, -0.85 * G, 0], [1, 2 * G, 0, 0.85 * G, 0]]; }
  localBox() { return [-2 * G, -0.95 * G, 2 * G, 0.95 * G]; }
  draw(g) {
    g.circle(0, 0, 0.85 * G, { stroke: g.body, width: g.lw * 0.9, fill: g.fill });
    g.upright(() => {
      const ctx = g.ctx; ctx.beginPath();
      for (let k = 0; k <= 20; k++) { const x = -0.5 * G + k * 0.05 * G, y = -0.3 * G * Math.sin((TAU * k) / 20); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.strokeStyle = g.accent; ctx.lineWidth = g.lw * 0.8; ctx.stroke();
    });
    g.text('L', -1.3 * G, -0.55 * G, { size: 8, color: g.muted, bold: true });
    g.text('N', 1.3 * G, -0.55 * G, { size: 8, color: g.muted, bold: true });
  }
}
register(Mains);

// ------------------------------------------------------------ three-phase
export class ThreePhaseY extends Element {
  static type = 'ac3y'; static title = '3-Phase Supply (4-wire)'; static category = 'Sources';
  static prefix = 'G'; static keywords = 'three phase 3 phase supply 400v 415v star wye rybn grid generator';
  static props = [
    { key: 'vll', label: 'Line voltage (RMS)', unit: 'V', def: 400, min: 0, max: 1e6, knob: true },
    { key: 'freq', label: 'Frequency', unit: 'Hz', def: 50, min: 1, max: 1000 },
    { key: 'zs', label: 'Source impedance per phase', unit: 'Ω', def: 0.05, min: 0, max: 100 },
    { key: 'seq', label: 'Phase sequence', type: 'select', def: 'RYB', options: [['RYB', 'R-Y-B (positive)'], ['RBY', 'R-B-Y (negative)']] },
    { key: 'earthed', label: 'Neutral earthed', type: 'bool', def: true },
  ];
  static description = 'Balanced star-connected three-phase supply: phases R, Y, B and neutral N. Phase voltage = V_line/√3, displaced by 120°.';
  static wires = 4;
  refNode = 3;
  constructor(x, y) { super(x, y); this.postCurrents = new Array(this.constructor.wires).fill(0); }
  localPosts() { return this.constructor.wires === 4 ? [[2 * G, -2 * G], [2 * G, -G], [2 * G, 0], [2 * G, G]] : [[2 * G, -G], [2 * G, 0], [2 * G, G]]; }
  localBox() { return [-1.6 * G, -2.4 * G, 2 * G, 1.6 * G]; }
  leads() { return this.localPosts().map(([x, y], i) => [i, x, y, 0.9 * G, y]); }
  internalNodeCount() { return this.constructor.wires === 4 ? 0 : 1; }
  neutral() { return this.constructor.wires === 4 ? this.nodes[3] : this.inodes[0]; }
  branchCount() { return 3; }
  labelSide() { return [-1, 0]; }
  valueLabel() { return `${+this.p.vll.toPrecision(4)}V ${+this.p.freq.toPrecision(3)}Hz`; }
  reset() { this.postCurrents.fill(0); }
  stamp(s) {
    const n = this.neutral();
    for (let p = 0; p < 3; p++) {
      const k = this.branches[p], a = this.nodes[p];
      s.addBranchKCL(a, n, k); s.addA(k, a - 1, 1); s.addA(k, n - 1, -1);
      if (this.p.zs > 0) s.addA(k, k, -this.p.zs);
    }
    if (this.p.earthed && this.constructor.wires === 4) s.addG(n, 0, 2);
    // a 3-wire supply's star point is referenced through 1 MΩ so node voltages stay defined
    if (this.constructor.wires === 3) s.addG(n, 0, 1e-6);
  }
  phaseAngle(p) { return (this.p.seq === 'RBY' ? 1 : -1) * p * (TAU / 3); }
  stampStep(s) {
    if (s.mode === 'dc') return; // no DC component (see Mains)
    const vp = (this.p.vll / Math.sqrt(3)) * Math.SQRT2;
    for (let p = 0; p < 3; p++) s.b[this.branches[p]] += vp * Math.sin(TAU * this.p.freq * s.tNext + this.phaseAngle(p));
  }
  accept(s) {
    const ib = this.branches.map((k) => s.x[k]);
    for (let p = 0; p < 3; p++) this.postCurrents[p] = ib[p];
    if (this.constructor.wires === 4) this.postCurrents[3] = -(ib[0] + ib[1] + ib[2]);
    this.i = ib[0];
  }
  stampAC(ac) {
    const n = this.neutral();
    for (let p = 0; p < 3; p++) {
      const k = this.branches[p], a = this.nodes[p];
      ac.addBranchKCL(a, n, k); ac.addA(k, a - 1, 1); ac.addA(k, n - 1, -1);
      if (this.p.zs > 0) ac.addA(k, k, -this.p.zs);
      if (ac.input === this) ac.addB(k, Math.cos(this.phaseAngle(p)), Math.sin(this.phaseAngle(p)));
    }
    if (this.p.earthed && this.constructor.wires === 4) ac.addY(n, 0, 2);
  }
  readings(s) {
    const v = (a, b) => s.v(this.nodes[a]) - s.v(b === 'n' ? this.neutral() : this.nodes[b]);
    return [['V_RY', v(0, 1), 'V'], ['V_YB', v(1, 2), 'V'], ['V_BR', v(2, 0), 'V'], ['V_RN', v(0, 'n'), 'V'],
      ['I_R', -this.postCurrents[0], 'A'], ['I_Y', -this.postCurrents[1], 'A'], ['I_B', -this.postCurrents[2], 'A']];
  }
  draw(g) {
    g.circle(-0.35 * G, -0.4 * G, 1.1 * G, { stroke: g.body, width: g.lw * 0.9, fill: g.fill });
    const ctx = g.ctx;
    g.upright(() => {
      ['#ef4444', '#facc15', '#3b82f6'].forEach((c, p) => {
        ctx.beginPath();
        for (let k = 0; k <= 20; k++) { const x = -0.65 * G + k * 0.065 * G, y = -0.35 * G * Math.sin((TAU * k) / 20 - (p * TAU) / 3); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.strokeStyle = c; ctx.lineWidth = g.lw * 0.6; ctx.stroke();
      });
    }, -0.35 * G, -0.4 * G);
    const lab = this.constructor.wires === 4 ? ['R', 'Y', 'B', 'N'] : ['R', 'Y', 'B'];
    this.localPosts().forEach(([, y], i) => g.text(lab[i], 1.05 * G, y - 0.4 * G, { size: 7, color: g.muted, bold: true }));
  }
}
register(ThreePhaseY);

export class ThreePhase3W extends ThreePhaseY {
  static type = 'ac3d'; static title = '3-Phase Supply (3-wire)'; static wires = 3;
  static keywords = 'three phase 3 wire supply delta ryb unearthed';
  static props = ThreePhaseY.props.filter((p) => p.key !== 'earthed');
  static description = 'Balanced three-phase supply without neutral (R, Y, B). Line voltages are 120° apart; use it for delta loads and motors.';
  refNode = undefined;
}
register(ThreePhase3W);

// ------------------------------------------------------ bench power supply
export class BenchPSU extends TwoTerm {
  static type = 'benchpsu'; static title = 'Bench Power Supply (CV/CC)'; static category = 'Sources';
  static prefix = 'PS'; static keywords = 'bench power supply lab psu current limit constant voltage constant current adjustable';
  static props = [
    { key: 'vset', label: 'Voltage set', unit: 'V', def: 12, min: 0, max: 1000, knob: true },
    { key: 'ilim', label: 'Current limit', unit: 'A', def: 1, min: 1e-4, max: 100, log: true },
    { key: 'rout', label: 'Output resistance (CV)', unit: 'Ω', def: 0.01, min: 1e-4, max: 10, log: true },
  ];
  static description = 'Laboratory supply: constant voltage until the load demands more than the current limit, then constant current (smooth CV→CC crossover).';
  nonlinear = true;
  refNode = 1;
  reset() { this.vOld = 0; this.setCurrent(0); }
  iv(v) {
    const { vset, ilim, rout } = this.p;
    const x = (vset * 1 - v) / (ilim * rout);
    const t = Math.tanh(x);
    return { i: ilim * t, g: (1 - t * t) / rout }; // i: current out of + terminal
  }
  stampNL(s) {
    const [a, b] = this.nodes;
    let v = s.v(a) - s.v(b);
    const vs = this.p.vset * (s.srcScale ?? 1);
    // do not let Newton jump across the steep CV region
    const band = 3 * this.p.ilim * this.p.rout;
    if ((this.vOld < vs - band && v > vs + band) || (this.vOld > vs + band && v < vs - band)) { v = vs; s.limited = true; }
    this.vOld = v;
    const { vset, ilim, rout } = this.p;
    const x = (vs - v) / (ilim * rout), t = Math.tanh(x);
    const i = ilim * t, g = (1 - t * t) / rout;
    void vset;
    // current i flows out of a: i.e. from b to a through the supply
    s.addNLCurrent(b, a, i, [[a, b, -g, v]]);
  }
  accept(s) {
    const v = this.voltageDiff(s);
    this.vOld = v;
    const { i } = this.iv(v);
    this.setCurrent(-i);
    this.cc = Math.abs(i) > 0.98 * this.p.ilim;
  }
  stampAC(ac) { ac.addY(this.nodes[0], this.nodes[1], this.iv(this.vOld ?? 0).g); }
  valueLabel() { return `${fmtShort(this.p.vset, 'V')} ${fmtShort(this.p.ilim, 'A')}`; }
  readings(s) {
    const v = this.voltageDiff(s);
    return [['Mode', this.cc ? 'CC (current limit)' : 'CV', ''], ['Output voltage', v, 'V'], ['Output current', -this.i, 'A'], ['Power', -v * this.i, 'W']];
  }
  leads() { return [[0, -2 * G, 0, -1.2 * G, 0], [1, 2 * G, 0, 1.2 * G, 0]]; }
  localBox() { return [-2 * G, -0.9 * G, 2 * G, 0.9 * G]; }
  draw(g) {
    g.box(-1.2 * G, -0.8 * G, 1.2 * G, 0.8 * G, { stroke: g.body, width: g.lw * 0.9, fill: g.fill, r: 5 });
    g.upright(() => {
      g.text('PSU', 0, -0.3 * G, { size: 8, color: g.accent, bold: true });
      g.text(g.running ? (this.cc ? 'CC' : 'CV') : 'DC', 0, 0.35 * G, { size: 8, color: this.cc && g.running ? g.neg : g.muted, bold: true });
    });
    g.text('+', -1.6 * G, -0.55 * G, { size: 11, color: g.pos, bold: true });
  }
}
register(BenchPSU);

export class DualPSU extends Element {
  static type = 'dualpsu'; static title = 'Dual Supply ±V'; static category = 'Sources';
  static prefix = 'PS'; static keywords = 'dual split supply plus minus 15v 12v bipolar op amp supply';
  static props = [
    { key: 'v', label: 'Voltage (each rail)', unit: 'V', def: 15, min: 0, max: 1000, knob: true },
    { key: 'rint', label: 'Internal resistance', unit: 'Ω', def: 0.01, min: 0, max: 100 },
  ];
  static description = 'Split supply: +V between + and COM, −V between COM and −. Typical for op-amp circuits.';
  refNode = 1;
  constructor(x, y) { super(x, y); this.postCurrents = [0, 0, 0]; }
  localPosts() { return [[2 * G, -G], [2 * G, 0], [2 * G, G]]; }
  localBox() { return [-G, -1.6 * G, 2 * G, 1.6 * G]; }
  leads() { return this.localPosts().map(([x, y], i) => [i, x, y, 0.9 * G, y]); }
  labelSide() { return [-1, 0]; }
  branchCount() { return 2; }
  valueLabel() { return `±${fmtShort(this.p.v, 'V')}`; }
  stamp(s) {
    const [p, c, m] = this.nodes, [k1, k2] = this.branches;
    for (const [a, b, k] of [[p, c, k1], [c, m, k2]]) {
      s.addBranchKCL(a, b, k); s.addA(k, a - 1, 1); s.addA(k, b - 1, -1);
      if (this.p.rint > 0) s.addA(k, k, -this.p.rint);
    }
  }
  stampStep(s) { for (const k of this.branches) s.b[k] += this.p.v * (s.srcScale ?? 1); }
  accept(s) {
    const [i1, i2] = this.branches.map((k) => s.x[k]);
    this.postCurrents = [i1, i2 - i1, -i2]; this.i = i1;
  }
  stampAC(ac) {
    const [p, c, m] = this.nodes, [k1, k2] = this.branches;
    for (const [a, b, k] of [[p, c, k1], [c, m, k2]]) {
      ac.addBranchKCL(a, b, k); ac.addA(k, a - 1, 1); ac.addA(k, b - 1, -1);
      if (this.p.rint > 0) ac.addA(k, k, -this.p.rint);
    }
  }
  readings(s) {
    const [p, c, m] = this.nodes;
    return [['+V', s.v(p) - s.v(c), 'V'], ['−V', s.v(m) - s.v(c), 'V'], ['I(+)', -this.postCurrents[0], 'A'], ['I(−)', this.postCurrents[2], 'A']];
  }
  draw(g) {
    g.box(-0.9 * G, -1.5 * G, 0.9 * G, 1.5 * G, { stroke: g.body, width: g.lw * 0.9, fill: g.fill, r: 5 });
    g.text('+', 0.55 * G, -G, { size: 10, color: g.pos, bold: true });
    g.text('0', 0.55 * G, 0, { size: 8, color: g.muted, bold: true });
    g.text('−', 0.55 * G, G, { size: 11, color: g.neg, bold: true });
    g.upright(() => g.text('±', 0, 0, { size: 13, color: g.accent, bold: true }), -0.2 * G, 0);
  }
}
register(DualPSU);

// ------------------------------------------------------------- PV module
export class PVModule extends SolarCell {
  static type = 'pvmodule'; static title = 'Solar Panel (PV Module)'; static category = 'Sources';
  static keywords = 'solar panel pv module photovoltaic 36 cell 12v 100w renewable';
  static props = SolarCell.props.map((p) => ({ ...p, def: { isc: 5.8, voc: 0.62, cells: 36 }[p.key] ?? p.def }));
  static description = '36-cell photovoltaic module (≈22 V open circuit, 5.8 A short circuit at 1000 W/m²). Single-diode model; power peaks at the maximum power point (~17.5 V).';
}
register(PVModule);

// ------------------------------------------------------ signal generators
class SigSource extends VoltageSource {
  static category = 'Sources';
  static glyph = '';
  value(s) { return this.f(s.mode === 'dc' ? 0 : s.tNext) * (s.srcScale ?? 1); }
  f() { return 0; }
  valueLabel() { return ''; }
  leads() { return [[0, -2 * G, 0, -G * 0.8, 0], [1, 2 * G, 0, G * 0.8, 0]]; }
  accept(s) {
    this.setCurrent(s.x[this.branches[0]]);
    if (this.edgy) {
      const lvl = this.value(s) > this.mid();
      if (this.lastLevel !== null && this.lastLevel !== undefined && lvl !== this.lastLevel) s.event = true;
      this.lastLevel = lvl;
    }
  }
  mid() { return 0; }
  spice(n) { return `${this.name} ${n[0]} ${n[1]} 0 ; ${this.constructor.title} (behavioural)`; }
  draw(g) {
    g.circle(0, 0, G * 0.8, { stroke: g.body, width: g.lw * 0.9, fill: g.fill });
    g.upright(() => g.text(this.constructor.glyph, 0, 0.5, { size: 8, color: g.accent, bold: true }));
    g.text('+', -G * 1.1, -G * 0.55, { size: 11, color: g.pos, bold: true });
  }
}

const RINT = { key: 'rint', label: 'Internal resistance', unit: 'Ω', def: 0, min: 0, max: 1e6 };

export class AMSource extends SigSource {
  static type = 'amsrc'; static title = 'AM Signal Generator'; static glyph = 'AM';
  static keywords = 'am amplitude modulation modulated carrier radio signal generator';
  static props = [
    { key: 'amp', label: 'Carrier amplitude', unit: 'V', def: 5, min: 0, max: 1e4, knob: true },
    { key: 'fc', label: 'Carrier frequency', unit: 'Hz', def: 10000, min: 1e-3, max: 1e9, log: true },
    { key: 'fm', label: 'Modulating frequency', unit: 'Hz', def: 500, min: 1e-3, max: 1e9, log: true },
    { key: 'm', label: 'Modulation index', unit: '', def: 0.5, min: 0, max: 2 },
    RINT,
  ];
  static description = 'Amplitude modulation: v = A·(1 + m·sin 2πfm·t)·sin 2πfc·t.';
  f(t) { const p = this.p; return p.amp * (1 + p.m * Math.sin(TAU * p.fm * t)) * Math.sin(TAU * p.fc * t); }
  valueLabel() { return `AM ${fmtShort(this.p.fc, 'Hz')}`; }
}
register(AMSource);

export class FMSource extends SigSource {
  static type = 'fmsrc'; static title = 'FM Signal Generator'; static glyph = 'FM';
  static keywords = 'fm frequency modulation modulated carrier signal generator';
  static props = [
    { key: 'amp', label: 'Amplitude', unit: 'V', def: 5, min: 0, max: 1e4, knob: true },
    { key: 'fc', label: 'Carrier frequency', unit: 'Hz', def: 10000, min: 1e-3, max: 1e9, log: true },
    { key: 'fm', label: 'Modulating frequency', unit: 'Hz', def: 500, min: 1e-3, max: 1e9, log: true },
    { key: 'dev', label: 'Frequency deviation', unit: 'Hz', def: 3000, min: 0, max: 1e9 },
    RINT,
  ];
  static description = 'Frequency modulation: v = A·sin(2πfc·t + (Δf/fm)·sin 2πfm·t).';
  f(t) { const p = this.p; return p.amp * Math.sin(TAU * p.fc * t + (p.dev / p.fm) * Math.sin(TAU * p.fm * t)); }
  valueLabel() { return `FM ${fmtShort(this.p.fc, 'Hz')}`; }
}
register(FMSource);

export class PWMSource extends SigSource {
  static type = 'pwm'; static title = 'PWM Generator'; static glyph = 'PWM';
  static keywords = 'pwm pulse width modulation duty cycle gate drive signal';
  static props = [
    { key: 'duty', label: 'Duty cycle', unit: '%', def: 50, min: 0, max: 100, knob: true },
    { key: 'freq', label: 'Frequency', unit: 'Hz', def: 1000, min: 1e-3, max: 1e9, log: true },
    { key: 'vhigh', label: 'High level', unit: 'V', def: 5, min: -1e4, max: 1e4 },
    { key: 'vlow', label: 'Low level', unit: 'V', def: 0, min: -1e4, max: 1e4 },
    RINT,
  ];
  static description = 'Rectangular PWM signal with the duty cycle on the knob — for driving MOSFET/IGBT gates, motors and LEDs.';
  edgy = true;
  f(t) { const p = this.p, fr = p.freq * t - Math.floor(p.freq * t); return fr < p.duty / 100 ? p.vhigh : p.vlow; }
  mid() { return (this.p.vhigh + this.p.vlow) / 2; }
  valueLabel() { return `${this.p.duty.toFixed(0)}% ${fmtShort(this.p.freq, 'Hz')}`; }
}
register(PWMSource);

export class StepSource extends SigSource {
  static type = 'stepsrc'; static title = 'Step Source'; static glyph = '⎍';
  static keywords = 'step unit step response source switch on heaviside';
  static props = [
    { key: 'v1', label: 'Final value', unit: 'V', def: 5, min: -1e4, max: 1e4, knob: true },
    { key: 'v0', label: 'Initial value', unit: 'V', def: 0, min: -1e4, max: 1e4 },
    { key: 't0', label: 'Step time', unit: 's', def: 1e-3, min: 0, max: 1e4 },
    { key: 'tr', label: 'Rise time', unit: 's', def: 1e-6, min: 0, max: 10 },
    RINT,
  ];
  static description = 'Step input V0 → V1 at t0 with a linear rise time — for step-response measurements.';
  edgy = true;
  f(t) {
    const { v0, v1, t0, tr } = this.p;
    if (t <= t0) return v0;
    if (tr > 0 && t < t0 + tr) return v0 + ((v1 - v0) * (t - t0)) / tr;
    return v1;
  }
  mid() { return (this.p.v0 + this.p.v1) / 2; }
  valueLabel() { return `${fmtShort(this.p.v0, 'V')}→${fmtShort(this.p.v1, 'V')}`; }
}
register(StepSource);

export class ExpSource extends SigSource {
  static type = 'expsrc'; static title = 'Exponential Source'; static glyph = 'EXP';
  static keywords = 'exponential exp spice source rise fall';
  static props = [
    { key: 'v2', label: 'Pulsed value', unit: 'V', def: 5, min: -1e4, max: 1e4, knob: true },
    { key: 'v1', label: 'Initial value', unit: 'V', def: 0, min: -1e4, max: 1e4 },
    { key: 'td1', label: 'Rise delay', unit: 's', def: 0, min: 0, max: 1e4 },
    { key: 'tau1', label: 'Rise time constant', unit: 's', def: 1e-3, min: 1e-12, max: 1e4, log: true },
    { key: 'td2', label: 'Fall delay', unit: 's', def: 5e-3, min: 0, max: 1e4 },
    { key: 'tau2', label: 'Fall time constant', unit: 's', def: 1e-3, min: 1e-12, max: 1e4, log: true },
    RINT,
  ];
  static description = 'SPICE EXP source: exponential rise from V1 towards V2 after td1, then exponential fall back after td2.';
  f(t) {
    const { v1, v2, td1, tau1, td2, tau2 } = this.p;
    let v = v1;
    if (t > td1) v += (v2 - v1) * (1 - Math.exp(-(t - td1) / tau1));
    if (t > td2) v += (v1 - v2) * (1 - Math.exp(-(t - td2) / tau2));
    return v;
  }
  valueLabel() { return `EXP ${fmtShort(this.p.v2, 'V')}`; }
}
register(ExpSource);

export class DampedSine extends SigSource {
  static type = 'dampsine'; static title = 'Damped Sine'; static glyph = 'DS';
  static keywords = 'damped sine decaying oscillation ringing test signal';
  static props = [
    { key: 'amp', label: 'Amplitude', unit: 'V', def: 5, min: 0, max: 1e4, knob: true },
    { key: 'freq', label: 'Frequency', unit: 'Hz', def: 1000, min: 1e-3, max: 1e9, log: true },
    { key: 'alpha', label: 'Damping factor α', unit: '1/s', def: 500, min: 0, max: 1e9 },
    { key: 'td', label: 'Delay', unit: 's', def: 0, min: 0, max: 1e4 },
    { key: 'offset', label: 'DC offset', unit: 'V', def: 0, min: -1e4, max: 1e4 },
    RINT,
  ];
  static description = 'v = Voff + A·e^(−α(t−td))·sin(2πf(t−td)) for t > td (SPICE SIN with damping).';
  f(t) {
    const p = this.p;
    if (t < p.td) return p.offset;
    const u = t - p.td;
    return p.offset + p.amp * Math.exp(-p.alpha * u) * Math.sin(TAU * p.freq * u);
  }
  valueLabel() { return `${fmtShort(this.p.amp, 'V')} ${fmtShort(this.p.freq, 'Hz')}`; }
}
register(DampedSine);

export class PWLSource extends SigSource {
  static type = 'pwlsrc'; static title = 'Piecewise-Linear Source'; static glyph = 'PWL';
  static keywords = 'pwl piecewise linear arbitrary waveform table points spice';
  static props = [
    { key: 'pts', label: 'Points "t v; t v; …"', type: 'text', def: '0 0; 1m 5; 3m 5; 4m 0' },
    { key: 'repeat', label: 'Repeat', type: 'bool', def: true },
    { key: 'scale', label: 'Scale', unit: '×', def: 1, min: -1e4, max: 1e4, knob: true },
    RINT,
  ];
  static description = 'Voltage defined by (time, value) pairs with linear interpolation, optionally repeating. SI suffixes allowed: "0 0; 1m 5; 2m 0".';
  table() {
    if (this._src !== this.p.pts) {
      this._src = this.p.pts;
      this._tbl = String(this.p.pts).split(/[;\n]+/).map((r) => r.trim().split(/[\s,]+/).map(parseSI)).filter((r) => r.length >= 2 && r.every(Number.isFinite)).sort((a, b) => a[0] - b[0]);
      if (!this._tbl.length) this._tbl = [[0, 0]];
    }
    return this._tbl;
  }
  f(t) {
    const tb = this.table(), T = tb[tb.length - 1][0];
    if (this.p.repeat && T > 0) t = t - T * Math.floor(t / T);
    return this.p.scale * interp(tb, t);
  }
  valueLabel() { return 'PWL'; }
}
register(PWLSource);

export class FuncSource extends SigSource {
  static type = 'funcsrc'; static title = 'Function Source f(t)'; static glyph = 'f(t)';
  static keywords = 'arbitrary function expression formula behavioral source math custom waveform';
  static props = [
    { key: 'expr', label: 'v(t) =', type: 'text', def: '5*sin(2*pi*50*t) + 1.5*sin(2*pi*150*t)' },
    { key: 'k', label: 'Parameter k (use as k)', unit: '', def: 1, min: -1e6, max: 1e6, knob: true },
    RINT,
  ];
  static description = 'Voltage given by a formula of time t (and the knob parameter k). Functions: sin cos tan exp ln log10 sqrt abs min max pow floor sign step square tri if(c,a,b); constants pi, e; SI suffixes (1k, 2m).';
  f(t) { const [fn] = exprFn(this.p.expr, ['t', 'k']); return fn({ t, k: this.p.k }); }
  valueLabel() { const e = String(this.p.expr); return e.length > 18 ? e.slice(0, 17) + '…' : e; }
  readings(s) {
    const [, err] = exprFn(this.p.expr, ['t', 'k']);
    return err ? [['Formula error', err, '']] : super.readings(s);
  }
}
register(FuncSource);

// ---------------------------------------------------------- earth / chassis
export class Earth extends Ground {
  static type = 'earth'; static title = 'Protective Earth'; static keywords = 'earth pe protective earth ground electrode';
  static description = 'Protective earth (PE). Electrically the same reference as ground (0 V).';
  draw(g) {
    g.circle(0, 0.72 * G, 0.62 * G, { stroke: g.body, width: g.lw * 0.8 });
    super.draw(g);
  }
  localBox() { return [-0.7 * G, -4, 0.7 * G, 1.4 * G]; }
}
register(Earth);

export class Chassis extends Ground {
  static type = 'chassis'; static title = 'Chassis Ground'; static keywords = 'chassis frame ground body';
  static description = 'Chassis / frame connection. Electrically the same reference as ground (0 V).';
  draw(g) {
    g.line(-0.55 * G, 0.5 * G, 0.55 * G, 0.5 * G, g.body, g.lw * 1.1);
    for (const x of [-0.5, 0, 0.5]) g.line(x * G, 0.5 * G, (x - 0.3) * G, G, g.body, g.lw);
  }
}
register(Chassis);
