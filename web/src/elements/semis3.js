// More semiconductors:
//  - Diodes with charge storage (SPICE TT diffusion charge + CJ0 junction
//    capacitance + RS): signal, standard, fast, ultra-fast, power, avalanche
//    and SiC Schottky types — reverse recovery shows on the scope
//  - PIN diode (bias-controlled RF resistance), Gunn diode (negative
//    differential resistance), IMPATT (avalanche diode)
//  - GaN HEMT
//  - SIDAC, SCS (silicon controlled switch), LASCR (light-activated SCR), IGCT
//  - IGBT half-bridge power module and a half-bridge intelligent power module

import { Element, register, GRID } from './base.js';
import { Diode, Junction, diodeIV, CapState, NMOS } from './semis.js';
import { IGBT } from './semis2.js';
import { SCR, GTO, DIAC } from './thyristors.js';
import { Composite, withChip } from './kit.js';
import { fmtShort } from '../engine/units.js';

const G = GRID;

// ------------------------------------------------- diodes with stored charge
const DQ_PRESETS = {
  '1N4148': { is: 2.52e-9, n: 1.752, bv: 100, rs: 0.57, tt: 5.8e-9, cj0: 4e-12, vj: 0.75, mj: 0.33 },
  '1N4007': { is: 7e-9, n: 1.9, bv: 1000, rs: 0.04, tt: 4.3e-6, cj0: 26e-12, vj: 0.75, mj: 0.33 },
  'FR107': { is: 1e-8, n: 1.8, bv: 1000, rs: 0.05, tt: 3e-7, cj0: 15e-12, vj: 0.75, mj: 0.33 },
  'UF4007': { is: 4e-9, n: 1.85, bv: 1000, rs: 0.05, tt: 5e-8, cj0: 17e-12, vj: 0.75, mj: 0.33 },
  'MUR860': { is: 1e-8, n: 1.7, bv: 600, rs: 0.012, tt: 4e-8, cj0: 60e-12, vj: 0.75, mj: 0.4 },
  '6A10': { is: 2e-8, n: 1.8, bv: 1000, rs: 0.008, tt: 5e-6, cj0: 150e-12, vj: 0.75, mj: 0.4 },
  'BYV26 (avalanche)': { is: 5e-9, n: 1.8, bv: 1000, rs: 0.05, tt: 3e-8, cj0: 20e-12, vj: 0.75, mj: 0.33 },
  'C3D10065 (SiC)': { is: 1e-14, n: 1.3, bv: 650, rs: 0.04, tt: 0, cj0: 480e-12, vj: 1.5, mj: 0.5 },
};

const DQ_PROPS = (model) => {
  const d = DQ_PRESETS[model];
  return [
    { key: 'model', label: 'Model', type: 'select', def: model, options: Object.keys(DQ_PRESETS).map((k) => [k, k]).concat([['custom', 'Custom']]), preset: DQ_PRESETS },
    { key: 'is', label: 'Saturation current Is', unit: 'A', def: d.is, min: 1e-20, max: 1e-3, log: true },
    { key: 'n', label: 'Emission coefficient n', unit: '', def: d.n, min: 0.5, max: 5 },
    { key: 'bv', label: 'Breakdown voltage (0 = none)', unit: 'V', def: d.bv, min: 0, max: 20000 },
    { key: 'rs', label: 'Series resistance Rs', unit: 'Ω', def: d.rs, min: 1e-4, max: 1e3, log: true },
    { key: 'tt', label: 'Transit time TT (reverse recovery)', unit: 's', def: d.tt, min: 0, max: 1e-3 },
    { key: 'cj0', label: 'Zero-bias junction capacitance', unit: 'F', def: d.cj0, min: 0, max: 1e-6 },
    { key: 'vj', label: 'Junction potential', unit: 'V', def: d.vj, min: 0.2, max: 3, hidden: true },
    { key: 'mj', label: 'Grading coefficient', unit: '', def: d.mj, min: 0.1, max: 0.9, hidden: true },
  ];
};

/**
 * Diode with series resistance and stored charge Q(v) = TT·I(v) + Qj(v)
 * (SPICE diode charge model, FC = 0.5). The charge current dQ/dt is integrated
 * with the same companion model as the circuit, so a diode that is switched
 * off while conducting first passes a reverse recovery current.
 */
export class DiodeQ extends Diode {
  static type = 'diodeq'; static title = 'Diode (switching, with recovery)'; static category = 'Diodes';
  static keywords = 'diode reverse recovery trr junction capacitance switching diode transit time';
  static props = DQ_PROPS('1N4148');
  static description = 'SPICE-level diode: Shockley junction with series resistance Rs, diffusion charge TT·I (reverse recovery) and voltage-dependent junction capacitance. Switch it off while it conducts and the scope shows the reverse-recovery current spike (≈TT long).';
  internalNodeCount() { return 1; }
  connectivity() { return null; }
  hasQ() { return this.p.tt > 0 || this.p.cj0 > 0; }
  qj(v) {
    const { cj0, vj } = this.p, m = this.p.mj;
    if (cj0 <= 0) return { q: 0, c: 0 };
    const fc = 0.5, fv = fc * vj;
    if (v < fv) { const r = 1 - v / vj; return { q: (cj0 * vj * (1 - Math.pow(r, 1 - m))) / (1 - m), c: cj0 * Math.pow(r, -m) }; }
    const f1 = (vj * (1 - Math.pow(1 - fc, 1 - m))) / (1 - m), f2 = Math.pow(1 - fc, 1 + m), f3 = 1 - fc * (1 + m);
    return { q: cj0 * (f1 + (f3 * (v - fv) + (m / (2 * vj)) * (v * v - fv * fv)) / f2), c: (cj0 * (f3 + (m * v) / vj)) / f2 };
  }
  charge(v, i, g) { const j = this.qj(v); return { q: this.p.tt * i + j.q, c: this.p.tt * g + j.c }; }
  reset() { super.reset(); this.qPrev = 0; this.icPrev = 0; this.cd = 0; this.qs = 0; }
  stamp(s) { s.addG(this.nodes[0], this.inodes[0], 1 / Math.max(this.p.rs, 1e-4)); }
  stampNL(s) {
    const k = this.nodes[1], x = this.inodes[0];
    const v = this.j.limit(s, s.v(x) - s.v(k));
    const { i, g } = diodeIV(v, this.p.is, this.p.n, this.p.bv);
    s.addG(x, k, g); s.addI(x, k, i - g * v);
    if (s.mode !== 'dc' && this.hasQ()) {
      const f = (s.method === 'be' ? 1 : 2) / s.dt, qq = this.charge(v, i, g);
      const ic = f * (qq.q - this.qPrev) - (s.method === 'be' ? 0 : this.icPrev), gc = f * qq.c;
      s.addG(x, k, gc); s.addI(x, k, ic - gc * v);
    }
    this.gd = g;
  }
  accept(s) {
    const k = this.nodes[1], x = this.inodes[0], v = s.v(x) - s.v(k);
    const { i, g } = diodeIV(v, this.p.is, this.p.n, this.p.bv), qq = this.charge(v, i, g);
    let ic = 0;
    if (s.mode !== 'dc' && this.hasQ()) {
      const f = (s.method === 'be' ? 1 : 2) / s.dt;
      ic = f * (qq.q - this.qPrev) - (s.method === 'be' ? 0 : this.icPrev);
    }
    this.qPrev = qq.q; this.icPrev = ic; this.cd = qq.c; this.qs = qq.q;
    this.j.vd = v; this.gd = g;
    this.setCurrent(i + ic);
  }
  stampAC(ac) {
    const [a, k] = this.nodes, x = this.inodes[0];
    ac.addY(a, x, 1 / Math.max(this.p.rs, 1e-4));
    ac.addY(x, k, (this.gd || 0) + 1e-12, ac.omega * (this.cd || 0));
  }
  readings(s) {
    const v = this.voltageDiff(s);
    return [['Voltage', v, 'V'], ['Current', this.i, 'A'], ['Power', v * this.i, 'W'], ['Stored charge', this.qs || 0, 'C'], ['Capacitance now', this.cd || 0, 'F']];
  }
  spice(n) {
    const p = this.p;
    return `${this.name} ${n[0]} ${n[1]} D${this.name}\n.model D${this.name} D(Is=${p.is} N=${p.n} Rs=${p.rs} TT=${p.tt} CJO=${p.cj0} VJ=${p.vj} M=${p.mj}${p.bv ? ` BV=${p.bv}` : ''})`;
  }
}
register(DiodeQ);

function dq(type, title, model, keywords, desc, mark) {
  const C = class extends DiodeQ {};
  Object.assign(C, { type, title, keywords, description: desc, props: DQ_PROPS(model) });
  if (mark) C.prototype.draw = function (g) { this.drawDiodeBody(g); mark.call(this, g); };
  register(C);
  return C;
}
dq('fastdiode', 'Fast-Recovery Diode (FR107)', 'FR107', 'fast recovery diode fr107 fr207 snubber flyback freewheeling',
  'Fast-recovery rectifier: reverse recovery ≈ 0.3–0.5 µs instead of several µs — for flyback converters, snubbers and freewheeling at a few tens of kHz.');
dq('ufdiode', 'Ultra-Fast Diode (UF4007)', 'UF4007', 'ultra fast diode uf4007 her108 smps freewheeling 75ns',
  'Ultra-fast recovery rectifier: trr ≈ 50–75 ns — used in switch-mode power supplies at 50–200 kHz.');
dq('powerdiode', 'Power Diode (6A10)', '6A10', 'power diode 6a10 high current rectifier stud diode',
  'High-current rectifier diode (6 A): very low series resistance; slow recovery (µs), so it is used at mains frequency.');
dq('sicdiode', 'SiC Schottky Diode (C3D10065)', 'C3D10065 (SiC)', 'silicon carbide sic schottky diode zero recovery pfc 650v',
  'Silicon-carbide Schottky diode: 650 V blocking with zero reverse-recovery charge (only junction capacitance), forward drop ≈1.5 V at 10 A. Used in PFC stages and fast inverters.',
  function (g) { const c1 = g.vc(g.pv(1)), h = G * 0.5; g.poly([[G * 0.3, -h + 3], [G * 0.3, -h], [G * 0.5, -h], [G * 0.5, h], [G * 0.7, h], [G * 0.7, h - 3]], { stroke: c1, width: g.lw * 1.1 }); g.text('SiC', 0, -0.95 * G, { size: 6, color: g.muted, bold: true, follow: true }); });
dq('avalanche', 'Avalanche Diode (BYV26)', 'BYV26 (avalanche)', 'avalanche diode controlled avalanche byv26 rugged breakdown',
  'Controlled-avalanche rectifier: if a voltage spike exceeds its rating it breaks down safely (like a Zener) instead of being destroyed. Fast recovery (≈30 ns).',
  function (g) { const c1 = g.vc(g.pv(1)), h = G * 0.5; g.poly([[G * 0.3, -h - 4], [G * 0.5, -h], [G * 0.5, h], [G * 0.7, h + 4]], { stroke: c1, width: g.lw * 1.2 }); });

// ---------------------------------------------------------------- PIN diode
export class PINDiode extends Diode {
  static type = 'pindiode'; static title = 'PIN Diode (RF switch)'; static category = 'Diodes';
  static keywords = 'pin diode rf switch attenuator bap64 intrinsic variable resistor';
  static props = [
    { key: 'r1m', label: 'RF resistance at 1 mA', unit: 'Ω', def: 10, min: 0.01, max: 1e4, log: true, knob: true },
    { key: 'rmin', label: 'Minimum resistance', unit: 'Ω', def: 0.5, min: 1e-3, max: 100, log: true },
    { key: 'rmax', label: 'Zero-bias resistance', unit: 'Ω', def: 5000, min: 1, max: 1e8, log: true },
    { key: 'tau', label: 'Carrier lifetime', unit: 's', def: 1.5e-6, min: 1e-9, max: 1e-3, log: true },
    { key: 'ct', label: 'Total capacitance', unit: 'F', def: 0.4e-12, min: 0, max: 1e-9 },
    { key: 'model', label: 'Model', type: 'select', def: 'custom', options: [['custom', 'Custom']], hidden: true },
  ];
  static description = 'PIN diode: the wide intrinsic layer stores charge Q = I·τ, so at RF (period ≪ τ) it does not rectify but acts as a resistor set by the DC bias current: R ≈ R(1 mA)·(1 mA / I)^0.87 — from kΩ at zero bias to about 1 Ω at 10 mA. Used as RF switch and attenuator.';
  internalNodeCount() { return 1; }
  connectivity() { return null; }
  constructor(x, y) { super(x, y); this.cap = new CapState(); }
  onParamChange() { this.j?.set(1e-12, 1.8, 0); this.p.is = 1e-12; this.p.n = 1.8; this.p.bv = 0; }
  reset() { super.reset(); this.qs = 0; this.cap.reset(0); this.rI = this.p.rmax; }
  rNow() {
    const ib = this.qs / this.p.tau;
    if (!(ib > 0)) return this.p.rmax;
    return Math.min(this.p.rmax, Math.max(this.p.rmin, this.p.r1m * Math.pow(1e-3 / ib, 0.87)));
  }
  stamp(s) { this.cap.stamp(s, this.nodes[0], this.nodes[1], this.p.ct); }
  stampStep(s) { this.cap.step(s, this.nodes[0], this.nodes[1], this.p.ct); }
  stampNL(s) {
    const [a, k] = this.nodes, x = this.inodes[0];
    const v = this.j.limit(s, s.v(a) - s.v(x));
    const { i, g } = diodeIV(v, 1e-12, 1.8, 0);
    s.addG(a, x, g); s.addI(a, x, i - g * v);
    s.addG(x, k, 1 / this.rI);
    this.gd = g;
  }
  accept(s) {
    const [a, k] = this.nodes, x = this.inodes[0], v = s.v(a) - s.v(x);
    const { i, g } = diodeIV(v, 1e-12, 1.8, 0);
    this.j.vd = v; this.gd = g;
    this.cap.accept(s, a, k, this.p.ct);
    if (s.mode === 'dc') this.qs = Math.max(0, i) * this.p.tau;
    else this.qs = Math.max(0, this.qs + (i - this.qs / this.p.tau) * s.dt);
    const r = this.rNow();
    if (Math.abs(r - this.rI) > 1e-3 * this.rI) { this.rI = r; s.dirty = true; }
    this.setCurrent(i + this.cap.i);
  }
  stampAC(ac) {
    const [a, k] = this.nodes, x = this.inodes[0];
    // at RF the stored charge cannot follow: the junction is a short, the I-layer a resistor
    ac.addY(a, x, Math.max(this.gd || 0, 1 / this.rI) + 1e-9);
    ac.addY(x, k, 1 / this.rI);
    ac.addY(a, k, 0, ac.omega * this.p.ct);
  }
  valueLabel() { return 'PIN'; }
  readings(s) { return [['Bias current', (this.qs || 0) / this.p.tau, 'A'], ['RF resistance', this.rI || this.p.rmax, 'Ω'], ['Voltage', this.voltageDiff(s), 'V'], ['Current', this.i, 'A']]; }
  draw(g) {
    this.drawDiodeBody(g);
    g.text('PIN', 0, -0.95 * G, { size: 6, color: g.muted, bold: true, follow: true });
  }
}
register(PINDiode);

// ---------------------------------------------------------------- Gunn diode
export class GunnDiode extends Element {
  static type = 'gunn'; static title = 'Gunn Diode'; static category = 'Diodes';
  static prefix = 'D'; static keywords = 'gunn diode transferred electron device negative resistance microwave oscillator gaas';
  static props = [
    { key: 'vth', label: 'Threshold voltage', unit: 'V', def: 3.4, min: 0.1, max: 100, knob: true },
    { key: 'r0', label: 'Low-field resistance', unit: 'Ω', def: 10, min: 0.01, max: 1e5, log: true },
    { key: 'isat', label: 'Valley (saturated) current', unit: 'A', def: 0.15, min: 1e-6, max: 100, log: true },
  ];
  static description = 'Transferred-electron (Gunn) device: ohmic at low voltage, but above the threshold electrons move to a slower valley, so the current falls as the voltage rises — a negative differential resistance that makes microwave oscillators. I = (V/R0 + Isat·(V/Vth)⁴) / (1 + (V/Vth)⁴).';
  nonlinear = true;
  constructor(x, y) { super(x, y); this.postCurrents = [0, 0]; this.vd = 0; }
  localPosts() { return [[-2 * G, 0], [2 * G, 0]]; }
  localBox() { return [-2 * G, -0.8 * G, 2 * G, 0.8 * G]; }
  leads() { return [[0, -2 * G, 0, -0.6 * G, 0], [1, 2 * G, 0, 0.6 * G, 0]]; }
  reset() { this.vd = 0; this.postCurrents.fill(0); this.gd = 1 / this.p.r0; }
  iv(v) {
    const { vth, r0, isat } = this.p, a = Math.abs(v), x = a / vth, x3 = x * x * x, x4 = x3 * x;
    const N = a / r0 + isat * x4, D = 1 + x4, dN = 1 / r0 + (4 * isat * x3) / vth, dD = (4 * x3) / vth;
    return { i: Math.sign(v) * (N / D), g: (dN * D - N * dD) / (D * D) + 1e-9 };
  }
  stampNL(s) {
    const [a, b] = this.nodes;
    let v = s.v(a) - s.v(b);
    const step = 0.3 * this.p.vth;
    if (Math.abs(v - this.vd) > step) { v = this.vd + Math.sign(v - this.vd) * step; s.limited = true; }
    this.vd = v;
    const { i, g } = this.iv(v);
    s.addG(a, b, g); s.addI(a, b, i - g * v);
  }
  accept(s) { const v = s.v(this.nodes[0]) - s.v(this.nodes[1]); this.vd = v; const r = this.iv(v); this.gd = r.g; this.postCurrents = [r.i, -r.i]; this.i = r.i; }
  stampAC(ac) { ac.addY(this.nodes[0], this.nodes[1], this.gd ?? 1 / this.p.r0); }
  valueLabel() { return 'Gunn'; }
  readings(s) { const v = s.v(this.nodes[0]) - s.v(this.nodes[1]); return [['Voltage', v, 'V'], ['Current', this.i, 'A'], ['Differential resistance', 1 / (this.gd || 1e-12), 'Ω'], ['Region', Math.abs(v) > this.p.vth ? 'Negative resistance' : 'Ohmic', '']]; }
  draw(g) {
    const c0 = g.vc(g.pv(0)), c1 = g.vc(g.pv(1)), h = 0.5 * G;
    g.poly([[-0.6 * G, -h], [0, 0], [-0.6 * G, h]], { stroke: c0, width: g.lw, fill: g.fill, close: true });
    g.poly([[0.6 * G, -h], [0, 0], [0.6 * G, h]], { stroke: c1, width: g.lw, fill: g.fill, close: true });
  }
}
register(GunnDiode);

export class ImpattDiode extends Diode {
  static type = 'impatt'; static title = 'IMPATT Diode'; static category = 'Diodes';
  static keywords = 'impatt diode avalanche transit time microwave oscillator';
  static props = [
    { key: 'bv', label: 'Avalanche voltage', unit: 'V', def: 90, min: 5, max: 1000, knob: true },
    { key: 'is', label: 'Saturation current Is', unit: 'A', def: 1e-12, min: 1e-20, max: 1e-3, log: true },
    { key: 'n', label: 'Emission coefficient n', unit: '', def: 1.2, min: 0.5, max: 5 },
    { key: 'model', label: 'Model', type: 'select', def: 'custom', options: [['custom', 'Custom']], hidden: true },
  ];
  static description = 'IMPATT diode, run in reverse avalanche breakdown from a current-limited supply (static model: the reverse avalanche knee at the rated voltage). The microwave negative resistance comes from the avalanche and transit-time delay (≈ half a period at tens of GHz), far above what a circuit time step resolves.';
  valueLabel() { return fmtShort(this.p.bv, 'V'); }
  draw(g) {
    this.drawDiodeBody(g);
    const c1 = g.vc(g.pv(1)), h = G * 0.5;
    g.poly([[G * 0.3, -h - 4], [G * 0.5, -h], [G * 0.5, h], [G * 0.7, h + 4]], { stroke: c1, width: g.lw * 1.2 });
    g.text('IMPATT', 0, -0.95 * G, { size: 5.5, color: g.muted, bold: true, follow: true });
  }
}
register(ImpattDiode);

// ------------------------------------------------------------------ GaN HEMT
export class HEMT extends NMOS {
  static type = 'hemt'; static title = 'GaN HEMT (e-mode)'; static category = 'Transistors';
  static keywords = 'gan hemt high electron mobility transistor epc2045 gallium nitride fet fast switch';
  static props = [
    { key: 'model', label: 'Model', type: 'select', def: 'custom', options: [['custom', 'Custom']], hidden: true },
    { key: 'vt', label: 'Threshold Vth', unit: 'V', def: 1.6, min: -20, max: 10, knob: true },
    { key: 'kp', label: 'Transconductance k', unit: 'A/V²', def: 30, min: 1e-4, max: 1e4, log: true },
    { key: 'lambda', label: 'Channel-length modulation λ', unit: '1/V', def: 0.005, min: 0, max: 1 },
    { key: 'cgs', label: 'Gate-source capacitance', unit: 'F', def: 0.6e-9, min: 0, max: 1e-6 },
    { key: 'cgd', label: 'Gate-drain capacitance', unit: 'F', def: 8e-12, min: 0, max: 1e-6 },
    { key: 'bodyDiode', label: 'Body diode', type: 'bool', def: false, hidden: true },
  ];
  static description = 'Enhancement-mode gallium-nitride HEMT (EPC2045-like): a 2-D electron gas channel gives very low on-resistance (≈7 mΩ) with tiny gate charge, so it switches in nanoseconds. No body diode: in reverse it conducts through the channel once V(gate−drain) exceeds Vth (≈2 V drop). Gate limited to about 6 V. Terminals G (left), D (top), S (bottom).';
  valueLabel() { return 'GaN'; }
  draw(g) { super.draw(g); g.text('GaN', -1.05 * G, -0.75 * G, { size: 6, color: g.muted, bold: true, follow: true }); }
}
register(HEMT);

// ---------------------------------------------------------- thyristor family
export class SIDAC extends DIAC {
  static type = 'sidac'; static title = 'SIDAC'; static category = 'Thyristors & Power';
  static keywords = 'sidac k1200 bidirectional breakover high voltage trigger igniter fence charger';
  static props = [
    { key: 'vbo', label: 'Break-over voltage', unit: 'V', def: 120, min: 20, max: 400, knob: true },
    { key: 'dv', label: 'Snap-back ΔV', unit: 'V', def: 118.9, min: 1, max: 400 },
    { key: 'ron', label: 'On resistance', unit: 'Ω', def: 0.1, min: 0.001, max: 100, log: true },
    { key: 'ih', label: 'Holding current', unit: 'A', def: 0.05, min: 1e-4, max: 5, log: true },
  ];
  static description = 'SIDAC: a high-current DIAC. It blocks until |V| reaches the break-over voltage (≈120 V), then snaps to about 1 V and conducts amperes until the current drops below the holding current — used in igniters, fence chargers and surge protectors.';
}
register(SIDAC);

export class SCS extends SCR {
  static type = 'scs'; static title = 'SCS (Silicon Controlled Switch)';
  static keywords = 'scs silicon controlled switch anode gate cathode gate 4 terminal thyristor bs08';
  static props = [...SCR.props, { key: 'boff', label: 'Gate turn-off gain', unit: '', def: 2, min: 0.5, max: 20 }];
  static description = 'Four-terminal thyristor with both gates brought out: a positive current into the cathode gate GK (or out of the anode gate GA) turns it on; a negative GK current of at least I_anode / turn-off gain turns it off again. Terminals A (left), K (right), GK (bottom), GA (top).';
  localPosts() { return [[-2 * G, 0], [2 * G, 0], [G, 2 * G], [-G, -2 * G]]; }
  localBox() { return [-2 * G, -2 * G, 2 * G, 2 * G]; }
  leads() { return [[0, -2 * G, 0, -0.5 * G, 0], [1, 2 * G, 0, 0.5 * G, 0], [2, G, 2 * G, G, G], [3, -G, -2 * G, -G, -G]]; }
  pinNames() { return ['A', 'K', 'GK', 'GA']; }
  constructor(x, y) { super(x, y); this.ja = new Junction(1e-14, 1); this.postCurrents = [0, 0, 0, 0]; }
  reset() { super.reset(); this.ja.vd = 0; this.iga = 0; this.postCurrents = [0, 0, 0, 0]; }
  stampNL(s) {
    super.stampNL(s);
    const a = this.nodes[0], ga = this.nodes[3];
    let v = s.v(a) - s.v(ga);
    v = v >= 0 ? this.ja.limit(s, v) : v;
    const d = diodeIV(v, 1e-14, 1, 0), i = d.i + v / 1000, g = d.g + 1e-3;
    s.addG(a, ga, g); s.addI(a, ga, i - g * v);
  }
  accept(s) {
    const a = this.nodes[0], ga = this.nodes[3], v = s.v(a) - s.v(ga);
    this.ja.vd = Math.max(v, 0);
    this.iga = diodeIV(v, 1e-14, 1, 0).i + v / 1000;
    super.accept(s);
    const [ia, ik, ig] = this.postCurrents;
    this.postCurrents = [ia + this.iga, ik, ig, -this.iga];
  }
  update(s, v, ia, ig) {
    if (this.on && ig < 0 && -ig > Math.abs(ia) / this.p.boff) { this.on = false; this.mark(s); return; }
    if (!this.on && (this.iga || 0) > this.p.igt && v > 0.5) { this.on = true; this.mark(s); return; }
    super.update(s, v, ia, ig);
  }
  draw(g) { super.draw(g); g.poly([[-0.45 * G, -0.25 * G], [-G, -G]], { stroke: g.vc(g.pv(3)), width: g.lw * 0.9 }); }
}
register(SCS);

export class LASCR extends SCR {
  static type = 'lascr'; static title = 'LASCR (Light-Activated SCR)';
  static keywords = 'lascr light activated scr photo thyristor optical trigger hvdc';
  static props = [
    { key: 'light', label: 'Light on the gate window', unit: '%', def: 0, min: 0, max: 100, knob: true },
    { key: 'iph', label: 'Photo gate current at 100 %', unit: 'A', def: 0.02, min: 1e-6, max: 1, log: true },
    ...SCR.props.map((p) => ({ ...p, knob: false })),
  ];
  static description = 'Light-activated SCR: light falling on the gate region generates a photocurrent that acts as gate current, so it can be fired without an electrical gate connection (optical triggering in HVDC valves and opto-SCRs). Turn the light knob above the trigger level while it is forward biased; it then latches like an SCR.';
  update(s, v, ia, ig) { super.update(s, v, ia, ig + (this.p.light / 100) * this.p.iph); }
  valueLabel() { return `${Math.round(this.p.light)}% light`; }
  draw(g) {
    super.draw(g);
    const c = this.p.light > 0 ? '#facc15' : g.muted;
    for (const dx of [-0.35 * G, 0.1 * G]) {
      g.line(dx - 0.45 * G, -1.25 * G, dx, -0.7 * G, c, g.lw * 0.8);
      g.poly([[dx - 4, -0.85 * G], [dx, -0.7 * G], [dx - 0.15 * G, -0.95 * G + 6]], { fill: c });
    }
  }
}
register(LASCR);

export class IGCT extends GTO {
  static type = 'igct'; static title = 'IGCT'; static keywords = 'igct integrated gate commutated thyristor medium voltage drive hard driven';
  static props = [...GTO.props.filter((p) => p.key !== 'boff').map((p) => ({ ...p, def: { igt: 0.5, ih: 1, vbo: 4500 }[p.key] ?? p.def })), { key: 'boff', label: 'Turn-off gain', unit: '', def: 1, min: 0.5, max: 5 }];
  static description = 'Integrated gate-commutated thyristor: a GTO with a very low-inductance gate drive that pulls the entire anode current out of the gate (turn-off gain ≈ 1), so it turns off fast and uniformly like a transistor while conducting with thyristor losses. Used in multi-MW medium-voltage drives.';
}
register(IGCT);

// ----------------------------------------------------- power modules (IGBT)
export class IGBTModule extends withChip(Composite) {
  static type = 'igbtmod'; static title = 'IGBT Half-Bridge Module'; static category = 'Thyristors & Power';
  static prefix = 'Q'; static keywords = 'igbt module half bridge power module 2 in 1 semikron infineon inverter leg freewheeling diode';
  static props = [
    { key: 'vt', label: 'Gate threshold', unit: 'V', def: 5.5, min: 0.5, max: 15, knob: true },
    { key: 'kp', label: 'MOS transconductance', unit: 'A/V²', def: 20, min: 1e-3, max: 1e4, log: true },
  ];
  static pins = [['G1', 'L'], ['G2', 'L'], ['P', 'R'], ['AC', 'R'], ['N', 'R']];
  static description = 'Two IGBTs with anti-parallel freewheeling diodes in one package — one inverter leg. Upper switch P→AC is driven by G1 relative to AC (needs an isolated or bootstrap gate driver), lower switch AC→N by G2 relative to N. Never turn both on together (shoot-through).';
  parts() {
    const d1 = new DiodeQ(0, 0), d2 = new DiodeQ(0, 0);
    return [[new IGBT(0, 0), [0, 2, 3]], [new IGBT(0, 0), [1, 3, 4]], [d1, [3, 2]], [d2, [4, 3]]];
  }
  sync() {
    if (!this.subs) return;
    const [q1, q2, d1, d2] = this.subs.map((s) => s.el);
    for (const q of [q1, q2]) { q.p.vt = this.p.vt; q.p.kp = this.p.kp; q.p.bf = 2; q.onParamChange(); }
    for (const d of [d1, d2]) { Object.assign(d.p, DQ_PRESETS.MUR860, { model: 'custom' }); d.onParamChange(); }
  }
  valueLabel() { return ''; }
  readings(s) {
    const [g1, g2, P, AC, N] = this.nodes;
    return [['Vge upper', s.v(g1) - s.v(AC), 'V'], ['Vge lower', s.v(g2) - s.v(N), 'V'], ['V(AC)', s.v(AC) - s.v(N), 'V'], ['I(P)', this.postCurrents[2], 'A'], ['I(AC out)', -this.postCurrents[3], 'A']];
  }
  draw(g) { this.drawChip(g, 'IGBT ×2'); }
}
register(IGBTModule);

/**
 * Intelligent power module (one leg): logic inputs HIN / LIN with shoot-through
 * interlock and dead time, built-in drivers, anti-parallel diodes and
 * over-current protection that latches both switches off and pulls FO low.
 */
export class IPM extends withChip(Element) {
  static type = 'ipm'; static title = 'Intelligent Power Module (half-bridge)'; static category = 'Thyristors & Power';
  static prefix = 'U'; static keywords = 'ipm intelligent power module gate driver protection dead time fault output inverter leg';
  static props = [
    { key: 'ron', label: 'Switch on-resistance', unit: 'Ω', def: 0.05, min: 1e-4, max: 10, log: true },
    { key: 'ioc', label: 'Over-current trip', unit: 'A', def: 20, min: 0.01, max: 1e4, log: true, knob: true },
    { key: 'td', label: 'Dead time', unit: 's', def: 1e-6, min: 0, max: 1e-3 },
    { key: 'vth', label: 'Logic threshold', unit: 'V', def: 2.5, min: 0.5, max: 15 },
  ];
  static pins = [['HIN', 'L'], ['LIN', 'L'], ['FO', 'L'], ['P', 'R'], ['AC', 'R'], ['N', 'R']];
  static description = 'Half-bridge IPM: drive HIN/LIN with logic signals (relative to N). Built-in interlock (both high → both off), dead time, freewheeling diodes and over-current protection: above the trip current both switches latch off and the open-drain FO (fault) pin pulls low until both inputs go low.';
  nonlinear = true;
  constructor(x, y) { super(x, y); this.postCurrents = new Array(6).fill(0); this.jh = new Junction(1e-9, 1.8); this.jl = new Junction(1e-9, 1.8); }
  connectivity() { return null; }
  reset() { this.hi = false; this.lo = false; this.inH = false; this.inL = false; this.tH = 0; this.tL = 0; this.fault = false; this.postCurrents.fill(0); this.jh.vd = 0; this.jl.vd = 0; }
  gsw(on) { return on ? 1 / Math.max(this.p.ron, 1e-4) : 1e-9; }
  stamp(s) {
    const [hin, lin, fo, P, AC, N] = this.nodes;
    s.addG(P, AC, this.gsw(this.hi)); s.addG(AC, N, this.gsw(this.lo));
    s.addG(hin, N, 1e-5); s.addG(lin, N, 1e-5); // input pull-downs (100 kΩ)
    s.addG(fo, N, this.fault ? 1 / 50 : 1e-9);
  }
  stampNL(s) {
    const [, , , P, AC, N] = this.nodes;
    // freewheeling diodes: AC → P and N → AC
    let v1 = this.jh.limit(s, s.v(AC) - s.v(P)); let d = diodeIV(v1, 1e-9, 1.8, 0);
    s.addG(AC, P, d.g); s.addI(AC, P, d.i - d.g * v1);
    let v2 = this.jl.limit(s, s.v(N) - s.v(AC)); d = diodeIV(v2, 1e-9, 1.8, 0);
    s.addG(N, AC, d.g); s.addI(N, AC, d.i - d.g * v2);
  }
  preStep(s) {
    const [hin, lin, , , , N] = this.nodes, th = this.p.vth;
    const h = s.v(hin) - s.v(N), l = s.v(lin) - s.v(N);
    this.inH = this.inH ? h > th * 0.8 : h > th * 1.2;
    this.inL = this.inL ? l > th * 0.8 : l > th * 1.2;
    const t = s.mode === 'dc' ? 0 : s.tNext;
    if (this.fault && !this.inH && !this.inL) this.fault = false;
    const wantH = this.inH && !this.inL && !this.fault, wantL = this.inL && !this.inH && !this.fault;
    if (!wantH) this.tH = t; if (!wantL) this.tL = t;
    const td = s.mode === 'dc' ? 0 : this.p.td;
    const hi = wantH && t - this.tH >= td, lo = wantL && t - this.tL >= td;
    if (hi !== this.hi || lo !== this.lo) { this.hi = hi; this.lo = lo; s.dirty = true; s.event = true; }
  }
  accept(s) {
    const [hin, lin, fo, P, AC, N] = this.nodes;
    const ih = (s.v(P) - s.v(AC)) * this.gsw(this.hi) - diodeIV(s.v(AC) - s.v(P), 1e-9, 1.8, 0).i;
    const il = (s.v(AC) - s.v(N)) * this.gsw(this.lo) - diodeIV(s.v(N) - s.v(AC), 1e-9, 1.8, 0).i;
    this.jh.vd = s.v(AC) - s.v(P); this.jl.vd = s.v(N) - s.v(AC);
    const ifo = (s.v(fo) - s.v(N)) * (this.fault ? 1 / 50 : 1e-9), iin = (s.v(hin) - s.v(N)) * 1e-5, iln = (s.v(lin) - s.v(N)) * 1e-5;
    this.postCurrents = [iin, iln, ifo, ih, il - ih, -il - iin - iln - ifo];
    this.ih = ih; this.il = il; this.i = ih;
    if (s.mode !== 'dc' && !this.fault && ((this.hi && Math.abs(ih) > this.p.ioc) || (this.lo && Math.abs(il) > this.p.ioc))) {
      this.fault = true; this.hi = false; this.lo = false; s.markEvent();
    }
  }
  stampAC(ac) {
    const [, , fo, P, AC, N] = this.nodes;
    ac.addY(P, AC, this.gsw(this.hi)); ac.addY(AC, N, this.gsw(this.lo)); ac.addY(fo, N, this.fault ? 1 / 50 : 1e-9);
    ac.addY(this.nodes[0], N, 1e-5); ac.addY(this.nodes[1], N, 1e-5);
  }
  valueLabel() { return this.fault ? 'FAULT' : ''; }
  readings(s) {
    const [, , , P, AC, N] = this.nodes;
    return [['State', this.fault ? 'FAULT — over-current, both off' : this.hi ? 'Upper ON' : this.lo ? 'Lower ON' : 'Both off', ''], ['V(AC)', s.v(AC) - s.v(N), 'V'], ['I upper (P→AC)', this.ih || 0, 'A'], ['I lower (AC→N)', this.il || 0, 'A']];
  }
  draw(g) {
    this.drawChip(g, 'IPM');
    if (this.fault) g.glow(0, 0, 1.4 * G, '255,70,70', 0.45);
    if (g.running) { const { bw, top } = this.geom(); g.circle(bw - 0.4 * G, top + 0.4 * G, 3, { fill: this.fault ? '#ef4444' : this.hi || this.lo ? g.hi : g.lo }); }
  }
}
register(IPM);
