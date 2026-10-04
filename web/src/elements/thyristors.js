// Thyristors & power electronics: SCR, TRIAC, DIAC, GTO, PUT, opto-TRIAC,
// isolated gate driver, averaged DC-DC converter modules (buck, boost) and a
// charge-pump voltage inverter.
//
// Thyristors use a latching behavioural model (as in most interactive
// simulators): a junction gate, a diode-like on-state and an off-state
// leakage. They latch on when triggered (gate current ≥ IGT with forward
// voltage, or break-over) and turn off when the main current falls below the
// holding current.

import { Element, register, GRID } from './base.js';
import { Junction, diodeIV } from './semis.js';
import { withChip } from './kit.js';
import { fmtShort } from '../engine/units.js';

const G = GRID;
const GOFF = 1e-9;

class Thyristor extends Element {
  static category = 'Thyristors & Power';
  static prefix = 'SCR';
  static bidir = false;
  nonlinear = true;
  constructor(x, y) {
    super(x, y);
    this.postCurrents = new Array(this.localPosts().length).fill(0);
    this.jm = new Junction(1e-12, 1.8); this.jm2 = new Junction(1e-12, 1.8);
    this.jg = new Junction(1e-14, 1); this.jg2 = new Junction(1e-14, 1);
    this.on = false;
  }
  localPosts() { return [[-2 * G, 0], [2 * G, 0], [G, 2 * G]]; }
  localBox() { return [-2 * G, -0.9 * G, 2 * G, 2 * G]; }
  leads() { return [[0, -2 * G, 0, -0.5 * G, 0], [1, 2 * G, 0, 0.5 * G, 0], [2, G, 2 * G, G, G], ]; }
  reset() { this.on = false; this.jm.vd = 0; this.jm2.vd = 0; this.jg.vd = 0; this.jg2.vd = 0; this.postCurrents.fill(0); this.ig = 0; }
  main(v) {
    // on-state: diode(s); off-state: leakage
    if (!this.on) return { i: v * GOFF, g: GOFF };
    const f = diodeIV(v, 1e-12, 1.8, 0);
    if (!this.constructor.bidir) return { i: f.i + v * GOFF, g: f.g + GOFF };
    const r = diodeIV(-v, 1e-12, 1.8, 0);
    return { i: f.i - r.i, g: f.g + r.g + GOFF };
  }
  gate(v) {
    const f = diodeIV(v, 1e-14, 1, 0);
    let i = f.i + v / 1000, g = f.g + 1e-3; // internal 1 kΩ gate-cathode shunt
    if (this.constructor.bidir) { const r = diodeIV(-v, 1e-14, 1, 0); i -= r.i; g += r.g; }
    return { i, g };
  }
  stampNL(s) {
    const [a, k, gt] = this.nodes;
    let v = s.v(a) - s.v(k);
    if (this.on) { v = v >= 0 ? this.jm.limit(s, v) : this.constructor.bidir ? -this.jm2.limit(s, -v) : v; }
    const m = this.main(v);
    s.addG(a, k, m.g); s.addI(a, k, m.i - m.g * v);
    let vg = s.v(gt) - s.v(k);
    vg = vg >= 0 ? this.jg.limit(s, vg) : this.constructor.bidir ? -this.jg2.limit(s, -vg) : vg;
    const gg = this.gate(vg);
    s.addG(gt, k, gg.g); s.addI(gt, k, gg.i - gg.g * vg);
  }
  accept(s) {
    const [a, k, gt] = this.nodes, v = s.v(a) - s.v(k), vg = s.v(gt) - s.v(k);
    this.jm.vd = Math.max(v, 0); this.jm2.vd = Math.max(-v, 0); this.jg.vd = Math.max(vg, 0); this.jg2.vd = Math.max(-vg, 0);
    const ia = this.main(v).i, ig = this.gate(vg).i;
    this.ig = ig; this.ia = ia;
    this.postCurrents = [ia, -(ia + ig), ig]; this.i = ia;
    this.update(s, v, ia, ig);
  }
  update(s, v, ia, ig) {
    const bi = this.constructor.bidir, p = this.p;
    if (!this.on) {
      const trig = bi ? Math.abs(ig) > p.igt && Math.abs(v) > 0.5 : ig > p.igt && v > 0.5;
      const bo = bi ? Math.abs(v) > p.vbo : v > p.vbo;
      if (trig || bo) { this.on = true; this.mark(s); }
    } else if ((bi ? Math.abs(ia) : ia) < p.ih) { this.on = false; this.mark(s); }
  }
  mark(s) { if (s.mode === 'dc') s.dirty = true; else s.markEvent(); }
  digitalSettle(s) { const was = this.on; const [a, k, gt] = this.nodes; this.update(s, s.v(a) - s.v(k), this.main(s.v(a) - s.v(k)).i, this.gate(s.v(gt) - s.v(k)).i); return was !== this.on; }
  stampAC(ac) { const [a, k, gt] = this.nodes; ac.addY(a, k, this.on ? 1 : GOFF); ac.addY(gt, k, 1e-3); }
  valueLabel() { return ''; }
  readings(s) {
    const [a, k, gt] = this.nodes;
    return [['State', this.on ? 'ON (latched)' : 'OFF (blocking)', ''], ['V(anode–cathode)', s.v(a) - s.v(k), 'V'], ['Anode current', this.ia || 0, 'A'], ['Gate current', this.ig || 0, 'A'], ['V(gate)', s.v(gt) - s.v(k), 'V']];
  }
  draw(g) {
    const h = 0.5 * G, c0 = g.vc(g.pv(0)), c1 = g.vc(g.pv(1));
    g.poly([[-0.5 * G, -h], [0.45 * G, 0], [-0.5 * G, h]], { stroke: c0, width: g.lw, fill: this.on && g.running ? 'rgba(74,222,128,0.35)' : g.fill, close: true });
    g.line(0.5 * G, -h, 0.5 * G, h, c1, g.lw * 1.2);
    g.poly([[0.45 * G, 0.25 * G], [G, G]], { stroke: g.vc(g.pv(2)), width: g.lw * 0.9 });
  }
}

const TPROPS = (igt, ih, vbo) => [
  { key: 'igt', label: 'Gate trigger current IGT', unit: 'A', def: igt, min: 1e-7, max: 1, log: true, knob: true },
  { key: 'ih', label: 'Holding current IH', unit: 'A', def: ih, min: 1e-7, max: 10, log: true },
  { key: 'vbo', label: 'Break-over voltage', unit: 'V', def: vbo, min: 1, max: 1e4, log: true },
];

export class SCR extends Thyristor {
  static type = 'scr'; static title = 'SCR (Thyristor)'; static keywords = 'scr thyristor silicon controlled rectifier c106 tyn612 phase control latch';
  static props = TPROPS(0.01, 0.02, 600);
  static description = 'Silicon-controlled rectifier: blocks until a gate pulse (≥ IGT) arrives while forward biased, then conducts like a diode until the anode current falls below IH. Terminals: A (left), K (right), G (bottom).';
}
register(SCR);

export class TRIAC extends Thyristor {
  static type = 'triac'; static title = 'TRIAC'; static keywords = 'triac bt136 bt139 ac switch dimmer phase control bidirectional thyristor';
  static props = TPROPS(0.01, 0.02, 600);
  static bidir = true;
  static description = 'Bidirectional thyristor for AC: triggered by gate current of either polarity (relative to MT1) and conducts both ways until the current crosses zero. Terminals: MT2 (left), MT1 (right), G (bottom).';
  draw(g) {
    const h = 0.55 * G, c0 = g.vc(g.pv(0)), c1 = g.vc(g.pv(1)), f = this.on && g.running ? 'rgba(74,222,128,0.35)' : g.fill;
    g.line(-0.45 * G, -h, -0.45 * G, h, c0, g.lw * 1.1);
    g.line(0.45 * G, -h, 0.45 * G, h, c1, g.lw * 1.1);
    g.poly([[-0.45 * G, -h], [0.45 * G, -0.02 * G], [-0.45 * G, -0.02 * G]], { stroke: g.body, width: g.lw * 0.8, fill: f, close: true });
    g.poly([[0.45 * G, h], [-0.45 * G, 0.02 * G], [0.45 * G, 0.02 * G]], { stroke: g.body, width: g.lw * 0.8, fill: f, close: true });
    g.poly([[0.45 * G, 0.35 * G], [G, G]], { stroke: g.vc(g.pv(2)), width: g.lw * 0.9 });
  }
}
register(TRIAC);

export class GTO extends Thyristor {
  static type = 'gto'; static title = 'GTO Thyristor'; static keywords = 'gto gate turn off thyristor traction';
  static props = [...TPROPS(0.05, 0.1, 1000), { key: 'boff', label: 'Turn-off gain', unit: '', def: 4, min: 1, max: 20 }];
  static description = 'Gate turn-off thyristor: turned on like an SCR and turned off by a negative gate current of at least I_anode / turn-off gain.';
  update(s, v, ia, ig) {
    if (this.on && ig < 0 && -ig > Math.abs(ia) / this.p.boff) { this.on = false; this.mark(s); return; }
    super.update(s, v, ia, ig);
  }
  draw(g) { super.draw(g); g.line(0.62 * G, 0.5 * G, 0.85 * G, 0.72 * G, g.vc(g.pv(2)), g.lw * 0.9); }
}
register(GTO);

export class PUT extends Element {
  static type = 'put'; static title = 'PUT (Programmable UJT)'; static category = 'Thyristors & Power';
  static prefix = 'Q'; static keywords = 'put programmable unijunction transistor 2n6027 relaxation oscillator';
  static props = [
    { key: 'iv', label: 'Valley current', unit: 'A', def: 1e-4, min: 1e-7, max: 0.1, log: true, knob: true },
    { key: 'ip', label: 'Peak current', unit: 'A', def: 1e-6, min: 1e-9, max: 1e-2, log: true },
  ];
  static description = 'Programmable UJT (2N6027): fires when the anode rises ≈0.6 V above the gate voltage (set by a divider) and conducts until the anode current falls below the valley current. Terminals: A (left), K (right), G (bottom).';
  nonlinear = true;
  constructor(x, y) { super(x, y); this.postCurrents = [0, 0, 0]; this.on = false; this.ja = new Junction(1e-14, 1); this.jm = new Junction(1e-12, 1.5); }
  localPosts() { return [[-2 * G, 0], [2 * G, 0], [-G, 2 * G]]; }
  localBox() { return [-2 * G, -0.9 * G, 2 * G, 2 * G]; }
  leads() { return [[0, -2 * G, 0, -0.5 * G, 0], [1, 2 * G, 0, 0.5 * G, 0], [2, -G, 2 * G, -G, G]]; }
  reset() { this.on = false; this.ja.vd = 0; this.jm.vd = 0; this.postCurrents.fill(0); }
  stampNL(s) {
    const [a, k, gt] = this.nodes;
    if (this.on) {
      const v = this.jm.limit(s, s.v(a) - s.v(k)), d = diodeIV(v, 1e-12, 1.5, 0);
      s.addG(a, k, d.g + GOFF); s.addI(a, k, d.i - d.g * v);
    } else s.addG(a, k, GOFF);
    const vag = this.ja.limit(s, s.v(a) - s.v(gt)), dg = diodeIV(vag, 1e-14, 1, 0);
    s.addG(a, gt, dg.g + GOFF); s.addI(a, gt, dg.i - dg.g * vag);
  }
  accept(s) {
    const [a, k, gt] = this.nodes, vak = s.v(a) - s.v(k), vag = s.v(a) - s.v(gt);
    this.ja.vd = vag; this.jm.vd = vak;
    const iak = this.on ? diodeIV(vak, 1e-12, 1.5, 0).i : vak * GOFF, iag = diodeIV(vag, 1e-14, 1, 0).i;
    this.postCurrents = [iak + iag, -iak, -iag]; this.i = iak;
    if (!this.on && iag > this.p.ip) { this.on = true; s.markEvent(); } else if (this.on && iak < this.p.iv) { this.on = false; s.markEvent(); }
  }
  stampAC(ac) { const [a, k, gt] = this.nodes; ac.addY(a, k, this.on ? 1 : GOFF); ac.addY(a, gt, GOFF); }
  valueLabel() { return ''; }
  readings(s) { const [a, k, gt] = this.nodes; return [['State', this.on ? 'ON' : 'OFF', ''], ['V(A–K)', s.v(a) - s.v(k), 'V'], ['V(A–G)', s.v(a) - s.v(gt), 'V'], ['Anode current', this.i, 'A']]; }
  draw(g) {
    const h = 0.5 * G;
    g.poly([[-0.5 * G, -h], [0.45 * G, 0], [-0.5 * G, h]], { stroke: g.vc(g.pv(0)), width: g.lw, fill: this.on && g.running ? 'rgba(74,222,128,0.35)' : g.fill, close: true });
    g.line(0.5 * G, -h, 0.5 * G, h, g.vc(g.pv(1)), g.lw * 1.2);
    g.poly([[-0.1 * G, -0.25 * G], [-G, G]], { stroke: g.vc(g.pv(2)), width: g.lw * 0.9 });
  }
}
register(PUT);

export class DIAC extends Element {
  static type = 'diac'; static title = 'DIAC'; static category = 'Thyristors & Power';
  static prefix = 'D'; static keywords = 'diac db3 trigger diode breakover triac trigger dimmer';
  static props = [
    { key: 'vbo', label: 'Break-over voltage', unit: 'V', def: 32, min: 5, max: 200, knob: true },
    { key: 'dv', label: 'Break-back ΔV', unit: 'V', def: 6, min: 0.5, max: 50 },
    { key: 'ron', label: 'On resistance', unit: 'Ω', def: 20, min: 0.1, max: 1e4, log: true },
    { key: 'ih', label: 'Holding current', unit: 'A', def: 1e-3, min: 1e-6, max: 0.5, log: true },
  ];
  static description = 'DIAC (DB3): blocks until |V| exceeds the break-over voltage (≈32 V), then snaps back by ΔV and conducts — used to trigger TRIACs in dimmers.';
  nonlinear = true;
  constructor(x, y) { super(x, y); this.postCurrents = [0, 0]; this.on = false; }
  localPosts() { return [[-2 * G, 0], [2 * G, 0]]; }
  localBox() { return [-2 * G, -0.8 * G, 2 * G, 0.8 * G]; }
  leads() { return [[0, -2 * G, 0, -0.45 * G, 0], [1, 2 * G, 0, 0.45 * G, 0]]; }
  reset() { this.on = false; this.postCurrents.fill(0); }
  iv(v) {
    if (!this.on) return { i: v * GOFF, g: GOFF };
    const vm = this.p.vbo - this.p.dv, w = 0.2, u = (Math.abs(v) - vm) / w;
    const sp = u > 30 ? u : Math.log1p(Math.exp(u)), sg = 1 / (1 + Math.exp(-u));
    return { i: (Math.sign(v) * sp * w) / this.p.ron + v * GOFF, g: sg / this.p.ron + GOFF };
  }
  stampNL(s) { const [a, b] = this.nodes, v = s.v(a) - s.v(b), { i, g } = this.iv(v); s.addG(a, b, g); s.addI(a, b, i - g * v); }
  accept(s) {
    const v = s.v(this.nodes[0]) - s.v(this.nodes[1]), { i } = this.iv(v);
    this.postCurrents = [i, -i]; this.i = i;
    if (!this.on && Math.abs(v) > this.p.vbo) { this.on = true; s.markEvent(); } else if (this.on && Math.abs(i) < this.p.ih) { this.on = false; s.markEvent(); }
  }
  stampAC(ac) { ac.addY(this.nodes[0], this.nodes[1], this.on ? 1 / this.p.ron : GOFF); }
  valueLabel() { return fmtShort(this.p.vbo, 'V'); }
  readings(s) { return [['State', this.on ? 'Conducting' : 'Blocking', ''], ['Voltage', s.v(this.nodes[0]) - s.v(this.nodes[1]), 'V'], ['Current', this.i, 'A']]; }
  draw(g) {
    const h = 0.55 * G, c0 = g.vc(g.pv(0)), c1 = g.vc(g.pv(1));
    g.line(-0.45 * G, -h, -0.45 * G, h, c0, g.lw * 1.1);
    g.line(0.45 * G, -h, 0.45 * G, h, c1, g.lw * 1.1);
    g.poly([[-0.45 * G, -h], [0.45 * G, -0.02 * G], [-0.45 * G, -0.02 * G]], { stroke: g.body, width: g.lw * 0.8, fill: g.fill, close: true });
    g.poly([[0.45 * G, h], [-0.45 * G, 0.02 * G], [0.45 * G, 0.02 * G]], { stroke: g.body, width: g.lw * 0.8, fill: g.fill, close: true });
  }
}
register(DIAC);

export class OptoTriac extends withChip(Element) {
  static type = 'optotriac'; static title = 'Opto-TRIAC (MOC3021/3041)'; static category = 'Thyristors & Power';
  static prefix = 'U'; static keywords = 'moc3021 moc3041 opto triac optocoupler triac driver zero cross isolation';
  static props = [
    { key: 'ift', label: 'LED trigger current IFT', unit: 'A', def: 0.015, min: 1e-4, max: 0.1, log: true, knob: true },
    { key: 'zc', label: 'Zero-crossing (MOC3041)', type: 'bool', def: false },
    { key: 'ih', label: 'Output holding current', unit: 'A', def: 1e-4, min: 1e-7, max: 0.1, log: true },
  ];
  static pins = [['A', 'L'], ['K', 'L'], ['MT2', 'R'], ['MT1', 'R']];
  static description = 'Optically isolated TRIAC driver: LED current ≥ IFT turns on the photo-TRIAC output (used to fire a power TRIAC gate). The zero-cross version only turns on near a voltage zero.';
  nonlinear = true;
  constructor(x, y) { super(x, y); this.postCurrents = [0, 0, 0, 0]; this.on = false; this.j = new Junction(1e-12, 2); }
  connectivity() { return [[0, 1], [2, 3]]; }
  reset() { this.on = false; this.j.vd = 0; this.postCurrents.fill(0); this.if = 0; }
  out(v) {
    if (!this.on) return { i: v * GOFF, g: GOFF };
    const f = diodeIV(Math.min(v, 3), 1e-10, 2, 0), r = diodeIV(Math.min(-v, 3), 1e-10, 2, 0);
    return { i: f.i - r.i + v * 0.01, g: f.g + r.g + 0.01 };
  }
  stampNL(s) {
    const [a, k, m2, m1] = this.nodes;
    const vd = this.j.limit(s, s.v(a) - s.v(k)), d = diodeIV(vd, 1e-12, 2, 0);
    s.addG(a, k, d.g + GOFF); s.addI(a, k, d.i - d.g * vd);
    const v = s.v(m2) - s.v(m1), o = this.out(v);
    s.addG(m2, m1, o.g); s.addI(m2, m1, o.i - o.g * v);
  }
  accept(s) {
    const [a, k, m2, m1] = this.nodes, vd = s.v(a) - s.v(k), v = s.v(m2) - s.v(m1);
    this.j.vd = vd;
    this.if = diodeIV(vd, 1e-12, 2, 0).i;
    const io = this.out(v).i;
    this.postCurrents = [this.if, -this.if, io, -io]; this.i = this.if;
    if (s.mode === 'dc') return;
    if (!this.on && this.if > this.p.ift && (!this.p.zc || Math.abs(v) < 20) && Math.abs(v) > 0.5) { this.on = true; s.markEvent(); } else if (this.on && Math.abs(io) < this.p.ih) { this.on = false; s.markEvent(); }
  }
  stampAC(ac) { ac.addY(this.nodes[0], this.nodes[1], 1e-3); ac.addY(this.nodes[2], this.nodes[3], this.on ? 0.1 : GOFF); }
  valueLabel() { return this.p.zc ? 'MOC3041' : 'MOC3021'; }
  readings(s) { return [['Output', this.on ? 'ON' : 'OFF', ''], ['LED current', this.if || 0, 'A'], ['Output current', this.postCurrents[2], 'A']]; }
  draw(g) {
    this.drawChip(g, '');
    const lit = g.running && this.if > this.p.ift;
    g.poly([[-0.75 * G, -0.35 * G], [-0.75 * G, 0.25 * G], [-0.4 * G, -0.05 * G]], { stroke: g.body, width: g.lw * 0.6, close: true, fill: lit ? 'rgba(255,80,80,0.7)' : null });
    for (const dy of [-0.15, 0.15]) g.line(-0.2 * G, dy * G, 0.15 * G, dy * G + 3, lit ? '#f87171' : g.muted, g.lw * 0.5);
    g.circle(0.55 * G, 0, 3, { fill: this.on ? g.hi : g.lo });
  }
}
register(OptoTriac);

// ---------------------------------------------------------- gate driver
export class GateDriver extends withChip(Element) {
  static type = 'gatedrv'; static title = 'Isolated Gate Driver'; static category = 'Thyristors & Power';
  static prefix = 'U'; static keywords = 'gate driver isolated high side mosfet igbt driver ir2110 tlp250 bootstrap h bridge';
  static props = [
    { key: 'von', label: 'Output high (Vgs)', unit: 'V', def: 15, min: 1, max: 30, knob: true },
    { key: 'voff', label: 'Output low', unit: 'V', def: 0, min: -15, max: 5 },
    { key: 'vth', label: 'Input threshold', unit: 'V', def: 2.5, min: 0.2, max: 20 },
    { key: 'rout', label: 'Output resistance', unit: 'Ω', def: 5, min: 0.01, max: 1e4, log: true },
  ];
  static pins = [['IN', 'L'], ['GND', 'L'], ['OUT', 'R'], ['COM', 'R']];
  static description = 'Isolated (floating) gate driver: when V(IN) − V(GND) exceeds the threshold, OUT is driven to Von above COM (connect COM to the MOSFET/IGBT source or emitter — even on the high side of a bridge).';
  constructor(x, y) { super(x, y); this.postCurrents = [0, 0, 0, 0]; this.st = false; }
  connectivity() { return [[0, 1], [2, 3]]; }
  branchCount() { return 1; }
  reset() { this.st = false; this.postCurrents.fill(0); }
  evalIn(s) { const v = s.v(this.nodes[0]) - s.v(this.nodes[1]), h = 0.1 * this.p.vth; return this.st ? v > this.p.vth - h : v > this.p.vth + h; }
  preStep(s) { const n = this.evalIn(s); if (n !== this.st) { this.st = n; s.event = true; } }
  digitalSettle(s) { const n = this.evalIn(s); if (n !== this.st) { this.st = n; return true; } return false; }
  stamp(s) {
    const [, , o, c] = this.nodes, k = this.branches[0];
    s.addBranchKCL(o, c, k); s.addA(k, o - 1, 1); s.addA(k, c - 1, -1); s.addA(k, k, -this.p.rout);
    s.addG(this.nodes[0], this.nodes[1], 1e-6);
  }
  stampStep(s) { s.b[this.branches[0]] += this.st ? this.p.von : this.p.voff; }
  accept(s) { const io = s.x[this.branches[0]], ii = (s.v(this.nodes[0]) - s.v(this.nodes[1])) * 1e-6; this.postCurrents = [ii, -ii, io, -io]; this.i = io; }
  stampAC(ac) {
    const [, , o, c] = this.nodes, k = this.branches[0];
    ac.addBranchKCL(o, c, k); ac.addA(k, o - 1, 1); ac.addA(k, c - 1, -1); ac.addA(k, k, -this.p.rout);
    ac.addY(this.nodes[0], this.nodes[1], 1e-6);
  }
  valueLabel() { return fmtShort(this.p.von, 'V'); }
  readings(s) { return [['Output', this.st ? 'HIGH' : 'LOW', ''], ['V(OUT–COM)', s.v(this.nodes[2]) - s.v(this.nodes[3]), 'V'], ['Output current', -this.i, 'A']]; }
  draw(g) {
    this.drawChip(g, 'DRV');
    g.poly([[-0.4 * G, -0.3 * G], [0.3 * G, 0.05 * G], [-0.4 * G, 0.4 * G]], { stroke: g.body, width: g.lw * 0.6, close: true, fill: this.st && g.running ? g.accent : null });
    g.line(0.55 * G, -0.45 * G, 0.55 * G, 0.55 * G, g.muted, g.lw * 0.4);
  }
}
register(GateDriver);

// ------------------------------------------------- averaged DC-DC modules
export const smin = (a, b, w) => { const d = a - b, r = Math.sqrt(d * d + w * w); return { y: (a + b - r) / 2, da: (1 - d / r) / 2, db: (1 + d / r) / 2 }; };
export const smax = (a, b, w) => { const m = smin(-a, -b, w); return { y: -m.y, da: m.da, db: m.db }; };

export class DCDC extends withChip(Element) {
  static category = 'Thyristors & Power';
  static prefix = 'U';
  nonlinear = true;
  constructor(x, y) { super(x, y); this.postCurrents = new Array(this.localPosts().length).fill(0); }
  ends() { const n = this.nodes; return { ip: n[0], im: n[1], op: n[2], om: n[3] }; }
  connectivity() { return [[0, 1, 2, 3]]; }
  branchCount() { return 1; }
  reset() { this.postCurrents.fill(0); this.d = { dvi: 0 }; }
  vo() { return { y: 0, d: 0 }; } // output set point as a function of Vin: {y, d = dy/dVin}
  stamp(s) {
    const { op, om } = this.ends(), k = this.branches[0];
    s.addBranchKCL(op, om, k); s.addA(k, op - 1, 1); s.addA(k, om - 1, -1); s.addA(k, k, -this.p.rout);
    s.addG(this.ends().ip, this.ends().im, 1e-6);
  }
  stampNL(s) {
    const { ip, im, op, om } = this.ends(), k = this.branches[0];
    const vin = s.v(ip) - s.v(im), vout = s.v(op) - s.v(om), io = s.x[k];
    const sc = s.srcScale ?? 1;
    const v = this.vo(vin);
    // output row: v_op − v_om − R·k − Vo(vin) = 0
    s.addA(k, ip - 1, -v.d * sc); s.addA(k, im - 1, v.d * sc);
    s.b[k] += (v.y - v.d * vin) * sc;
    // input current (power balance): Iin = −k·Vout / (η·Vin), flows ip → im through the module
    const vi = Math.max(vin, 0.5), eta = this.p.eff;
    const iin = (-io * vout) / (eta * vi);
    const dk = -vout / (eta * vi), dvo = -io / (eta * vi), dvi = vin > 0.5 ? (io * vout) / (eta * vi * vi) : 0;
    const r1 = ip - 1, r2 = im - 1;
    const add = (row, sg) => {
      if (row < 0) return;
      s.addA(row, k, sg * dk);
      s.addA(row, op - 1, sg * dvo); s.addA(row, om - 1, -sg * dvo);
      s.addA(row, ip - 1, sg * dvi); s.addA(row, im - 1, -sg * dvi);
      s.b[row] -= sg * (iin - dk * io - dvo * vout - dvi * vin);
    };
    add(r1, 1); add(r2, -1);
  }
  accept(s) {
    const { ip, im, op, om } = this.ends(), io = s.x[this.branches[0]];
    const vin = s.v(ip) - s.v(im), vout = s.v(op) - s.v(om), iin = (-io * vout) / (this.p.eff * Math.max(vin, 0.5));
    this.postCurrents = [iin, -iin, io, -io]; this.i = iin;
    this.vin = vin; this.vout = vout; this.iout = -io;
  }
  stampAC(ac) { const { op, om } = this.ends(), k = this.branches[0]; ac.addBranchKCL(op, om, k); ac.addA(k, op - 1, 1); ac.addA(k, om - 1, -1); ac.addA(k, k, -this.p.rout); }
  valueLabel() { return fmtShort(this.p.vset, 'V'); }
  readings() { return [['Vin', this.vin || 0, 'V'], ['Vout', this.vout || 0, 'V'], ['Iout', this.iout || 0, 'A'], ['Iin', this.i || 0, 'A'], ['Efficiency', this.p.eff * 100, '%']]; }
}
const DCDC_PROPS = (v) => [
  { key: 'vset', label: 'Output voltage set', unit: 'V', def: v, min: 0.5, max: 400, knob: true },
  { key: 'eff', label: 'Efficiency', unit: '', def: 0.9, min: 0.3, max: 1 },
  { key: 'rout', label: 'Output resistance', unit: 'Ω', def: 0.02, min: 1e-4, max: 100, log: true },
];

export class BuckModule extends DCDC {
  static type = 'buckmod'; static title = 'Buck Converter Module'; static keywords = 'buck converter step down dc dc module lm2596 smps switching regulator averaged';
  static props = [...DCDC_PROPS(5), { key: 'drop', label: 'Minimum headroom', unit: 'V', def: 1.5, min: 0, max: 20 }];
  static pins = [['IN+', 'L'], ['IN−', 'L'], ['OUT+', 'R'], ['OUT−', 'R']];
  static description = 'Averaged step-down DC-DC converter (LM2596-style module): Vout = min(Vset, Vin − headroom); input current from power balance Iin = Vout·Iout / (η·Vin) — so the input current is less than the output current.';
  vo(vin) { const m = smin(this.p.vset, vin - this.p.drop, 0.05), c = smax(m.y, 0, 0.02); return { y: c.y, d: c.da * m.db }; }
  draw(g) { this.drawChip(g, 'BUCK'); g.upright(() => g.text('↓', 0, 0.2 * G, { size: 12, color: g.accent, bold: true })); }
}
register(BuckModule);

export class BoostModule extends DCDC {
  static type = 'boostmod'; static title = 'Boost Converter Module'; static keywords = 'boost converter step up dc dc module mt3608 xl6009 smps averaged';
  static props = [...DCDC_PROPS(12), { key: 'drop', label: 'Diode drop', unit: 'V', def: 0.4, min: 0, max: 5 }];
  static pins = [['IN+', 'L'], ['IN−', 'L'], ['OUT+', 'R'], ['OUT−', 'R']];
  static description = 'Averaged step-up DC-DC converter (MT3608-style): Vout = max(Vset, Vin − diode drop); input current from power balance, so it draws more current than it delivers.';
  vo(vin) { const m = smax(this.p.vset, vin - this.p.drop, 0.05); return { y: m.y, d: m.db }; }
  draw(g) { this.drawChip(g, 'BOOST'); g.upright(() => g.text('↑', 0, 0.2 * G, { size: 12, color: g.accent, bold: true })); }
}
register(BoostModule);

export class ChargePump extends DCDC {
  static type = 'chargepump'; static title = 'Charge-Pump Inverter (ICL7660)'; static category = 'Analog ICs';
  static keywords = 'charge pump icl7660 voltage inverter negative supply switched capacitor';
  static props = [
    { key: 'eff', label: 'Efficiency', unit: '', def: 0.95, min: 0.3, max: 1 },
    { key: 'rout', label: 'Output resistance', unit: 'Ω', def: 55, min: 0.1, max: 1e4, log: true },
  ];
  static pins = [['V+', 'L'], ['GND', 'L'], ['OUT', 'R']];
  static description = 'Switched-capacitor voltage inverter (averaged): OUT ≈ −V+ with ≈55 Ω output resistance.';
  constructor(x, y) { super(x, y); this.postCurrents = [0, 0, 0]; }
  ends() { const n = this.nodes; return { ip: n[0], im: n[1], op: n[2], om: n[1] }; }
  connectivity() { return [[0, 1, 2]]; }
  vo(vin) { return { y: -vin, d: -1 }; }
  accept(s) {
    super.accept(s);
    const [iin, , io] = this.postCurrents;
    this.postCurrents = [iin, -iin - io, io];
  }
  valueLabel() { return ''; }
  draw(g) { this.drawChip(g, '7660'); }
}
register(ChargePump);
