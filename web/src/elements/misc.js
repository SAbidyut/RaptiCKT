// Installation, lighting, displays and other output devices:
//  - ACB (LSI trip unit) and thermal fuse (TCO)
//  - cables with resistance / reactance / ampacity and voltage drop, busbar,
//    junction box, net labels
//  - halogen lamp, CFL (electronic ballast), LED strip, LED driver (CC / CV,
//    active PFC), photocell (dusk-to-dawn) switch, PIR light switch,
//    emergency light with internal battery
//  - 14-segment ASCII display, 8×8 LED dot matrix, 3½-digit panel meter
//  - headphone, opto-SCR, laser module, Peltier module, DC fan, electromagnet

import { Element, TwoTerm, register, getType, GRID } from './base.js';
import { Composite, withChip } from './kit.js';
import { Resistor, Capacitor } from './passive.js';
import { Diode, Junction, diodeIV } from './semis.js';
import { Bulb } from './electrical.js';
import { MCCB } from './protection.js';
import { Chip, P, bits, val } from './digital2.js';
import { DIGI_PROPS } from './digital.js';
import { fmtQty, fmtShort } from '../engine/units.js';
import { CableHeat, STATE_TEXT } from './cables.js';

const G = GRID;
const TAU = 2 * Math.PI;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
function soft(v, r, s = 0.02) {
  const x = v / s, sp = x > 30 ? x : x < -30 ? Math.exp(x) : Math.log1p(Math.exp(x)), sg = 1 / (1 + Math.exp(-clamp(x, -60, 60)));
  return { i: (s * sp) / r, g: sg / r };
}
/** current through n identical diodes in series with R, for a voltage v (local Newton) */
function stringIV(v, n, is, nn, R) {
  const vt = n * nn * 0.025852;
  if (v <= 0) return { i: v * 1e-12, g: 1e-12 };
  let lo = 0, hi = v / R, i = Math.min(hi, Math.max(0, (v - n * nn * 0.6) / R));
  for (let it = 0; it < 60; it++) {
    const f = vt * Math.log1p(i / is) + i * R - v, d = vt / (is + i) + R;
    if (f > 0) hi = i; else lo = i;
    let ni = i - f / d;
    if (!(ni > lo && ni < hi)) ni = (lo + hi) / 2;
    if (Math.abs(ni - i) < 1e-15 + 1e-12 * i) { i = ni; break; }
    i = ni;
  }
  return { i, g: 1 / (vt / (is + i) + R) };
}
class Ema { constructor(tau) { this.tau = tau; this.v = 0; } push(x, dt) { this.v += (x - this.v) * Math.min(1, dt / this.tau); return this.v; } }

// ================================================================ protection
export class ACB extends MCCB {
  static type = 'acb'; static title = 'ACB (air circuit breaker, LSI)';
  static keywords = 'acb air circuit breaker lsi trip unit long time short time instantaneous main incomer switchboard';
  static props = [
    { key: 'in', label: 'Frame rating In', unit: 'A', def: 1600, min: 100, max: 6300, log: true, knob: true },
    { key: 'ir', label: 'Long-time pickup Ir/In', unit: '', def: 1, min: 0.4, max: 1 },
    { key: 'tr', label: 'Long-time delay (at 6 Ir)', unit: 's', def: 10, min: 0.5, max: 30 },
    { key: 'isd', label: 'Short-time pickup Isd/Ir', unit: '', def: 6, min: 1.5, max: 10 },
    { key: 'tsd', label: 'Short-time delay', unit: 's', def: 0.2, min: 0, max: 0.5 },
    { key: 'ii', label: 'Instantaneous Ii/In', unit: '', def: 12, min: 2, max: 15 },
    { key: 'on', label: 'Switched on', type: 'bool', def: true },
  ];
  static description = 'Air circuit breaker with an electronic LSI trip unit, used as the main incomer of LV switchboards: L — long-time (overload, inverse-time, trips in tr seconds at 6×Ir), S — short-time (fault current above Isd held for tsd, so downstream breakers can clear first: selectivity), I — instantaneous above Ii×In. Tap to switch / reset.';
  ratedI() { return this.p.in * this.p.ir; }
  magMultiple() { return this.p.ii / this.p.ir; }
  thermalTau() { return this.p.tr / 0.04807; }
  reset() { super.reset(); this.st2 = [0, 0, 0]; this.tst = 0; }
  accept(s) {
    super.accept(s);
    if (s.mode === 'dc' || !this.closed()) return;
    // per-pole RMS over about a cycle
    this.branches.forEach((k, j) => { this.st2[j] += (s.x[k] * s.x[k] - this.st2[j]) * Math.min(1, s.dt / 0.01); });
    this.tst = Math.sqrt(Math.max(...this.st2)) > this.p.isd * this.ratedI() ? this.tst + s.dt : 0;
    if (this.tst >= this.p.tsd && this.p.tsd > 0) this.trip(s, 'Short circuit (short-time delay)');
  }
  valueLabel() { return fmtShort(this.ratedI(), 'A'); }
}
register(ACB);

export class ThermalFuse extends TwoTerm {
  static type = 'tco'; static title = 'Thermal Fuse (TCO)'; static category = 'Protection';
  static prefix = 'F'; static keywords = 'thermal fuse thermal cut off tco one shot temperature fuse kettle iron hair dryer';
  static props = [
    { key: 'temp', label: 'Body temperature', unit: '°C', def: 40, min: -20, max: 300, knob: true },
    { key: 'tf', label: 'Rated functioning temperature', unit: '°C', def: 152, min: 50, max: 250 },
  ];
  static description = 'One-shot thermal cut-off: conducts (≈5 mΩ) until its body reaches the rated temperature, then opens permanently — the last line of defence in kettles, irons and motors. Tap to replace it after it has opened.';
  interactive = true;
  reset() { this.open = false; this.setCurrent(0); }
  g() { return this.open ? 1e-9 : 200; }
  stamp(s) { s.addG(this.nodes[0], this.nodes[1], this.g()); }
  stampAC(ac) { ac.addY(this.nodes[0], this.nodes[1], this.g()); }
  accept(s) {
    this.setCurrent(this.voltageDiff(s) * this.g());
    if (s.mode !== 'dc' && !this.open && this.p.temp >= this.p.tf) { this.open = true; s.markEvent(); }
  }
  onTap() { if (this.open) { this.open = false; this.p.temp = Math.min(this.p.temp, this.p.tf - 10); return true; } return false; }
  valueLabel() { return this.open ? 'OPEN' : `${Math.round(this.p.tf)}°C`; }
  readings(s) { return [['State', this.open ? 'OPEN (replace)' : 'closed', ''], ['Temperature', this.p.temp, '°C'], ['Current', this.i, 'A']]; }
  draw(g) {
    g.box(-G, -0.3 * G, G, 0.3 * G, { stroke: g.body, width: g.lw * 0.8, fill: g.fill, r: 2 });
    if (this.open) { g.line(-G, 0, -0.2 * G, 0.12 * G, g.vc(g.pv(0)), g.lw); g.line(G, 0, 0.2 * G, -0.12 * G, g.vc(g.pv(1)), g.lw); g.glow(0, 0, 0.8 * G, '255,80,40', 0.3); }
    else g.line(-G, 0, G, 0, g.vc(g.pv(0)), g.lw);
    g.upright(() => g.text('θ', 0, -0.62 * G, { size: 8, color: g.accent, bold: true }));
  }
}
register(ThermalFuse);

// ============================================================ installation
const SIZES = [1, 1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240];
// IEC 60364-5-52, PVC copper, method C (clipped direct): 2 and 3 loaded conductors
const AMP2 = { 1: 15, 1.5: 19.5, 2.5: 27, 4: 36, 6: 46, 10: 63, 16: 85, 25: 112, 35: 138, 50: 168, 70: 213, 95: 258, 120: 299, 150: 344, 185: 392, 240: 461 };
const AMP3 = { 1: 13.5, 1.5: 17.5, 2.5: 24, 4: 32, 6: 41, 10: 57, 16: 76, 25: 96, 35: 119, 50: 144, 70: 184, 95: 223, 120: 259, 150: 299, 185: 341, 240: 403 };
const MAT = { cu: { rho: 0.017241, a: 0.00393, k: 1 }, al: { rho: 0.02826, a: 0.00403, k: 0.78 } };

class Cable extends Element {
  static category = 'Power Systems';
  static prefix = 'W';
  static cores = 2;
  static props = [
    { key: 'len', label: 'Length', unit: 'm', def: 30, min: 0.1, max: 1e5, log: true, knob: true },
    { key: 'size', label: 'Conductor size', type: 'select', def: '2.5', options: SIZES.map((x) => [String(x), `${x} mm²`]) },
    { key: 'mat', label: 'Conductor', type: 'select', def: 'cu', options: [['cu', 'Copper'], ['al', 'Aluminium']] },
    { key: 'temp', label: 'Conductor temperature', unit: '°C', def: 70, min: -20, max: 160 },
  ];
  constructor(x, y) { super(x, y); this.postCurrents = new Array(2 * this.n()).fill(0); this.onParamChange(); }
  n() { return this.constructor.cores; }
  /** conductor temperature: overloaded it smokes, catches fire and burns open (cables.js) */
  onParamChange() {
    const A = this.A(), spec = { type: this.p.mat === 'al' ? 'nayy' : 'nyy', size: A, shape: A >= 25 ? 'SM' : 'RE', inst: 'C' };
    if (this.heat) this.heat.setSpec(spec, this.ampacity()); else this.heat = new CableHeat(spec, this.ampacity());
  }
  labels() { return ['L', 'N']; }
  localPosts() { const n = this.n(), ys = n === 2 ? [-G, G] : [-3 * G, -G, G, 3 * G]; return [...ys.map((y) => [-2 * G, y]), ...ys.map((y) => [2 * G, y])]; }
  localBox() { const h = this.n() === 2 ? 1.5 * G : 3.5 * G; return [-2 * G, -h, 2 * G, h]; }
  leads() { return this.localPosts().map(([x, y], i) => [i, x, y, Math.sign(x) * 1.3 * G, y]); }
  connectivity() { const n = this.n(); return Array.from({ length: n }, (_, k) => [k, k + n]); }
  branchCount() { return this.n(); }
  A() { return parseFloat(this.p.size) || 2.5; }
  R() { if (this.damaged) return 1e9; const m = MAT[this.p.mat] || MAT.cu; return (m.rho * (1 + m.a * (this.p.temp - 20)) * this.p.len) / this.A(); }
  L() { return (0.08e-3 * this.p.len) / (TAU * 50); }
  ampacity() { const m = MAT[this.p.mat] || MAT.cu, t = this.n() === 2 ? AMP2 : AMP3; return (t[this.A()] ?? 27) * m.k; }
  reset() { this.il = new Array(this.n()).fill(0); this.irms = new Ema(0.1); this.irms.v = 0; this.vs = new Ema(0.1); this.vr = new Ema(0.1); this.postCurrents.fill(0); this.heat?.reset(); this.fire = false; this.smoke = false; }
  stamp(s) {
    const n = this.n(), R = this.R(), f = s.mode === 'dc' ? 0 : this.L() / s.dt;
    for (let k = 0; k < n; k++) { const a = this.nodes[k], b = this.nodes[k + n], br = this.branches[k]; s.addBranchKCL(a, b, br); s.addA(br, a - 1, 1); s.addA(br, b - 1, -1); s.addA(br, br, -(R + f)); }
  }
  stampStep(s) { if (s.mode !== 'dc') for (let k = 0; k < this.n(); k++) s.b[this.branches[k]] += -(this.L() / s.dt) * this.il[k]; }
  stampAC(ac) {
    const n = this.n(), R = this.R();
    for (let k = 0; k < n; k++) { const a = this.nodes[k], b = this.nodes[k + n], br = this.branches[k]; ac.addBranchKCL(a, b, br); ac.addA(br, a - 1, 1); ac.addA(br, b - 1, -1); ac.addA(br, br, -R, -ac.omega * this.L()); }
  }
  accept(s) {
    const n = this.n(), i = this.branches.map((b) => s.x[b]);
    this.il = i;
    i.forEach((x, k) => { this.postCurrents[k] = x; this.postCurrents[k + n] = -x; });
    this.i = i[0];
    if (s.mode === 'dc') { this.irms.v = i[0] * i[0]; return; }
    const v = (k) => s.v(this.nodes[k]);
    this.irms.push(Math.max(...i.map((x) => x * x)), s.dt);
    const vs = n === 2 ? v(0) - v(1) : v(0) - v(1), vr = n === 2 ? v(2) - v(3) : v(4) - v(5);
    this.vs.push(vs * vs, s.dt); this.vr.push(vr * vr, s.dt);
    if (this.damaged) return;
    let imax = 0;
    for (const x of i) if (Math.abs(x) > Math.abs(imax)) imax = x;
    if (this.heat.step(imax, s) && this.heat.state === 'burnt') this.setDamage(s, this.heat.why);
    this.stress = this.heat.stress();
    this.fire = this.heat.state === 'fire';
    this.smoke = this.heat.state === 'hot' || this.fire;
  }
  valueLabel() { return `${this.p.size} mm² ${fmtQty(this.p.len, 'm')}`; }
  readings(s) {
    const I = Math.sqrt(Math.max(0, this.irms?.v || 0)), Vs = Math.sqrt(Math.max(0, this.vs?.v || 0)), Vr = Math.sqrt(Math.max(0, this.vr?.v || 0));
    const drop = Vs > 1e-6 ? ((Vs - Vr) / Vs) * 100 : 0, amp = this.ampacity();
    return [['Resistance per conductor', this.R(), 'Ω'], ['Current (RMS)', I, 'A'], ['Current-carrying capacity', amp, 'A'],
      ['Loading', I > amp ? `OVERLOADED ${Math.round((I / amp) * 100)} %` : `${Math.round((I / amp) * 100)} %`, ''],
      ['Voltage drop', drop, '%'], ['Status', drop > 5 ? 'drop above 5 % — use a larger cable' : 'OK', ''], ['Power loss', I * I * this.R() * this.n(), 'W'],
      ['Insulation', this.damaged ? 'BURNT — ' + this.damaged.why : STATE_TEXT[this.heat.state], ''], ['Conductor temperature (heating)', this.heat.T, '°C']];
  }
  draw(g) {
    const n = this.n(), ys = this.localPosts().slice(0, n).map(([, y]) => y), [, y1, , y2] = this.localBox();
    g.box(-1.3 * G, y1 + 0.3 * G, 1.3 * G, y2 - 0.3 * G, { stroke: g.muted, width: g.lw * 0.6, fill: g.fill, r: 0.5 * G });
    const I = Math.sqrt(Math.max(0, this.irms?.v || 0)), hot = g.running && I > this.ampacity();
    if (this.damaged) ys.forEach((y) => { g.line(-1.3 * G, y, -0.2 * G, y, '#8b5a3c', g.lw); g.line(0.2 * G, y, 1.3 * G, y, '#8b5a3c', g.lw); });
    else ys.forEach((y, k) => g.line(-1.3 * G, y, 1.3 * G, y, hot ? '#ef4444' : g.vc(g.pv(k)), g.lw));
    this.labels().forEach((t, k) => g.text(t, -1.0 * G, ys[k] - 0.35 * G, { size: 6, color: g.muted }));
  }
}
class Cable2 extends Cable {
  static type = 'cable'; static title = 'Cable (2-core, L + N)'; static cores = 2;
  static keywords = 'cable wire 2 core twin voltage drop cross section mm2 ampacity copper aluminium house wiring';
  static description = 'Two-core installation cable (L and N): each conductor has R = ρ·L/A at the operating temperature (copper or aluminium) plus 0.08 mΩ/m reactance. Readings show the RMS current against the current-carrying capacity (IEC 60364-5-52, PVC, clipped direct) and the voltage drop — keep it under ≈5 % (3 % for lighting). Long runs of thin cable dim the lamps!';
}
register(Cable2);
class Cable4 extends Cable {
  static type = 'cable4'; static title = 'Cable (4-core, 3-phase + N)'; static cores = 4;
  static keywords = 'cable 4 core three phase armoured cable voltage drop sizing feeder';
  static description = 'Four-core three-phase cable (L1, L2, L3, N): R = ρ·L/A per conductor at the operating temperature plus 0.08 mΩ/m reactance; readings compare the highest line current with the current-carrying capacity for three loaded conductors and show the voltage drop (L1–L2).';
  labels() { return ['L1', 'L2', 'L3', 'N']; }
}
register(Cable4);

// Copper flat bar sizes (width × thickness, mm): cross-section and a typical AC rating for a painted
// bar indoors (DIN 43671 order of magnitude). Picking one fills in the area and the rating.
const BARS = { '12×2': [24, 123], '15×3': [45, 162], '20×3': [60, 204], '20×5': [100, 274], '25×5': [125, 337], '30×5': [150, 399], '40×5': [200, 524],
  '50×5': [250, 647], '40×10': [400, 852], '50×10': [500, 1020], '60×10': [600, 1180], '80×10': [800, 1500], '100×10': [1000, 1810] };
const BAR_PRESET = Object.fromEntries(Object.entries(BARS).map(([k, [w, rating]]) => [k, { w, rating }]));
const TAP_OPTS = Array.from({ length: 23 }, (_, i) => String(i + 2));

export class Busbar extends Element {
  static type = 'busbar'; static title = 'Busbar'; static category = 'Power Systems';
  static prefix = 'BB'; static keywords = 'busbar bus bar copper bar distribution board switchboard tap neutral link earth bar taps area size';
  static props = [
    { key: 'taps', label: 'Number of taps', type: 'select', def: '6', options: TAP_OPTS.map((n) => [n, `${n} taps`]), structural: true },
    { key: 'model', label: 'Bar size (copper, W × T)', type: 'select', def: '30×5', options: [...Object.entries(BARS).map(([k, [w]]) => [k, `${k} mm (${w} mm²)`]), ['custom', 'Custom']], preset: BAR_PRESET },
    { key: 'w', label: 'Bar cross-section (area)', unit: 'mm²', def: 150, min: 1, max: 1e4, log: true, knob: true },
    { key: 'rating', label: 'Current rating', unit: 'A', def: 399, min: 1, max: 1e4, log: true, knob: true },
    { key: 'pmm', label: 'Tap spacing', unit: 'mm', def: 50, min: 1, max: 10000 },
  ];
  static description = 'Copper busbar with 2 to 24 tap points (choose the number of taps). Pick a standard bar size (width × thickness) or type your own cross-section area: each section between taps has R = ρ·pitch/A (a few µΩ), so the bar distributes current with negligible drop. Readings show the largest section current against the rating; a bar run above its rating turns red.';
  constructor(x, y) { super(x, y); this.postCurrents = new Array(this.n()).fill(0); }
  n() { return Math.max(2, Math.min(24, Math.round(+this.p.taps) || 6)); }
  localPosts() { const n = this.n(); return Array.from({ length: n }, (_, k) => [(2 * k - (n - 1)) * G, 0]); }
  localBox() { const h = this.n() - 1 + 0.4; return [-h * G, -0.5 * G, h * G, 0.5 * G]; }
  leads() { return []; }
  connectivity() { return null; }
  onParamChange() { if (this.postCurrents.length !== this.n()) this.postCurrents = new Array(this.n()).fill(0); }
  rseg() { return Math.max(1e-7, (0.017241 * (this.p.pmm / 1000)) / this.p.w); }
  stamp(s) { for (let k = 0; k < this.n() - 1; k++) s.addG(this.nodes[k], this.nodes[k + 1], 1 / this.rseg()); }
  stampAC(ac) { for (let k = 0; k < this.n() - 1; k++) ac.addY(this.nodes[k], this.nodes[k + 1], 1 / this.rseg()); }
  reset() { this.imax = 0; this.postCurrents = new Array(this.n()).fill(0); }
  accept(s) {
    const g = 1 / this.rseg(), n = this.n(), seg = [];
    for (let k = 0; k < n - 1; k++) seg.push((s.v(this.nodes[k]) - s.v(this.nodes[k + 1])) * g);
    const pc = new Array(n);
    pc[0] = seg[0];
    for (let k = 1; k < n - 1; k++) pc[k] = seg[k] - seg[k - 1];
    pc[n - 1] = -seg[n - 2];
    this.postCurrents = pc;
    this.imax = Math.max(...seg.map(Math.abs)); this.i = this.imax;
  }
  valueLabel() { const b = BARS[this.p.model]; return `${b && b[0] === this.p.w ? this.p.model : fmtShort(this.p.w, 'mm²')} ${fmtShort(this.p.rating, 'A')}`; }
  readings() { return [['Highest section current', this.imax || 0, 'A'], ['Rating', this.p.rating, 'A'], ['Cross-section', this.p.w, 'mm²'], ['Taps', this.n(), ''], ['Section resistance', this.rseg(), 'Ω']]; }
  draw(g) {
    const hot = g.running && (this.imax || 0) > this.p.rating, h = this.n() - 1 + 0.2;
    const t = Math.max(0.12, Math.min(0.32, 0.12 + Math.log10(Math.max(10, this.p.w)) * 0.06)); // a bigger bar looks thicker
    g.box(-h * G, -t * G, h * G, t * G, { stroke: g.body, width: g.lw * 0.6, fill: hot ? '#ef4444' : '#d08a4a', r: 2 });
    for (const [x] of this.localPosts()) g.circle(x, 0, 2.2, { fill: '#7c4a1e' });
  }
}
register(Busbar);

export class JunctionBox extends Element {
  static type = 'jbox'; static title = 'Junction Box'; static category = 'Power Systems';
  static prefix = 'JB'; static keywords = 'junction box connector block terminal box splice joint wiring';
  static props = [];
  static description = 'Junction box: four cable entries joined by a connector (≈1 mΩ each) — a tidy way to branch a circuit.';
  constructor(x, y) { super(x, y); this.postCurrents = [0, 0, 0, 0]; }
  localPosts() { return [[0, -2 * G], [2 * G, 0], [0, 2 * G], [-2 * G, 0]]; }
  localBox() { return [-2 * G, -2 * G, 2 * G, 2 * G]; }
  leads() { return [[0, 0, -2 * G, 0, -0.7 * G], [1, 2 * G, 0, 0.7 * G, 0], [2, 0, 2 * G, 0, 0.7 * G], [3, -2 * G, 0, -0.7 * G, 0]]; }
  connectivity() { return null; }
  internalNodeCount() { return 1; }
  stamp(s) { for (let k = 0; k < 4; k++) s.addG(this.nodes[k], this.inodes[0], 1000); }
  stampAC(ac) { for (let k = 0; k < 4; k++) ac.addY(this.nodes[k], this.inodes[0], 1000); }
  accept(s) { this.postCurrents = this.nodes.map((n) => (s.v(n) - s.v(this.inodes[0])) * 1000); this.i = this.postCurrents[0]; }
  valueLabel() { return ''; }
  draw(g) {
    g.box(-0.7 * G, -0.7 * G, 0.7 * G, 0.7 * G, { stroke: g.body, width: g.lw * 0.9, fill: g.fill, r: 3 });
    g.circle(0, 0, 0.3 * G, { fill: g.muted });
  }
}
register(JunctionBox);

export class NetLabel extends Element {
  static type = 'netlabel'; static title = 'Net Label'; static category = 'Sources';
  static prefix = 'NL'; static keywords = 'net label name node tag connect by name wire label bus';
  static props = [{ key: 'name', label: 'Net name', type: 'text', def: 'NET1' }];
  static description = 'Connects every point carrying the same net name, as if a wire joined them — keeps large drawings tidy (e.g. label a 5 V rail “VCC” in several places). Names are case-sensitive.';
  static noName = true;
  constructor(x, y) { super(x, y); this.postCurrents = [0]; }
  localPosts() { return [[-G, 0]]; }
  localBox() { const w = Math.max(1.6 * G, String(this.p.name).length * 6 + 0.9 * G); return [-G, -0.5 * G, -G + w, 0.5 * G]; }
  leads() { return []; }
  netName() { return String(this.p.name || '').trim(); }
  valueLabel() { return ''; }
  draw(g) {
    const [, , x2] = this.localBox(), h = 0.42 * G;
    g.poly([[-G, 0], [-G + 0.4 * G, -h], [x2, -h], [x2, h], [-G + 0.4 * G, h]], { stroke: g.accent, width: g.lw * 0.8, fill: g.fill, close: true });
    g.upright(() => g.text(this.netName(), 0, 0, { size: 8, color: g.accent, bold: true }), (-G + 0.4 * G + x2) / 2, 0);
  }
}
register(NetLabel);

// ================================================================ lighting
export class HalogenLamp extends Bulb {
  static type = 'halogen'; static title = 'Halogen Lamp'; static category = 'Electrical';
  static keywords = 'halogen lamp tungsten halogen mr16 12v 50w floodlight quartz';
  static props = [
    { key: 'v', label: 'Rated voltage', unit: 'V', def: 12, min: 1, max: 1000, log: true },
    { key: 'w', label: 'Rated power', unit: 'W', def: 50, min: 0.1, max: 5000, log: true, knob: true },
    { key: 'tau', label: 'Filament time constant', unit: 's', def: 0.05, min: 1e-3, max: 5, log: true },
  ];
  static description = 'Tungsten-halogen lamp (e.g. 12 V 50 W MR16): a hotter filament than an ordinary bulb (≈18 lm/W, whiter light) in a quartz envelope; like any filament it draws ≈10–15× inrush current when cold.';
  readings(s) { const r = super.readings(s); if (r.length > 5) r[5] = ['Light output', 18 * this.p.w * this.bright(), 'lm']; return r; }
}
register(HalogenLamp);

/** constant-power load for electronic ballasts/drivers: i = P/v above vmin */
class CPLoad extends TwoTerm {
  nonlinear = true;
  constructor() { super(0, 0); this.pw = 10; this.vmin = 50; }
  iv(v) { if (v <= this.vmin) { const g = this.pw / (this.vmin * this.vmin); return { i: g * v, g }; } return { i: this.pw / v, g: -this.pw / (v * v) }; }
  stampNL(s) { const [a, b] = this.nodes, v = s.v(a) - s.v(b), { i, g } = this.iv(v); s.addG(a, b, g); s.addI(a, b, i - g * v); }
  accept(s) { this.setCurrent(this.iv(this.voltageDiff(s)).i); }
  stampAC(ac) { ac.addY(this.nodes[0], this.nodes[1], 1e-9); }
}
export class CFL extends Composite {
  static type = 'cfl'; static title = 'CFL (energy-saving lamp)'; static category = 'Electrical';
  static prefix = 'LP'; static keywords = 'cfl compact fluorescent lamp energy saving bulb electronic ballast power factor harmonics';
  static props = [{ key: 'w', label: 'Rated power', unit: 'W', def: 15, min: 3, max: 100, knob: true }];
  static description = 'Compact fluorescent lamp with an electronic ballast: a bridge rectifier charges a small reservoir capacitor, so mains current flows only in short peaks near the voltage maxima (power factor ≈0.6, rich in harmonics) while the ballast takes constant power. ≈60 lm/W.';
  ownInternal() { return 3; }
  parts() {
    const BR = getType('bridge'), cp = new CPLoad();
    return [[new Resistor(0, 0), [0, 'i0']], [new BR(0, 0), ['i0', 1, 'i1', 'i2']], [new Capacitor(0, 0), ['i1', 'i2']], [cp, ['i1', 'i2']]];
  }
  sync() {
    if (!this.subs) return;
    const [r, , c, cp] = this.subs.map((s) => s.el);
    r.p.r = 20; c.p.c = (this.p.w / 15) * 4.7e-6; cp.pw = this.p.w / 0.9; cp.vmin = 60;
  }
  connectivity() { return null; }
  localPosts() { return [[-2 * G, 0], [2 * G, 0]]; }
  localBox() { return [-2 * G, -1.2 * G, 2 * G, 0.9 * G]; }
  leads() { return [[0, -2 * G, 0, -0.7 * G, 0.3 * G], [1, 2 * G, 0, 0.7 * G, 0.3 * G]]; }
  reset(s) { super.reset(s); this.pin = new Ema(0.05); this.i2 = new Ema(0.05); this.v2 = new Ema(0.05); }
  accept(s) {
    super.accept(s);
    if (s.mode === 'dc') return;
    const v = s.v(this.nodes[0]) - s.v(this.nodes[1]), i = this.postCurrents[0];
    this.pin.push(v * i, s.dt); this.i2.push(i * i, s.dt); this.v2.push(v * v, s.dt);
  }
  pf() { const S = Math.sqrt(this.v2?.v * this.i2?.v || 0); return S > 1e-9 ? (this.pin?.v || 0) / S : 0; }
  valueLabel() { return fmtQty(this.p.w, 'W').replace(' ', ''); }
  readings() { return [['Power (avg)', this.pin?.v || 0, 'W'], ['Power factor', this.pf(), ''], ['Current (RMS)', Math.sqrt(Math.max(0, this.i2?.v || 0)), 'A'], ['Light output', 60 * (this.pin?.v || 0), 'lm']]; }
  draw(g) {
    const b = g.running ? clamp((this.pin?.v || 0) / this.p.w, 0, 1.2) : 0;
    if (b > 0.02) g.glow(0, -0.3 * G, G * 1.5, '235,245,255', Math.min(0.9, b));
    g.box(-0.45 * G, 0.1 * G, 0.45 * G, 0.6 * G, { stroke: g.body, width: g.lw * 0.8, fill: g.fill, r: 2 });
    const ctx = g.ctx; ctx.beginPath();
    for (let k = 0; k < 4; k++) { const y = 0.05 * G - k * 0.25 * G; ctx.moveTo(-0.4 * G, y); ctx.quadraticCurveTo(0, y - 0.18 * G, 0.4 * G, y); }
    ctx.strokeStyle = b > 0.05 ? '#e0f2fe' : g.body; ctx.lineWidth = g.lw * 1.4; ctx.stroke();
    g.line(-0.7 * G, 0.3 * G, -0.45 * G, 0.3 * G, g.vc(g.pv(0)), g.lw); g.line(0.45 * G, 0.3 * G, 0.7 * G, 0.3 * G, g.vc(g.pv(1)), g.lw);
  }
}
register(CFL);

const STRIP = { 'White 12 V (3 LEDs + 150 Ω)': { leds: 3, rs: 150, is: 1e-20, nn: 2.6 }, 'Red 12 V (3 LEDs + 270 Ω)': { leds: 3, rs: 270, is: 1e-19, nn: 1.8 }, 'White 24 V (6 LEDs + 330 Ω)': { leds: 6, rs: 330, is: 1e-20, nn: 2.6 } };
export class LEDStrip extends TwoTerm {
  static type = 'ledstrip'; static title = 'LED Strip'; static category = 'Electrical';
  static prefix = 'LS'; static keywords = 'led strip tape light 12v 24v smd 2835 5050 cove lighting';
  static props = [
    { key: 'len', label: 'Length', unit: 'm', def: 1, min: 0.05, max: 50, knob: true },
    { key: 'type', label: 'Strip', type: 'select', def: 'White 12 V (3 LEDs + 150 Ω)', options: Object.keys(STRIP).map((k) => [k, k]).concat([['custom', 'Custom']]), preset: STRIP },
    { key: 'perm', label: 'LEDs per metre', unit: '', def: 60, min: 3, max: 240 },
    { key: 'leds', label: 'LEDs per segment', unit: '', def: 3, min: 1, max: 12 },
    { key: 'rs', label: 'Resistor per segment', unit: 'Ω', def: 150, min: 1, max: 1e4, log: true },
    { key: 'is', label: 'LED Is', unit: 'A', def: 1e-20, min: 1e-30, max: 1e-6, log: true, hidden: true },
    { key: 'nn', label: 'LED n', unit: '', def: 2.6, min: 1, max: 5, hidden: true },
  ];
  static description = 'LED tape: cut-able segments of a few LEDs in series with a current-setting resistor, all segments in parallel along the strip. Current (and brightness) collapse quickly below the rated voltage, and long strips need power fed at both ends because of the copper-track voltage drop.';
  nonlinear = true;
  segs() { return Math.max(1, Math.floor((this.p.len * this.p.perm) / Math.max(1, Math.round(this.p.leds)))); }
  iv(v) { const n = this.segs(), r = stringIV(Math.abs(v), Math.round(this.p.leds), this.p.is, this.p.nn, this.p.rs); return { i: Math.sign(v) * n * r.i * (v >= 0 ? 1 : 1e-6), g: n * r.g * (v >= 0 ? 1 : 1e-6) + 1e-12 }; }
  reset() { this.vd = 0; this.setCurrent(0); }
  stampNL(s) {
    const [a, b] = this.nodes;
    let v = s.v(a) - s.v(b);
    if (Math.abs(v - this.vd) > 1) { v = this.vd + Math.sign(v - this.vd); s.limited = true; }
    this.vd = v;
    const { i, g } = this.iv(v); s.addG(a, b, g); s.addI(a, b, i - g * v);
  }
  accept(s) { const v = this.voltageDiff(s); this.vd = v; this.setCurrent(this.iv(v).i); }
  stampAC(ac) { ac.addY(this.nodes[0], this.nodes[1], 1e-9); }
  segI() { return Math.max(0, this.i || 0) / this.segs(); }
  valueLabel() { return fmtQty(this.p.len, 'm'); }
  readings(s) { const v = this.voltageDiff(s); return [['Current', this.i, 'A'], ['Power', v * this.i, 'W'], ['Current per segment', this.segI(), 'A'], ['Segments', this.segs(), ''], ['Light output (≈100 lm/W)', 100 * Math.max(0, v * this.i), 'lm']]; }
  leads() { return [[0, -2 * G, 0, -1.6 * G, 0], [1, 2 * G, 0, 1.6 * G, 0]]; }
  localBox() { return [-2 * G, -0.6 * G, 2 * G, 0.6 * G]; }
  draw(g) {
    g.box(-1.6 * G, -0.35 * G, 1.6 * G, 0.35 * G, { stroke: g.body, width: g.lw * 0.6, fill: g.fill, r: 2 });
    const b = g.running ? clamp(this.segI() / 0.02, 0, 1.2) : 0;
    for (let k = 0; k < 6; k++) {
      const x = -1.35 * G + k * 0.54 * G;
      if (b > 0.03) g.glow(x, 0, 0.45 * G, '255,248,220', Math.min(0.8, b));
      g.box(x - 0.12 * G, -0.15 * G, x + 0.12 * G, 0.15 * G, { fill: b > 0.03 ? `rgba(255,250,230,${0.3 + 0.7 * Math.min(1, b)})` : g.muted, r: 1 });
    }
  }
}
register(LEDStrip);

/** mains-powered with emulated-resistor (PFC) input: i_in = (P/η)/Vrms² · v */
class MainsPowered extends withChip(Element) {
  static category = 'Electrical';
  static prefix = 'U';
  constructor(x, y) { super(x, y); this.postCurrents = new Array(this.localPosts().length).fill(0); }
  resetMains(vinit = 230) { this.v2 = new Ema(0.02); this.v2.v = vinit * vinit; this.gin = 0; }
  vrms() { return Math.sqrt(Math.max(0, this.v2?.v || 0)); }
  mainsIn(s) { s.addI(this.nodes[0], this.nodes[1], this.gin * this.vprev); }
  trackMains(s, pin) {
    const v = s.v(this.nodes[0]) - s.v(this.nodes[1]);
    this.vprev = v;
    if (s.mode !== 'dc') this.v2.push(v * v, s.dt);
    const vr = this.vrms();
    this.gin = vr > 20 ? pin / (vr * vr) : 0;
    return v;
  }
}

export class LEDDriver extends MainsPowered {
  static type = 'leddriver'; static title = 'LED Driver (CC / CV)';
  static keywords = 'led driver constant current constant voltage power supply 350ma 700ma 12v 24v pfc';
  static props = [
    { key: 'mode', label: 'Type', type: 'select', def: 'cc', options: [['cc', 'Constant current (for LED modules / COB)'], ['cv', 'Constant voltage (for LED strips)']] },
    { key: 'iset', label: 'Output current (CC)', unit: 'A', def: 0.7, min: 0.001, max: 50, log: true, knob: true },
    { key: 'vmax', label: 'Maximum output voltage (CC)', unit: 'V', def: 42, min: 1, max: 500 },
    { key: 'vset', label: 'Output voltage (CV)', unit: 'V', def: 12, min: 1, max: 500 },
    { key: 'imax', label: 'Current limit (CV)', unit: 'A', def: 5, min: 0.01, max: 100, log: true },
    { key: 'eff', label: 'Efficiency', unit: '', def: 0.88, min: 0.3, max: 1 },
  ];
  static pins = [['L', 'L'], ['N', 'L'], ['+', 'R'], ['−', 'R']];
  static description = 'Mains LED driver with active power-factor correction (it draws a sinusoidal current, PF ≈ 1). Constant-current type: regulates the LED current whatever the forward voltage (up to Vmax) — for COB modules and high-power LEDs. Constant-voltage type: a regulated voltage with a current limit — for LED strips. Isolated output; switches off below ≈85 V input.';
  nonlinear = true;
  connectivity() { return [[0, 1], [2, 3]]; }
  reset() { this.resetMains(); this.vprev = 0; this.pout = new Ema(0.02); this.on = true; this.io = 0; this.vl = null; this.postCurrents.fill(0); }
  curve(v) {
    if (!this.on) return { i: 0, g: 0 };
    const sm = (a, b, w) => { const d = a - b, r = Math.sqrt(d * d + w * w); return { y: (a + b - r) / 2, da: (1 - d / r) / 2, db: (1 + d / r) / 2 }; };
    if (this.p.mode === 'cc') { const w = 0.01 * this.p.iset, a = sm(this.p.iset, (this.p.vmax - v) / 0.5, w), b = sm(-a.y, 0, w); return { i: -b.y, g: -(b.da * a.db / 0.5) }; }
    const r = 0.02, w = 0.01 * this.p.imax, a = sm((this.p.vset - v) / r, this.p.imax, w), b = sm(-a.y, 0, w);
    return { i: -b.y, g: -(b.da * a.da / r) };
  }
  stamp(s) { s.addG(this.nodes[0], this.nodes[1], 1e-7); s.addG(this.nodes[2], this.nodes[3], 1e-6); }
  stampNL(s) {
    const [, , p, m] = this.nodes;
    let v = s.v(p) - s.v(m);
    const lim = Math.max(0.5, 0.05 * (this.p.mode === 'cc' ? this.p.vmax : this.p.vset));
    if (this.vl != null && Math.abs(v - this.vl) > lim) { v = this.vl + Math.sign(v - this.vl) * lim; s.limited = true; }
    this.vl = v;
    const c = this.curve(v);
    s.addNLCurrent(m, p, c.i, [[p, m, c.g, v]]);
  }
  stampStep(s) { this.mainsIn(s); }
  stampAC(ac) { ac.addY(this.nodes[0], this.nodes[1], 1e-7); ac.addY(this.nodes[2], this.nodes[3], 1e-6); }
  accept(s) {
    const [, , p, m] = this.nodes, vo = s.v(p) - s.v(m), io = this.curve(vo).i;
    this.io = io; this.vl = vo;
    if (s.mode !== 'dc') this.pout.push(vo * io, s.dt);
    const vin = this.trackMains(s, Math.max(0, this.pout.v) / this.p.eff);
    const iin = this.gin * vin + vin * 1e-7, iop = io + vo * 1e-6;
    this.postCurrents = [iin, -iin, -iop, iop]; this.i = iin;
    if (s.mode === 'dc') return;
    const on = this.on ? this.vrms() > 75 : this.vrms() > 85;
    if (on !== this.on) { this.on = on; s.event = true; }
  }
  valueLabel() { return this.p.mode === 'cc' ? fmtShort(this.p.iset, 'A') : fmtShort(this.p.vset, 'V'); }
  readings(s) {
    return [['Output', this.on ? 'ON' : 'off (input too low)', ''], ['Output voltage', s.v(this.nodes[2]) - s.v(this.nodes[3]), 'V'], ['Output current', this.io || 0, 'A'],
      ['Output power', this.pout?.v || 0, 'W'], ['Input voltage (RMS)', this.vrms(), 'V'], ['Input power', (this.pout?.v || 0) / this.p.eff, 'W']];
  }
  draw(g) { this.drawChip(g, this.p.mode === 'cc' ? 'LED CC' : 'LED CV'); }
}
register(LEDDriver);

/** L / N / LOAD wall switch with a relay contact from L to LOAD and a small self-consumption */
class AutoSwitch extends Element {
  static category = 'Electrical';
  static prefix = 'S';
  constructor(x, y) { super(x, y); this.postCurrents = [0, 0, 0]; }
  localPosts() { return [[-2 * G, -G], [-2 * G, G], [2 * G, -G]]; }
  pinNames() { return ['L', 'N', 'LOAD']; }
  localBox() { return [-2 * G, -1.6 * G, 2 * G, 1.6 * G]; }
  leads() { return [[0, -2 * G, -G, -1.1 * G, -G], [1, -2 * G, G, -1.1 * G, G], [2, 2 * G, -G, 1.1 * G, -G]]; }
  connectivity() { return null; }
  resetSw() { this.on = false; this.v2 = new Ema(0.02); this.v2.v = 230 * 230; }
  gsw() { return this.on ? 100 : 1e-9; }
  stamp(s) { const [l, n, ld] = this.nodes; s.addG(l, n, 1 / 105e3); s.addG(l, ld, this.gsw()); }
  stampAC(ac) { const [l, n, ld] = this.nodes; ac.addY(l, n, 1 / 105e3); ac.addY(l, ld, this.gsw()); }
  powered() { return Math.sqrt(this.v2.v) > 100; }
  setOn(s, on) { if (on !== this.on) { this.on = on; s.markEvent(); } }
  acceptSw(s) {
    const [l, n, ld] = this.nodes, v = s.v(l) - s.v(n), isw = (s.v(l) - s.v(ld)) * this.gsw(), iq = v / 105e3;
    this.postCurrents = [isw + iq, -iq, -isw]; this.i = isw;
    if (s.mode !== 'dc') this.v2.push(v * v, s.dt);
  }
  drawBase(g, tag) {
    g.box(-1.1 * G, -1.4 * G, 1.1 * G, 1.4 * G, { stroke: g.body, width: g.lw * 0.9, fill: g.fill, r: 5 });
    g.text(tag, 0, 0.75 * G, { size: 7, color: g.accent, bold: true, maxW: 2 * G });
    g.circle(0.65 * G, -1.0 * G, 2.6, { fill: this.on && g.running ? '#22c55e' : g.lo });
    ['L', 'N'].forEach((t, k) => g.text(t, -0.85 * G, (k ? 1 : -1) * G, { size: 6, color: g.muted, align: 'left' }));
    g.text('LD', 0.85 * G, -G + 0.35 * G, { size: 6, color: g.muted, align: 'right' });
  }
}

export class PhotocellSwitch extends AutoSwitch {
  static type = 'photocell'; static title = 'Photocell Switch (dusk-to-dawn)';
  static keywords = 'photocell photo control dusk to dawn street light switch ldr day night automatic light';
  static props = [
    { key: 'lux', label: 'Ambient light', unit: 'lx', def: 300, min: 0, max: 1e5, log: true, knob: true },
    { key: 'lon', label: 'Switch on below', unit: 'lx', def: 10, min: 0.1, max: 1000, log: true },
    { key: 'loff', label: 'Switch off above', unit: 'lx', def: 30, min: 0.1, max: 2000, log: true },
    { key: 'delay', label: 'Delay', unit: 's', def: 0.5, min: 0, max: 60 },
  ];
  static description = 'Dusk-to-dawn photo control for street and garden lights: an LDR-driven relay closes L → LOAD when the ambient light falls below the switch-on level and opens again above the (higher) switch-off level, after a delay that ignores car headlights and lightning. Needs mains (L–N) to work.';
  reset() { this.resetSw(); this.t = 0; }
  accept(s) {
    this.acceptSw(s);
    if (s.mode === 'dc') return;
    const want = this.powered() && (this.on ? this.p.lux < this.p.loff : this.p.lux < this.p.lon);
    this.t = want !== this.on ? this.t + s.dt : 0;
    if (this.t >= this.p.delay || (!this.powered() && this.on)) { this.setOn(s, want); this.t = 0; }
  }
  valueLabel() { return fmtQty(this.p.lux, 'lx'); }
  readings() { return [['Ambient light', this.p.lux, 'lx'], ['Lamp output', this.on ? 'ON (dark)' : 'off (daylight)', ''], ['Load current', this.i, 'A']]; }
  draw(g) {
    this.drawBase(g, 'PHOTO');
    const k = clamp(Math.log10(Math.max(1, this.p.lux)) / 4, 0, 1);
    g.circle(-0.1 * G, -0.25 * G, 0.42 * G, { stroke: g.body, width: g.lw * 0.6, fill: `rgba(255,${180 + 60 * k},90,${0.25 + 0.6 * k})` });
  }
}
register(PhotocellSwitch);

export class PIRSwitch extends AutoSwitch {
  static type = 'pirsw'; static title = 'PIR Light Switch (motion)';
  static keywords = 'pir motion sensor light switch occupancy sensor corridor staircase automatic light timer';
  static props = [
    { key: 'motion', label: 'Motion detected', type: 'bool', def: false },
    { key: 'lux', label: 'Ambient light', unit: 'lx', def: 5, min: 0, max: 1e5, log: true, knob: true },
    { key: 'luxth', label: 'Works only below', unit: 'lx', def: 50, min: 0.1, max: 1e5, log: true },
    { key: 'hold', label: 'Hold time after last motion', unit: 's', def: 2, min: 0.05, max: 600 },
  ];
  static description = 'Passive-infrared occupancy switch for corridors and stairs: when it sees motion in the dark (ambient light below the threshold) it closes L → LOAD and keeps the light on for the hold time after the last movement (re-triggerable). Tap it to simulate someone walking past.';
  interactive = true;
  reset() { this.resetSw(); this.tLast = -1e9; }
  onTap() { this.p.motion = !this.p.motion; return true; }
  accept(s) {
    this.acceptSw(s);
    if (s.mode === 'dc') return;
    if (this.p.motion && (this.on || this.p.lux < this.p.luxth)) this.tLast = s.t;
    this.setOn(s, this.powered() && s.t - this.tLast < this.p.hold);
  }
  valueLabel() { return this.p.motion ? 'MOTION' : ''; }
  readings(s) { return [['Motion', this.p.motion ? 'yes' : 'no', ''], ['Light', this.on ? 'ON' : 'off', ''], ['Time left', this.on ? Math.max(0, this.p.hold - (s.t - this.tLast)) : 0, 's']]; }
  draw(g) {
    this.drawBase(g, 'PIR');
    g.circle(-0.1 * G, -0.25 * G, 0.42 * G, { stroke: g.body, width: g.lw * 0.6, fill: this.p.motion ? 'rgba(239,68,68,0.6)' : 'rgba(255,255,255,0.15)' });
  }
}
register(PIRSwitch);

export class EmergencyLight extends MainsPowered {
  static type = 'emerg'; static title = 'Emergency Light (battery backup)';
  static keywords = 'emergency light battery backup exit sign power failure rechargeable lamp maintained non maintained';
  static props = [
    { key: 'lamp', label: 'Lamp power', unit: 'W', def: 3, min: 0.1, max: 100, knob: true },
    { key: 'ah', label: 'Battery capacity (3.6 V NiCd)', unit: 'Ah', def: 1.6, min: 0.01, max: 100, log: true },
    { key: 'soc', label: 'Initial battery charge', unit: '%', def: 100, min: 0, max: 100 },
    { key: 'maint', label: 'Maintained (lamp also on with mains)', type: 'bool', def: false },
  ];
  static pins = [['L', 'L'], ['N', 'L']];
  static description = 'Self-contained emergency luminaire: while the mains is present it trickle-charges its 3.6 V NiCd pack (≈2 W) and the lamp stays off (non-maintained) or on (maintained); when the mains fails the LED lamp lights from the battery until it is flat (autonomy = capacity × 3.6 V ÷ lamp power, typically 1–3 h).';
  connectivity() { return [[0, 1]]; }
  reset() { this.resetMains(); this.vprev = 0; this.q = this.p.soc / 100; this.lit = this.p.maint; this.tFail = 0; this.postCurrents.fill(0); }
  mains() { return this.vrms() > 150; }
  stamp(s) { s.addG(this.nodes[0], this.nodes[1], 1e-7); }
  stampStep(s) { this.mainsIn(s); }
  stampAC(ac) { ac.addY(this.nodes[0], this.nodes[1], 1e-7); }
  accept(s) {
    const mains = this.mains(), pin = mains ? (this.q < 1 ? 2 : 0.5) + (this.p.maint ? this.p.lamp / 0.85 : 0) : 0;
    const v = this.trackMains(s, pin), iin = this.gin * v + v * 1e-7;
    this.postCurrents = [iin, -iin]; this.i = iin;
    if (s.mode === 'dc') return;
    const cap = this.p.ah * 3600;
    if (mains) { this.q = Math.min(1, this.q + (0.1 * this.p.ah * s.dt) / cap); this.tFail = 0; }
    else { this.tFail += s.dt; if (this.tFail > 0.05 && this.q > 0) this.q = Math.max(0, this.q - (this.p.lamp / 3.6 / 0.9) * s.dt / cap); }
    const lit = (mains && this.p.maint) || (!mains && this.tFail > 0.05 && this.q > 0.02);
    if (lit !== this.lit) this.lit = lit;
  }
  valueLabel() { return this.lit ? 'LIT' : ''; }
  readings() {
    const autonomy = (this.q * this.p.ah * 3.6 * 0.9) / this.p.lamp * 60;
    return [['Mains', this.mains() ? 'present (charging)' : 'FAILED', ''], ['Lamp', this.lit ? 'ON' : 'off', ''], ['Battery', this.q * 100, '%'], ['Remaining autonomy', autonomy, 'min']];
  }
  draw(g) {
    this.drawChip(g, 'EMERG');
    const on = this.lit && g.running;
    if (on) g.glow(0, 0.2 * G, 1.4 * G, '235,245,255', 0.6);
    g.box(-0.6 * G, 0.05 * G, 0.6 * G, 0.4 * G, { fill: on ? '#f8fafc' : g.muted, r: 2 });
  }
}
register(EmergencyLight);

// ================================================================ displays
// 14-segment font: a b c d e f (outer), g/G (middle left/right), h i j (upper
// diagonal / vertical / diagonal), k l m (lower diagonal / vertical / diagonal)
const F14 = {
  '0': 'abcdefjk', '1': 'bcj', '2': 'abgGed', '3': 'abcdG', '4': 'fgGbc', '5': 'afgGcd', '6': 'afedcgG', '7': 'abc', '8': 'abcdefgG', '9': 'abcdfgG',
  A: 'abcefgG', B: 'abcdilG', C: 'adef', D: 'abcdil', E: 'adefg', F: 'aefg', G: 'acdefG', H: 'bcefgG', I: 'adil', J: 'bcde', K: 'efgjm', L: 'def', M: 'bcefhj',
  N: 'bcefhm', O: 'abcdef', P: 'abefgG', Q: 'abcdefm', R: 'abefgGm', S: 'afgGcd', T: 'ail', U: 'bcdef', V: 'efkj', W: 'bcefkm', X: 'hjkm', Y: 'hjl', Z: 'adjk',
  ' ': '', '-': 'gG', '+': 'gGil', '*': 'gGhijklm', '/': 'jk', '\\': 'hm', '=': 'dgG', '_': 'd', '(': 'jm', ')': 'hk', '<': 'jm', '>': 'hk', '?': 'abGl',
  '!': 'il', '"': 'fi', "'": 'i', '#': 'bcdgGil', '$': 'acdfgGil', '%': 'cfjkgG', '&': 'adeghjm', '@': 'abdefGi', '[': 'adef', ']': 'abcd', '^': 'km', ',': 'k', '.': '', ':': 'il', ';': 'ik', '|': 'il', '`': 'h',
};
const SEG14 = {
  a: [[-1, -2], [1, -2]], b: [[1, -2], [1, 0]], c: [[1, 0], [1, 2]], d: [[-1, 2], [1, 2]], e: [[-1, 0], [-1, 2]], f: [[-1, -2], [-1, 0]],
  g: [[-1, 0], [0, 0]], G: [[0, 0], [1, 0]], h: [[-1, -2], [0, 0]], i: [[0, -2], [0, 0]], j: [[1, -2], [0, 0]], k: [[0, 0], [-1, 2]], l: [[0, 0], [0, 2]], m: [[0, 0], [1, 2]],
};
export class Seg14Display extends Chip {
  static type = 'seg14'; static title = '14-Segment Display (ASCII)'; static category = 'Output';
  static chip = ''; static keywords = '14 segment display alphanumeric starburst ascii character display text';
  static pins = [P('D0', 'L', 'i'), P('D1', 'L', 'i'), P('D2', 'L', 'i'), P('D3', 'L', 'i'), P('D4', 'L', 'i'), P('D5', 'L', 'i'), P('D6', 'L', 'i')];
  static props = [{ key: 'color', label: 'Colour', type: 'select', def: '#ef4444', options: [['#ef4444', 'Red'], ['#22c55e', 'Green'], ['#3b82f6', 'Blue'], ['#f59e0b', 'Amber']] }, ...DIGI_PROPS];
  static description = 'Alphanumeric 14-segment (starburst) display with a built-in ASCII decoder: the 7-bit code on D0–D6 (e.g. 0x41 = “A”) selects the character — digits, capital letters (lower case shown as capitals) and common symbols.';
  compute() { return []; }
  code() { return val(this.inState || []); }
  ch() { const c = String.fromCharCode(this.code()).toUpperCase(); return F14[c] !== undefined ? c : this.code() >= 32 ? '?' : ' '; }
  shown() { return ''; }
  readings() { const c = this.code(); return [['Code', `0x${c.toString(16).toUpperCase().padStart(2, '0')} (${c})`, ''], ['Character', this.ch(), '']]; }
  draw(g) {
    this.drawChip(g, '');
    const gm = this.geom(), w = Math.min(gm.bw - 6, 0.9 * G), h = Math.min(1.6 * G, (gm.bot - gm.top) / 2 - 8);
    g.box(-w - 4, -h - 6, w + 4, h + 6, { fill: '#111', r: 3 });
    const segs = F14[this.ch()] || '', col = this.p.color;
    for (const [k, [[x1, y1], [x2, y2]]] of Object.entries(SEG14)) {
      const on = g.running && segs.includes(k);
      g.line((x1 * w) * 0.8, (y1 * h) / 2 * 0.95, (x2 * w) * 0.8, (y2 * h) / 2 * 0.95, on ? col : 'rgba(255,255,255,0.08)', g.lw * 1.3);
    }
  }
}
register(Seg14Display);

export class DotMatrix extends withChip(Element) {
  static type = 'dotmatrix'; static title = 'LED Dot Matrix 8×8'; static category = 'Output';
  static prefix = 'U'; static keywords = 'dot matrix 8x8 led matrix display multiplexing scanning row column common anode';
  static props = [{ key: 'color', label: 'Colour', type: 'select', def: '255,60,60', options: [['255,60,60', 'Red'], ['60,230,90', 'Green'], ['80,150,255', 'Blue']] }];
  static pins = [...[1, 2, 3, 4, 5, 6, 7, 8].map((k) => [`R${k}`, 'L']), ...[1, 2, 3, 4, 5, 6, 7, 8].map((k) => [`C${k}`, 'R'])];
  static chipOpts = { dense: true };
  static description = '64 LEDs in an 8×8 grid: LED (r, c) has its anode on row pin Rr and cathode on column pin Cc (≈1.8 V red). Drive a row high and pull columns low through resistors to light dots; scan the rows quickly (multiplexing) and persistence of vision (≈20 ms) shows a steady picture.';
  nonlinear = true;
  constructor(x, y) { super(x, y); this.postCurrents = new Array(16).fill(0); this.J = Array.from({ length: 64 }, () => new Junction(1e-19, 1.8, 5)); }
  connectivity() { return null; }
  reset() { this.br = new Float64Array(64); this.ii = new Float64Array(64); for (const j of this.J) j.vd = 0; this.postCurrents.fill(0); }
  stamp(s) { for (let k = 0; k < 16; k++) s.addG(this.nodes[k], 0, 1e-12); }
  stampNL(s) {
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const a = this.nodes[r], k = this.nodes[8 + c], j = this.J[r * 8 + c];
      const v = j.limit(s, s.v(a) - s.v(k)), d = diodeIV(v, 1e-19, 1.8, 5);
      s.addG(a, k, d.g); s.addI(a, k, d.i - d.g * v);
    }
  }
  stampAC(ac) { for (let k = 0; k < 16; k++) ac.addY(this.nodes[k], 0, 1e-12); }
  accept(s) {
    this.postCurrents.fill(0);
    const a = Math.min(1, (s.dt || 1) / 0.02);
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const v = s.v(this.nodes[r]) - s.v(this.nodes[8 + c]), i = diodeIV(v, 1e-19, 1.8, 5).i, n = r * 8 + c;
      this.J[n].vd = v; this.ii[n] = i;
      this.postCurrents[r] += i; this.postCurrents[8 + c] -= i;
      this.br[n] = s.mode === 'dc' ? Math.max(0, i) : this.br[n] + (Math.max(0, i) - this.br[n]) * a;
    }
    this.i = this.postCurrents[0];
  }
  valueLabel() { return ''; }
  readings() { const lit = this.br ? Array.from(this.br).filter((x) => x > 5e-4).length : 0; return [['Dots lit', lit, ''], ['Brightest dot current (avg)', this.br ? Math.max(...this.br) : 0, 'A']]; }
  draw(g) {
    this.drawChip(g, '');
    const gm = this.geom(), half = Math.min(gm.bw - 4, (gm.bot - gm.top) / 2 - 6), step = (2 * half) / 8;
    g.box(-half, -half, half, half, { fill: '#111', r: 3 });
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const b = g.running && this.br ? clamp(this.br[r * 8 + c] / 0.01, 0, 1) : 0, x = -half + (c + 0.5) * step, y = -half + (r + 0.5) * step;
      g.circle(x, y, step * 0.36, { fill: b > 0.03 ? `rgba(${this.p.color},${0.25 + 0.75 * b})` : 'rgba(255,255,255,0.08)' });
    }
  }
}
register(DotMatrix);

const PM_RANGE = { 0.2: '200 mV', 2: '2 V', 20: '20 V', 200: '200 V' };
export class PanelMeter extends Element {
  static type = 'panelmeter'; static title = 'Digital Panel Meter (3½ digit)'; static category = 'Meters';
  static prefix = 'PM'; static keywords = 'panel meter digital voltmeter lcd 3 1/2 digit dpm icl7107 voltmeter display';
  static props = [
    { key: 'range', label: 'Range', type: 'select', def: '20', options: Object.entries(PM_RANGE) },
    { key: 'mode', label: 'Measure', type: 'select', def: 'dc', options: [['dc', 'DC voltage'], ['ac', 'AC voltage (true RMS)']] },
  ];
  static description = '3½-digit LCD panel voltmeter (ICL7107 class): ±1999 counts on the selected range, about three readings per second, 10 MΩ input. Above full scale it shows a lone “1” (over-range), exactly like the real thing.';
  constructor(x, y) { super(x, y); this.postCurrents = [0, 0]; }
  localPosts() { return [[-2 * G, -G], [-2 * G, G]]; }
  pinNames() { return ['+', '−']; }
  localBox() { return [-2 * G, -1.5 * G, 2.6 * G, 1.5 * G]; }
  leads() { return [[0, -2 * G, -G, -1.4 * G, -G], [1, -2 * G, G, -1.4 * G, G]]; }
  reset() { this.acc = 0; this.n = 0; this.tLast = 0; this.disp = null; this.postCurrents = [0, 0]; }
  stamp(s) { s.addG(this.nodes[0], this.nodes[1], 1e-7); }
  stampAC(ac) { ac.addY(this.nodes[0], this.nodes[1], 1e-7); }
  fsr() { return parseFloat(this.p.range) || 20; }
  /** 3½-digit text: ±1999 counts, decimal point set by the range, lone "1" when over range */
  text(v) {
    const fs = this.fsr(), counts = Math.round((v / fs) * 2000);
    if (Math.abs(counts) > 1999) return v < 0 ? '-1   ' : ' 1   ';
    const dec = { 0.2: 1, 2: 3, 20: 2, 200: 1 }[fs] ?? 2, c = String(Math.abs(counts)).padStart(dec + 1, '0');
    return (counts < 0 ? '-' : ' ') + c.slice(0, c.length - dec) + '.' + c.slice(c.length - dec);
  }
  accept(s) {
    const v = s.v(this.nodes[0]) - s.v(this.nodes[1]), i = v * 1e-7;
    this.postCurrents = [i, -i]; this.i = i;
    if (s.mode === 'dc') { this.disp = this.text(v); return; }
    this.acc += this.p.mode === 'ac' ? v * v * s.dt : v * s.dt; this.n += s.dt;
    if (s.t - this.tLast >= 0.33 || this.disp == null) {
      const m = this.n > 0 ? this.acc / this.n : v, vv = this.p.mode === 'ac' ? Math.sqrt(Math.max(0, m)) : m;
      this.disp = this.text(vv); this.acc = 0; this.n = 0; this.tLast = s.t;
    }
  }
  valueLabel() { return PM_RANGE[this.p.range] || ''; }
  readings() { return [['Display', (this.disp ?? '').trim() || '—', ''], ['Range', PM_RANGE[this.p.range], ''], ['Mode', this.p.mode === 'ac' ? 'AC RMS' : 'DC', '']]; }
  draw(g) {
    g.box(-1.4 * G, -1.3 * G, 2.4 * G, 1.3 * G, { stroke: g.body, width: g.lw * 0.9, fill: g.fill, r: 4 });
    g.box(-1.15 * G, -0.75 * G, 2.15 * G, 0.75 * G, { fill: '#b7c4a0', r: 2 });
    g.upright(() => g.text(g.running && this.disp ? this.disp : ' -.--', 0, 0, { size: 13, color: '#1f2a12', bold: true, mono: true, maxW: 3.1 * G }), 0.5 * G, 0);
    g.text(this.p.mode === 'ac' ? 'V~' : 'V⎓', 1.9 * G, -1.0 * G, { size: 6, color: g.muted });
  }
}
register(PanelMeter);

// ================================================================== audio
export class Headphone extends TwoTerm {
  static type = 'headphone'; static title = 'Headphone (32 Ω)'; static category = 'Output';
  static prefix = 'HP'; static keywords = 'headphone earphone earbud 32 ohm audio sensitivity spl hearing';
  static props = [
    { key: 'r', label: 'Impedance', unit: 'Ω', def: 32, min: 4, max: 600, log: true, knob: true },
    { key: 'sens', label: 'Sensitivity', unit: 'dB SPL/mW', def: 100, min: 80, max: 125 },
  ];
  static description = 'Dynamic headphone driver: a 32 Ω (typ.) load; the sound level is sensitivity + 10·log10(P / 1 mW). Above ≈85 dB SPL long listening damages hearing; 1 mW already gives 100 dB on sensitive earbuds.';
  reset() { this.p2 = new Ema(0.05); this.setCurrent(0); }
  stamp(s) { s.addG(this.nodes[0], this.nodes[1], 1 / this.p.r); }
  stampAC(ac) { ac.addY(this.nodes[0], this.nodes[1], 1 / this.p.r); }
  accept(s) { const v = this.voltageDiff(s); this.setCurrent(v / this.p.r); if (s.mode !== 'dc') this.p2.push((v * v) / this.p.r, s.dt); }
  spl() { const P = this.p2?.v || 0; return P > 1e-15 ? this.p.sens + 10 * Math.log10(P / 1e-3) : 0; }
  valueLabel() { return fmtQty(this.p.r, 'Ω'); }
  readings() { const L = this.spl(); return [['Power (avg)', this.p2?.v || 0, 'W'], ['Sound level', L, 'dB SPL'], ['Hearing', L > 100 ? 'DANGEROUS' : L > 85 ? 'loud — limit listening time' : 'safe', '']]; }
  leads() { return [[0, -2 * G, 0, -0.9 * G, 0.3 * G], [1, 2 * G, 0, 0.9 * G, 0.3 * G]]; }
  localBox() { return [-2 * G, -1.2 * G, 2 * G, 0.8 * G]; }
  draw(g) {
    const ctx = g.ctx; ctx.beginPath(); ctx.arc(0, 0.1 * G, 0.85 * G, Math.PI, 0); ctx.strokeStyle = g.body; ctx.lineWidth = g.lw * 0.9; ctx.stroke();
    const on = g.running && this.spl() > 40;
    for (const x of [-0.85, 0.85]) g.box(x * G - 0.22 * G, -0.1 * G, x * G + 0.22 * G, 0.55 * G, { stroke: g.body, width: g.lw * 0.8, fill: on ? g.accent : g.fill, r: 3 });
  }
}
register(Headphone);

// ===================================================================== opto
class GateLink extends Element {
  nonlinear = true;
  constructor() { super(0, 0); this.k = 0.5; this.postCurrents = [0, 0, 0, 0]; }
  localPosts() { return [[0, 0], [0, 0], [0, 0], [0, 0]]; }
  led(v) { return diodeIV(v, 1e-15, 1.5, 0); }
  stampNL(s) {
    const [a, k, from, to] = this.nodes, v = Math.min(s.v(a) - s.v(k), 2), d = this.led(v);
    s.addNLCurrent(from, to, this.k * d.i, [[a, k, this.k * d.g, v]]);
  }
  accept(s) { const [a, k] = this.nodes; this.iph = this.k * this.led(Math.min(s.v(a) - s.v(k), 2)).i; this.postCurrents = [0, 0, this.iph, -this.iph]; }
}
export class OptoSCR extends withChip(Composite) {
  static type = 'optoscr'; static title = 'Opto-SCR (H11C1)'; static category = 'Thyristors & Power';
  static prefix = 'U'; static keywords = 'opto scr photo scr optocoupler h11c1 light activated thyristor isolated trigger';
  static props = [{ key: 'k', label: 'Photo gate current per LED current', unit: '', def: 0.005, min: 1e-4, max: 1, log: true, knob: true }];
  static pins = [['A', 'L'], ['K', 'L'], ['SA', 'R'], ['SK', 'R']];
  static description = 'Optically coupled SCR: current through the infrared LED (A–K, ≈1.2 V) generates gate current in a sensitive photo-SCR (SA → SK; ≈10 mA LED current triggers it with the internal 27 kΩ gate resistor); once fired it latches and conducts until its current falls below the holding current (so on AC it switches off at each zero crossing). Isolated triggering of thyristors from logic.';
  ownInternal() { return 1; }
  parts() {
    const SCR = getType('scr');
    return [[new Diode(0, 0), [0, 1]], [new SCR(0, 0), [2, 3, 'i0']], [new Resistor(0, 0), ['i0', 3]], [new GateLink(), [0, 1, 3, 'i0']]];
  }
  sync() {
    if (!this.subs) return;
    const [d, scr, rg, gl] = this.subs.map((s) => s.el);
    Object.assign(d.p, { is: 1e-15, n: 1.5, bv: 6, model: 'custom' }); d.onParamChange();
    Object.assign(scr.p, { igt: 2e-5, ih: 5e-4, vbo: 400 }); scr.onParamChange?.();
    rg.p.r = 27e3; gl.k = this.p.k;
  }
  connectivity() { return [[0, 1], [2, 3, 'i0']]; }
  valueLabel() { return ''; }
  readings(s) { return [['LED current', this.postCurrents[0], 'A'], ['SCR current', this.postCurrents[2], 'A'], ['V(SA–SK)', s.v(this.nodes[2]) - s.v(this.nodes[3]), 'V']]; }
  draw(g) {
    this.drawChip(g, '');
    const on = g.running && this.postCurrents[0] > 1e-4;
    g.poly([[-0.75 * G, -0.35 * G], [-0.75 * G, 0.25 * G], [-0.4 * G, -0.05 * G]], { stroke: g.body, width: g.lw * 0.6, close: true, fill: on ? 'rgba(255,80,80,0.7)' : null });
    for (const dy of [-0.15, 0.15]) g.line(-0.2 * G, dy * G, 0.15 * G, dy * G + 3, on ? '#f87171' : g.muted, g.lw * 0.5);
    g.poly([[0.3 * G, -0.35 * G], [0.75 * G, -0.35 * G], [0.52 * G, 0.1 * G]], { stroke: g.body, width: g.lw * 0.6, close: true });
    g.line(0.3 * G, 0.12 * G, 0.75 * G, 0.12 * G, g.body, g.lw * 0.7);
  }
}
register(OptoSCR);

export class LaserModule extends TwoTerm {
  static type = 'lasermod'; static title = 'Laser Module (5 V)'; static category = 'Output';
  static prefix = 'LZ'; static keywords = 'laser module ky-008 5v red laser 650nm dot laser pointer driver';
  static props = [
    { key: 'ith', label: 'Threshold current', unit: 'A', def: 0.018, min: 1e-4, max: 1, log: true },
    { key: 'eta', label: 'Slope efficiency', unit: 'W/A', def: 0.4, min: 0.01, max: 2 },
    { key: 'r', label: 'Built-in resistor', unit: 'Ω', def: 82, min: 1, max: 1e4, log: true },
  ];
  static description = '650 nm laser diode with its current-limiting resistor (KY-008 style, run from 5 V): below the threshold current it only glows like an LED; above it lases and the optical power rises steeply, P = η·(I − Ith) (≈5 mW at 5 V). Never look into the beam.';
  nonlinear = true;
  reset() { this.vd = 0; this.setCurrent(0); }
  iv(v) { return stringIV(v, 1, 1e-17, 2.0, this.p.r); }
  stampNL(s) {
    const [a, b] = this.nodes;
    let v = s.v(a) - s.v(b);
    if (Math.abs(v - this.vd) > 0.5) { v = this.vd + 0.5 * Math.sign(v - this.vd); s.limited = true; }
    this.vd = v;
    const { i, g } = this.iv(v); s.addG(a, b, g); s.addI(a, b, i - g * v);
  }
  accept(s) { const v = this.voltageDiff(s); this.vd = v; this.setCurrent(this.iv(v).i); }
  stampAC(ac) { ac.addY(this.nodes[0], this.nodes[1], 1e-9); }
  popt() { return Math.max(0, this.p.eta * ((this.i || 0) - this.p.ith)); }
  valueLabel() { return ''; }
  readings() { return [['Current', this.i, 'A'], ['State', (this.i || 0) > this.p.ith ? 'LASING' : 'below threshold', ''], ['Optical power', this.popt(), 'W']]; }
  draw(g) {
    g.box(-1.1 * G, -0.4 * G, 0.5 * G, 0.4 * G, { stroke: g.body, width: g.lw * 0.9, fill: g.fill, r: 3 });
    g.box(0.5 * G, -0.22 * G, 0.85 * G, 0.22 * G, { stroke: g.body, width: g.lw * 0.7, fill: '#666', r: 1 });
    const p = this.popt();
    if (g.running && p > 1e-5) { g.line(0.85 * G, 0, 2 * G, 0, `rgba(255,40,40,${clamp(p / 0.005, 0.3, 1)})`, g.lw * 1.4); g.glow(0.9 * G, 0, 0.6 * G, '255,40,40', 0.6); }
    g.upright(() => g.text('LASER', -0.3 * G, 0, { size: 6, color: g.accent, bold: true }));
  }
  leads() { return [[0, -2 * G, 0, -1.1 * G, 0], [1, 2 * G, 0, 0.85 * G, 0]]; }
  localBox() { return [-2 * G, -0.6 * G, 2 * G, 0.6 * G]; }
}
register(LaserModule);

// ================================================================== thermal
export class Peltier extends TwoTerm {
  static type = 'peltier'; static title = 'Peltier Module (TEC1-12706)'; static category = 'Output';
  static prefix = 'TEC'; static keywords = 'peltier thermoelectric cooler tec1-12706 tec seebeck heat pump cooler mini fridge';
  static props = [
    { key: 'qload', label: 'Heat load on the cold side', unit: 'W', def: 5, min: 0, max: 200, knob: true },
    { key: 'alpha', label: 'Seebeck coefficient', unit: 'V/K', def: 0.051, min: 1e-3, max: 1 },
    { key: 'r', label: 'Electrical resistance', unit: 'Ω', def: 1.86, min: 0.01, max: 100 },
    { key: 'k', label: 'Thermal conductance', unit: 'W/K', def: 0.56, min: 0.01, max: 20 },
    { key: 'rhs', label: 'Hot-side heatsink', unit: 'K/W', def: 0.25, min: 0.01, max: 20 },
    { key: 'cc', label: 'Cold-side heat capacity', unit: 'J/K', def: 5, min: 0.01, max: 1e5, log: true },
    { key: 'ch', label: 'Hot-side heat capacity', unit: 'J/K', def: 50, min: 0.01, max: 1e6, log: true },
    { key: 'tamb', label: 'Ambient', unit: '°C', def: 25, min: -40, max: 60 },
  ];
  static description = 'Thermoelectric (Peltier) module: current I pumps heat Qc = α·I·Tc − ½I²R − K·ΔT from the cold face to the hot face, which must be cooled by a heatsink (Qh = Qc + V·I). Electrically V = I·R + α·(Th − Tc): the Seebeck back-EMF grows with the temperature difference. Too much current heats more than it pumps — there is an optimum.';
  reset() { const t = this.p.tamb + 273.15; this.tc = t; this.th = t; this.qc = 0; this.setCurrent(0); }
  branchCount() { return 1; }
  stamp(s) { const k = this.branches[0], [a, b] = this.nodes; s.addBranchKCL(a, b, k); s.addA(k, a - 1, 1); s.addA(k, b - 1, -1); s.addA(k, k, -this.p.r); }
  stampStep(s) { s.b[this.branches[0]] += this.p.alpha * (this.th - this.tc); }
  stampAC(ac) { const k = this.branches[0], [a, b] = this.nodes; ac.addBranchKCL(a, b, k); ac.addA(k, a - 1, 1); ac.addA(k, b - 1, -1); ac.addA(k, k, -this.p.r); }
  accept(s) {
    const I = s.x[this.branches[0]];
    this.setCurrent(I);
    const { alpha, r, k } = this.p, ta = this.p.tamb + 273.15;
    this.qc = alpha * I * this.tc - 0.5 * I * I * r - k * (this.th - this.tc);
    this.qh = alpha * I * this.th + 0.5 * I * I * r - k * (this.th - this.tc);
    if (s.mode === 'dc') return;
    this.tc = Math.max(1, this.tc + ((this.p.qload - this.qc) / this.p.cc) * s.dt);
    this.th = Math.max(1, this.th + ((this.qh - (this.th - ta) / this.p.rhs) / this.p.ch) * s.dt);
  }
  valueLabel() { return ''; }
  readings(s) {
    const v = this.voltageDiff(s), pin = v * (this.i || 0);
    return [['Cold side', this.tc - 273.15, '°C'], ['Hot side', this.th - 273.15, '°C'], ['ΔT', this.th - this.tc, 'K'], ['Heat pumped Qc', this.qc || 0, 'W'],
      ['Electrical power', pin, 'W'], ['COP', pin > 1e-6 ? (this.qc || 0) / pin : 0, ''], ['Current', this.i, 'A']];
  }
  leads() { return [[0, -2 * G, 0, -G, 0], [1, 2 * G, 0, G, 0]]; }
  localBox() { return [-2 * G, -G, 2 * G, G]; }
  draw(g) {
    const cold = clamp(((this.p.tamb + 273.15) - (this.tc || 300)) / 30, 0, 1), hot = clamp(((this.th || 300) - (this.p.tamb + 273.15)) / 30, 0, 1);
    g.box(-G, -0.8 * G, G, -0.5 * G, { fill: `rgba(80,150,255,${0.25 + 0.7 * cold})`, r: 1 });
    g.box(-G, 0.5 * G, G, 0.8 * G, { fill: `rgba(255,90,60,${0.25 + 0.7 * hot})`, r: 1 });
    for (let k = 0; k < 6; k++) g.box(-0.9 * G + k * 0.33 * G, -0.45 * G, -0.75 * G + k * 0.33 * G, 0.45 * G, { fill: k % 2 ? '#94a3b8' : '#cbd5e1' });
    g.text('C', 1.2 * G, -0.65 * G, { size: 6, color: '#3b82f6', bold: true }); g.text('H', 1.2 * G, 0.65 * G, { size: 6, color: '#ef4444', bold: true });
  }
}
register(Peltier);

export class DCFan extends TwoTerm {
  static type = 'dcfan'; static title = 'DC Fan (brushless, 12 V)'; static category = 'Output';
  static prefix = 'FAN'; static keywords = 'dc fan cooling fan 12v brushless pc fan cfm airflow 80mm 120mm';
  static props = [
    { key: 'vr', label: 'Rated voltage', unit: 'V', def: 12, min: 1, max: 60 },
    { key: 'ir', label: 'Rated current', unit: 'A', def: 0.15, min: 0.005, max: 10, log: true, knob: true },
    { key: 'rpm', label: 'Rated speed', unit: 'rpm', def: 2500, min: 100, max: 20000 },
    { key: 'cfm', label: 'Rated airflow', unit: 'CFM', def: 40, min: 0.1, max: 1000 },
  ];
  static description = 'Brushless DC cooling fan (with built-in commutation and reverse-polarity protection): speed and airflow rise roughly in proportion to the voltage, the air load torque ∝ speed², and it stalls below about a third of the rated voltage. Current flows only with the correct polarity.';
  nonlinear = true;
  R() { return (0.35 * this.p.vr) / this.p.ir; }
  ke() { return (this.p.vr - 0.3 - this.p.ir * this.R()) / ((this.p.rpm * TAU) / 60); }
  reset() { this.w = 0; this.ang = 0; this.vd = 0; this.setCurrent(0); }
  iv(v) { return soft(v - this.ke() * this.w - 0.3, this.R(), 0.05); }
  stampNL(s) { const [a, b] = this.nodes, v = s.v(a) - s.v(b), c = this.iv(v); s.addNLCurrent(a, b, c.i, [[a, b, c.g, v]]); }
  stamp(s) { s.addG(this.nodes[0], this.nodes[1], 1e-9); }
  stampAC(ac) { ac.addY(this.nodes[0], this.nodes[1], 1 / this.R()); }
  accept(s) {
    const v = this.voltageDiff(s), i = this.iv(v).i;
    this.setCurrent(i);
    if (s.mode === 'dc') return;
    const wr = (this.p.rpm * TAU) / 60, ke = this.ke(), kf = (ke * this.p.ir) / (wr * wr), J = (2 * ke * this.p.ir * 0.3) / wr;
    const te = ke * i, stiction = 0.9 * ke * this.p.ir; // a stopped fan needs ≈1/3 of rated voltage to start
    if (this.w > 1e-3 * wr || te > stiction) this.w = Math.max(0, this.w + ((te - kf * this.w * this.w) / J) * s.dt);
    this.ang += this.w * s.dt * 0.05;
  }
  valueLabel() { return fmtShort(this.p.vr, 'V'); }
  readings() { const wr = (this.p.rpm * TAU) / 60; return [['Speed', (this.w * 60) / TAU, 'rpm'], ['Airflow', (this.p.cfm * this.w) / wr, 'CFM'], ['Current', this.i, 'A']]; }
  leads() { return [[0, -2 * G, 0, -G, 0], [1, 2 * G, 0, G, 0]]; }
  localBox() { return [-2 * G, -G, 2 * G, G]; }
  draw(g) {
    g.box(-0.9 * G, -0.9 * G, 0.9 * G, 0.9 * G, { stroke: g.body, width: g.lw * 0.9, fill: g.fill, r: 4 });
    g.circle(0, 0, 0.75 * G, { stroke: g.muted, width: g.lw * 0.5 });
    const a = this.ang || 0;
    for (let k = 0; k < 5; k++) { const t = a + (k * TAU) / 5; g.line(Math.cos(t) * 0.15 * G, Math.sin(t) * 0.15 * G, Math.cos(t + 0.5) * 0.68 * G, Math.sin(t + 0.5) * 0.68 * G, g.accent, g.lw * 1.2); }
    g.circle(0, 0, 0.15 * G, { fill: g.body });
    g.text('+', -1.4 * G, -0.55 * G, { size: 10, color: g.pos, bold: true });
  }
}
register(DCFan);

export class Electromagnet extends TwoTerm {
  static type = 'electromagnet'; static title = 'Electromagnet'; static category = 'Output';
  static prefix = 'EM'; static keywords = 'electromagnet lifting magnet holding magnet coil force solenoid core ampere turns door lock';
  static props = [
    { key: 'n', label: 'Turns', unit: '', def: 800, min: 1, max: 1e5, log: true, knob: true },
    { key: 'r', label: 'Coil resistance', unit: 'Ω', def: 12, min: 0.01, max: 1e5, log: true },
    { key: 'gap', label: 'Air gap (each pole)', unit: 'mm', def: 0.2, min: 0.01, max: 50, log: true },
    { key: 'area', label: 'Pole face area (each)', unit: 'cm²', def: 4, min: 0.01, max: 1e4, log: true },
    { key: 'bsat', label: 'Core saturation', unit: 'T', def: 1.5, min: 0.1, max: 2.5 },
  ];
  static description = 'U-core electromagnet holding an iron armature across two air gaps: the flux density B = μ0·N·I / (2g) (limited by core saturation), the inductance L = μ0·N²·A / (2g), and the holding force F = B²·A/μ0 (both poles). Force rises with the square of the current and falls steeply as the gap opens.';
  branchCount() { return 1; }
  L() { return (4e-7 * Math.PI * this.p.n * this.p.n * this.p.area * 1e-4) / (2 * this.p.gap * 1e-3); }
  B(i) { return clamp((4e-7 * Math.PI * this.p.n * Math.abs(i)) / (2 * this.p.gap * 1e-3), 0, this.p.bsat); }
  reset() { this.il = 0; this.setCurrent(0); }
  stamp(s) { const k = this.branches[0], [a, b] = this.nodes; s.addBranchKCL(a, b, k); s.addA(k, a - 1, 1); s.addA(k, b - 1, -1); s.addA(k, k, -(this.p.r + (s.mode === 'dc' ? 0 : this.L() / s.dt))); }
  stampStep(s) { if (s.mode !== 'dc') s.b[this.branches[0]] += -(this.L() / s.dt) * this.il; }
  stampAC(ac) { const k = this.branches[0], [a, b] = this.nodes; ac.addBranchKCL(a, b, k); ac.addA(k, a - 1, 1); ac.addA(k, b - 1, -1); ac.addA(k, k, -this.p.r, -ac.omega * this.L()); }
  accept(s) { this.il = s.x[this.branches[0]]; this.setCurrent(this.il); }
  force() { const B = this.B(this.il || 0); return (B * B * this.p.area * 1e-4) / (4e-7 * Math.PI); }
  valueLabel() { return `${fmtQty(this.force(), 'N')}`; }
  readings() { return [['Current', this.i, 'A'], ['Ampere-turns', Math.abs(this.i || 0) * this.p.n, 'At'], ['Flux density', this.B(this.il || 0), 'T'], ['Holding force', this.force(), 'N'], ['Can lift', this.force() / 9.81, 'kg'], ['Inductance', this.L(), 'H']]; }
  leads() { return [[0, -2 * G, 0, -0.9 * G, 0], [1, 2 * G, 0, 0.9 * G, 0]]; }
  localBox() { return [-2 * G, -1.1 * G, 2 * G, 1.1 * G]; }
  draw(g) {
    const ctx = g.ctx; ctx.beginPath(); ctx.moveTo(-0.7 * G, 0.9 * G); ctx.lineTo(-0.7 * G, -0.5 * G); ctx.lineTo(0.7 * G, -0.5 * G); ctx.lineTo(0.7 * G, 0.9 * G);
    ctx.strokeStyle = g.body; ctx.lineWidth = g.lw * 2; ctx.stroke();
    for (let k = 0; k < 4; k++) g.line(-0.9 * G, -0.3 * G + k * 0.22 * G, -0.5 * G, -0.2 * G + k * 0.22 * G, g.accent, g.lw * 0.8);
    const f = clamp(this.force() / 200, 0, 1);
    g.box(-0.85 * G, 0.95 * G, 0.85 * G, 1.1 * G, { fill: g.running && f > 0.01 ? `rgba(148,163,184,${0.5 + 0.5 * f})` : g.muted, r: 1 });
  }
}
register(Electromagnet);

// ============================================================ fault switch
export class FaultSwitch extends TwoTerm {
  static type = 'faultsw'; static title = 'Fault (timed short circuit)'; static category = 'Power Systems';
  static prefix = 'FLT'; static keywords = 'fault short circuit line to ground fault bolted fault arc fault fault resistance timed fault protection test';
  static props = [
    { key: 'tf', label: 'Fault applied at', unit: 's', def: 0.05, min: 0, max: 1e4, knob: true },
    { key: 'tc', label: 'Fault cleared at (0 = never)', unit: 's', def: 0, min: 0, max: 1e4 },
    { key: 'rf', label: 'Fault resistance', unit: 'Ω', def: 0.01, min: 1e-6, max: 1e6, log: true },
  ];
  static description = 'Applies a short circuit (through the fault resistance) between its terminals at the set time and optionally removes it later — for testing fuses, breakers, relays and protection coordination: connect it line-to-earth or line-to-line where the fault should happen.';
  static noFault = true;
  reset() { this.on = false; this.peak = 0; this.setCurrent(0); }
  g() { return this.on ? 1 / this.p.rf : 1e-9; }
  stamp(s) { s.addG(this.nodes[0], this.nodes[1], this.g()); }
  stampAC(ac) { ac.addY(this.nodes[0], this.nodes[1], this.g()); }
  preStep(s) {
    if (s.mode === 'dc') return;
    const t = s.tNext, on = t >= this.p.tf && !(this.p.tc > this.p.tf && t >= this.p.tc);
    if (on !== this.on) { this.on = on; s.markEvent(); }
  }
  accept(s) { const i = this.voltageDiff(s) * this.g(); this.setCurrent(i); if (this.on) this.peak = Math.max(this.peak, Math.abs(i)); }
  valueLabel() { return this.on ? 'FAULT' : `@${fmtShort(this.p.tf, 's')}`; }
  readings(s) { return [['State', this.on ? 'FAULT ON' : 'healthy', ''], ['Fault current', this.i, 'A'], ['Peak fault current', this.peak || 0, 'A'], ['Voltage', this.voltageDiff(s), 'V']]; }
  draw(g) {
    const on = this.on && g.running;
    g.line(-G, 0, -0.3 * G, 0, g.vc(g.pv(0)), g.lw); g.line(0.3 * G, 0, G, 0, g.vc(g.pv(1)), g.lw);
    g.poly([[-0.3 * G, 0], [0.05 * G, -0.45 * G], [-0.05 * G, 0], [0.3 * G, 0.45 * G], [0.3 * G, 0]], { stroke: on ? '#ef4444' : g.body, width: g.lw * 0.9 });
    if (on) g.glow(0, 0, 0.9 * G, '255,70,70', 0.5);
  }
}
register(FaultSwitch);
