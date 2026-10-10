// Electrical installation & power-system parts: lamps (tungsten, fluorescent
// tube + ballast + starter, LED bulb, neon), fan, heater, socket outlet with
// appliances, TRIAC dimmer / electronic regulator, resistive & capacitive fan
// regulators, electric bell, earth electrode, rated loads (R, RL, RC, 3-phase),
// power-factor capacitor and transmission-line models.

import { Element, TwoTerm, register, GRID } from './base.js';
import { fmtShort, fmtQty } from '../engine/units.js';

const G = GRID;
const TAU = 2 * Math.PI;

/** Series R–L branch helper (trapezoidal / BE), branch current flows a → b. */
class RLBranch {
  reset() { this.i = 0; this.vl = 0; }
  stamp(s, a, b, k, R, L) {
    s.addBranchKCL(a, b, k); s.addA(k, a - 1, 1); s.addA(k, b - 1, -1);
    s.addA(k, k, -(Math.max(R, 1e-9) + (s.mode === 'dc' ? 0 : (s.method === 'be' ? 1 : 2) * L / s.dt)));
  }
  step(s, k, L) {
    if (s.mode === 'dc') return;
    s.b[k] += s.method === 'be' ? -(L / s.dt) * this.i : -(2 * L / s.dt) * this.i - this.vl;
  }
  accept(s, a, b, k, R) {
    this.i = s.x[k];
    this.vl = s.mode === 'dc' ? 0 : s.v(a) - s.v(b) - Math.max(R, 1e-9) * this.i;
  }
  ac(ac, a, b, k, R, L) {
    ac.addBranchKCL(a, b, k); ac.addA(k, a - 1, 1); ac.addA(k, b - 1, -1);
    ac.addA(k, k, -Math.max(R, 1e-9), -ac.omega * L);
  }
}

/** Capacitor companion helper. */
class CapHelper {
  reset(v = 0) { this.v = v; this.i = 0; this.J = 0; }
  g(s, C) { return s.mode === 'dc' ? 0 : ((s.method === 'be' ? 1 : 2) * C) / s.dt; }
  stamp(s, a, b, C) { if (s.mode !== 'dc') s.addG(a, b, this.g(s, C)); }
  step(s, a, b, C) {
    if (s.mode === 'dc') { this.J = 0; return; }
    const g = this.g(s, C);
    this.J = s.method === 'be' ? -g * this.v : -g * this.v - this.i;
    s.addI(a, b, this.J);
  }
  accept(s, a, b, C) { const v = s.v(a) - s.v(b); this.i = s.mode === 'dc' ? 0 : this.g(s, C) * v + this.J; this.v = v; }
}

/** RMS tracker with time constant tau. */
class Rms {
  constructor(tau = 0.1) { this.tau = tau; this.x2 = 0; }
  push(x, dt) { this.x2 += (x * x - this.x2) * Math.min(1, dt / this.tau); return Math.sqrt(this.x2); }
  get v() { return Math.sqrt(Math.max(0, this.x2)); }
}

/**
 * Gas discharge (arc / glow) behaviour shared by tubes, neon lamps and starters:
 * off until |v| exceeds the strike voltage, then i = sign(v)·(|v| − Vm)/R
 * (smoothed), staying ionised for a short de-ionisation time after the current
 * last flowed so it re-ignites every half-cycle.
 */
class Discharge {
  constructor() { this.reset(); }
  reset() { this.lit = false; this.tLast = -1; }
  iv(v, vm, R) {
    if (!this.lit) return { i: v * 1e-9, g: 1e-9 };
    const w = Math.max(0.2, vm * 0.01), u = (Math.abs(v) - vm) / w;
    const sp = u > 30 ? u : Math.log1p(Math.exp(u)), sg = 1 / (1 + Math.exp(-u));
    return { i: (Math.sign(v) * sp * w) / R + v * 1e-9, g: sg / R + 1e-9 };
  }
  update(s, v, i, vstrike, ihold, tdeion) {
    if (s.mode === 'dc') return false;
    const was = this.lit;
    if (Math.abs(i) > ihold) this.tLast = s.t;
    if (!this.lit && Math.abs(v) > vstrike) { this.lit = true; this.tLast = s.t; }
    else if (this.lit && s.t - this.tLast > tdeion) this.lit = false;
    return was !== this.lit;
  }
}

// --------------------------------------------------------------- lamps
export class Bulb extends TwoTerm {
  static type = 'bulb'; static title = 'Incandescent Bulb'; static category = 'Electrical';
  static prefix = 'LP'; static keywords = 'bulb incandescent lamp tungsten filament light 60w 100w';
  static props = [
    { key: 'v', label: 'Rated voltage', unit: 'V', def: 230, min: 1, max: 1000, log: true },
    { key: 'w', label: 'Rated power', unit: 'W', def: 60, min: 0.1, max: 5000, log: true, knob: true },
    { key: 'tau', label: 'Filament time constant', unit: 's', def: 0.08, min: 1e-3, max: 5, log: true },
  ];
  static description = 'Tungsten filament lamp with a thermal model: the cold filament has ≈1/15 of its hot resistance, so it draws a large inrush current and brightens over tens of milliseconds. R ∝ T^1.2, radiated power ∝ T⁴. On too high a voltage (about 1.6 × its rating, e.g. a 230 V bulb on 400 V) the filament overheats and burns out — select it and tap Replace.';
  static TBURN = 3350;
  static T0 = 300; static TH = 2800;
  get Rhot() { return (this.p.v * this.p.v) / this.p.w; }
  resist(T) { return this.Rhot * Math.pow(T / Bulb.TH, 1.2); }
  reset() { this.T = Bulb.T0; this.R = this.resist(this.T); this.setCurrent(0); }
  stamp(s) { s.addG(this.nodes[0], this.nodes[1], this.damaged ? 1e-9 : 1 / (this.R || this.Rhot)); }
  stampAC(ac) { ac.addY(this.nodes[0], this.nodes[1], this.damaged ? 1e-9 : 1 / (this.R || this.Rhot)); }
  accept(s) {
    if (this.damaged) { this.setCurrent(0); this.T = Bulb.T0; return; }
    const v = this.voltageDiff(s), R = this.R || this.Rhot, i = v / R;
    this.setCurrent(i);
    if (s.mode === 'dc') return;
    const { T0, TH } = Bulb, P = this.p.w;
    const cth = (4 * P * this.p.tau) / TH;
    const prad = (P * (this.T ** 4 - T0 ** 4)) / (TH ** 4 - T0 ** 4);
    this.T = Math.min(3600, Math.max(T0, this.T + ((v * i - prad) / cth) * s.dt));
    const Rn = this.resist(this.T);
    if (Math.abs(Rn - this.R) > 0.004 * this.R) { this.R = Rn; s.dirty = true; }
    this.stress = Math.max(0, Math.min(1, (this.T - 3000) / (Bulb.TBURN - 3000)));
    if (this.T >= Bulb.TBURN) this.setDamage(s, `Filament burnt out — over-voltage (${fmtShort(Math.abs(v), 'V')} across a ${fmtShort(this.p.v, 'V')} bulb)`);
  }
  bright() { return Math.max(0, Math.pow(((this.T || 300) - 900) / (Bulb.TH - 900), 3)); }
  valueLabel() { return `${fmtQty(this.p.w, 'W').replace(' ', '')}`; }
  readings(s) {
    if (this.damaged) return [['State', 'BURNT OUT — ' + this.damaged.why, ''], ['Voltage', this.voltageDiff(s), 'V'], ['Current', 0, 'A']];
    return [['Filament temperature', (this.T || 300) - 273, '°C'], ['Resistance', this.R || this.Rhot, 'Ω'], ['Cold resistance', this.resist(300), 'Ω'],
      ['Current', this.i, 'A'], ['Voltage', this.voltageDiff(s), 'V'], ['Light output', 13 * this.p.w * this.bright(), 'lm']];
  }
  leads() { return [[0, -2 * G, 0, -0.7 * G, 0.3 * G], [1, 2 * G, 0, 0.7 * G, 0.3 * G]]; }
  localBox() { return [-2 * G, -1.1 * G, 2 * G, 0.9 * G]; }
  draw(g) {
    const b = g.running ? Math.min(1.3, this.bright()) : 0;
    if (b > 0.01) g.glow(0, -0.2 * G, G * (1.4 + b), '255,205,110', Math.min(0.95, b));
    g.circle(0, -0.2 * G, 0.85 * G, { stroke: g.body, width: g.lw * 0.9, fill: b > 0.01 ? `rgba(255,225,140,${Math.min(0.85, b)})` : g.fill });
    const ctx = g.ctx; ctx.beginPath();
    ctx.moveTo(-0.7 * G, 0.3 * G); ctx.lineTo(-0.35 * G, -0.1 * G);
    for (let k = 0; k <= 6; k++) ctx.lineTo(-0.35 * G + k * 0.117 * G, -0.1 * G - (k % 2 ? 0.25 : 0) * G);
    ctx.lineTo(0.7 * G, 0.3 * G);
    ctx.strokeStyle = b > 0.05 ? '#ffd27a' : g.body; ctx.lineWidth = g.lw * 0.7; ctx.stroke();
    if (this.damaged) { // broken filament and a blackened glass
      g.circle(0, -0.2 * G, 0.85 * G, { fill: 'rgba(40,30,20,0.45)' });
      g.line(-0.05 * G, -0.42 * G, 0.12 * G, -0.18 * G, '#ef4444', g.lw * 0.7);
    }
  }
}
register(Bulb);

export class FluorescentTube extends Element {
  static type = 'tube'; static title = 'Fluorescent Tube Light'; static category = 'Electrical';
  static prefix = 'TL'; static keywords = 'tube light fluorescent lamp t8 t12 40w 36w ballast starter';
  static props = [
    { key: 'varc', label: 'Arc (running) voltage', unit: 'V', def: 103, min: 10, max: 1000 },
    { key: 'vstrike', label: 'Strike voltage (cold)', unit: 'V', def: 1000, min: 50, max: 1e4 },
    { key: 'vhot', label: 'Strike voltage (pre-heated)', unit: 'V', def: 450, min: 50, max: 1e4 },
    { key: 'rarc', label: 'Arc resistance', unit: 'Ω', def: 20, min: 0.1, max: 1e4, log: true },
    { key: 'rf', label: 'Filament resistance (each)', unit: 'Ω', def: 10, min: 0.1, max: 1000 },
    { key: 'w', label: 'Rated power', unit: 'W', def: 40, min: 1, max: 200, knob: true },
  ];
  static description = 'Hot-cathode fluorescent tube. Wire: L → ballast → left filament; left & right filaments’ inner ends to the starter; right filament → N. The starter pre-heats the filaments, then opens; the ballast kick strikes the arc, which then runs at ≈100 V.';
  constructor(x, y) { super(x, y); this.postCurrents = [0, 0, 0, 0]; this.arc = new Discharge(); this.fil = new Rms(0.3); }
  // 0,1: left filament (outer, inner); 2,3: right filament (inner, outer)
  localPosts() { return [[-3 * G, -G], [-3 * G, G], [3 * G, G], [3 * G, -G]]; }
  localBox() { return [-3 * G, -1.4 * G, 3 * G, 1.4 * G]; }
  leads() { return [[0, -3 * G, -G, -2.5 * G, -G], [1, -3 * G, G, -2.5 * G, G], [2, 3 * G, G, 2.5 * G, G], [3, 3 * G, -G, 2.5 * G, -G]]; }
  internalNodeCount() { return 2; }
  connectivity() { return null; }
  nonlinear = true;
  reset() { this.arc.reset(); this.fil = new Rms(0.3); this.postCurrents.fill(0); this.parc = 0; this.i = 0; this.pavg = 0; }
  vstrike() { const h = Math.min(1, (this.fil.v / 0.35) ** 2); return this.p.vstrike - (this.p.vstrike - this.p.vhot) * h; }
  stamp(s) {
    const [a1, a2, b1, b2] = this.nodes, [ma, mb] = this.inodes, gf = 2 / this.p.rf;
    s.addG(a1, ma, gf); s.addG(a2, ma, gf); s.addG(b1, mb, gf); s.addG(b2, mb, gf);
  }
  stampNL(s) {
    const [ma, mb] = this.inodes, v = s.v(ma) - s.v(mb);
    const { i, g } = this.arc.iv(v, this.p.varc, this.p.rarc);
    s.addG(ma, mb, g); s.addI(ma, mb, i - g * v);
  }
  accept(s) {
    const [a1, a2, b1, b2] = this.nodes, [ma, mb] = this.inodes, gf = 2 / this.p.rf;
    const va = s.v(ma) - s.v(mb), ia = this.arc.iv(va, this.p.varc, this.p.rarc).i;
    const i1 = (s.v(a1) - s.v(ma)) * gf, i2 = (s.v(a2) - s.v(ma)) * gf, i3 = (s.v(b1) - s.v(mb)) * gf, i4 = (s.v(b2) - s.v(mb)) * gf;
    this.postCurrents = [i1, i2, i3, i4]; this.i = i1;
    if (s.mode === 'dc') return;
    this.fil.push(Math.max(Math.abs(i1), Math.abs(i2)), s.dt);
    this.arc.update(s, va, ia, this.vstrike(), 0.01, 0.004);
    this.pavg += (va * ia - this.pavg) * Math.min(1, s.dt / 0.05);
    this.va = va;
  }
  readings() {
    return [['State', this.arc.lit ? 'Lit' : this.fil.v > 0.1 ? 'Pre-heating filaments' : 'Off', ''], ['Arc voltage', this.va || 0, 'V'],
      ['Arc power (avg)', this.pavg || 0, 'W'], ['Filament current (RMS)', this.fil.v, 'A']];
  }
  valueLabel() { return fmtQty(this.p.w, 'W').replace(' ', ''); }
  draw(g) {
    const lit = g.running && this.arc.lit, b = lit ? Math.min(1, Math.max(0.25, (this.pavg || 0) / this.p.w)) : 0;
    if (lit) g.glow(0, 0, 3 * G, '220,235,255', 0.55 * b);
    g.box(-2.5 * G, -0.6 * G, 2.5 * G, 0.6 * G, { stroke: g.body, width: g.lw * 0.9, fill: lit ? `rgba(235,245,255,${0.35 + 0.5 * b})` : g.fill, r: 0.6 * G });
    const hot = g.running && this.fil.v > 0.1;
    for (const sx of [-1, 1]) {
      const x = sx * 2.5 * G;
      g.poly([[x, -G], [x - sx * 0.3 * G, -G], [x - sx * 0.3 * G, -0.25 * G], [x - sx * 0.55 * G, 0], [x - sx * 0.3 * G, 0.25 * G], [x - sx * 0.3 * G, G], [x, G]],
        { stroke: hot ? '#ff9a3c' : g.body, width: g.lw * 0.7 });
    }
  }
}
register(FluorescentTube);

export class Ballast extends TwoTerm {
  static type = 'ballast'; static title = 'Choke / Ballast'; static category = 'Electrical';
  static prefix = 'L'; static keywords = 'ballast choke inductor tube light fluorescent magnetic';
  static props = [
    { key: 'l', label: 'Inductance', unit: 'H', def: 1.2, min: 1e-3, max: 100, log: true, knob: true },
    { key: 'r', label: 'Winding resistance', unit: 'Ω', def: 35, min: 0.01, max: 1e4, log: true },
  ];
  static description = 'Magnetic ballast (iron-cored choke) for a 40 W tube on 230 V 50 Hz: limits the arc current and produces the high-voltage kick when the starter opens.';
  constructor(x, y) { super(x, y); this.rl = new RLBranch(); }
  branchCount() { return 1; }
  reset() { this.rl.reset(); this.setCurrent(0); }
  stamp(s) { this.rl.stamp(s, this.nodes[0], this.nodes[1], this.branches[0], this.p.r, this.p.l); }
  stampStep(s) { this.rl.step(s, this.branches[0], this.p.l); }
  accept(s) { this.rl.accept(s, this.nodes[0], this.nodes[1], this.branches[0], this.p.r); this.setCurrent(this.rl.i); }
  stampAC(ac) { this.rl.ac(ac, this.nodes[0], this.nodes[1], this.branches[0], this.p.r, this.p.l); }
  valueLabel() { return fmtShort(this.p.l, 'H'); }
  localBox() { return [-2 * G, -0.9 * G, 2 * G, 0.6 * G]; }
  draw(g) {
    const grad = g.grad(-G, 0, G, 0, g.pv(0), g.pv(1)), ctx = g.ctx;
    ctx.beginPath();
    for (let k = 0; k < 4; k++) ctx.arc(-G + 0.5 * G * (k + 0.5), 0, 0.25 * G, Math.PI, 0);
    ctx.strokeStyle = grad; ctx.lineWidth = g.lw; ctx.stroke();
    g.line(-G, -0.55 * G, G, -0.55 * G, g.body, g.lw * 0.7);
    g.line(-G, -0.75 * G, G, -0.75 * G, g.body, g.lw * 0.7);
  }
}
register(Ballast);

const VGM = 150; // glow maintaining voltage: above a running tube (~110 V), so the starter stays idle

export class Starter extends TwoTerm {
  static type = 'starter'; static title = 'Glow Starter'; static category = 'Electrical';
  static prefix = 'ST'; static keywords = 'starter glow starter fs-2 tube light bimetal';
  static props = [
    { key: 'vglow', label: 'Glow ignition voltage', unit: 'V', def: 180, min: 50, max: 1000 },
    { key: 'theat', label: 'Bimetal heating time', unit: 's', def: 0.4, min: 0.01, max: 10 },
    { key: 'tcool', label: 'Contact opening time', unit: 's', def: 0.35, min: 0.01, max: 10 },
  ];
  static description = 'Glow starter: a neon glow heats a bimetal strip until its contacts close (pre-heating the tube filaments); with the glow gone it cools and snaps open, giving the ballast kick. Stays idle once the tube runs at ~100 V.';
  nonlinear = true;
  constructor(x, y) { super(x, y); this.glow = new Discharge(); }
  reset() { this.glow.reset(); this.heat = 0; this.closed = false; this.setCurrent(0); }
  stamp(s) { if (this.closed) s.addG(this.nodes[0], this.nodes[1], 10); }
  stampNL(s) {
    if (this.closed) return;
    const [a, b] = this.nodes, v = s.v(a) - s.v(b), { i, g } = this.glow.iv(v, VGM, 3000);
    s.addG(a, b, g); s.addI(a, b, i - g * v);
  }
  accept(s) {
    const v = this.voltageDiff(s);
    const i = this.closed ? v * 10 : this.glow.iv(v, VGM, 3000).i;
    this.setCurrent(i);
    if (s.mode === 'dc') return;
    if (!this.closed) {
      this.glow.update(s, v, i, this.p.vglow, 1e-3, 0.003);
      // the bimetal is heated by the glow power (≈1.5 W while pre-heating from mains)
      const pg = Math.abs(v * i);
      this.heat = Math.max(0, this.heat + (pg / 1.5 - 0.25) * (s.dt / this.p.theat));
      if (this.heat >= 1) { this.closed = true; this.glow.reset(); s.markEvent(); }
    } else {
      this.heat -= (0.5 * s.dt) / this.p.tcool;
      if (this.heat <= 0.5) { this.closed = false; this.heat = 0.2; s.markEvent(); }
    }
  }
  stampAC(ac) { ac.addY(this.nodes[0], this.nodes[1], this.closed ? 10 : 1e-9); }
  valueLabel() { return ''; }
  readings(s) { return [['State', this.closed ? 'Contacts closed (pre-heat)' : this.glow.lit ? 'Glowing (bimetal heating)' : 'Open', ''], ['Voltage', this.voltageDiff(s), 'V'], ['Current', this.i, 'A']]; }
  localBox() { return [-2 * G, -0.9 * G, 2 * G, 0.9 * G]; }
  draw(g) {
    g.circle(0, 0, 0.8 * G, { stroke: g.body, width: g.lw * 0.9, fill: this.glow.lit && g.running ? 'rgba(255,120,60,0.35)' : g.fill });
    if (this.glow.lit && g.running) g.glow(0, 0, G * 1.2, '255,120,60', 0.6);
    g.line(-0.8 * G, 0, -0.3 * G, 0, g.vc(g.pv(0)), g.lw);
    g.line(0.8 * G, 0, 0.3 * G, 0, g.vc(g.pv(1)), g.lw);
    const ctx = g.ctx; ctx.beginPath();
    ctx.moveTo(-0.3 * G, 0); ctx.quadraticCurveTo(0, this.closed ? 0 : -0.45 * G, this.closed ? 0.3 * G : 0.2 * G, this.closed ? 0 : -0.25 * G);
    ctx.strokeStyle = g.body; ctx.lineWidth = g.lw * 0.8; ctx.stroke();
  }
}
register(Starter);

export class LEDBulb extends TwoTerm {
  static type = 'ledbulb'; static title = 'LED Bulb (AC)'; static category = 'Electrical';
  static prefix = 'LP'; static keywords = 'led bulb lamp light 9w 12w energy saving ac driver';
  static props = [
    { key: 'v', label: 'Rated voltage (RMS)', unit: 'V', def: 230, min: 12, max: 400 },
    { key: 'w', label: 'Rated power', unit: 'W', def: 9, min: 0.5, max: 200, knob: true },
    { key: 'vth', label: 'LED string voltage', unit: 'V', def: 200, min: 5, max: 400 },
  ];
  static description = 'LED lamp with a linear driver: the LED string only conducts when |v| exceeds its string voltage (so the current flows in pulses near the peaks and the power factor is below 1). Sized for rated power at rated voltage.';
  nonlinear = true;
  onParamChange() {
    // R such that the average power at rated sine voltage equals the rating
    const vp = this.p.v * Math.SQRT2, vt = Math.min(this.p.vth, vp * 0.95);
    let acc = 0; const n = 2000;
    for (let k = 0; k < n; k++) { const v = vp * Math.abs(Math.sin((Math.PI * (k + 0.5)) / n)); if (v > vt) acc += v * (v - vt); }
    this.R = acc / n / this.p.w;
    this.vt = vt;
  }
  constructor(x, y) { super(x, y); this.onParamChange(); }
  reset() { this.onParamChange(); this.pavg = 0; this.setCurrent(0); }
  iv(v) {
    if (this.damaged) return { i: v * 1e-9, g: 1e-9 };
    const w = 0.5, u = (Math.abs(v) - this.vt) / w;
    const sp = u > 30 ? u : Math.log1p(Math.exp(u)), sg = 1 / (1 + Math.exp(-u));
    return { i: (Math.sign(v) * sp * w) / this.R + v * 1e-9, g: sg / this.R + 1e-9 };
  }
  stampNL(s) { const [a, b] = this.nodes, v = s.v(a) - s.v(b), { i, g } = this.iv(v); s.addG(a, b, g); s.addI(a, b, i - g * v); }
  accept(s) {
    const v = this.voltageDiff(s), { i } = this.iv(v);
    this.setCurrent(i);
    if (s.mode === 'dc' || this.damaged) return;
    this.pavg += (v * i - this.pavg) * Math.min(1, s.dt / 0.05);
    // the driver and its LEDs are sized for the rated voltage: well above it they cook
    const over = this.heatAvg(s, this.pavg / this.p.w, 1.5);
    this.stress = Math.max(0, Math.min(1, (over - 1.3) / 0.9));
    if (over > 2.2) this.setDamage(s, `Burnt out — over-voltage: drawing ${fmtShort(this.pavg, 'W')} instead of ${fmtShort(this.p.w, 'W')}`);
  }
  stampAC(ac) { ac.addY(this.nodes[0], this.nodes[1], 1e-9); }
  valueLabel() { return fmtQty(this.p.w, 'W').replace(' ', ''); }
  readings(s) { return [['Power (avg)', this.pavg || 0, 'W'], ['Light output', 100 * (this.pavg || 0), 'lm'], ['Current', this.i, 'A'], ['Voltage', this.voltageDiff(s), 'V']]; }
  leads() { return [[0, -2 * G, 0, -0.7 * G, 0.3 * G], [1, 2 * G, 0, 0.7 * G, 0.3 * G]]; }
  localBox() { return [-2 * G, -1.1 * G, 2 * G, 0.9 * G]; }
  draw(g) {
    const b = g.running ? Math.min(1.2, (this.pavg || 0) / this.p.w) : 0;
    if (b > 0.02) g.glow(0, -0.2 * G, G * (1.4 + b), '235,245,255', Math.min(0.95, b));
    g.circle(0, -0.2 * G, 0.85 * G, { stroke: g.body, width: g.lw * 0.9, fill: b > 0.02 ? `rgba(240,248,255,${Math.min(0.9, b)})` : g.fill });
    g.upright(() => g.text('LED', 0, 0, { size: 7, color: b > 0.3 ? '#334155' : g.muted, bold: true }), 0, -0.2 * G);
  }
}
register(LEDBulb);

export class NeonLamp extends TwoTerm {
  static type = 'neon'; static title = 'Neon Indicator Lamp'; static category = 'Electrical';
  static prefix = 'NE'; static keywords = 'neon indicator pilot lamp ne-2 glow';
  static props = [
    { key: 'vstrike', label: 'Striking voltage', unit: 'V', def: 90, min: 20, max: 1000, knob: true },
    { key: 'vm', label: 'Maintaining voltage', unit: 'V', def: 60, min: 10, max: 1000 },
    { key: 'r', label: 'Internal resistance', unit: 'Ω', def: 1000, min: 1, max: 1e6, log: true },
    { key: 'rb', label: 'Built-in series resistor (panel indicator)', unit: 'Ω', def: 0, min: 0, max: 1e7 },
  ];
  static description = 'Neon glow lamp (NE-2): strikes at ≈90 V, then maintains ≈60 V and must be fed through a series resistor (e.g. 100 kΩ on 230 V) — directly on the mains it burns out. Panel pilot lamps have the resistor built in (set it, e.g. 150 kΩ). Classic relaxation oscillator element.';
  rtot() { return this.p.r + (this.p.rb || 0); }
  nonlinear = true;
  constructor(x, y) { super(x, y); this.gd = new Discharge(); }
  reset() { this.gd.reset(); this.setCurrent(0); }
  stampNL(s) { const [a, b] = this.nodes, v = s.v(a) - s.v(b), { i, g } = this.gd.iv(v, this.p.vm, this.rtot()); s.addG(a, b, g); s.addI(a, b, i - g * v); }
  accept(s) {
    const v = this.voltageDiff(s), { i } = this.gd.iv(v, this.p.vm, this.rtot());
    this.setCurrent(i);
    this.gd.update(s, v, i, this.p.vstrike, 1e-5, 1e-4);
  }
  stampAC(ac) { ac.addY(this.nodes[0], this.nodes[1], 1e-9); }
  valueLabel() { return fmtShort(this.p.vstrike, 'V'); }
  readings(s) { return [['State', this.gd.lit ? 'Glowing' : 'Off', ''], ['Voltage', this.voltageDiff(s), 'V'], ['Current', this.i, 'A']]; }
  leads() { return [[0, -2 * G, 0, -0.25 * G, 0], [1, 2 * G, 0, 0.25 * G, 0]]; }
  localBox() { return [-2 * G, -0.9 * G, 2 * G, 0.9 * G]; }
  draw(g) {
    const on = g.running && this.gd.lit;
    if (on) g.glow(0, 0, G * 1.3, '255,110,40', 0.7);
    g.circle(0, 0, 0.8 * G, { stroke: g.body, width: g.lw * 0.9, fill: on ? 'rgba(255,110,40,0.35)' : g.fill });
    g.line(-0.25 * G, -0.45 * G, -0.25 * G, 0.45 * G, g.vc(g.pv(0)), g.lw * 1.2);
    g.line(0.25 * G, -0.45 * G, 0.25 * G, 0.45 * G, g.vc(g.pv(1)), g.lw * 1.2);
    g.circle(0.45 * G, -0.45 * G, 1.6, { fill: g.body });
  }
}
register(NeonLamp);

// ------------------------------------------------------------ appliances
export class CeilingFan extends TwoTerm {
  static type = 'fan'; static title = 'Ceiling Fan'; static category = 'Electrical';
  static prefix = 'M'; static keywords = 'ceiling fan table fan exhaust fan pedestal fan single phase induction motor capacitor 75w';
  static props = [
    { key: 'v', label: 'Rated voltage (RMS)', unit: 'V', def: 230, min: 12, max: 480 },
    { key: 'w', label: 'Rated power', unit: 'W', def: 75, min: 1, max: 2000, knob: true },
    { key: 'pf', label: 'Power factor', unit: '', def: 0.9, min: 0.2, max: 1 },
    { key: 'rpm', label: 'Rated speed', unit: 'rpm', def: 330, min: 10, max: 3000 },
    { key: 'freq', label: 'Rated frequency', unit: 'Hz', def: 50, min: 1, max: 400 },
    { key: 'cv', label: 'Capacitor rating (AC)', unit: 'V', def: 440, min: 50, max: 1000 },
  ];
  static description = 'Ceiling / table / exhaust fan (permanent-split capacitor motor) as an equivalent series R–L load from rated power and power factor. Speed follows the winding current with the fan load curve and the blade inertia; stalls below ≈35 % — try it with a regulator. Switched off, it carries no current and runs down. Over-voltage saturates the iron core, so the current climbs much faster than the voltage; the run capacitor (≈1.2 × the supply across it) bursts above its rating and the fan slows to a hum at locked-rotor current; the winding (class B, ≈100 °C at rated load) burns at ≈180 °C. A 230 V fan on 500 V: capacitor bursts in about a second, winding burns a few seconds later, and it stays dead until replaced.';
  constructor(x, y) { super(x, y); this.rl = new RLBranch(); this.rms = new Rms(0.1); this.irms = new Rms(0.1); this.icyc = new Rms(0.02); this.vcyc = new Rms(0.02); this.speed = 0; this.ang = 0; this.sat = 1; this.tw = 40; this.capWear = 0; }
  branchCount() { return 1; }
  /** run capacitor burst but the winding still conducts: it hums instead of turning */
  capGone() { return !!(this.damaged && this.damaged.partial); }
  burnt() { return !!(this.damaged && !this.damaged.partial); }
  rl0() {
    if (this.burnt()) return [1e9, 0];
    const S = this.p.w / this.p.pf, Z = (this.p.v * this.p.v) / S, R = Z * this.p.pf, X = Z * Math.sqrt(1 - this.p.pf ** 2);
    // a saturated core and a stalled rotor both lower the impedance
    const k = (this.sat || 1) * (this.capGone() ? 1.8 : 1);
    return [R / k, X / (TAU * this.p.freq) / k];
  }
  reset() { this.rl.reset(); this.rms = new Rms(0.1); this.irms = new Rms(0.1); this.icyc = new Rms(0.02); this.vcyc = new Rms(0.02); this.speed = 0; this.sat = 1; this.tw = 40; this.capWear = 0; this.setCurrent(0); }
  irated() { return this.p.w / (this.p.pf * this.p.v); }
  /** spinning on its own inertia with (almost) no current: switched off or stalled by the regulator */
  coasting() { return (this.speed || 0) >= 1 && this.icyc.v < 0.05 * this.irated(); }
  stamp(s) { const [R, L] = this.rl0(); this.rl.stamp(s, this.nodes[0], this.nodes[1], this.branches[0], R, L); }
  stampStep(s) { this.rl.step(s, this.branches[0], this.rl0()[1]); }
  accept(s) {
    const [R] = this.rl0();
    this.rl.accept(s, this.nodes[0], this.nodes[1], this.branches[0], R);
    this.setCurrent(this.rl.i);
    if (s.mode === 'dc') return;
    this.rms.push(this.voltageDiff(s), s.dt); this.vcyc.push(this.voltageDiff(s), s.dt);
    // driven by the current, not the terminal voltage: an open-circuited winding has no torque
    // (and an inductive kick across the open switch must not spin it up)
    const vr = this.irms.push(this.rl.i, s.dt) / this.irated();
    this.icyc.push(this.rl.i, s.dt);
    if (!this.burnt()) this.overStress(s, vr);
    const target = vr < 0.35 || this.damaged ? 0 : this.p.rpm * Math.min(1.05, Math.pow((vr - 0.35) / 0.65, 0.6));
    this.speed += (target - this.speed) * Math.min(1, s.dt / 0.3); // quick spin-up, so it settles at mains simulation speeds
    if (target === 0 && this.speed < 1) this.speed = 0; // bearing friction: it does stop
    this.ang += (this.speed / 60) * TAU * s.dt;
  }
  /** core saturation, run capacitor and winding temperature on the thermal (real-time) clock */
  overStress(s, vr) {
    // iron saturation above ≈1.15 × rated voltage: the magnetising current climbs steeply
    // (both follow the voltage of the last cycle or so, not a slow average)
    const x = this.vcyc.v / this.p.v, sat = Math.min(6, 1 + 2 * Math.max(0, x - 1.15) ** 2);
    if (Math.abs(sat - this.sat) > 0.02 * this.sat) { this.sat = sat; s.dirty = true; }
    // run capacitor: ≈1.2 × the supply across it. A little over its rating it lasts a few
    // seconds; at ≈1.3 × (about 570 V on a 440 V capacitor) it bursts within a second or so
    const vc = 1.2 * this.vcyc.v, rc = vc / this.p.cv;
    if (!this.capGone() && rc > 1.1) {
      this.capWear += s.heatDt() / (2 * Math.pow(1.3 / rc, 12));
      if (this.capWear >= 1 && this.setDamage(s, `Run capacitor burst — ${fmtShort(vc, 'V')} across a ${fmtShort(this.p.cv, 'V')} capacitor. The fan only hums at locked-rotor current and the winding is overheating — switch it off`)) { this.damaged.partial = true; s.dirty = true; }
    }
    // winding temperature (class B insulation): ≈100 °C at rated current, burns at ≈180 °C
    this.tw += (40 + 60 * vr * vr - this.tw) * Math.min(1, s.heatDt() / 120);
    this.stress = Math.max(this.capGone() ? 0.6 : Math.min(1, this.capWear), Math.min(1, Math.max(0, (this.tw - 110) / 70)));
    if (this.tw > 180) {
      const why = `Winding burnt — insulation charred at ${Math.round(this.tw)} °C (${fmtShort(this.irms.v, 'A')}, rated ${fmtShort(this.irated(), 'A')})${this.sat > 1.3 ? `: ${fmtShort(this.rms.v, 'V')} on a ${fmtShort(this.p.v, 'V')} fan saturated the core` : this.capGone() ? ': it was left humming with a burst capacitor' : ': overloaded for too long'}`;
      this.damaged = null;
      this.setDamage(s, why);
    }
  }
  stampAC(ac) { const [R, L] = this.rl0(); this.rl.ac(ac, this.nodes[0], this.nodes[1], this.branches[0], R, L); }
  valueLabel() { return this.burnt() ? 'BURNT' : this.capGone() ? 'humming' : fmtQty(Math.round(this.speed || 0), 'rpm') + (this.coasting() ? ' coasting' : ''); }
  readings(s) {
    const st = this.burnt() ? 'BURNT — replace it' : this.capGone() ? 'Capacitor burst — humming, not turning' : this.coasting() ? 'Coasting (no current)' : this.speed >= 1 ? 'Running' : 'Stopped';
    return [['Speed', this.speed || 0, 'rpm'], ['State', st, ''], ['Voltage (RMS)', this.rms.v, 'V'], ['Current (RMS)', this.irms.v, 'A'], ['Winding temperature', this.tw ?? 40, '°C'], ['Voltage', this.voltageDiff(s), 'V']];
  }
  leads() { return [[0, -2 * G, 0, -G, 0], [1, 2 * G, 0, G, 0]]; }
  localBox() { return [-2 * G, -1.1 * G, 2 * G, 1.1 * G]; }
  draw(g) {
    const burnt = this.burnt();
    g.circle(0, 0, G, { stroke: burnt ? '#5b4636' : g.body, width: g.lw * 0.9, fill: g.fill });
    const a = this.ang || 0, ctx = g.ctx;
    for (let k = 0; k < 3; k++) {
      const t = a + (k * TAU) / 3;
      ctx.save(); ctx.rotate(t);
      ctx.beginPath(); ctx.ellipse(0.48 * G, 0, 0.42 * G, 0.14 * G, 0, 0, TAU);
      ctx.fillStyle = burnt ? 'rgba(60,40,28,0.8)' : g.running && this.speed > 5 ? 'rgba(34,211,238,0.55)' : 'rgba(148,178,230,0.35)'; ctx.fill();
      ctx.restore();
    }
    g.circle(0, 0, 0.16 * G, { fill: burnt ? '#3b2a20' : this.capGone() ? '#ef4444' : g.accent });
  }
}
register(CeilingFan);

export class Heater extends TwoTerm {
  static type = 'heater'; static title = 'Heater / Iron / Kettle'; static category = 'Electrical';
  static prefix = 'H'; static keywords = 'heater room heater iron kettle geyser element resistive load nichrome';
  static props = [
    { key: 'v', label: 'Rated voltage', unit: 'V', def: 230, min: 1, max: 1000 },
    { key: 'w', label: 'Rated power', unit: 'W', def: 1000, min: 1, max: 1e5, log: true, knob: true },
    { key: 'tau', label: 'Thermal time constant', unit: 's', def: 5, min: 0.01, max: 1000, log: true },
  ];
  static description = 'Resistive heating element (R = V²/P) with a first-order thermal model: temperature rises towards ΔT ∝ P.';
  get R() { return this.damaged ? 1e9 : (this.p.v * this.p.v) / this.p.w; }
  reset() { this.T = 25; this.setCurrent(0); }
  stamp(s) { s.addG(this.nodes[0], this.nodes[1], 1 / this.R); }
  stampAC(ac) { ac.addY(this.nodes[0], this.nodes[1], 1 / this.R); }
  accept(s) {
    const v = this.voltageDiff(s);
    this.setCurrent(v / this.R);
    if (s.mode === 'dc' || this.damaged) return;
    this.T += ((25 + 300 * ((v * v) / this.R) / this.p.w - this.T) * Math.min(1, s.heatDt() / this.p.tau));
    // nichrome runs at ≈ 325 °C at its rating; past ≈ 1.8 × rated power it melts open
    this.stress = Math.max(0, Math.min(1, (this.T - 400) / 165));
    if (this.T > 565) this.setDamage(s, `Element burnt open — ${fmtShort(Math.round(this.T), '°C')} (over-voltage: too much power for its rating)`);
  }
  valueLabel() { return fmtQty(this.p.w, 'W').replace(' ', ''); }
  readings(s) { const v = this.voltageDiff(s); return [['Element temperature', this.T ?? 25, '°C'], ['Power (inst.)', (v * v) / this.R, 'W'], ['Resistance', this.R, 'Ω'], ['Current', this.i, 'A']]; }
  localBox() { return [-2 * G, -0.75 * G, 2 * G, 0.75 * G]; }
  draw(g) {
    const hot = g.running ? Math.min(1, Math.max(0, ((this.T ?? 25) - 60) / 250)) : 0;
    if (hot > 0.02) g.glow(0, 0, G * 1.5, '255,90,30', hot * 0.7);
    g.box(-G, -0.55 * G, G, 0.55 * G, { stroke: g.body, width: g.lw * 0.9, fill: g.fill, r: 3 });
    const ctx = g.ctx; ctx.beginPath();
    for (let k = 0; k <= 16; k++) { const x = -0.8 * G + k * 0.1 * G, y = 0.3 * G * Math.sin((k * Math.PI) / 2); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.strokeStyle = hot > 0.1 ? `rgb(255,${Math.round(160 - 100 * hot)},60)` : g.body; ctx.lineWidth = g.lw * 0.8; ctx.stroke();
  }
}
register(Heater);

const APPLIANCES = {
  none: { name: 'Nothing plugged in' },
  lamp: { name: 'Lamp 60 W', w: 60, pf: 1 },
  fan: { name: 'Fan 75 W (PF 0.9)', w: 75, pf: 0.9 },
  tv: { name: 'TV 120 W (PF 0.95)', w: 120, pf: 0.95 },
  heater: { name: 'Heater 1 kW', w: 1000, pf: 1 },
  iron: { name: 'Iron 1.2 kW', w: 1200, pf: 1 },
  motor: { name: 'Pump motor 750 W (PF 0.8)', w: 750, pf: 0.8 },
  fridge: { name: 'Refrigerator 150 W (PF 0.8)', w: 150, pf: 0.8 },
  computer: { name: 'Computer 200 W (PF 0.95)', w: 200, pf: 0.95 },
  washer: { name: 'Washing machine 500 W (PF 0.85)', w: 500, pf: 0.85 },
  ricecooker: { name: 'Rice cooker 700 W', w: 700, pf: 1 },
  microwave: { name: 'Microwave oven 1.2 kW (PF 0.95)', w: 1200, pf: 0.95 },
  ac: { name: 'Air conditioner 1.5 ton, 1.5 kW (PF 0.9)', w: 1500, pf: 0.9 },
  fault: { name: 'Faulty appliance: 30 W + 50 mA L–E leak', w: 30, pf: 1, leak: 0.05 },
  short: { name: 'Short circuit L–N', short: true },
};

export class Socket extends Element {
  static type = 'socket'; static title = 'Socket Outlet + Appliance'; static category = 'Electrical';
  static prefix = 'SO'; static keywords = 'socket outlet plug point receptacle appliance 3 pin load earth';
  static props = [
    { key: 'app', label: 'Plugged-in appliance', type: 'select', def: 'lamp', options: Object.entries(APPLIANCES).map(([k, v]) => [k, v.name]) },
    { key: 'v', label: 'Rated voltage', unit: 'V', def: 230, min: 12, max: 480 },
    { key: 'freq', label: 'Frequency', unit: 'Hz', def: 50, min: 1, max: 400 },
  ];
  static description = '3-pin socket (L, N, E) with a selectable appliance modelled as an R–L load of its rated power and power factor. "Faulty appliance" leaks 50 mA to earth — an RCD must trip.';
  constructor(x, y) { super(x, y); this.postCurrents = [0, 0, 0]; this.rl = new RLBranch(); }
  localPosts() { return [[-2 * G, -G], [-2 * G, G], [0, 2 * G]]; }
  localBox() { return [-2 * G, -1.8 * G, 1.6 * G, 2 * G]; }
  leads() { return [[0, -2 * G, -G, -1.2 * G, -G], [1, -2 * G, G, -1.2 * G, G], [2, 0, 2 * G, 0, 1.4 * G]]; }
  labelSide() { return [1, 0]; }
  branchCount() { return 1; }
  app() { return APPLIANCES[this.p.app] || APPLIANCES.none; }
  rl0() {
    const a = this.app();
    if (a.short) return [0.01, 0];
    if (!a.w) return [1e9, 0];
    const S = a.w / a.pf, Z = (this.p.v * this.p.v) / S;
    return [Z * a.pf, (Z * Math.sqrt(1 - a.pf * a.pf)) / (TAU * this.p.freq)];
  }
  gleak() { const a = this.app(); return a.leak ? a.leak / this.p.v : 0; }
  reset() { this.rl.reset(); this.postCurrents.fill(0); }
  stamp(s) {
    const [l, n, e] = this.nodes, [R, L] = this.rl0();
    this.rl.stamp(s, l, n, this.branches[0], R, L);
    if (this.gleak()) s.addG(l, e, this.gleak());
  }
  stampStep(s) { this.rl.step(s, this.branches[0], this.rl0()[1]); }
  accept(s) {
    const [l, n, e] = this.nodes, [R] = this.rl0();
    this.rl.accept(s, l, n, this.branches[0], R);
    const il = (s.v(l) - s.v(e)) * this.gleak();
    this.postCurrents = [this.rl.i + il, -this.rl.i, -il]; this.i = this.rl.i + il;
  }
  stampAC(ac) {
    const [l, n, e] = this.nodes, [R, L] = this.rl0();
    this.rl.ac(ac, l, n, this.branches[0], R, L);
    if (this.gleak()) ac.addY(l, e, this.gleak());
  }
  valueLabel() { const a = this.app(); return a.w ? fmtQty(a.w, 'W').replace(' ', '') : a.short ? 'SHORT' : ''; }
  readings(s) { return [['Appliance', this.app().name, ''], ['Voltage L–N', s.v(this.nodes[0]) - s.v(this.nodes[1]), 'V'], ['Current (L)', this.postCurrents[0], 'A'], ['Earth leakage', -this.postCurrents[2], 'A']]; }
  draw(g) {
    g.box(-1.2 * G, -1.6 * G, 1.4 * G, 1.4 * G, { stroke: g.body, width: g.lw * 0.9, fill: g.fill, r: 5 });
    g.upright(() => {
      g.box(-0.45 * G, -0.9 * G, -0.15 * G, -0.35 * G, { fill: g.body });
      g.box(0.15 * G, -0.9 * G, 0.45 * G, -0.35 * G, { fill: g.body });
      g.box(-0.13 * G, 0.1 * G, 0.13 * G, 0.75 * G, { fill: g.body });
    }, 0.1 * G, -0.1 * G);
    g.text('L', -0.9 * G, -G, { size: 7, color: g.muted, bold: true });
    g.text('N', -0.9 * G, G, { size: 7, color: g.muted, bold: true });
    g.text('E', 0.35 * G, 1.15 * G, { size: 7, color: g.muted, bold: true });
  }
}
register(Socket);

export class Dimmer extends TwoTerm {
  static type = 'dimmer'; static title = 'Dimmer / Electronic Regulator'; static category = 'Electrical';
  static prefix = 'DM'; static keywords = 'dimmer electronic fan regulator triac phase control light dimmer speed controller';
  static props = [
    { key: 'level', label: 'Level', unit: '%', def: 60, min: 0, max: 100, knob: true },
    { key: 'freq', label: 'Mains frequency', unit: 'Hz', def: 50, min: 1, max: 400 },
    { key: 'ih', label: 'TRIAC holding current', unit: 'A', def: 0.02, min: 1e-4, max: 1 },
  ];
  static description = 'TRIAC phase-angle controller in series with the load. Each half-cycle it waits for the firing angle α = (1 − level)·180° after the zero crossing, fires, and conducts until the current falls to zero.';
  constructor(x, y) { super(x, y); }
  reset() { this.on = false; this.tz = 0; this.vPrev = 0; this.setCurrent(0); }
  alpha() { return Math.min(175, Math.max(5, 180 * (1 - this.p.level / 100))); }
  stamp(s) { s.addG(this.nodes[0], this.nodes[1], this.on ? 50 : 1e-8); }
  stampAC(ac) { ac.addY(this.nodes[0], this.nodes[1], this.on ? 50 : 1e-8); }
  accept(s) {
    const v = this.voltageDiff(s), i = v * (this.on ? 50 : 1e-8);
    this.setCurrent(i);
    if (s.mode === 'dc') return;
    if (this.on) {
      if (Math.abs(i) < this.p.ih) { this.on = false; this.tz = s.t; s.markEvent(); }
    } else {
      if (Math.sign(v) !== Math.sign(this.vPrev) && this.vPrev !== 0) this.tz = s.t;
      const delay = this.alpha() / (360 * this.p.freq);
      if (this.p.level > 0 && s.t - this.tz >= delay && Math.abs(v) > 2) { this.on = true; s.markEvent(); }
    }
    this.vPrev = v;
  }
  valueLabel() { return `${this.p.level.toFixed(0)}%`; }
  readings(s) { return [['Firing angle α', this.alpha(), '°'], ['Conduction angle', 180 - this.alpha(), '°'], ['State', this.on ? 'Conducting' : 'Blocking', ''], ['Current', this.i, 'A'], ['Voltage across', this.voltageDiff(s), 'V']]; }
  localBox() { return [-2 * G, -0.9 * G, 2 * G, 0.9 * G]; }
  draw(g) {
    g.box(-G, -0.8 * G, G, 0.8 * G, { stroke: g.body, width: g.lw * 0.9, fill: g.fill, r: 6 });
    g.circle(0, 0, 0.5 * G, { stroke: g.body, width: g.lw * 0.8 });
    const a = -Math.PI * 0.75 + Math.PI * 1.5 * (this.p.level / 100);
    g.line(0, 0, Math.cos(a) * 0.45 * G, Math.sin(a) * 0.45 * G, g.accent, g.lw);
    if (g.running && this.on) g.circle(0.75 * G, -0.55 * G, 2.2, { fill: g.hi });
  }
}
register(Dimmer);

const RES_STEPS = [Infinity, 380, 250, 150, 70, 0];
export class FanRegResistive extends TwoTerm {
  static type = 'fanregres'; static title = 'Fan Regulator (resistive)'; static category = 'Electrical';
  static prefix = 'RG'; static keywords = 'fan regulator resistive step regulator rheostat speed control old type';
  static props = [
    { key: 'step', label: 'Step (0 = off … 5 = full)', unit: '', def: 3, min: 0, max: 5, knob: true },
    { key: 'scale', label: 'Resistance scale', unit: '×', def: 1, min: 0.1, max: 10 },
  ];
  static description = 'Old-style step regulator: a tapped wire-wound resistor in series with the fan (steps 1–4 drop voltage, step 5 is direct). Wastes power as heat — compare with the capacitive regulator.';
  R() { const k = Math.round(Math.min(5, Math.max(0, this.p.step))); const r = RES_STEPS[k]; return r === Infinity ? 1e10 : Math.max(0.01, r * this.p.scale); }
  stamp(s) { s.addG(this.nodes[0], this.nodes[1], 1 / this.R()); }
  stampAC(ac) { ac.addY(this.nodes[0], this.nodes[1], 1 / this.R()); }
  accept(s) { this.setCurrent(this.voltageDiff(s) / this.R()); if (s.mode !== 'dc') this.ploss = (this.ploss || 0) + (this.voltageDiff(s) * this.i - (this.ploss || 0)) * Math.min(1, s.dt / 0.1); }
  valueLabel() { return `Step ${Math.round(this.p.step)}`; }
  readings(s) { return [['Series resistance', this.R(), 'Ω'], ['Power wasted (avg)', this.ploss || 0, 'W'], ['Voltage drop', this.voltageDiff(s), 'V'], ['Current', this.i, 'A']]; }
  localBox() { return [-2 * G, -0.9 * G, 2 * G, 0.9 * G]; }
  draw(g) {
    g.box(-G, -0.8 * G, G, 0.8 * G, { stroke: g.body, width: g.lw * 0.9, fill: g.fill, r: 6 });
    for (let k = 0; k <= 5; k++) { const a = Math.PI * (0.75 + (k * 1.5) / 5 / 1); g.circle(Math.cos(a) * 0.55 * G, Math.sin(a) * 0.55 * G, 1.4, { fill: g.muted }); }
    const a = Math.PI * (0.75 + (Math.round(this.p.step) * 1.5) / 5);
    g.line(0, 0, Math.cos(a) * 0.5 * G, Math.sin(a) * 0.5 * G, g.accent, g.lw);
  }
}
register(FanRegResistive);

const CAP_STEPS = [0, 1.5e-6, 2.2e-6, 3.3e-6, 4.7e-6, Infinity];
export class FanRegCapacitive extends TwoTerm {
  static type = 'fanregcap'; static title = 'Fan Regulator (capacitive)'; static category = 'Electrical';
  static prefix = 'RG'; static keywords = 'fan regulator capacitor electronic step regulator speed control energy saving';
  static props = [{ key: 'step', label: 'Step (0 = off … 5 = full)', unit: '', def: 3, min: 0, max: 5, knob: true }];
  static description = 'Capacitor-type step regulator: series capacitors (1.5–4.7 µF) drop the fan voltage with almost no power loss (reactive drop), with a 470 kΩ bleeder. Step 5 connects the fan directly.';
  constructor(x, y) { super(x, y); this.cap = new CapHelper(); }
  C() { return CAP_STEPS[Math.round(Math.min(5, Math.max(0, this.p.step)))]; }
  reset() { this.cap.reset(0); this.setCurrent(0); }
  stamp(s) {
    const C = this.C(), [a, b] = this.nodes;
    s.addG(a, b, 1 / 470e3);
    if (C === Infinity) s.addG(a, b, 100); else if (C > 0) this.cap.stamp(s, a, b, C);
  }
  stampStep(s) { const C = this.C(); if (C > 0 && C !== Infinity) this.cap.step(s, this.nodes[0], this.nodes[1], C); }
  accept(s) {
    const C = this.C(), [a, b] = this.nodes, v = this.voltageDiff(s);
    let i = v / 470e3;
    if (C === Infinity) i += v * 100; else if (C > 0) { this.cap.accept(s, a, b, C); i += this.cap.i; } else this.cap.reset(v);
    this.setCurrent(i);
  }
  stampAC(ac) { const C = this.C(), [a, b] = this.nodes; ac.addY(a, b, 1 / 470e3 + (C === Infinity ? 100 : 0), C > 0 && C !== Infinity ? ac.omega * C : 0); }
  onParamChange() { this.cap?.reset(0); }
  valueLabel() { return `Step ${Math.round(this.p.step)}`; }
  readings(s) { const C = this.C(); return [['Series capacitor', C === Infinity ? 'bypassed' : C === 0 ? 'open (off)' : fmtShort(C, 'F'), ''], ['Voltage drop', this.voltageDiff(s), 'V'], ['Current', this.i, 'A']]; }
  localBox() { return [-2 * G, -0.9 * G, 2 * G, 0.9 * G]; }
  draw(g) {
    g.box(-G, -0.8 * G, G, 0.8 * G, { stroke: g.body, width: g.lw * 0.9, fill: g.fill, r: 6 });
    g.line(-0.12 * G, -0.35 * G, -0.12 * G, 0.35 * G, g.body, g.lw);
    g.line(0.12 * G, -0.35 * G, 0.12 * G, 0.35 * G, g.body, g.lw);
    g.upright(() => g.text(String(Math.round(this.p.step)), 0, 0.5, { size: 7, color: g.accent, bold: true }), 0.62 * G, -0.45 * G);
  }
}
register(FanRegCapacitive);

export class Bell extends TwoTerm {
  static type = 'bell'; static title = 'Electric Bell'; static category = 'Electrical';
  static prefix = 'BL'; static keywords = 'bell door bell calling bell electromagnetic gong';
  static props = [
    { key: 'r', label: 'Coil resistance', unit: 'Ω', def: 600, min: 0.1, max: 1e5, log: true },
    { key: 'l', label: 'Coil inductance', unit: 'H', def: 0.8, min: 1e-4, max: 100, log: true },
    { key: 'ion', label: 'Operating current', unit: 'A', def: 0.1, min: 1e-4, max: 10, log: true },
  ];
  static description = 'Electromagnetic bell: a coil (R–L) that rings when its RMS current exceeds the operating current.';
  constructor(x, y) { super(x, y); this.rl = new RLBranch(); this.rms = new Rms(0.05); }
  branchCount() { return 1; }
  reset() { this.rl.reset(); this.rms = new Rms(0.05); this.sounding = false; this.setCurrent(0); }
  stamp(s) { this.rl.stamp(s, this.nodes[0], this.nodes[1], this.branches[0], this.p.r, this.p.l); }
  stampStep(s) { this.rl.step(s, this.branches[0], this.p.l); }
  accept(s) {
    this.rl.accept(s, this.nodes[0], this.nodes[1], this.branches[0], this.p.r);
    this.setCurrent(this.rl.i);
    if (s.mode !== 'dc') this.sounding = this.rms.push(this.rl.i, s.dt) > this.p.ion;
  }
  get soundTone() { return 1250; }
  stampAC(ac) { this.rl.ac(ac, this.nodes[0], this.nodes[1], this.branches[0], this.p.r, this.p.l); }
  valueLabel() { return ''; }
  readings(s) { return [['State', this.sounding ? 'Ringing' : 'Silent', ''], ['Current (RMS)', this.rms.v, 'A'], ['Voltage', this.voltageDiff(s), 'V']]; }
  localBox() { return [-2 * G, -1.1 * G, 2 * G, 0.6 * G]; }
  draw(g) {
    const ctx = g.ctx;
    ctx.beginPath(); ctx.arc(0, 0.3 * G, 0.9 * G, Math.PI, 0); ctx.closePath();
    ctx.fillStyle = g.fill; ctx.fill(); ctx.strokeStyle = g.body; ctx.lineWidth = g.lw * 0.9; ctx.stroke();
    g.line(-G, 0.3 * G, G, 0.3 * G, g.body, g.lw);
    if (g.running && this.sounding) {
      const ph = Math.sin(g.t * 60) * 0.25;
      g.glow(0, -0.2 * G, G * 1.3, '255,210,90', 0.5);
      g.line(0, 0.3 * G, Math.sin(ph) * 0.8 * G, 0.3 * G - Math.cos(ph) * 0.8 * G, g.accent, g.lw);
    }
  }
}
register(Bell);

export class EarthElectrode extends Element {
  static type = 'earthrod'; static title = 'Earth Electrode'; static category = 'Electrical';
  static prefix = 'E'; static keywords = 'earth rod electrode earthing pit grounding resistance tt';
  static props = [{ key: 'r', label: 'Earth resistance', unit: 'Ω', def: 10, min: 0.01, max: 1e4, log: true, knob: true }];
  static description = 'Earth rod: connects its terminal to true earth (0 V) through the soil resistance. Fault current and touch voltage depend on it.';
  constructor(x, y) { super(x, y); this.postCurrents = [0]; }
  localPosts() { return [[0, 0]]; }
  localBox() { return [-0.8 * G, -4, 0.8 * G, 2 * G]; }
  leads() { return [[0, 0, 0, 0, 0.5 * G]]; }
  labelSide() { return [1, 0]; }
  stamp(s) { s.addG(this.nodes[0], 0, 1 / this.p.r); }
  stampAC(ac) { ac.addY(this.nodes[0], 0, 1 / this.p.r); }
  accept(s) { this.postCurrents[0] = s.v(this.nodes[0]) / this.p.r; this.i = this.postCurrents[0]; }
  valueLabel() { return fmtShort(this.p.r, 'Ω'); }
  readings(s) { return [['Earth current', this.i, 'A'], ['Electrode potential', s.v(this.nodes[0]), 'V']]; }
  draw(g) {
    g.line(0, 0.5 * G, 0, 1.2 * G, g.body, g.lw);
    g.line(-0.6 * G, 1.2 * G, 0.6 * G, 1.2 * G, g.body, g.lw);
    g.line(-0.4 * G, 1.45 * G, 0.4 * G, 1.45 * G, g.body, g.lw);
    g.line(-0.2 * G, 1.7 * G, 0.2 * G, 1.7 * G, g.body, g.lw);
    g.box(-0.1 * G, 0.4 * G, 0.1 * G, 1.2 * G, { fill: '#b45309' });
  }
}
register(EarthElectrode);

// --------------------------------------------------------- rated loads
class RatedLoad extends TwoTerm {
  static category = 'Power Systems';
  static prefix = 'Z';
  static kind = 'R';
  static props = [
    { key: 'p', label: 'Real power P (at rated V)', unit: 'W', def: 1000, min: 1e-3, max: 1e9, log: true, knob: true },
    { key: 'pf', label: 'Power factor', unit: '', def: 0.8, min: 0.05, max: 1 },
    { key: 'v', label: 'Rated voltage (RMS)', unit: 'V', def: 230, min: 1, max: 1e6, log: true },
    { key: 'freq', label: 'Frequency', unit: 'Hz', def: 50, min: 1, max: 1e4 },
  ];
  constructor(x, y) { super(x, y); this.rl = new RLBranch(); this.cap = new CapHelper(); }
  zparts() {
    const pf = this.constructor.kind === 'R' ? 1 : this.p.pf, S = this.p.p / pf, Z = (this.p.v * this.p.v) / S;
    const R = Z * pf, X = Z * Math.sqrt(Math.max(0, 1 - pf * pf)), w = TAU * this.p.freq;
    return { R, L: X / w, C: X > 0 ? 1 / (w * X) : Infinity };
  }
  branchCount() { return this.constructor.kind === 'RL' ? 1 : 0; }
  internalNodeCount() { return this.constructor.kind === 'RC' ? 1 : 0; }
  reset() { this.rl.reset(); this.cap.reset(0); this.setCurrent(0); }
  stamp(s) {
    const { R, L, C } = this.zparts(), [a, b] = this.nodes, k = this.constructor.kind;
    if (k === 'R') s.addG(a, b, 1 / R);
    else if (k === 'RL') this.rl.stamp(s, a, b, this.branches[0], R, L);
    else { const m = this.inodes[0]; s.addG(a, m, 1 / R); this.cap.stamp(s, m, b, C); s.addG(m, b, 1e-12); }
  }
  stampStep(s) {
    const { L, C } = this.zparts(), k = this.constructor.kind;
    if (k === 'RL') this.rl.step(s, this.branches[0], L);
    else if (k === 'RC') this.cap.step(s, this.inodes[0], this.nodes[1], C);
  }
  accept(s) {
    const { R, C } = this.zparts(), [a, b] = this.nodes, k = this.constructor.kind;
    if (k === 'R') this.setCurrent((s.v(a) - s.v(b)) / R);
    else if (k === 'RL') { this.rl.accept(s, a, b, this.branches[0], R); this.setCurrent(this.rl.i); } else { const m = this.inodes[0]; this.cap.accept(s, m, b, C); this.setCurrent((s.v(a) - s.v(m)) / R); }
  }
  stampAC(ac) {
    const { R, L, C } = this.zparts(), [a, b] = this.nodes, k = this.constructor.kind;
    if (k === 'R') ac.addY(a, b, 1 / R);
    else if (k === 'RL') this.rl.ac(ac, a, b, this.branches[0], R, L);
    else { const m = this.inodes[0]; ac.addY(a, m, 1 / R); ac.addY(m, b, 1e-12, ac.omega * C); }
  }
  valueLabel() { return this.constructor.kind === 'R' ? fmtShort(this.p.p, 'W') : `${fmtShort(this.p.p, 'W')} pf${+this.p.pf.toFixed(2)}`; }
  readings(s) {
    const z = this.zparts(), k = this.constructor.kind;
    const r = [['R', z.R, 'Ω']];
    if (k === 'RL') r.push(['L', z.L, 'H']);
    if (k === 'RC') r.push(['C', z.C, 'F']);
    return [...r, ['Voltage', this.voltageDiff(s), 'V'], ['Current', this.i, 'A']];
  }
  localBox() { return [-2 * G, -0.75 * G, 2 * G, 0.75 * G]; }
  draw(g) {
    g.box(-G, -0.55 * G, G, 0.55 * G, { stroke: g.grad(-G, 0, G, 0, g.pv(0), g.pv(1)), width: g.lw, fill: g.fill, r: 2 });
    // text runs along the body, so it also fits when the load stands upright
    g.text(this.constructor.kind === 'R' ? 'R' : this.constructor.kind === 'RL' ? 'R+jX' : 'R−jX', 0, 0.5, { size: 7.5, color: g.accent, bold: true, follow: true, maxW: 1.8 * G });
  }
}

function load(type, title, kind, keywords, desc, pdef) {
  const C = class extends RatedLoad {};
  Object.assign(C, { type, title, kind, keywords, description: desc });
  C.props = RatedLoad.props.filter((p) => kind !== 'R' || p.key !== 'pf').map((p) => ({ ...p, def: p.key === 'p' ? pdef : p.key === 'pf' && kind === 'RC' ? 0.9 : p.def }));
  register(C);
}
load('rload', 'Resistive Load (P @ V)', 'R', 'resistive load watt rating power load unity power factor', 'Resistive load specified by its power at rated voltage: R = V²/P.', 1000);
load('rlload', 'Inductive Load (P, pf lag)', 'RL', 'inductive load lagging power factor rl motor load', 'Series R–L load specified by real power and lagging power factor at rated voltage and frequency.', 1000);
load('rcload', 'Capacitive Load (P, pf lead)', 'RC', 'capacitive load leading power factor rc', 'Series R–C load specified by real power and leading power factor at rated voltage and frequency.', 1000);

export class PFCapacitor extends TwoTerm {
  static type = 'pfcap'; static title = 'PF Correction Capacitor (kVAR)'; static category = 'Power Systems';
  static prefix = 'C'; static keywords = 'power factor correction capacitor kvar capacitor bank apfc';
  static props = [
    { key: 'q', label: 'Reactive power Q', unit: 'VAR', def: 500, min: 1, max: 1e9, log: true, knob: true },
    { key: 'v', label: 'Rated voltage (RMS)', unit: 'V', def: 230, min: 1, max: 1e6, log: true },
    { key: 'freq', label: 'Frequency', unit: 'Hz', def: 50, min: 1, max: 1e4 },
  ];
  static description = 'Shunt capacitor rated in VAR: C = Q / (2πf·V²). Connect across an inductive load to raise the power factor.';
  constructor(x, y) { super(x, y); this.cap = new CapHelper(); }
  C() { return this.p.q / (TAU * this.p.freq * this.p.v * this.p.v); }
  reset() { this.cap.reset(0); this.setCurrent(0); }
  stamp(s) { this.cap.stamp(s, this.nodes[0], this.nodes[1], this.C()); s.addG(this.nodes[0], this.nodes[1], 1e-9); }
  stampStep(s) { this.cap.step(s, this.nodes[0], this.nodes[1], this.C()); }
  accept(s) { this.cap.accept(s, this.nodes[0], this.nodes[1], this.C()); this.setCurrent(this.cap.i); }
  stampAC(ac) { ac.addY(this.nodes[0], this.nodes[1], 1e-9, ac.omega * this.C()); }
  valueLabel() { return fmtShort(this.p.q, 'VAR'); }
  readings(s) { return [['Capacitance', this.C(), 'F'], ['Voltage', this.voltageDiff(s), 'V'], ['Current', this.i, 'A']]; }
  leads() { return [[0, -2 * G, 0, -0.22 * G, 0], [1, 2 * G, 0, 0.22 * G, 0]]; }
  draw(g) {
    g.line(-0.22 * G, -0.7 * G, -0.22 * G, 0.7 * G, g.vc(g.pv(0)), g.lw * 1.4);
    g.line(0.22 * G, -0.7 * G, 0.22 * G, 0.7 * G, g.vc(g.pv(1)), g.lw * 1.4);
  }
  localBox() { return [-2 * G, -0.8 * G, 2 * G, 0.8 * G]; }
}
register(PFCapacitor);

// -------------------------------------------------------- 3-phase loads
export class Load3Y extends Element {
  static type = 'load3y'; static title = '3-Phase Load (Star)'; static category = 'Power Systems';
  static prefix = 'Z'; static keywords = 'three phase load star wye balanced rl load 3 phase';
  static props = [
    { key: 'p', label: 'Total real power P', unit: 'W', def: 3000, min: 1e-3, max: 1e9, log: true, knob: true },
    { key: 'pf', label: 'Power factor (lag)', unit: '', def: 0.8, min: 0.05, max: 1 },
    { key: 'vll', label: 'Rated line voltage', unit: 'V', def: 400, min: 1, max: 1e6, log: true },
    { key: 'freq', label: 'Frequency', unit: 'Hz', def: 50, min: 1, max: 1e4 },
    { key: 'unbal', label: 'Phase B imbalance', unit: '%', def: 0, min: -90, max: 300 },
  ];
  static description = 'Balanced star-connected R–L load (R, Y, B and neutral N). Set "imbalance" to load phase B differently and watch the neutral current.';
  static delta = false;
  constructor(x, y) { super(x, y); const n = this.constructor.delta ? 3 : 4; this.postCurrents = new Array(n).fill(0); this.rls = [new RLBranch(), new RLBranch(), new RLBranch()]; }
  localPosts() { return this.constructor.delta ? [[-2 * G, -G], [-2 * G, 0], [-2 * G, G]] : [[-2 * G, -G], [-2 * G, 0], [-2 * G, G], [-2 * G, 2 * G]]; }
  localBox() { return [-2 * G, -1.6 * G, 1.4 * G, this.constructor.delta ? 1.6 * G : 2.4 * G]; }
  leads() { return this.localPosts().map(([x, y], i) => [i, x, y, -G, y]); }
  labelSide() { return [1, 0]; }
  branchCount() { return 3; }
  zp(ph) {
    const d = this.constructor.delta, vph = d ? this.p.vll : this.p.vll / Math.sqrt(3);
    const S = this.p.p / 3 / this.p.pf * (ph === 2 ? 1 + this.p.unbal / 100 : 1), Z = (vph * vph) / Math.max(S, 1e-9);
    return [Z * this.p.pf, (Z * Math.sqrt(1 - this.p.pf ** 2)) / (TAU * this.p.freq)];
  }
  ends(ph) {
    const n = this.nodes;
    if (this.constructor.delta) return [n[ph], n[(ph + 1) % 3]];
    return [n[ph], n[3]];
  }
  reset() { this.rls.forEach((r) => r.reset()); this.postCurrents.fill(0); }
  stamp(s) { for (let p = 0; p < 3; p++) { const [a, b] = this.ends(p), [R, L] = this.zp(p); this.rls[p].stamp(s, a, b, this.branches[p], R, L); } }
  stampStep(s) { for (let p = 0; p < 3; p++) this.rls[p].step(s, this.branches[p], this.zp(p)[1]); }
  accept(s) {
    const ib = [0, 0, 0];
    for (let p = 0; p < 3; p++) { const [a, b] = this.ends(p); this.rls[p].accept(s, a, b, this.branches[p], this.zp(p)[0]); ib[p] = this.rls[p].i; }
    if (this.constructor.delta) this.postCurrents = [ib[0] - ib[2], ib[1] - ib[0], ib[2] - ib[1]];
    else this.postCurrents = [ib[0], ib[1], ib[2], -(ib[0] + ib[1] + ib[2])];
    this.i = this.postCurrents[0];
  }
  stampAC(ac) { for (let p = 0; p < 3; p++) { const [a, b] = this.ends(p), [R, L] = this.zp(p); this.rls[p].ac(ac, a, b, this.branches[p], R, L); } }
  valueLabel() { return `${fmtShort(this.p.p, 'W')} pf${+this.p.pf.toFixed(2)}`; }
  readings() {
    const r = [['I_R', this.postCurrents[0], 'A'], ['I_Y', this.postCurrents[1], 'A'], ['I_B', this.postCurrents[2], 'A']];
    if (!this.constructor.delta) r.push(['I_N', this.postCurrents[3], 'A']);
    return r;
  }
  draw(g) {
    const d = this.constructor.delta;
    g.box(-G, -1.4 * G, 1.2 * G, d ? 1.4 * G : 2.3 * G, { stroke: g.body, width: g.lw * 0.9, fill: g.fill, r: 4 });
    g.upright(() => {
      if (d) g.poly([[0, -0.55 * G], [0.5 * G, 0.35 * G], [-0.5 * G, 0.35 * G]], { stroke: g.accent, width: g.lw * 0.8, close: true });
      else { g.line(0, 0, 0, -0.55 * G, g.accent, g.lw * 0.8); g.line(0, 0, 0.48 * G, 0.3 * G, g.accent, g.lw * 0.8); g.line(0, 0, -0.48 * G, 0.3 * G, g.accent, g.lw * 0.8); }
    }, 0.1 * G, 0);
    ['R', 'Y', 'B', 'N'].slice(0, d ? 3 : 4).forEach((t, i) => g.text(t, -0.72 * G, (i - 1) * G, { size: 6.5, color: g.muted }));
  }
}
register(Load3Y);

export class Load3D extends Load3Y {
  static type = 'load3d'; static title = '3-Phase Load (Delta)'; static delta = true;
  static keywords = 'three phase load delta mesh balanced 3 phase';
  static description = 'Balanced delta-connected R–L load across R–Y, Y–B, B–R. Line current = √3 × phase current.';
}
register(Load3D);

// ------------------------------------------------------ transmission lines
export class ShortLine extends TwoTerm {
  static type = 'sline'; static title = 'Short Transmission Line'; static category = 'Power Systems';
  static prefix = 'TL'; static keywords = 'short transmission line feeder cable impedance r x per km';
  static props = [
    { key: 'len', label: 'Length', unit: 'km', def: 10, min: 0.001, max: 1000, log: true, knob: true },
    { key: 'r', label: 'Resistance per km', unit: 'Ω', def: 0.2, min: 0, max: 100 },
    { key: 'x', label: 'Reactance per km (at f)', unit: 'Ω', def: 0.4, min: 0, max: 100 },
    { key: 'freq', label: 'Frequency', unit: 'Hz', def: 50, min: 1, max: 1e4 },
  ];
  static description = 'Short line model (< 80 km): series impedance Z = (r + jx)·length. Shows voltage drop and losses.';
  constructor(x, y) { super(x, y); this.rl = new RLBranch(); }
  RL() { return [this.p.r * this.p.len, (this.p.x * this.p.len) / (TAU * this.p.freq)]; }
  branchCount() { return 1; }
  reset() { this.rl.reset(); this.setCurrent(0); }
  stamp(s) { const [R, L] = this.RL(); this.rl.stamp(s, this.nodes[0], this.nodes[1], this.branches[0], R, L); }
  stampStep(s) { this.rl.step(s, this.branches[0], this.RL()[1]); }
  accept(s) { this.rl.accept(s, this.nodes[0], this.nodes[1], this.branches[0], this.RL()[0]); this.setCurrent(this.rl.i); }
  stampAC(ac) { const [R, L] = this.RL(); this.rl.ac(ac, this.nodes[0], this.nodes[1], this.branches[0], R, L); }
  valueLabel() { return `${fmtQty(this.p.len, '')}km`; }
  readings(s) { const [R, L] = this.RL(); return [['R', R, 'Ω'], ['L', L, 'H'], ['Voltage drop', this.voltageDiff(s), 'V'], ['Current', this.i, 'A'], ['Loss (inst.)', this.i * this.i * R, 'W']]; }
  localBox() { return [-2 * G, -0.7 * G, 2 * G, 0.7 * G]; }
  draw(g) {
    g.box(-1.2 * G, -0.35 * G, 1.2 * G, 0.35 * G, { stroke: g.grad(-G, 0, G, 0, g.pv(0), g.pv(1)), width: g.lw, fill: g.fill });
    for (const x of [-0.6, 0, 0.6]) g.line(x * G - 3, 0.35 * G, x * G + 3, -0.35 * G, g.muted, g.lw * 0.5);
  }
}
register(ShortLine);

export class PiLine extends Element {
  static type = 'piline'; static title = 'Medium Line (Nominal-π)'; static category = 'Power Systems';
  static prefix = 'TL'; static keywords = 'medium transmission line nominal pi model ferranti effect charging current';
  static props = [
    { key: 'len', label: 'Length', unit: 'km', def: 150, min: 0.1, max: 1000, log: true, knob: true },
    { key: 'r', label: 'Resistance per km', unit: 'Ω', def: 0.1, min: 0, max: 100 },
    { key: 'x', label: 'Reactance per km', unit: 'Ω', def: 0.4, min: 0, max: 100 },
    { key: 'b', label: 'Shunt susceptance per km', unit: 'S', def: 3e-6, min: 0, max: 1e-3 },
    { key: 'freq', label: 'Frequency', unit: 'Hz', def: 50, min: 1, max: 1e4 },
  ];
  static description = 'Nominal-π line: series Z = (r + jx)·ℓ with half the shunt capacitance Y/2 at each end. Sending end on the left, receiving end on the right, common return at the bottom. Try an open receiving end to see the Ferranti effect.';
  constructor(x, y) { super(x, y); this.postCurrents = [0, 0, 0]; this.rl = new RLBranch(); this.c1 = new CapHelper(); this.c2 = new CapHelper(); }
  localPosts() { return [[-3 * G, 0], [3 * G, 0], [0, 2 * G]]; }
  localBox() { return [-3 * G, -0.8 * G, 3 * G, 2 * G]; }
  leads() { return [[0, -3 * G, 0, -2 * G, 0], [1, 3 * G, 0, 2 * G, 0], [2, 0, 2 * G, 0, 1.4 * G]]; }
  branchCount() { return 1; }
  vals() { const w = TAU * this.p.freq; return { R: this.p.r * this.p.len, L: (this.p.x * this.p.len) / w, C: (this.p.b * this.p.len) / w / 2 }; }
  reset() { this.rl.reset(); this.c1.reset(0); this.c2.reset(0); this.postCurrents.fill(0); }
  stamp(s) {
    const { R, L, C } = this.vals(), [a, b, n] = this.nodes;
    this.rl.stamp(s, a, b, this.branches[0], R, L);
    this.c1.stamp(s, a, n, C); this.c2.stamp(s, b, n, C);
    s.addG(a, n, 1e-12); s.addG(b, n, 1e-12);
  }
  stampStep(s) { const { L, C } = this.vals(), [a, b, n] = this.nodes; this.rl.step(s, this.branches[0], L); this.c1.step(s, a, n, C); this.c2.step(s, b, n, C); }
  accept(s) {
    const { R, C } = this.vals(), [a, b, n] = this.nodes;
    this.rl.accept(s, a, b, this.branches[0], R); this.c1.accept(s, a, n, C); this.c2.accept(s, b, n, C);
    const i = this.rl.i;
    this.postCurrents = [i + this.c1.i, -i + this.c2.i, -(this.c1.i + this.c2.i)]; this.i = this.postCurrents[0];
  }
  stampAC(ac) {
    const { R, L, C } = this.vals(), [a, b, n] = this.nodes;
    this.rl.ac(ac, a, b, this.branches[0], R, L);
    ac.addY(a, n, 1e-12, ac.omega * C); ac.addY(b, n, 1e-12, ac.omega * C);
  }
  valueLabel() { return `${fmtQty(this.p.len, '')}km`; }
  readings(s) {
    const [a, b, n] = this.nodes, v = this.vals();
    return [['V sending', s.v(a) - s.v(n), 'V'], ['V receiving', s.v(b) - s.v(n), 'V'], ['I sending', this.postCurrents[0], 'A'], ['I receiving', -this.postCurrents[1], 'A'], ['R', v.R, 'Ω'], ['L', v.L, 'H'], ['C/2 each end', v.C, 'F']];
  }
  draw(g) {
    g.line(-2 * G, 0, -1.2 * G, 0, g.vc(g.pv(0)), g.lw);
    g.box(-1.2 * G, -0.35 * G, 1.2 * G, 0.35 * G, { stroke: g.body, width: g.lw * 0.9, fill: g.fill });
    g.text('R+jX', 0, 0.5, { size: 7, color: g.accent, bold: true, follow: true, maxW: 2.2 * G });
    g.line(1.2 * G, 0, 2 * G, 0, g.vc(g.pv(1)), g.lw);
    for (const sx of [-1, 1]) {
      const x = sx * 1.6 * G;
      g.line(x, 0, x, 0.55 * G, g.body, g.lw * 0.8);
      g.line(x - 0.35 * G, 0.55 * G, x + 0.35 * G, 0.55 * G, g.body, g.lw);
      g.line(x - 0.35 * G, 0.8 * G, x + 0.35 * G, 0.8 * G, g.body, g.lw);
      g.line(x, 0.8 * G, x, 1.4 * G, g.body, g.lw * 0.8);
    }
    g.line(-1.6 * G, 1.4 * G, 1.6 * G, 1.4 * G, g.vc(g.pv(2)), g.lw * 0.8);
  }
}
register(PiLine);
