// Passive components: ground, resistor, potentiometer, capacitors, inductor,
// transformer, fuse, lamp.

import { Element, TwoTerm, register, GRID } from './base.js';
import { fmtShort } from '../engine/units.js';

// how firmly the DC operating point holds a capacitor's initial voltage (1 mΩ) and an inductor's
// initial current (1 nS across it)
const IC_HOLD = 1e3, IC_HOLD_G = 1e-9;

const G = GRID;

export class Ground extends Element {
  static type = 'ground'; static title = 'Ground'; static category = 'Sources';
  static prefix = 'GND'; static keywords = 'earth reference 0v common';
  static description = 'Reference node (0 V). All voltages are measured relative to ground.';
  static noName = true;
  localPosts() { return [[0, 0]]; }
  localBox() { return [-G * 0.6, -4, G * 0.6, G * 1.1]; }
  leads() { return [[0, 0, 0, 0, G * 0.5]]; }
  isGround() { return true; }
  connectivity() { return [[0, 'gnd']]; }
  readings() { return [['Voltage', 0, 'V']]; }
  valueLabel() { return ''; }
  draw(g) {
    g.line(-G * 0.55, G * 0.5, G * 0.55, G * 0.5, g.body, g.lw * 1.1);
    g.line(-G * 0.36, G * 0.72, G * 0.36, G * 0.72, g.body, g.lw * 1.1);
    g.line(-G * 0.16, G * 0.94, G * 0.16, G * 0.94, g.body, g.lw * 1.1);
  }
}
register(Ground);

export class Resistor extends TwoTerm {
  static type = 'resistor'; static title = 'Resistor'; static category = 'Passive';
  static prefix = 'R'; static keywords = 'ohm resistance load';
  static props = [
    { key: 'r', label: 'Resistance', unit: 'Ω', def: 1000, min: 1e-3, max: 1e9, log: true, knob: true },
    { key: 'style', label: 'Symbol', type: 'select', def: 'zigzag', options: [['zigzag', 'IEEE (zigzag)'], ['box', 'IEC (box)']] },
    { key: 'pw', label: 'Power rating', type: 'select', def: '0', options: [['0', 'Ideal (no limit)'], ['0.125', '1/8 W'], ['0.25', '1/4 W'], ['0.5', '1/2 W'], ['1', '1 W'], ['2', '2 W'], ['3', '3 W'], ['5', '5 W'], ['10', '10 W'], ['25', '25 W'], ['50', '50 W'], ['100', '100 W']] },
  ];
  static description = "Linear resistor obeying Ohm's law V = I·R. Give it a power rating and it overheats above it and burns open at about 2.5 × its rating (real resistors fail open).";
  get R() { return this.damaged ? 1e9 : Math.max(this.p.r, 1e-6); }
  stamp(s) { s.addG(this.nodes[0], this.nodes[1], 1 / this.R); }
  accept(s) {
    const v = this.voltageDiff(s), i = v / this.R;
    this.setCurrent(i);
    const pw = +this.p.pw;
    if (!(pw > 0) || s.mode === 'dc' || this.damaged) return;
    // a small resistor heats up in about a second, a big power resistor in tens of seconds
    const load = this.heatAvg(s, (v * i) / pw, 1 + 4 * Math.sqrt(pw));
    this.stress = Math.max(0, Math.min(1, (load - 1) / 1.5));
    if (load > 2.5) this.setDamage(s, `Burnt open — dissipating ${fmtShort(load * pw, 'W')} in a ${fmtShort(pw, 'W')} resistor`);
  }
  stampAC(ac) { ac.addY(this.nodes[0], this.nodes[1], 1 / this.R); }
  spice(n) { return `${this.name} ${n[0]} ${n[1]} ${this.R}`; }
  draw(g) {
    const v0 = g.pv(0), v1 = g.pv(1);
    const heat = g.running ? Math.min(1, Math.abs(this.i * (v0 - v1)) / 0.5) : 0;
    if (heat > 0.05) g.glow(0, 0, G * 1.2, '255,120,40', heat * 0.5);
    const grad = g.grad(-G, 0, G, 0, v0, v1);
    if (this.p.style === 'box') {
      g.box(-G, -G * 0.32, G, G * 0.32, { stroke: grad, width: g.lw });
      return;
    }
    const pts = [[-G, 0]];
    const n = 6, w = (2 * G) / n;
    for (let k = 0; k < n; k++) pts.push([-G + w * (k + 0.5), k % 2 ? G * 0.36 : -G * 0.36]);
    pts.push([G, 0]);
    g.poly(pts, { stroke: grad, width: g.lw, join: 'round' });
  }
}
register(Resistor);

export class Potentiometer extends Element {
  static type = 'pot'; static title = 'Potentiometer'; static category = 'Passive';
  static prefix = 'RV'; static keywords = 'variable resistor pot trimmer rheostat wiper';
  static props = [
    { key: 'pos', label: 'Wiper position', unit: '%', def: 50, min: 0, max: 100, knob: true },
    { key: 'r', label: 'Total resistance', unit: 'Ω', def: 10000, min: 1, max: 1e8, log: true },
    { key: 'taper', label: 'Taper', type: 'select', def: 'lin', options: [['lin', 'Linear (B)'], ['log', 'Logarithmic (A)']] },
  ];
  static description = 'Three-terminal variable resistor. Adjust the wiper with the knob while simulating.';
  constructor(x, y) { super(x, y); this.postCurrents = [0, 0, 0]; }
  localPosts() { return [[-2 * G, 0], [2 * G, 0], [0, -2 * G]]; }
  localBox() { return [-2 * G, -2 * G, 2 * G, G * 0.6]; }
  leads() { return [[0, -2 * G, 0, -G, 0], [1, 2 * G, 0, G, 0], [2, 0, -2 * G, 0, -G * 0.9]]; }
  valueLabel() { return `${this.p.pos.toFixed(0)}%`; }
  frac() {
    const x = Math.min(1, Math.max(0, this.p.pos / 100));
    return this.p.taper === 'log' ? (Math.pow(10, 2 * x) - 1) / 99 : x;
  }
  rs() {
    const f = this.frac();
    return [Math.max(this.p.r * f, 1e-3), Math.max(this.p.r * (1 - f), 1e-3)];
  }
  stamp(s) {
    const [r1, r2] = this.rs();
    s.addG(this.nodes[0], this.nodes[2], 1 / r1);
    s.addG(this.nodes[1], this.nodes[2], 1 / r2);
  }
  stampAC(ac) {
    const [r1, r2] = this.rs();
    ac.addY(this.nodes[0], this.nodes[2], 1 / r1);
    ac.addY(this.nodes[1], this.nodes[2], 1 / r2);
  }
  accept(s) {
    const [r1, r2] = this.rs();
    const vw = s.v(this.nodes[2]);
    const ia = (s.v(this.nodes[0]) - vw) / r1, ib = (s.v(this.nodes[1]) - vw) / r2;
    this.postCurrents[0] = ia; this.postCurrents[1] = ib; this.postCurrents[2] = -(ia + ib);
    this.i = ia;
  }
  readings(s) {
    const [r1, r2] = this.rs();
    return [['V(end-end)', s.v(this.nodes[0]) - s.v(this.nodes[1]), 'V'], ['V(wiper)', s.v(this.nodes[2]), 'V'],
      ['R(A-W)', r1, 'Ω'], ['R(W-B)', r2, 'Ω']];
  }
  spice(n) {
    const [r1, r2] = this.rs();
    return `${this.name}a ${n[0]} ${n[2]} ${r1}\n${this.name}b ${n[2]} ${n[1]} ${r2}`;
  }
  labelSide() { return [0, 1]; }
  draw(g) {
    const grad = g.grad(-G, 0, G, 0, g.pv(0), g.pv(1));
    const pts = [[-G, 0]];
    const n = 6, w = (2 * G) / n;
    for (let k = 0; k < n; k++) pts.push([-G + w * (k + 0.5), k % 2 ? G * 0.32 : -G * 0.32]);
    pts.push([G, 0]);
    g.poly(pts, { stroke: grad, width: g.lw, join: 'round' });
    // wiper arrow at position
    const wx = -G + 2 * G * this.frac();
    g.poly([[0, -G * 0.9], [0, -G * 0.75], [wx, -G * 0.75], [wx, -G * 0.42]], { stroke: g.vc(g.pv(2)), width: g.lw * 0.8 });
    g.poly([[wx - 4, -G * 0.62], [wx, -G * 0.4], [wx + 4, -G * 0.62]], { fill: g.vc(g.pv(2)) });
  }
}
register(Potentiometer);

export class Capacitor extends TwoTerm {
  static type = 'capacitor'; static title = 'Capacitor'; static category = 'Passive';
  static prefix = 'C'; static keywords = 'cap farad ceramic film';
  static props = [
    { key: 'c', label: 'Capacitance', unit: 'F', def: 10e-6, min: 1e-15, max: 10, log: true, knob: true },
    { key: 'ic', label: 'Initial voltage', unit: 'V', def: 0, min: -1e3, max: 1e3 },
  ];
  static description = 'Ideal capacitor: i = C·dv/dt. Plates show accumulated charge while simulating.';
  reset() { this.vPrev = this.p.ic; this.iPrev = 0; this.setCurrent(0); this.J = 0; }
  geq(s) { return (s.method === 'be' ? 1 : 2) * this.p.c / s.dt; }
  /** the companion model's current source this step: i = geq·v + J (from the last accepted step) */
  jNow(s) { const g = this.geq(s); return s.method === 'be' ? -g * this.vPrev : -g * this.vPrev - this.iPrev; }
  // DC operating point: open, unless an initial voltage is set; then it is held at it (as SPICE's
  // IC=), or the operating point overwrote the initial voltage with the circuit's own
  stamp(s) {
    if (s.mode === 'dc') { if (this.p.ic) s.addG(this.nodes[0], this.nodes[1], IC_HOLD); return; }
    s.addG(this.nodes[0], this.nodes[1], this.geq(s));
  }
  stampStep(s) {
    if (s.mode === 'dc') { if (this.p.ic) s.addI(this.nodes[0], this.nodes[1], -IC_HOLD * this.p.ic); return; }
    this.J = this.jNow(s);
    s.addI(this.nodes[0], this.nodes[1], this.J);
  }
  accept(s) {
    const v = this.voltageDiff(s);
    const i = s.mode === 'dc' ? 0 : this.geq(s) * v + this.J;
    this.vPrev = v; this.iPrev = i; this.setCurrent(i);
  }
  stampAC(ac) { ac.addY(this.nodes[0], this.nodes[1], 0, ac.omega * this.p.c); }
  readings(s) {
    const v = this.voltageDiff(s);
    return [['Voltage', v, 'V'], ['Current', this.i, 'A'], ['Charge', v * this.p.c, 'C'], ['Energy', 0.5 * this.p.c * v * v, 'J']];
  }
  spice(n) { return `${this.name} ${n[0]} ${n[1]} ${this.p.c}${this.p.ic ? ' IC=' + this.p.ic : ''}`; }
  leads() { return [[0, -2 * G, 0, -G * 0.22, 0], [1, 2 * G, 0, G * 0.22, 0]]; }
  draw(g, polar = false) {
    const c0 = g.vc(g.pv(0)), c1 = g.vc(g.pv(1));
    const h = G * 0.7;
    g.line(-G * 0.22, -h, -G * 0.22, h, c0, g.lw * 1.4);
    if (polar) {
      g.ctx.beginPath();
      g.ctx.arc(G * 0.95, 0, G * 0.9, Math.PI - 0.9, Math.PI + 0.9);
      g.ctx.strokeStyle = c1; g.ctx.lineWidth = g.lw * 1.4; g.ctx.stroke();
      g.text('+', -G * 0.75, -G * 0.62, { size: 11, color: g.muted });
    } else {
      g.line(G * 0.22, -h, G * 0.22, h, c1, g.lw * 1.4);
    }
    if (g.running && g.showCharge) {
      const v = g.pv(0) - g.pv(1);
      const q = Math.min(1, Math.abs(v) / g.vScale);
      const n = Math.round(q * 4);
      const signL = v >= 0 ? '+' : '−', signR = v >= 0 ? '−' : '+';
      for (let k = 0; k < n; k++) {
        const y = -h + (2 * h * (k + 0.5)) / Math.max(n, 1);
        g.text(signL, -G * 0.55, y, { size: 9, color: v >= 0 ? g.pos : g.neg, bold: true });
        g.text(signR, G * 0.55, y, { size: 9, color: v >= 0 ? g.neg : g.pos, bold: true });
      }
    }
  }
}
register(Capacitor);

export class ElectrolyticCap extends Capacitor {
  static type = 'ecap'; static title = 'Electrolytic Cap'; static category = 'Passive';
  static prefix = 'C'; static keywords = 'polarized electrolytic capacitor tantalum';
  static props = [
    { key: 'c', label: 'Capacitance', unit: 'F', def: 100e-6, min: 1e-9, max: 10, log: true, knob: true },
    { key: 'ic', label: 'Initial voltage', unit: 'V', def: 0, min: -1e3, max: 1e3 },
    { key: 'vmax', label: 'Rated voltage', unit: 'V', def: 25, min: 1, max: 1000 },
  ];
  static description = 'Polarised capacitor. Flashes red when reverse-biased or over its rated voltage; kept there (over 1.2 × its rated voltage or more than 1.5 V reversed) it overheats and bursts open. Select it and tap Replace after that.';
  static failShort = false;
  stamp(s) {
    if (this.damaged) { s.addG(this.nodes[0], this.nodes[1], this.constructor.failShort ? 20 : 1e-9); return; }
    super.stamp(s);
  }
  stampStep(s) { if (!this.damaged) super.stampStep(s); }
  accept(s) {
    if (this.damaged) { const v = this.voltageDiff(s); this.vPrev = v; this.iPrev = 0; this.setCurrent(this.constructor.failShort ? v * 20 : 0); return; }
    super.accept(s);
    if (s.mode === 'dc') return;
    const v = this.vPrev, over = Math.max(v / this.p.vmax - 1.1, -v / 1.5 - 0.5, 0);
    // gas builds up inside while it is over-stressed; it vents after about a second
    const a = this.heatAvg(s, over > 0 ? 1 + over : 0, 0.6);
    this.stress = Math.min(1, a / 0.9);
    if (a > 0.9) this.setDamage(s, v < 0 ? `Burst — connected the wrong way round (${fmtShort(v, 'V')})` : `Burst — ${fmtShort(v, 'V')} on a ${fmtShort(this.p.vmax, 'V')} capacitor`);
  }
  draw(g) {
    super.draw(g, true);
    const v = g.pv(0) - g.pv(1);
    if (g.running && (v < -0.5 || v > this.p.vmax)) g.glow(0, 0, G * 1.3, '255,60,60', 0.5 + 0.3 * Math.sin(g.t * 20));
  }
}
register(ElectrolyticCap);

export class Inductor extends TwoTerm {
  static type = 'inductor'; static title = 'Inductor'; static category = 'Passive';
  static prefix = 'L'; static keywords = 'coil choke henry';
  static props = [
    { key: 'l', label: 'Inductance', unit: 'H', def: 1e-3, min: 1e-12, max: 1e4, log: true, knob: true },
    { key: 'rs', label: 'Series resistance', unit: 'Ω', def: 0, min: 0, max: 1e6 },
    { key: 'ic', label: 'Initial current', unit: 'A', def: 0, min: -1e3, max: 1e3 },
    { key: 'dot', label: 'Dot (for a mutual inductance M)', type: 'select', def: 'none', options: [['none', 'No dot'], ['a', 'Dot at terminal 1'], ['b', 'Dot at terminal 2']] },
  ];
  static description = 'Ideal inductor v = L·di/dt with optional winding resistance. Coupled to another coil by a Mutual Inductance (M) part; the dot marks the end where current entering gives a positive mutual voltage.';
  /** +1 when the dot is at terminal 1 (or there is none), −1 when it is at terminal 2 (dot convention) */
  coilDot() { return this.p.dot === 'b' ? -1 : 1; }
  branchCount() { return 1; }
  get Rs() { return Math.max(this.p.rs, 1e-9); }
  reset() { this.iPrev = this.p.ic; this.vlPrev = 0; this.setCurrent(this.p.ic); }
  req(s) {
    // DC operating point: a short, unless an initial current is set; then it drives that current
    if (s.mode === 'dc') return this.p.ic ? 1 / IC_HOLD_G : this.Rs;
    return this.Rs + (s.method === 'be' ? 1 : 2) * this.p.l / s.dt;
  }
  stamp(s) {
    const k = this.branches[0], [a, b] = this.nodes;
    s.addBranchKCL(a, b, k);
    s.addA(k, a - 1, 1); s.addA(k, b - 1, -1);
    s.addA(k, k, -this.req(s));
  }
  stampStep(s) {
    if (s.mode === 'dc') { if (this.p.ic) s.b[this.branches[0]] += -this.p.ic / IC_HOLD_G; return; }
    const k = this.branches[0];
    const rhs = s.method === 'be' ? -(this.p.l / s.dt) * this.iPrev : -(2 * this.p.l / s.dt) * this.iPrev - this.vlPrev;
    s.b[k] += rhs;
  }
  accept(s) {
    const i = s.x[this.branches[0]];
    const v = this.voltageDiff(s);
    this.iPrev = i; this.vlPrev = s.mode === 'dc' ? 0 : v - this.Rs * i;
    this.setCurrent(i);
  }
  stampAC(ac) {
    const k = this.branches[0], [a, b] = this.nodes;
    ac.addBranchKCL(a, b, k);
    ac.addA(k, a - 1, 1); ac.addA(k, b - 1, -1);
    ac.addA(k, k, -this.Rs, -ac.omega * this.p.l);
  }
  readings(s) {
    const v = this.voltageDiff(s);
    return [['Voltage', v, 'V'], ['Current', this.i, 'A'], ['Flux linkage', this.p.l * this.i, 'Wb'], ['Energy', 0.5 * this.p.l * this.i ** 2, 'J']];
  }
  spice(n) { return `${this.name} ${n[0]} ${n[1]} ${this.p.l}${this.p.rs ? ` Rser=${this.p.rs}` : ''}`; }
  draw(g) {
    const grad = g.grad(-G, 0, G, 0, g.pv(0), g.pv(1));
    const ctx = g.ctx;
    ctx.beginPath();
    const n = 4, w = (2 * G) / n;
    for (let k = 0; k < n; k++) ctx.arc(-G + w * (k + 0.5), 0, w / 2, Math.PI, 0, false);
    ctx.strokeStyle = grad; ctx.lineWidth = g.lw; ctx.lineCap = 'round'; ctx.stroke();
    if (this.p.dot === 'a' || this.p.dot === 'b') g.circle((this.p.dot === 'a' ? -1 : 1) * G * 0.95, -G * 0.62, 2.6, { fill: g.text1 || g.body });
    if (g.running) {
      const e = Math.min(1, Math.abs(this.i) / g.iScale);
      if (e > 0.1) g.glow(0, -G * 0.2, G, '120,160,255', e * 0.35);
    }
  }
}
register(Inductor);

export class Transformer extends Element {
  static type = 'transformer'; static title = 'Transformer'; static category = 'Passive';
  static prefix = 'T'; static keywords = 'coupled inductor isolation step down up';
  static props = [
    { key: 'l1', label: 'Primary inductance', unit: 'H', def: 1, min: 1e-9, max: 1e4, log: true },
    { key: 'n', label: 'Turns ratio (Ns/Np)', unit: '', def: 0.1, min: 1e-3, max: 1e3, log: true, knob: true },
    { key: 'k', label: 'Coupling k', unit: '', def: 0.999, min: 0, max: 0.99999 },
    { key: 'r1', label: 'Primary resistance', unit: 'Ω', def: 0.1, min: 0, max: 1e5 },
    { key: 'r2', label: 'Secondary resistance', unit: 'Ω', def: 0.01, min: 0, max: 1e5 },
  ];
  static description = 'Two coupled windings. L2 = L1·n², M = k·√(L1·L2). Dots mark in-phase terminals.';
  constructor(x, y) { super(x, y); this.postCurrents = [0, 0, 0, 0]; }
  localPosts() { return [[-2 * G, -2 * G], [-2 * G, 2 * G], [2 * G, -2 * G], [2 * G, 2 * G]]; }
  localBox() { return [-2 * G, -2 * G, 2 * G, 2 * G]; }
  leads() {
    return [[0, -2 * G, -2 * G, -G * 0.7, -2 * G], [1, -2 * G, 2 * G, -G * 0.7, 2 * G],
      [2, 2 * G, -2 * G, G * 0.7, -2 * G], [3, 2 * G, 2 * G, G * 0.7, 2 * G]];
  }
  connectivity() { return [[0, 1], [2, 3]]; }
  branchCount() { return 2; }
  valueLabel() { return `1:${+this.p.n.toPrecision(3)}`; }
  labelSide() { return [0, -1]; }
  mat() {
    const L1 = this.p.l1, L2 = L1 * this.p.n * this.p.n;
    const M = Math.min(this.p.k, 0.99999) * Math.sqrt(L1 * L2);
    return [L1, L2, M, Math.max(this.p.r1, 1e-9), Math.max(this.p.r2, 1e-9)];
  }
  reset() { this.i1 = 0; this.i2 = 0; this.vl1 = 0; this.vl2 = 0; }
  stamp(s) {
    const [L1, L2, M, R1, R2] = this.mat();
    const [k1, k2] = this.branches, [a, b, c, d] = this.nodes;
    s.addBranchKCL(a, b, k1); s.addBranchKCL(c, d, k2);
    s.addA(k1, a - 1, 1); s.addA(k1, b - 1, -1);
    s.addA(k2, c - 1, 1); s.addA(k2, d - 1, -1);
    const f = s.mode === 'dc' ? 0 : (s.method === 'be' ? 1 : 2) / s.dt;
    s.addA(k1, k1, -(R1 + f * L1)); s.addA(k1, k2, -f * M);
    s.addA(k2, k2, -(R2 + f * L2)); s.addA(k2, k1, -f * M);
  }
  stampStep(s) {
    if (s.mode === 'dc') return;
    const [L1, L2, M] = this.mat();
    const [k1, k2] = this.branches;
    const f = (s.method === 'be' ? 1 : 2) / s.dt;
    const tr = s.method === 'be' ? 0 : 1;
    s.b[k1] += -f * (L1 * this.i1 + M * this.i2) - tr * this.vl1;
    s.b[k2] += -f * (M * this.i1 + L2 * this.i2) - tr * this.vl2;
  }
  accept(s) {
    const [, , , R1, R2] = this.mat();
    const [k1, k2] = this.branches, [a, b, c, d] = this.nodes;
    this.i1 = s.x[k1]; this.i2 = s.x[k2];
    this.vl1 = s.mode === 'dc' ? 0 : s.v(a) - s.v(b) - R1 * this.i1;
    this.vl2 = s.mode === 'dc' ? 0 : s.v(c) - s.v(d) - R2 * this.i2;
    this.postCurrents = [this.i1, -this.i1, this.i2, -this.i2];
    this.i = this.i1;
  }
  stampAC(ac) {
    const [L1, L2, M, R1, R2] = this.mat();
    const [k1, k2] = this.branches, [a, b, c, d] = this.nodes, w = ac.omega;
    ac.addBranchKCL(a, b, k1); ac.addBranchKCL(c, d, k2);
    ac.addA(k1, a - 1, 1); ac.addA(k1, b - 1, -1);
    ac.addA(k2, c - 1, 1); ac.addA(k2, d - 1, -1);
    ac.addA(k1, k1, -R1, -w * L1); ac.addA(k1, k2, 0, -w * M);
    ac.addA(k2, k2, -R2, -w * L2); ac.addA(k2, k1, 0, -w * M);
  }
  readings(s) {
    const [a, b, c, d] = this.nodes;
    return [['V primary', s.v(a) - s.v(b), 'V'], ['I primary', this.i1, 'A'],
      ['V secondary', s.v(c) - s.v(d), 'V'], ['I secondary', this.i2, 'A']];
  }
  spice(n) {
    const [L1, L2, , R1, R2] = this.mat();
    return `L${this.name}p ${n[0]} ${n[1]} ${L1} Rser=${R1}\nL${this.name}s ${n[2]} ${n[3]} ${L2} Rser=${R2}\nK${this.name} L${this.name}p L${this.name}s ${this.p.k}`;
  }
  draw(g) {
    const ctx = g.ctx;
    const coil = (x, v1, v2, dir) => {
      const grad = g.grad(0, -2 * G, 0, 2 * G, v1, v2);
      ctx.beginPath();
      const n = 5, h = (3 * G) / n;
      for (let k = 0; k < n; k++) {
        const cy = -1.5 * G + h * (k + 0.5);
        ctx.arc(x, cy, h / 2, -Math.PI / 2, Math.PI / 2, dir < 0);
      }
      ctx.strokeStyle = grad; ctx.lineWidth = g.lw; ctx.stroke();
    };
    g.poly([[-G * 0.7, -2 * G], [-G * 0.7, -1.5 * G]], { stroke: g.vc(g.pv(0)), width: g.lw });
    g.poly([[-G * 0.7, 2 * G], [-G * 0.7, 1.5 * G]], { stroke: g.vc(g.pv(1)), width: g.lw });
    g.poly([[G * 0.7, -2 * G], [G * 0.7, -1.5 * G]], { stroke: g.vc(g.pv(2)), width: g.lw });
    g.poly([[G * 0.7, 2 * G], [G * 0.7, 1.5 * G]], { stroke: g.vc(g.pv(3)), width: g.lw });
    coil(-G * 0.7, g.pv(0), g.pv(1), 1);
    coil(G * 0.7, g.pv(2), g.pv(3), -1);
    g.line(-G * 0.12, -1.6 * G, -G * 0.12, 1.6 * G, g.body, g.lw * 0.8);
    g.line(G * 0.12, -1.6 * G, G * 0.12, 1.6 * G, g.body, g.lw * 0.8);
    g.circle(-G * 1.25, -1.6 * G, 2.6, { fill: g.body });
    g.circle(G * 1.25, -1.6 * G, 2.6, { fill: g.body });
  }
}
register(Transformer);

export class Fuse extends TwoTerm {
  static type = 'fuse'; static title = 'Fuse'; static category = 'Passive';
  static prefix = 'F'; static keywords = 'protection overcurrent breaker';
  static props = [
    { key: 'rating', label: 'Current rating', unit: 'A', def: 1, min: 1e-3, max: 1000, log: true, knob: true },
    { key: 'r', label: 'Resistance', unit: 'Ω', def: 0.05, min: 1e-4, max: 100, log: true },
    { key: 'i2t', label: 'Melting I²t', unit: 'A²s', def: 0.05, min: 1e-6, max: 1e4, log: true },
  ];
  static description = 'Blows (opens) when the let-through energy ∫(i² − I²rated)dt exceeds I²t. A blown fuse stays blown — select it and tap Replace to put in a new one.';
  reset() { this.heat = 0; this.i2 = 0; this.setCurrent(0); }
  get blown() { return !!this.damaged; }
  get R() { return this.blown ? 1e9 : this.p.r; }
  stamp(s) { s.addG(this.nodes[0], this.nodes[1], 1 / this.R); }
  stampAC(ac) { ac.addY(this.nodes[0], this.nodes[1], 1 / this.R); }
  accept(s) {
    const i = this.voltageDiff(s) / this.R;
    this.setCurrent(i);
    if (s.mode === 'dc' || this.blown) return;
    this.heat = Math.max(0, this.heat + (i * i - this.p.rating ** 2) * s.dt);
    this.i2 = (this.i2 || 0) + (i * i - (this.i2 || 0)) * Math.min(1, s.dt / Math.max(0.005, s.acPeriod || 0.005));
    this.stress = Math.min(1, this.heat / this.p.i2t);
    if (this.heat > this.p.i2t) this.setDamage(s, `Blown — about ${fmtShort(Math.sqrt(this.i2), 'A')} through a ${fmtShort(this.p.rating, 'A')} fuse melted its element`, true);
  }
  spice(n) { return `${this.name} ${n[0]} ${n[1]} ${this.R} ; fuse`; }
  draw(g) {
    g.box(-G, -G * 0.3, G, G * 0.3, { stroke: g.body, width: g.lw * 0.8 });
    if (this.blown) {
      g.line(-G, 0, -G * 0.2, G * 0.12, g.vc(g.pv(0)), g.lw);
      g.line(G, 0, G * 0.2, -G * 0.12, g.vc(g.pv(1)), g.lw);
      g.glow(0, 0, G * 0.8, '255,80,40', 0.3);
    } else {
      const grad = g.grad(-G, 0, G, 0, g.pv(0), g.pv(1));
      g.ctx.beginPath(); g.ctx.moveTo(-G, 0);
      g.ctx.bezierCurveTo(-G * 0.4, -G * 0.4, G * 0.4, G * 0.4, G, 0);
      g.ctx.strokeStyle = grad; g.ctx.lineWidth = g.lw * 0.9; g.ctx.stroke();
    }
  }
}
register(Fuse);

export class Lamp extends TwoTerm {
  static type = 'lamp'; static title = 'Lamp'; static category = 'Output';
  static prefix = 'LP'; static keywords = 'bulb light incandescent';
  static props = [
    { key: 'v', label: 'Rated voltage', unit: 'V', def: 12, min: 0.1, max: 1000, log: true },
    { key: 'w', label: 'Rated power', unit: 'W', def: 5, min: 1e-3, max: 1e4, log: true, knob: true },
  ];
  static description = 'Incandescent lamp modelled at its hot resistance R = V²/P; brightness follows dissipated power.';
  get R() { return this.damaged ? 1e9 : (this.p.v * this.p.v) / this.p.w; }
  valueLabel() { return `${+this.p.v.toPrecision(3)}V ${+this.p.w.toPrecision(3)}W`; }
  stamp(s) { s.addG(this.nodes[0], this.nodes[1], 1 / this.R); }
  stampAC(ac) { ac.addY(this.nodes[0], this.nodes[1], 1 / this.R); }
  reset() { this.pf = 0; this.setCurrent(0); }
  accept(s) {
    const v = this.voltageDiff(s), i = v / this.R;
    this.setCurrent(i);
    if (s.mode === 'dc' || this.damaged) return;
    // filament: ≈ 50 ms thermal time; far above its rated power the tungsten melts
    this.pf = (this.pf || 0) + ((v * i) / this.p.w - (this.pf || 0)) * Math.min(1, s.dt / 0.05);
    this.stress = Math.max(0, Math.min(1, (this.pf - 1.2) / 1.4));
    if (this.pf > 2.6) this.setDamage(s, `Filament burnt out — over-voltage (${fmtShort(Math.sqrt(this.pf) * this.p.v, 'V')} on a ${fmtShort(this.p.v, 'V')} lamp)`);
  }
  spice(n) { return `${this.name} ${n[0]} ${n[1]} ${this.R} ; lamp`; }
  leads() { return [[0, -2 * G, 0, -G * 0.8, 0], [1, 2 * G, 0, G * 0.8, 0]]; }
  localBox() { return [-2 * G, -0.9 * G, 2 * G, 0.9 * G]; }
  draw(g) {
    const v = g.pv(0) - g.pv(1);
    const b = g.running ? Math.min(1.2, (v * v) / this.R / this.p.w) : 0;
    if (b > 0.02) g.glow(0, 0, G * (1.4 + b), '255,214,110', Math.min(0.95, b));
    g.circle(0, 0, G * 0.8, { stroke: g.body, width: g.lw * 0.9, fill: b > 0.02 ? `rgba(255,230,150,${Math.min(0.9, b)})` : null });
    const d = G * 0.56;
    g.line(-d, -d, d, d, g.body, g.lw * 0.8);
    g.line(-d, d, d, -d, g.body, g.lw * 0.8);
  }
}
register(Lamp);
