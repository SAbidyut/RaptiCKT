// More passive parts: Kelvin (4-terminal) shunt / current-sense resistor,
// fusible resistor, and capacitor families (MLCC ceramic, film, polyester,
// polypropylene, mica) built on the capacitor model with ESR, ESL and leakage.

import { Element, TwoTerm, register, GRID } from './base.js';
import { RealCap } from './passive2.js';
import { fmtShort } from '../engine/units.js';

const G = GRID;

function zigzag(g, x1, x2, h, stroke) {
  const pts = [[x1, 0]], n = 6, w = (x2 - x1) / n;
  for (let k = 0; k < n; k++) pts.push([x1 + w * (k + 0.5), k % 2 ? h : -h]);
  pts.push([x2, 0]);
  g.poly(pts, { stroke, width: g.lw, join: 'round' });
}

// ----------------------------------------------------- Kelvin shunt resistor
export class ShuntResistor extends Element {
  static type = 'shuntr'; static title = 'Shunt / Current-Sense Resistor'; static category = 'Passive';
  static prefix = 'RS'; static keywords = 'shunt resistor current sense resistor kelvin 4 terminal milliohm ammeter shunt';
  static props = [
    { key: 'r', label: 'Shunt resistance', unit: 'Ω', def: 0.01, min: 1e-6, max: 100, log: true, knob: true },
    { key: 'rlead', label: 'Force lead / contact resistance (each)', unit: 'Ω', def: 0.002, min: 0, max: 1 },
    { key: 'pmax', label: 'Power rating', unit: 'W', def: 3, min: 0.01, max: 1e4, log: true },
  ];
  static description = 'Four-terminal (Kelvin) shunt: the load current flows I+ → I−, the voltage is read between the sense terminals S+ and S−. The sense taps sit on the resistive element itself, so contact and lead resistance in the current path does not add to the reading: I = V(S+,S−) / R.';
  constructor(x, y) { super(x, y); this.postCurrents = [0, 0, 0, 0]; }
  // posts: I+, I−, S+, S−
  localPosts() { return [[-2 * G, 0], [2 * G, 0], [-G, -2 * G], [G, -2 * G]]; }
  localBox() { return [-2 * G, -2 * G, 2 * G, 0.7 * G]; }
  leads() { return [[0, -2 * G, 0, -G, 0], [1, 2 * G, 0, G, 0], [2, -G, -2 * G, -0.75 * G, -0.45 * G], [3, G, -2 * G, 0.75 * G, -0.45 * G]]; }
  pinNames() { return ['I+', 'I−', 'S+', 'S−']; }
  internalNodeCount() { return 2; }
  connectivity() { return null; }
  rl() { return Math.max(this.p.rlead, 1e-6); }
  stamp(s) {
    const [ip, im, sp, sm] = this.nodes, [a, b] = this.inodes;
    s.addG(ip, a, 1 / this.rl()); s.addG(a, b, 1 / Math.max(this.p.r, 1e-9)); s.addG(b, im, 1 / this.rl());
    s.addG(sp, a, 1e3); s.addG(sm, b, 1e3);
  }
  stampAC(ac) {
    const [ip, im, sp, sm] = this.nodes, [a, b] = this.inodes;
    ac.addY(ip, a, 1 / this.rl()); ac.addY(a, b, 1 / Math.max(this.p.r, 1e-9)); ac.addY(b, im, 1 / this.rl());
    ac.addY(sp, a, 1e3); ac.addY(sm, b, 1e3);
  }
  accept(s) {
    const [ip, im, sp, sm] = this.nodes, [a, b] = this.inodes;
    const i = (s.v(a) - s.v(b)) / Math.max(this.p.r, 1e-9), isp = (s.v(sp) - s.v(a)) * 1e3, ism = (s.v(sm) - s.v(b)) * 1e3;
    const iin = (s.v(ip) - s.v(a)) / this.rl();
    this.postCurrents = [iin, -(iin + isp + ism), isp, ism];
    this.i = i; this.pw = i * i * this.p.r;
  }
  valueLabel() { return fmtShort(this.p.r, 'Ω'); }
  readings(s) {
    const [ip, im, sp, sm] = this.nodes, vs = s.v(sp) - s.v(sm), vf = s.v(ip) - s.v(im);
    const r = [['Current (I+ → I−)', this.i || 0, 'A'], ['Sense voltage S+−S−', vs, 'V'], ['Current from sense (V/R)', vs / this.p.r, 'A'],
      ['Voltage across I+−I−', vf, 'V'], ['Error if read at I+/I−', Math.abs(vs) > 1e-12 ? (vf / vs - 1) * 100 : 0, '%'], ['Dissipation', this.pw || 0, 'W']];
    if ((this.pw || 0) > this.p.pmax) r.unshift(['Warning', 'OVERLOAD — above power rating', '']);
    return r;
  }
  draw(g) {
    const over = g.running && (this.pw || 0) > this.p.pmax;
    if (over) g.glow(0, 0, 1.3 * G, '255,60,40', 0.5);
    g.box(-G, -0.42 * G, G, 0.42 * G, { stroke: g.grad(-G, 0, G, 0, g.pv(0), g.pv(1)), width: g.lw, fill: g.fill, r: 2 });
    g.line(-0.75 * G, -0.42 * G, -0.75 * G, -0.45 * G, g.vc(g.pv(2)), g.lw);
    g.line(0.75 * G, -0.42 * G, 0.75 * G, -0.45 * G, g.vc(g.pv(3)), g.lw);
    g.text('S+', -1.35 * G, -1.2 * G, { size: 6.5, color: g.muted });
    g.text('S−', 1.35 * G, -1.2 * G, { size: 6.5, color: g.muted });
    g.upright(() => g.text('SHUNT', 0, 0, { size: 6, color: g.muted, bold: true }));
  }
}
register(ShuntResistor);

// ---------------------------------------------------------- fusible resistor
export class FusibleResistor extends TwoTerm {
  static type = 'fusibler'; static title = 'Fusible Resistor'; static category = 'Passive';
  static prefix = 'R'; static keywords = 'fusible resistor fuse resistor flameproof surge limiting open on overload';
  static props = [
    { key: 'r', label: 'Resistance', unit: 'Ω', def: 10, min: 0.01, max: 1e6, log: true, knob: true },
    { key: 'pmax', label: 'Power rating', unit: 'W', def: 0.5, min: 0.01, max: 100, log: true },
    { key: 'kfuse', label: 'Fuses at (× rating)', unit: '', def: 10, min: 2, max: 100 },
    { key: 'tau', label: 'Thermal time constant', unit: 's', def: 0.5, min: 1e-3, max: 100, log: true },
  ];
  static description = 'Resistor that also acts as a fuse: it works as a normal resistor up to its rating, but if the dissipation stays far above it (default 10×) it burns open safely instead of catching fire. Tap a blown one to replace it.';
  interactive = true;
  reset() { this.heat = 0; this.setCurrent(0); }
  get blown() { return !!this.damaged; }
  R() { return this.blown ? 1e9 : Math.max(this.p.r, 1e-6); }
  stamp(s) { s.addG(this.nodes[0], this.nodes[1], 1 / this.R()); }
  stampAC(ac) { ac.addY(this.nodes[0], this.nodes[1], 1 / this.R()); }
  accept(s) {
    const v = this.voltageDiff(s), i = v / this.R();
    this.setCurrent(i);
    if (s.mode === 'dc' || this.blown) return;
    const p = v * i;
    this.heat += (p - this.heat) * Math.min(1, s.dt / this.p.tau);
    if (this.heat > this.p.kfuse * this.p.pmax) this.setDamage(s, `Fused open — ${fmtShort(this.heat, 'W')} in a ${fmtShort(this.p.pmax, 'W')} fusible resistor (it opens at ${this.p.kfuse} × its rating)`, true);
  }
  onTap(s) { if (!this.blown) return false; this.replace(s); return true; }
  valueLabel() { return fmtShort(this.p.r, 'Ω'); }
  readings(s) {
    const v = this.voltageDiff(s);
    return [['State', this.blown ? 'BLOWN (open) — tap to replace' : 'OK', ''], ['Voltage', v, 'V'], ['Current', this.i, 'A'], ['Average dissipation', this.heat || 0, 'W']];
  }
  draw(g) {
    const hot = g.running ? Math.min(1, (this.heat || 0) / (this.p.kfuse * this.p.pmax)) : 0;
    if (hot > 0.2 && !this.blown) g.glow(0, 0, 1.2 * G, '255,120,40', hot * 0.6);
    g.box(-G, -0.36 * G, G, 0.36 * G, { stroke: g.grad(-G, 0, G, 0, g.pv(0), g.pv(1)), width: g.lw, fill: g.fill, r: 2 });
    if (this.blown) {
      g.line(-0.35 * G, -0.25 * G, 0.35 * G, 0.25 * G, '#ef4444', g.lw * 1.2);
      g.line(-0.35 * G, 0.25 * G, 0.35 * G, -0.25 * G, '#ef4444', g.lw * 1.2);
    } else g.line(-G, 0, G, 0, g.muted, g.lw * 0.6);
  }
}
register(FusibleResistor);

// ---------------------------------------------------------- capacitor types
function capType(type, title, d, glyph, keywords, desc) {
  const C = class extends RealCap {};
  Object.assign(C, { type, title, keywords, description: desc, glyph });
  C.props = [
    ...RealCap.props.map((p) => ({ ...p, def: d[p.key] ?? p.def })),
    { key: 'vr', label: 'Voltage rating', unit: 'V', def: d.vr, min: 1, max: 1e5, log: true },
  ];
  C.prototype.readings = function (s) {
    const r = RealCap.prototype.readings.call(this, s);
    if (Math.abs(s.v(this.nodes[0]) - s.v(this.nodes[1])) > this.p.vr) r.unshift(['Warning', 'OVERVOLTAGE — above voltage rating', '']);
    return r;
  };
  C.prototype.draw = function (g) {
    g.line(-0.22 * G, -0.7 * G, -0.22 * G, 0.7 * G, g.vc(g.pv(0)), g.lw * 1.4);
    g.line(0.22 * G, -0.7 * G, 0.22 * G, 0.7 * G, g.vc(g.pv(1)), g.lw * 1.4);
    g.upright(() => g.text(this.constructor.glyph, 0, 0, { size: 6, color: g.muted, bold: true }), 0, -1.05 * G);
  };
  register(C);
  return C;
}

capType('ceramiccap', 'Ceramic Capacitor (MLCC)', { c: 100e-9, esr: 0.01, esl: 0.5e-9, rleak: 1e10, vr: 50 }, 'MLCC',
  'ceramic capacitor mlcc x7r c0g np0 decoupling 100nf 104',
  'Multilayer ceramic capacitor: very low ESR (≈10 mΩ) and ESL (≈0.5 nH), so it is the best decoupling capacitor at high frequency. X7R/Y5V types lose capacitance with DC bias; C0G/NP0 types are stable.');
capType('filmcap', 'Film Capacitor', { c: 1e-6, esr: 0.005, esl: 10e-9, rleak: 5e10, vr: 250 }, 'FILM',
  'film capacitor metallised film snubber dc link motor run',
  'Metallised-film capacitor: low loss, self-healing, high voltage and very low leakage — used for snubbers, DC links, motor-run and audio coupling.');
capType('polyestercap', 'Polyester (PET) Capacitor', { c: 100e-9, esr: 0.03, esl: 5e-9, rleak: 1e10, vr: 100 }, 'PET',
  'polyester capacitor pet mylar greencap coupling timing',
  'Polyester (PET, “Mylar”) film capacitor: small and cheap, good for general coupling, bypass and timing; a little more loss (tan δ ≈ 0.5 %) than polypropylene.');
capType('ppcap', 'Polypropylene (PP) Capacitor', { c: 470e-9, esr: 0.003, esl: 8e-9, rleak: 1e11, vr: 400 }, 'PP',
  'polypropylene capacitor mkp pp x2 class x snubber resonant low loss',
  'Polypropylene film capacitor (MKP): the lowest dielectric loss (tan δ ≈ 0.02 %) — used in resonant converters, snubbers, X2 mains filters and precision timing.');
capType('micacap', 'Silver-Mica Capacitor', { c: 100e-12, esr: 0.05, esl: 1e-9, rleak: 1e12, vr: 500 }, 'MICA',
  'mica capacitor silver mica rf oscillator stable high q pf',
  'Silver-mica capacitor: picofarad values with excellent stability and very high Q — used in RF oscillators and filters.');
