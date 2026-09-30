// Measurement instruments and annotations.

import { Element, TwoTerm, register, GRID } from './base.js';
import { fmtSI } from '../engine/units.js';

const G = GRID;

export class Meter extends TwoTerm {
  static category = 'Meters';
  shortCheck = false;
  reset() { this.acc = 0; this.acc2 = 0; this.shown = 0; this.win = null; this.setCurrent(0); }
  track(s, x) {
    // exponential moving averages for DC (mean) and RMS readings
    if (s.mode === 'dc') { this.acc = x; this.acc2 = x * x; this.win = null; return; }
    const a = Math.min(1, s.dt / Math.max(this.p.tau ?? 0.1, s.dt));
    this.acc += (x - this.acc) * a;
    this.acc2 += (x * x - this.acc2) * a;
    // Auto mode in an AC circuit: exact RMS over the last supply cycle
    this.acPeriod = s.acPeriod || 0;
    if (this.p.mode === 'auto' && this.acPeriod > 0) this.windowAdd(x * x * s.dt, x * s.dt, s.dt, this.acPeriod);
  }
  windowAdd(q, l, dt, T) {
    let w = this.win;
    const mk = (n) => ({ q: new Float64Array(n), l: new Float64Array(n), d: new Float64Array(n) });
    if (!w || w.T !== T) w = this.win = { T, ...mk(256), head: 0, n: 0, sum: 0, lin: 0, span: 0 };
    if (w.n === w.q.length) { // grow the ring
      const b = mk(w.n * 2);
      for (let k = 0; k < w.n; k++) { const j = (w.head + k) % w.n; b.q[k] = w.q[j]; b.l[k] = w.l[j]; b.d[k] = w.d[j]; }
      Object.assign(w, b); w.head = 0;
    }
    const slot = (w.head + w.n) % w.q.length;
    w.q[slot] = q; w.l[slot] = l; w.d[slot] = dt; w.n++; w.sum += q; w.lin += l; w.span += dt;
    while (w.n > 1 && w.span - w.d[w.head] >= T) {
      w.sum -= w.q[w.head]; w.lin -= w.l[w.head]; w.span -= w.d[w.head]; w.head = (w.head + 1) % w.q.length; w.n--;
    }
  }
  /** Auto mode over a full cycle: { v, ac } — average for mostly-DC signals, RMS for AC ones. */
  autoReading() {
    const w = this.win;
    if (!(this.acPeriod > 0) || !w || w.span < w.T * 0.999) return null;
    const r = Math.sqrt(Math.max(0, w.sum) / w.span), m = w.lin / w.span;
    return Math.abs(m) >= 0.7 * r ? { v: m, ac: false } : { v: r, ac: true };
  }
  /** true when the reading shown is an RMS value */
  showsRms() { if (this.p.mode === 'rms') return true; const a = this.p.mode === 'auto' && this.autoReading(); return !!(a && a.ac); }
  display(x) {
    switch (this.p.mode) {
      case 'avg': return this.acc;
      case 'rms': return Math.sqrt(Math.max(0, this.acc2));
      case 'auto': {
        if (!(this.acPeriod > 0)) return x;
        const a = this.autoReading();
        return a ? a.v : x; // instantaneous until a whole cycle has run
      }
      default: return x;
    }
  }
  valueLabel() { return ''; }
  liveCurrent() { return null; } // the display already shows the reading
  // The display is always drawn upright, so its extent along the leads depends on rotation.
  half() { return (this.rot & 1) ? [0.8 * G, 1.4 * G] : [1.4 * G, 0.8 * G]; }
  localBox() { const [a, b] = this.half(); return [-2 * G, -b, 2 * G, b]; }
  leads() { const a = this.half()[0]; return [[0, -2 * G, 0, -a, 0], [1, 2 * G, 0, a, 0]]; }
  drawMeter(g, sym, value, unit) {
    g.upright(() => {
      g.box(-1.4 * G, -0.8 * G, 1.4 * G, 0.8 * G, { stroke: g.body, width: g.lw * 0.9, fill: g.bg, r: 6 });
      g.text(sym, -1.12 * G, -0.46 * G, { size: 8, color: g.accent, bold: true });
      const m = this.showsRms() ? 'RMS' : this.p.mode === 'avg' ? 'AVG' : '';
      if (m) g.text(m, 1.15 * G, -0.46 * G, { size: 6, color: g.muted, align: 'right', follow: false });
      g.text(g.running ? fmtSI(value, unit, 4) : '— ' + unit, 0, 0.18 * G, { size: 9, color: g.text1, bold: true, mono: true });
    });
    const a = this.half()[0];
    g.text('+', -a - 0.35 * G, -0.45 * G, { size: 9, color: g.pos, bold: true });
  }
}

const MODE = { key: 'mode', label: 'Reading', type: 'select', def: 'auto', options: [['auto', 'Auto (RMS in AC circuits)'], ['inst', 'Instantaneous'], ['avg', 'Average (DC)'], ['rms', 'True RMS (moving)']] };
const TAU = { key: 'tau', label: 'Averaging time', unit: 's', def: 0.1, min: 1e-6, max: 100, log: true };

export class Voltmeter extends Meter {
  static type = 'voltmeter'; static title = 'Voltmeter'; static prefix = 'VM';
  static keywords = 'voltmeter voltage meter multimeter dmm';
  static props = [MODE, TAU, { key: 'rin', label: 'Input resistance (0 = ideal)', unit: 'Ω', def: 0, min: 0, max: 1e12 }];
  static description = 'Measures the voltage between + (left) and − (right). Ideal (infinite impedance) unless an input resistance is set.';
  stamp(s) { if (this.p.rin > 0) s.addG(this.nodes[0], this.nodes[1], 1 / this.p.rin); }
  stampAC(ac) { if (this.p.rin > 0) ac.addY(this.nodes[0], this.nodes[1], 1 / this.p.rin); }
  accept(s) {
    const v = this.voltageDiff(s);
    this.setCurrent(this.p.rin > 0 ? v / this.p.rin : 0);
    this.v = v; this.track(s, v);
  }
  readings(s) { return [['Reading', this.display(this.v ?? 0), 'V']]; }
  draw(g) { this.drawMeter(g, 'V', this.display(this.v ?? 0), 'V'); }
}
register(Voltmeter);

export class Ammeter extends Meter {
  static type = 'ammeter'; static title = 'Ammeter'; static prefix = 'AM';
  static keywords = 'ammeter current meter multimeter';
  static props = [MODE, TAU, { key: 'rsh', label: 'Shunt resistance (0 = ideal)', unit: 'Ω', def: 0, min: 0, max: 1e6 }];
  static description = 'Measures current flowing in at + (left) and out at − (right). Place it in series.';
  branchCount() { return 1; }
  stamp(s) {
    const k = this.branches[0], [a, b] = this.nodes;
    s.addBranchKCL(a, b, k); s.addA(k, a - 1, 1); s.addA(k, b - 1, -1);
    if (this.p.rsh > 0) s.addA(k, k, -this.p.rsh);
  }
  stampAC(ac) {
    const k = this.branches[0], [a, b] = this.nodes;
    ac.addBranchKCL(a, b, k); ac.addA(k, a - 1, 1); ac.addA(k, b - 1, -1);
    if (this.p.rsh > 0) ac.addA(k, k, -this.p.rsh);
  }
  accept(s) { const i = s.x[this.branches[0]]; this.setCurrent(i); this.track(s, i); }
  readings() { return [['Reading', this.display(this.i), 'A']]; }
  spice(n) { return `V${this.name} ${n[0]} ${n[1]} 0 ; ammeter`; }
  draw(g) { this.drawMeter(g, 'A', this.display(this.i), 'A'); }
}
register(Ammeter);

export class Ohmmeter extends Meter {
  static type = 'ohmmeter'; static title = 'Ohmmeter'; static prefix = 'OM';
  static keywords = 'ohmmeter resistance meter continuity';
  static props = [{ key: 'itest', label: 'Test current', unit: 'A', def: 1e-3, min: 1e-9, max: 1, log: true }];
  static description = 'Measures resistance by injecting a small test current. Only valid in circuits with no other active sources.';
  stampStep(s) { s.addI(this.nodes[1], this.nodes[0], this.p.itest); }
  accept(s) { this.v = this.voltageDiff(s); this.setCurrent(-this.p.itest); }
  display() { const r = (this.v ?? 0) / this.p.itest; return r > 1e9 ? Infinity : r; }
  readings() { return [['Resistance', this.display(), 'Ω']]; }
  draw(g) { this.drawMeter(g, 'Ω', this.display(), 'Ω'); }
}
register(Ohmmeter);

export class Wattmeter extends Element {
  static type = 'wattmeter'; static title = 'Wattmeter'; static category = 'Meters';
  static prefix = 'WM'; static keywords = 'wattmeter power meter energy';
  static props = [{ key: 'tau', label: 'Averaging time', unit: 's', def: 0.1, min: 1e-6, max: 100, log: true }];
  static description = 'Series current path (left → right) and voltage sense from the current path to the bottom terminal. Shows average power P = ⟨v·i⟩.';
  constructor(x, y) { super(x, y); this.postCurrents = [0, 0, 0]; }
  localPosts() { return [[-2 * G, 0], [2 * G, 0], [0, 2 * G]]; }
  half() { return (this.rot & 1) ? [0.8 * G, 1.4 * G] : [1.4 * G, 0.8 * G]; }
  localBox() { const b = this.half()[1]; return [-2 * G, -b, 2 * G, 2 * G]; }
  leads() { const [a, b] = this.half(); return [[0, -2 * G, 0, -a, 0], [1, 2 * G, 0, a, 0], [2, 0, 2 * G, 0, b]]; }
  branchCount() { return 1; }
  valueLabel() { return ''; }
  reset() { this.pavg = 0; this.pinst = 0; }
  stamp(s) { const k = this.branches[0], [a, b] = this.nodes; s.addBranchKCL(a, b, k); s.addA(k, a - 1, 1); s.addA(k, b - 1, -1); }
  stampAC(ac) { const k = this.branches[0], [a, b] = this.nodes; ac.addBranchKCL(a, b, k); ac.addA(k, a - 1, 1); ac.addA(k, b - 1, -1); }
  accept(s) {
    const i = s.x[this.branches[0]];
    this.postCurrents = [i, -i, 0]; this.i = i;
    this.pinst = (s.v(this.nodes[1]) - s.v(this.nodes[2])) * i;
    if (s.mode === 'dc') this.pavg = this.pinst;
    else this.pavg += (this.pinst - this.pavg) * Math.min(1, s.dt / this.p.tau);
  }
  readings() { return [['Average power', this.pavg, 'W'], ['Instantaneous', this.pinst, 'W'], ['Current', this.i, 'A']]; }
  draw(g) {
    g.upright(() => {
      g.box(-1.4 * G, -0.8 * G, 1.4 * G, 0.8 * G, { stroke: g.body, width: g.lw * 0.9, fill: g.bg, r: 6 });
      g.text('W', -1.12 * G, -0.46 * G, { size: 8, color: g.accent, bold: true });
      g.text(g.running ? fmtSI(this.pavg, 'W', 4) : '— W', 0, 0.18 * G, { size: 9, color: g.text1, bold: true, mono: true });
    });
  }
}
register(Wattmeter);

export class Label extends Element {
  static type = 'label'; static title = 'Text Label'; static category = 'Meters';
  static prefix = 'TXT'; static keywords = 'text label note annotation comment';
  static props = [
    { key: 'text', label: 'Text', type: 'text', def: 'Label' },
    { key: 'size', label: 'Size', unit: 'px', def: 14, min: 6, max: 72 },
  ];
  static description = 'Free text annotation for documenting your circuit.';
  static noName = true;
  localPosts() { return []; }
  localBox() {
    // the text is always drawn upright, so the box must not rotate with the part
    const w = Math.max(12, String(this.p.text).length * this.p.size * 0.3), h = this.p.size * 0.7;
    return (this.rot & 1) ? [-h, -w, h, w] : [-w, -h, w, h];
  }
  leads() { return []; }
  valueLabel() { return ''; }
  readings() { return []; }
  draw(g) { g.text(String(this.p.text), 0, 0, { size: this.p.size, color: g.text1, bold: false, upright: true }); }
}
register(Label);
