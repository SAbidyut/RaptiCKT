// Semiconductor devices: diodes, LEDs, BJTs, MOSFETs, JFETs.
// Models follow SPICE conventions (Shockley diode, Ebers–Moll transport with
// Early effect, Shichman–Hodges level-1 MOSFET, square-law JFET) with SPICE
// pnjlim junction limiting for robust Newton–Raphson convergence.

import { Element, TwoTerm, register, GRID } from './base.js';
import { VT, pnjlim, vcrit } from '../engine/sim.js';
import { fmtShort } from '../engine/units.js';

const G = GRID;
const EXPMAX = 80;

function safeExp(x) {
  if (x > EXPMAX) { const e = Math.exp(EXPMAX); return { e: e * (1 + x - EXPMAX), d: e }; }
  const e = Math.exp(x); return { e, d: e };
}

/** Diode current & conductance. v: junction voltage. */
export function diodeIV(v, is, n, bv, ibv = 1e-3) {
  const nvt = n * VT;
  const f = safeExp(v / nvt);
  let i = is * (f.e - 1), g = (is * f.d) / nvt;
  if (bv > 0) {
    // reverse breakdown: exponential knee scaled so I(-bv) = ibv
    const nvb = VT;
    const r = safeExp((-v - bv) / nvb);
    i -= ibv * r.e;
    g += (ibv * r.d) / nvb;
  }
  return { i, g };
}

/** Junction state with SPICE-style limiting shared by all pn-junction devices. */
export class Junction {
  constructor(is, n, bv = 0) { this.set(is, n, bv); this.vd = 0; }
  set(is, n, bv = 0) { this.is = is; this.n = n; this.bv = bv; this.vcrit = vcrit(n, is); this.vcritBV = vcrit(1, 1e-3); }
  limit(s, v) {
    let r = pnjlim(v, this.vd, this.n * VT, this.vcrit);
    let lim = r.limited;
    v = r.v;
    if (this.bv > 0 && v < -this.bv + 0.1) {
      const vr = -(v + this.bv), vro = -(this.vd + this.bv);
      const r2 = pnjlim(vr, vro, VT, this.vcritBV);
      if (r2.limited) { v = -r2.v - this.bv; lim = true; }
    }
    if (lim) s.limited = true;
    this.vd = v;
    return v;
  }
}

/** Linear capacitor helper for device parasitics. */
export class CapState {
  constructor() { this.reset(0); }
  reset(v) { this.v = v; this.i = 0; this.J = 0; }
  g(s, C) { return (s.method === 'be' ? 1 : 2) * C / s.dt; }
  stamp(s, a, b, C) { if (s.mode !== 'dc' && C > 0) s.addG(a, b, this.g(s, C)); }
  step(s, a, b, C) {
    if (s.mode === 'dc' || C <= 0) { this.J = 0; return; }
    const g = this.g(s, C);
    this.J = s.method === 'be' ? -g * this.v : -g * this.v - this.i;
    s.addI(a, b, this.J);
  }
  accept(s, a, b, C) {
    const v = s.v(a) - s.v(b);
    this.i = s.mode === 'dc' || C <= 0 ? 0 : this.g(s, C) * v + this.J;
    this.v = v;
  }
}

// ------------------------------------------------------------------- diodes
const DIODE_PRESETS = {
  '1N4148': { is: 2.52e-9, n: 1.752, bv: 100 },
  '1N4007': { is: 7e-9, n: 1.9, bv: 1000 },
  '1N5819': { is: 3e-6, n: 1.1, bv: 40 },
  'Ideal-ish': { is: 1e-14, n: 1, bv: 0 },
};

export class Diode extends TwoTerm {
  static type = 'diode'; static title = 'Diode'; static category = 'Semiconductors';
  static prefix = 'D'; static keywords = 'rectifier silicon 1n4148 1n4007 pn junction';
  static props = [
    { key: 'model', label: 'Model', type: 'select', def: '1N4148', options: Object.keys(DIODE_PRESETS).map((k) => [k, k]).concat([['custom', 'Custom']]), preset: DIODE_PRESETS },
    { key: 'is', label: 'Saturation current Is', unit: 'A', def: 2.52e-9, min: 1e-20, max: 1e-3, log: true },
    { key: 'n', label: 'Emission coefficient n', unit: '', def: 1.752, min: 0.5, max: 5 },
    { key: 'bv', label: 'Breakdown voltage (0 = none)', unit: 'V', def: 100, min: 0, max: 5000 },
  ];
  static description = 'Shockley diode I = Is(e^(V/nVt) − 1) with reverse breakdown. Current flows from anode (left) to cathode (bar).';
  nonlinear = true;
  constructor(x, y) { super(x, y); this.j = new Junction(this.p.is, this.p.n, this.p.bv); }
  onParamChange() { this.j?.set(this.p.is, this.p.n, this.p.bv); }
  reset() { this.onParamChange(); this.j.vd = 0; this.setCurrent(0); this.gd = 0; }
  stampNL(s) {
    const [a, b] = this.nodes;
    const v = this.j.limit(s, s.v(a) - s.v(b));
    const { i, g } = diodeIV(v, this.p.is, this.p.n, this.p.bv);
    s.addG(a, b, g);
    s.addI(a, b, i - g * v);
    this.gd = g;
  }
  accept(s) {
    const v = this.voltageDiff(s);
    const { i, g } = diodeIV(v, this.p.is, this.p.n, this.p.bv);
    this.gd = g; this.j.vd = v;
    this.setCurrent(i);
  }
  stampAC(ac) { ac.addY(this.nodes[0], this.nodes[1], this.gd + 1e-12); }
  valueLabel() { return this.p.model === 'custom' ? '' : this.p.model; }
  spice(n) {
    return `${this.name} ${n[0]} ${n[1]} D${this.name}\n.model D${this.name} D(Is=${this.p.is} N=${this.p.n}${this.p.bv ? ` BV=${this.p.bv}` : ''})`;
  }
  leads() { return [[0, -2 * G, 0, -G * 0.5, 0], [1, 2 * G, 0, G * 0.5, 0]]; }
  drawDiodeBody(g, fill) {
    const c0 = g.vc(g.pv(0)), c1 = g.vc(g.pv(1));
    const h = G * 0.5;
    g.poly([[-G * 0.5, -h], [G * 0.45, 0], [-G * 0.5, h]], { stroke: c0, width: g.lw, fill: fill || g.fill, close: true, join: 'round' });
    g.line(G * 0.5, -h, G * 0.5, h, c1, g.lw * 1.2);
  }
  draw(g) { this.drawDiodeBody(g); }
}
register(Diode);

export class Zener extends Diode {
  static type = 'zener'; static title = 'Zener Diode'; static category = 'Semiconductors';
  static keywords = 'zener regulator reference breakdown';
  static props = [
    { key: 'bv', label: 'Zener voltage', unit: 'V', def: 5.1, min: 0.5, max: 500, knob: true },
    { key: 'is', label: 'Saturation current Is', unit: 'A', def: 1e-14, min: 1e-20, max: 1e-3, log: true },
    { key: 'n', label: 'Emission coefficient n', unit: '', def: 1, min: 0.5, max: 5 },
    { key: 'model', label: 'Model', type: 'select', def: 'custom', options: [['custom', 'Custom']], hidden: true },
  ];
  static description = 'Zener diode: conducts in reverse above its Zener voltage — used as a voltage reference.';
  valueLabel() { return fmtShort(this.p.bv, 'V'); }
  draw(g) {
    this.drawDiodeBody(g);
    const c1 = g.vc(g.pv(1)), h = G * 0.5;
    g.poly([[G * 0.3, -h - 4], [G * 0.5, -h], [G * 0.5, h], [G * 0.7, h + 4]], { stroke: c1, width: g.lw * 1.2 });
  }
}
register(Zener);

export class Schottky extends Diode {
  static type = 'schottky'; static title = 'Schottky Diode'; static category = 'Semiconductors';
  static keywords = 'schottky low drop fast 1n5819';
  static props = Diode.props.map((p) => (p.key === 'model' ? { ...p, def: '1N5819' } : p.key === 'is' ? { ...p, def: 3e-6 } : p.key === 'n' ? { ...p, def: 1.1 } : p.key === 'bv' ? { ...p, def: 40 } : p));
  static description = 'Schottky barrier diode with a low forward drop (~0.3 V).';
  draw(g) {
    this.drawDiodeBody(g);
    const c1 = g.vc(g.pv(1)), h = G * 0.5;
    g.poly([[G * 0.3, -h + 3], [G * 0.3, -h], [G * 0.5, -h], [G * 0.5, h], [G * 0.7, h], [G * 0.7, h - 3]], { stroke: c1, width: g.lw * 1.1 });
  }
}
register(Schottky);

const LED_COLORS = {
  red: { vf: 1.8, rgb: '255,50,50' }, orange: { vf: 2.0, rgb: '255,140,30' }, yellow: { vf: 2.1, rgb: '255,220,40' },
  green: { vf: 2.2, rgb: '60,255,90' }, blue: { vf: 3.0, rgb: '60,130,255' }, white: { vf: 3.1, rgb: '240,245,255' },
  uv: { vf: 3.4, rgb: '170,80,255' }, ir: { vf: 1.3, rgb: '150,40,40' },
};

export class LED extends Diode {
  static type = 'led'; static title = 'LED'; static category = 'Output';
  static prefix = 'LED'; static keywords = 'light emitting diode indicator lamp';
  static props = [
    { key: 'color', label: 'Colour', type: 'select', def: 'red', options: Object.keys(LED_COLORS).map((k) => [k, k[0].toUpperCase() + k.slice(1)]) },
    { key: 'imax', label: 'Rated current', unit: 'A', def: 0.02, min: 1e-4, max: 5, log: true },
    { key: 'n', label: 'Emission coefficient n', unit: '', def: 2, min: 1, max: 5, hidden: true },
  ];
  static description = 'Light-emitting diode. Forward voltage depends on colour; brightness is proportional to current.';
  onParamChange() {
    const c = LED_COLORS[this.p.color] || LED_COLORS.red;
    this.p.is = this.p.imax / Math.exp(c.vf / (this.p.n * VT));
    this.p.bv = 0;
    if (this.j) this.j.set(this.p.is, this.p.n, 0); else this.j = new Junction(this.p.is, this.p.n, 0);
  }
  constructor(x, y) { super(x, y); this.onParamChange(); }
  valueLabel() { return ''; }
  spice(n) { return `${this.name} ${n[0]} ${n[1]} D${this.name}\n.model D${this.name} D(Is=${this.p.is.toExponential(3)} N=${this.p.n})`; }
  localBox() { return [-2 * G, -1.2 * G, 2 * G, 0.75 * G]; }
  draw(g) {
    const c = LED_COLORS[this.p.color] || LED_COLORS.red;
    const b = g.running ? Math.max(0, Math.min(1.5, this.i / this.p.imax)) : 0;
    const over = this.i > this.p.imax * 2.5;
    if (b > 0.01) g.glow(0, 0, G * (1.2 + b * 1.1), over ? '255,255,255' : c.rgb, Math.min(1, 0.25 + b * 0.75));
    this.drawDiodeBody(g, b > 0.01 ? `rgba(${c.rgb},${Math.min(1, 0.3 + b)})` : `rgba(${c.rgb},0.18)`);
    const ctx = g.ctx;
    for (const dx of [-G * 0.05, G * 0.35]) {
      ctx.beginPath(); ctx.moveTo(dx, -G * 0.62); ctx.lineTo(dx + G * 0.35, -G * 1.0);
      ctx.strokeStyle = b > 0.01 ? `rgb(${c.rgb})` : g.muted; ctx.lineWidth = g.lw * 0.6; ctx.stroke();
      g.poly([[dx + G * 0.4, -G * 1.05], [dx + G * 0.18, -G * 0.98], [dx + G * 0.33, -G * 0.82]], { fill: b > 0.01 ? `rgb(${c.rgb})` : g.muted });
    }
  }
}
register(LED);

// --------------------------------------------------------------------- BJT
const BJT_PRESETS = {
  '2N3904': { is: 6.734e-15, bf: 416, br: 0.737, va: 74, cje: 4.5e-12, cjc: 3.6e-12 },
  '2N2222': { is: 14.34e-15, bf: 255.9, br: 6.092, va: 74.03, cje: 22e-12, cjc: 7.3e-12 },
  'BC547': { is: 1.8e-14, bf: 400, br: 35.5, va: 80, cje: 11.5e-12, cjc: 5.25e-12 },
  'BD139': { is: 1e-13, bf: 150, br: 5, va: 100, cje: 1e-10, cjc: 3e-11 },
  'Generic': { is: 1e-14, bf: 100, br: 1, va: 0, cje: 0, cjc: 0 },
};
const PNP_PRESETS = {
  '2N3906': { is: 1.41e-15, bf: 180.7, br: 4.977, va: 18.7, cje: 8.1e-12, cjc: 7.3e-12 },
  'BC557': { is: 1e-14, bf: 300, br: 10, va: 60, cje: 11e-12, cjc: 9e-12 },
  'BD140': { is: 1e-13, bf: 150, br: 5, va: 100, cje: 1e-10, cjc: 3e-11 },
  'Generic': { is: 1e-14, bf: 100, br: 1, va: 0, cje: 0, cjc: 0 },
};

export class NPN extends Element {
  static type = 'npn'; static title = 'NPN Transistor'; static category = 'Semiconductors';
  static prefix = 'Q'; static keywords = 'bjt bipolar transistor amplifier switch 2n3904 2n2222 bc547';
  static presets = BJT_PRESETS;
  static props = [
    { key: 'model', label: 'Model', type: 'select', def: '2N3904', options: Object.keys(BJT_PRESETS).map((k) => [k, k]).concat([['custom', 'Custom']]), preset: BJT_PRESETS },
    { key: 'bf', label: 'Forward β (hFE)', unit: '', def: 416, min: 1, max: 5000, knob: true },
    { key: 'is', label: 'Saturation current Is', unit: 'A', def: 6.734e-15, min: 1e-20, max: 1e-6, log: true },
    { key: 'br', label: 'Reverse β', unit: '', def: 0.737, min: 0.01, max: 1000 },
    { key: 'va', label: 'Early voltage (0 = ∞)', unit: 'V', def: 74, min: 0, max: 1e4 },
    { key: 'cje', label: 'B-E capacitance', unit: 'F', def: 4.5e-12, min: 0, max: 1e-6 },
    { key: 'cjc', label: 'B-C capacitance', unit: 'F', def: 3.6e-12, min: 0, max: 1e-6 },
  ];
  static description = 'Bipolar junction transistor (Ebers–Moll transport model with Early effect and junction capacitances). Terminals: B (left), C (top), E (bottom).';
  pol = 1;
  nonlinear = true;
  constructor(x, y) {
    super(x, y);
    this.postCurrents = [0, 0, 0];
    this.jbe = new Junction(this.p.is, 1); this.jbc = new Junction(this.p.is, 1);
    this.cbe = new CapState(); this.cbc = new CapState();
  }
  localPosts() { return [[-2 * G, 0], [G, -2 * G], [G, 2 * G]]; }
  localBox() { return [-2 * G, -2 * G, G * 1.4, 2 * G]; }
  leads() { return [[0, -2 * G, 0, -G * 0.45, 0], [1, G, -2 * G, G, -G * 0.95], [2, G, 2 * G, G, G * 0.95]]; }
  labelSide() { return [1, 0]; }
  valueLabel() { return this.p.model === 'custom' ? `β=${this.p.bf}` : this.p.model; }
  onParamChange() { this.jbe?.set(this.p.is, 1); this.jbc?.set(this.p.is, 1); }
  reset() {
    this.onParamChange();
    this.jbe.vd = 0; this.jbc.vd = 0; this.cbe.reset(0); this.cbc.reset(0);
    this.postCurrents = [0, 0, 0]; this.i = 0;
    this.sm = null;
  }
  stamp(s) {
    const [b, c, e] = this.nodes;
    this.cbe.stamp(s, b, e, this.p.cje); this.cbc.stamp(s, b, c, this.p.cjc);
  }
  stampStep(s) {
    const [b, c, e] = this.nodes;
    this.cbe.step(s, b, e, this.p.cje); this.cbc.step(s, b, c, this.p.cjc);
  }
  evalAt(vbe, vbc) {
    const { is, bf, br, va } = this.p;
    const gmin = 1e-12;
    const fe = safeExp(vbe / VT), fc = safeExp(vbc / VT);
    const kq = va > 0 ? Math.max(0.05, 1 - vbc / va) : 1;
    const ict = is * (fe.e - fc.e) * kq;
    const dict_dbe = (is / VT) * fe.d * kq;
    const dict_dbc = -(is / VT) * fc.d * kq + (va > 0 && kq > 0.05 ? -is * (fe.e - fc.e) / va : 0);
    const ibe = (is / bf) * (fe.e - 1) + gmin * vbe, gbe = (is / bf / VT) * fe.d + gmin;
    const ibc = (is / br) * (fc.e - 1) + gmin * vbc, gbc = (is / br / VT) * fc.d + gmin;
    return {
      ic: ict - ibc, ib: ibe + ibc,
      dic_dbe: dict_dbe, dic_dbc: dict_dbc - gbc,
      dib_dbe: gbe, dib_dbc: gbc,
    };
  }
  stampNL(s) {
    const [b, c, e] = this.nodes, p = this.pol;
    const vbe = this.jbe.limit(s, p * (s.v(b) - s.v(e)));
    const vbc = this.jbc.limit(s, p * (s.v(b) - s.v(c)));
    const m = this.evalAt(vbe, vbc);
    s.addNLCurrent(c, e, p * m.ic, [[b, e, m.dic_dbe, p * vbe], [b, c, m.dic_dbc, p * vbc]]);
    s.addNLCurrent(b, e, p * m.ib, [[b, e, m.dib_dbe, p * vbe], [b, c, m.dib_dbc, p * vbc]]);
    this.sm = m;
  }
  accept(s) {
    const [b, c, e] = this.nodes, p = this.pol;
    const vbe = p * (s.v(b) - s.v(e)), vbc = p * (s.v(b) - s.v(c));
    this.jbe.vd = vbe; this.jbc.vd = vbc;
    const m = this.evalAt(vbe, vbc);
    this.sm = m;
    this.cbe.accept(s, b, e, this.p.cje); this.cbc.accept(s, b, c, this.p.cjc);
    const ib = p * m.ib + this.cbe.i + this.cbc.i, ic = p * m.ic - this.cbc.i;
    this.postCurrents = [ib, ic, -(ib + ic)];
    this.i = ic;
    this.vbe = vbe; this.vce = vbe - vbc;
  }
  stampAC(ac) {
    const [b, c, e] = this.nodes, m = this.sm;
    if (m) {
      ac.addVCCS(c, e, b, e, m.dic_dbe); ac.addVCCS(c, e, b, c, m.dic_dbc);
      ac.addVCCS(b, e, b, e, m.dib_dbe); ac.addVCCS(b, e, b, c, m.dib_dbc);
    }
    ac.addY(b, e, 0, ac.omega * this.p.cje);
    ac.addY(b, c, 0, ac.omega * this.p.cjc);
  }
  region() {
    const vbe = this.vbe ?? 0, vbc = (this.vbe ?? 0) - (this.vce ?? 0);
    if (vbe < 0.5 && vbc < 0.5) return 'Cut-off';
    if (vbe >= 0.5 && vbc < 0.4) return 'Active';
    if (vbe >= 0.5 && vbc >= 0.4) return 'Saturation';
    return 'Reverse active';
  }
  readings(s) {
    const [b, c, e] = this.nodes;
    const ib = this.postCurrents[0], ic = this.postCurrents[1];
    return [['Region', this.region(), ''], ['Vbe', s.v(b) - s.v(e), 'V'], ['Vce', s.v(c) - s.v(e), 'V'], ['Ib', ib, 'A'], ['Ic', ic, 'A'],
      ['β (Ic/Ib)', Math.abs(ib) > 1e-15 ? ic / ib : 0, ''], ['Power', (s.v(c) - s.v(e)) * ic + (s.v(b) - s.v(e)) * ib, 'W']];
  }
  spice(n) {
    const t = this.pol > 0 ? 'NPN' : 'PNP', p = this.p;
    return `${this.name} ${n[1]} ${n[0]} ${n[2]} Q${this.name}\n.model Q${this.name} ${t}(Is=${p.is} Bf=${p.bf} Br=${p.br}${p.va ? ` Vaf=${p.va}` : ''} Cje=${p.cje} Cjc=${p.cjc})`;
  }
  draw(g) {
    g.circle(G * 0.25, 0, G * 1.3, { stroke: g.body, width: g.lw * 0.7, fill: g.fill });
    g.line(-G * 0.45, -G * 0.75, -G * 0.45, G * 0.75, g.vc(g.pv(0)), g.lw * 1.5);
    g.poly([[-G * 0.45, -G * 0.35], [G, -G * 0.95]], { stroke: g.vc(g.pv(1)), width: g.lw });
    g.poly([[-G * 0.45, G * 0.35], [G, G * 0.95]], { stroke: g.vc(g.pv(2)), width: g.lw });
    // emitter arrow
    const ax = this.pol > 0 ? G * 0.75 : -G * 0.1, ay = this.pol > 0 ? G * 0.85 : G * 0.47;
    const dir = this.pol > 0 ? 1 : -1;
    const ux = 1.45 / 1.57 * dir, uy = 0.6 / 1.57 * dir;
    g.poly([[ax, ay], [ax - ux * 8 - uy * 4, ay - uy * 8 + ux * 4], [ax - ux * 8 + uy * 4, ay - uy * 8 - ux * 4]], { fill: g.vc(g.pv(2)) });
  }
}
register(NPN);

export class PNP extends NPN {
  static type = 'pnp'; static title = 'PNP Transistor';
  static keywords = 'bjt bipolar transistor pnp 2n3906 bc557';
  static presets = PNP_PRESETS;
  static props = [
    { key: 'model', label: 'Model', type: 'select', def: '2N3906', options: Object.keys(PNP_PRESETS).map((k) => [k, k]).concat([['custom', 'Custom']]), preset: PNP_PRESETS },
    ...NPN.props.slice(1).map((p) => ({ ...p, def: PNP_PRESETS['2N3906'][p.key] ?? p.def })),
  ];
  static description = 'PNP bipolar transistor. Terminals: B (left), C (top), E (bottom) — for high-side use, flip it so the emitter is on top.';
  pol = -1;
}
register(PNP);

// ------------------------------------------------------------------ MOSFET
const NMOS_PRESETS = {
  '2N7000': { vt: 2.1, kp: 0.26, lambda: 0.01, cgs: 20e-12, cgd: 5e-12, bodyDiode: true },
  'IRF540N': { vt: 3.5, kp: 20, lambda: 0.005, cgs: 1.7e-9, cgd: 1.5e-10, bodyDiode: true },
  'IRLZ44N': { vt: 1.6, kp: 25, lambda: 0.005, cgs: 1.6e-9, cgd: 2e-10, bodyDiode: true },
  'Logic-level': { vt: 1.2, kp: 1, lambda: 0.02, cgs: 0, cgd: 0, bodyDiode: false },
  'Generic': { vt: 1.5, kp: 0.02, lambda: 0.02, cgs: 0, cgd: 0, bodyDiode: false },
};
const PMOS_PRESETS = {
  'BS250': { vt: 2.0, kp: 0.15, lambda: 0.01, cgs: 20e-12, cgd: 5e-12, bodyDiode: true },
  'IRF9540': { vt: 3.2, kp: 8, lambda: 0.005, cgs: 1.2e-9, cgd: 1.5e-10, bodyDiode: true },
  'Generic': { vt: 1.5, kp: 0.01, lambda: 0.02, cgs: 0, cgd: 0, bodyDiode: false },
};

export class NMOS extends Element {
  static type = 'nmos'; static title = 'N-MOSFET'; static category = 'Semiconductors';
  static prefix = 'M'; static keywords = 'mosfet fet transistor nmos enhancement switch 2n7000 irf540';
  static presets = NMOS_PRESETS;
  static props = [
    { key: 'model', label: 'Model', type: 'select', def: '2N7000', options: Object.keys(NMOS_PRESETS).map((k) => [k, k]).concat([['custom', 'Custom']]), preset: NMOS_PRESETS },
    { key: 'vt', label: 'Threshold |Vth|', unit: 'V', def: 2.1, min: 0, max: 20, knob: true },
    { key: 'kp', label: 'Transconductance k (µCox·W/L)', unit: 'A/V²', def: 0.26, min: 1e-6, max: 1000, log: true },
    { key: 'lambda', label: 'Channel-length modulation λ', unit: '1/V', def: 0.01, min: 0, max: 1 },
    { key: 'cgs', label: 'Gate-source capacitance', unit: 'F', def: 20e-12, min: 0, max: 1e-6 },
    { key: 'cgd', label: 'Gate-drain capacitance', unit: 'F', def: 5e-12, min: 0, max: 1e-6 },
    { key: 'bodyDiode', label: 'Body diode', type: 'bool', def: true },
  ];
  static description = 'Enhancement MOSFET, Shichman–Hodges (SPICE level 1) model with body diode. Terminals: G (left), D (top), S (bottom).';
  pol = 1;
  nonlinear = true;
  constructor(x, y) {
    super(x, y);
    this.postCurrents = [0, 0, 0];
    this.cgs = new CapState(); this.cgd = new CapState();
    this.jbd = new Junction(1e-12, 1);
  }
  localPosts() { return [[-2 * G, 0], [G, -2 * G], [G, 2 * G]]; }
  localBox() { return [-2 * G, -2 * G, G * 1.4, 2 * G]; }
  leads() { return [[0, -2 * G, 0, -G * 0.55, 0], [1, G, -2 * G, G, -G * 0.6], [2, G, 2 * G, G, G * 0.6]]; }
  labelSide() { return [1, 0]; }
  valueLabel() { return this.p.model === 'custom' ? '' : this.p.model; }
  reset() {
    this.cgs.reset(0); this.cgd.reset(0); this.jbd.vd = 0;
    this.vgsOld = 0; this.vdsOld = 0; this.postCurrents = [0, 0, 0]; this.i = 0; this.sm = null;
  }
  stamp(s) {
    const [g, d, so] = this.nodes;
    this.cgs.stamp(s, g, so, this.p.cgs); this.cgd.stamp(s, g, d, this.p.cgd);
  }
  stampStep(s) {
    const [g, d, so] = this.nodes;
    this.cgs.step(s, g, so, this.p.cgs); this.cgd.step(s, g, d, this.p.cgd);
  }
  ids(vgs, vds) {
    const { vt, kp, lambda } = this.p;
    const vov = vgs - vt;
    if (vov <= 0) return { id: 0, gm: 0, gds: 0 };
    const cl = 1 + lambda * vds;
    if (vds < vov) {
      const core = vov * vds - (vds * vds) / 2;
      return { id: kp * core * cl, gm: kp * vds * cl, gds: kp * (vov - vds) * cl + kp * core * lambda };
    }
    return { id: 0.5 * kp * vov * vov * cl, gm: kp * vov * cl, gds: 0.5 * kp * vov * vov * lambda };
  }
  channel(s, vgA, vdA, vsA, limit) {
    const p = this.pol;
    let vgs = p * (vgA - vsA), vds = p * (vdA - vsA);
    if (limit) {
      const dg = vgs - this.vgsOld, dd = vds - this.vdsOld;
      if (Math.abs(dg) > 2) { vgs = this.vgsOld + Math.sign(dg) * 2; s.limited = true; }
      if (Math.abs(dd) > 6) { vds = this.vdsOld + Math.sign(dd) * 6; s.limited = true; }
      this.vgsOld = vgs; this.vdsOld = vds;
    }
    return { vgs, vds };
  }
  stampNL(s) {
    const [g, d, so] = this.nodes, p = this.pol;
    const { vgs, vds } = this.channel(s, s.v(g), s.v(d), s.v(so), true);
    const gmin = 1e-12;
    if (vds >= 0) {
      const m = this.ids(vgs, vds);
      s.addNLCurrent(d, so, p * m.id, [[g, so, m.gm, p * vgs], [d, so, m.gds + gmin, p * vds]]);
      this.sm = { ...m, rev: false };
    } else {
      const m = this.ids(vgs - vds, -vds);
      s.addNLCurrent(so, d, p * m.id, [[g, d, m.gm, p * (vgs - vds)], [so, d, m.gds + gmin, -p * vds]]);
      this.sm = { ...m, rev: true };
    }
    if (this.p.bodyDiode) {
      // body diode: anode = source (NMOS), cathode = drain
      const v = this.jbd.limit(s, p * (s.v(so) - s.v(d)));
      const { i, g: gd } = diodeIV(v, 1e-12, 1, 0);
      const a = p > 0 ? so : d, c = p > 0 ? d : so;
      s.addG(a, c, gd); s.addI(a, c, i - gd * v);
    }
  }
  accept(s) {
    const [g, d, so] = this.nodes, p = this.pol;
    const { vgs, vds } = this.channel(s, s.v(g), s.v(d), s.v(so), false);
    this.vgsOld = vgs; this.vdsOld = vds;
    let id;
    if (vds >= 0) { const m = this.ids(vgs, vds); id = p * m.id; this.sm = { ...m, rev: false }; } else { const m = this.ids(vgs - vds, -vds); id = -p * m.id; this.sm = { ...m, rev: true }; }
    let ibd = 0;
    if (this.p.bodyDiode) {
      const v = p * (s.v(so) - s.v(d));
      this.jbd.vd = v;
      ibd = p * diodeIV(v, 1e-12, 1, 0).i; // flows source -> drain (actual)
    }
    this.cgs.accept(s, g, so, this.p.cgs); this.cgd.accept(s, g, d, this.p.cgd);
    const idrain = id - ibd - this.cgd.i;
    const ig = this.cgs.i + this.cgd.i;
    this.postCurrents = [ig, idrain, -(ig + idrain)];
    this.i = idrain;
    this.vgs = vgs; this.vds = vds;
  }
  stampAC(ac) {
    const [g, d, so] = this.nodes, m = this.sm;
    if (m) {
      if (!m.rev) { ac.addVCCS(d, so, g, so, m.gm); ac.addY(d, so, m.gds + 1e-12); } else { ac.addVCCS(so, d, g, d, m.gm); ac.addY(d, so, m.gds + 1e-12); }
    }
    ac.addY(g, so, 0, ac.omega * this.p.cgs);
    ac.addY(g, d, 0, ac.omega * this.p.cgd);
  }
  region() {
    const vgs = this.vgs ?? 0, vds = Math.abs(this.vds ?? 0);
    if (vgs <= this.p.vt) return 'Cut-off';
    return vds < vgs - this.p.vt ? 'Triode (ohmic)' : 'Saturation';
  }
  readings(s) {
    const [g, d, so] = this.nodes;
    return [['Region', this.region(), ''], ['Vgs', s.v(g) - s.v(so), 'V'], ['Vds', s.v(d) - s.v(so), 'V'], ['Id', this.postCurrents[1], 'A'],
      ['gm', this.sm ? this.sm.gm : 0, 'S'], ['Power', (s.v(d) - s.v(so)) * this.postCurrents[1], 'W']];
  }
  spice(n) {
    const t = this.pol > 0 ? 'NMOS' : 'PMOS', p = this.p;
    return `${this.name} ${n[1]} ${n[0]} ${n[2]} ${n[2]} M${this.name}\n.model M${this.name} ${t}(Level=1 Vto=${this.pol * p.vt} Kp=${p.kp} Lambda=${p.lambda} Cgso=0 Cgdo=0)`;
  }
  draw(g) {
    g.circle(G * 0.3, 0, G * 1.3, { stroke: g.body, width: g.lw * 0.7, fill: g.fill });
    g.line(-G * 0.55, -G * 0.6, -G * 0.55, G * 0.6, g.vc(g.pv(0)), g.lw * 1.2);
    const cx = -G * 0.25;
    for (const [y1, y2] of [[-G * 0.75, -G * 0.35], [-G * 0.2, G * 0.2], [G * 0.35, G * 0.75]]) g.line(cx, y1, cx, y2, g.body, g.lw * 1.3);
    g.poly([[cx, -G * 0.6], [G, -G * 0.6]], { stroke: g.vc(g.pv(1)), width: g.lw });
    g.poly([[cx, G * 0.6], [G, G * 0.6]], { stroke: g.vc(g.pv(2)), width: g.lw });
    g.poly([[cx, 0], [G, 0], [G, G * 0.6]], { stroke: g.vc(g.pv(2)), width: g.lw * 0.8 });
    const dir = this.pol > 0 ? -1 : 1;
    const ax = this.pol > 0 ? cx + 2 : G * 0.6;
    g.poly([[ax, 0], [ax - dir * 7, -4], [ax - dir * 7, 4]], { fill: g.vc(g.pv(2)) });
    if (this.p.bodyDiode) {
      const x = G * 1.25;
      g.poly([[G, -G * 0.6], [x, -G * 0.6], [x, G * 0.6], [G, G * 0.6]], { stroke: g.muted, width: g.lw * 0.5 });
      const up = this.pol > 0;
      g.poly(up ? [[x - 4, G * 0.12], [x + 4, G * 0.12], [x, -G * 0.12]] : [[x - 4, -G * 0.12], [x + 4, -G * 0.12], [x, G * 0.12]], { fill: g.muted });
    }
  }
}
register(NMOS);

export class PMOS extends NMOS {
  static type = 'pmos'; static title = 'P-MOSFET';
  static keywords = 'mosfet fet pmos p-channel high side switch irf9540 bs250';
  static presets = PMOS_PRESETS;
  static props = [
    { key: 'model', label: 'Model', type: 'select', def: 'BS250', options: Object.keys(PMOS_PRESETS).map((k) => [k, k]).concat([['custom', 'Custom']]), preset: PMOS_PRESETS },
    ...NMOS.props.slice(1).map((p) => ({ ...p, def: PMOS_PRESETS.BS250[p.key] ?? p.def })),
  ];
  static description = 'P-channel enhancement MOSFET (level 1). Source usually connects to the positive supply — flip it so S is on top.';
  pol = -1;
}
register(PMOS);

// -------------------------------------------------------------------- JFET
export class NJFET extends Element {
  static type = 'njfet'; static title = 'N-JFET'; static category = 'Semiconductors';
  static prefix = 'J'; static keywords = 'jfet junction fet depletion j201 2n5457';
  static props = [
    { key: 'idss', label: 'IDSS', unit: 'A', def: 5e-3, min: 1e-6, max: 1, log: true, knob: true },
    { key: 'vp', label: 'Pinch-off |Vp|', unit: 'V', def: 2, min: 0.1, max: 20 },
    { key: 'lambda', label: 'λ', unit: '1/V', def: 0.005, min: 0, max: 1 },
  ];
  static description = 'Junction FET (square-law model with gate junction diodes). Terminals: G (left), D (top), S (bottom).';
  pol = 1;
  nonlinear = true;
  constructor(x, y) {
    super(x, y);
    this.postCurrents = [0, 0, 0];
    this.jgs = new Junction(1e-14, 1); this.jgd = new Junction(1e-14, 1);
  }
  localPosts() { return [[-2 * G, 0], [G, -2 * G], [G, 2 * G]]; }
  localBox() { return [-2 * G, -2 * G, G * 1.4, 2 * G]; }
  leads() { return [[0, -2 * G, 0, -G * 0.3, 0], [1, G, -2 * G, G, -G * 0.55], [2, G, 2 * G, G, G * 0.55]]; }
  labelSide() { return [1, 0]; }
  reset() { this.jgs.vd = 0; this.jgd.vd = 0; this.postCurrents = [0, 0, 0]; this.sm = null; this.vgsOld = 0; this.vdsOld = 0; }
  ids(vgs, vds) {
    const vp = -Math.abs(this.p.vp), beta = this.p.idss / (vp * vp), lam = this.p.lambda;
    const vov = vgs - vp;
    if (vov <= 0) return { id: 0, gm: 0, gds: 0 };
    const cl = 1 + lam * vds;
    if (vds < vov) {
      const core = 2 * vov * vds - vds * vds;
      return { id: beta * core * cl, gm: 2 * beta * vds * cl, gds: beta * (2 * vov - 2 * vds) * cl + beta * core * lam };
    }
    return { id: beta * vov * vov * cl, gm: 2 * beta * vov * cl, gds: beta * vov * vov * lam };
  }
  stampNL(s) {
    const [g, d, so] = this.nodes, p = this.pol;
    let vgs = p * (s.v(g) - s.v(so)), vds = p * (s.v(d) - s.v(so));
    if (Math.abs(vgs - this.vgsOld) > 1) { vgs = this.vgsOld + Math.sign(vgs - this.vgsOld); s.limited = true; }
    this.vgsOld = vgs; this.vdsOld = vds;
    if (vds >= 0) {
      const m = this.ids(vgs, vds);
      s.addNLCurrent(d, so, p * m.id, [[g, so, m.gm, p * vgs], [d, so, m.gds + 1e-12, p * vds]]);
      this.sm = { ...m, rev: false };
    } else {
      const m = this.ids(vgs - vds, -vds);
      s.addNLCurrent(so, d, p * m.id, [[g, d, m.gm, p * (vgs - vds)], [so, d, m.gds + 1e-12, -p * vds]]);
      this.sm = { ...m, rev: true };
    }
    for (const [j, other] of [[this.jgs, so], [this.jgd, d]]) {
      const v = j.limit(s, p * (s.v(g) - s.v(other)));
      const { i, g: gd } = diodeIV(v, 1e-14, 1, 0);
      const a = p > 0 ? g : other, c = p > 0 ? other : g;
      s.addG(a, c, gd); s.addI(a, c, i - gd * v);
    }
  }
  accept(s) {
    const [g, d, so] = this.nodes, p = this.pol;
    const vgs = p * (s.v(g) - s.v(so)), vds = p * (s.v(d) - s.v(so));
    this.vgsOld = vgs;
    let id;
    if (vds >= 0) { const m = this.ids(vgs, vds); id = p * m.id; this.sm = { ...m, rev: false }; } else { const m = this.ids(vgs - vds, -vds); id = -p * m.id; this.sm = { ...m, rev: true }; }
    const igs = p * diodeIV(p * (s.v(g) - s.v(so)), 1e-14, 1, 0).i, igd = p * diodeIV(p * (s.v(g) - s.v(d)), 1e-14, 1, 0).i;
    this.jgs.vd = p * (s.v(g) - s.v(so)); this.jgd.vd = p * (s.v(g) - s.v(d));
    this.postCurrents = [igs + igd, id - igd, -id - igs];
    this.i = id;
  }
  stampAC(ac) {
    const [g, d, so] = this.nodes, m = this.sm;
    if (!m) return;
    if (!m.rev) ac.addVCCS(d, so, g, so, m.gm); else ac.addVCCS(so, d, g, d, m.gm);
    ac.addY(d, so, m.gds + 1e-12);
  }
  readings(s) {
    const [g, d, so] = this.nodes;
    return [['Vgs', s.v(g) - s.v(so), 'V'], ['Vds', s.v(d) - s.v(so), 'V'], ['Id', this.postCurrents[1], 'A']];
  }
  spice(n) {
    const beta = this.p.idss / (this.p.vp * this.p.vp);
    return `${this.name} ${n[1]} ${n[0]} ${n[2]} J${this.name}\n.model J${this.name} ${this.pol > 0 ? 'NJF' : 'PJF'}(Vto=${-this.pol * this.p.vp} Beta=${beta} Lambda=${this.p.lambda})`;
  }
  draw(g) {
    g.circle(G * 0.3, 0, G * 1.3, { stroke: g.body, width: g.lw * 0.7, fill: g.fill });
    g.line(-G * 0.1, -G * 0.8, -G * 0.1, G * 0.8, g.body, g.lw * 1.4);
    g.poly([[-G * 0.1, -G * 0.55], [G, -G * 0.55]], { stroke: g.vc(g.pv(1)), width: g.lw });
    g.poly([[-G * 0.1, G * 0.55], [G, G * 0.55]], { stroke: g.vc(g.pv(2)), width: g.lw });
    g.line(-G * 0.3, 0, -G * 0.1, 0, g.vc(g.pv(0)), g.lw);
    const dir = this.pol > 0 ? 1 : -1;
    const ax = this.pol > 0 ? -G * 0.12 : -G * 0.55;
    g.poly([[ax, 0], [ax - dir * 7, -4], [ax - dir * 7, 4]], { fill: g.vc(g.pv(0)) });
  }
}
register(NJFET);

export class PJFET extends NJFET {
  static type = 'pjfet'; static title = 'P-JFET';
  static keywords = 'jfet p-channel junction fet';
  static description = 'P-channel junction FET (square-law model).';
  pol = -1;
}
register(PJFET);
