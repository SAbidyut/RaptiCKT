// Transformers built on the coupled-windings model (kit.Windings):
// centre-tap, dual-secondary, autotransformer / variac, isolation, step-up,
// step-down, current & potential transformers, three-phase transformer with
// vector groups, and general coupled inductors.

import { Element, register, GRID } from './base.js';
import { Transformer } from './passive.js';
import { Windings } from './kit.js';
import { fmtShort } from '../engine/units.js';

const G = GRID;

/** Base for devices made of coupled windings. */
class WindingDevice extends Element {
  static category = 'Transformers';
  static prefix = 'T';
  constructor(x, y) {
    super(x, y);
    this.postCurrents = new Array(this.localPosts().length).fill(0);
    this.W = new Windings(this.windings().length);
  }
  windings() { return []; }        // [[refP, refN], ...] — post index or 'iK'
  resist() { return []; }          // per-winding resistance
  Lmat() { return []; }            // inductance matrix
  node(r) { return typeof r === 'string' ? this.inodes[+r.slice(1)] : this.nodes[r]; }
  ends() { return this.windings().map(([p, q]) => [this.node(p), this.node(q)]); }
  branchCount() { return this.windings().length; }
  connectivity() { return this.windings().map((w) => [...w]); }
  reset() { this.W = new Windings(this.windings().length); this.postCurrents.fill(0); this.i = 0; }
  stamp(s) { this.W.stamp(s, this.ends(), this.branches, this.Lmat(), this.resist()); }
  stampStep(s) { this.W.stampStep(s, this.branches, this.Lmat()); }
  accept(s) {
    this.W.accept(s, this.ends(), this.branches, this.resist());
    this.postCurrents.fill(0);
    this.windings().forEach(([p, q], k) => {
      if (typeof p === 'number') this.postCurrents[p] += this.W.i[k];
      if (typeof q === 'number') this.postCurrents[q] -= this.W.i[k];
    });
    this.i = this.W.i[0];
  }
  stampAC(ac) { this.W.stampAC(ac, this.ends(), this.branches, this.Lmat(), this.resist()); }
  wv(s, k) { const [a, b] = this.ends()[k]; return s.v(a) - s.v(b); }
  /** coil drawing between (x, y1) and (x, y2), bulging towards dir */
  coil(g, x, y1, y2, dir, n, v1, v2) {
    const ctx = g.ctx, h = (y2 - y1) / n;
    ctx.beginPath();
    for (let k = 0; k < n; k++) ctx.arc(x, y1 + h * (k + 0.5), Math.abs(h) / 2, -Math.PI / 2, Math.PI / 2, dir < 0);
    ctx.strokeStyle = g.grad(x, y1, x, y2, v1, v2); ctx.lineWidth = g.lw; ctx.stroke();
  }
  core(g, y1, y2) {
    g.line(-0.12 * G, y1, -0.12 * G, y2, g.body, g.lw * 0.8);
    g.line(0.12 * G, y1, 0.12 * G, y2, g.body, g.lw * 0.8);
  }
}

// ------------------------------------------------- centre-tap transformer
export class CenterTapTransformer extends WindingDevice {
  static type = 'xfmrct'; static title = 'Centre-Tap Transformer';
  static keywords = 'center tap centre tap transformer 12-0-12 full wave rectifier';
  static props = [
    { key: 'vp', label: 'Primary voltage (RMS)', unit: 'V', def: 230, min: 0.1, max: 1e6, log: true },
    { key: 'vs', label: 'Secondary voltage, each half (RMS)', unit: 'V', def: 12, min: 0.01, max: 1e6, log: true, knob: true },
    { key: 'lm', label: 'Magnetising inductance', unit: 'H', def: 10, min: 1e-6, max: 1e4, log: true },
    { key: 'k', label: 'Coupling k', unit: '', def: 0.999, min: 0.5, max: 0.99999 },
    { key: 'r1', label: 'Primary resistance', unit: 'Ω', def: 5, min: 0, max: 1e5 },
    { key: 'r2', label: 'Secondary resistance (each half)', unit: 'Ω', def: 0.1, min: 0, max: 1e5 },
  ];
  static description = 'Transformer with a centre-tapped secondary (e.g. 230 V → 12-0-12 V). Terminals: primary (left), secondary top / CT / bottom (right).';
  localPosts() { return [[-2 * G, -2 * G], [-2 * G, 2 * G], [2 * G, -2 * G], [2 * G, 0], [2 * G, 2 * G]]; }
  localBox() { return [-2 * G, -2 * G, 2 * G, 2 * G]; }
  leads() { return [[0, -2 * G, -2 * G, -0.7 * G, -2 * G], [1, -2 * G, 2 * G, -0.7 * G, 2 * G], [2, 2 * G, -2 * G, 0.7 * G, -2 * G], [3, 2 * G, 0, 0.7 * G, 0], [4, 2 * G, 2 * G, 0.7 * G, 2 * G]]; }
  windings() { return [[0, 1], [2, 3], [3, 4]]; }
  connectivity() { return [[0, 1], [2, 3, 4]]; }
  resist() { return [this.p.r1, this.p.r2, this.p.r2]; }
  Lmat() {
    const n = this.p.vs / this.p.vp, t = [1, n, n], k = this.p.k;
    return t.map((a, r) => t.map((b, c) => this.p.lm * a * b * (r === c ? 1 : k)));
  }
  valueLabel() { return `${fmtShort(this.p.vp, 'V')}:${+this.p.vs.toPrecision(3)}-0-${+this.p.vs.toPrecision(3)}`; }
  readings(s) { return [['V primary', this.wv(s, 0), 'V'], ['V upper half', this.wv(s, 1), 'V'], ['V lower half', this.wv(s, 2), 'V'], ['I primary', this.W.i[0], 'A']]; }
  draw(g) {
    g.line(-0.7 * G, -2 * G, -0.7 * G, -1.5 * G, g.vc(g.pv(0)), g.lw); g.line(-0.7 * G, 2 * G, -0.7 * G, 1.5 * G, g.vc(g.pv(1)), g.lw);
    this.coil(g, -0.7 * G, -1.5 * G, 1.5 * G, 1, 5, g.pv(0), g.pv(1));
    g.line(0.7 * G, -2 * G, 0.7 * G, -1.5 * G, g.vc(g.pv(2)), g.lw); g.line(0.7 * G, 2 * G, 0.7 * G, 1.5 * G, g.vc(g.pv(4)), g.lw);
    this.coil(g, 0.7 * G, -1.5 * G, 0, -1, 3, g.pv(2), g.pv(3));
    this.coil(g, 0.7 * G, 0, 1.5 * G, -1, 3, g.pv(3), g.pv(4));
    this.core(g, -1.6 * G, 1.6 * G);
    g.text('CT', 1.45 * G, -0.4 * G, { size: 6.5, color: g.muted });
  }
}
register(CenterTapTransformer);

// ------------------------------------------------ dual-secondary transformer
export class DualSecondaryTransformer extends WindingDevice {
  static type = 'xfmr2s'; static title = 'Dual-Secondary Transformer';
  static keywords = 'transformer two secondary windings multi winding isolated dual output';
  static props = [
    { key: 'vp', label: 'Primary voltage (RMS)', unit: 'V', def: 230, min: 0.1, max: 1e6, log: true },
    { key: 'vs1', label: 'Secondary 1 voltage (RMS)', unit: 'V', def: 12, min: 0.01, max: 1e6, log: true, knob: true },
    { key: 'vs2', label: 'Secondary 2 voltage (RMS)', unit: 'V', def: 5, min: 0.01, max: 1e6, log: true },
    { key: 'lm', label: 'Magnetising inductance', unit: 'H', def: 10, min: 1e-6, max: 1e4, log: true },
    { key: 'k', label: 'Coupling k', unit: '', def: 0.999, min: 0.5, max: 0.99999 },
    { key: 'r1', label: 'Primary resistance', unit: 'Ω', def: 5, min: 0, max: 1e5 },
    { key: 'r2', label: 'Secondary resistance', unit: 'Ω', def: 0.1, min: 0, max: 1e5 },
  ];
  static description = 'One primary and two electrically isolated secondaries on the same core.';
  localPosts() { return [[-2 * G, -2 * G], [-2 * G, 2 * G], [2 * G, -3 * G], [2 * G, -G], [2 * G, G], [2 * G, 3 * G]]; }
  localBox() { return [-2 * G, -3 * G, 2 * G, 3 * G]; }
  leads() { return this.localPosts().map(([x, y], i) => [i, x, y, Math.sign(x) * 0.7 * G, y]); }
  windings() { return [[0, 1], [2, 3], [4, 5]]; }
  resist() { return [this.p.r1, this.p.r2, this.p.r2]; }
  Lmat() {
    const t = [1, this.p.vs1 / this.p.vp, this.p.vs2 / this.p.vp], k = this.p.k;
    return t.map((a, r) => t.map((b, c) => this.p.lm * a * b * (r === c ? 1 : k)));
  }
  valueLabel() { return `${fmtShort(this.p.vp, 'V')}:${fmtShort(this.p.vs1, 'V')}+${fmtShort(this.p.vs2, 'V')}`; }
  readings(s) { return [['V primary', this.wv(s, 0), 'V'], ['V secondary 1', this.wv(s, 1), 'V'], ['V secondary 2', this.wv(s, 2), 'V'], ['I primary', this.W.i[0], 'A']]; }
  draw(g) {
    this.coil(g, -0.7 * G, -1.5 * G, 1.5 * G, 1, 5, g.pv(0), g.pv(1));
    g.line(-0.7 * G, -2 * G, -0.7 * G, -1.5 * G, g.vc(g.pv(0)), g.lw); g.line(-0.7 * G, 2 * G, -0.7 * G, 1.5 * G, g.vc(g.pv(1)), g.lw);
    this.coil(g, 0.7 * G, -3 * G, -G, -1, 3, g.pv(2), g.pv(3));
    this.coil(g, 0.7 * G, G, 3 * G, -1, 3, g.pv(4), g.pv(5));
    this.core(g, -2.8 * G, 2.8 * G);
  }
}
register(DualSecondaryTransformer);

// ---------------------------------------------------------- variac
export class Autotransformer extends WindingDevice {
  static type = 'autotx'; static title = 'Autotransformer / Variac';
  static keywords = 'variac autotransformer variable transformer auto transformer dimmerstat voltage regulator';
  static props = [
    { key: 'pos', label: 'Output (tap position)', unit: '%', def: 50, min: 1, max: 99, knob: true },
    { key: 'lm', label: 'Winding inductance', unit: 'H', def: 5, min: 1e-6, max: 1e4, log: true },
    { key: 'k', label: 'Coupling k', unit: '', def: 0.999, min: 0.5, max: 0.99999 },
    { key: 'r', label: 'Winding resistance', unit: 'Ω', def: 1, min: 0, max: 1e4 },
  ];
  static description = 'Single tapped winding (variac): input across top–common, output from the sliding tap to common. Vout ≈ tap % × Vin with no isolation.';
  // 0 = input (top), 1 = common, 2 = output (tap)
  localPosts() { return [[-2 * G, -2 * G], [-2 * G, 2 * G], [2 * G, 0]]; }
  localBox() { return [-2 * G, -2 * G, 2 * G, 2 * G]; }
  leads() { return [[0, -2 * G, -2 * G, 0, -2 * G], [1, -2 * G, 2 * G, 0, 2 * G], [2, 2 * G, 0, 0.8 * G, 0]]; }
  windings() { return [[2, 1], [0, 2]]; } // lower section (tap→common), upper section (top→tap)
  connectivity() { return [[0, 1, 2]]; }
  fr() { return Math.min(0.99, Math.max(0.01, this.p.pos / 100)); }
  resist() { const f = this.fr(); return [this.p.r * f + 1e-4, this.p.r * (1 - f) + 1e-4]; }
  Lmat() { const f = this.fr(), t = [f, 1 - f], k = this.p.k; return t.map((a, r) => t.map((b, c) => this.p.lm * a * b * (r === c ? 1 : k))); }
  valueLabel() { return `${this.p.pos.toFixed(0)}%`; }
  readings(s) { const [a, c, o] = this.nodes; return [['V in', s.v(a) - s.v(c), 'V'], ['V out', s.v(o) - s.v(c), 'V'], ['I in', this.postCurrents[0], 'A'], ['I out', -this.postCurrents[2], 'A']]; }
  draw(g) {
    g.line(0, -2 * G, 0, -1.6 * G, g.vc(g.pv(0)), g.lw); g.line(0, 2 * G, 0, 1.6 * G, g.vc(g.pv(1)), g.lw);
    this.coil(g, 0, -1.6 * G, 1.6 * G, -1, 6, g.pv(0), g.pv(1));
    const y = 1.6 * G - 3.2 * G * this.fr();
    g.poly([[0.8 * G, 0], [0.8 * G, y], [0.45 * G, y]], { stroke: g.vc(g.pv(2)), width: g.lw * 0.9 });
    g.poly([[0.42 * G, y], [0.62 * G, y - 4], [0.62 * G, y + 4]], { fill: g.vc(g.pv(2)) });
  }
}
register(Autotransformer);

// --------------------------------------------- presets of the 2-winding model
function txPreset(type, title, defs, keywords, desc) {
  const C = class extends Transformer {};
  Object.assign(C, { type, title, keywords, description: desc, category: 'Transformers' });
  C.props = Transformer.props.map((p) => ({ ...p, def: defs[p.key] ?? p.def, max: p.key === 'l1' ? 1e6 : p.max }));
  register(C);
  return C;
}
txPreset('isotx', 'Isolation Transformer 1:1', { n: 1, l1: 5, r1: 0.5, r2: 0.5 }, 'isolation transformer 1:1 safety galvanic isolation',
  '1:1 transformer: same voltage, but the secondary is galvanically isolated from the mains and earth.');
txPreset('txstepdown', 'Step-Down Transformer', { n: 12 / 230, l1: 10, r1: 5, r2: 0.05 }, 'step down transformer 230v 12v mains adapter',
  'Mains step-down transformer, 230 V → 12 V (turns ratio 12/230).');
txPreset('txstepup', 'Step-Up Transformer', { n: 10, l1: 0.5, r1: 0.05, r2: 5 }, 'step up transformer high voltage boost',
  'Step-up transformer, turns ratio 1:10.');
txPreset('ct', 'Current Transformer (CT)', { n: 100, l1: 2e-4, k: 0.9999, r1: 1e-4, r2: 0.5 }, 'current transformer ct 100/1 metering protection',
  'Current transformer, 1 : 100 turns (e.g. 100 A / 1 A). Put the primary in series with the line and connect an ammeter or burden across the secondary — never leave a loaded CT secondary open.');
txPreset('pt', 'Potential Transformer (PT)', { n: 110 / 11000, l1: 1000, k: 0.9999, r1: 50, r2: 0.2 }, 'potential transformer pt vt voltage transformer 11kv 110v metering',
  'Voltage (potential) transformer, 11 kV → 110 V, for measuring high voltages with a standard voltmeter.');

// ------------------------------------------------ three-phase transformer
const GROUPS = {
  Dyn11: { pri: 'D', sec: 'Y', name: 'Dyn11 (distribution)' },
  Yyn0: { pri: 'Y', sec: 'Y', name: 'Yyn0' },
  Yd1: { pri: 'Y', sec: 'D', name: 'Yd1 (generator step-up)' },
  Dd0: { pri: 'D', sec: 'D', name: 'Dd0' },
};

export class ThreePhaseTransformer extends WindingDevice {
  static type = 'tx3ph'; static title = '3-Phase Transformer';
  static keywords = 'three phase transformer 3 phase dyn11 delta star vector group distribution 11kv 400v';
  static props = [
    { key: 'group', label: 'Vector group', type: 'select', def: 'Dyn11', options: Object.entries(GROUPS).map(([k, v]) => [k, v.name]) },
    { key: 'vp', label: 'Primary line voltage', unit: 'V', def: 11000, min: 1, max: 1e6, log: true },
    { key: 'vs', label: 'Secondary line voltage', unit: 'V', def: 415, min: 1, max: 1e6, log: true, knob: true },
    { key: 'lm', label: 'Magnetising inductance (per phase, primary)', unit: 'H', def: 200, min: 1e-4, max: 1e6, log: true },
    { key: 'k', label: 'Coupling k', unit: '', def: 0.998, min: 0.5, max: 0.99999 },
    { key: 'r1', label: 'Primary winding resistance', unit: 'Ω', def: 5, min: 0, max: 1e5 },
    { key: 'r2', label: 'Secondary winding resistance', unit: 'Ω', def: 0.005, min: 0, max: 1e5 },
  ];
  static description = 'Three single-phase windings pairs (one per limb) connected per the vector group. Primary A, B, C on the left; secondary a, b, c and neutral n on the right. Dyn11: secondary leads primary by 30°.';
  localPosts() { return [[-3 * G, -2 * G], [-3 * G, 0], [-3 * G, 2 * G], [3 * G, -2 * G], [3 * G, -G], [3 * G, 0], [3 * G, G]]; }
  localBox() { return [-3 * G, -2.6 * G, 3 * G, 2.6 * G]; }
  leads() { return this.localPosts().map(([x, y], i) => [i, x, y, Math.sign(x) * 2 * G, y]); }
  internalNodeCount() { return 1; } // primary star point
  grp() { return GROUPS[this.p.group] || GROUPS.Dyn11; }
  windings() {
    const g = this.grp(), w = [];
    for (let p = 0; p < 3; p++) w.push(g.pri === 'Y' ? [p, 'i0'] : [p, (p + 1) % 3]);
    for (let p = 0; p < 3; p++) w.push(g.sec === 'Y' ? [3 + p, 6] : [3 + p, 3 + ((p + 1) % 3)]);
    return w;
  }
  connectivity() { const w = this.windings(); return [[...new Set(w.slice(0, 3).flat())], [...new Set(w.slice(3).flat())]]; }
  onParamChange() { this.W = new Windings(6); }
  resist() { return [this.p.r1, this.p.r1, this.p.r1, this.p.r2, this.p.r2, this.p.r2]; }
  Lmat() {
    const g = this.grp();
    const vpw = g.pri === 'Y' ? this.p.vp / Math.sqrt(3) : this.p.vp, vsw = g.sec === 'Y' ? this.p.vs / Math.sqrt(3) : this.p.vs;
    const n = vsw / vpw, L = [];
    for (let r = 0; r < 6; r++) {
      L.push([]);
      for (let c = 0; c < 6; c++) {
        const same = r % 3 === c % 3; // windings on the same limb are coupled
        const tr = r < 3 ? 1 : n, tc = c < 3 ? 1 : n;
        L[r].push(same ? this.p.lm * tr * tc * (r === c ? 1 : this.p.k) : 0);
      }
    }
    return L;
  }
  stamp(s) { super.stamp(s); if (this.grp().pri === 'Y') s.addG(this.inodes[0], 0, 1e-9); }
  stampAC(ac) { super.stampAC(ac); if (this.grp().pri === 'Y') ac.addY(this.inodes[0], 0, 1e-9); }
  valueLabel() { return this.p.group; }
  readings(s) {
    const v = (a, b) => s.v(this.nodes[a]) - s.v(this.nodes[b]);
    return [['V_AB (primary)', v(0, 1), 'V'], ['V_ab (secondary)', v(3, 4), 'V'], ['V_an', v(3, 6), 'V'],
      ['I_A', this.postCurrents[0], 'A'], ['I_a', -this.postCurrents[3], 'A'], ['I_n', -this.postCurrents[6], 'A']];
  }
  draw(g) {
    g.box(-2 * G, -2.5 * G, 2 * G, 2.5 * G, { stroke: g.body, width: g.lw * 0.9, fill: g.fill, r: 5 });
    const gr = this.grp();
    const sym = (cx, kind) => {
      if (kind === 'D') g.poly([[cx, -0.55 * G], [cx + 0.5 * G, 0.35 * G], [cx - 0.5 * G, 0.35 * G]], { stroke: g.accent, width: g.lw * 0.8, close: true });
      else { g.line(cx, 0, cx, -0.55 * G, g.accent, g.lw * 0.8); g.line(cx, 0, cx + 0.48 * G, 0.3 * G, g.accent, g.lw * 0.8); g.line(cx, 0, cx - 0.48 * G, 0.3 * G, g.accent, g.lw * 0.8); }
    };
    g.upright(() => {
      g.circle(-0.45 * G, 0, 0.95 * G, { stroke: g.body, width: g.lw * 0.8 });
      g.circle(0.45 * G, 0, 0.95 * G, { stroke: g.body, width: g.lw * 0.8 });
      sym(-0.6 * G, gr.pri); sym(0.6 * G, gr.sec);
    });
    ['A', 'B', 'C'].forEach((t, i) => g.text(t, -1.7 * G, (i - 1) * 2 * G - 0.4 * G, { size: 7, color: g.muted }));
    ['a', 'b', 'c', 'n'].forEach((t, i) => g.text(t, 1.7 * G, (i - 2) * G - 0.4 * G, { size: 7, color: g.muted }));
  }
}
register(ThreePhaseTransformer);

// ------------------------------------------------------- coupled inductors
export class CoupledInductors extends WindingDevice {
  static type = 'coupledl'; static title = 'Coupled Inductors (M)';
  static keywords = 'coupled inductors mutual inductance m k magnetic coupling wireless power';
  static props = [
    { key: 'l1', label: 'L1', unit: 'H', def: 1e-3, min: 1e-12, max: 1e4, log: true },
    { key: 'l2', label: 'L2', unit: 'H', def: 1e-3, min: 1e-12, max: 1e4, log: true },
    { key: 'k', label: 'Coupling coefficient k', unit: '', def: 0.5, min: 0, max: 0.9999, knob: true },
    { key: 'r1', label: 'R1', unit: 'Ω', def: 0.1, min: 0, max: 1e5 },
    { key: 'r2', label: 'R2', unit: 'Ω', def: 0.1, min: 0, max: 1e5 },
  ];
  static description = 'Two inductors with mutual inductance M = k·√(L1·L2) (dots mark the in-phase ends). Loosely coupled coils, wireless power, tuned transformers.';
  localPosts() { return [[-2 * G, -2 * G], [-2 * G, 2 * G], [2 * G, -2 * G], [2 * G, 2 * G]]; }
  localBox() { return [-2 * G, -2 * G, 2 * G, 2 * G]; }
  leads() { return [[0, -2 * G, -2 * G, -0.7 * G, -2 * G], [1, -2 * G, 2 * G, -0.7 * G, 2 * G], [2, 2 * G, -2 * G, 0.7 * G, -2 * G], [3, 2 * G, 2 * G, 0.7 * G, 2 * G]]; }
  windings() { return [[0, 1], [2, 3]]; }
  resist() { return [this.p.r1, this.p.r2]; }
  Lmat() { const M = this.p.k * Math.sqrt(this.p.l1 * this.p.l2); return [[this.p.l1, M], [M, this.p.l2]]; }
  valueLabel() { return `k=${+this.p.k.toFixed(3)}`; }
  readings(s) { return [['V1', this.wv(s, 0), 'V'], ['I1', this.W.i[0], 'A'], ['V2', this.wv(s, 1), 'V'], ['I2', this.W.i[1], 'A'], ['M', this.Lmat()[0][1], 'H']]; }
  draw(g) {
    g.line(-0.7 * G, -2 * G, -0.7 * G, -1.5 * G, g.vc(g.pv(0)), g.lw); g.line(-0.7 * G, 2 * G, -0.7 * G, 1.5 * G, g.vc(g.pv(1)), g.lw);
    g.line(0.7 * G, -2 * G, 0.7 * G, -1.5 * G, g.vc(g.pv(2)), g.lw); g.line(0.7 * G, 2 * G, 0.7 * G, 1.5 * G, g.vc(g.pv(3)), g.lw);
    this.coil(g, -0.7 * G, -1.5 * G, 1.5 * G, 1, 4, g.pv(0), g.pv(1));
    this.coil(g, 0.7 * G, -1.5 * G, 1.5 * G, -1, 4, g.pv(2), g.pv(3));
    g.circle(-1.25 * G, -1.6 * G, 2.4, { fill: g.body }); g.circle(1.25 * G, -1.6 * G, 2.4, { fill: g.body });
    g.upright(() => g.text('M', 0, 0, { size: 8, color: g.muted, bold: true }));
  }
}
register(CoupledInductors);

// the original generic transformer lives in the Transformers category too
Transformer.category = 'Transformers';
