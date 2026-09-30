// Electrical machines:
//  - DC machines: separately excited, shunt, series (flux from a saturating
//    magnetisation curve), PM DC generator driven at a set speed
//  - 3-phase induction motor: dynamic αβ model (stator phases + rotor αβ
//    currents, speed state), as used in machine-drives research
//  - 1-phase capacitor induction motor (main + auxiliary winding model)
//  - 3-phase synchronous generator (EMF behind synchronous impedance)
//
// Electrical equations are solved implicitly with the circuit (backward Euler);
// the mechanical speed is advanced after each accepted step.

import { Element, TwoTerm, register, GRID } from './base.js';
import { fmtQty, fmtShort } from '../engine/units.js';

const G = GRID;
const TAU = 2 * Math.PI;
const rpm = (w) => (w * 60) / TAU;

function drawMotor(g, label, ang, running, r = G) {
  g.circle(0, 0, r, { stroke: g.body, width: g.lw * 0.9, fill: g.fill });
  if (running) {
    const ctx = g.ctx;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.78, ang, ang + 1.2);
    ctx.strokeStyle = g.accent; ctx.lineWidth = g.lw * 0.8; ctx.stroke();
  }
  g.upright(() => g.text(label, 0, 0.5, { size: label.length > 2 ? 7.5 : 9, color: g.text2, bold: true }));
}

// ------------------------------------------------------------ DC machines
const FIELD = (i, ir) => { const x = i / Math.max(ir, 1e-9); return Math.tanh(1.2 * x) / Math.tanh(1.2); };

class DCMachine extends Element {
  static category = 'Machines';
  static prefix = 'M';
  static conn = 'sep'; // sep | shunt | series
  static props = [
    { key: 'load', label: 'Load torque', unit: 'N·m', def: 2, min: -1e4, max: 1e4, knob: true },
    { key: 'ke', label: 'EMF constant at rated field', unit: 'V·s/rad', def: 1.2, min: 1e-4, max: 100, log: true },
    { key: 'ra', label: 'Armature resistance', unit: 'Ω', def: 0.5, min: 1e-4, max: 1e4, log: true },
    { key: 'la', label: 'Armature inductance', unit: 'H', def: 0.01, min: 1e-6, max: 10, log: true },
    { key: 'rf', label: 'Field resistance', unit: 'Ω', def: 220, min: 1e-4, max: 1e5, log: true },
    { key: 'lf', label: 'Field inductance', unit: 'H', def: 20, min: 1e-6, max: 1e3, log: true },
    { key: 'ifr', label: 'Rated field current', unit: 'A', def: 1, min: 1e-4, max: 1e3, log: true },
    { key: 'j', label: 'Inertia J', unit: 'kg·m²', def: 0.05, min: 1e-6, max: 1e4, log: true },
    { key: 'b', label: 'Friction b', unit: 'N·m·s', def: 0.002, min: 0, max: 100 },
  ];
  constructor(x, y) { super(x, y); this.postCurrents = new Array(this.localPosts().length).fill(0); this.w = 0; this.ang = 0; this.phi = 0; }
  conn() { return this.constructor.conn; }
  localPosts() { return this.conn() === 'sep' ? [[-2 * G, -G], [-2 * G, G], [2 * G, -G], [2 * G, G]] : [[-2 * G, 0], [2 * G, 0]]; }
  localBox() { return this.conn() === 'sep' ? [-2 * G, -1.6 * G, 2 * G, 1.6 * G] : [-2 * G, -1.2 * G, 2 * G, 1.2 * G]; }
  leads() {
    if (this.conn() === 'sep') return [[0, -2 * G, -G, -0.6 * G, -G], [1, -2 * G, G, -0.6 * G, G], [2, 2 * G, -G, 1.2 * G, -G], [3, 2 * G, G, 1.2 * G, G]];
    return [[0, -2 * G, 0, -G, 0], [1, 2 * G, 0, G, 0]];
  }
  connectivity() { return this.conn() === 'sep' ? [[0, 1], [2, 3]] : null; }
  internalNodeCount() { return this.conn() === 'series' ? 1 : 0; }
  branchCount() { return 3; } // armature current, field current, speed
  // armature ends and field ends
  arm() { const n = this.nodes; return this.conn() === 'series' ? [this.inodes[0], n[1]] : [n[0], n[1]]; }
  fld() { const n = this.nodes; return this.conn() === 'sep' ? [n[2], n[3]] : this.conn() === 'shunt' ? [n[0], n[1]] : [n[0], this.inodes[0]]; }
  reset() { this.w = 0; this.ia = 0; this.if = 0; this.ang = 0; this.phi = this.conn() === 'sep' ? 0 : 0; this.postCurrents.fill(0); }
  kphi() { return this.p.ke * this.phi; }
  stamp(s) {
    const [ka, kf, kw] = this.branches, [a1, a2] = this.arm(), [f1, f2] = this.fld(), p = this.p;
    const be = s.mode === 'dc' ? 0 : 1 / s.dt, K = this.kphi();
    // armature: v = Ra·ia + La·dia/dt + K·ω
    s.addBranchKCL(a1, a2, ka); s.addA(ka, a1 - 1, 1); s.addA(ka, a2 - 1, -1);
    s.addA(ka, ka, -(p.ra + be * p.la)); s.addA(ka, kw, -K);
    // field: v = Rf·if + Lf·dif/dt
    s.addBranchKCL(f1, f2, kf); s.addA(kf, f1 - 1, 1); s.addA(kf, f2 - 1, -1);
    s.addA(kf, kf, -(p.rf + be * p.lf));
    // mechanics: J·dω/dt = K·ia − b·ω − T
    s.addA(kw, kw, be * p.j + Math.max(p.b, 1e-9)); s.addA(kw, ka, -K);
  }
  stampStep(s) {
    const [ka, kf, kw] = this.branches, p = this.p;
    if (s.mode !== 'dc') {
      s.b[ka] += -(p.la / s.dt) * this.ia;
      s.b[kf] += -(p.lf / s.dt) * this.if;
      s.b[kw] += (p.j / s.dt) * this.w;
    }
    s.b[kw] -= p.load;
  }
  accept(s) {
    const [ka, kf, kw] = this.branches;
    this.ia = s.x[ka]; this.if = s.x[kf]; this.w = s.x[kw];
    if (s.mode !== 'dc') this.ang += this.w * s.dt;
    // flux follows the field current (series: armature current is the field current)
    const phi = FIELD(this.if, this.p.ifr) + (this.conn() === 'sep' ? 0 : 0.02);
    if (Math.abs(phi - this.phi) > 1e-4) { this.phi = phi; s.dirty = true; }
    const c = this.conn(), ia = this.ia, iff = this.if;
    if (c === 'sep') this.postCurrents = [ia, -ia, iff, -iff];
    else if (c === 'shunt') this.postCurrents = [ia + iff, -(ia + iff)];
    else this.postCurrents = [iff, -ia];
    this.i = this.postCurrents[0];
  }
  valueLabel() { return fmtQty(Math.round(rpm(this.w || 0)), 'rpm'); }
  readings(s) {
    const [a1, a2] = this.arm();
    return [['Speed', rpm(this.w || 0), 'rpm'], ['Torque', this.kphi() * (this.ia || 0), 'N·m'], ['Armature current', this.ia || 0, 'A'], ['Field current', this.if || 0, 'A'],
      ['Back-EMF', this.kphi() * (this.w || 0), 'V'], ['Armature voltage', s.v(a1) - s.v(a2), 'V'], ['Mechanical power', this.kphi() * (this.ia || 0) * (this.w || 0), 'W']];
  }
  draw(g) {
    drawMotor(g, 'M', this.ang || 0, g.running);
    if (this.conn() === 'sep') {
      const ctx = g.ctx; ctx.beginPath();
      for (let k = 0; k < 3; k++) ctx.arc(1.2 * G, -G + (2 * G / 3) * (k + 0.5), G / 3, -Math.PI / 2, Math.PI / 2, true);
      ctx.strokeStyle = g.body; ctx.lineWidth = g.lw * 0.8; ctx.stroke();
      g.text('F', 1.55 * G, 0, { size: 7, color: g.muted, bold: true });
      g.text('A', -1.45 * G, 0, { size: 7, color: g.muted, bold: true });
    } else if (this.conn() === 'series') g.upright(() => g.text('series', 0, 0.5 * G, { size: 6, color: g.muted }));
    else g.upright(() => g.text('shunt', 0, 0.5 * G, { size: 6, color: g.muted }));
  }
}

function dcm(type, title, conn, defs, keywords, desc) {
  const C = class extends DCMachine {};
  Object.assign(C, { type, title, conn, keywords, description: desc });
  C.props = DCMachine.props.map((p) => ({ ...p, def: defs[p.key] ?? p.def }));
  register(C);
}
dcm('dcsep', 'DC Motor (separately excited)', 'sep', {}, 'dc motor separately excited field armature wound field machine',
  'DC machine with separate armature (left: A+ A−) and field (right: F+ F−) terminals. Flux follows a saturating magnetisation curve of the field current; E = K·φ·ω, T = K·φ·Ia. Reversing the torque makes it a generator.');
dcm('dcshunt', 'DC Shunt Motor', 'shunt', {}, 'dc shunt motor constant speed field parallel',
  'DC shunt motor: field winding in parallel with the armature across the two terminals. Nearly constant speed with load.');
dcm('dcseries', 'DC Series Motor', 'series', { rf: 0.3, lf: 0.02, ifr: 10, load: 5 }, 'dc series motor universal traction high starting torque',
  'DC series motor: the field carries the armature current, so torque ∝ I² at low current — very high starting torque; never run it unloaded (speed runs away).');

export class DCGenerator extends TwoTerm {
  static type = 'dcgen'; static title = 'DC Generator (PM)'; static category = 'Machines';
  static prefix = 'G'; static keywords = 'dc generator dynamo permanent magnet prime mover tachometer wind turbine';
  static props = [
    { key: 'rpm', label: 'Prime-mover speed', unit: 'rpm', def: 1500, min: -1e5, max: 1e5, knob: true },
    { key: 'ke', label: 'EMF constant', unit: 'V/krpm', def: 100, min: 1e-3, max: 1e5, log: true },
    { key: 'ra', label: 'Armature resistance', unit: 'Ω', def: 0.5, min: 1e-4, max: 1e4, log: true },
    { key: 'la', label: 'Armature inductance', unit: 'H', def: 0.01, min: 1e-6, max: 10, log: true },
  ];
  static description = 'Permanent-magnet DC generator driven at a set speed: E = Ke·speed behind Ra + La. The load current produces a braking torque T = E·I/ω.';
  refNode = 1;
  constructor(x, y) { super(x, y); this.ang = 0; }
  branchCount() { return 1; }
  reset() { this.il = 0; this.setCurrent(0); }
  emf() { return (this.p.ke * this.p.rpm) / 1000; }
  stamp(s) {
    const k = this.branches[0], [a, b] = this.nodes;
    s.addBranchKCL(a, b, k); s.addA(k, a - 1, 1); s.addA(k, b - 1, -1);
    s.addA(k, k, -(this.p.ra + (s.mode === 'dc' ? 0 : this.p.la / s.dt)));
  }
  stampStep(s) { s.b[this.branches[0]] += this.emf() * (s.srcScale ?? 1) - (s.mode === 'dc' ? 0 : (this.p.la / s.dt) * this.il); }
  accept(s) { this.il = s.x[this.branches[0]]; this.setCurrent(this.il); if (s.mode !== 'dc') this.ang += (this.p.rpm / 60) * TAU * s.dt; }
  stampAC(ac) {
    const k = this.branches[0], [a, b] = this.nodes;
    ac.addBranchKCL(a, b, k); ac.addA(k, a - 1, 1); ac.addA(k, b - 1, -1); ac.addA(k, k, -this.p.ra, -ac.omega * this.p.la);
  }
  valueLabel() { return fmtQty(this.p.rpm, 'rpm'); }
  readings(s) {
    const w = (this.p.rpm * TAU) / 60, P = -this.emf() * this.i;
    return [['EMF', this.emf(), 'V'], ['Terminal voltage', this.voltageDiff(s), 'V'], ['Current (out of +)', -this.i, 'A'], ['Electrical power', P, 'W'], ['Shaft torque', Math.abs(w) > 1e-6 ? P / w : 0, 'N·m']];
  }
  leads() { return [[0, -2 * G, 0, -G, 0], [1, 2 * G, 0, G, 0]]; }
  localBox() { return [-2 * G, -1.1 * G, 2 * G, 1.1 * G]; }
  draw(g) { drawMotor(g, 'G', this.ang || 0, g.running); g.text('+', -1.35 * G, -0.55 * G, { size: 10, color: g.pos, bold: true }); }
}
register(DCGenerator);

// -------------------------------------------------- AC induction machines
/**
 * Stator + rotor(αβ) windings: flux ψ = L·i, voltage v = Rm(ω)·i + dψ/dt, where
 * Rm contains the resistances and the speed-voltage terms of the rotor.
 */
class InductionBase extends Element {
  static category = 'Machines';
  static prefix = 'M';
  constructor(x, y) { super(x, y); this.postCurrents = new Array(this.localPosts().length).fill(0); this.wm = 0; this.ang = 0; this.te = 0; }
  nStator() { return 3; }
  branchCount() { return this.nStator() + 2; }
  reset() { this.wm = 0; this.ang = 0; this.te = 0; this.iprev = new Array(this.branchCount()).fill(0); this.postCurrents.fill(0); this.irms = 0; this.pin = 0; }
  wr() { return this.p.poles / 2 * this.wm; }
  stamp(s) {
    const L = this.Lm_(), R = this.Rm_(this.wr()), br = this.branches, ns = this.nStator(), f = s.mode === 'dc' ? 0 : 1 / s.dt;
    const ends = this.statorEnds();
    for (let k = 0; k < br.length; k++) {
      if (k < ns) { const [a, b] = ends[k]; s.addBranchKCL(a, b, br[k]); s.addA(br[k], a - 1, 1); s.addA(br[k], b - 1, -1); }
      for (let j = 0; j < br.length; j++) { const v = R[k][j] + f * L[k][j]; if (v) s.addA(br[k], br[j], -v); }
    }
  }
  stampStep(s) {
    if (s.mode === 'dc') return;
    const L = this.Lm_(), br = this.branches;
    for (let k = 0; k < br.length; k++) {
      let psi = 0;
      for (let j = 0; j < br.length; j++) psi += L[k][j] * this.iprev[j];
      s.b[br[k]] += -psi / s.dt;
    }
  }
  accept(s) {
    const br = this.branches, i = br.map((k) => s.x[k]);
    this.iprev = i;
    this.te = this.torque(i);
    if (s.mode !== 'dc') {
      const wsync = (TAU * this.p.freq) / (this.p.poles / 2);
      const TL = this.p.loadType === 'fan' ? this.p.load * (this.wm / wsync) ** 2 * Math.sign(this.wm || 1) : this.p.load * Math.tanh(this.wm / 0.5);
      const wn = this.wm + ((this.te - TL - this.p.b * this.wm) / this.p.j) * s.dt;
      if (Math.abs(wn - this.wm) > 1e-9) s.dirty = true; // speed terms live in the matrix
      this.wm = wn;
      this.ang += this.wm * s.dt;
      const ia = i[0];
      this.irms = Math.sqrt(Math.max(0, (this.irms || 0) ** 2 + (ia * ia - (this.irms || 0) ** 2) * Math.min(1, s.dt / 0.04)));
    }
    this.statorCurrents(i);
  }
  slip() { const ws = (TAU * this.p.freq) / (this.p.poles / 2); return ws > 0 ? (ws - this.wm) / ws : 0; }
  valueLabel() { return fmtQty(Math.round(rpm(this.wm || 0)), 'rpm'); }
  readings() {
    return [['Speed', rpm(this.wm || 0), 'rpm'], ['Slip', this.slip() * 100, '%'], ['Torque', this.te || 0, 'N·m'],
      ['Stator current (RMS)', this.irms || 0, 'A'], ['Output power', (this.te || 0) * (this.wm || 0), 'W']];
  }
}

export class InductionMotor3 extends InductionBase {
  static type = 'im3'; static title = '3-Phase Induction Motor'; static keywords = 'induction motor three phase squirrel cage asynchronous 3 phase motor 5hp 3.7kw';
  static props = [
    { key: 'load', label: 'Load torque', unit: 'N·m', def: 10, min: -1e4, max: 1e4, knob: true },
    { key: 'loadType', label: 'Load type', type: 'select', def: 'const', options: [['const', 'Constant torque'], ['fan', 'Fan / pump (∝ speed²)']] },
    { key: 'poles', label: 'Poles', unit: '', def: 4, min: 2, max: 48 },
    { key: 'freq', label: 'Rated frequency', unit: 'Hz', def: 50, min: 1, max: 1000 },
    { key: 'rs', label: 'Stator resistance Rs', unit: 'Ω', def: 1.5, min: 1e-4, max: 1e3, log: true },
    { key: 'rr', label: "Rotor resistance Rr'", unit: 'Ω', def: 1.1, min: 1e-4, max: 1e3, log: true },
    { key: 'lls', label: 'Stator leakage Lls', unit: 'H', def: 0.0065, min: 1e-6, max: 1, log: true },
    { key: 'llr', label: "Rotor leakage Llr'", unit: 'H', def: 0.0065, min: 1e-6, max: 1, log: true },
    { key: 'lm', label: 'Magnetising Lm', unit: 'H', def: 0.2, min: 1e-4, max: 10, log: true },
    { key: 'j', label: 'Inertia J', unit: 'kg·m²', def: 0.03, min: 1e-6, max: 1e4, log: true },
    { key: 'b', label: 'Friction b', unit: 'N·m·s', def: 0.001, min: 0, max: 100 },
  ];
  static description = 'Squirrel-cage induction motor, dynamic model in the stationary αβ frame (3 stator phases in star + rotor αβ circuits, speed as a state). Shows starting current (≈6×), acceleration, slip and torque. Defaults ≈ 3.7 kW, 400 V, 50 Hz, 4-pole.';
  localPosts() { return [[-2 * G, -G], [-2 * G, 0], [-2 * G, G]]; }
  localBox() { return [-2 * G, -1.5 * G, 1.6 * G, 1.5 * G]; }
  leads() { return this.localPosts().map(([x, y], i) => [i, x, y, -1.05 * G, y * 0.6]); }
  labelSide() { return [0, -1]; }
  internalNodeCount() { return 1; }
  statorEnds() { return [0, 1, 2].map((k) => [this.nodes[k], this.inodes[0]]); }
  stamp(s) { super.stamp(s); s.addG(this.inodes[0], 0, 1e-9); }
  Lm_() {
    const { lls, llr, lm } = this.p, Ls = lls + lm, Lr = llr + lm;
    const th = [0, (2 * Math.PI) / 3, (-2 * Math.PI) / 3], c = th.map(Math.cos), sn = th.map(Math.sin);
    const L = Array.from({ length: 5 }, () => new Array(5).fill(0));
    for (let x = 0; x < 3; x++) {
      for (let y = 0; y < 3; y++) L[x][y] = (2 / 3) * Ls * Math.cos(th[x] - th[y]);
      L[x][3] = lm * c[x]; L[x][4] = lm * sn[x];
      L[3][x] = (2 / 3) * lm * c[x]; L[4][x] = (2 / 3) * lm * sn[x];
    }
    L[3][3] = Lr; L[4][4] = Lr;
    return L;
  }
  Rm_(wr) {
    const { rs, rr, llr, lm } = this.p, Lr = llr + lm;
    const th = [0, (2 * Math.PI) / 3, (-2 * Math.PI) / 3];
    const R = Array.from({ length: 5 }, () => new Array(5).fill(0));
    for (let x = 0; x < 3; x++) R[x][x] = rs;
    R[3][3] = rr; R[4][4] = rr;
    // rotor speed voltages: +ωr·ψrβ in the α equation, −ωr·ψrα in the β equation
    R[3][4] += wr * Lr; R[4][3] -= wr * Lr;
    for (let y = 0; y < 3; y++) { R[3][y] += wr * (2 / 3) * lm * Math.sin(th[y]); R[4][y] -= wr * (2 / 3) * lm * Math.cos(th[y]); }
    return R;
  }
  torque(i) {
    const th = [0, (2 * Math.PI) / 3, (-2 * Math.PI) / 3];
    let sa = 0, sb = 0;
    for (let k = 0; k < 3; k++) { sa += (2 / 3) * Math.cos(th[k]) * i[k]; sb += (2 / 3) * Math.sin(th[k]) * i[k]; }
    return 1.5 * (this.p.poles / 2) * this.p.lm * (sb * i[3] - sa * i[4]);
  }
  statorCurrents(i) { this.postCurrents = [i[0], i[1], i[2]]; this.i = i[0]; }
  draw(g) {
    drawMotor(g, 'M 3~', this.ang || 0, g.running, 1.05 * G);
    ['U', 'V', 'W'].forEach((t, k) => g.text(t, -1.55 * G, (k - 1) * G - 0.35 * G, { size: 6.5, color: g.muted }));
  }
}
register(InductionMotor3);

export class InductionMotor1 extends InductionBase {
  static type = 'im1'; static title = '1-Phase Capacitor Motor'; static keywords = 'single phase induction motor capacitor run start fan pump psc motor';
  static props = [
    { key: 'load', label: 'Load torque', unit: 'N·m', def: 1, min: -1e3, max: 1e3, knob: true },
    { key: 'loadType', label: 'Load type', type: 'select', def: 'fan', options: [['const', 'Constant torque'], ['fan', 'Fan / pump (∝ speed²)']] },
    { key: 'poles', label: 'Poles', unit: '', def: 4, min: 2, max: 48 },
    { key: 'freq', label: 'Rated frequency', unit: 'Hz', def: 50, min: 1, max: 1000 },
    { key: 'rm', label: 'Main winding resistance', unit: 'Ω', def: 10, min: 1e-3, max: 1e4, log: true },
    { key: 'ra', label: 'Aux winding resistance', unit: 'Ω', def: 16, min: 1e-3, max: 1e4, log: true },
    { key: 'a', label: 'Aux/main turns ratio', unit: '', def: 1.2, min: 0.2, max: 5 },
    { key: 'lls', label: 'Leakage (main)', unit: 'H', def: 0.04, min: 1e-6, max: 10, log: true },
    { key: 'lm', label: 'Magnetising Lm', unit: 'H', def: 0.6, min: 1e-4, max: 100, log: true },
    { key: 'rr', label: 'Rotor resistance', unit: 'Ω', def: 8, min: 1e-3, max: 1e4, log: true },
    { key: 'llr', label: 'Rotor leakage', unit: 'H', def: 0.04, min: 1e-6, max: 10, log: true },
    { key: 'j', label: 'Inertia J', unit: 'kg·m²', def: 0.004, min: 1e-6, max: 100, log: true },
    { key: 'b', label: 'Friction b', unit: 'N·m·s', def: 1e-4, min: 0, max: 10 },
  ];
  static description = 'Permanent-split-capacitor motor: main winding M–C and auxiliary winding A–C in quadrature. Connect the run capacitor (e.g. 2.5 µF) between M and A and the supply across M–C. Without the capacitor it cannot start.';
  localPosts() { return [[-2 * G, -G], [-2 * G, G], [0, 2 * G]]; }
  localBox() { return [-2 * G, -1.4 * G, 1.4 * G, 2 * G]; }
  leads() { return [[0, -2 * G, -G, -0.8 * G, -0.6 * G], [1, -2 * G, G, -0.8 * G, 0.6 * G], [2, 0, 2 * G, 0, G]]; }
  labelSide() { return [1, 0]; }
  nStator() { return 2; }
  statorEnds() { const [m, a, c] = this.nodes; return [[m, c], [a, c]]; }
  Lm_() {
    const { lls, llr, lm } = this.p, a = -this.p.a, Lr = llr + lm;
    return [
      [lls + lm, 0, lm, 0],
      [0, a * a * (lls + lm), 0, a * lm],
      [lm, 0, Lr, 0],
      [0, a * lm, 0, Lr],
    ];
  }
  Rm_(wr) {
    const { rm, ra, rr, llr, lm } = this.p, a = -this.p.a, Lr = llr + lm;
    const R = [[rm, 0, 0, 0], [0, ra, 0, 0], [0, 0, rr, 0], [0, 0, 0, rr]];
    // α: +ωr·ψrβ = ωr(Lr·irβ + a·Lm·iaux); β: −ωr·ψrα = −ωr(Lr·irα + Lm·imain)
    R[2][3] += wr * Lr; R[2][1] += wr * a * lm;
    R[3][2] -= wr * Lr; R[3][0] -= wr * lm;
    return R;
  }
  torque(i) { return (this.p.poles / 2) * this.p.lm * (-this.p.a * i[1] * i[2] - i[0] * i[3]); }
  statorCurrents(i) { this.postCurrents = [i[0], i[1], -(i[0] + i[1])]; this.i = i[0]; }
  draw(g) {
    drawMotor(g, 'M 1~', this.ang || 0, g.running, 1.05 * G);
    g.text('M', -1.5 * G, -1.35 * G, { size: 6.5, color: g.muted }); g.text('A', -1.5 * G, 0.65 * G, { size: 6.5, color: g.muted }); g.text('C', 0.4 * G, 1.6 * G, { size: 6.5, color: g.muted });
  }
}
register(InductionMotor1);

// ------------------------------------------------- synchronous generator
export class Alternator extends Element {
  static type = 'alternator'; static title = '3-Phase Alternator'; static category = 'Machines';
  static prefix = 'G'; static keywords = 'alternator synchronous generator three phase generator diesel genset excitation';
  static props = [
    { key: 'field', label: 'Excitation (field current)', unit: '%', def: 100, min: 0, max: 200, knob: true },
    { key: 'vll', label: 'Open-circuit line voltage at 100 %', unit: 'V', def: 415, min: 1, max: 1e6, log: true },
    { key: 'freq', label: 'Frequency', unit: 'Hz', def: 50, min: 1, max: 1000 },
    { key: 'xs', label: 'Synchronous reactance Xs', unit: 'Ω', def: 1.5, min: 1e-4, max: 1e4, log: true },
    { key: 'ra', label: 'Armature resistance Ra', unit: 'Ω', def: 0.05, min: 1e-5, max: 1e3, log: true },
  ];
  static description = 'Round-rotor synchronous generator: per-phase EMF E = k·If behind Ra + jXs (star, neutral brought out). Excitation controls terminal voltage and reactive power; watch the voltage regulation with load.';
  refNode = 3;
  constructor(x, y) { super(x, y); this.postCurrents = [0, 0, 0, 0]; this.ang = 0; this.il = [0, 0, 0]; }
  localPosts() { return [[2 * G, -2 * G], [2 * G, -G], [2 * G, 0], [2 * G, G]]; }
  localBox() { return [-1.6 * G, -2.4 * G, 2 * G, 1.6 * G]; }
  leads() { return this.localPosts().map(([x, y], i) => [i, x, y, 0.9 * G, y]); }
  labelSide() { return [-1, 0]; }
  branchCount() { return 3; }
  L() { return this.p.xs / (TAU * this.p.freq); }
  reset() { this.il = [0, 0, 0]; this.postCurrents.fill(0); this.ang = 0; }
  stamp(s) {
    const n = this.nodes[3], f = s.mode === 'dc' ? 0 : 1 / s.dt;
    for (let p = 0; p < 3; p++) {
      const k = this.branches[p], a = this.nodes[p];
      s.addBranchKCL(a, n, k); s.addA(k, a - 1, 1); s.addA(k, n - 1, -1); s.addA(k, k, -(this.p.ra + f * this.L()));
    }
  }
  stampStep(s) {
    if (s.mode === 'dc') return; // AC machine: no DC component at the operating point
    const E = ((this.p.vll / Math.sqrt(3)) * Math.SQRT2 * this.p.field) / 100;
    for (let p = 0; p < 3; p++) {
      s.b[this.branches[p]] += E * Math.sin(TAU * this.p.freq * s.tNext - (p * TAU) / 3) - (this.L() / s.dt) * this.il[p];
    }
  }
  accept(s) {
    this.il = this.branches.map((k) => s.x[k]);
    this.postCurrents = [...this.il, -(this.il[0] + this.il[1] + this.il[2])];
    this.i = this.il[0];
    if (s.mode !== 'dc') this.ang += TAU * this.p.freq * s.dt / 20;
  }
  stampAC(ac) {
    const n = this.nodes[3];
    for (let p = 0; p < 3; p++) {
      const k = this.branches[p], a = this.nodes[p];
      ac.addBranchKCL(a, n, k); ac.addA(k, a - 1, 1); ac.addA(k, n - 1, -1); ac.addA(k, k, -this.p.ra, -ac.omega * this.L());
    }
  }
  valueLabel() { return `${fmtShort(this.p.vll, 'V')} ${this.p.field.toFixed(0)}%`; }
  readings(s) {
    const v = (a, b) => s.v(this.nodes[a]) - s.v(this.nodes[b]);
    return [['EMF per phase (RMS)', (this.p.vll / Math.sqrt(3)) * this.p.field / 100, 'V'], ['V_RY', v(0, 1), 'V'], ['V_RN', v(0, 3), 'V'], ['I_R', -this.il[0], 'A'], ['I_Y', -this.il[1], 'A'], ['I_B', -this.il[2], 'A']];
  }
  draw(g) {
    drawMotor(g, 'G 3~', this.ang || 0, g.running, 1.1 * G);
    ['R', 'Y', 'B', 'N'].forEach((t, i) => g.text(t, 1.4 * G, (i - 2) * G - 0.4 * G, { size: 7, color: g.muted, bold: true }));
  }
}
register(Alternator);
