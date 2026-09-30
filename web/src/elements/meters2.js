// More instruments: frequency meter, phase meter, power-factor meter, VAR
// meter, energy (kWh) meter, AC voltmeter / ammeter (true RMS), analog
// moving-coil voltmeter / ammeter / galvanometer with needle dynamics,
// insulation tester (megger), dB meter, LCR meter, peak voltmeter and a
// voltage test point.

import { Element, TwoTerm, register, GRID } from './base.js';
import { Voltmeter, Ammeter } from './meters.js';
import { CycleMeter, phaseDeg } from './kit.js';
import { fmtSI, fmtShort } from '../engine/units.js';

const G = GRID;
const TAU = 2 * Math.PI;

/** Upright rectangular display with a symbol and a reading. */
function display(g, sym, text, w = 1.5) {
  g.upright(() => {
    g.box(-w * G, -0.8 * G, w * G, 0.8 * G, { stroke: g.body, width: g.lw * 0.9, fill: g.bg, r: 6 });
    g.text(sym, -w * G + 0.28 * G, -0.46 * G, { size: 7.5, color: g.accent, bold: true, align: 'left', follow: false });
    g.text(text, 0, 0.18 * G, { size: 9, color: g.text1, bold: true, mono: true });
  });
}

/** High-impedance two-terminal instrument measuring the voltage across it. */
class VInstrument extends TwoTerm {
  static category = 'Meters';
  static prefix = 'MT';
  shortCheck = false;
  half() { return (this.rot & 1) ? [0.8 * G, 1.5 * G] : [1.5 * G, 0.8 * G]; }
  localBox() { const [, b] = this.half(); return [-2 * G, -b, 2 * G, b]; }
  leads() { const a = this.half()[0]; return [[0, -2 * G, 0, -a, 0], [1, 2 * G, 0, a, 0]]; }
  stamp(s) { s.addG(this.nodes[0], this.nodes[1], 1e-7); }
  stampAC(ac) { ac.addY(this.nodes[0], this.nodes[1], 1e-7); }
  liveCurrent() { return null; }
  valueLabel() { return ''; }
  plus(g) { const a = this.half()[0]; g.text('+', -a - 0.35 * G, -0.45 * G, { size: 9, color: g.pos, bold: true }); }
}

export class FrequencyMeter extends VInstrument {
  static type = 'freqmeter'; static title = 'Frequency Meter'; static keywords = 'frequency meter counter hz period';
  static props = [{ key: 'digits', label: 'Digits', unit: '', def: 5, min: 3, max: 7 }];
  static description = 'Counts the period of the voltage across it (AC coupled, zero-crossing with hysteresis) and shows the frequency and period.';
  reset() { this.m = new CycleMeter(0.2); this.setCurrent(0); }
  accept(s) { this.setCurrent(this.voltageDiff(s) * 1e-7); if (s.mode !== 'dc') this.m.push(s.t, s.dt, this.voltageDiff(s)); }
  readings() { return [['Frequency', this.m?.f || 0, 'Hz'], ['Period', this.m?.f ? 1 / this.m.f : 0, 's'], ['RMS', this.m?.vrms || 0, 'V']]; }
  draw(g) { display(g, 'Hz', g.running && this.m?.f ? fmtSI(this.m.f, 'Hz', Math.round(this.p.digits)) : '— Hz'); this.plus(g); }
}
register(FrequencyMeter);

export class DBMeter extends VInstrument {
  static type = 'dbmeter'; static title = 'dB Meter (AC level)'; static keywords = 'db meter decibel dbv dbu audio level meter gain';
  static props = [{ key: 'ref', label: 'Reference', type: 'select', def: 'dBV', options: [['dBV', 'dBV (1 V)'], ['dBu', 'dBu (0.775 V)'], ['dBm600', 'dBm (600 Ω)']] }];
  static description = 'True-RMS AC level in decibels: dBV = 20·log10(Vrms / 1 V), dBu relative to 0.775 V.';
  reset() { this.m = new CycleMeter(0.2); this.setCurrent(0); }
  accept(s) { this.setCurrent(this.voltageDiff(s) * 1e-7); if (s.mode !== 'dc') this.m.push(s.t, s.dt, this.voltageDiff(s)); }
  db() { const ac = Math.sqrt(Math.max(0, (this.m?.vrms || 0) ** 2 - (this.m?.vmean || 0) ** 2)); return 20 * Math.log10(Math.max(ac, 1e-9) / (this.p.ref === 'dBV' ? 1 : 0.775)); }
  readings() { return [['Level', this.db(), this.p.ref === 'dBm600' ? 'dBm' : this.p.ref], ['RMS (AC)', Math.pow(10, this.db() / 20) * (this.p.ref === 'dBV' ? 1 : 0.775), 'V']]; }
  draw(g) { display(g, 'dB', g.running ? `${this.db().toFixed(1)} ${this.p.ref.replace('600', '')}` : '— dB'); this.plus(g); }
}
register(DBMeter);

export class PeakVoltmeter extends VInstrument {
  static type = 'peakvolt'; static title = 'Peak Voltmeter (hold)'; static keywords = 'peak voltmeter peak hold maximum voltage surge';
  static description = 'Holds the largest |V| seen since the start (tap to reset).';
  interactive = true;
  reset() { this.pk = 0; this.setCurrent(0); }
  accept(s) { const v = this.voltageDiff(s); this.setCurrent(v * 1e-7); this.pk = Math.max(this.pk || 0, Math.abs(v)); }
  onTap() { this.pk = 0; return true; }
  readings(s) { return [['Peak |V|', this.pk || 0, 'V'], ['Now', this.voltageDiff(s), 'V']]; }
  draw(g) { display(g, 'Vpk', g.running ? fmtSI(this.pk || 0, 'V', 4) : '— V'); this.plus(g); }
}
register(PeakVoltmeter);

export class PhaseMeter extends Element {
  static type = 'phasemeter'; static title = 'Phase Meter'; static category = 'Meters';
  static prefix = 'MT'; static keywords = 'phase meter phase angle difference degrees lead lag synchroscope';
  static description = 'Phase of SIG relative to REF (both measured to COM), from zero-crossing times: positive = SIG leads. Also shows the frequency.';
  constructor(x, y) { super(x, y); this.postCurrents = [0, 0, 0]; }
  // 0: REF, 1: SIG, 2: COM
  localPosts() { return [[-2 * G, -G], [-2 * G, G], [2 * G, 0]]; }
  localBox() { return [-2 * G, -1.4 * G, 2 * G, 1.4 * G]; }
  leads() { const a = (this.rot & 1) ? 0.8 * G : 1.4 * G; return [[0, -2 * G, -G, -a, -G], [1, -2 * G, G, -a, G], [2, 2 * G, 0, a, 0]]; }
  stamp(s) { const [r, sg, c] = this.nodes; s.addG(r, c, 1e-7); s.addG(sg, c, 1e-7); }
  stampAC(ac) { const [r, sg, c] = this.nodes; ac.addY(r, c, 1e-7); ac.addY(sg, c, 1e-7); }
  reset() { this.ma = new CycleMeter(0.2); this.mb = new CycleMeter(0.2); }
  accept(s) {
    const [r, sg, c] = this.nodes;
    if (s.mode === 'dc') return;
    this.ma.push(s.t, s.dt, s.v(r) - s.v(c)); this.mb.push(s.t, s.dt, s.v(sg) - s.v(c));
  }
  phase() { return this.ma ? phaseDeg(this.ma, this.mb) : NaN; }
  liveCurrent() { return null; }
  valueLabel() { return ''; }
  readings() { const p = this.phase(); return [['Phase (SIG vs REF)', Number.isFinite(p) ? p : 0, '°'], ['Relation', !Number.isFinite(p) ? '—' : Math.abs(p) < 1 ? 'in phase' : p > 0 ? 'SIG leads' : 'SIG lags', ''], ['Frequency', this.ma?.f || 0, 'Hz']]; }
  draw(g) {
    const p = this.phase();
    display(g, 'φ', g.running && Number.isFinite(p) ? `${p >= 0 ? '+' : ''}${p.toFixed(1)}°` : '— °', 1.4);
    g.text('R', -1.75 * G, -1.35 * G, { size: 6.5, color: g.muted }); g.text('S', -1.75 * G, 0.65 * G, { size: 6.5, color: g.muted });
  }
}
register(PhaseMeter);

const W_PWR = 1.7;

/** Wattmeter-style power instruments: current path (left → right) + voltage sense (bottom = neutral). */
class PowerInstrument extends Element {
  static category = 'Meters';
  static prefix = 'MT';
  constructor(x, y) { super(x, y); this.postCurrents = [0, 0, 0]; }
  localPosts() { return [[-2 * G, 0], [2 * G, 0], [0, 2 * G]]; }
  // the display is drawn upright, so its extent along the leads depends on rotation
  half() { return (this.rot & 1) ? [0.8 * G, W_PWR * G] : [W_PWR * G, 0.8 * G]; }
  localBox() { const b = this.half()[1]; return [-2 * G, -b, 2 * G, 2 * G]; }
  leads() { const [a, b] = this.half(); return [[0, -2 * G, 0, -a, 0], [1, 2 * G, 0, a, 0], [2, 0, 2 * G, 0, b]]; }
  branchCount() { return 1; }
  reset() { this.m = new CycleMeter(0.2); this.mi = new CycleMeter(0.2); this.e = 0; this.postCurrents.fill(0); }
  stamp(s) { const k = this.branches[0], [a, b, n] = this.nodes; s.addBranchKCL(a, b, k); s.addA(k, a - 1, 1); s.addA(k, b - 1, -1); s.addG(b, n, 1e-7); }
  stampAC(ac) { const k = this.branches[0], [a, b, n] = this.nodes; ac.addBranchKCL(a, b, k); ac.addA(k, a - 1, 1); ac.addA(k, b - 1, -1); ac.addY(b, n, 1e-7); }
  accept(s) {
    const i = s.x[this.branches[0]], [, b, n] = this.nodes, v = s.v(b) - s.v(n);
    this.postCurrents = [i, -i, 0]; this.i = i;
    if (s.mode === 'dc') { this.pdc = v * i; return; }
    this.m.push(s.t, s.dt, v, i); this.mi.push(s.t, s.dt, i);
    this.e += v * i * s.dt;
  }
  liveCurrent() { return null; }
  valueLabel() { return ''; }
  P() { return this.m ? this.m.pavg : 0; }
  S() { return this.m ? this.m.vrms * this.m.irms : 0; }
  lagging() { const p = this.m && this.mi ? phaseDeg(this.m, this.mi) : NaN; return Number.isFinite(p) ? p < 0 : true; } // current lags voltage
  Q() { const P = this.P(), S = this.S(); return Math.sqrt(Math.max(0, S * S - P * P)) * (this.lagging() ? 1 : -1); }
  PF() { const S = this.S(); return S > 1e-12 ? Math.min(1, Math.abs(this.P()) / S) : 1; }
}

export class PFMeter extends PowerInstrument {
  static type = 'pfmeter'; static title = 'Power Factor Meter'; static keywords = 'power factor meter pf cos phi lagging leading';
  static description = 'Power factor = P / (Vrms·Irms) with lag/lead indication. Current path left → right, voltage sensed between the output side and the bottom (neutral) terminal.';
  readings() { return [['Power factor', this.PF(), ''], ['Type', this.lagging() ? 'lagging (inductive)' : 'leading (capacitive)', ''], ['Angle φ', (Math.acos(this.PF()) * 180) / Math.PI, '°'], ['P', this.P(), 'W'], ['S', this.S(), 'VA']]; }
  draw(g) { display(g, 'cosφ', g.running && this.S() > 1e-9 ? `${this.PF().toFixed(3)} ${this.lagging() ? 'lag' : 'lead'}` : '—', W_PWR); }
}
register(PFMeter);

export class VARMeter extends PowerInstrument {
  static type = 'varmeter'; static title = 'VAR Meter (Reactive Power)'; static keywords = 'var meter reactive power kvar varmeter';
  static description = 'Reactive power Q = ±√(S² − P²) (positive for inductive / lagging loads). Same connections as the wattmeter.';
  readings() { return [['Reactive power Q', this.Q(), 'VAR'], ['Real power P', this.P(), 'W'], ['Apparent power S', this.S(), 'VA']]; }
  draw(g) { display(g, 'VAR', g.running ? fmtSI(this.Q(), 'VAR', 4) : '— VAR', W_PWR); }
}
register(VARMeter);

export class EnergyMeter extends PowerInstrument {
  static type = 'kwh'; static title = 'Energy Meter (kWh)'; static keywords = 'energy meter kwh watt hour meter electricity meter units billing';
  static description = 'Integrates real power over time: E = ∫v·i dt, shown in Wh / kWh (1 unit = 1 kWh), plus the present power.';
  interactive = true;
  onTap() { this.e = 0; return true; }
  readings() { return [['Energy', (this.e || 0) / 3.6e6, 'kWh'], ['Energy', (this.e || 0) / 3600, 'Wh'], ['Power', this.P(), 'W']]; }
  draw(g) {
    const wh = (this.e || 0) / 3600;
    display(g, 'kWh', g.running ? (wh < 1000 ? `${wh.toFixed(wh < 1 ? 4 : 2)} Wh` : `${(wh / 1000).toFixed(3)} kWh`) : '0.000 kWh', W_PWR);
  }
}
register(EnergyMeter);

// -------------------------------------------------------------- AC presets
export class ACVoltmeter extends Voltmeter {
  static type = 'acvolt'; static title = 'AC Voltmeter (True RMS)';
  static keywords = 'ac voltmeter rms voltage meter mains multimeter';
  static props = Voltmeter.props.map((p) => (p.key === 'mode' ? { ...p, def: 'rms' } : p));
  static description = 'Voltmeter preset to true-RMS reading (averaging time 100 ms).';
}
register(ACVoltmeter);

export class ACAmmeter extends Ammeter {
  static type = 'acamp'; static title = 'AC Ammeter (True RMS)';
  static keywords = 'ac ammeter rms current meter clamp meter';
  static props = Ammeter.props.map((p) => (p.key === 'mode' ? { ...p, def: 'rms' } : p));
  static description = 'Ammeter preset to true-RMS reading. Place it in series.';
}
register(ACAmmeter);

// ------------------------------------------------------ analog needle meters
class NeedleMeter extends TwoTerm {
  static category = 'Meters';
  static prefix = 'MT';
  shortCheck = false;
  static kind = 'V';
  constructor(x, y) { super(x, y); this.th = 0; this.w = 0; }
  localBox() { return [-2 * G, -1.2 * G, 2 * G, 1.2 * G]; }
  leads() { const a = (this.rot & 1) ? 1.1 * G : 1.2 * G; return [[0, -2 * G, 0, -a, 0], [1, 2 * G, 0, a, 0]]; }
  R() { return 1; }
  fs() { return 1; }
  centre() { return false; }
  stamp(s) { s.addG(this.nodes[0], this.nodes[1], 1 / this.R()); }
  stampAC(ac) { ac.addY(this.nodes[0], this.nodes[1], 1 / this.R()); }
  reset() { this.th = 0; this.w = 0; this.setCurrent(0); }
  accept(s) {
    const i = this.voltageDiff(s) / this.R();
    this.setCurrent(i);
    if (s.mode === 'dc') { this.th = this.defl(i); return; }
    // moving-coil movement: 2nd order, fn ≈ 1.5 Hz, ζ = 0.7 (responds to the average current)
    const wn = TAU * 1.5, z = 0.7, target = this.defl(i);
    const a = wn * wn * (target - this.th) - 2 * z * wn * this.w;
    this.w += a * s.dt; this.th += this.w * s.dt;
  }
  defl(i) { const x = this.reading(i) / this.fs(); return this.centre() ? Math.max(-1.1, Math.min(1.1, x)) : Math.max(-0.05, Math.min(1.1, x)); }
  reading(i) { return i; }
  liveCurrent() { return this.constructor.kind === 'A' ? this.i : null; }
  valueLabel() { return `${fmtShort(this.fs(), this.constructor.unit)} FS`; }
  readings(s) { return [['Needle reading', this.th * this.fs(), this.constructor.unit], ['Actual', this.reading(this.i || 0), this.constructor.unit], ['Meter resistance', this.R(), 'Ω']]; }
  draw(g) {
    g.upright(() => {
      const ctx = g.ctx, R = 1.1 * G, cy = 0.85 * G;
      g.box(-1.2 * G, -1.1 * G, 1.2 * G, 1.1 * G, { stroke: g.body, width: g.lw * 0.9, fill: '#f8fafc', r: 5 });
      ctx.beginPath(); ctx.arc(0, cy, R, Math.PI * 1.2, Math.PI * 1.8); ctx.strokeStyle = '#334155'; ctx.lineWidth = 1; ctx.stroke();
      for (let k = 0; k <= 10; k++) {
        const a = Math.PI * (1.2 + 0.06 * k), r1 = k % 5 ? R - 3 : R - 6;
        g.line(Math.cos(a) * r1, cy + Math.sin(a) * r1, Math.cos(a) * R, cy + Math.sin(a) * R, '#334155', 1);
      }
      const f = this.centre() ? (this.th + 1) / 2 : this.th;
      const a = Math.PI * (1.2 + 0.6 * Math.max(-0.05, Math.min(1.08, f)));
      g.line(0, cy, Math.cos(a) * (R + 2), cy + Math.sin(a) * (R + 2), '#dc2626', 1.4);
      g.circle(0, cy, 2.2, { fill: '#334155' });
      g.text(this.constructor.sym, 0, 0.25 * G, { size: 8, color: '#0f172a', bold: true });
    });
    g.text('+', -1.5 * G, -0.45 * G, { size: 9, color: g.pos, bold: true });
  }
}

export class AnalogVoltmeter extends NeedleMeter {
  static type = 'mcvolt'; static title = 'Analog Voltmeter (moving coil)'; static kind = 'V'; static unit = 'V'; static sym = 'V';
  static keywords = 'analog voltmeter moving coil pmmc needle meter ohms per volt';
  static props = [{ key: 'fs', label: 'Full scale', unit: 'V', def: 10, min: 1e-3, max: 1e5, log: true, knob: true }, { key: 'opv', label: 'Sensitivity', unit: 'Ω/V', def: 20000, min: 10, max: 1e6, log: true }];
  static description = 'PMMC voltmeter with a needle: finite input resistance (Ω/V × full scale) loads the circuit — a classic source of measurement error. Reads the average voltage.';
  R() { return this.p.opv * this.p.fs; }
  fs() { return this.p.fs; }
  reading(i) { return i * this.R(); }
}
register(AnalogVoltmeter);

export class AnalogAmmeter extends NeedleMeter {
  static type = 'mcamp'; static title = 'Analog Ammeter (moving coil)'; static kind = 'A'; static unit = 'A'; static sym = 'A';
  static keywords = 'analog ammeter moving coil pmmc needle shunt';
  static props = [{ key: 'fs', label: 'Full scale', unit: 'A', def: 1, min: 1e-6, max: 1e4, log: true, knob: true }, { key: 'burden', label: 'Burden voltage at FS', unit: 'V', def: 0.075, min: 1e-4, max: 10 }];
  static description = 'PMMC ammeter with shunt: resistance = burden / full-scale current (75 mV shunt), needle shows the average current.';
  R() { return this.p.burden / this.p.fs; }
  fs() { return this.p.fs; }
}
register(AnalogAmmeter);

export class Galvanometer extends NeedleMeter {
  static type = 'galvo'; static title = 'Galvanometer (centre-zero)'; static kind = 'A'; static unit = 'A'; static sym = 'G';
  static keywords = 'galvanometer centre zero null detector wheatstone bridge balance';
  static props = [{ key: 'fs', label: 'Full scale (±)', unit: 'A', def: 50e-6, min: 1e-9, max: 1, log: true, knob: true }, { key: 'rm', label: 'Coil resistance', unit: 'Ω', def: 100, min: 0.1, max: 1e6, log: true }];
  static description = 'Centre-zero galvanometer: deflects either way — the null detector of a Wheatstone bridge or potentiometer.';
  R() { return this.p.rm; }
  fs() { return this.p.fs; }
  centre() { return true; }
}
register(Galvanometer);

// ------------------------------------------------------------ test sets
export class Megger extends TwoTerm {
  static type = 'megger'; static title = 'Insulation Tester (Megger)'; static category = 'Meters';
  static prefix = 'MT'; static keywords = 'megger insulation resistance tester 500v 1000v earth leakage cable test';
  static props = [{ key: 'vt', label: 'Test voltage', unit: 'V', def: 500, min: 50, max: 5000, knob: true }, { key: 'rs', label: 'Internal resistance', unit: 'Ω', def: 1e5, min: 1, max: 1e9, log: true }];
  static description = 'Applies a high DC test voltage (500 V / 1 kV) through its internal resistance and displays the insulation resistance R = V / I (up to GΩ). Use on de-energised circuits only.';
  refNode = 1;
  shortCheck = false;
  branchCount() { return 1; }
  stamp(s) { const k = this.branches[0], [a, b] = this.nodes; s.addBranchKCL(a, b, k); s.addA(k, a - 1, 1); s.addA(k, b - 1, -1); s.addA(k, k, -this.p.rs); }
  stampStep(s) { s.b[this.branches[0]] += this.p.vt * (s.srcScale ?? 1); }
  accept(s) { this.setCurrent(s.x[this.branches[0]]); this.lastRes = this.res(s); }
  stampAC(ac) { const k = this.branches[0], [a, b] = this.nodes; ac.addBranchKCL(a, b, k); ac.addA(k, a - 1, 1); ac.addA(k, b - 1, -1); ac.addA(k, k, -this.p.rs); }
  res(s) { const v = this.voltageDiff(s), i = -this.i; return Math.abs(i) < 1e-13 ? Infinity : v / i; }
  liveCurrent() { return null; }
  valueLabel() { return fmtShort(this.p.vt, 'V'); }
  readings(s) { return [['Insulation resistance', this.res(s), 'Ω'], ['Test voltage at terminals', this.voltageDiff(s), 'V'], ['Leakage current', -this.i, 'A']]; }
  half() { return (this.rot & 1) ? [0.8 * G, 1.5 * G] : [1.5 * G, 0.8 * G]; }
  localBox() { const [, b] = this.half(); return [-2 * G, -b, 2 * G, b]; }
  leads() { const a = this.half()[0]; return [[0, -2 * G, 0, -a, 0], [1, 2 * G, 0, a, 0]]; }
  draw(g) {
    const v = this.lastRes;
    display(g, 'MΩ', g.running && v !== undefined ? (v === Infinity || v > 1e12 ? '> 1 TΩ' : fmtSI(v, 'Ω', 3)) : '— Ω');
  }
}
register(Megger);

export class LCRMeter extends TwoTerm {
  static type = 'lcr'; static title = 'LCR Meter'; static category = 'Meters';
  static prefix = 'MT'; static keywords = 'lcr meter impedance analyzer capacitance meter inductance meter esr';
  static props = [
    { key: 'f', label: 'Test frequency', unit: 'Hz', def: 1000, min: 1, max: 1e7, log: true, knob: true },
    { key: 'i0', label: 'Test current (peak)', unit: 'A', def: 1e-3, min: 1e-9, max: 1, log: true },
  ];
  static description = 'Drives a small sinusoidal test current through the component and synchronously detects the voltage: Z = R + jX, shown as C (X < 0) or L (X > 0). Connect it across an isolated component.';
  shortCheck = false;
  reset() { this.si = 0; this.co = 0; this.setCurrent(0); }
  stamp(s) { s.addG(this.nodes[0], this.nodes[1], 1e-12); }
  stampStep(s) {
    const t = s.mode === 'dc' ? 0 : s.tNext;
    // current flows out of + (node 0) into the component and returns to −
    s.addI(this.nodes[1], this.nodes[0], this.p.i0 * Math.sin(TAU * this.p.f * t));
  }
  accept(s) {
    this.setCurrent(-this.p.i0 * Math.sin(TAU * this.p.f * s.t));
    if (s.mode === 'dc') return;
    const v = this.voltageDiff(s), ph = TAU * this.p.f * s.t, a = Math.min(1, s.dt * this.p.f / 5);
    this.si += (v * Math.sin(ph) - this.si) * a;
    this.co += (v * Math.cos(ph) - this.co) * a;
  }
  Z() { return { r: (2 * this.si) / this.p.i0, x: (2 * this.co) / this.p.i0 }; }
  stampAC() {}
  liveCurrent() { return null; }
  valueLabel() { return fmtShort(this.p.f, 'Hz'); }
  text() {
    const { r, x } = this.Z(), w = TAU * this.p.f;
    if (Math.abs(x) < 1e-3 * Math.max(Math.abs(r), 1e-9)) return fmtSI(r, 'Ω', 4);
    return x < 0 ? fmtSI(-1 / (w * x), 'F', 4) : fmtSI(x / w, 'H', 4);
  }
  readings() {
    const { r, x } = this.Z(), w = TAU * this.p.f;
    return [['R (series)', r, 'Ω'], ['X', x, 'Ω'], ['|Z|', Math.hypot(r, x), 'Ω'], ['C (if capacitive)', x < 0 ? -1 / (w * x) : 0, 'F'], ['L (if inductive)', x > 0 ? x / w : 0, 'H'], ['Q', Math.abs(r) > 1e-12 ? Math.abs(x / r) : Infinity, '']];
  }
  half() { return (this.rot & 1) ? [0.8 * G, 1.5 * G] : [1.5 * G, 0.8 * G]; }
  localBox() { const [, b] = this.half(); return [-2 * G, -b, 2 * G, b]; }
  leads() { const a = this.half()[0]; return [[0, -2 * G, 0, -a, 0], [1, 2 * G, 0, a, 0]]; }
  draw(g) { display(g, 'LCR', g.running ? this.text() : '—'); }
}
register(LCRMeter);

export class TestPoint extends Element {
  static type = 'testpoint'; static title = 'Test Point (voltage tag)'; static category = 'Meters';
  static prefix = 'TP'; static keywords = 'test point voltage probe tag node voltage label measure';
  static props = [{ key: 'name', label: 'Tag', type: 'text', def: 'TP' }];
  static description = 'Single-terminal tag that displays the node voltage (relative to ground) next to its name. Draws no current.';
  static noName = true;
  constructor(x, y) { super(x, y); this.postCurrents = [0]; }
  localPosts() { return [[0, 0]]; }
  localBox() {
    // the tag is drawn upright, so express its fixed world-space box in local coordinates
    const up = [[-4, -1.6 * G], [3.4 * G, 4]], pts = up.map(([wx, wy]) => this.toLocal(this.x + wx, this.y + wy));
    return [Math.min(pts[0][0], pts[1][0]), Math.min(pts[0][1], pts[1][1]), Math.max(pts[0][0], pts[1][0]), Math.max(pts[0][1], pts[1][1])];
  }
  leads() { return []; }
  accept(s) { this.v = s.v(this.nodes[0]); }
  liveCurrent() { return null; }
  valueLabel() { return ''; }
  readings(s) { return [['Voltage', s.v(this.nodes[0]), 'V']]; }
  draw(g) {
    g.upright(() => {
      g.poly([[0.4 * G, -0.4 * G], [0.7 * G, -1.4 * G], [3.3 * G, -1.4 * G], [3.3 * G, -0.6 * G], [0.7 * G, -0.6 * G]], { stroke: g.accent, width: g.lw * 0.8, fill: g.bg, close: true });
      g.text(`${this.p.name}: ${g.running ? fmtSI(this.v ?? 0, 'V', 4) : '—'}`, 2 * G, -G, { size: 8, color: g.text1, bold: true, mono: true });
    });
  }
}
register(TestPoint);
