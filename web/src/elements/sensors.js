// Sensors. Each sensor exposes a physical "environment" quantity (light,
// temperature, force, field...) as its knob parameter so it can be changed
// live while the simulation runs.

import { Element, TwoTerm, register, GRID } from './base.js';
import { Capacitor } from './passive.js';
import { NPN, Junction, diodeIV } from './semis.js';
import { VT } from '../engine/sim.js';
import { fmtShort, fmtQty } from '../engine/units.js';

const G = GRID;

// ------------------------------------------------ resistive sensors (base)
export class ResSensor extends TwoTerm {
  static category = 'Sensors';
  static prefix = 'RS';
  get R() { return Math.min(1e12, Math.max(1e-3, this.resistance())); }
  resistance() { return 1000; }
  stamp(s) { s.addG(this.nodes[0], this.nodes[1], 1 / this.R); }
  stampAC(ac) { ac.addY(this.nodes[0], this.nodes[1], 1 / this.R); }
  accept(s) { this.setCurrent(this.voltageDiff(s) / this.R); }
  readings(s) {
    const k = this.knobProp();
    return [[k.label, this.p[k.key], k.unit], ['Resistance', this.R, 'Ω'], ['Voltage', this.voltageDiff(s), 'V'], ['Current', this.i, 'A']];
  }
  valueLabel() { const k = this.knobProp(); return fmtQty(this.p[k.key], k.unit); }
  spice(n) { return `R${this.name} ${n[0]} ${n[1]} ${this.R} ; ${this.constructor.title}`; }
  leads() { return [[0, -2 * G, 0, -G, 0], [1, 2 * G, 0, G, 0]]; }
  drawBody(g) {
    const grad = g.grad(-G, 0, G, 0, g.pv(0), g.pv(1));
    g.box(-G, -0.36 * G, G, 0.36 * G, { stroke: grad, width: g.lw, fill: g.fill, r: 2 });
  }
}

export class LDR extends ResSensor {
  static type = 'ldr'; static title = 'LDR (Photoresistor)'; static keywords = 'ldr photoresistor light sensor cds gl5528';
  static props = [
    { key: 'lux', label: 'Illuminance', unit: 'lx', def: 100, min: 0.01, max: 1e5, log: true, knob: true },
    { key: 'r10', label: 'Resistance at 10 lx', unit: 'Ω', def: 15000, min: 10, max: 1e7, log: true },
    { key: 'gamma', label: 'Gamma', unit: '', def: 0.7, min: 0.1, max: 2 },
    { key: 'rdark', label: 'Dark resistance', unit: 'Ω', def: 1e6, min: 1e3, max: 1e9, log: true },
  ];
  static description = 'Light-dependent resistor (CdS, e.g. GL5528): R = R10·(E/10 lx)^(−γ), limited by the dark resistance.';
  resistance() {
    const r = this.p.r10 * Math.pow(Math.max(this.p.lux, 1e-4) / 10, -this.p.gamma);
    return 1 / (1 / r + 1 / this.p.rdark);
  }
  localBox() { return [-2 * G, -1.5 * G, 2 * G, 1.2 * G]; }
  draw(g) {
    this.drawBody(g);
    g.circle(0, 0, 1.15 * G, { stroke: g.muted, width: g.lw * 0.5 });
    const k = Math.min(1, Math.log10(Math.max(this.p.lux, 1)) / 4);
    const col = `rgba(255,${200 + 55 * k},${80 + 100 * k},${0.4 + 0.6 * k})`;
    for (const dx of [-0.45 * G, 0.1 * G]) {
      g.line(dx - 0.5 * G, -1.4 * G, dx, -0.6 * G, col, g.lw * 0.7);
      g.poly([[dx, -0.55 * G], [dx - 0.28 * G, -0.72 * G], [dx - 0.05 * G, -0.9 * G]], { fill: col });
    }
  }
}
register(LDR);

export class NTC extends ResSensor {
  static type = 'ntc'; static title = 'NTC Thermistor'; static keywords = 'ntc thermistor temperature sensor';
  static props = [
    { key: 'temp', label: 'Temperature', unit: '°C', def: 25, min: -55, max: 300, knob: true },
    { key: 'r25', label: 'R at 25 °C', unit: 'Ω', def: 10000, min: 1, max: 1e8, log: true },
    { key: 'beta', label: 'β constant', unit: 'K', def: 3950, min: 100, max: 10000 },
  ];
  static description = 'NTC thermistor, β-model: R = R25·exp(β(1/T − 1/298.15 K)).';
  resistance() { return this.p.r25 * Math.exp(this.p.beta * (1 / (this.p.temp + 273.15) - 1 / 298.15)); }
  localBox() { return [-2 * G, -1.0 * G, 2 * G, 1.15 * G]; }
  draw(g) {
    this.drawBody(g);
    g.poly([[-1.2 * G, 0.8 * G], [-0.9 * G, 0.8 * G], [0.9 * G, -0.8 * G]], { stroke: g.accent, width: g.lw * 0.7 });
    g.text('−t°', 0.9 * G, 0.8 * G, { size: 8, color: g.muted });
  }
}
register(NTC);

export class RTD extends ResSensor {
  static type = 'pt100'; static title = 'RTD (Pt100)'; static keywords = 'rtd pt100 pt1000 platinum temperature sensor';
  static props = [
    { key: 'temp', label: 'Temperature', unit: '°C', def: 25, min: -200, max: 850, knob: true },
    { key: 'r0', label: 'R at 0 °C', unit: 'Ω', def: 100, min: 1, max: 1e5, log: true },
  ];
  static description = 'Platinum RTD, Callendar–Van Dusen (IEC 60751): R = R0(1 + A·T + B·T² [+ C(T−100)T³ for T<0]).';
  resistance() {
    const T = this.p.temp, A = 3.9083e-3, B = -5.775e-7, C = T < 0 ? -4.183e-12 : 0;
    return this.p.r0 * (1 + A * T + B * T * T + C * (T - 100) * T * T * T);
  }
  localBox() { return [-2 * G, -1.0 * G, 2 * G, 1.15 * G]; }
  draw(g) {
    this.drawBody(g);
    g.poly([[-1.2 * G, 0.8 * G], [-0.9 * G, 0.8 * G], [0.9 * G, -0.8 * G]], { stroke: g.accent, width: g.lw * 0.7 });
    g.text('+t°', 0.9 * G, 0.8 * G, { size: 8, color: g.muted });
  }
}
register(RTD);

export class StrainGauge extends ResSensor {
  static type = 'strain'; static title = 'Strain Gauge'; static keywords = 'strain gauge load cell wheatstone bridge';
  static props = [
    { key: 'strain', label: 'Strain', unit: 'µε', def: 0, min: -5000, max: 5000, knob: true },
    { key: 'r0', label: 'Nominal resistance', unit: 'Ω', def: 350, min: 1, max: 1e5, log: true },
    { key: 'gf', label: 'Gauge factor', unit: '', def: 2.0, min: 0.1, max: 200 },
  ];
  static description = 'Metal-foil strain gauge: R = R0(1 + GF·ε). Use four in a Wheatstone bridge for a load cell.';
  resistance() { return this.p.r0 * (1 + this.p.gf * this.p.strain * 1e-6); }
  draw(g) {
    const grad = g.grad(-G, 0, G, 0, g.pv(0), g.pv(1));
    const pts = [[-G, 0]];
    for (let k = 0; k < 5; k++) { const x = -0.8 * G + k * 0.4 * G; pts.push([x, -0.35 * G], [x + 0.2 * G, -0.35 * G], [x + 0.2 * G, 0.35 * G], [x + 0.4 * G, 0.35 * G]); }
    pts.push([G, 0]);
    g.poly(pts, { stroke: grad, width: g.lw * 0.7 });
  }
}
register(StrainGauge);

export class FSR extends ResSensor {
  static type = 'fsr'; static title = 'Force Sensor (FSR)'; static keywords = 'fsr force sensitive resistor pressure touch weight';
  static props = [
    { key: 'force', label: 'Force', unit: 'N', def: 1, min: 0, max: 100, knob: true },
    { key: 'r1n', label: 'R at 1 N', unit: 'Ω', def: 10000, min: 10, max: 1e7, log: true },
    { key: 'roff', label: 'No-load resistance', unit: 'Ω', def: 10e6, min: 1e4, max: 1e10, log: true },
  ];
  static description = 'Force-sensing resistor (FSR 402-like): R ≈ R1N / F (power-law), open-circuit when unloaded.';
  resistance() { const F = this.p.force; const r = F > 1e-6 ? this.p.r1n / Math.pow(F, 0.95) : this.p.roff; return 1 / (1 / r + 1 / this.p.roff); }
  localBox() { return [-2 * G, -1.5 * G, 2 * G, 0.75 * G]; }
  draw(g) {
    this.drawBody(g);
    g.line(0, -1.4 * G, 0, -0.55 * G, g.accent, g.lw * 0.8);
    g.poly([[0, -0.45 * G], [-5, -0.8 * G], [5, -0.8 * G]], { fill: g.accent });
    g.text('F', 0.45 * G, -1.2 * G, { size: 9, color: g.muted, bold: true });
  }
}
register(FSR);

export class FlexSensor extends ResSensor {
  static type = 'flex'; static title = 'Flex Sensor'; static keywords = 'flex bend sensor glove';
  static props = [
    { key: 'bend', label: 'Bend angle', unit: '°', def: 0, min: 0, max: 180, knob: true },
    { key: 'rflat', label: 'Flat resistance', unit: 'Ω', def: 25000, min: 100, max: 1e7, log: true },
    { key: 'r90', label: 'Resistance at 90°', unit: 'Ω', def: 100000, min: 100, max: 1e8, log: true },
  ];
  static description = 'Flex/bend sensor: resistance rises linearly with bend angle.';
  resistance() { return this.p.rflat + (this.p.r90 - this.p.rflat) * this.p.bend / 90; }
  draw(g) {
    const grad = g.grad(-G, 0, G, 0, g.pv(0), g.pv(1));
    const b = this.p.bend / 180;
    g.ctx.beginPath(); g.ctx.moveTo(-G, 0); g.ctx.quadraticCurveTo(0, -b * 1.4 * G, G, 0);
    g.ctx.strokeStyle = grad; g.ctx.lineWidth = g.lw * 2.2; g.ctx.stroke();
  }
}
register(FlexSensor);

export class GasSensor extends ResSensor {
  static type = 'gas'; static title = 'Gas Sensor (MQ)'; static keywords = 'gas sensor mq2 mq135 smoke lpg co2 air quality';
  static props = [
    { key: 'ppm', label: 'Gas concentration', unit: 'ppm', def: 100, min: 1, max: 1e5, log: true, knob: true },
    { key: 'r0', label: 'R0 (at 1000 ppm)', unit: 'Ω', def: 10000, min: 100, max: 1e7, log: true },
    { key: 'slope', label: 'Log slope', unit: '', def: 0.45, min: 0.05, max: 2 },
  ];
  static description = 'Metal-oxide gas sensor element (MQ-series, heater omitted): Rs = R0·(ppm/1000)^(−slope).';
  resistance() { return this.p.r0 * Math.pow(this.p.ppm / 1000, -this.p.slope); }
  localBox() { return [-2 * G, -1.45 * G, 2 * G, 0.75 * G]; }
  draw(g) {
    this.drawBody(g);
    const k = Math.min(1, Math.log10(this.p.ppm) / 5);
    for (let i = 0; i < 3; i++) g.circle(-0.5 * G + i * 0.5 * G, -0.9 * G - (i % 2) * 5, 2.5 + 2 * k, { fill: `rgba(180,200,210,${0.3 + 0.6 * k})` });
  }
}
register(GasSensor);

// ----------------------------------------------------- capacitive humidity
export class HumiditySensor extends Capacitor {
  static type = 'humidity'; static title = 'Humidity Sensor'; static category = 'Sensors';
  static prefix = 'CS'; static keywords = 'humidity rh capacitive sensor hs1101';
  static props = [
    { key: 'rh', label: 'Relative humidity', unit: '%RH', def: 55, min: 0, max: 100, knob: true },
    { key: 'c55', label: 'C at 55 %RH', unit: 'F', def: 180e-12, min: 1e-12, max: 1e-6, log: true },
    { key: 'sens', label: 'Sensitivity', unit: 'F/%RH', def: 0.31e-12, min: 0, max: 1e-8 },
    { key: 'ic', label: 'Initial voltage', unit: 'V', def: 0, hidden: true },
  ];
  static description = 'Capacitive humidity sensor (HS1101-like): C = C55 + S·(RH − 55 %). Use it as the timing capacitor of a 555 to get a frequency output.';
  onParamChange() { this.p.c = this.p.c55 + this.p.sens * (this.p.rh - 55); }
  constructor(x, y) { super(x, y); this.onParamChange(); }
  valueLabel() { return `${this.p.rh.toFixed(0)}%RH`; }
  readings(s) { return [['Humidity', this.p.rh, '%RH'], ['Capacitance', this.p.c, 'F'], ['Voltage', this.voltageDiff(s), 'V']]; }
  localBox() { return [-2 * G, -1.55 * G, 2 * G, 0.75 * G]; }
  draw(g) {
    super.draw(g);
    for (let i = 0; i < 3; i++) {
      const x = -0.6 * G + i * 0.6 * G, y = -1.2 * G;
      g.ctx.beginPath(); g.ctx.moveTo(x, y - 5); g.ctx.quadraticCurveTo(x + 4, y + 1, x, y + 3); g.ctx.quadraticCurveTo(x - 4, y + 1, x, y - 5);
      g.ctx.fillStyle = `rgba(90,180,255,${0.25 + this.p.rh / 140})`; g.ctx.fill();
    }
  }
}
register(HumiditySensor);

// --------------------------------------------------------- photodiode/solar
export class Photodiode extends TwoTerm {
  static type = 'photodiode'; static title = 'Photodiode'; static category = 'Sensors';
  static prefix = 'PD'; static keywords = 'photodiode light sensor ir bpw34 optical';
  static props = [
    { key: 'lux', label: 'Illuminance', unit: 'lx', def: 500, min: 0, max: 1e5, knob: true },
    { key: 'sens', label: 'Responsivity', unit: 'A/lx', def: 7e-8, min: 1e-12, max: 1e-3, log: true },
    { key: 'is', label: 'Dark saturation current', unit: 'A', def: 2e-12, min: 1e-18, max: 1e-6, log: true },
    { key: 'n', label: 'Emission coefficient', unit: '', def: 1.1, min: 0.5, max: 3 },
  ];
  static description = 'Photodiode: diode in parallel with a light-generated current flowing cathode→anode. Use reverse-biased (photoconductive) or with a transimpedance amplifier.';
  nonlinear = true;
  constructor(x, y) { super(x, y); this.j = new Junction(this.p.is, this.p.n); }
  onParamChange() { this.j?.set(this.p.is, this.p.n); }
  iph() { return this.p.sens * this.p.lux; }
  reset() { this.onParamChange(); this.j.vd = 0; this.setCurrent(0); this.gd = 0; }
  stampStep(s) { s.addI(this.nodes[1], this.nodes[0], this.iph() * (s.srcScale ?? 1)); }
  stampNL(s) {
    const [a, b] = this.nodes;
    const v = this.j.limit(s, s.v(a) - s.v(b));
    const { i, g } = diodeIV(v, this.p.is, this.p.n, 0);
    s.addG(a, b, g); s.addI(a, b, i - g * v);
    this.gd = g;
  }
  accept(s) {
    const v = this.voltageDiff(s);
    this.j.vd = v;
    const d = diodeIV(v, this.p.is, this.p.n, 0);
    this.gd = d.g;
    this.setCurrent(d.i - this.iph());
  }
  stampAC(ac) { ac.addY(this.nodes[0], this.nodes[1], this.gd + 1e-12); }
  valueLabel() { return fmtQty(this.p.lux, 'lx'); }
  readings(s) { return [['Light', this.p.lux, 'lx'], ['Photocurrent', this.iph(), 'A'], ['Voltage', this.voltageDiff(s), 'V'], ['Current (A→K)', this.i, 'A']]; }
  leads() { return [[0, -2 * G, 0, -G * 0.5, 0], [1, 2 * G, 0, G * 0.5, 0]]; }
  localBox() { return [-2 * G, -1.55 * G, 2 * G, 0.75 * G]; }
  draw(g) {
    const h = G * 0.5;
    g.poly([[-G * 0.5, -h], [G * 0.45, 0], [-G * 0.5, h]], { stroke: g.vc(g.pv(0)), width: g.lw, fill: g.fill, close: true });
    g.line(G * 0.5, -h, G * 0.5, h, g.vc(g.pv(1)), g.lw * 1.2);
    const k = Math.min(1, Math.log10(Math.max(this.p.lux, 1)) / 4.5);
    const col = `rgba(255,220,90,${0.35 + 0.65 * k})`;
    for (const dx of [-0.2 * G, 0.3 * G]) {
      g.line(dx - 0.45 * G, -1.45 * G, dx, -0.7 * G, col, g.lw * 0.7);
      g.poly([[dx, -0.62 * G], [dx - 0.26 * G, -0.78 * G], [dx - 0.04 * G, -0.95 * G]], { fill: col });
    }
  }
}
register(Photodiode);

export class SolarCell extends Photodiode {
  static type = 'solar'; static title = 'Solar Cell'; static category = 'Sensors';
  static prefix = 'PV'; static keywords = 'solar cell photovoltaic pv panel renewable';
  static props = [
    { key: 'irr', label: 'Irradiance', unit: 'W/m²', def: 1000, min: 0, max: 1500, knob: true },
    { key: 'isc', label: 'Isc @1000 W/m²', unit: 'A', def: 0.5, min: 1e-6, max: 20, log: true },
    { key: 'voc', label: 'Voc (per cell)', unit: 'V', def: 0.6, min: 0.1, max: 2 },
    { key: 'cells', label: 'Cells in series', unit: '', def: 1, min: 1, max: 200 },
    { key: 'n', label: 'Ideality factor', unit: '', def: 1.3, min: 0.5, max: 3, hidden: true },
  ];
  static description = 'Photovoltaic cell/panel (single-diode model): I = Iph − Is(e^(V/(N·n·Vt)) − 1). Connect a load and sweep it to trace the I–V curve.';
  onParamChange() {
    const N = Math.max(1, Math.round(this.p.cells));
    this.nEff = this.p.n * N;
    this.p.is = this.p.isc / (Math.exp((this.p.voc * N) / (this.nEff * VT)) - 1);
    if (this.j) this.j.set(this.p.is, this.nEff); else this.j = new Junction(this.p.is, this.nEff);
  }
  constructor(x, y) { super(x, y); this.onParamChange(); }
  iph() { return (this.p.isc * this.p.irr) / 1000; }
  stampNL(s) {
    const [a, b] = this.nodes;
    const v = this.j.limit(s, s.v(a) - s.v(b));
    const { i, g } = diodeIV(v, this.p.is, this.nEff, 0);
    s.addG(a, b, g); s.addI(a, b, i - g * v);
    this.gd = g;
  }
  accept(s) {
    const v = this.voltageDiff(s);
    this.j.vd = v;
    const d = diodeIV(v, this.p.is, this.nEff, 0);
    this.gd = d.g;
    this.setCurrent(d.i - this.iph());
  }
  valueLabel() { return `${this.p.irr.toFixed(0)} W/m²`; }
  readings(s) {
    const v = this.voltageDiff(s);
    return [['Irradiance', this.p.irr, 'W/m²'], ['Voltage', v, 'V'], ['Current out', -this.i, 'A'], ['Power out', -v * this.i, 'W']];
  }
  leads() { return [[0, -2 * G, 0, -G, 0], [1, 2 * G, 0, G, 0]]; }
  localBox() { return [-2 * G, -0.9 * G, 2 * G, 0.9 * G]; }
  draw(g) {
    const k = this.p.irr / 1000;
    g.box(-G, -0.75 * G, G, 0.75 * G, { stroke: g.body, width: g.lw * 0.9, fill: `rgba(40,80,170,${0.35 + 0.4 * k})`, r: 3 });
    for (let i = 1; i < 4; i++) g.line(-G + i * 0.5 * G, -0.75 * G, -G + i * 0.5 * G, 0.75 * G, 'rgba(255,255,255,0.25)', 1);
    g.line(-G, 0, G, 0, 'rgba(255,255,255,0.25)', 1);
    g.text('+', -1.3 * G, -0.6 * G, { size: 11, color: g.pos, bold: true });
    if (g.running && k > 0.05) g.glow(0, -G, G * 1.2, '255,220,100', 0.3 * k);
  }
}
register(SolarCell);

export class PhotoTransistor extends NPN {
  static type = 'phototransistor'; static title = 'Phototransistor'; static category = 'Sensors';
  static prefix = 'Q'; static keywords = 'phototransistor light sensor optocoupler ir receiver';
  static props = [
    { key: 'lux', label: 'Illuminance', unit: 'lx', def: 200, min: 0, max: 1e5, knob: true },
    { key: 'sens', label: 'Base photocurrent', unit: 'A/lx', def: 5e-9, min: 1e-13, max: 1e-5, log: true },
    ...NPN.props.slice(1).filter((p) => p.key !== 'cje' && p.key !== 'cjc').map((p) => (p.key === 'bf' ? { ...p, knob: false } : p)),
    { key: 'cje', label: 'B-E capacitance', unit: 'F', def: 0, hidden: true },
    { key: 'cjc', label: 'B-C capacitance', unit: 'F', def: 0, hidden: true },
    { key: 'model', label: 'Model', type: 'select', def: 'custom', options: [['custom', 'Custom']], hidden: true },
  ];
  static description = 'NPN phototransistor (collector top, emitter bottom). Light generates base current that is amplified by β.';
  localPosts() { return [[G, -2 * G], [G, 2 * G]]; }
  leads() { return [[0, G, -2 * G, G, -G * 0.95], [1, G, 2 * G, G, G * 0.95]]; }
  internalNodeCount() { return 1; }
  valueLabel() { return fmtQty(this.p.lux, 'lx'); }
  with(fn) {
    const n = this.nodes;
    this.nodes = [this.inodes[0], n[0], n[1]];
    try { return fn(); } finally { this.nodes = n; }
  }
  stamp(s) { this.with(() => super.stamp(s)); }
  stampStep(s) {
    this.with(() => super.stampStep(s));
    s.addI(this.nodes[0], this.inodes[0], this.p.sens * this.p.lux * (s.srcScale ?? 1));
  }
  stampNL(s) { this.with(() => super.stampNL(s)); }
  accept(s) {
    this.with(() => super.accept(s));
    const [ib, ic, ie] = this.postCurrents;
    const iph = this.p.sens * this.p.lux;
    this.postCurrents = [ic + iph, ie];
    this.i = ic + iph;
    this.ibase = ib;
  }
  reset(s) { super.reset(s); this.postCurrents = [0, 0]; }
  stampAC(ac) { this.with(() => super.stampAC(ac)); }
  readings(s) {
    const [c, e] = this.nodes;
    return [['Light', this.p.lux, 'lx'], ['Vce', s.v(c) - s.v(e), 'V'], ['Ic', this.i, 'A']];
  }
  spice() { return `* ${this.name}: phototransistor (not exported)`; }
  draw(g) {
    const pv = g.pv;
    g.pv = (i) => (i === 0 ? pv(1) : i === 1 ? pv(0) : pv(1));
    super.draw(g);
    g.pv = pv;
    const col = 'rgba(255,220,90,0.9)';
    for (const dy of [-0.5 * G, 0.1 * G]) {
      g.line(-1.8 * G, dy - 0.5 * G, -1.0 * G, dy, col, g.lw * 0.7);
      g.poly([[-0.95 * G, dy + 0.05 * G], [-1.25 * G, dy - 0.02 * G], [-1.1 * G, -0.2 * G + dy]], { fill: col });
    }
  }
}
register(PhotoTransistor);

// ---------------------------------------------------- active 3-pin sensors
export class ThreePinSensor extends Element {
  static category = 'Sensors';
  static prefix = 'U';
  constructor(x, y) { super(x, y); this.postCurrents = [0, 0, 0]; }
  // posts: VCC (top), OUT (right), GND (bottom)
  localPosts() { return [[-G, -2 * G], [2 * G, 0], [-G, 2 * G]]; }
  localBox() { return [-2 * G, -2 * G, 2 * G, 2 * G]; }
  leads() { return [[0, -G, -2 * G, -G, -G], [1, 2 * G, 0, 0.8 * G, 0], [2, -G, 2 * G, -G, G]]; }
  branchCount() { return 1; }
  labelSide() { return [-1, 0]; }
  valueLabel() { const k = this.knobProp(); return fmtQty(this.p[k.key], k.unit); }
  drawBox(g, title) {
    g.box(-1.8 * G, -G, 0.8 * G, G, { stroke: g.body, width: g.lw * 0.9, fill: g.fill, r: 5 });
    // sideways, the box is only 2 grid squares wide: centre the title across it and squeeze it to fit
    const side = g.rot & 1;
    g.text(title, -0.5 * G, side ? 0 : -0.35 * G, { size: 9, color: g.accent, bold: true, maxW: side ? 1.7 * G : 2.4 * G });
    g.text('VCC', -0.65 * G, -1.35 * G, { size: 7, color: g.muted, align: 'left' });
    g.text('GND', -0.65 * G, 1.35 * G, { size: 7, color: g.muted, align: 'left' });
    g.text('OUT', 1.4 * G, -0.35 * G, { size: 7, color: g.muted });
  }
  accept(s) {
    const io = s.x[this.branches[0]];
    const iq = (s.v(this.nodes[0]) - s.v(this.nodes[2])) / 8e4;
    this.postCurrents = [iq, io, -iq - io];
    this.i = io;
  }
}

export class LM35 extends ThreePinSensor {
  static type = 'lm35'; static title = 'LM35 Temp Sensor'; static keywords = 'lm35 temperature sensor analog 10mv';
  static props = [
    { key: 'temp', label: 'Temperature', unit: '°C', def: 25, min: 0, max: 150, knob: true },
    { key: 'scale', label: 'Scale factor', unit: 'V/°C', def: 0.01, min: 1e-4, max: 1 },
  ];
  static description = 'Precision centigrade temperature sensor: Vout = 10 mV/°C · T (needs 4–30 V supply).';
  stamp(s) {
    const [vcc, out, gnd] = this.nodes, k = this.branches[0];
    s.addG(vcc, gnd, 1 / 8e4);
    s.addBranchKCL(out, gnd, k); s.addA(k, out - 1, 1); s.addA(k, gnd - 1, -1); s.addA(k, k, -1);
  }
  stampStep(s) {
    const powered = s.v(this.nodes[0]) - s.v(this.nodes[2]) > 3.5 || s.mode === 'dc';
    s.b[this.branches[0]] += powered ? this.p.scale * this.p.temp * (s.srcScale ?? 1) : 0;
  }
  stampAC(ac) {
    const [vcc, out, gnd] = this.nodes, k = this.branches[0];
    ac.addY(vcc, gnd, 1 / 8e4);
    ac.addBranchKCL(out, gnd, k); ac.addA(k, out - 1, 1); ac.addA(k, gnd - 1, -1); ac.addA(k, k, -1);
  }
  readings(s) { return [['Temperature', this.p.temp, '°C'], ['Vout', s.v(this.nodes[1]) - s.v(this.nodes[2]), 'V']]; }
  draw(g) { this.drawBox(g, 'LM35'); }
}
register(LM35);

export class HallSensor extends ThreePinSensor {
  static type = 'hall'; static title = 'Hall Sensor'; static keywords = 'hall effect magnetic field sensor a1324 ss49e';
  static props = [
    { key: 'b', label: 'Magnetic flux density', unit: 'G', def: 0, min: -2000, max: 2000, knob: true },
    { key: 'sens', label: 'Sensitivity @5 V', unit: 'V/G', def: 0.005, min: 1e-5, max: 0.1, log: true },
  ];
  static description = 'Linear ratiometric Hall sensor: Vout = VCC·(0.5 + S·B/5 V), clamped near the rails.';
  ratio() { return Math.max(0.03, Math.min(0.97, 0.5 + (this.p.sens * this.p.b) / 5)); }
  stamp(s) {
    const [vcc, out, gnd] = this.nodes, k = this.branches[0], r = this.ratio();
    s.addG(vcc, gnd, 1 / 8e4);
    s.addBranchKCL(out, gnd, k);
    s.addA(k, out - 1, 1); s.addA(k, gnd - 1, -1 + r); s.addA(k, vcc - 1, -r); s.addA(k, k, -10);
  }
  stampAC(ac) {
    const [vcc, out, gnd] = this.nodes, k = this.branches[0], r = this.ratio();
    ac.addY(vcc, gnd, 1 / 8e4);
    ac.addBranchKCL(out, gnd, k);
    ac.addA(k, out - 1, 1); ac.addA(k, gnd - 1, -1 + r); ac.addA(k, vcc - 1, -r); ac.addA(k, k, -10);
  }
  readings(s) { return [['Field', this.p.b, 'G'], ['Vout', s.v(this.nodes[1]) - s.v(this.nodes[2]), 'V']]; }
  draw(g) {
    this.drawBox(g, 'HALL');
    const k = Math.max(-1, Math.min(1, this.p.b / 1000));
    if (Math.abs(k) > 0.02) {
      g.box(-1.5 * G, 0.1 * G, -1.0 * G, 0.6 * G, { fill: k > 0 ? 'rgba(255,80,80,0.9)' : 'rgba(80,140,255,0.9)', r: 2 });
      g.text(k > 0 ? 'N' : 'S', -1.25 * G, 0.35 * G, { size: 7, color: '#fff', bold: true });
    }
  }
}
register(HallSensor);

export class PIRSensor extends ThreePinSensor {
  static type = 'pir'; static title = 'PIR Motion Sensor'; static keywords = 'pir motion sensor hc-sr501 presence detector';
  static props = [
    { key: 'motion', label: 'Motion detected', type: 'bool', def: false },
    { key: 'hold', label: 'Hold time', unit: 's', def: 0.5, min: 1e-3, max: 600, log: true },
    { key: 'vout', label: 'Output high', unit: 'V', def: 3.3, min: 0.5, max: 12 },
  ];
  static description = 'PIR motion module (HC-SR501-like): tap it to simulate motion; output stays HIGH for the hold time.';
  interactive = true;
  valueLabel() { return this.active ? 'MOTION' : ''; }
  knobProp() { return this.constructor.props[1]; }
  reset() { this.timer = 0; this.active = false; }
  onTap() { this.p.motion = true; return true; }
  preStep(s) {
    if (this.p.motion) { this.timer = this.p.hold; this.p.motion = false; }
    const was = this.active;
    this.active = this.timer > 0;
    if (s.mode !== 'dc' && this.timer > 0) this.timer -= s.dt;
    if (was !== this.active) s.event = true;
  }
  stamp(s) {
    const [vcc, out, gnd] = this.nodes, k = this.branches[0];
    s.addG(vcc, gnd, 1 / 8e4);
    s.addBranchKCL(out, gnd, k); s.addA(k, out - 1, 1); s.addA(k, gnd - 1, -1); s.addA(k, k, -50);
  }
  stampStep(s) { s.b[this.branches[0]] += this.active ? this.p.vout : 0; }
  stampAC(ac) {
    const [vcc, out, gnd] = this.nodes, k = this.branches[0];
    ac.addY(vcc, gnd, 1 / 8e4);
    ac.addBranchKCL(out, gnd, k); ac.addA(k, out - 1, 1); ac.addA(k, gnd - 1, -1); ac.addA(k, k, -50);
  }
  readings(s) { return [['Output', this.active ? 'HIGH' : 'LOW', ''], ['Vout', s.v(this.nodes[1]) - s.v(this.nodes[2]), 'V']]; }
  draw(g) {
    this.drawBox(g, 'PIR');
    g.ctx.beginPath(); g.ctx.arc(-0.5 * G, 0.45 * G, 0.4 * G, Math.PI, 0);
    g.ctx.fillStyle = this.active ? 'rgba(255,90,90,0.85)' : 'rgba(255,255,255,0.35)'; g.ctx.fill();
    if (this.active) g.glow(-0.5 * G, 0.3 * G, G, '255,90,90', 0.4);
  }
}
register(PIRSensor);

// --------------------------------------------------------- 2-pin generators
export class Thermocouple extends TwoTerm {
  static type = 'thermocouple'; static title = 'Thermocouple (K)'; static category = 'Sensors';
  static prefix = 'TC'; static keywords = 'thermocouple type k seebeck temperature';
  static props = [
    { key: 'thot', label: 'Hot junction', unit: '°C', def: 100, min: -200, max: 1300, knob: true },
    { key: 'tcold', label: 'Cold junction', unit: '°C', def: 25, min: -50, max: 100 },
    { key: 'seebeck', label: 'Seebeck coefficient', unit: 'V/°C', def: 41e-6, min: 1e-7, max: 1e-3, log: true },
    { key: 'r', label: 'Lead resistance', unit: 'Ω', def: 5, min: 0.001, max: 1e4 },
  ];
  static description = 'Type-K thermocouple (linearised, 41 µV/°C): V = S·(Thot − Tcold). Needs amplification — try an op-amp stage.';
  branchCount() { return 1; }
  refNode = 1;
  stamp(s) {
    const k = this.branches[0], [a, b] = this.nodes;
    s.addBranchKCL(a, b, k); s.addA(k, a - 1, 1); s.addA(k, b - 1, -1); s.addA(k, k, -this.p.r);
  }
  stampStep(s) { s.b[this.branches[0]] += this.p.seebeck * (this.p.thot - this.p.tcold) * (s.srcScale ?? 1); }
  accept(s) { this.setCurrent(s.x[this.branches[0]]); }
  stampAC(ac) {
    const k = this.branches[0], [a, b] = this.nodes;
    ac.addBranchKCL(a, b, k); ac.addA(k, a - 1, 1); ac.addA(k, b - 1, -1); ac.addA(k, k, -this.p.r);
  }
  valueLabel() { return `${this.p.thot.toFixed(0)}°C`; }
  readings(s) { return [['Hot junction', this.p.thot, '°C'], ['EMF', this.p.seebeck * (this.p.thot - this.p.tcold), 'V'], ['Terminal V', this.voltageDiff(s), 'V']]; }
  leads() { return [[0, -2 * G, 0, -G, 0], [1, 2 * G, 0, G, 0]]; }
  draw(g) {
    g.line(-G, 0, 0, 0.6 * G, g.vc(g.pv(0)), g.lw);
    g.line(G, 0, 0, 0.6 * G, g.vc(g.pv(1)), g.lw * 1.8);
    const k = Math.min(1, Math.max(0, this.p.thot / 800));
    g.circle(0, 0.6 * G, 4, { fill: `rgb(255,${Math.round(200 - 150 * k)},${Math.round(80 - 60 * k)})` });
    if (k > 0.1) g.glow(0, 0.6 * G, G, '255,120,40', 0.5 * k);
    g.text('+', -1.3 * G, -0.55 * G, { size: 10, color: g.pos, bold: true });
  }
}
register(Thermocouple);

export class Microphone extends TwoTerm {
  static type = 'mic'; static title = 'Microphone'; static category = 'Sensors';
  static prefix = 'MK'; static keywords = 'microphone electret sound audio mic';
  static props = [
    { key: 'spl', label: 'Sound level', unit: 'dB SPL', def: 80, min: 0, max: 140, knob: true },
    { key: 'freq', label: 'Tone frequency', unit: 'Hz', def: 1000, min: 1, max: 1e5, log: true },
    { key: 'sens', label: 'Sensitivity', unit: 'dBV/Pa', def: -44, min: -80, max: 0 },
    { key: 'r', label: 'Output impedance', unit: 'Ω', def: 2200, min: 1, max: 1e6, log: true },
  ];
  static description = 'Microphone modelled as a sinusoidal source: Vpeak = √2·10^(S/20)·p, p = 20 µPa·10^(SPL/20).';
  branchCount() { return 1; }
  refNode = 1;
  amp() { return Math.SQRT2 * Math.pow(10, this.p.sens / 20) * 20e-6 * Math.pow(10, this.p.spl / 20); }
  stamp(s) {
    const k = this.branches[0], [a, b] = this.nodes;
    s.addBranchKCL(a, b, k); s.addA(k, a - 1, 1); s.addA(k, b - 1, -1); s.addA(k, k, -this.p.r);
  }
  stampStep(s) {
    const t = s.mode === 'dc' ? 0 : s.tNext;
    s.b[this.branches[0]] += this.amp() * Math.sin(2 * Math.PI * this.p.freq * t);
  }
  accept(s) { this.setCurrent(s.x[this.branches[0]]); }
  stampAC(ac) {
    const k = this.branches[0], [a, b] = this.nodes;
    ac.addBranchKCL(a, b, k); ac.addA(k, a - 1, 1); ac.addA(k, b - 1, -1); ac.addA(k, k, -this.p.r);
    if (ac.input === this) ac.addB(k, 1);
  }
  valueLabel() { return `${this.p.spl.toFixed(0)} dB`; }
  readings(s) { return [['Sound level', this.p.spl, 'dB SPL'], ['Open-circuit peak', this.amp(), 'V'], ['Voltage', this.voltageDiff(s), 'V']]; }
  leads() { return [[0, -2 * G, 0, -0.8 * G, 0], [1, 2 * G, 0, 0.8 * G, 0]]; }
  localBox() { return [-2 * G, -1.7 * G, 2 * G, 0.95 * G]; }
  draw(g) {
    g.circle(0, 0, 0.8 * G, { stroke: g.body, width: g.lw, fill: g.fill });
    g.line(-0.8 * G, -0.9 * G, -0.8 * G, 0.9 * G, g.body, g.lw * 1.3);
    const ctx = g.ctx;
    for (let k = 1; k <= 2; k++) {
      ctx.beginPath(); ctx.arc(-1.1 * G, -1.3 * G, k * 5, 0.2, 1.4);
      ctx.strokeStyle = g.accent; ctx.lineWidth = g.lw * 0.6; ctx.stroke();
    }
  }
}
register(Microphone);
