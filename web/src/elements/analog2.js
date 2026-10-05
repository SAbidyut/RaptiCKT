// More analog ICs: instrumentation amplifier (INA128), OTA (LM13700),
// audio power amp (LM386), analog multiplier (AD633), analog switch (CD4066),
// sample & hold (LF398), VCO, shunt regulator (TL431), precision reference
// (LM4040), negative regulator (79xx), LDO regulator and true-RMS converter.

import { Element, register, GRID } from './base.js';
import { VBlock } from './blocks.js';
import { Regulator } from './analog.js';
import { Zener, diodeIV } from './semis.js';
import { withChip } from './kit.js';
import { fmtShort } from '../engine/units.js';

const G = GRID;
const clamp = (y, lo, hi) => (y > hi ? { y: hi, s: 0 } : y < lo ? { y: lo, s: 0 } : { y, s: 1 });
const smin = (a, b, w) => { const d = a - b, r = Math.sqrt(d * d + w * w); return { y: (a + b - r) / 2, da: (1 - d / r) / 2, db: (1 + d / r) / 2 }; };

/** VBlock drawn as an IC with named pins (the last pin is the output). */
class ChipBlock extends withChip(VBlock) {
  static category = 'Analog ICs';
  static prefix = 'U';
  nIn() { return this.constructor.pins.length - 1; }
  outPost() { return this.constructor.pins.length - 1; }
  draw(g) { this.drawChip(g, this.constructor.chip || ''); }
}

const RAILS = [
  { key: 'vpos', label: 'Positive supply', unit: 'V', def: 15, min: -1000, max: 1000 },
  { key: 'vneg', label: 'Negative supply', unit: 'V', def: -15, min: -1000, max: 1000 },
];

export class InstAmp extends ChipBlock {
  static type = 'instamp'; static title = 'Instrumentation Amp (INA128)'; static chip = 'INA128';
  static keywords = 'instrumentation amplifier ina128 ad620 differential amplifier bridge sensor strain gauge';
  static pins = [['IN−', 'L'], ['IN+', 'L'], ['REF', 'L'], ['OUT', 'R']];
  static props = [{ key: 'rg', label: 'Gain resistor RG', unit: 'Ω', def: 1000, min: 1, max: 1e9, log: true, knob: true }, ...RAILS];
  static description = 'Three-op-amp instrumentation amplifier: Vout = G·(V+ − V−) + Vref with G = 1 + 50 kΩ/RG. Infinite input impedance, output limited to the rails.';
  gain() { return 1 + 50e3 / this.p.rg; }
  eval(xs) { const Gn = this.gain(), c = clamp(Gn * (xs[1] - xs[0]) + xs[2], this.p.vneg + 0.1, this.p.vpos - 0.1); return { y: c.y, d: [-Gn * c.s, Gn * c.s, c.s] }; }
  valueLabel() { return `G=${+this.gain().toPrecision(4)}`; }
}
register(InstAmp);

export class OTA extends withChip(Element) {
  static type = 'ota'; static title = 'OTA (LM13700)'; static category = 'Analog ICs';
  static prefix = 'U'; static keywords = 'ota operational transconductance amplifier lm13700 ca3080 vca vcf';
  static props = [{ key: 'iabc', label: 'Bias current IABC', unit: 'A', def: 500e-6, min: 1e-9, max: 5e-3, log: true, knob: true }];
  static pins = [['IN−', 'L'], ['IN+', 'L'], ['OUT', 'R']];
  static description = 'Operational transconductance amplifier: current output Iout = IABC·tanh((V+ − V−)/2Vt), i.e. gm = IABC/(2Vt) for small signals — a voltage-controlled gain element.';
  nonlinear = true;
  constructor(x, y) { super(x, y); this.postCurrents = [0, 0, 0]; }
  connectivity() { return [[2, 'gnd'], [0, 1]]; }
  io(vd) { const x = vd / (2 * 0.02585), t = Math.tanh(x); return { i: this.p.iabc * t, g: (this.p.iabc * (1 - t * t)) / (2 * 0.02585) }; }
  stampNL(s) {
    const [n, p, o] = this.nodes, vd = s.v(p) - s.v(n), { i, g } = this.io(vd);
    // current i flows out of the OUT pin (from ground through the device into OUT)
    s.addNLCurrent(0, o, i, [[p, n, g, vd]]);
    this.gm = g;
  }
  stamp(s) { s.addG(this.nodes[2], 0, 1e-9); }
  accept(s) { const [n, p] = this.nodes, { i } = this.io(s.v(p) - s.v(n)); this.postCurrents = [0, 0, -i]; this.i = i; }
  stampAC(ac) { const [n, p, o] = this.nodes; ac.addVCCS(0, o, p, n, this.gm ?? this.io(0).g); ac.addY(o, 0, 1e-9); }
  valueLabel() { return `gm=${fmtShort(this.io(0).g, 'S')}`; }
  readings(s) { const [n, p] = this.nodes; return [['Vdiff', s.v(p) - s.v(n), 'V'], ['Output current', this.i, 'A'], ['gm (small signal)', this.io(0).g, 'S']]; }
  draw(g) { this.drawChip(g, 'OTA'); }
}
register(OTA);

export class LM386 extends ChipBlock {
  static type = 'lm386'; static title = 'Audio Amp (LM386)'; static chip = 'LM386';
  static keywords = 'lm386 audio power amplifier speaker amp low voltage';
  static pins = [['IN−', 'L'], ['IN+', 'L'], ['OUT', 'R']];
  static props = [
    { key: 'gain', label: 'Voltage gain', type: 'select', def: '20', options: [['20', '20 (26 dB)'], ['50', '50 (34 dB)'], ['200', '200 (46 dB)']] },
    { key: 'vs', label: 'Supply voltage', unit: 'V', def: 9, min: 4, max: 18, knob: true },
  ];
  static description = 'Low-voltage audio power amplifier: output biased at Vs/2, gain 20–200, clips ≈0.5 V from the rails, ≈0.5 Ω output. Couple the speaker through a capacitor (e.g. 220 µF).';
  rout() { return 0.5; }
  eval(xs) { const Gn = +this.p.gain, vs = this.p.vs, c = clamp(vs / 2 + Gn * (xs[1] - xs[0]), 0.5, vs - 0.5); return { y: c.y, d: [-Gn * c.s, Gn * c.s] }; }
  valueLabel() { return `A=${this.p.gain}`; }
}
register(LM386);

export class AD633 extends ChipBlock {
  static type = 'ad633'; static title = 'Analog Multiplier (AD633)'; static chip = 'AD633';
  static keywords = 'ad633 analog multiplier four quadrant modulator mixer squarer';
  static pins = [['X1', 'L'], ['X2', 'L'], ['Y1', 'L'], ['Y2', 'L'], ['Z', 'L'], ['W', 'R']];
  static chipOpts = { dense: true };
  static props = RAILS;
  static description = 'Four-quadrant multiplier: W = (X1 − X2)·(Y1 − Y2)/10 V + Z.';
  eval(xs) {
    const x = xs[0] - xs[1], y = xs[2] - xs[3], c = clamp((x * y) / 10 + xs[4], this.p.vneg + 2, this.p.vpos - 2), k = c.s;
    return { y: c.y, d: [(k * y) / 10, (-k * y) / 10, (k * x) / 10, (-k * x) / 10, k] };
  }
}
register(AD633);

export class AnalogSwitch extends withChip(Element) {
  static type = 'anaswitch'; static title = 'Analog Switch (CD4066)'; static category = 'Analog ICs';
  static prefix = 'U'; static keywords = 'analog switch cd4066 4066 bilateral switch transmission gate multiplexer';
  static props = [
    { key: 'ron', label: 'On resistance', unit: 'Ω', def: 125, min: 0.1, max: 1e5, log: true, knob: true },
    { key: 'vdd', label: 'Logic supply', unit: 'V', def: 5, min: 1, max: 20 },
  ];
  static pins = [['A', 'L'], ['CTRL', 'B'], ['B', 'R']];
  static description = 'Bilateral CMOS switch: A–B conduct (≈125 Ω) while CTRL is above VDD/2 (with hysteresis); otherwise open.';
  constructor(x, y) { super(x, y); this.postCurrents = [0, 0, 0]; this.on = false; }
  reset() { this.on = false; }
  evalOn(s) { const v = s.v(this.nodes[1]), th = this.p.vdd / 2, h = 0.05 * this.p.vdd; return this.on ? v > th - h : v > th + h; }
  preStep(s) { const n = this.evalOn(s); if (n !== this.on) { this.on = n; s.markEvent(); } }
  digitalSettle(s) { const n = this.evalOn(s); if (n !== this.on) { this.on = n; s.dirty = true; return true; } return false; }
  stamp(s) { s.addG(this.nodes[0], this.nodes[2], this.on ? 1 / this.p.ron : 1e-10); s.addG(this.nodes[1], 0, 1e-12); }
  stampAC(ac) { ac.addY(this.nodes[0], this.nodes[2], this.on ? 1 / this.p.ron : 1e-10); }
  accept(s) { const i = (s.v(this.nodes[0]) - s.v(this.nodes[2])) * (this.on ? 1 / this.p.ron : 1e-10); this.postCurrents = [i, 0, -i]; this.i = i; }
  valueLabel() { return ''; }
  readings(s) { return [['State', this.on ? 'Closed' : 'Open', ''], ['Current', this.i, 'A'], ['V(A–B)', s.v(this.nodes[0]) - s.v(this.nodes[2]), 'V']]; }
  draw(g) {
    this.drawChip(g, '4066');
    g.line(-0.6 * G, 0.25 * G, this.on ? 0.6 * G : 0.45 * G, this.on ? 0.25 * G : -0.15 * G, this.on ? g.hi : g.body, g.lw);
  }
}
register(AnalogSwitch);

export class SampleHold extends ChipBlock {
  static type = 'samplehold'; static title = 'Sample & Hold (LF398)'; static chip = 'S/H';
  static keywords = 'sample and hold lf398 track and hold adc front end';
  static pins = [['IN', 'L'], ['CTRL', 'L'], ['OUT', 'R']];
  static props = [{ key: 'vth', label: 'Control threshold', unit: 'V', def: 1.4, min: 0, max: 20, knob: true }];
  static description = 'Tracks the input while CTRL is high and holds the last value when CTRL goes low.';
  reset() { this.track = true; this.held = 0; }
  eval(xs, s) { if (s.mode === 'dc' || this.track) return { y: xs[0], d: [1, 0] }; return { y: this.held, d: [0, 0] }; }
  preStep(s) { const t = s.v(this.nodes[1]) > this.p.vth; if (t !== this.track) { this.track = t; s.event = true; } }
  post(xs) { if (this.track) this.held = xs[0]; }
  valueLabel() { return ''; }
}
register(SampleHold);

export class VCO extends ChipBlock {
  static type = 'vco'; static title = 'VCO (Voltage-Controlled Osc.)'; static chip = 'VCO';
  static keywords = 'vco voltage controlled oscillator 4046 566 fm modulator frequency';
  static pins = [['VIN', 'L'], ['OUT', 'R']];
  static props = [
    { key: 'f0', label: 'Centre frequency (Vin = 0)', unit: 'Hz', def: 1000, min: 0, max: 1e9, log: true, knob: true },
    { key: 'kv', label: 'Sensitivity', unit: 'Hz/V', def: 200, min: -1e9, max: 1e9 },
    { key: 'vhigh', label: 'Output high', unit: 'V', def: 5, min: -100, max: 100 },
    { key: 'shape', label: 'Output', type: 'select', def: 'square', options: [['square', 'Square'], ['sine', 'Sine'], ['triangle', 'Triangle']] },
  ];
  static description = 'Voltage-controlled oscillator: f = f0 + Kv·Vin (never negative). Square, sine or triangle output.';
  rout() { return 10; }
  reset() { this.ph = 0; this.lvl = false; }
  wave(ph) {
    const f = ph - Math.floor(ph), A = this.p.vhigh;
    if (this.p.shape === 'sine') return (A / 2) * (1 + Math.sin(2 * Math.PI * f));
    if (this.p.shape === 'triangle') return A * (f < 0.5 ? 2 * f : 2 - 2 * f);
    return f < 0.5 ? A : 0;
  }
  eval(xs, s) { return { y: s.mode === 'dc' ? this.wave(0) : this.wave(this.phNext ?? 0), d: [0] }; }
  preStep(s) {
    if (s.mode === 'dc') return;
    const f = Math.max(0, this.p.f0 + this.p.kv * s.v(this.nodes[0]));
    this.phNext = (this.ph || 0) + f * s.dt;
  }
  post(xs, s) {
    if (s.mode === 'dc') return;
    this.ph = this.phNext ?? this.ph;
    const lvl = this.ph - Math.floor(this.ph) < 0.5;
    if (this.p.shape === 'square' && lvl !== this.lvl) s.event = true;
    this.lvl = lvl;
    this.freq = Math.max(0, this.p.f0 + this.p.kv * xs[0]);
  }
  readings(s) { return [['Control voltage', s.v(this.nodes[0]), 'V'], ['Frequency', this.freq ?? this.p.f0, 'Hz'], ['Output', s.v(this.nodes[1]), 'V']]; }
  valueLabel() { return fmtShort(this.p.f0, 'Hz'); }
}
register(VCO);

export class TL431 extends Element {
  static type = 'tl431'; static title = 'Shunt Regulator (TL431)'; static category = 'Analog ICs';
  static prefix = 'U'; static keywords = 'tl431 adjustable shunt regulator programmable zener reference 2.5v';
  static props = [{ key: 'vref', label: 'Reference voltage', unit: 'V', def: 2.495, min: 1, max: 5, knob: true }];
  static description = 'Programmable shunt regulator: sinks cathode current until REF − A = 2.495 V (like an adjustable precision zener). Vka = 2.495·(1 + R1/R2) with a divider from K to REF. Terminals: REF (left), K (top), A (bottom).';
  nonlinear = true;
  constructor(x, y) { super(x, y); this.postCurrents = [0, 0, 0]; }
  localPosts() { return [[-2 * G, 0], [0, -2 * G], [0, 2 * G]]; }
  localBox() { return [-2 * G, -2 * G, 1.1 * G, 2 * G]; }
  leads() { return [[0, -2 * G, 0, -0.6 * G, 0], [1, 0, -2 * G, 0, -0.5 * G], [2, 0, 2 * G, 0, 0.5 * G]]; }
  labelSide() { return [1, 0]; }
  reset() { this.vr0 = 0; this.postCurrents.fill(0); }
  ik(vr, vka) {
    const gm = 20, w = 0.002, u = (vr - this.p.vref) / w;
    const sp = u > 30 ? u : Math.log1p(Math.exp(u)), sg = 1 / (1 + Math.exp(-u));
    const e = Math.exp(-Math.max(vka, 0) / 0.4), fk = vka > 0 ? 1 - e : 0, dfk = vka > 0 ? e / 0.4 : 0;
    const d = diodeIV(-vka, 1e-12, 1, 0); // reverse: anode → cathode diode
    return { i: gm * w * sp * fk - d.i + vka * 1e-9, dvr: gm * sg * fk, dvka: gm * w * sp * dfk + d.g + 1e-9 };
  }
  stampNL(s) {
    const [r, k, a] = this.nodes;
    let vr = s.v(r) - s.v(a);
    if (Math.abs(vr - this.vr0) > 0.2) { vr = this.vr0 + Math.sign(vr - this.vr0) * 0.2; s.limited = true; }
    this.vr0 = vr;
    const vka = Math.max(-0.9, Math.min(s.v(k) - s.v(a), 1e4));
    const m = this.ik(vr, vka);
    s.addNLCurrent(k, a, m.i, [[r, a, m.dvr, vr], [k, a, m.dvka, vka]]);
    s.addG(r, a, 1e-9);
  }
  accept(s) { const [r, k, a] = this.nodes, m = this.ik(s.v(r) - s.v(a), s.v(k) - s.v(a)); this.vr0 = s.v(r) - s.v(a); this.postCurrents = [0, m.i, -m.i]; this.i = m.i; }
  stampAC(ac) { const [r, k, a] = this.nodes; ac.addVCCS(k, a, r, a, 20); ac.addY(k, a, 1e-6); }
  valueLabel() { return 'TL431'; }
  readings(s) { const [r, k, a] = this.nodes; return [['V(REF–A)', s.v(r) - s.v(a), 'V'], ['V(K–A)', s.v(k) - s.v(a), 'V'], ['Cathode current', this.i, 'A']]; }
  draw(g) {
    const h = 0.5 * G;
    g.poly([[-h, 0.5 * G], [h, 0.5 * G], [0, -0.45 * G]], { stroke: g.body, width: g.lw, fill: g.fill, close: true });
    g.poly([[-h - 3, -0.3 * G], [-h, -0.5 * G], [h, -0.5 * G], [h + 3, -0.7 * G]], { stroke: g.vc(g.pv(1)), width: g.lw * 1.1 });
    g.line(-0.6 * G, 0, -0.25 * G, 0, g.vc(g.pv(0)), g.lw * 0.9);
  }
}
register(TL431);

export class LM4040 extends Zener {
  static type = 'lm4040'; static title = 'Precision Reference (LM4040)'; static category = 'Analog ICs';
  static keywords = 'lm4040 lm385 precision voltage reference shunt reference 2.5v 4.096';
  static props = [
    { key: 'bv', label: 'Reference voltage', unit: 'V', def: 2.5, min: 1, max: 10, knob: true },
    { key: 'is', label: 'Is', unit: 'A', def: 1e-14, min: 1e-20, max: 1e-3, log: true, hidden: true },
    { key: 'n', label: 'n', unit: '', def: 1, min: 0.5, max: 5, hidden: true },
    { key: 'model', label: 'Model', type: 'select', def: 'custom', options: [['custom', 'Custom']], hidden: true },
  ];
  static description = 'Two-terminal precision shunt reference (2.048/2.5/4.096/5 V): behaves like a very sharp Zener. Bias it with ≥ 60 µA through a resistor.';
}
register(LM4040);

export class Reg79 extends Regulator {
  static chipName = '79xx';
  static type = 'reg79'; static title = '79xx Negative Regulator';
  static keywords = 'regulator 7905 7912 negative voltage regulator split supply';
  static props = [
    { key: 'vout', label: 'Output voltage magnitude', unit: 'V', def: 5, min: 0.5, max: 60, knob: true },
    { key: 'vdo', label: 'Dropout voltage', unit: 'V', def: 2, min: 0.05, max: 5 },
    { key: 'ilim', label: 'Current limit', unit: 'A', def: 1.5, min: 1e-3, max: 20, log: true },
  ];
  static description = 'Negative fixed regulator (7905 family): OUT = −Vset relative to GND when IN is at least Vset + dropout below ground.';
  valueLabel() { return '−' + fmtShort(this.p.vout, 'V'); }
  stampNL(s) {
    const [inp, out, gnd] = this.nodes, k = this.branches[0];
    const u = s.v(gnd) - s.v(inp), io = -s.x[k];
    const over = Math.max(0, io - this.p.ilim), vs = (this.tsd ? 0 : this.p.vout) - over * 50;
    const m1 = smin(vs, u - this.p.vdo, 0.05), m2 = smin(-m1.y, 0.02, 0.02), y = -m2.y, dyu = m2.da * m1.db;
    const dio = over > 0 ? -50 * m2.da * m1.da : 0; // dy/d(io)
    // row: v_out − v_g + y(u, io) = 0 with u = v_g − v_in and io = −k
    s.addA(k, gnd - 1, -1 + dyu);
    s.addA(k, inp - 1, -dyu);
    s.addA(k, k, -dio);
    s.b[k] += -y + dyu * u + dio * io;
    this.dy = { dvin: dyu };
  }
  stampAC(ac) {
    const [inp, out, gnd] = this.nodes, k = this.branches[0], d = this.dy ? this.dy.dvin : 0;
    ac.addBranchKCL(inp, out, k); ac.addA(k, out - 1, 1); ac.addA(k, gnd - 1, -1 + d); ac.addA(k, inp - 1, -d);
  }
  readings(s) { const [inp, out, gnd] = this.nodes; return [['Vin', s.v(inp) - s.v(gnd), 'V'], ['Vout', s.v(out) - s.v(gnd), 'V'], ['Iout (into OUT)', -this.i, 'A']]; }
}
register(Reg79);

export class LDO extends Regulator {
  static chipName = 'LDO';
  static type = 'ldo'; static title = 'LDO Regulator';
  static keywords = 'ldo low dropout regulator 3.3v mcp1700 ams1117 ht7333 lp2950';
  static props = Regulator.props.map((p) => ({ ...p, def: { vout: 3.3, vdo: 0.25, ilim: 0.5 }[p.key] ?? p.def }));
  static description = 'Low-dropout linear regulator: holds Vout down to about 0.25 V of headroom (vs 2 V for a 78xx) — ideal for battery-powered 3.3 V circuits.';
}
register(LDO);

export class RMSConverter extends ChipBlock {
  static type = 'rms2dc'; static title = 'True-RMS Converter (AD736)'; static chip = 'RMS';
  static keywords = 'rms to dc converter ad736 ad637 true rms detector';
  static pins = [['IN', 'L'], ['OUT', 'R']];
  static props = [{ key: 'tau', label: 'Averaging time', unit: 's', def: 0.05, min: 1e-6, max: 100, log: true, knob: true }];
  static description = 'True-RMS to DC converter: OUT = √(mean(IN²)) with an averaging time constant.';
  reset() { this.m2 = 0; }
  eval() { return { y: Math.sqrt(Math.max(0, this.m2 || 0)), d: [0] }; }
  post(xs, s) { const x2 = xs[0] * xs[0]; if (s.mode === 'dc') this.m2 = x2; else this.m2 += (x2 - this.m2) * Math.min(1, s.dt / this.p.tau); }
  valueLabel() { return ''; }
}
register(RMSConverter);
