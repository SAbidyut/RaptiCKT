// More passive parts: rheostat, trimmer, variable capacitor / inductor,
// non-polar & tantalum electrolytics, supercapacitor, real capacitor
// (ESR/ESL/leakage), saturable iron-core inductor, ferrite bead, quartz
// crystal, lossless transmission line and HP memristor.

import { Element, TwoTerm, register, GRID } from './base.js';
import { Resistor, Potentiometer, Capacitor, ElectrolyticCap, Inductor } from './passive.js';
import { Composite } from './kit.js';
import { fmtShort } from '../engine/units.js';

const G = GRID;

function arrow(g, x1, y1, x2, y2) {
  g.line(x1, y1, x2, y2, g.accent, g.lw * 0.8);
  const a = Math.atan2(y2 - y1, x2 - x1), L = 6;
  g.poly([[x2, y2], [x2 - L * Math.cos(a - 0.45), y2 - L * Math.sin(a - 0.45)], [x2 - L * Math.cos(a + 0.45), y2 - L * Math.sin(a + 0.45)]], { fill: g.accent });
}

export class Rheostat extends Resistor {
  static type = 'rheostat'; static title = 'Rheostat (Variable Resistor)';
  static keywords = 'rheostat variable resistor adjustable resistance 2 terminal';
  static props = [
    { key: 'pos', label: 'Setting', unit: '%', def: 50, min: 0, max: 100, knob: true },
    { key: 'r', label: 'Maximum resistance', unit: 'Ω', def: 100, min: 1e-3, max: 1e9, log: true },
  ];
  static description = 'Two-terminal variable resistor: R = setting × Rmax. Adjust live with the knob (e.g. field rheostat, current limiting).';
  get R() { return Math.max(1e-4, (this.p.r * this.p.pos) / 100); }
  valueLabel() { return fmtShort(this.R, 'Ω'); }
  draw(g) { super.draw(g); arrow(g, -0.9 * G, 0.7 * G, 0.9 * G, -0.75 * G); }
}
register(Rheostat);

export class Trimpot extends Potentiometer {
  static type = 'trimpot'; static title = 'Trimmer Potentiometer';
  static keywords = 'trimmer trimpot preset calibration pot';
  static description = 'Preset (trimmer) potentiometer for calibration. Same model as a potentiometer.';
  draw(g) {
    const grad = g.grad(-G, 0, G, 0, g.pv(0), g.pv(1));
    g.box(-G, -0.3 * G, G, 0.3 * G, { stroke: grad, width: g.lw });
    const wx = -G + 2 * G * this.frac();
    g.line(0, -G * 0.9, 0, -G * 0.62, g.vc(g.pv(2)), g.lw * 0.8);
    g.line(wx, -G * 0.62, wx, -G * 0.32, g.vc(g.pv(2)), g.lw * 0.8);
    g.line(0, -G * 0.62, wx, -G * 0.62, g.vc(g.pv(2)), g.lw * 0.8);
    g.line(wx - 5, -G * 0.32, wx + 5, -G * 0.32, g.vc(g.pv(2)), g.lw);
  }
}
register(Trimpot);

export class VariableCap extends Capacitor {
  static type = 'varcap'; static title = 'Variable Capacitor';
  static keywords = 'variable capacitor gang tuning trimmer cap radio';
  static props = [
    { key: 'pos', label: 'Setting', unit: '%', def: 50, min: 0, max: 100, knob: true },
    { key: 'cmin', label: 'Minimum capacitance', unit: 'F', def: 10e-12, min: 1e-15, max: 1, log: true },
    { key: 'cmax', label: 'Maximum capacitance', unit: 'F', def: 365e-12, min: 1e-15, max: 1, log: true },
    { key: 'ic', label: 'Initial voltage', unit: 'V', def: 0, min: -1e3, max: 1e3, hidden: true },
  ];
  static description = 'Tuning capacitor: C varies from Cmin to Cmax with the setting (e.g. 10–365 pF radio gang).';
  constructor(x, y) { super(x, y); this.sync(); }
  sync() { this.p.c = this.p.cmin + ((this.p.cmax - this.p.cmin) * this.p.pos) / 100; }
  onParamChange() { this.sync(); }
  reset() { this.sync(); super.reset(); }
  valueLabel() { this.sync(); return fmtShort(this.p.c, 'F'); }
  draw(g) { super.draw(g); arrow(g, -0.7 * G, 0.75 * G, 0.7 * G, -0.8 * G); }
}
register(VariableCap);

export class NonPolarCap extends Capacitor {
  static type = 'npecap'; static title = 'Non-Polar Electrolytic';
  static keywords = 'non polar bipolar electrolytic capacitor np motor run fan capacitor crossover';
  static props = Capacitor.props.map((p) => ({ ...p, def: p.key === 'c' ? 2.5e-6 : p.def }));
  static description = 'Bipolar (non-polarised) electrolytic / motor-run capacitor: can see AC. Typical fan capacitor 2.5 µF.';
  draw(g) {
    const c0 = g.vc(g.pv(0)), c1 = g.vc(g.pv(1)), h = 0.7 * G, ctx = g.ctx;
    for (const [sx, c] of [[-1, c0], [1, c1]]) {
      ctx.beginPath(); ctx.arc(sx * 1.17 * G, 0, 0.95 * G, sx < 0 ? -0.8 : Math.PI - 0.8, sx < 0 ? 0.8 : Math.PI + 0.8);
      ctx.strokeStyle = c; ctx.lineWidth = g.lw * 1.4; ctx.stroke();
    }
    g.upright(() => g.text('NP', 0, 0, { size: 6.5, color: g.muted, bold: true }), 0, -h - 0.3 * G);
  }
}
register(NonPolarCap);

export class TantalumCap extends ElectrolyticCap {
  static type = 'tantalum'; static title = 'Tantalum Capacitor';
  static keywords = 'tantalum capacitor polarized smd decoupling';
  static props = ElectrolyticCap.props.map((p) => ({ ...p, def: { c: 10e-6, vmax: 16 }[p.key] ?? p.def }));
  static description = 'Polarised tantalum capacitor: small, low ESR. Flashes red if reverse biased or over-voltage — and if kept there it fails SHORT (and may catch fire), as real tantalums do.';
  static failShort = true;
  draw(g) { super.draw(g); g.upright(() => g.text('Ta', 0, 0, { size: 6.5, color: g.muted, bold: true }), 0.7 * G, -0.9 * G); }
}
register(TantalumCap);

export class Supercap extends Composite {
  static type = 'supercap'; static title = 'Supercapacitor';
  static category = 'Passive'; static prefix = 'C';
  static keywords = 'supercapacitor ultracapacitor edlc gold cap energy storage farad';
  static props = [
    { key: 'c', label: 'Capacitance', unit: 'F', def: 1, min: 1e-3, max: 1e4, log: true, knob: true },
    { key: 'esr', label: 'ESR', unit: 'Ω', def: 0.05, min: 1e-5, max: 100, log: true },
    { key: 'rleak', label: 'Leakage resistance', unit: 'Ω', def: 1e5, min: 10, max: 1e9, log: true },
    { key: 'vmax', label: 'Rated voltage', unit: 'V', def: 2.7, min: 0.5, max: 100 },
  ];
  static description = 'Electric double-layer capacitor: large C with series ESR and self-discharge (leakage) resistance. Charged well above its rated voltage (or reversed) the electrolyte breaks down and it vents open.';
  ownInternal() { return 1; }
  parts() { return [[new Resistor(0, 0), [0, 'i0']], [new Capacitor(0, 0), ['i0', 1]], [new Resistor(0, 0), ['i0', 1]]]; }
  sync() { if (!this.subs) return; const [r, c, l] = this.subs.map((s) => s.el); r.p.r = this.damaged ? 1e9 : this.p.esr; c.p.c = this.p.c; l.p.r = this.p.rleak; }
  accept(s) {
    super.accept(s);
    if (s.mode === 'dc' || this.damaged) return;
    const v = s.v(this.nodes[0]) - s.v(this.nodes[1]), x = v > 0 ? (v / this.p.vmax) ** 2 : (1 - v / 0.5) ** 2;
    if (this.overheat(s, x, 2, 1.69, () => v < 0 ? `Vented — charged the wrong way round (${fmtShort(v, 'V')})` : `Vented — ${fmtShort(v, 'V')} on a ${fmtShort(this.p.vmax, 'V')} supercapacitor (over-voltage)`)) this.sync();
  }
  leads() { return [[0, -2 * G, 0, -G * 0.3, 0], [1, 2 * G, 0, G * 0.3, 0]]; }
  valueLabel() { return fmtShort(this.p.c, 'F'); }
  readings(s) { const v = s.v(this.nodes[0]) - s.v(this.nodes[1]); return [['Voltage', v, 'V'], ['Current', this.postCurrents[0], 'A'], ['Energy', 0.5 * this.p.c * s.v(this.inodes[0]) ** 2, 'J']]; }
  draw(g) {
    g.line(-0.3 * G, -0.7 * G, -0.3 * G, 0.7 * G, g.vc(g.pv(0)), g.lw * 1.4);
    g.line(-0.1 * G, -0.7 * G, -0.1 * G, 0.7 * G, g.vc(g.pv(0)), g.lw * 0.8);
    g.line(0.3 * G, -0.7 * G, 0.3 * G, 0.7 * G, g.vc(g.pv(1)), g.lw * 1.4);
    g.text('+', -0.8 * G, -0.62 * G, { size: 11, color: g.muted });
    const v = g.pv(0) - g.pv(1);
    if (g.running && (v < -0.3 || v > this.p.vmax)) g.glow(0, 0, G * 1.3, '255,60,60', 0.6);
  }
}
register(Supercap);

export class RealCap extends Composite {
  static type = 'realcap'; static title = 'Capacitor (ESR, ESL, leakage)';
  static category = 'Passive'; static prefix = 'C';
  static keywords = 'real capacitor esr esl parasitic self resonance leakage decoupling';
  static props = [
    { key: 'c', label: 'Capacitance', unit: 'F', def: 100e-9, min: 1e-15, max: 10, log: true, knob: true },
    { key: 'esr', label: 'ESR', unit: 'Ω', def: 0.05, min: 1e-6, max: 1e3, log: true },
    { key: 'esl', label: 'ESL', unit: 'H', def: 2e-9, min: 1e-12, max: 1e-3, log: true },
    { key: 'rleak', label: 'Leakage resistance', unit: 'Ω', def: 1e9, min: 1e3, max: 1e13, log: true },
  ];
  static description = 'Capacitor with parasitics: ESR and ESL in series, leakage in parallel. Above its self-resonant frequency f = 1/(2π√(ESL·C)) it behaves like an inductor — see it in a Bode plot.';
  ownInternal() { return 2; }
  parts() { return [[new Resistor(0, 0), [0, 'i0']], [new Inductor(0, 0), ['i0', 'i1']], [new Capacitor(0, 0), ['i1', 1]], [new Resistor(0, 0), [0, 1]]]; }
  sync() { if (!this.subs) return; const [r, l, c, lk] = this.subs.map((s) => s.el); r.p.r = this.p.esr; l.p.l = this.p.esl; c.p.c = this.p.c; lk.p.r = this.p.rleak; }
  leads() { return [[0, -2 * G, 0, -G * 0.22, 0], [1, 2 * G, 0, G * 0.22, 0]]; }
  valueLabel() { return fmtShort(this.p.c, 'F'); }
  readings(s) { return [['Voltage', s.v(this.nodes[0]) - s.v(this.nodes[1]), 'V'], ['Current', this.postCurrents[0], 'A'], ['Self-resonance', 1 / (2 * Math.PI * Math.sqrt(this.p.esl * this.p.c)), 'Hz']]; }
  draw(g) {
    g.line(-0.22 * G, -0.7 * G, -0.22 * G, 0.7 * G, g.vc(g.pv(0)), g.lw * 1.4);
    g.line(0.22 * G, -0.7 * G, 0.22 * G, 0.7 * G, g.vc(g.pv(1)), g.lw * 1.4);
    g.upright(() => g.text('ESR', 0, 0, { size: 6, color: g.muted, bold: true }), 0, -1.05 * G);
  }
  localBox() { return [-2 * G, -1.3 * G, 2 * G, 0.8 * G]; }
}
register(RealCap);

export class VariableInductor extends Inductor {
  static type = 'varind'; static title = 'Variable Inductor';
  static keywords = 'variable inductor adjustable coil slug tuned';
  static props = [
    { key: 'pos', label: 'Setting', unit: '%', def: 50, min: 0, max: 100, knob: true },
    { key: 'lmax', label: 'Maximum inductance', unit: 'H', def: 1e-3, min: 1e-12, max: 1e4, log: true },
    { key: 'rs', label: 'Series resistance', unit: 'Ω', def: 0, min: 0, max: 1e6 },
    { key: 'ic', label: 'Initial current', unit: 'A', def: 0, min: -1e3, max: 1e3, hidden: true },
  ];
  static description = 'Slug-tuned inductor: L = setting × Lmax (minimum 1 % of Lmax).';
  constructor(x, y) { super(x, y); this.sync(); }
  sync() { this.p.l = Math.max(0.01, this.p.pos / 100) * this.p.lmax; }
  onParamChange() { this.sync(); }
  reset() { this.sync(); super.reset(); }
  valueLabel() { this.sync(); return fmtShort(this.p.l, 'H'); }
  draw(g) { super.draw(g); arrow(g, -0.9 * G, 0.6 * G, 0.9 * G, -0.8 * G); }
}
register(VariableInductor);

export class IronCoreInductor extends TwoTerm {
  static type = 'coreind'; static title = 'Iron-Core Inductor (saturating)'; static category = 'Passive';
  static prefix = 'L'; static keywords = 'iron core inductor saturation nonlinear choke magnetic saturation bh curve';
  static props = [
    { key: 'l0', label: 'Unsaturated inductance', unit: 'H', def: 0.5, min: 1e-9, max: 1e4, log: true, knob: true },
    { key: 'isat', label: 'Saturation current', unit: 'A', def: 1, min: 1e-6, max: 1e4, log: true },
    { key: 'lsat', label: 'Saturated inductance', unit: 'H', def: 0.01, min: 1e-12, max: 1e4, log: true },
    { key: 'rs', label: 'Winding resistance', unit: 'Ω', def: 1, min: 1e-6, max: 1e4, log: true },
  ];
  static description = 'Nonlinear inductor: ψ(i) = Lsat·i + (L0 − Lsat)·Isat·tanh(i/Isat). Above Isat the core saturates and the current peaks sharply — see inrush and distorted magnetising current.';
  nonlinear = true;
  branchCount() { return 1; }
  psi(i) { const { l0, lsat, isat } = this.p; return lsat * i + (l0 - lsat) * isat * Math.tanh(i / isat); }
  ld(i) { const { l0, lsat, isat } = this.p, t = Math.tanh(i / isat); return lsat + (l0 - lsat) * (1 - t * t); }
  reset() { this.ip = 0; this.setCurrent(0); }
  stamp(s) {
    const k = this.branches[0], [a, b] = this.nodes;
    s.addBranchKCL(a, b, k); s.addA(k, a - 1, 1); s.addA(k, b - 1, -1); s.addA(k, k, -this.p.rs);
  }
  stampNL(s) {
    if (s.mode === 'dc') return;
    const k = this.branches[0], i0 = s.x[k], L = this.ld(i0);
    // v − R·i − (ψ(i) − ψ(i_prev))/dt = 0, linearised at i0 (backward Euler)
    s.addA(k, k, -L / s.dt);
    s.b[k] += (this.psi(i0) - L * i0 - this.psi(this.ip)) / s.dt;
  }
  accept(s) { this.ip = s.x[this.branches[0]]; this.setCurrent(this.ip); }
  stampAC(ac) {
    const k = this.branches[0], [a, b] = this.nodes;
    ac.addBranchKCL(a, b, k); ac.addA(k, a - 1, 1); ac.addA(k, b - 1, -1); ac.addA(k, k, -this.p.rs, -ac.omega * this.ld(this.ip || 0));
  }
  valueLabel() { return fmtShort(this.p.l0, 'H'); }
  readings(s) { return [['Current', this.i, 'A'], ['Incremental L', this.ld(this.i || 0), 'H'], ['Flux linkage', this.psi(this.i || 0), 'Wb'], ['Voltage', this.voltageDiff(s), 'V']]; }
  draw(g) {
    const grad = g.grad(-G, 0, G, 0, g.pv(0), g.pv(1)), ctx = g.ctx;
    ctx.beginPath();
    for (let k = 0; k < 4; k++) ctx.arc(-G + 0.5 * G * (k + 0.5), 0, 0.25 * G, Math.PI, 0);
    ctx.strokeStyle = grad; ctx.lineWidth = g.lw; ctx.stroke();
    const sat = g.running ? Math.min(1, Math.abs(this.i || 0) / (2 * this.p.isat)) : 0;
    g.line(-G, -0.5 * G, G, -0.5 * G, sat > 0.5 ? '#f87171' : g.body, g.lw * 0.8);
    g.line(-G, -0.7 * G, G, -0.7 * G, sat > 0.5 ? '#f87171' : g.body, g.lw * 0.8);
  }
}
register(IronCoreInductor);

export class FerriteBead extends Composite {
  static type = 'ferrite'; static title = 'Ferrite Bead';
  static category = 'Passive'; static prefix = 'FB';
  static keywords = 'ferrite bead emi filter noise suppression choke';
  static props = [
    { key: 'z', label: 'Impedance at 100 MHz', unit: 'Ω', def: 600, min: 1, max: 1e5, log: true, knob: true },
    { key: 'rdc', label: 'DC resistance', unit: 'Ω', def: 0.15, min: 1e-4, max: 100, log: true },
  ];
  static description = 'Ferrite bead: nearly a short at DC and low frequency, lossy (resistive) at high frequency — model Rdc + (L ∥ R).';
  ownInternal() { return 1; }
  parts() { return [[new Resistor(0, 0), [0, 'i0']], [new Inductor(0, 0), ['i0', 1]], [new Resistor(0, 0), ['i0', 1]]]; }
  sync() {
    if (!this.subs) return;
    const [r, l, rp] = this.subs.map((s) => s.el);
    r.p.r = this.p.rdc; rp.p.r = this.p.z; l.p.l = this.p.z / (2 * Math.PI * 30e6);
  }
  valueLabel() { return fmtShort(this.p.z, 'Ω'); }
  readings(s) { return [['Voltage', s.v(this.nodes[0]) - s.v(this.nodes[1]), 'V'], ['Current', this.postCurrents[0], 'A']]; }
  draw(g) {
    g.line(-G, 0, G, 0, g.grad(-G, 0, G, 0, g.pv(0), g.pv(1)), g.lw);
    g.box(-0.5 * G, -0.45 * G, 0.5 * G, 0.45 * G, { stroke: g.body, width: g.lw * 0.9, fill: 'rgba(80,80,90,0.6)', r: 3 });
  }
}
register(FerriteBead);

const XTAL = {
  '32.768 kHz': { f: 32768, rm: 30e3, cm: 3e-15, c0: 1.5e-12 },
  '4 MHz': { f: 4e6, rm: 40, cm: 10e-15, c0: 3e-12 },
  '8 MHz': { f: 8e6, rm: 20, cm: 15e-15, c0: 4e-12 },
  '16 MHz': { f: 16e6, rm: 15, cm: 20e-15, c0: 5e-12 },
};

export class Crystal extends Composite {
  static type = 'crystal'; static title = 'Quartz Crystal';
  static category = 'Passive'; static prefix = 'Y';
  static keywords = 'crystal quartz xtal resonator oscillator 32.768 khz 16 mhz clock';
  static props = [
    { key: 'model', label: 'Frequency', type: 'select', def: '4 MHz', options: Object.keys(XTAL).map((k) => [k, k]).concat([['custom', 'Custom']]), preset: XTAL },
    { key: 'f', label: 'Series resonance', unit: 'Hz', def: 4e6, min: 1, max: 1e9, log: true, knob: true },
    { key: 'rm', label: 'Motional resistance Rm', unit: 'Ω', def: 40, min: 1e-3, max: 1e6, log: true },
    { key: 'cm', label: 'Motional capacitance Cm', unit: 'F', def: 10e-15, min: 1e-18, max: 1e-9, log: true },
    { key: 'c0', label: 'Shunt capacitance C0', unit: 'F', def: 3e-12, min: 1e-15, max: 1e-9, log: true },
  ];
  static description = 'Butterworth–Van Dyke model: series Rm–Lm–Cm (Lm = 1/((2πf)²·Cm)) in parallel with C0. Extremely high Q; series and parallel resonances are visible in a Bode plot.';
  ownInternal() { return 2; }
  parts() { return [[new Resistor(0, 0), [0, 'i0']], [new Inductor(0, 0), ['i0', 'i1']], [new Capacitor(0, 0), ['i1', 1]], [new Capacitor(0, 0), [0, 1]]]; }
  sync() {
    if (!this.subs) return;
    const [r, l, cm, c0] = this.subs.map((s) => s.el), w = 2 * Math.PI * this.p.f;
    r.p.r = this.p.rm; l.p.l = 1 / (w * w * this.p.cm); cm.p.c = this.p.cm; c0.p.c = this.p.c0;
  }
  leads() { return [[0, -2 * G, 0, -0.45 * G, 0], [1, 2 * G, 0, 0.45 * G, 0]]; }
  valueLabel() { return fmtShort(this.p.f, 'Hz'); }
  readings(s) {
    const Lm = 1 / ((2 * Math.PI * this.p.f) ** 2 * this.p.cm);
    const fp = this.p.f * Math.sqrt(1 + this.p.cm / this.p.c0);
    return [['Series resonance', this.p.f, 'Hz'], ['Parallel resonance', fp, 'Hz'], ['Lm', Lm, 'H'], ['Q', (2 * Math.PI * this.p.f * Lm) / this.p.rm, ''], ['Voltage', s.v(this.nodes[0]) - s.v(this.nodes[1]), 'V']];
  }
  draw(g) {
    g.line(-0.45 * G, -0.6 * G, -0.45 * G, 0.6 * G, g.vc(g.pv(0)), g.lw * 1.2);
    g.line(0.45 * G, -0.6 * G, 0.45 * G, 0.6 * G, g.vc(g.pv(1)), g.lw * 1.2);
    g.box(-0.25 * G, -0.75 * G, 0.25 * G, 0.75 * G, { stroke: g.body, width: g.lw * 0.9, fill: g.fill });
  }
}
register(Crystal);

// --------------------------------------------------------- transmission line
export class TLine extends Element {
  static type = 'tline'; static title = 'Transmission Line (lossless)'; static category = 'Passive';
  static prefix = 'T'; static keywords = 'transmission line coax cable delay characteristic impedance z0 reflection stub';
  static props = [
    { key: 'z0', label: 'Characteristic impedance Z0', unit: 'Ω', def: 50, min: 1, max: 1e4, log: true, knob: true },
    { key: 'td', label: 'Delay Td', unit: 's', def: 1e-6, min: 1e-12, max: 1, log: true },
  ];
  static description = 'Ideal lossless line (Branin method of characteristics). Port 1 on the left, port 2 on the right, returns at the bottom. Mismatched terminations produce reflections after 2·Td.';
  constructor(x, y) { super(x, y); this.postCurrents = [0, 0, 0, 0]; }
  localPosts() { return [[-3 * G, -G], [-3 * G, G], [3 * G, -G], [3 * G, G]]; }
  localBox() { return [-3 * G, -1.4 * G, 3 * G, 1.4 * G]; }
  leads() { return this.localPosts().map(([x, y], i) => [i, x, y, Math.sign(x) * 2.2 * G, y]); }
  connectivity() { return [[0, 1], [2, 3]]; }
  reset() { this.h = []; this.e1 = 0; this.e2 = 0; this.postCurrents.fill(0); }
  hist(t) {
    // linear interpolation of the stored port history at time t
    const h = this.h;
    if (!h.length || t <= h[0][0]) return null;
    let lo = 0, hi = h.length - 1;
    if (t >= h[hi][0]) return h[hi];
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (h[m][0] <= t) lo = m; else hi = m; }
    const [t0, ...a] = h[lo], [t1, ...b] = h[hi], f = (t - t0) / (t1 - t0);
    return [t, ...a.map((v, k) => v + (b[k] - v) * f)];
  }
  stamp(s) { const g = 1 / this.p.z0, [a1, a2, b1, b2] = this.nodes; s.addG(a1, a2, g); s.addG(b1, b2, g); }
  stampStep(s) {
    const t = s.mode === 'dc' ? 0 : s.tNext;
    const r = s.mode === 'dc' ? null : this.hist(t - this.p.td);
    const z = this.p.z0;
    // E1 = v2(t−T) + Z0·i2(t−T), E2 = v1(t−T) + Z0·i1(t−T)
    this.e1 = r ? r[3] + z * r[4] : 0; this.e2 = r ? r[1] + z * r[2] : 0;
    const [a1, a2, b1, b2] = this.nodes;
    s.addI(a1, a2, -this.e1 / z); s.addI(b1, b2, -this.e2 / z);
  }
  accept(s) {
    const [a1, a2, b1, b2] = this.nodes, z = this.p.z0;
    const v1 = s.v(a1) - s.v(a2), v2 = s.v(b1) - s.v(b2);
    const i1 = (v1 - this.e1) / z, i2 = (v2 - this.e2) / z;
    if (s.mode !== 'dc') {
      this.h.push([s.t, v1, i1, v2, i2]);
      // keep a little more than one delay of history
      while (this.h.length > 2 && this.h[1][0] < s.t - this.p.td * 1.5) this.h.shift();
    }
    this.postCurrents = [i1, -i1, i2, -i2]; this.i = i1;
  }
  stampAC(ac) {
    // exact lossless-line two-port (Y-parameters) at ω
    const z = this.p.z0, th = ac.omega * this.p.td, [a1, a2, b1, b2] = this.nodes;
    const sn = Math.sin(th) || 1e-12, y11 = { re: 0, im: -Math.cos(th) / (z * sn) }, y12 = { re: 0, im: 1 / (z * sn) };
    const addYc = (p, q, r, t, y) => { ac.addA(p - 1, r - 1, y.re, y.im); ac.addA(p - 1, t - 1, -y.re, -y.im); ac.addA(q - 1, r - 1, -y.re, -y.im); ac.addA(q - 1, t - 1, y.re, y.im); };
    addYc(a1, a2, a1, a2, y11); addYc(b1, b2, b1, b2, y11); addYc(a1, a2, b1, b2, y12); addYc(b1, b2, a1, a2, y12);
  }
  valueLabel() { return `${fmtShort(this.p.z0, 'Ω')} ${fmtShort(this.p.td, 's')}`; }
  readings(s) {
    const [a1, a2, b1, b2] = this.nodes;
    return [['V port 1', s.v(a1) - s.v(a2), 'V'], ['I port 1', this.postCurrents[0], 'A'], ['V port 2', s.v(b1) - s.v(b2), 'V'], ['I port 2', this.postCurrents[2], 'A']];
  }
  draw(g) {
    const ctx = g.ctx;
    g.box(-2 * G, -0.45 * G, 2 * G, 0.45 * G, { stroke: g.body, width: g.lw * 0.9, fill: g.fill, r: 0.45 * G });
    ctx.beginPath(); ctx.ellipse(-2 * G + 0.2 * G, 0, 0.2 * G, 0.45 * G, 0, 0, 2 * Math.PI); ctx.strokeStyle = g.body; ctx.lineWidth = g.lw * 0.7; ctx.stroke();
    g.line(-2.2 * G, -G, -2 * G, -G, g.vc(g.pv(0)), g.lw); g.line(-2 * G, -G, -1.8 * G, 0, g.vc(g.pv(0)), g.lw * 0.8);
    g.line(2.2 * G, -G, 2 * G, -G, g.vc(g.pv(2)), g.lw); g.line(2 * G, -G, 1.8 * G, 0, g.vc(g.pv(2)), g.lw * 0.8);
    g.line(-2.2 * G, G, 2.2 * G, G, g.muted, g.lw * 0.6);
    g.upright(() => g.text('Z0', 0, 0, { size: 7, color: g.muted, bold: true }));
  }
}
register(TLine);

// --------------------------------------------------------------- memristor
export class Memristor extends TwoTerm {
  static type = 'memristor'; static title = 'Memristor (HP model)'; static category = 'Passive';
  static prefix = 'MR'; static keywords = 'memristor hp model memory resistor pinched hysteresis neuromorphic research';
  static props = [
    { key: 'ron', label: 'R_on', unit: 'Ω', def: 100, min: 1e-3, max: 1e9, log: true },
    { key: 'roff', label: 'R_off', unit: 'Ω', def: 16000, min: 1e-3, max: 1e12, log: true },
    { key: 'k', label: 'Mobility factor µv·Ron/D²', unit: '1/C', def: 1e4, min: 1, max: 1e10, log: true },
    { key: 'w0', label: 'Initial state w0', unit: '', def: 0.1, min: 0, max: 1, knob: true },
    { key: 'pw', label: 'Joglekar window exponent p', unit: '', def: 2, min: 1, max: 10 },
  ];
  static description = 'HP TiO₂ memristor (Strukov 2008) with a Joglekar window: R = Ron·w + Roff·(1 − w), dw/dt = k·i·(1 − (2w − 1)^(2p)). A sine drive gives the pinched I–V hysteresis loop.';
  reset() { this.w = this.p.w0; this.R = this.res(); this.setCurrent(0); }
  res() { return this.p.ron * this.w + this.p.roff * (1 - this.w); }
  stamp(s) { s.addG(this.nodes[0], this.nodes[1], 1 / (this.R || this.res?.() || this.p.roff)); }
  stampAC(ac) { ac.addY(this.nodes[0], this.nodes[1], 1 / (this.R || this.p.roff)); }
  accept(s) {
    const i = this.voltageDiff(s) / this.R;
    this.setCurrent(i);
    if (s.mode === 'dc') return;
    const f = 1 - Math.pow(2 * this.w - 1, 2 * this.p.pw);
    this.w = Math.min(1, Math.max(0, this.w + this.p.k * i * f * s.dt));
    const R = this.res();
    if (Math.abs(R - this.R) > 1e-3 * this.R) { this.R = R; s.dirty = true; }
  }
  valueLabel() { return `w=${(this.w ?? this.p.w0).toFixed(2)}`; }
  readings(s) { return [['State w', this.w ?? this.p.w0, ''], ['Memristance', this.R ?? this.res(), 'Ω'], ['Voltage', this.voltageDiff(s), 'V'], ['Current', this.i, 'A']]; }
  constructor(x, y) { super(x, y); this.w = this.p.w0; this.R = this.res(); }
  draw(g) {
    g.box(-G, -0.4 * G, G, 0.4 * G, { stroke: g.grad(-G, 0, G, 0, g.pv(0), g.pv(1)), width: g.lw, fill: g.fill });
    const w = this.w ?? this.p.w0;
    g.box(0.8 * G - 1.6 * G * w, -0.4 * G, 0.8 * G, 0.4 * G, { fill: 'rgba(34,211,238,0.35)' });
    g.box(0.8 * G, -0.4 * G, G, 0.4 * G, { fill: g.body });
    g.poly([[-0.8 * G, 0], [-0.5 * G, 0], [-0.5 * G, -0.2 * G], [-0.2 * G, -0.2 * G], [-0.2 * G, 0.2 * G], [0.1 * G, 0.2 * G], [0.1 * G, 0], [0.4 * G, 0]], { stroke: g.body, width: g.lw * 0.6 });
  }
}
register(Memristor);
