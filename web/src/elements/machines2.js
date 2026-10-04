// More electrical machines:
//  - 3-phase induction motor with all six winding ends (U1 V1 W1 / U2 V2 W2)
//    for star-delta starting
//  - DC compound motor (long shunt, cumulative / differential) and universal
//    (AC/DC series) motor
//  - synchronous motor with damper cage and excitation (V-curves, leading /
//    lagging power factor) and permanent-magnet synchronous motor (PMSM)
//  - BLDC motor with trapezoidal back-EMF and three Hall sensors
//  - 2-phase hybrid stepper motor (200 steps/rev)
//  - single-phase AC generator
// Electrical equations are implicit with the circuit; speed and angle are
// advanced after each accepted step (as in machines.js).

import { Element, register, GRID } from './base.js';
import { InductionMotor3, InductionBase, DCMachine, dcm, drawMotor } from './machines.js';
import { fmtQty, fmtShort } from '../engine/units.js';

const G = GRID;
const TAU = 2 * Math.PI;
const TH = [0, (2 * Math.PI) / 3, (-2 * Math.PI) / 3];
const rpm = (w) => (w * 60) / TAU;
const wrap = (x) => x - TAU * Math.floor(x / TAU);

// ------------------------------------------- 6-terminal induction motor
export class InductionMotor6 extends InductionMotor3 {
  static type = 'im3d'; static title = '3-Phase Induction Motor (6 terminals)';
  static keywords = 'induction motor six terminal 6 lead star delta wye delta u1 v1 w1 u2 v2 w2 terminal box';
  static description = 'Squirrel-cage induction motor with both ends of each winding brought out: U1–U2, V1–V2, W1–W2. Link U2-V2-W2 for star (each winding gets 230 V from a 400 V supply) or U1-W2, V1-U2, W1-V2 for delta (each winding gets the full 400 V) — the basis of star-delta starting: in star the starting current and torque are one third of delta. Same dynamic model as the 3-terminal motor, with the leakage inductance also in the zero-sequence path so a delta connection is handled correctly.';
  localPosts() { return [[-2 * G, -G], [-2 * G, 0], [-2 * G, G], [2 * G, -G], [2 * G, 0], [2 * G, G]]; }
  pinNames() { return ['U1', 'V1', 'W1', 'U2', 'V2', 'W2']; }
  localBox() { return [-2 * G, -1.6 * G, 2 * G, 1.6 * G]; }
  leads() { return this.localPosts().map(([x, y], i) => [i, x, y, Math.sign(x) * 1.05 * G, y * 0.6]); }
  internalNodeCount() { return 0; }
  connectivity() { return null; }
  statorEnds() { return [0, 1, 2].map((k) => [this.nodes[k], this.nodes[k + 3]]); }
  stamp(s) { InductionBase.prototype.stamp.call(this, s); }
  Lm_() {
    const L = super.Lm_(), { lls, lm } = this.p;
    for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) L[x][y] = (2 / 3) * lm * Math.cos(TH[x] - TH[y]) + (x === y ? lls : 0);
    return L;
  }
  statorCurrents(i) { this.postCurrents = [i[0], i[1], i[2], -i[0], -i[1], -i[2]]; this.i = i[0]; }
  readings(s) {
    const n = this.nodes, vw = [0, 1, 2].map((k) => s.v(n[k]) - s.v(n[k + 3]));
    return [...super.readings(s), ['Winding voltage U1–U2', vw[0], 'V']];
  }
  draw(g) {
    drawMotor(g, 'M 3~', this.ang || 0, g.running, 1.05 * G);
    ['U1', 'V1', 'W1'].forEach((t, k) => g.text(t, -1.55 * G, (k - 1) * G - 0.35 * G, { size: 6, color: g.muted }));
    ['U2', 'V2', 'W2'].forEach((t, k) => g.text(t, 1.55 * G, (k - 1) * G - 0.35 * G, { size: 6, color: g.muted }));
  }
}
register(InductionMotor6);

// ---------------------------------------------------------- DC compound
const FIELD = (i, ir) => { const x = i / Math.max(ir, 1e-9); return Math.tanh(1.2 * x) / Math.tanh(1.2); };

export class DCCompound extends Element {
  static type = 'dccompound'; static title = 'DC Compound Motor'; static category = 'Machines';
  static prefix = 'M'; static keywords = 'dc compound motor cumulative differential long shunt series shunt field';
  static props = [
    { key: 'load', label: 'Load torque', unit: 'N·m', def: 2, min: -1e4, max: 1e4, knob: true },
    { key: 'mode', label: 'Series field', type: 'select', def: 'cum', options: [['cum', 'Cumulative (aiding)'], ['diff', 'Differential (opposing)']] },
    { key: 'ke', label: 'EMF constant at rated field', unit: 'V·s/rad', def: 1.2, min: 1e-4, max: 100, log: true },
    { key: 'ra', label: 'Armature resistance', unit: 'Ω', def: 0.5, min: 1e-4, max: 1e4, log: true },
    { key: 'la', label: 'Armature inductance', unit: 'H', def: 0.01, min: 1e-6, max: 10, log: true },
    { key: 'rse', label: 'Series field resistance', unit: 'Ω', def: 0.15, min: 1e-4, max: 1e3, log: true },
    { key: 'lse', label: 'Series field inductance', unit: 'H', def: 0.01, min: 1e-6, max: 10, log: true },
    { key: 'kse', label: 'Series field strength (A shunt-equivalent per A)', unit: '', def: 0.05, min: 0, max: 2 },
    { key: 'rf', label: 'Shunt field resistance', unit: 'Ω', def: 220, min: 1e-3, max: 1e5, log: true },
    { key: 'lf', label: 'Shunt field inductance', unit: 'H', def: 20, min: 1e-6, max: 1e3, log: true },
    { key: 'ifr', label: 'Rated field current', unit: 'A', def: 1, min: 1e-4, max: 1e3, log: true },
    { key: 'j', label: 'Inertia J', unit: 'kg·m²', def: 0.05, min: 1e-6, max: 1e4, log: true },
    { key: 'b', label: 'Friction b', unit: 'N·m·s', def: 0.002, min: 0, max: 100 },
  ];
  static description = 'Long-shunt compound DC motor: the shunt field sits across the supply and a series field carries the armature current. Cumulative compounding adds the series flux — higher starting torque and a speed that drops more with load than a shunt motor; differential compounding subtracts it to hold the speed flat — it needs a weak series field (≈0.003–0.005 here): too strong and the flux collapses with load so the motor runs away or reverses, and at starting current the series field overpowers the shunt field (short the series field while starting). Flux follows a saturating curve of the combined field.';
  constructor(x, y) { super(x, y); this.postCurrents = [0, 0]; }
  localPosts() { return [[-2 * G, 0], [2 * G, 0]]; }
  localBox() { return [-2 * G, -1.2 * G, 2 * G, 1.2 * G]; }
  leads() { return [[0, -2 * G, 0, -G, 0], [1, 2 * G, 0, G, 0]]; }
  branchCount() { return 3; }
  reset() { this.w = 0; this.ia = 0; this.if = 0; this.ang = 0; this.phi = 0; this.postCurrents = [0, 0]; }
  kphi() { return this.p.ke * this.phi; }
  stamp(s) {
    const [ka, kf, kw] = this.branches, [a, b] = this.nodes, p = this.p, be = s.mode === 'dc' ? 0 : 1 / s.dt, K = this.kphi();
    s.addBranchKCL(a, b, ka); s.addA(ka, a - 1, 1); s.addA(ka, b - 1, -1);
    s.addA(ka, ka, -(p.ra + p.rse + be * (p.la + p.lse))); s.addA(ka, kw, -K);
    s.addBranchKCL(a, b, kf); s.addA(kf, a - 1, 1); s.addA(kf, b - 1, -1); s.addA(kf, kf, -(p.rf + be * p.lf));
    // operating point: the rotor is at rest when the supply is applied
    if (s.mode === 'dc') s.addA(kw, kw, 1);
    else { s.addA(kw, kw, be * p.j + Math.max(p.b, 1e-9)); s.addA(kw, ka, -K); }
  }
  stampStep(s) {
    const [ka, kf, kw] = this.branches, p = this.p;
    if (s.mode !== 'dc') { s.b[ka] += -((p.la + p.lse) / s.dt) * this.ia; s.b[kf] += -(p.lf / s.dt) * this.if; s.b[kw] += (p.j / s.dt) * this.w; s.b[kw] -= p.load; }
  }
  accept(s) {
    const [ka, kf, kw] = this.branches;
    this.ia = s.x[ka]; this.if = s.x[kf]; this.w = s.x[kw];
    if (s.mode !== 'dc') this.ang += this.w * s.dt;
    const sgn = this.p.mode === 'diff' ? -1 : 1;
    const phi = FIELD(this.if + sgn * this.p.kse * this.ia, this.p.ifr) + 0.02;
    if (Math.abs(phi - this.phi) > 1e-4) { this.phi = phi; s.dirty = true; }
    this.postCurrents = [this.ia + this.if, -(this.ia + this.if)]; this.i = this.postCurrents[0];
  }
  valueLabel() { return fmtQty(Math.round(rpm(this.w || 0)), 'rpm'); }
  readings(s) {
    return [['Speed', rpm(this.w || 0), 'rpm'], ['Torque', this.kphi() * (this.ia || 0), 'N·m'], ['Armature current', this.ia || 0, 'A'], ['Shunt field current', this.if || 0, 'A'],
      ['Flux (per unit)', this.phi || 0, ''], ['Back-EMF', this.kphi() * (this.w || 0), 'V'], ['Mechanical power', this.kphi() * (this.ia || 0) * (this.w || 0), 'W']];
  }
  draw(g) { drawMotor(g, 'M', this.ang || 0, g.running); g.upright(() => g.text(this.p.mode === 'diff' ? 'diff.' : 'comp.', 0, 0.5 * G, { size: 6, color: g.muted })); }
}
register(DCCompound);

dcm('universal', 'Universal Motor (AC/DC series)', 'series', { rf: 2, lf: 0.05, ifr: 2, ke: 0.5, ra: 3, la: 0.05, load: 0.3, j: 0.002, b: 0.0004 },
  'universal motor series motor ac dc mixer drill grinder vacuum cleaner brushed commutator',
  'Series-wound commutator motor that runs on AC as well as DC: field and armature currents reverse together, so the torque (∝ I²) keeps its direction. High speed and high starting torque — used in drills, mixers and vacuum cleaners. Speed falls steeply with load; never run it unloaded on DC.');

// ------------------------------------------------- synchronous machines
/**
 * Induction machine + rotor flux ψf (field winding or magnets): each stator
 * phase links ψf·cos(θe − θk), giving the EMF −ψf·ωe·sin(θe − θk) and the
 * torque −(P/2)·ψf·Σ ik·sin(θe − θk). The cage (rotor αβ circuits) damps
 * oscillations and gives starting torque.
 */
export class SyncMotor extends InductionMotor3 {
  static type = 'syncmotor'; static title = 'Synchronous Motor (3-phase)';
  static keywords = 'synchronous motor wound field excitation v curve power factor correction synchronous condenser damper winding';
  static props = [
    { key: 'load', label: 'Load torque', unit: 'N·m', def: 10, min: -1e4, max: 1e4, knob: true },
    { key: 'field', label: 'Excitation', unit: '%', def: 100, min: 0, max: 200 },
    { key: 'auto', label: 'Apply field near synchronous speed', type: 'bool', def: true },
    { key: 'vll', label: 'Rated line voltage', unit: 'V', def: 400, min: 1, max: 1e5, log: true },
    ...InductionMotor3.props.filter((p) => !['load', 'loadType'].includes(p.key)).map((p) => ({ ...p, def: { rr: 2, lm: 0.15 }[p.key] ?? p.def })),
    { key: 'loadType', label: 'Load type', type: 'select', def: 'const', options: [['const', 'Constant torque'], ['fan', 'Fan / pump (∝ speed²)']] },
  ];
  static description = 'Wound-field synchronous motor with a damper (cage) winding: it starts as an induction motor, the DC field is applied near synchronous speed and it pulls into step, then runs at exactly 1500 rpm (4-pole, 50 Hz) whatever the load. The excitation knob sets the power factor: under-excited it draws lagging current, over-excited it delivers reactive power (leading) — the V-curve; unloaded and over-excited it works as a synchronous condenser.';
  psiNom() { return (this.p.vll / Math.sqrt(3)) * Math.SQRT2 / (TAU * this.p.freq); }
  psi() { return this.fieldOn ? this.psiNom() * this.p.field / 100 : 0; }
  reset() { super.reset(); this.fieldOn = !this.p.auto; this.pq = [0, 0]; }
  thetaE(extra = 0) { return (this.p.poles / 2) * ((this.ang || 0) + extra); }
  stampStep(s) {
    super.stampStep(s);
    if (s.mode === 'dc') return;
    const psi = this.psi(); if (!psi) return;
    const we = (this.p.poles / 2) * this.wm, th = this.thetaE(this.wm * s.dt);
    for (let k = 0; k < 3; k++) s.b[this.branches[k]] += -psi * we * Math.sin(th - TH[k]);
  }
  torque(i) {
    const psi = this.psi(), th = this.thetaE();
    let t = super.torque(i);
    if (psi) for (let k = 0; k < 3; k++) t -= (this.p.poles / 2) * psi * i[k] * Math.sin(th - TH[k]);
    return t;
  }
  accept(s) {
    super.accept(s);
    if (s.mode === 'dc') return;
    if (!this.fieldOn && this.slip() < 0.05) this.fieldOn = true;
    const n = this.nodes, nn = this.inodes[0], v = [0, 1, 2].map((k) => s.v(n[k]) - s.v(nn)), i = this.postCurrents;
    const p = v[0] * i[0] + v[1] * i[1] + v[2] * i[2];
    const q = ((v[1] - v[2]) * i[0] + (v[2] - v[0]) * i[1] + (v[0] - v[1]) * i[2]) / Math.sqrt(3);
    const a = Math.min(1, s.dt / 0.05);
    this.pq = [this.pq[0] + (p - this.pq[0]) * a, this.pq[1] + (q - this.pq[1]) * a];
  }
  readings(s) {
    const [p, q] = this.pq || [0, 0], S = Math.hypot(p, q), pf = S > 1e-9 ? Math.abs(p) / S : 1;
    return [...super.readings(s), ['Field', this.fieldOn ? `ON ${Math.round(this.p.field)} %` : 'off (starting as induction motor)', ''], ['Input power P', p, 'W'], ['Reactive power Q (+ = absorbed)', q, 'var'],
      ['Power factor', S > 1e-9 ? `${pf.toFixed(3)} ${q > 0 ? 'lagging' : 'leading'}` : '—', '']];
  }
  valueLabel() { return `${fmtQty(Math.round(rpm(this.wm || 0)), 'rpm')} ${Math.round(this.p.field)}%`; }
  draw(g) { super.draw(g); g.text('SYN', 0, 1.2 * G, { size: 6, color: g.muted, bold: true, follow: true }); }
}
register(SyncMotor);

export class PMSM extends SyncMotor {
  static type = 'pmsm'; static title = 'PMSM (Permanent-Magnet Synchronous Motor)';
  static keywords = 'pmsm permanent magnet synchronous motor servo motor ev motor brushless ac motor foc';
  static props = [
    { key: 'load', label: 'Load torque', unit: 'N·m', def: 1, min: -1e4, max: 1e4, knob: true },
    { key: 'kemf', label: 'Back-EMF constant (line, RMS per krpm)', unit: 'V', def: 60, min: 0.01, max: 1e4, log: true },
    { key: 'poles', label: 'Poles', unit: '', def: 8, min: 2, max: 64 },
    { key: 'freq', label: 'Rated frequency', unit: 'Hz', def: 100, min: 1, max: 2000 },
    { key: 'rs', label: 'Stator resistance Rs', unit: 'Ω', def: 0.6, min: 1e-4, max: 1e3, log: true },
    { key: 'lls', label: 'Leakage inductance', unit: 'H', def: 0.002, min: 1e-6, max: 1, log: true },
    { key: 'lm', label: 'Magnetising inductance', unit: 'H', def: 0.004, min: 1e-6, max: 10, log: true },
    { key: 'j', label: 'Inertia J', unit: 'kg·m²', def: 0.002, min: 1e-7, max: 1e4, log: true },
    { key: 'b', label: 'Friction b', unit: 'N·m·s', def: 0.0005, min: 0, max: 100 },
    { key: 'rr', label: 'Damper resistance', unit: 'Ω', def: 1e4, min: 1e-3, max: 1e6, log: true, hidden: true },
    { key: 'llr', label: 'Damper leakage', unit: 'H', def: 0.002, min: 1e-6, max: 1, hidden: true },
    { key: 'field', label: 'Magnet flux', unit: '%', def: 100, min: 0, max: 200, hidden: true },
    { key: 'auto', label: 'auto', type: 'bool', def: false, hidden: true },
    { key: 'vll', label: 'vll', unit: 'V', def: 400, min: 1, max: 1e5, hidden: true },
    { key: 'loadType', label: 'Load type', type: 'select', def: 'const', options: [['const', 'Constant torque'], ['fan', 'Fan / pump (∝ speed²)']] },
  ];
  static description = 'Permanent-magnet synchronous motor (sinusoidal back-EMF, no cage): magnets on the rotor make the flux, so it runs at synchronous speed with high efficiency — the motor of servo drives and electric vehicles. It cannot start directly on the mains: feed it from an inverter whose frequency ramps up from zero (or use field-oriented control). Back-EMF constant in V (line RMS) per 1000 rpm.';
  psiNom() { return (this.p.kemf / Math.sqrt(3)) * Math.SQRT2 / ((this.p.poles / 2) * TAU * 1000 / 60); }
  psi() { return this.psiNom() * this.p.field / 100; }
  reset() { super.reset(); this.fieldOn = true; }
  valueLabel() { return fmtQty(Math.round(rpm(this.wm || 0)), 'rpm'); }
  draw(g) { InductionMotor3.prototype.draw.call(this, g); g.text('PM', 0, 1.2 * G, { size: 6, color: g.muted, bold: true, follow: true }); }
}
register(PMSM);

// --------------------------------------------------------------- BLDC
/** trapezoidal back-EMF shape: ±1 flat for 120°, linear 60° transitions */
export function trap(x) {
  const d = wrap(x), s = Math.PI / 6;
  if (d < s) return d / s;
  if (d < 5 * s) return 1;
  if (d < 7 * s) return 1 - (d - 5 * s) / s;
  if (d < 11 * s) return -1;
  return -1 + (d - 11 * s) / s;
}

export class BLDCMotor extends Element {
  static type = 'bldc'; static title = 'BLDC Motor (with Hall sensors)'; static category = 'Machines';
  static prefix = 'M'; static keywords = 'bldc brushless dc motor hall sensor trapezoidal six step drone fan e-bike';
  static props = [
    { key: 'load', label: 'Load torque', unit: 'N·m', def: 0.1, min: -1e3, max: 1e3, knob: true },
    { key: 'ke', label: 'Torque / EMF constant (per phase)', unit: 'V·s/rad', def: 0.03, min: 1e-5, max: 10, log: true },
    { key: 'r', label: 'Phase resistance', unit: 'Ω', def: 0.4, min: 1e-4, max: 1e3, log: true },
    { key: 'l', label: 'Phase inductance (L − M)', unit: 'H', def: 0.0005, min: 1e-7, max: 1, log: true },
    { key: 'poles', label: 'Poles', unit: '', def: 8, min: 2, max: 64 },
    { key: 'j', label: 'Inertia J', unit: 'kg·m²', def: 2e-5, min: 1e-8, max: 10, log: true },
    { key: 'b', label: 'Friction b', unit: 'N·m·s', def: 2e-6, min: 0, max: 10 },
  ];
  static description = 'Brushless DC motor: three star-connected windings (A, B, C) with trapezoidal back-EMF and three Hall sensors (H1–H3, 5 V logic outputs, 120° apart) that tell the driver where the rotor is. Drive it with the BLDC driver (six-step commutation from the Hall code). T = Ke·Σ f(θ)·i.';
  constructor(x, y) { super(x, y); this.postCurrents = new Array(6).fill(0); }
  localPosts() { return [[-2 * G, -G], [-2 * G, 0], [-2 * G, G], [2 * G, -G], [2 * G, 0], [2 * G, G]]; }
  pinNames() { return ['A', 'B', 'C', 'H1', 'H2', 'H3']; }
  localBox() { return [-2 * G, -1.6 * G, 2 * G, 1.6 * G]; }
  leads() { return this.localPosts().map(([x, y], i) => [i, x, y, Math.sign(x) * 1.05 * G, y * 0.6]); }
  internalNodeCount() { return 1; }
  branchCount() { return 3; }
  connectivity() { return [[0, 1, 2, 'i0'], [3, 4, 5, 'gnd']]; }
  reset() { this.wm = 0; this.ang = 0; this.il = [0, 0, 0]; this.te = 0; this.halls = this.hallsAt(0); this.postCurrents.fill(0); }
  thE(extra = 0) { return (this.p.poles / 2) * ((this.ang || 0) + extra); }
  hallsAt(th) { return [0, 1, 2].map((k) => Math.sin(th - Math.PI / 6 - k * TAU / 3) >= 0); }
  stamp(s) {
    const n = this.inodes[0], f = s.mode === 'dc' ? 0 : 1 / s.dt;
    for (let k = 0; k < 3; k++) {
      const a = this.nodes[k], br = this.branches[k];
      s.addBranchKCL(a, n, br); s.addA(br, a - 1, 1); s.addA(br, n - 1, -1); s.addA(br, br, -(this.p.r + f * this.p.l));
    }
    s.addG(n, 0, 1e-9);
    for (let k = 3; k < 6; k++) s.addG(this.nodes[k], 0, 1 / 500);
  }
  stampStep(s) {
    const th = this.thE(s.mode === 'dc' ? 0 : this.wm * s.dt);
    for (let k = 0; k < 3; k++) {
      const e = this.p.ke * this.wm * trap(th - k * TAU / 3);
      s.b[this.branches[k]] += e - (s.mode === 'dc' ? 0 : (this.p.l / s.dt) * this.il[k]);
    }
    this.halls.forEach((h, k) => { if (h) s.addI(0, this.nodes[3 + k], 5 / 500); });
  }
  accept(s) {
    const i = this.branches.map((b) => s.x[b]);
    this.il = i;
    const th = this.thE();
    this.te = this.p.ke * i.reduce((acc, x, k) => acc + x * trap(th - k * TAU / 3), 0);
    if (s.mode !== 'dc') {
      const TL = this.p.load * Math.tanh(this.wm / 0.5);
      this.wm += ((this.te - TL - this.p.b * this.wm) / this.p.j) * s.dt;
      this.ang += this.wm * s.dt;
      const h = this.hallsAt(this.thE());
      if (h.some((v, k) => v !== this.halls[k])) { this.halls = h; s.event = true; }
    }
    this.postCurrents = [i[0], i[1], i[2], ...this.halls.map((hh, k) => (s.v(this.nodes[3 + k]) - (hh ? 5 : 0)) / 500)];
    this.i = i[0];
  }
  stampAC(ac) {
    const n = this.inodes[0];
    for (let k = 0; k < 3; k++) { const a = this.nodes[k], br = this.branches[k]; ac.addBranchKCL(a, n, br); ac.addA(br, a - 1, 1); ac.addA(br, n - 1, -1); ac.addA(br, br, -this.p.r, -ac.omega * this.p.l); }
    ac.addY(n, 0, 1e-9);
    for (let k = 3; k < 6; k++) ac.addY(this.nodes[k], 0, 1 / 500);
  }
  valueLabel() { return fmtQty(Math.round(rpm(this.wm || 0)), 'rpm'); }
  readings() {
    return [['Speed', rpm(this.wm || 0), 'rpm'], ['Torque', this.te || 0, 'N·m'], ['Hall code H1H2H3', (this.halls || []).map((h) => (h ? 1 : 0)).join(''), ''],
      ['I(A)', this.il?.[0] || 0, 'A'], ['I(B)', this.il?.[1] || 0, 'A'], ['I(C)', this.il?.[2] || 0, 'A'], ['Mechanical power', (this.te || 0) * (this.wm || 0), 'W']];
  }
  draw(g) {
    drawMotor(g, 'BLDC', this.ang || 0, g.running, 1.05 * G);
    ['A', 'B', 'C'].forEach((t, k) => g.text(t, -1.55 * G, (k - 1) * G - 0.35 * G, { size: 6.5, color: g.muted }));
    ['H1', 'H2', 'H3'].forEach((t, k) => g.text(t, 1.55 * G, (k - 1) * G - 0.35 * G, { size: 6, color: g.muted }));
  }
}
register(BLDCMotor);

// ------------------------------------------------------------- stepper
export class StepperMotor extends Element {
  static type = 'stepper'; static title = 'Stepper Motor (2-phase bipolar)'; static category = 'Machines';
  static prefix = 'M'; static keywords = 'stepper motor nema17 bipolar hybrid 200 step 1.8 degree a4988 drv8825 cnc 3d printer';
  static props = [
    { key: 'load', label: 'Load torque', unit: 'N·m', def: 0.05, min: -100, max: 100, knob: true },
    { key: 'kt', label: 'Torque constant', unit: 'N·m/A', def: 0.25, min: 1e-4, max: 100, log: true },
    { key: 'steps', label: 'Full steps per revolution', unit: '', def: 200, min: 4, max: 1000 },
    { key: 'r', label: 'Winding resistance', unit: 'Ω', def: 2.8, min: 1e-3, max: 1e4, log: true },
    { key: 'l', label: 'Winding inductance', unit: 'H', def: 0.004, min: 1e-6, max: 10, log: true },
    { key: 'tdet', label: 'Detent torque', unit: 'N·m', def: 0.015, min: 0, max: 100 },
    { key: 'j', label: 'Rotor + load inertia', unit: 'kg·m²', def: 1e-5, min: 1e-8, max: 10, log: true },
    { key: 'b', label: 'Viscous damping', unit: 'N·m·s', def: 2e-4, min: 0, max: 10 },
  ];
  static description = 'Two-phase hybrid stepper (NEMA-17 class, 1.8° per step): windings A (A+, A−) and B (B+, B−). Energising A, B, −A, −B in turn moves the rotor one full step each; T = Kt·(−iA·sin Nθ + iB·cos Nθ) − detent, with N = steps/4 rotor teeth. Drive it with the stepper driver; too high a step rate or load makes it stall and lose steps.';
  constructor(x, y) { super(x, y); this.postCurrents = [0, 0, 0, 0]; }
  localPosts() { return [[-2 * G, -2 * G], [-2 * G, -G], [-2 * G, G], [-2 * G, 2 * G]]; }
  pinNames() { return ['A+', 'A−', 'B+', 'B−']; }
  localBox() { return [-2 * G, -2.4 * G, 1.6 * G, 2.4 * G]; }
  leads() { return this.localPosts().map(([x, y], i) => [i, x, y, -1.05 * G, y * 0.45]); }
  connectivity() { return [[0, 1], [2, 3]]; }
  branchCount() { return 2; }
  reset() { this.wm = 0; this.th = 0; this.il = [0, 0]; this.te = 0; this.postCurrents.fill(0); }
  N() { return this.p.steps / 4; }
  emf(k, th, w) { const x = this.N() * th; return k === 0 ? -this.p.kt * w * Math.sin(x) : this.p.kt * w * Math.cos(x); }
  stamp(s) {
    const f = s.mode === 'dc' ? 0 : 1 / s.dt;
    for (let k = 0; k < 2; k++) {
      const a = this.nodes[2 * k], b = this.nodes[2 * k + 1], br = this.branches[k];
      s.addBranchKCL(a, b, br); s.addA(br, a - 1, 1); s.addA(br, b - 1, -1); s.addA(br, br, -(this.p.r + f * this.p.l));
    }
  }
  stampStep(s) {
    const th = this.th + (s.mode === 'dc' ? 0 : this.wm * s.dt);
    for (let k = 0; k < 2; k++) s.b[this.branches[k]] += this.emf(k, th, this.wm) - (s.mode === 'dc' ? 0 : (this.p.l / s.dt) * this.il[k]);
  }
  accept(s) {
    const [ia, ib] = this.branches.map((b) => s.x[b]), x = this.N() * this.th;
    this.il = [ia, ib];
    this.te = this.p.kt * (-ia * Math.sin(x) + ib * Math.cos(x)) - this.p.tdet * Math.sin(4 * x);
    if (s.mode !== 'dc') {
      const TL = this.p.load * Math.tanh(this.wm / 0.05);
      // semi-implicit Euler for the stiff rotor oscillation
      this.wm += ((this.te - TL - this.p.b * this.wm) / this.p.j) * s.dt;
      this.th += this.wm * s.dt;
    }
    this.postCurrents = [ia, -ia, ib, -ib]; this.i = ia;
  }
  stampAC(ac) {
    for (let k = 0; k < 2; k++) { const a = this.nodes[2 * k], b = this.nodes[2 * k + 1], br = this.branches[k]; ac.addBranchKCL(a, b, br); ac.addA(br, a - 1, 1); ac.addA(br, b - 1, -1); ac.addA(br, br, -this.p.r, -ac.omega * this.p.l); }
  }
  position() { return (this.th * 180) / Math.PI; }
  valueLabel() { return `${this.position().toFixed(1)}°`; }
  readings() {
    return [['Shaft angle', this.position(), '°'], ['Full steps from start', Math.round(this.position() / (360 / this.p.steps)), ''], ['Speed', rpm(this.wm || 0), 'rpm'], ['Torque', this.te || 0, 'N·m'], ['I(A)', this.il?.[0] || 0, 'A'], ['I(B)', this.il?.[1] || 0, 'A']];
  }
  draw(g) {
    g.box(-1.05 * G, -1.5 * G, 1.5 * G, 1.5 * G, { stroke: g.body, width: g.lw * 0.9, fill: g.fill, r: 5 });
    g.circle(0.25 * G, 0, 0.75 * G, { stroke: g.body, width: g.lw * 0.7 });
    const a = this.th || 0;
    g.line(0.25 * G, 0, 0.25 * G + Math.cos(a) * 0.62 * G, Math.sin(a) * 0.62 * G, g.accent, g.lw * 1.4);
    ['A+', 'A−', 'B+', 'B−'].forEach((t, k) => g.text(t, -0.7 * G, [-2, -1, 1, 2][k] * G * 0.62, { size: 5.5, color: g.muted }));
  }
}
register(StepperMotor);

// ------------------------------------------------- single-phase generator
export class ACGenerator extends Element {
  static type = 'acgen1'; static title = 'AC Generator (1-phase)'; static category = 'Machines';
  static prefix = 'G'; static keywords = 'ac generator single phase alternator genset portable generator dynamo ac';
  static props = [
    { key: 'field', label: 'Excitation', unit: '%', def: 100, min: 0, max: 200, knob: true },
    { key: 'vrated', label: 'Open-circuit voltage at 100 % (RMS)', unit: 'V', def: 230, min: 0.1, max: 1e5, log: true },
    { key: 'freq', label: 'Frequency', unit: 'Hz', def: 50, min: 1, max: 1000 },
    { key: 'xs', label: 'Synchronous reactance', unit: 'Ω', def: 2, min: 1e-4, max: 1e4, log: true },
    { key: 'ra', label: 'Winding resistance', unit: 'Ω', def: 0.3, min: 1e-5, max: 1e3, log: true },
  ];
  static description = 'Single-phase synchronous generator (portable genset): EMF E = k·If at the set frequency behind the winding resistance and synchronous reactance, so the terminal voltage drops with load (and more with lagging loads). Excitation controls the voltage.';
  refNode = 1;
  constructor(x, y) { super(x, y); this.postCurrents = [0, 0]; this.ang = 0; }
  localPosts() { return [[2 * G, -G], [2 * G, G]]; }
  pinNames() { return ['L', 'N']; }
  localBox() { return [-1.4 * G, -1.4 * G, 2 * G, 1.4 * G]; }
  leads() { return this.localPosts().map(([x, y], i) => [i, x, y, 0.9 * G, y * 0.6]); }
  branchCount() { return 1; }
  L() { return this.p.xs / (TAU * this.p.freq); }
  reset() { this.il = 0; this.postCurrents = [0, 0]; this.ang = 0; }
  stamp(s) { const k = this.branches[0], [a, n] = this.nodes; s.addBranchKCL(a, n, k); s.addA(k, a - 1, 1); s.addA(k, n - 1, -1); s.addA(k, k, -(this.p.ra + (s.mode === 'dc' ? 0 : this.L() / s.dt))); }
  stampStep(s) {
    if (s.mode === 'dc') return;
    const E = this.p.vrated * Math.SQRT2 * this.p.field / 100;
    s.b[this.branches[0]] += E * Math.sin(TAU * this.p.freq * s.tNext) - (this.L() / s.dt) * this.il;
  }
  accept(s) { this.il = s.x[this.branches[0]]; this.postCurrents = [this.il, -this.il]; this.i = this.il; if (s.mode !== 'dc') this.ang += TAU * this.p.freq * s.dt / 20; }
  stampAC(ac) { const k = this.branches[0], [a, n] = this.nodes; ac.addBranchKCL(a, n, k); ac.addA(k, a - 1, 1); ac.addA(k, n - 1, -1); ac.addA(k, k, -this.p.ra, -ac.omega * this.L()); }
  valueLabel() { return `${fmtShort(this.p.vrated, 'V')} ${Math.round(this.p.field)}%`; }
  readings(s) { return [['EMF (RMS)', this.p.vrated * this.p.field / 100, 'V'], ['Terminal voltage', s.v(this.nodes[0]) - s.v(this.nodes[1]), 'V'], ['Current out of L', -this.il, 'A']]; }
  draw(g) { drawMotor(g, 'G 1~', this.ang || 0, g.running, 1.1 * G); g.text('L', 1.4 * G, -1.4 * G, { size: 7, color: g.muted, bold: true }); g.text('N', 1.4 * G, 0.6 * G, { size: 7, color: g.muted, bold: true }); }
}
register(ACGenerator);
