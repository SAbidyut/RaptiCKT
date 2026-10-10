// Protection devices: MCB (1/2/3-pole), MCCB, RCCB, RCBO, resettable PTC fuse,
// HRC fuse, MOV varistor, surge arrester, gas discharge tube, TVS diodes,
// thermal overload relay and IDMT overcurrent relay.
//
// Trip models follow the standards' characteristic points:
//  - MCB thermal (IEC 60898): no trip at 1.13·In, trip within 1 h at 1.45·In,
//    1–60 s at 2.55·In (thermal element dθ/dt = ((i/In)² − θ)/τ, trips at θ = 1.3²)
//  - MCB magnetic: instantaneous above 4 / 7.5 / 15 × In (B / C / D curve, mid-band)
//  - RCD (IEC 61008): trips at ≥ IΔn residual RMS, not at ≤ 0.5·IΔn
//  - IDMT (IEC 60255): t = TMS·k / ((I/Is)^α − 1)

import { Element, TwoTerm, register, GRID } from './base.js';
import { Fuse } from './passive.js';
import { Zener } from './semis.js';
import { Composite } from './kit.js';
import { pnjlim } from '../engine/sim.js';
import { fmtShort, fmtSI } from '../engine/units.js';

const G = GRID;

function stampSw(s, a, b, k, closed, ron) {
  s.addBranchKCL(a, b, k);
  if (closed) { s.addA(k, a - 1, 1); s.addA(k, b - 1, -1); s.addA(k, k, -Math.max(ron, 1e-6)); } else s.addA(k, k, 1);
}
function stampSwAC(ac, a, b, k, closed, ron) {
  ac.addBranchKCL(a, b, k);
  if (closed) { ac.addA(k, a - 1, 1); ac.addA(k, b - 1, -1); ac.addA(k, k, -Math.max(ron, 1e-6)); } else ac.addA(k, k, 1);
}

const MAG = { B: 4, C: 7.5, D: 15 };

// ------------------------------------------------------------------- MCB
class Breaker extends Element {
  static category = 'Protection';
  static prefix = 'Q';
  static poles = 1;
  static rcd = false; static ocp = true;
  interactive = true;
  constructor(x, y) {
    super(x, y);
    this.postCurrents = new Array(this.localPosts().length).fill(0);
    this.tripped = false; this.theta = 0; this.cause = '';
  }
  npoles() { return this.constructor.poles; }
  localPosts() {
    const n = this.npoles(), ys = n === 1 ? [0] : n === 2 ? [-G, G] : [-2 * G, 0, 2 * G];
    return [...ys.map((y) => [-2 * G, y]), ...ys.map((y) => [2 * G, y])];
  }
  localBox() { const n = this.npoles(), h = n === 1 ? 1.1 * G : n === 2 ? 2 * G : 3 * G; return [-2 * G, -h, 2 * G, h]; }
  leads() { const n = this.npoles(); return this.localPosts().map(([x, y], i) => [i, x, y, Math.sign(x) * 0.9 * G, y]); }
  connectivity() { const n = this.npoles(); return Array.from({ length: n }, (_, k) => [k, k + n]); }
  branchCount() { return this.npoles(); }
  closed() { return !!this.p.on && !this.tripped && !this.damaged; }
  reset() { this.tripped = false; this.theta = 0; this.cause = ''; this.res2 = 0; this.opening = 0; this.ipk = 0; this.postCurrents.fill(0); this.i = 0; }
  ratedI() { return this.p.in; }
  stamp(s) {
    const n = this.npoles();
    for (let k = 0; k < n; k++) stampSw(s, this.nodes[k], this.nodes[k + n], this.branches[k], this.closed(), 0.004);
  }
  stampAC(ac) {
    const n = this.npoles();
    for (let k = 0; k < n; k++) stampSwAC(ac, this.nodes[k], this.nodes[k + n], this.branches[k], this.closed(), 0.004);
  }
  trip(s, why) { if (!this.tripped) { this.tripped = true; this.cause = why; s.markEvent(); } }
  accept(s) {
    const n = this.npoles(), is = this.branches.map((k) => s.x[k]);
    is.forEach((i, k) => { this.postCurrents[k] = i; this.postCurrents[k + n] = -i; });
    this.i = is[0];
    if (s.mode === 'dc') return;
    if (!this.closed()) { // open: the bimetal cools down
      this.theta -= this.theta * Math.min(1, s.heatDt() / this.thermalTau());
      this.stress = 0;
      return;
    }
    const In = this.ratedI(), imax = Math.max(...is.map(Math.abs));
    // the bimetal heats on the thermal clock, so overload trips take real seconds
    this.theta += ((imax / In) ** 2 - this.theta) * Math.min(1, s.heatDt() / this.thermalTau());
    this.stress = Math.max(0, Math.min(1, (this.theta - 1) / (this.constructor.ocp ? 0.69 : 1.1)));
    if (this.constructor.ocp) {
      // magnetic release: the contacts part a few ms after the coil picks up, while the fault
      // current keeps rising towards its prospective peak — more than the breaking capacity
      // and the arc cannot be broken: the breaker is destroyed.
      if (this.opening > 0) {
        this.ipk = Math.max(this.ipk, imax);
        this.opening -= s.dt;
        if (this.opening <= 0) {
          if (this.p.icn && this.ipk > Math.SQRT2 * this.p.icn) this.setDamage(s, `Destroyed — fault current ${fmtShort(this.ipk / Math.SQRT2, 'A')} RMS is above its breaking capacity Icn ${fmtShort(this.p.icn, 'A')}`);
          this.trip(s, 'Short circuit (magnetic trip)');
        }
      } else if (imax > Math.SQRT2 * this.magMultiple() * In) { this.opening = 0.003; this.ipk = imax; }
      else if (this.theta >= 1.69) this.trip(s, 'Overload (thermal trip)');
    } else if (this.theta >= 2.1) {
      // an RCCB has no overcurrent release: a sustained overload cooks it
      this.setDamage(s, `Burnt — overloaded at about ${fmtShort(In * Math.sqrt(this.theta), 'A')} on a ${fmtShort(In, 'A')} RCCB, which has no overcurrent protection (put an MCB of ≤ ${fmtShort(In, 'A')} before it)`);
    }
    if (this.constructor.rcd) {
      // residual current: sum of all pole currents (should be zero for a healthy circuit)
      const ir = is.reduce((a, b) => a + b, 0);
      this.res2 += (ir * ir - this.res2) * Math.min(1, s.dt / 0.01);
      if (Math.sqrt(this.res2) > 0.8 * this.p.idn) this.trip(s, 'Earth leakage (residual current)');
    }
  }
  thermalTau() { return 60; }
  magMultiple() { return MAG[this.p.curve] || 7.5; }
  onTap() {
    if (this.damaged) return false;
    this.opening = 0;
    if (this.tripped) { this.tripped = false; this.theta = 0; this.res2 = 0; this.p.on = true; this.cause = ''; } else this.p.on = !this.p.on;
    return true;
  }
  // residual-current devices also show their trip sensitivity (e.g. "40A 30mA")
  valueLabel() { return `${this.p.curve || ''}${fmtShort(this.p.in, 'A')}${this.constructor.rcd ? ' ' + fmtShort(this.p.idn, 'A') : ''}`; }
  readings() {
    const r = [['State', this.damaged ? 'DESTROYED — ' + this.damaged.why : this.tripped ? 'TRIPPED — ' + this.cause : this.closed() ? 'ON' : 'OFF', ''], ['Current', this.i, 'A']];
    r.push([this.constructor.ocp ? 'Thermal load' : 'Overload heating', Math.min(100, (this.theta / (this.constructor.ocp ? 1.69 : 2.1)) * 100), '%']);
    if (this.p.icn) r.push(['Breaking capacity Icn', this.p.icn, 'A']);
    if (this.constructor.rcd) r.push(['Residual current (RMS)', Math.sqrt(this.res2 || 0), 'A']);
    return r;
  }
  draw(g) {
    const n = this.npoles(), [, y1, , y2] = this.localBox();
    g.box(-0.9 * G, y1 + 2, 0.9 * G, y2 - 2, { stroke: g.body, width: g.lw * 0.9, fill: g.fill, r: 4 });
    const on = this.closed();
    this.localPosts().slice(0, n).forEach(([, y], k) => {
      const c0 = g.vc(g.pv(k)), c1 = g.vc(g.pv(k + n));
      g.line(-0.9 * G, y, -0.45 * G, y, c0, g.lw);
      g.line(0.45 * G, y, 0.9 * G, y, c1, g.lw);
      if (this.constructor.ocp) { const d = 0.17 * G; g.line(0.45 * G - d, y - d, 0.45 * G + d, y + d, g.body, g.lw * 0.8); g.line(0.45 * G - d, y + d, 0.45 * G + d, y - d, g.body, g.lw * 0.8); } // IEC breaker ×
      else g.circle(0.45 * G, y, 2.4, { fill: c1 });
      if (on) g.line(-0.45 * G, y, 0.45 * G, y, c0, g.lw * 1.1);
      else g.line(-0.45 * G, y, 0.3 * G, y - 0.45 * G, g.body, g.lw * 1.1);
    });
    // mechanical link joining the poles: dashed, like the IEC symbol
    const ys = this.localPosts().slice(0, n).map(([, y]) => y);
    if (n > 1) g.poly([[0, Math.min(...ys)], [0, Math.max(...ys)]], { stroke: g.muted, width: g.lw * 0.5, dash: [3, 3] });
    // residual-current mark in the free corner below the last pole, clear of the link
    if (this.constructor.rcd) g.upright(() => g.text('Δ', 0, 0, { size: 8.5, color: g.accent, bold: true }), -0.5 * G, y2 - 0.5 * G);
    if (this.tripped) g.glow(0, 0, 1.4 * G, '255,70,70', 0.45);
    g.circle(0.6 * G, y1 + 0.45 * G, 3, { fill: this.tripped ? '#ef4444' : on ? g.hi : g.lo });
  }
}

const IN = (def) => ({ key: 'in', label: 'Rated current In', unit: 'A', def, min: 0.1, max: 6300, log: true, knob: true });
const CURVE = { key: 'curve', label: 'Trip curve', type: 'select', def: 'C', options: [['B', 'B (3–5 In) lighting'], ['C', 'C (5–10 In) general'], ['D', 'D (10–20 In) motors']] };
const ON = { key: 'on', label: 'Switched on', type: 'bool', def: true };
const ICN = (def) => ({ key: 'icn', label: 'Breaking capacity Icn', unit: 'A', def, min: 1000, max: 2e5, log: true });
const IDN = { key: 'idn', label: 'Rated residual current IΔn', unit: 'A', def: 0.03, min: 0.006, max: 1, log: true };

function breaker(type, title, poles, props, keywords, desc, extra = {}) {
  const C = class extends Breaker {};
  Object.assign(C, { type, title, poles, props, keywords, description: desc }, extra);
  register(C);
  return C;
}

breaker('mcb', 'MCB (1-pole)', 1, [IN(16), CURVE, ICN(6000), ON], 'mcb miniature circuit breaker breaker overload short circuit protection',
  'Miniature circuit breaker (IEC 60898): thermal trip for overloads (runs in real time: about 20 s at 2.5 × In), magnetic (instantaneous) trip for short circuits. A fault current above its breaking capacity Icn destroys it. Tap to switch ON/OFF or to reset after a trip.');
breaker('mcb2p', 'MCB (2-pole)', 2, [IN(32), CURVE, ICN(6000), ON], 'mcb double pole dp breaker isolator line neutral',
  'Double-pole MCB: both poles open together when either one trips.');
breaker('mcb3p', 'MCB (3-pole)', 3, [IN(32), CURVE, ICN(10000), ON], 'mcb triple pole tp breaker three phase',
  'Triple-pole MCB for three-phase circuits: all poles open together.');

export class MCCB extends Breaker {
  static type = 'mccb'; static title = 'MCCB (3-pole, adjustable)'; static poles = 3;
  static keywords = 'mccb moulded case circuit breaker adjustable thermal magnetic ir im';
  static props = [IN(100),
    { key: 'ir', label: 'Thermal setting Ir/In', unit: '', def: 1, min: 0.4, max: 1 },
    { key: 'im', label: 'Magnetic setting Im/Ir', unit: '', def: 10, min: 2, max: 15 }, ICN(25000), ON];
  static description = 'Moulded-case circuit breaker with adjustable thermal (Ir) and magnetic (Im) settings.';
  ratedI() { return this.p.in * this.p.ir; }
  magMultiple() { return this.p.im; }
  thermalTau() { return 120; }
  valueLabel() { return fmtShort(this.p.in * this.p.ir, 'A'); }
}
register(MCCB);

breaker('rccb', 'RCCB / RCD (2-pole)', 2, [{ ...IN(40), knob: false }, { ...IDN, knob: true }, ON], 'rccb rcd elcb earth leakage residual current device shock protection 30ma',
  'Residual-current device: trips when the current going out on L does not return on N (leakage to earth ≥ IΔn, e.g. 30 mA through a person). No overcurrent protection: a sustained overload above In burns it out, so always put an MCB before it.',
  { rcd: true, ocp: false });
breaker('rcbo', 'RCBO (2-pole)', 2, [IN(16), CURVE, IDN, ICN(6000), ON], 'rcbo rcd mcb combined earth leakage overcurrent',
  'RCBO = RCD + MCB: trips on earth leakage (≥ IΔn) and on overload / short circuit.',
  { rcd: true, ocp: true });

// -------------------------------------------------------- resettable fuse
export class PolyFuse extends TwoTerm {
  static type = 'polyfuse'; static title = 'Resettable Fuse (PTC)'; static category = 'Protection';
  static prefix = 'F'; static keywords = 'polyfuse ptc resettable fuse polyswitch overcurrent';
  static props = [
    { key: 'ih', label: 'Hold current', unit: 'A', def: 0.5, min: 1e-3, max: 100, log: true, knob: true },
    { key: 'r0', label: 'Cold resistance', unit: 'Ω', def: 0.3, min: 1e-3, max: 100, log: true },
    { key: 'tau', label: 'Thermal time constant', unit: 's', def: 0.5, min: 1e-3, max: 100, log: true },
  ];
  static description = 'Polymer PTC fuse: self-heating raises its resistance by orders of magnitude above the trip current (≈2·Ihold); it resets once the fault is removed and it cools.';
  reset() { this.T = 25; this.R = this.p.r0; this.ft = 0; this.setCurrent(0); }
  resist(T) { return this.p.r0 * (1 + 2e4 / (1 + Math.exp(-(T - 125) / 4))); }
  stamp(s) { s.addG(this.nodes[0], this.nodes[1], 1 / (this.R ?? this.p.r0)); }
  stampAC(ac) { ac.addY(this.nodes[0], this.nodes[1], 1 / (this.R ?? this.p.r0)); }
  accept(s) {
    const v = this.voltageDiff(s), i = v / this.R;
    this.setCurrent(i);
    if (s.mode === 'dc') return;
    // thermal resistance chosen so 1.5·Ihold heats it to the 125 °C switching point
    const rth = 100 / (2.25 * this.p.ih * this.p.ih * this.p.r0), cth = this.p.tau / rth;
    const dt = s.heatDtAt(Math.abs(i) / (2 * this.p.ih), this);
    this.T += ((v * i - (this.T - 25) / rth) / cth) * dt;
    this.T = Math.min(400, Math.max(25, this.T));
    const R = this.resist(this.T);
    if (Math.abs(R - this.R) > 0.02 * this.R) { this.R = R; s.dirty = true; }
  }
  valueLabel() { return fmtShort(this.p.ih, 'A'); }
  readings(s) { return [['State', this.R > 10 * this.p.r0 ? 'TRIPPED (hot)' : 'Conducting', ''], ['Temperature', this.T ?? 25, '°C'], ['Resistance', this.R ?? this.p.r0, 'Ω'], ['Current', this.i, 'A'], ['Voltage', this.voltageDiff(s), 'V']]; }
  draw(g) {
    const hot = (this.R ?? 0) > 10 * this.p.r0;
    if (hot) g.glow(0, 0, G * 1.2, '255,90,40', 0.4);
    g.box(-G, -0.35 * G, G, 0.35 * G, { stroke: g.grad(-G, 0, G, 0, g.pv(0), g.pv(1)), width: g.lw, fill: hot ? 'rgba(255,90,40,0.25)' : g.fill, r: 3 });
    g.poly([[-0.9 * G, 0.6 * G], [-0.5 * G, 0.6 * G], [0.6 * G, -0.65 * G]], { stroke: g.body, width: g.lw * 0.7 });
  }
}
register(PolyFuse);

export class HRCFuse extends Fuse {
  static type = 'hrcfuse'; static title = 'HRC Fuse'; static category = 'Protection';
  static keywords = 'hrc fuse high rupturing capacity cartridge link power';
  static props = Fuse.props.map((p) => ({ ...p, def: { rating: 63, r: 0.001, i2t: 8000 }[p.key] ?? p.def }));
  static description = 'High-rupturing-capacity cartridge fuse for power circuits. Melts when ∫(i² − I²rated)dt exceeds its I²t.';
  draw(g) {
    g.box(-G, -0.4 * G, G, 0.4 * G, { stroke: g.body, width: g.lw * 0.9, fill: g.fill, r: 2 });
    g.line(-0.7 * G, -0.4 * G, -0.7 * G, 0.4 * G, g.body, g.lw * 0.6);
    g.line(0.7 * G, -0.4 * G, 0.7 * G, 0.4 * G, g.body, g.lw * 0.6);
    if (this.blown) { g.glow(0, 0, G, '255,80,40', 0.35); g.line(-0.5 * G, 0.2 * G, 0.5 * G, -0.2 * G, '#ef4444', g.lw); } else g.line(-G, 0, G, 0, g.grad(-G, 0, G, 0, g.pv(0), g.pv(1)), g.lw * 0.8);
  }
}
register(HRCFuse);

// ------------------------------------------------------------- varistors
export class MOV extends TwoTerm {
  static type = 'mov'; static title = 'Varistor (MOV)'; static category = 'Protection';
  static prefix = 'RV'; static keywords = 'mov varistor metal oxide surge suppressor transient voltage clamp';
  static props = [
    { key: 'v1', label: 'Varistor voltage (at 1 mA)', unit: 'V', def: 430, min: 1, max: 1e6, log: true, knob: true },
    { key: 'alpha', label: 'Nonlinearity exponent α', unit: '', def: 30, min: 5, max: 80 },
  ];
  static description = 'Metal-oxide varistor: I ≈ 1 mA·(V/V1mA)^α (exponential approximation). Nearly open at normal voltage, clamps surges. 430 V type suits 230 V mains.';
  nonlinear = true;
  reset() { this.vd = 0; this.setCurrent(0); }
  vs() { return this.p.v1 / this.p.alpha; }
  iv(v) {
    const vs = this.vs(), I1 = 1e-3;
    const ex = (x) => Math.exp(Math.min(80, x));
    const ep = ex((v - this.p.v1) / vs), en = ex((-v - this.p.v1) / vs);
    return { i: I1 * (ep - en) + v * 1e-9, g: (I1 / vs) * (ep + en) + 1e-9 };
  }
  stampNL(s) {
    const [a, b] = this.nodes, vs = this.vs(), vc = vs * Math.log(vs / (Math.SQRT2 * 1e-3));
    let v = s.v(a) - s.v(b);
    const old = this.vd;
    // junction-style limiting on whichever side is conducting
    if (v > 0) { const r = pnjlim(v - this.p.v1, old - this.p.v1, vs, vc); if (r.limited) { v = r.v + this.p.v1; s.limited = true; } } else { const r = pnjlim(-v - this.p.v1, -old - this.p.v1, vs, vc); if (r.limited) { v = -(r.v + this.p.v1); s.limited = true; } }
    this.vd = v;
    const { i, g } = this.iv(v);
    s.addG(a, b, g); s.addI(a, b, i - g * v);
  }
  accept(s) { const v = this.voltageDiff(s); this.vd = v; this.setCurrent(this.iv(v).i); }
  stampAC(ac) { ac.addY(this.nodes[0], this.nodes[1], this.iv(this.vd || 0).g); }
  valueLabel() { return fmtShort(this.p.v1, 'V'); }
  readings(s) { const v = this.voltageDiff(s); return [['Voltage', v, 'V'], ['Current', this.i, 'A'], ['Power', v * this.i, 'W']]; }
  draw(g) {
    const grad = g.grad(-G, 0, G, 0, g.pv(0), g.pv(1));
    g.box(-G, -0.35 * G, G, 0.35 * G, { stroke: grad, width: g.lw, fill: g.fill, r: 2 });
    g.poly([[-0.9 * G, 0.6 * G], [-0.6 * G, 0.6 * G], [0.6 * G, -0.6 * G]], { stroke: g.body, width: g.lw * 0.7 });
    g.upright(() => g.text('U', 0, 0.5, { size: 7.5, color: g.muted, bold: true }), -0.55 * G, 0); // beside the slash, not on it
    if (g.running && Math.abs(this.i) > 1e-3) g.glow(0, 0, G * 1.2, '255,170,60', Math.min(0.8, Math.abs(this.i) / 10));
  }
}
register(MOV);

export class SurgeArrester extends MOV {
  static type = 'arrester'; static title = 'Surge / Lightning Arrester'; static category = 'Protection';
  static prefix = 'LA'; static keywords = 'lightning arrester surge arrester spd distribution line protection';
  static props = MOV.props.map((p) => ({ ...p, def: { v1: 15000, alpha: 40 }[p.key] ?? p.def, max: p.key === 'v1' ? 1e6 : p.max }));
  static description = 'Metal-oxide surge arrester for power lines (e.g. 11 kV system): conducts heavily above its reference voltage and diverts surges to earth.';
  valueLabel() { return fmtShort(this.p.v1, 'V'); }
  draw(g) {
    g.box(-0.9 * G, -0.45 * G, 0.9 * G, 0.45 * G, { stroke: g.body, width: g.lw * 0.9, fill: g.fill, r: 2 });
    g.poly([[-0.45 * G, -0.25 * G], [0.1 * G, 0.15 * G], [-0.1 * G, -0.1 * G], [0.45 * G, 0.25 * G]], { stroke: '#facc15', width: g.lw * 0.8 });
    if (g.running && Math.abs(this.i) > 0.01) g.glow(0, 0, G * 1.3, '255,220,80', 0.6);
  }
}
register(SurgeArrester);

export class GDT extends TwoTerm {
  static type = 'gdt'; static title = 'Gas Discharge Tube'; static category = 'Protection';
  static prefix = 'GDT'; static keywords = 'gdt gas discharge tube spark gap surge telecom';
  static props = [
    { key: 'vspark', label: 'Spark-over voltage', unit: 'V', def: 230, min: 10, max: 1e5, log: true, knob: true },
    { key: 'varc', label: 'Arc voltage', unit: 'V', def: 15, min: 1, max: 1000 },
    { key: 'ihold', label: 'Extinction current', unit: 'A', def: 0.1, min: 1e-4, max: 100, log: true },
  ];
  static description = 'Gas discharge tube: open until the voltage exceeds the spark-over value, then an arc (≈15 V) conducts until the current falls below the extinction current.';
  reset() { this.on = false; this.sgn = 1; this.setCurrent(0); }
  stamp(s) { s.addG(this.nodes[0], this.nodes[1], this.on ? 1 : 1e-10); }
  stampStep(s) { if (this.on) s.addI(this.nodes[0], this.nodes[1], this.sgn * this.p.varc); }
  accept(s) {
    const v = this.voltageDiff(s);
    const i = this.on ? v - this.sgn * this.p.varc : v * 1e-10;
    this.setCurrent(i);
    if (s.mode === 'dc') return;
    if (!this.on && Math.abs(v) > this.p.vspark) { this.on = true; this.sgn = Math.sign(v); s.markEvent(); } else if (this.on && (Math.abs(i) < this.p.ihold || Math.sign(i) !== this.sgn)) { this.on = false; s.markEvent(); }
  }
  stampAC(ac) { ac.addY(this.nodes[0], this.nodes[1], this.on ? 1 : 1e-10); }
  valueLabel() { return fmtShort(this.p.vspark, 'V'); }
  readings(s) { return [['State', this.on ? 'Arc (conducting)' : 'Open', ''], ['Voltage', this.voltageDiff(s), 'V'], ['Current', this.i, 'A']]; }
  draw(g) {
    g.circle(0, 0, 0.75 * G, { stroke: g.body, width: g.lw * 0.9, fill: this.on ? 'rgba(180,120,255,0.35)' : g.fill });
    g.poly([[-0.75 * G, 0], [-0.2 * G, 0], [-0.2 * G, -0.3 * G]], { stroke: g.vc(g.pv(0)), width: g.lw });
    g.poly([[0.75 * G, 0], [0.2 * G, 0], [0.2 * G, 0.3 * G]], { stroke: g.vc(g.pv(1)), width: g.lw });
    g.circle(0.35 * G, -0.35 * G, 1.8, { fill: g.body });
    if (this.on) g.glow(0, 0, G * 1.2, '180,120,255', 0.6);
  }
}
register(GDT);

// ------------------------------------------------------------------- TVS
export class TVS extends Zener {
  static type = 'tvs'; static title = 'TVS Diode'; static category = 'Protection';
  static keywords = 'tvs transient voltage suppressor diode smbj p6ke esd clamp unidirectional';
  static props = [
    { key: 'model', label: 'Model', type: 'select', def: 'custom', options: [['custom', 'Custom']] },
    { key: 'is', label: 'Saturation current Is', unit: 'A', def: 1e-12, min: 1e-20, max: 1e-3, log: true, hidden: true },
    { key: 'n', label: 'Emission coefficient n', unit: '', def: 1.5, min: 0.5, max: 5, hidden: true },
    { key: 'bv', label: 'Breakdown voltage', unit: 'V', def: 15, min: 1, max: 1000, knob: true },
  ];
  static description = 'Unidirectional transient-voltage-suppression diode: clamps at its breakdown voltage in reverse, conducts like a diode forward.';
  valueLabel() { return fmtShort(this.p.bv, 'V'); }
}
register(TVS);

export class TVSBi extends Composite {
  static type = 'tvsbi'; static title = 'TVS Diode (bidirectional)'; static category = 'Protection';
  static prefix = 'D'; static keywords = 'tvs bidirectional transient suppressor esd clamp ac';
  static props = [{ key: 'bv', label: 'Clamping voltage', unit: 'V', def: 15, min: 1.5, max: 1000, knob: true }];
  static description = 'Bidirectional TVS: two junctions back to back; clamps at about ±V in either polarity.';
  ownInternal() { return 1; }
  parts() { return [[new TVS(0, 0), [0, 'i0']], [new TVS(0, 0), [1, 'i0']]]; }
  sync() { for (const s of this.subs || []) { s.el.p.bv = Math.max(0.8, this.p.bv - 0.65); s.el.onParamChange(); } }
  valueLabel() { return `±${fmtShort(this.p.bv, 'V')}`; }
  leads() { return [[0, -2 * G, 0, -G * 0.9, 0], [1, 2 * G, 0, G * 0.9, 0]]; }
  readings(s) { return [['Voltage', s.v(this.nodes[0]) - s.v(this.nodes[1]), 'V'], ['Current', this.postCurrents[0], 'A']]; }
  draw(g) {
    const h = 0.45 * G, c0 = g.vc(g.pv(0)), c1 = g.vc(g.pv(1));
    g.poly([[-0.9 * G, -h], [0, 0], [-0.9 * G, h]], { stroke: c0, width: g.lw, fill: g.fill, close: true });
    g.poly([[0.9 * G, -h], [0, 0], [0.9 * G, h]], { stroke: c1, width: g.lw, fill: g.fill, close: true });
    g.poly([[-0.2 * G, -h - 3], [0, -h], [0, h], [0.2 * G, h + 3]], { stroke: g.body, width: g.lw * 1.1 });
  }
}
register(TVSBi);

// ------------------------------------------------------- overload relays
export class OverloadRelay extends Element {
  static type = 'olr'; static title = 'Thermal Overload Relay'; static category = 'Protection';
  static prefix = 'F'; static keywords = 'overload relay thermal olr bimetal motor protection class 10 95 96';
  static props = [
    { key: 'ir', label: 'Current setting Ir', unit: 'A', def: 5, min: 0.1, max: 1000, log: true, knob: true },
  ];
  static description = 'Motor overload relay (IEC 60947-4-1, class 10): the heater carries the motor current; when it trips, the NC control contact (95–96) opens. Tap to reset.';
  interactive = true;
  constructor(x, y) { super(x, y); this.postCurrents = [0, 0, 0, 0]; this.tripped = false; this.theta = 0; }
  // 0,1: heater (main path); 2,3: NC contact 95-96
  localPosts() { return [[-2 * G, -G], [2 * G, -G], [-2 * G, G], [2 * G, G]]; }
  localBox() { return [-2 * G, -1.8 * G, 2 * G, 1.8 * G]; }
  leads() { return this.localPosts().map(([x, y], i) => [i, x, y, Math.sign(x) * 0.9 * G, y]); }
  connectivity() { return [[0, 1], [2, 3]]; }
  branchCount() { return 2; }
  reset() { this.tripped = false; this.theta = 0; this.postCurrents.fill(0); }
  stamp(s) {
    const [a, b, c, d] = this.nodes, [k1, k2] = this.branches;
    stampSw(s, a, b, k1, true, 0.01);
    stampSw(s, c, d, k2, !this.tripped, 0.01);
  }
  stampAC(ac) {
    const [a, b, c, d] = this.nodes, [k1, k2] = this.branches;
    stampSwAC(ac, a, b, k1, true, 0.01); stampSwAC(ac, c, d, k2, !this.tripped, 0.01);
  }
  accept(s) {
    const [k1, k2] = this.branches, i = s.x[k1], ic = s.x[k2];
    this.postCurrents = [i, -i, ic, -ic]; this.i = i;
    if (s.mode === 'dc' || this.tripped) return;
    this.theta += ((i / this.p.ir) ** 2 - this.theta) * Math.min(1, s.heatDt() / 240);
    if (this.theta >= 1.3) { this.tripped = true; s.markEvent(); }
  }
  onTap() { this.tripped = false; this.theta = 0; return true; }
  valueLabel() { return fmtShort(this.p.ir, 'A'); }
  readings() { return [['State', this.tripped ? 'TRIPPED (95–96 open)' : 'Normal', ''], ['Motor current', this.i, 'A'], ['Thermal load', Math.min(100, (this.theta / 1.3) * 100), '%']]; }
  draw(g) {
    g.box(-0.9 * G, -1.7 * G, 0.9 * G, 1.7 * G, { stroke: g.body, width: g.lw * 0.9, fill: g.fill, r: 4 });
    const c0 = g.vc(g.pv(0));
    g.poly([[-0.9 * G, -G], [-0.5 * G, -G], [-0.5 * G, -1.35 * G], [0, -1.35 * G], [0, -0.65 * G], [0.5 * G, -0.65 * G], [0.5 * G, -G], [0.9 * G, -G]], { stroke: c0, width: g.lw });
    g.line(-0.9 * G, G, -0.45 * G, G, g.vc(g.pv(2)), g.lw);
    g.line(0.45 * G, G, 0.9 * G, G, g.vc(g.pv(3)), g.lw);
    if (!this.tripped) g.line(-0.45 * G, G, 0.45 * G, G, g.vc(g.pv(2)), g.lw); else g.line(-0.45 * G, G, 0.35 * G, 0.55 * G, g.body, g.lw);
    g.line(0.45 * G, 0.75 * G, 0.45 * G, 1.1 * G, g.body, g.lw * 0.8);
    g.text('95', -1.3 * G, 1.45 * G, { size: 6.5, color: g.muted });
    g.text('96', 1.3 * G, 1.45 * G, { size: 6.5, color: g.muted });
    if (this.tripped) g.glow(0, 0, 1.4 * G, '255,70,70', 0.4);
  }
}
register(OverloadRelay);

const IDMT_CURVES = {
  SI: { k: 0.14, a: 0.02, name: 'IEC Standard inverse' },
  VI: { k: 13.5, a: 1, name: 'IEC Very inverse' },
  EI: { k: 80, a: 2, name: 'IEC Extremely inverse' },
  LTI: { k: 120, a: 1, name: 'IEC Long-time inverse' },
};

export class IDMTRelay extends Element {
  static type = 'idmt'; static title = 'IDMT Overcurrent Relay'; static category = 'Protection';
  static prefix = 'OC'; static keywords = 'idmt overcurrent relay inverse definite minimum time protection 51 ct relay coordination';
  static props = [
    { key: 'is', label: 'Plug setting (pickup) Is', unit: 'A', def: 1, min: 0.01, max: 1000, log: true, knob: true },
    { key: 'tms', label: 'Time multiplier TMS', unit: '', def: 0.1, min: 0.01, max: 1.5 },
    { key: 'curve', label: 'Curve', type: 'select', def: 'SI', options: Object.entries(IDMT_CURVES).map(([k, v]) => [k, v.name]) },
    { key: 'inst', label: 'Instantaneous element (× Is, 0 = off)', unit: '', def: 0, min: 0, max: 50 },
  ];
  static description = 'IEC 60255 inverse-time overcurrent relay (ANSI 51/50). The current coil (left) is fed from a CT secondary; after t = TMS·k/((I/Is)^α − 1) the trip contact (right, NO) closes and latches. Tap to reset.';
  interactive = true;
  constructor(x, y) { super(x, y); this.postCurrents = [0, 0, 0, 0]; }
  localPosts() { return [[-2 * G, -G], [-2 * G, G], [2 * G, -G], [2 * G, G]]; }
  localBox() { return [-2 * G, -1.8 * G, 2 * G, 1.8 * G]; }
  leads() { return this.localPosts().map(([x, y], i) => [i, x, y, Math.sign(x) * 1.2 * G, y]); }
  connectivity() { return [[0, 1], [2, 3]]; }
  branchCount() { return 2; }
  reset() { this.tripped = false; this.prog = 0; this.i2 = 0; this.tTrip = 0; this.postCurrents.fill(0); }
  stamp(s) {
    const [a, b, c, d] = this.nodes, [k1, k2] = this.branches;
    stampSw(s, a, b, k1, true, 0.05);
    stampSw(s, c, d, k2, !!this.tripped, 0.01);
  }
  stampAC(ac) { const [a, b, c, d] = this.nodes, [k1, k2] = this.branches; stampSwAC(ac, a, b, k1, true, 0.05); stampSwAC(ac, c, d, k2, !!this.tripped, 0.01); }
  opTime(I) {
    const c = IDMT_CURVES[this.p.curve] || IDMT_CURVES.SI, m = I / this.p.is;
    if (m <= 1.1) return Infinity;
    return (this.p.tms * c.k) / (Math.pow(m, c.a) - 1);
  }
  accept(s) {
    const [k1, k2] = this.branches, i = s.x[k1], ic = s.x[k2];
    this.postCurrents = [i, -i, ic, -ic]; this.i = i;
    if (s.mode === 'dc' || this.tripped) return;
    this.i2 += (i * i - this.i2) * Math.min(1, s.dt / 0.02);
    const I = Math.sqrt(this.i2);
    this.irms = I;
    if (this.p.inst > 0 && I > this.p.inst * this.p.is) this.prog = 1;
    const t = this.opTime(I);
    const dt = s.heatDt(); // relay timing runs on the real-time clock
    if (Number.isFinite(t)) { this.prog += dt / t; this.tTrip += dt; } else { this.prog = 0; this.tTrip = 0; }
    if (this.prog >= 1) { this.tripped = true; this.tripAt = this.tTrip; s.markEvent(); }
  }
  onTap() { this.tripped = false; this.prog = 0; this.tTrip = 0; return true; }
  valueLabel() { return `${this.p.curve} ${fmtShort(this.p.is, 'A')}`; }
  readings() {
    const t = this.opTime(this.irms || 0);
    return [['State', this.tripped ? `TRIPPED after ${fmtSI(this.tripAt, 's', 4)}` : 'Healthy', ''], ['Current (RMS)', this.irms || 0, 'A'],
      ['Multiple of setting', (this.irms || 0) / this.p.is, '×'], ['Operating time at this current', Number.isFinite(t) ? t : Infinity, 's'], ['Progress', Math.min(100, (this.prog || 0) * 100), '%']];
  }
  draw(g) {
    g.box(-1.2 * G, -1.7 * G, 1.2 * G, 1.7 * G, { stroke: g.body, width: g.lw * 0.9, fill: g.fill, r: 4 });
    // text in the band between the coil arc and the trip contact, whichever way the relay is turned
    const dx = g.rot & 1 ? 0 : -0.1 * G;
    g.upright(() => { g.text('I>', dx, -0.2 * G, { size: 10, color: g.accent, bold: true }); g.text('51', dx, 0.32 * G, { size: 7, color: g.muted }); });
    const ctx = g.ctx;
    ctx.beginPath(); ctx.arc(-1.2 * G, 0, 0.45 * G, -Math.PI / 2, Math.PI / 2); ctx.strokeStyle = g.body; ctx.lineWidth = g.lw * 0.7; ctx.stroke();
    g.line(1.2 * G, -G, 0.8 * G, -G, g.body, g.lw * 0.8);
    g.line(1.2 * G, G, 0.8 * G, G, g.body, g.lw * 0.8);
    if (this.tripped) g.line(0.8 * G, -G, 0.8 * G, G, '#ef4444', g.lw); else g.line(0.8 * G, G, 0.55 * G, -0.6 * G, g.body, g.lw * 0.9);
    if (g.running && !this.tripped && this.prog > 0) g.box(-G, 1.35 * G, -G + 2 * G * Math.min(1, this.prog), 1.5 * G, { fill: '#f59e0b' });
    if (this.tripped) g.glow(0, 0, 1.5 * G, '255,70,70', 0.4);
  }
}
register(IDMTRelay);
