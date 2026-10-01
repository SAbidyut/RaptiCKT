// More semiconductors and vacuum tubes: varactor, tunnel diode, current-
// regulator diode, single- and three-phase bridge rectifiers, Darlington
// transistors, IGBT, depletion MOSFET, UJT, optocoupler, vacuum diode,
// triode and pentode (Koren models).

import { Element, TwoTerm, register, GRID } from './base.js';
import { Diode, NPN, PNP, NMOS, Junction, diodeIV } from './semis.js';
import { Resistor } from './passive.js';
import { Composite, withChip } from './kit.js';
import { VT } from '../engine/sim.js';
import { fmtShort } from '../engine/units.js';

const G = GRID;

/** Two-terminal nonlinear device with a user I–V and simple Newton step limiting. */
class NL2 extends TwoTerm {
  static category = 'Diodes';
  static prefix = 'D';
  nonlinear = true;
  maxStep = 0.5;
  reset() { this.vd = 0; this.setCurrent(0); this.gd = 1e-9; }
  iv() { return { i: 0, g: 1e-12 }; }
  limit(v) {
    const d = v - this.vd;
    if (Math.abs(d) > this.maxStep) return { v: this.vd + Math.sign(d) * this.maxStep, lim: true };
    return { v, lim: false };
  }
  stampNL(s) {
    const [a, b] = this.nodes;
    const r = this.limit(s.v(a) - s.v(b));
    if (r.lim) s.limited = true;
    const v = r.v; this.vd = v;
    const { i, g } = this.iv(v);
    s.addG(a, b, g); s.addI(a, b, i - g * v);
    this.gd = g;
  }
  accept(s) { const v = this.voltageDiff(s); this.vd = v; const r = this.iv(v); this.gd = r.g; this.setCurrent(r.i); }
  stampAC(ac) { ac.addY(this.nodes[0], this.nodes[1], this.gd || 1e-12); }
  leads() { return [[0, -2 * G, 0, -G * 0.5, 0], [1, 2 * G, 0, G * 0.5, 0]]; }
  diodeBody(g) {
    const h = G * 0.5, c0 = g.vc(g.pv(0)), c1 = g.vc(g.pv(1));
    g.poly([[-G * 0.5, -h], [G * 0.45, 0], [-G * 0.5, h]], { stroke: c0, width: g.lw, fill: g.fill, close: true });
    g.line(G * 0.5, -h, G * 0.5, h, c1, g.lw * 1.2);
  }
}

// ----------------------------------------------------------------- varactor
export class Varactor extends Diode {
  static type = 'varactor'; static title = 'Varactor (Varicap)'; static category = 'Diodes';
  static keywords = 'varactor varicap tuning diode voltage variable capacitance bb910 vco';
  static props = [
    { key: 'cj0', label: 'Zero-bias capacitance Cj0', unit: 'F', def: 40e-12, min: 1e-15, max: 1e-6, log: true, knob: true },
    { key: 'vj', label: 'Junction potential φ', unit: 'V', def: 0.7, min: 0.1, max: 2 },
    { key: 'm', label: 'Grading coefficient m', unit: '', def: 0.5, min: 0.1, max: 2 },
    { key: 'is', label: 'Saturation current Is', unit: 'A', def: 1e-14, min: 1e-20, max: 1e-6, log: true, hidden: true },
    { key: 'n', label: 'Emission coefficient', unit: '', def: 1, min: 0.5, max: 3, hidden: true },
    { key: 'bv', label: 'Breakdown voltage', unit: 'V', def: 30, min: 0, max: 1000 },
    { key: 'model', label: 'Model', type: 'select', def: 'custom', options: [['custom', 'Custom']], hidden: true },
  ];
  static description = 'Reverse-biased tuning diode: Cj = Cj0 / (1 + Vr/φ)^m (charge-conserving model). Use it to tune an LC tank or VCO with a DC voltage.';
  q(v) {
    const { cj0, vj, m } = this.p, fc = 0.5;
    if (v < fc * vj) return (cj0 * vj * (1 - Math.pow(1 - v / vj, 1 - m))) / (1 - m);
    const c = cj0 / Math.pow(1 - fc, m), q0 = (cj0 * vj * (1 - Math.pow(1 - fc, 1 - m))) / (1 - m);
    return q0 + c * (v - fc * vj) * (1 + (m * (v - fc * vj)) / (2 * vj * (1 - fc)));
  }
  C(v) { const { cj0, vj, m } = this.p, fc = 0.5; return v < fc * vj ? cj0 / Math.pow(1 - v / vj, m) : (cj0 / Math.pow(1 - fc, m)) * (1 + (m * (v - fc * vj)) / (vj * (1 - fc))); }
  reset() { super.reset(); this.vq = 0; }
  stampNL(s) {
    super.stampNL(s);
    if (s.mode === 'dc') return;
    const [a, b] = this.nodes, v = this.j.vd, C = this.C(v);
    // backward-Euler charge companion: i = (q(v) − q(v_prev))/dt
    const gc = C / s.dt, ic = (this.q(v) - this.q(this.vq)) / s.dt;
    s.addG(a, b, gc); s.addI(a, b, ic - gc * v);
  }
  accept(s) {
    super.accept(s);
    const v = this.voltageDiff(s);
    if (s.mode !== 'dc') this.setCurrent(this.i + (this.q(v) - this.q(this.vq)) / s.dt);
    this.vq = v;
  }
  stampAC(ac) { ac.addY(this.nodes[0], this.nodes[1], this.gd + 1e-12, ac.omega * this.C(this.vq || 0)); }
  valueLabel() { return fmtShort(this.p.cj0, 'F'); }
  readings(s) { const v = this.voltageDiff(s); return [['Reverse voltage', -v, 'V'], ['Capacitance', this.C(v), 'F'], ['Current', this.i, 'A']]; }
  draw(g) {
    this.drawDiodeBody(g);
    g.line(0.72 * G, -0.5 * G, 0.72 * G, 0.5 * G, g.vc(g.pv(1)), g.lw * 1.2);
  }
}
register(Varactor);

// ------------------------------------------------------------ tunnel diode
export class TunnelDiode extends NL2 {
  static type = 'tunnel'; static title = 'Tunnel Diode';
  static keywords = 'tunnel diode esaki negative resistance ndr oscillator 1n3716';
  static props = [
    { key: 'ip', label: 'Peak current Ip', unit: 'A', def: 0.01, min: 1e-6, max: 1, log: true, knob: true },
    { key: 'vp', label: 'Peak voltage Vp', unit: 'V', def: 0.065, min: 0.01, max: 0.5 },
    { key: 'iv', label: 'Valley current Iv', unit: 'A', def: 0.001, min: 1e-7, max: 0.1, log: true },
    { key: 'vv', label: 'Valley voltage Vv', unit: 'V', def: 0.35, min: 0.05, max: 1 },
  ];
  static description = 'Esaki tunnel diode: I = Ip·(V/Vp)·e^(1−V/Vp) + Iv·e^(k(V−Vv)) + diffusion current — a negative-resistance region between the peak and valley (for oscillators).';
  maxStep = 0.03;
  iv(v) {
    const { ip, vp, iv: Iv, vv } = this.p;
    const e = Math.exp(1 - v / vp), t = ip * (v / vp) * e, dt = (ip / vp) * e * (1 - v / vp);
    const kx = 10, ex = Math.exp(Math.min(60, kx * (v - vv))), x = Iv * ex, dx = Iv * kx * ex;
    const is = 1e-9, nv = 1.3 * VT, ed = Math.exp(Math.min(60, v / nv)), d = is * (ed - 1), dd = (is / nv) * ed;
    return { i: t + x - Iv * Math.exp(-kx * vv) + d, g: dt + dx + dd + 1e-12 };
  }
  valueLabel() { return fmtShort(this.p.ip, 'A'); }
  readings(s) { return [['Voltage', this.voltageDiff(s), 'V'], ['Current', this.i, 'A'], ['Dynamic resistance', 1 / (this.gd || 1e-12), 'Ω']]; }
  draw(g) { this.diodeBody(g); const h = 0.5 * G, c = g.vc(g.pv(1)); g.poly([[0.3 * G, -h], [0.5 * G, -h], [0.5 * G, h], [0.3 * G, h]], { stroke: c, width: g.lw * 1.1 }); }
}
register(TunnelDiode);

export class CRD extends NL2 {
  static type = 'crd'; static title = 'Current-Regulator Diode';
  static keywords = 'crd current regulating diode constant current diode ccr jfet led driver';
  static props = [
    { key: 'ireg', label: 'Regulated current', unit: 'A', def: 0.01, min: 1e-6, max: 1, log: true, knob: true },
    { key: 'vk', label: 'Knee voltage', unit: 'V', def: 1.5, min: 0.1, max: 10 },
    { key: 'ra', label: 'Dynamic resistance above knee', unit: 'Ω', def: 1e5, min: 100, max: 1e9, log: true },
  ];
  static description = 'Constant-current diode (JFET with gate tied to source): passes ≈Ireg for any forward voltage above the knee; conducts like a diode in reverse.';
  iv(v) {
    if (v >= 0) { const t = Math.tanh(v / this.p.vk); return { i: this.p.ireg * t + v / this.p.ra, g: (this.p.ireg / this.p.vk) * (1 - t * t) + 1 / this.p.ra }; }
    const d = diodeIV(-v, 1e-12, 1.5, 0);
    return { i: -d.i, g: d.g + 1e-12 };
  }
  limit(v) { return super.limit(v); }
  valueLabel() { return fmtShort(this.p.ireg, 'A'); }
  readings(s) { return [['Current', this.i, 'A'], ['Voltage', this.voltageDiff(s), 'V']]; }
  draw(g) {
    this.diodeBody(g);
    g.circle(0, 0, 0.8 * G, { stroke: g.body, width: g.lw * 0.6 });
  }
}
register(CRD);

// ----------------------------------------------------------- bridge rectifiers
class RectBase extends Composite {
  static category = 'Diodes';
  static prefix = 'BR';
  static props = [
    { key: 'is', label: 'Diode Is', unit: 'A', def: 7e-9, min: 1e-18, max: 1e-3, log: true },
    { key: 'n', label: 'Emission coefficient', unit: '', def: 1.9, min: 0.5, max: 4 },
    { key: 'bv', label: 'Reverse voltage rating', unit: 'V', def: 1000, min: 0, max: 1e4 },
  ];
  sync() { for (const s of this.subs || []) { Object.assign(s.el.p, { is: this.p.is, n: this.p.n, bv: this.p.bv, model: 'custom' }); s.el.onParamChange(); } }
  valueLabel() { return ''; }
}

export class BridgeRectifier extends withChip(RectBase) {
  static type = 'bridge'; static title = 'Bridge Rectifier (1-phase)';
  static keywords = 'bridge rectifier full wave db107 kbpc gbu diode bridge';
  static pins = [['~', 'L'], ['~', 'L'], ['+', 'R'], ['−', 'R']];
  static description = 'Four-diode full-wave bridge (1N4007-class diodes): AC in on the two ~ pins, DC out on + and −.';
  parts() {
    // AC1 → +, AC2 → +, − → AC1, − → AC2
    return [[new Diode(0, 0), [0, 2]], [new Diode(0, 0), [1, 2]], [new Diode(0, 0), [3, 0]], [new Diode(0, 0), [3, 1]]];
  }
  readings(s) { const [a, b, p, m] = this.nodes; return [['V ac', s.v(a) - s.v(b), 'V'], ['V dc', s.v(p) - s.v(m), 'V'], ['I dc', -this.postCurrents[2], 'A']]; }
  draw(g) {
    this.drawChip(g, '');
    g.upright(() => {
      const r = 0.55 * G;
      g.poly([[0, -r], [r, 0], [0, r], [-r, 0]], { stroke: g.body, width: g.lw * 0.7, close: true });
      for (const [x, y, a] of [[-r / 2, -r / 2, -Math.PI / 4], [r / 2, r / 2, -Math.PI / 4], [r / 2, -r / 2, Math.PI / 4], [-r / 2, r / 2, Math.PI / 4]]) {
        const c = Math.cos(a) * 4, sn = Math.sin(a) * 4;
        g.poly([[x - c, y - sn], [x + sn * 0.8, y - c * 0.8], [x - sn * 0.8, y + c * 0.8]], { fill: g.body });
      }
    }, 0, 0.1 * G);
  }
}
register(BridgeRectifier);

export class Bridge3 extends withChip(RectBase) {
  static type = 'rect3'; static title = 'Bridge Rectifier (3-phase)';
  static keywords = 'three phase bridge rectifier 6 pulse diode bridge 3 phase';
  static pins = [['R', 'L'], ['Y', 'L'], ['B', 'L'], ['+', 'R'], ['−', 'R']];
  static description = 'Six-pulse three-phase diode bridge: DC output ≈ 1.35 × line voltage (RMS).';
  parts() {
    const d = [];
    for (let p = 0; p < 3; p++) { d.push([new Diode(0, 0), [p, 3]]); d.push([new Diode(0, 0), [4, p]]); }
    return d;
  }
  readings(s) { const n = this.nodes; return [['V dc', s.v(n[3]) - s.v(n[4]), 'V'], ['I dc', -this.postCurrents[3], 'A']]; }
  draw(g) { this.drawChip(g, '3~ ⇉'); }
}
register(Bridge3);

// ------------------------------------------------------------- transistors
export class DarlingtonNPN extends Composite {
  static type = 'darlnpn'; static title = 'Darlington NPN (TIP120)'; static category = 'Transistors';
  static prefix = 'Q'; static keywords = 'darlington npn tip120 tip122 high gain power transistor';
  static props = [
    { key: 'bf', label: 'β of each transistor', unit: '', def: 50, min: 1, max: 2000, knob: true },
    { key: 'is', label: 'Is', unit: 'A', def: 1e-13, min: 1e-18, max: 1e-8, log: true },
  ];
  static description = 'Two transistors in Darlington connection with the internal 8 kΩ / 120 Ω base-emitter resistors of a TIP120: overall gain β₁·β₂ (≈1000+), VBE(on) ≈ 1.4 V.';
  static pol = 1; // static: parts() runs before instance fields are initialised
  ownInternal() { return 1; }
  parts() {
    const T = this.constructor.pol > 0 ? NPN : PNP;
    // B, C, E posts; internal node = emitter of Q1 / base of Q2
    return [[new T(0, 0), [0, 1, 'i0']], [new T(0, 0), ['i0', 1, 2]], [new Resistor(0, 0), [0, 'i0']], [new Resistor(0, 0), ['i0', 2]]];
  }
  sync() {
    if (!this.subs) return;
    const [q1, q2, r1, r2] = this.subs.map((s) => s.el);
    for (const q of [q1, q2]) Object.assign(q.p, { bf: this.p.bf, is: this.p.is, br: 1, va: 100, cje: 0, cjc: 0, model: 'custom' });
    r1.p.r = 8000; r2.p.r = 120;
  }
  localPosts() { return [[-2 * G, 0], [G, -2 * G], [G, 2 * G]]; }
  localBox() { return [-2 * G, -2 * G, G * 1.65, 2 * G]; } // the round body reaches 1.6 G
  leads() { return [[0, -2 * G, 0, -G * 0.45, 0], [1, G, -2 * G, G, -G * 0.95], [2, G, 2 * G, G, G * 0.95]]; }
  labelSide() { return [1, 0]; }
  valueLabel() { return this.constructor.pol > 0 ? 'TIP120' : 'TIP125'; }
  readings(s) {
    const [b, c, e] = this.nodes, ib = this.postCurrents[0], ic = this.postCurrents[1];
    return [['Vbe', s.v(b) - s.v(e), 'V'], ['Vce', s.v(c) - s.v(e), 'V'], ['Ib', ib, 'A'], ['Ic', ic, 'A'], ['Gain Ic/Ib', Math.abs(ib) > 1e-15 ? ic / ib : 0, '']];
  }
  draw(g) {
    g.circle(G * 0.25, 0, G * 1.3, { stroke: g.body, width: g.lw * 0.7, fill: g.fill });
    g.line(-G * 0.45, -G * 0.75, -G * 0.45, G * 0.75, g.vc(g.pv(0)), g.lw * 1.5);
    g.poly([[-G * 0.45, -G * 0.35], [G, -G * 0.95]], { stroke: g.vc(g.pv(1)), width: g.lw });
    g.poly([[-G * 0.45, G * 0.35], [G, G * 0.95]], { stroke: g.vc(g.pv(2)), width: g.lw });
    g.line(0.1 * G, -0.3 * G, 0.1 * G, 0.3 * G, g.body, g.lw);
    g.upright(() => g.text('D', 0, 0, { size: 7, color: g.muted, bold: true }), 0.55 * G, 0);
  }
}
register(DarlingtonNPN);

export class DarlingtonPNP extends DarlingtonNPN {
  static type = 'darlpnp'; static title = 'Darlington PNP (TIP125)';
  static keywords = 'darlington pnp tip125 tip127 high gain';
  static description = 'PNP Darlington pair (TIP125-type): overall gain β₁·β₂. Terminals B (left), C (top), E (bottom) — flip it for high-side use.';
  static pol = -1;
}
register(DarlingtonPNP);

export class IGBT extends Composite {
  static type = 'igbt'; static title = 'IGBT'; static category = 'Transistors';
  static prefix = 'Q'; static keywords = 'igbt insulated gate bipolar transistor inverter vfd power switch irg4bc30';
  static props = [
    { key: 'vt', label: 'Gate threshold', unit: 'V', def: 5, min: 0.5, max: 15, knob: true },
    { key: 'kp', label: 'MOS transconductance', unit: 'A/V²', def: 2, min: 1e-4, max: 1000, log: true },
    { key: 'bf', label: 'PNP gain', unit: '', def: 2, min: 0.1, max: 50 },
  ];
  static description = 'Insulated-gate bipolar transistor: voltage-driven gate like a MOSFET, bipolar conduction with a ≈0.7 V knee (Vce(sat) ≈ 1.5–2 V). Structure model: MOSFET driving a wide-base PNP. Terminals G (left), C (top), E (bottom).';
  ownInternal() { return 1; }
  parts() {
    // MOSFET: G, D = internal, S = E. PNP: B = internal, C = E, E = C
    return [[new NMOS(0, 0), [0, 'i0', 2]], [new PNP(0, 0), ['i0', 2, 1]]];
  }
  sync() {
    if (!this.subs) return;
    const [m, q] = this.subs.map((s) => s.el);
    Object.assign(m.p, { vt: this.p.vt, kp: this.p.kp, lambda: 0.005, cgs: 2e-9, cgd: 1e-10, bodyDiode: false, model: 'custom' });
    Object.assign(q.p, { bf: this.p.bf, is: 1e-12, br: 0.5, va: 0, cje: 0, cjc: 0, model: 'custom' });
  }
  localPosts() { return [[-2 * G, 0], [G, -2 * G], [G, 2 * G]]; }
  localBox() { return [-2 * G, -2 * G, G * 1.65, 2 * G]; } // the round body reaches 1.6 G
  leads() { return [[0, -2 * G, 0, -G * 0.55, 0], [1, G, -2 * G, G, -G * 0.6], [2, G, 2 * G, G, G * 0.6]]; }
  labelSide() { return [1, 0]; }
  valueLabel() { return ''; }
  readings(s) { const [g_, c, e] = this.nodes; return [['Vge', s.v(g_) - s.v(e), 'V'], ['Vce', s.v(c) - s.v(e), 'V'], ['Ic', this.postCurrents[1], 'A']]; }
  draw(g) {
    g.circle(G * 0.25, 0, G * 1.3, { stroke: g.body, width: g.lw * 0.7, fill: g.fill });
    g.line(-G * 0.55, -G * 0.6, -G * 0.55, G * 0.6, g.vc(g.pv(0)), g.lw * 1.2);
    g.line(-G * 0.3, -G * 0.7, -G * 0.3, G * 0.7, g.body, g.lw * 1.3);
    g.poly([[-G * 0.3, -G * 0.35], [G, -G * 0.6]], { stroke: g.vc(g.pv(1)), width: g.lw });
    g.poly([[-G * 0.3, G * 0.35], [G, G * 0.6]], { stroke: g.vc(g.pv(2)), width: g.lw });
    g.poly([[0.75 * G, 0.55 * G], [0.4 * G, 0.6 * G], [0.55 * G, 0.35 * G]], { fill: g.vc(g.pv(2)) });
  }
}
register(IGBT);

export class DepletionNMOS extends NMOS {
  static type = 'depnmos'; static title = 'Depletion N-MOSFET'; static category = 'Transistors';
  static keywords = 'depletion mode mosfet normally on bss139 dn2540 current source';
  static props = [
    { key: 'model', label: 'Model', type: 'select', def: 'custom', options: [['custom', 'Custom']], hidden: true },
    { key: 'vt', label: 'Threshold (negative)', unit: 'V', def: -2, min: -20, max: 0, knob: true },
    ...NMOS.props.slice(2).map((p) => ({ ...p, def: { kp: 0.05, cgs: 50e-12, cgd: 5e-12, bodyDiode: true }[p.key] ?? p.def })),
  ];
  static description = 'Depletion-mode N-channel MOSFET: conducts at Vgs = 0 and is switched off by making the gate negative (Vgs < Vth < 0).';
  valueLabel() { return `Vth ${fmtShort(this.p.vt, 'V')}`; }
  draw(g) {
    super.draw(g);
    // depletion type: the channel is one solid bar (normally on) instead of three segments
    g.line(-0.25 * G, -0.75 * G, -0.25 * G, 0.75 * G, g.body, g.lw * 1.3);
  }
}
register(DepletionNMOS);

export class UJT extends Element {
  static type = 'ujt'; static title = 'UJT (2N2646)'; static category = 'Transistors';
  static prefix = 'Q'; static keywords = 'ujt unijunction transistor 2n2646 relaxation oscillator scr trigger';
  static props = [
    { key: 'eta', label: 'Intrinsic stand-off ratio η', unit: '', def: 0.65, min: 0.3, max: 0.9, knob: true },
    { key: 'rbb', label: 'Interbase resistance', unit: 'Ω', def: 7000, min: 100, max: 1e5, log: true },
    { key: 'ip', label: 'Peak-point current Ip', unit: 'A', def: 5e-6, min: 1e-9, max: 1e-3, log: true },
    { key: 'iv', label: 'Valley current Iv', unit: 'A', def: 2e-3, min: 1e-5, max: 0.1, log: true },
    { key: 'ron', label: 'Lower-base resistance when fired', unit: 'Ω', def: 30, min: 0.1, max: 1e4, log: true },
  ];
  static description = 'Unijunction transistor: the emitter diode sees η·Vbb; when Ve exceeds η·Vbb + 0.6 V (peak point) the lower base floods with carriers and its resistance collapses, discharging the emitter until the current falls below the valley current. Classic relaxation oscillator f ≈ 1/(R·C·ln(1/(1−η))) and SCR trigger. Terminals E (left), B2 (top), B1 (bottom).';
  nonlinear = true;
  constructor(x, y) { super(x, y); this.postCurrents = [0, 0, 0]; this.j = new Junction(1e-12, 1.2); this.on = false; }
  localPosts() { return [[-2 * G, 0], [G, -2 * G], [G, 2 * G]]; }
  localBox() { return [-2 * G, -2 * G, G * 1.65, 2 * G]; } // the round body reaches 1.6 G
  leads() { return [[0, -2 * G, 0, -0.3 * G, 0.3 * G], [1, G, -2 * G, G, -G * 0.8], [2, G, 2 * G, G, G * 0.8]]; }
  labelSide() { return [1, 0]; }
  internalNodeCount() { return 1; }
  reset() { this.j.vd = 0; this.ie = 0; this.on = false; this.postCurrents.fill(0); }
  rb1() { return this.on ? this.p.ron : this.p.eta * this.p.rbb; }
  rb2() { return (1 - this.p.eta) * this.p.rbb; }
  stamp(s) { const [, b2, b1] = this.nodes, n = this.inodes[0]; s.addG(b2, n, 1 / this.rb2()); s.addG(n, b1, 1 / this.rb1()); }
  stampNL(s) {
    const [e] = this.nodes, n = this.inodes[0];
    const vd = this.j.limit(s, s.v(e) - s.v(n)), d = diodeIV(vd, 1e-12, 1.2, 0);
    s.addG(e, n, d.g); s.addI(e, n, d.i - d.g * vd);
  }
  update(ie) {
    if (!this.on && ie > this.p.ip) { this.on = true; return true; }
    if (this.on && ie < this.p.iv) { this.on = false; return true; }
    return false;
  }
  accept(s) {
    const [e, b2] = this.nodes, n = this.inodes[0];
    const vd = s.v(e) - s.v(n); this.j.vd = vd;
    const ie = diodeIV(vd, 1e-12, 1.2, 0).i, i2 = (s.v(b2) - s.v(n)) / this.rb2();
    this.ie = ie;
    this.postCurrents = [ie, i2, -(ie + i2)]; this.i = ie;
    if (s.mode !== 'dc' && this.update(ie)) s.markEvent();
  }
  stampAC(ac) { const [e, b2, b1] = this.nodes, n = this.inodes[0]; ac.addY(b2, n, 1 / this.rb2()); ac.addY(n, b1, 1 / this.rb1()); ac.addY(e, n, 1e-9); }
  valueLabel() { return `η=${this.p.eta}`; }
  readings(s) { const [e, b2, b1] = this.nodes; return [['State', this.on ? 'Fired (conducting)' : 'Off', ''], ['Ve', s.v(e) - s.v(b1), 'V'], ['Vbb', s.v(b2) - s.v(b1), 'V'], ['Ie', this.ie || 0, 'A'], ['Peak-point voltage', this.p.eta * (s.v(b2) - s.v(b1)) + 0.6, 'V']]; }
  draw(g) {
    g.circle(G * 0.25, 0, G * 1.3, { stroke: g.body, width: g.lw * 0.7, fill: this.on && g.running ? 'rgba(74,222,128,0.2)' : g.fill });
    g.line(0.3 * G, -0.8 * G, 0.3 * G, 0.8 * G, g.body, g.lw * 1.5);
    g.line(0.3 * G, -0.6 * G, G, -0.8 * G, g.vc(g.pv(1)), g.lw);
    g.line(0.3 * G, 0.6 * G, G, 0.8 * G, g.vc(g.pv(2)), g.lw);
    g.line(-0.3 * G, 0.3 * G, 0.3 * G, 0.1 * G, g.vc(g.pv(0)), g.lw);
    g.poly([[0.3 * G, 0.1 * G], [0.05 * G, 0.05 * G], [0.12 * G, 0.28 * G]], { fill: g.vc(g.pv(0)) });
  }
}
register(UJT);

/** Photocurrent link: current from C to B of the phototransistor = k·I_LED(V_AK). */
class PhotoLink extends Element {
  nonlinear = true;
  constructor() { super(0, 0); this.k = 0.01; this.postCurrents = [0, 0, 0, 0]; }
  localPosts() { return [[0, 0], [0, 0], [0, 0], [0, 0]]; }
  led(v) { return diodeIV(v, 1e-12, 2, 0); }
  stampNL(s) {
    const [a, k, c, b] = this.nodes, v = s.v(a) - s.v(k), d = this.led(Math.min(v, 2));
    // current flows c → b through the device
    s.addNLCurrent(c, b, this.k * d.i, [[a, k, this.k * d.g, Math.min(v, 2)]]);
  }
  accept(s) { const [a, k] = this.nodes; this.iph = this.k * this.led(Math.min(s.v(a) - s.v(k), 2)).i; this.postCurrents = [0, 0, this.iph, -this.iph]; }
}

export class Optocoupler extends withChip(Composite) {
  static type = 'opto'; static title = 'Optocoupler (PC817)'; static category = 'Transistors';
  static prefix = 'U'; static keywords = 'optocoupler optoisolator pc817 4n35 phototransistor isolation';
  static props = [{ key: 'ctr', label: 'Current transfer ratio', unit: '%', def: 100, min: 1, max: 1000, knob: true }];
  static pins = [['A', 'L'], ['K', 'L'], ['C', 'R'], ['E', 'R']];
  static description = 'Infrared LED (A–K, ≈1.2 V) optically coupled to a phototransistor (C–E): Ic ≈ CTR × If until the transistor saturates. Input and output are galvanically isolated.';
  ownInternal() { return 1; }
  parts() {
    const led = new Diode(0, 0);
    return [[led, [0, 1]], [new NPN(0, 0), ['i0', 2, 3]], [new PhotoLink(), [0, 1, 2, 'i0']]];
  }
  sync() {
    if (!this.subs) return;
    const [d, q, pl] = this.subs.map((s) => s.el);
    Object.assign(d.p, { is: 1e-12, n: 2, bv: 5, model: 'custom' }); d.onParamChange();
    Object.assign(q.p, { bf: 400, is: 1e-14, br: 1, va: 50, cje: 5e-12, cjc: 10e-12, model: 'custom' });
    pl.k = this.p.ctr / 100 / 400;
  }
  connectivity() { return [[0, 1], [2, 3, 'i0']]; }
  valueLabel() { return `CTR ${this.p.ctr.toFixed(0)}%`; }
  readings(s) { return [['LED current', this.postCurrents[0], 'A'], ['Collector current', this.postCurrents[2], 'A'], ['Vce', s.v(this.nodes[2]) - s.v(this.nodes[3]), 'V']]; }
  draw(g) {
    this.drawChip(g, '');
    const on = g.running && this.postCurrents[0] > 1e-4;
    g.poly([[-0.75 * G, -0.35 * G], [-0.75 * G, 0.25 * G], [-0.4 * G, -0.05 * G]], { stroke: g.body, width: g.lw * 0.6, close: true, fill: on ? 'rgba(255,80,80,0.7)' : null });
    for (const dy of [-0.15, 0.15]) g.line(-0.2 * G, dy * G, 0.15 * G, dy * G + 3, on ? '#f87171' : g.muted, g.lw * 0.5);
    g.line(0.4 * G, -0.35 * G, 0.4 * G, 0.35 * G, g.body, g.lw);
    g.line(0.4 * G, -0.1 * G, 0.75 * G, -0.45 * G, g.body, g.lw * 0.7);
    g.line(0.4 * G, 0.1 * G, 0.75 * G, 0.45 * G, g.body, g.lw * 0.7);
  }
}
register(Optocoupler);

// ------------------------------------------------------------- vacuum tubes
export class VacuumDiode extends NL2 {
  static type = 'vacdiode'; static title = 'Vacuum Diode'; static category = 'Vacuum Tubes';
  static prefix = 'V'; static keywords = 'vacuum diode valve thermionic rectifier 5u4 child langmuir';
  static props = [{ key: 'k', label: 'Perveance', unit: 'A/V^1.5', def: 7e-4, min: 1e-7, max: 1, log: true, knob: true }];
  static description = 'Thermionic diode (heater implied): space-charge-limited current I = k·V^1.5 (Child–Langmuir law); no reverse current.';
  maxStep = 20;
  iv(v) { if (v <= 0) return { i: v * 1e-9, g: 1e-9 }; const r = Math.sqrt(v); return { i: this.p.k * v * r + v * 1e-9, g: 1.5 * this.p.k * r + 1e-9 }; }
  valueLabel() { return ''; }
  readings(s) { return [['Plate voltage', this.voltageDiff(s), 'V'], ['Plate current', this.i, 'A']]; }
  leads() { return [[0, -2 * G, 0, -0.35 * G, 0], [1, 2 * G, 0, 0.35 * G, 0]]; }
  localBox() { return [-2 * G, -G, 2 * G, G]; }
  draw(g) {
    g.circle(0, 0, 0.9 * G, { stroke: g.body, width: g.lw * 0.8, fill: g.fill });
    g.line(-0.35 * G, -0.4 * G, -0.35 * G, 0.4 * G, g.vc(g.pv(0)), g.lw * 1.3);
    const ctx = g.ctx; ctx.beginPath(); ctx.arc(0.55 * G, 0, 0.3 * G, Math.PI * 0.6, Math.PI * 1.4); ctx.strokeStyle = g.vc(g.pv(1)); ctx.lineWidth = g.lw; ctx.stroke();
    if (g.running) g.glow(0.35 * G, 0, 0.5 * G, '255,140,60', 0.3);
  }
}
register(VacuumDiode);

const softplus = (x) => (x > 30 ? x : Math.log1p(Math.exp(x)));

/** Koren triode plate current (and derivatives) for given Vgk, Vpk. */
function korenTriode(p, vgk, vpk) {
  const { mu, ex, kg1, kp, kvb } = p;
  const f = (vg, vp) => {
    if (vp <= 0) return 0;
    const e1 = (vp / kp) * softplus(kp * (1 / mu + vg / Math.sqrt(kvb + vp * vp)));
    return e1 > 0 ? Math.pow(e1, ex) / kg1 : 0;
  };
  const i = f(vgk, vpk), h = 1e-4;
  return { i, gm: (f(vgk + h, vpk) - f(vgk - h, vpk)) / (2 * h), gp: (f(vgk, vpk + h) - f(vgk, vpk - h)) / (2 * h) };
}

const TRIODES = {
  '12AX7': { mu: 100, ex: 1.4, kg1: 1060, kp: 600, kvb: 300 },
  '12AU7': { mu: 21.5, ex: 1.3, kg1: 1180, kp: 84, kvb: 300 },
  '6SN7': { mu: 20, ex: 1.4, kg1: 1500, kp: 100, kvb: 300 },
};

export class Triode extends Element {
  static type = 'triode'; static title = 'Vacuum Triode'; static category = 'Vacuum Tubes';
  static prefix = 'V'; static keywords = 'triode valve tube 12ax7 ecc83 12au7 amplifier koren';
  static props = [
    { key: 'model', label: 'Type', type: 'select', def: '12AX7', options: Object.keys(TRIODES).map((k) => [k, k]).concat([['custom', 'Custom']]), preset: TRIODES },
    { key: 'mu', label: 'Amplification factor µ', unit: '', def: 100, min: 1, max: 500, knob: true },
    { key: 'ex', label: 'Exponent', unit: '', def: 1.4, min: 1, max: 2 },
    { key: 'kg1', label: 'Kg1', unit: '', def: 1060, min: 1, max: 1e5 },
    { key: 'kp', label: 'Kp', unit: '', def: 600, min: 1, max: 1e4 },
    { key: 'kvb', label: 'Kvb', unit: '', def: 300, min: 1, max: 1e5 },
  ];
  static description = 'Vacuum triode with Norman Koren’s SPICE model (heater implied) plus grid-current conduction when the grid goes positive. Terminals: grid (left), plate/anode (top), cathode (bottom).';
  nonlinear = true;
  constructor(x, y) { super(x, y); this.postCurrents = [0, 0, 0]; this.gj = new Junction(1e-9, 1.5); }
  localPosts() { return [[-2 * G, 0], [0, -2 * G], [0, 2 * G]]; }
  localBox() { return [-2 * G, -2 * G, 1.3 * G, 2 * G]; }
  leads() { return [[0, -2 * G, 0, -0.9 * G, 0], [1, 0, -2 * G, 0, -0.6 * G], [2, 0, 2 * G, 0, 0.55 * G]]; }
  labelSide() { return [1, 0]; }
  reset() { this.vold = [0, 0]; this.gj.vd = 0; this.postCurrents.fill(0); }
  plate(vgk, vpk) { return korenTriode(this.p, vgk, vpk); }
  stampNL(s) {
    const [gr, pl, k] = this.nodes;
    let vgk = s.v(gr) - s.v(k), vpk = s.v(pl) - s.v(k);
    const dg = vgk - this.vold[0], dp = vpk - this.vold[1];
    if (Math.abs(dg) > 2) { vgk = this.vold[0] + Math.sign(dg) * 2; s.limited = true; }
    if (Math.abs(dp) > 50) { vpk = this.vold[1] + Math.sign(dp) * 50; s.limited = true; }
    this.vold = [vgk, vpk];
    const m = this.plate(vgk, vpk);
    s.addNLCurrent(pl, k, m.i, [[gr, k, m.gm, vgk], [pl, k, m.gp + 1e-9, vpk]]);
    const vd = this.gj.limit(s, vgk), d = diodeIV(vd, 1e-9, 1.5, 0);
    s.addG(gr, k, d.g); s.addI(gr, k, d.i - d.g * vd);
    this.sm = m;
  }
  accept(s) {
    const [gr, pl, k] = this.nodes, vgk = s.v(gr) - s.v(k), vpk = s.v(pl) - s.v(k);
    this.vold = [vgk, vpk]; this.gj.vd = vgk;
    const ip = this.plate(vgk, vpk).i, ig = diodeIV(vgk, 1e-9, 1.5, 0).i;
    this.postCurrents = [ig, ip, -(ip + ig)]; this.i = ip;
  }
  stampAC(ac) {
    const [gr, pl, k] = this.nodes, m = this.sm || { gm: 0, gp: 0 };
    ac.addVCCS(pl, k, gr, k, m.gm); ac.addY(pl, k, m.gp + 1e-9); ac.addY(gr, k, 1e-12, ac.omega * 1.6e-12);
  }
  valueLabel() { return this.p.model === 'custom' ? '' : this.p.model; }
  readings(s) { const [gr, pl, k] = this.nodes; return [['Vgk', s.v(gr) - s.v(k), 'V'], ['Vpk', s.v(pl) - s.v(k), 'V'], ['Plate current', this.postCurrents[1], 'A'], ['gm', this.sm?.gm || 0, 'S']]; }
  drawEnvelope(g) {
    g.circle(0, 0, 1.2 * G, { stroke: g.body, width: g.lw * 0.8, fill: g.fill });
    g.line(-0.5 * G, -0.6 * G, 0.5 * G, -0.6 * G, g.vc(g.pv(1)), g.lw * 1.2);
    const ctx = g.ctx; ctx.beginPath(); ctx.moveTo(-0.5 * G, 0.75 * G); ctx.lineTo(-0.5 * G, 0.55 * G); ctx.lineTo(0.5 * G, 0.55 * G); ctx.lineTo(0.5 * G, 0.75 * G);
    ctx.strokeStyle = g.vc(g.pv(2)); ctx.lineWidth = g.lw; ctx.stroke();
    if (g.running) g.glow(0, 0.55 * G, 0.7 * G, '255,140,60', 0.35);
  }
  draw(g) {
    this.drawEnvelope(g);
    g.poly([[-0.9 * G, 0], [-0.5 * G, 0]], { stroke: g.vc(g.pv(0)), width: g.lw * 0.8 });
    g.poly([[-0.5 * G, 0], [0.5 * G, 0]], { stroke: g.vc(g.pv(0)), width: g.lw * 0.7, dash: [3, 3] });
  }
}
register(Triode);

export class Pentode extends Triode {
  static type = 'pentode'; static title = 'Vacuum Pentode (EL84)';
  static keywords = 'pentode el84 6bq5 el34 power tube valve amplifier screen grid';
  static props = [
    { key: 'model', label: 'Type', type: 'select', def: 'custom', options: [['custom', 'EL84']], hidden: true },
    { key: 'mu', label: 'µ (screen)', unit: '', def: 19.2, min: 1, max: 200, knob: true },
    { key: 'ex', label: 'Exponent', unit: '', def: 1.35, min: 1, max: 2 },
    { key: 'kg1', label: 'Kg1', unit: '', def: 709, min: 1, max: 1e5 },
    { key: 'kg2', label: 'Kg2', unit: '', def: 4200, min: 1, max: 1e5 },
    { key: 'kp', label: 'Kp', unit: '', def: 145, min: 1, max: 1e4 },
    { key: 'kvb', label: 'Kvb', unit: '', def: 21, min: 1, max: 1e4 },
  ];
  static description = 'Power pentode (Koren model, EL84 defaults) with its screen grid G2 as a terminal: plate current is set by Vg1k and Vg2k and almost independent of plate voltage. Terminals: G1 (left), plate (top), cathode (bottom), G2 (right).';
  constructor(x, y) { super(x, y); this.postCurrents = [0, 0, 0, 0]; }
  localPosts() { return [[-2 * G, 0], [0, -2 * G], [0, 2 * G], [2 * G, 0]]; }
  localBox() { return [-2 * G, -2 * G, 2 * G, 2 * G]; }
  leads() { return [[0, -2 * G, 0, -0.9 * G, 0], [1, 0, -2 * G, 0, -0.6 * G], [2, 0, 2 * G, 0, 0.55 * G], [3, 2 * G, 0, 1.2 * G, -0.2 * G]]; }
  labelSide() { return [0, -1]; }
  reset() { super.reset(); this.vold = [0, 0, 0]; }
  currents(vg1, vg2, vp) {
    const { mu, ex, kg1, kg2, kp, kvb } = this.p;
    const v2 = Math.max(vg2, 1e-3); // keeps E1 continuous as the screen voltage goes to zero
    const e1 = (v2 / kp) * softplus(kp * (1 / mu + vg1 / v2));
    const base = e1 > 0 ? Math.pow(e1, ex) : 0;
    return { ip: (base / kg1) * Math.atan(Math.max(0, vp) / kvb) * (vp > 0 ? 1 : 0), is: Math.pow(Math.max(0, vg2 / mu + vg1), 1.5) / kg2 };
  }
  stampNL(s) {
    const [g1, pl, k, g2] = this.nodes;
    let v = [s.v(g1) - s.v(k), s.v(g2) - s.v(k), s.v(pl) - s.v(k)];
    const lim = [2, 50, 50];
    v = v.map((x, i) => { const d = x - this.vold[i]; if (Math.abs(d) > lim[i]) { s.limited = true; return this.vold[i] + Math.sign(d) * lim[i]; } return x; });
    this.vold = v;
    const h = [1e-4, 1e-3, 1e-3];
    const c0 = this.currents(...v);
    const der = (key) => v.map((_, i) => { const a = [...v], b = [...v]; a[i] += h[i]; b[i] -= h[i]; return (this.currents(...a)[key] - this.currents(...b)[key]) / (2 * h[i]); });
    const dp = der('ip'), ds = der('is');
    s.addNLCurrent(pl, k, c0.ip, [[g1, k, dp[0], v[0]], [g2, k, dp[1], v[1]], [pl, k, dp[2] + 1e-9, v[2]]]);
    s.addNLCurrent(g2, k, c0.is, [[g1, k, ds[0], v[0]], [g2, k, ds[1] + 1e-9, v[1]], [pl, k, ds[2], v[2]]]);
    const vd = this.gj.limit(s, v[0]), d = diodeIV(vd, 1e-9, 1.5, 0);
    s.addG(g1, k, d.g); s.addI(g1, k, d.i - d.g * vd);
    this.sm = { gm: dp[0], gp: dp[2] };
  }
  accept(s) {
    const [g1, pl, k, g2] = this.nodes, v = [s.v(g1) - s.v(k), s.v(g2) - s.v(k), s.v(pl) - s.v(k)];
    this.vold = v; this.gj.vd = v[0];
    const c = this.currents(...v), ig = diodeIV(v[0], 1e-9, 1.5, 0).i;
    this.postCurrents = [ig, c.ip, -(c.ip + c.is + ig), c.is]; this.i = c.ip;
  }
  stampAC(ac) { const [g1, pl, k] = this.nodes, m = this.sm || { gm: 0, gp: 0 }; ac.addVCCS(pl, k, g1, k, m.gm); ac.addY(pl, k, m.gp + 1e-9); }
  valueLabel() { return 'EL84'; }
  readings(s) { const [g1, pl, k, g2] = this.nodes; return [['Vg1k', s.v(g1) - s.v(k), 'V'], ['Vg2k', s.v(g2) - s.v(k), 'V'], ['Vpk', s.v(pl) - s.v(k), 'V'], ['Plate current', this.postCurrents[1], 'A'], ['Screen current', this.postCurrents[3], 'A']]; }
  draw(g) {
    this.drawEnvelope(g);
    g.poly([[-0.9 * G, 0.2 * G], [-0.5 * G, 0.2 * G]], { stroke: g.vc(g.pv(0)), width: g.lw * 0.8 });
    g.poly([[-0.5 * G, 0.2 * G], [0.5 * G, 0.2 * G]], { stroke: g.vc(g.pv(0)), width: g.lw * 0.6, dash: [3, 3] });
    g.poly([[-0.5 * G, -0.15 * G], [0.5 * G, -0.15 * G]], { stroke: g.vc(g.pv(3)), width: g.lw * 0.6, dash: [3, 3] });
    g.poly([[0.5 * G, -0.15 * G], [1.2 * G, -0.2 * G]], { stroke: g.vc(g.pv(3)), width: g.lw * 0.8 });
    g.poly([[-0.5 * G, -0.38 * G], [0.5 * G, -0.38 * G]], { stroke: g.muted, width: g.lw * 0.5, dash: [2, 3] });
  }
}
register(Pentode);
