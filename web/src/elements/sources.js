// Independent and controlled sources.

import { Element, TwoTerm, register, GRID } from './base.js';
import { fmtShort } from '../engine/units.js';

const G = GRID;
const TAU = Math.PI * 2;

const WAVE_OPTIONS = [
  ['dc', 'DC'], ['sine', 'Sine'], ['square', 'Square'], ['pulse', 'Pulse'], ['triangle', 'Triangle'],
  ['sawtooth', 'Sawtooth'], ['noise', 'Noise'], ['sweep', 'Sweep (chirp)'],
];

function makeWaveProps(wave, unit, amp, freq) {
  // Every source has the settings of every waveform, shown only while its Waveform needs them
  // (`when`): a DC source switched to Sine gets a frequency to set, instead of running with none
  // (NaN, "Solution diverged").
  const uses = (...w) => (p) => w.includes(p.wave);
  const not = (...w) => (p) => !w.includes(p.wave);
  const props = [];
  if (wave === 'dc') {
    props.push({ key: 'amp', label: unit === 'V' ? 'Voltage' : 'Current', unit, def: amp, min: -1e4, max: 1e4, knob: true });
    props.push({ key: 'rint', label: 'Internal resistance', unit: 'Ω', def: 0, min: 0, max: 1e6, hidden: unit !== 'V' });
  } else {
    props.push({ key: 'amp', label: 'Amplitude (peak)', unit, def: amp, min: 0, max: 1e4, knob: wave !== 'sweep' });
  }
  props.push({ key: 'freq', label: wave === 'sweep' ? 'Start frequency' : 'Frequency', unit: 'Hz', def: freq, min: 1e-3, max: 1e9, log: true, knob: wave === 'sweep', when: not('dc', 'noise') });
  props.push({ key: 'f2', label: 'Stop frequency', unit: 'Hz', def: freq * 100, min: 1e-3, max: 1e9, log: true, when: uses('sweep') });
  props.push({ key: 'tsweep', label: 'Sweep time', unit: 's', def: 0.1, min: 1e-6, max: 1e3, log: true, when: uses('sweep') });
  props.push({ key: 'offset', label: 'DC offset', unit, def: 0, min: -1e4, max: 1e4, when: not('dc') });
  props.push({ key: 'phase', label: 'Phase', unit: '°', def: 0, min: -360, max: 360, when: not('dc', 'noise', 'sweep') });
  props.push({ key: 'duty', label: 'Duty cycle', unit: '%', def: 50, min: 0.1, max: 99.9, when: uses('square', 'pulse') });
  if (wave !== 'dc' && unit === 'V') props.push({ key: 'rint', label: 'Internal resistance', unit: 'Ω', def: 0, min: 0, max: 1e6 });
  props.push({ key: 'wave', label: 'Waveform', type: 'select', def: wave, options: WAVE_OPTIONS });
  return props;
}

/** Evaluate waveform value at time t (without srcScale). */
export function waveValue(p, t, el) {
  // a part without every waveform's settings (a rail switched to Sweep) gets the usual ones
  const A = p.amp, off = p.offset || 0;
  const ph = ((p.phase || 0) / 360);
  const f = p.freq > 0 ? p.freq : 1000;
  const duty = Number.isFinite(p.duty) ? p.duty : 50;
  switch (p.wave) {
    case 'dc': return A;
    case 'sine': return off + A * Math.sin(TAU * (f * t + ph));
    case 'square': {
      const fr = frac(f * t + ph);
      return off + (fr < duty / 100 ? A : -A);
    }
    case 'pulse': {
      const fr = frac(f * t + ph);
      return off + (fr < duty / 100 ? A : 0);
    }
    case 'triangle': {
      const fr = frac(f * t + ph + 0.25);
      return off + A * (fr < 0.5 ? 4 * fr - 1 : 3 - 4 * fr);
    }
    case 'sawtooth': return off + A * (2 * frac(f * t + ph + 0.5) - 1);
    case 'noise': return off + A * (el ? el.noiseVal : 0);
    case 'sweep': {
      const T = p.tsweep > 0 ? p.tsweep : 0.1, f1 = f, f2 = p.f2 > 0 ? p.f2 : f * 100;
      const tt = t % T;
      const k = Math.log(f2 / f1) / T;
      const phase = Math.abs(k) < 1e-12 ? f1 * tt : (f1 * (Math.exp(k * tt) - 1)) / k;
      return off + A * Math.sin(TAU * phase);
    }
    default: return A;
  }
}
function frac(x) { return x - Math.floor(x); }

function gaussian() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v) / 3;
}

function drawWaveGlyph(g, wave, r, color) {
  const ctx = g.ctx;
  ctx.beginPath();
  const w = r * 0.62, h = r * 0.42;
  switch (wave) {
    case 'sine':
    case 'sweep':
      for (let k = 0; k <= 24; k++) {
        const x = -w + (2 * w * k) / 24;
        const cyc = wave === 'sweep' ? (k / 24) * (1 + k / 24) * 1.5 : k / 24;
        const y = -h * Math.sin(TAU * cyc);
        k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      break;
    case 'square':
      ctx.moveTo(-w, h); ctx.lineTo(-w, -h); ctx.lineTo(0, -h); ctx.lineTo(0, h); ctx.lineTo(w, h); ctx.lineTo(w, -h); break;
    case 'pulse':
      ctx.moveTo(-w, h); ctx.lineTo(-w * 0.5, h); ctx.lineTo(-w * 0.5, -h); ctx.lineTo(w * 0.2, -h); ctx.lineTo(w * 0.2, h); ctx.lineTo(w, h); break;
    case 'triangle':
      ctx.moveTo(-w, h); ctx.lineTo(-w / 2, -h); ctx.lineTo(0, h); ctx.lineTo(w / 2, -h); ctx.lineTo(w, h); break;
    case 'sawtooth':
      ctx.moveTo(-w, h); ctx.lineTo(0, -h); ctx.lineTo(0, h); ctx.lineTo(w, -h); ctx.lineTo(w, h); break;
    case 'noise': {
      let s = 7;
      for (let k = 0; k <= 12; k++) {
        s = (s * 9301 + 49297) % 233280;
        const x = -w + (2 * w * k) / 12, y = h * (2 * (s / 233280) - 1);
        k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      break;
    }
    default:
      ctx.moveTo(-w, 0); ctx.lineTo(w, 0);
  }
  ctx.strokeStyle = color; ctx.lineWidth = g.lw * 0.8; ctx.lineJoin = 'round'; ctx.stroke();
}

// ------------------------------------------------------------- voltage source
export class VoltageSource extends TwoTerm {
  static type = 'dcv'; static title = 'DC Voltage'; static category = 'Sources';
  static prefix = 'V'; static keywords = 'battery cell supply dc voltage source';
  static props = makeWaveProps('dc', 'V', 5, 1000);
  static description = 'Ideal voltage source. Terminal marked + is the positive side. Optional internal resistance.';
  refNode = 1;
  constructor(x, y) { super(x, y); this.noiseVal = 0; }
  branchCount() { return 1; }
  value(s) {
    const t = s.mode === 'dc' ? 0 : s.tNext;
    return waveValue(this.p, t, this) * (s.srcScale ?? 1);
  }
  reset() { this.setCurrent(0); this.lastLevel = null; this.noiseVal = 0; }
  stamp(s) {
    const k = this.branches[0], [a, b] = this.nodes;
    s.addBranchKCL(a, b, k);
    s.addA(k, a - 1, 1); s.addA(k, b - 1, -1);
    if (this.p.rint > 0) s.addA(k, k, -this.p.rint);
  }
  stampStep(s) {
    if (this.p.wave === 'noise' && s.mode !== 'dc') this.noiseVal = gaussian();
    s.b[this.branches[0]] += this.value(s);
  }
  accept(s) {
    this.setCurrent(s.x[this.branches[0]]);
    if (this.p.wave === 'square' || this.p.wave === 'pulse') {
      const lvl = this.value(s) > (this.p.offset || 0) + (this.p.wave === 'pulse' ? this.p.amp / 2 : 0);
      if (this.lastLevel !== null && lvl !== this.lastLevel) s.event = true;
      this.lastLevel = lvl;
    }
  }
  stampAC(ac) {
    const k = this.branches[0], [a, b] = this.nodes;
    ac.addBranchKCL(a, b, k);
    ac.addA(k, a - 1, 1); ac.addA(k, b - 1, -1);
    if (this.p.rint > 0) ac.addA(k, k, -this.p.rint);
    if (ac.input === this) ac.addB(k, 1);
  }
  readings(s) {
    const v = this.voltageDiff(s);
    return [['Voltage', v, 'V'], ['Current (out of +)', -this.i, 'A'], ['Power delivered', -v * this.i, 'W']];
  }
  valueLabel() {
    const p = this.p;
    if (p.wave === 'dc') return fmtShort(p.amp, 'V');
    if (p.wave === 'sweep') return `${fmtShort(p.amp, 'V')} ${fmtShort(p.freq, 'Hz')}→${fmtShort(p.f2, 'Hz')}`;
    if (p.wave === 'noise') return `${fmtShort(p.amp, 'V')} noise`;
    return `${fmtShort(p.amp, 'V')} ${fmtShort(p.freq, 'Hz')}`;
  }
  spice(n) {
    const p = this.p, dc = p.wave === 'dc' ? p.amp : p.offset;
    let tran = '';
    const per = 1 / p.freq;
    if (p.wave === 'sine') tran = ` SIN(${p.offset} ${p.amp} ${p.freq} 0 0 ${p.phase})`;
    else if (p.wave === 'square') tran = ` PULSE(${p.offset - p.amp} ${p.offset + p.amp} 0 1n 1n ${per * p.duty / 100} ${per})`;
    else if (p.wave === 'pulse') tran = ` PULSE(${p.offset} ${p.offset + p.amp} 0 1n 1n ${per * p.duty / 100} ${per})`;
    else if (p.wave === 'triangle') tran = ` PULSE(${p.offset - p.amp} ${p.offset + p.amp} 0 ${per / 2} ${per / 2} 0 ${per})`;
    return `${this.name} ${n[0]} ${n[1]} DC ${dc} AC 1${tran}${p.rint > 0 ? ` Rser=${p.rint}` : ''}`;
  }
  leads() {
    if (this.p.wave === 'dc') return [[0, -2 * G, 0, -G * 0.15, 0], [1, 2 * G, 0, G * 0.25, 0]];
    return [[0, -2 * G, 0, -G * 0.8, 0], [1, 2 * G, 0, G * 0.8, 0]];
  }
  draw(g) {
    if (this.p.wave === 'dc') {
      // battery: long plate = +
      g.line(-G * 0.15, -G * 0.75, -G * 0.15, G * 0.75, g.vc(g.pv(0)), g.lw * 1.3);
      g.line(G * 0.25, -G * 0.4, G * 0.25, G * 0.4, g.vc(g.pv(1)), g.lw * 2.4);
      g.text('+', -G * 0.65, -G * 0.62, { size: 12, color: g.pos, bold: true });
      return;
    }
    g.circle(0, 0, G * 0.8, { stroke: g.body, width: g.lw * 0.9, fill: g.fill });
    g.upright(() => drawWaveGlyph(g, this.p.wave, G * 0.8, g.accent));
    g.text('+', -G * 1.1, -G * 0.55, { size: 11, color: g.pos, bold: true });
  }
}
register(VoltageSource);

function variant(Base, type, title, wave, amp, freq, keywords, desc) {
  const C = class extends Base {};
  Object.defineProperty(C, 'name', { value: title.replace(/\W/g, '') });
  C.type = type; C.title = title; C.keywords = keywords;
  C.props = makeWaveProps(wave, Base === CurrentSource ? 'A' : 'V', amp, freq);
  C.description = desc || Base.description;
  register(C);
  return C;
}

// ------------------------------------------------------------- current source
export class CurrentSource extends TwoTerm {
  static type = 'dci'; static title = 'DC Current'; static category = 'Sources';
  static prefix = 'I'; static keywords = 'current source constant';
  static props = makeWaveProps('dc', 'A', 0.01, 1000);
  static description = 'Ideal current source. Current flows in the direction of the arrow.';
  constructor(x, y) { super(x, y); this.noiseVal = 0; }
  value(s) { return waveValue(this.p, s.mode === 'dc' ? 0 : s.tNext, this) * (s.srcScale ?? 1); }
  reset() { this.setCurrent(0); }
  stampStep(s) {
    if (this.p.wave === 'noise' && s.mode !== 'dc') this.noiseVal = gaussian();
    this.cur = this.value(s);
    s.addI(this.nodes[0], this.nodes[1], this.cur);
  }
  accept() { this.setCurrent(this.cur); }
  stampAC(ac) { if (ac.input === this) ac.addI(this.nodes[0], this.nodes[1], 1); }
  valueLabel() {
    const p = this.p;
    return p.wave === 'dc' ? fmtShort(p.amp, 'A') : `${fmtShort(p.amp, 'A')} ${fmtShort(p.freq, 'Hz')}`;
  }
  spice(n) {
    const p = this.p;
    return `${this.name} ${n[0]} ${n[1]} DC ${p.wave === 'dc' ? p.amp : p.offset} AC 1${p.wave === 'sine' ? ` SIN(${p.offset} ${p.amp} ${p.freq})` : ''}`;
  }
  leads() { return [[0, -2 * G, 0, -G * 0.8, 0], [1, 2 * G, 0, G * 0.8, 0]]; }
  draw(g) {
    g.circle(0, 0, G * 0.8, { stroke: g.body, width: g.lw * 0.9, fill: g.fill });
    g.line(-G * 0.45, 0, G * 0.35, 0, g.accent, g.lw);
    g.poly([[G * 0.45, 0], [G * 0.12, -G * 0.24], [G * 0.12, G * 0.24]], { fill: g.accent });
    if (this.p.wave !== 'dc') {
      g.upright(() => { g.ctx.scale(0.42, 0.42); drawWaveGlyph(g, this.p.wave, G * 0.8, g.accent); }, 0, -G * 0.45);
    }
  }
}
register(CurrentSource);

variant(VoltageSource, 'acv', 'AC Voltage', 'sine', 5, 50, 'ac sine alternating mains signal generator', 'Sinusoidal voltage source v = Voff + A·sin(2πft + φ).');
variant(VoltageSource, 'square', 'Square Wave', 'square', 5, 1000, 'square clock function generator');
variant(VoltageSource, 'pulse', 'Pulse / PWM', 'pulse', 5, 1000, 'pulse pwm duty generator');
variant(VoltageSource, 'triangle', 'Triangle Wave', 'triangle', 5, 1000, 'triangle ramp function generator');
variant(VoltageSource, 'sawtooth', 'Sawtooth', 'sawtooth', 5, 1000, 'sawtooth ramp function generator');
variant(VoltageSource, 'noise', 'Noise', 'noise', 1, 1000, 'noise random white gaussian', 'Gaussian white noise (bandwidth set by the timestep).');
variant(VoltageSource, 'sweep', 'Sweep (Chirp)', 'sweep', 1, 10, 'chirp sweep frequency response', 'Logarithmic frequency sweep – ideal for looking at filter responses on the oscilloscope.');
variant(CurrentSource, 'aci', 'AC Current', 'sine', 0.01, 50, 'ac current source sine');

// ---------------------------------------------------------------- rail/clock
export class Rail extends Element {
  static type = 'rail'; static title = 'Voltage Rail'; static category = 'Sources';
  static prefix = 'VCC'; static keywords = 'vcc vdd supply rail terminal';
  static props = [
    { key: 'amp', label: 'Voltage', unit: 'V', def: 5, min: -1e4, max: 1e4, knob: true },
    { key: 'wave', label: 'Waveform', type: 'select', def: 'dc', options: WAVE_OPTIONS },
    { key: 'freq', label: 'Frequency', unit: 'Hz', def: 1000, min: 1e-3, max: 1e9, log: true },
    { key: 'offset', label: 'DC offset', unit: 'V', def: 0, min: -1e4, max: 1e4 },
    { key: 'duty', label: 'Duty cycle', unit: '%', def: 50, min: 0.1, max: 99.9 },
    { key: 'phase', label: 'Phase', unit: '°', def: 0, min: -360, max: 360 },
  ];
  static description = 'Single-terminal source referenced to ground (e.g. +5 V supply rail).';
  static noName = true;
  constructor(x, y) { super(x, y); this.postCurrents = [0]; this.noiseVal = 0; }
  localPosts() { return [[0, 0]]; }
  localBox() { return [-G * 0.9, -G * 1.4, G * 0.9, 2]; }
  leads() { return [[0, 0, 0, 0, -G * 0.6]]; }
  connectivity() { return [[0, 'gnd']]; }
  branchCount() { return 1; }
  reset() { this.i = 0; this.postCurrents[0] = 0; this.lastLevel = null; }
  stamp(s) { const k = this.branches[0]; s.addBranchKCL(this.nodes[0], 0, k); s.addA(k, this.nodes[0] - 1, 1); }
  stampStep(s) {
    if (this.p.wave === 'noise' && s.mode !== 'dc') this.noiseVal = gaussian();
    s.b[this.branches[0]] += waveValue(this.p, s.mode === 'dc' ? 0 : s.tNext, this) * (s.srcScale ?? 1);
  }
  accept(s) {
    this.i = s.x[this.branches[0]]; this.postCurrents[0] = this.i;
    if (this.p.wave === 'square' || this.p.wave === 'pulse') {
      const lvl = s.v(this.nodes[0]) > (this.p.offset || 0) + (this.p.wave === 'pulse' ? this.p.amp / 2 : 0);
      if (this.lastLevel != null && lvl !== this.lastLevel) s.event = true;
      this.lastLevel = lvl;
    }
  }
  stampAC(ac) {
    const k = this.branches[0];
    ac.addBranchKCL(this.nodes[0], 0, k); ac.addA(k, this.nodes[0] - 1, 1);
    if (ac.input === this) ac.addB(k, 1);
  }
  readings(s) { return [['Voltage', s.v(this.nodes[0]), 'V'], ['Current supplied', -this.i, 'A']]; }
  valueLabel() { return ''; }
  spice(n) { return `V${this.name} ${n[0]} 0 DC ${this.p.wave === 'dc' ? this.p.amp : this.p.offset}`; }
  draw(g) {
    const txt = this.p.wave === 'dc' ? (this.p.amp >= 0 ? '+' : '') + fmtShort(this.p.amp, 'V')
      : this.p.wave === 'square' || this.p.wave === 'pulse' ? '⎍ ' + fmtShort(this.p.freq, 'Hz') : '∿ ' + fmtShort(this.p.freq, 'Hz');
    g.poly([[-G * 0.55, -G * 0.6], [G * 0.55, -G * 0.6]], { stroke: g.vc(g.pv(0)), width: g.lw * 1.2 });
    g.textSide(txt, 0, -G * 0.85, { size: 11, color: g.accent, bold: true });
  }
}
register(Rail);

export class Clock extends Rail {
  static type = 'clock'; static title = 'Clock'; static category = 'Digital';
  static prefix = 'CLK'; static keywords = 'clock oscillator square digital timing';
  static props = [
    { key: 'freq', label: 'Frequency', unit: 'Hz', def: 10, min: 1e-3, max: 1e8, log: true, knob: true },
    { key: 'amp', label: 'High level', unit: 'V', def: 5, min: 0, max: 100 },
    { key: 'duty', label: 'Duty cycle', unit: '%', def: 50, min: 0.1, max: 99.9 },
    { key: 'wave', label: 'Waveform', type: 'select', def: 'pulse', options: [['pulse', 'Pulse']], hidden: true },
    { key: 'offset', label: 'Offset', unit: 'V', def: 0, hidden: true },
    { key: 'phase', label: 'Phase', unit: '°', def: 0, min: -360, max: 360 },
  ];
  static description = 'Digital clock (0 V / high level square wave) referenced to ground.';
  draw(g) {
    const hi = g.running && g.pv(0) > this.p.amp / 2;
    const c = hi ? g.hi : g.running ? g.lo : g.accent;
    g.upright(() => {
      g.box(-G * 0.6, -G * 0.6, G * 0.6, G * 0.6, { stroke: g.body, width: g.lw * 0.8, fill: g.fill, r: 3 });
      g.poly([[-G * 0.4, G * 0.25], [-G * 0.15, G * 0.25], [-G * 0.15, -G * 0.25], [G * 0.15, -G * 0.25], [G * 0.15, G * 0.25], [G * 0.4, G * 0.25]], { stroke: c, width: g.lw * 0.8 });
    }, 0, -G * 1.2);
  }
  valueLabel() { return fmtShort(this.p.freq, 'Hz'); }
  localBox() { return [-G * 0.6, -G * 1.8, G * 0.6, 2]; }
  labelSide() { return [0, -1]; }
}
register(Clock);

// -------------------------------------------------------- controlled sources
class Controlled extends Element {
  static category = 'Sources';
  constructor(x, y) { super(x, y); this.postCurrents = [0, 0, 0, 0]; }
  localPosts() { return [[-2 * G, -G], [-2 * G, G], [2 * G, -G], [2 * G, G]]; }
  localBox() { return [-2 * G, -1.4 * G, 2 * G, 1.4 * G]; }
  leads() {
    return [[0, -2 * G, -G, -G * 1.2, -G], [1, -2 * G, G, -G * 1.2, G],
      [2, 2 * G, -G, G * 0.9, -G], [3, 2 * G, G, G * 0.9, G]];
  }
  connectivity() { return [[0, 1], [2, 3]]; }
  labelSide() { return [0, -1]; }
  drawBody(g, sym, isCurrent) {
    g.poly([[-G * 1.2, -G], [-G * 1.2, G]], { stroke: g.body, width: g.lw * 0.6, dash: [3, 3] });
    g.poly([[G * 0.9, -G], [G * 0.9, -G * 0.7]], { stroke: g.vc(g.pv(2)), width: g.lw });
    g.poly([[G * 0.9, G], [G * 0.9, G * 0.7]], { stroke: g.vc(g.pv(3)), width: g.lw });
    const d = G * 0.7;
    g.poly([[G * 0.9, -d], [G * 0.9 + d, 0], [G * 0.9, d], [G * 0.9 - d, 0]], { stroke: g.body, width: g.lw * 0.9, fill: g.fill, close: true });
    if (isCurrent) {
      g.line(G * 0.9, G * 0.35, G * 0.9, -G * 0.25, g.accent, g.lw * 0.8);
      g.poly([[G * 0.9, -G * 0.4], [G * 0.75, -G * 0.15], [G * 1.05, -G * 0.15]], { fill: g.accent });
    } else {
      g.text('+', G * 0.9, -G * 0.28, { size: 10, color: g.pos, bold: true });
      g.text('−', G * 0.9, G * 0.3, { size: 10, color: g.neg, bold: true });
    }
    // centred in the gap between the dashed sense line and the diamond, never wider than it
    g.text(sym, -G * 0.5, 0, { size: 8.5, color: g.muted, bold: true, maxW: G * 1.2 });
  }
}

export class VCVS extends Controlled {
  static type = 'vcvs'; static title = 'VCVS'; static prefix = 'E'; static keywords = 'voltage controlled voltage source dependent';
  static props = [{ key: 'gain', label: 'Gain', unit: 'V/V', def: 10, min: -1e9, max: 1e9, knob: true }];
  static description = 'Voltage-controlled voltage source: Vout = gain · Vin (left pair controls right pair).';
  branchCount() { return 1; }
  stamp(s) {
    const k = this.branches[0], [a, b, c, d] = this.nodes;
    s.addBranchKCL(c, d, k);
    s.addA(k, c - 1, 1); s.addA(k, d - 1, -1);
    s.addA(k, a - 1, -this.p.gain); s.addA(k, b - 1, this.p.gain);
  }
  stampAC(ac) {
    const k = this.branches[0], [a, b, c, d] = this.nodes;
    ac.addBranchKCL(c, d, k);
    ac.addA(k, c - 1, 1); ac.addA(k, d - 1, -1);
    ac.addA(k, a - 1, -this.p.gain); ac.addA(k, b - 1, this.p.gain);
  }
  accept(s) { const i = s.x[this.branches[0]]; this.postCurrents = [0, 0, i, -i]; this.i = i; }
  valueLabel() { return `×${+this.p.gain.toPrecision(3)}`; }
  spice(n) { return `${this.name} ${n[2]} ${n[3]} ${n[0]} ${n[1]} ${this.p.gain}`; }
  draw(g) { this.drawBody(g, 'V→V', false); }
}
register(VCVS);

export class VCCS extends Controlled {
  static type = 'vccs'; static title = 'VCCS'; static prefix = 'G'; static keywords = 'voltage controlled current source transconductance';
  static props = [{ key: 'gm', label: 'Transconductance', unit: 'S', def: 0.01, min: -1e6, max: 1e6, knob: true }];
  static description = 'Voltage-controlled current source: Iout = gm · Vin, flowing through the source from + to −.';
  stamp(s) { const [a, b, c, d] = this.nodes; s.addVCCS(c, d, a, b, this.p.gm); }
  stampAC(ac) { const [a, b, c, d] = this.nodes; ac.addVCCS(c, d, a, b, this.p.gm); }
  accept(s) { const [a, b] = this.nodes; const i = this.p.gm * (s.v(a) - s.v(b)); this.postCurrents = [0, 0, i, -i]; this.i = i; }
  valueLabel() { return fmtShort(this.p.gm, 'S'); }
  spice(n) { return `${this.name} ${n[2]} ${n[3]} ${n[0]} ${n[1]} ${this.p.gm}`; }
  draw(g) { this.drawBody(g, 'V→I', true); }
}
register(VCCS);

export class CCVS extends Controlled {
  static type = 'ccvs'; static title = 'CCVS'; static prefix = 'H'; static keywords = 'current controlled voltage source transresistance';
  static props = [{ key: 'r', label: 'Transresistance', unit: 'Ω', def: 100, min: -1e9, max: 1e9, knob: true }];
  static description = 'Current-controlled voltage source: Vout = r · Iin, where Iin flows through the left terminals (0 V sense).';
  branchCount() { return 2; }
  stamp(s) {
    const [k1, k2] = this.branches, [a, b, c, d] = this.nodes;
    s.addBranchKCL(a, b, k1); s.addA(k1, a - 1, 1); s.addA(k1, b - 1, -1);
    s.addBranchKCL(c, d, k2); s.addA(k2, c - 1, 1); s.addA(k2, d - 1, -1);
    s.addA(k2, k1, -this.p.r);
  }
  stampAC(ac) {
    const [k1, k2] = this.branches, [a, b, c, d] = this.nodes;
    ac.addBranchKCL(a, b, k1); ac.addA(k1, a - 1, 1); ac.addA(k1, b - 1, -1);
    ac.addBranchKCL(c, d, k2); ac.addA(k2, c - 1, 1); ac.addA(k2, d - 1, -1);
    ac.addA(k2, k1, -this.p.r);
  }
  accept(s) { const i1 = s.x[this.branches[0]], i2 = s.x[this.branches[1]]; this.postCurrents = [i1, -i1, i2, -i2]; this.i = i2; }
  valueLabel() { return fmtShort(this.p.r, 'Ω'); }
  spice(n) { return `V${this.name}s ${n[0]} ${n[1]} 0\n${this.name} ${n[2]} ${n[3]} V${this.name}s ${this.p.r}`; }
  draw(g) {
    this.drawBody(g, 'I→V', false);
    g.line(-G * 1.2, -G, -G * 1.2, G, g.body, g.lw * 0.8);
  }
}
register(CCVS);

export class CCCS extends Controlled {
  static type = 'cccs'; static title = 'CCCS'; static prefix = 'F'; static keywords = 'current controlled current source mirror gain';
  static props = [{ key: 'beta', label: 'Current gain', unit: 'A/A', def: 100, min: -1e9, max: 1e9, knob: true }];
  static description = 'Current-controlled current source: Iout = β · Iin, where Iin flows through the left terminals.';
  branchCount() { return 1; }
  stamp(s) {
    const k = this.branches[0], [a, b, c, d] = this.nodes;
    s.addBranchKCL(a, b, k); s.addA(k, a - 1, 1); s.addA(k, b - 1, -1);
    s.addA(c - 1, k, this.p.beta); s.addA(d - 1, k, -this.p.beta);
  }
  stampAC(ac) {
    const k = this.branches[0], [a, b, c, d] = this.nodes;
    ac.addBranchKCL(a, b, k); ac.addA(k, a - 1, 1); ac.addA(k, b - 1, -1);
    ac.addA(c - 1, k, this.p.beta); ac.addA(d - 1, k, -this.p.beta);
  }
  accept(s) { const i = s.x[this.branches[0]]; this.postCurrents = [i, -i, this.p.beta * i, -this.p.beta * i]; this.i = this.p.beta * i; }
  valueLabel() { return `β=${+this.p.beta.toPrecision(3)}`; }
  spice(n) { return `V${this.name}s ${n[0]} ${n[1]} 0\n${this.name} ${n[2]} ${n[3]} V${this.name}s ${this.p.beta}`; }
  draw(g) {
    this.drawBody(g, 'I→I', true);
    g.line(-G * 1.2, -G, -G * 1.2, G, g.body, g.lw * 0.8);
  }
}
register(CCCS);

/**
 * Dependent source drawn the textbook way — a diamond in a branch, two terminals — with its
 * control named instead of wired: "node:vx" (the voltage of net label vx to ground),
 * "v:R3" (the voltage across part R3, + at its first terminal) or "i:R1" (the current
 * through part R1, from its first terminal to its second). Value = gain × control.
 */
export class DepSource extends TwoTerm {
  static type = 'depsrc'; static title = 'Dependent Source (diamond)'; static prefix = 'D';
  static keywords = 'dependent source controlled diamond vccs vcvs cccs ccvs 0.1vx 4ix textbook';
  static props = [
    { key: 'kind', label: 'Type', type: 'select', def: 'vccs', options: [['vccs', 'Current source, voltage controlled (VCCS)'], ['cccs', 'Current source, current controlled (CCCS)'], ['vcvs', 'Voltage source, voltage controlled (VCVS)'], ['ccvs', 'Voltage source, current controlled (CCVS)']] },
    { key: 'gain', label: 'Gain', unit: '', def: 0.1, min: -1e9, max: 1e9, knob: true },
    { key: 'ctrl', label: 'Controlled by', type: 'text', def: 'node:vx' },
    { key: 'sym', label: 'Symbol (as in the book)', type: 'text', def: 'vx' },
  ];
  static description = 'A dependent (controlled) source drawn as a diamond in its branch, like in a textbook. "Controlled by": node:NAME — the voltage of the net label NAME to ground; v:PART — the voltage across a part (+ at its first terminal); i:PART — the current through a part (from its first terminal to its second). A current type pushes gain × control in the direction of the arrow; a voltage type keeps + at the first terminal.';
  isCurrent() { return this.p.kind === 'vccs' || this.p.kind === 'cccs'; }
  branchCount() { return this.isCurrent() ? 0 : 1; }
  reset() { this.setCurrent(0); }
  /** The control as { p, q, k }: a node pair scaled by k, or a branch unknown `br` scaled by k. */
  control(s) {
    const c = String(this.p.ctrl || '').trim(), m = /^(node|v|i):\s*(.+)$/.exec(c);
    if (!m) return null;
    const els = s.elements || [];
    if (m[1] === 'node') {
      const lab = els.find((e) => e.netName && e.netName() === m[2] && e.nodes && e.nodes.length);
      return lab ? { p: lab.nodes[0], q: 0, k: 1 } : null;
    }
    const e = els.find((x) => x.name === m[2]);
    if (!e || !e.nodes || e.nodes.length < 2) return null;
    if (m[1] === 'v') return { p: e.nodes[0], q: e.nodes[1], k: 1 };
    if (e.branches && e.branches.length) return { br: e.branches[0], k: 1 };
    const R = e.R ?? e.p.r; // a resistor's current is its voltage over R
    return R > 0 ? { p: e.nodes[0], q: e.nodes[1], k: 1 / R } : null;
  }
  /** shared by the transient and the AC stamps (both expose addA / addVCCS / addBranchKCL) */
  stampWith(m, s) {
    const [a, b] = this.nodes, c = this.control(s), g = this.p.gain * (c ? c.k : 0);
    if (this.isCurrent()) {
      if (!c) return;
      if (c.br != null) { m.addA(a - 1, c.br, g); m.addA(b - 1, c.br, -g); } else m.addVCCS(a, b, c.p, c.q, g);
      return;
    }
    const k = this.branches[0];
    m.addBranchKCL(a, b, k); m.addA(k, a - 1, 1); m.addA(k, b - 1, -1);
    if (!c) return;
    if (c.br != null) m.addA(k, c.br, -g); else { m.addA(k, c.p - 1, -g); m.addA(k, c.q - 1, g); }
  }
  stamp(s) { this.stampWith(s, s); }
  stampAC(ac) { this.stampWith(ac, ac.sim); }
  accept(s) {
    if (!this.isCurrent()) { this.setCurrent(s.x[this.branches[0]]); return; }
    const c = this.control(s);
    if (!c) { this.setCurrent(0); return; }
    const v = c.br != null ? s.x[c.br] : s.v(c.p) - s.v(c.q);
    this.setCurrent(this.p.gain * c.k * v);
  }
  valueLabel() {
    const sym = String(this.p.sym || '').trim() || String(this.p.ctrl || '').replace(/^\w+:/, '');
    return `${+this.p.gain.toPrecision(4)}${sym}`;
  }
  leads() { return [[0, -2 * G, 0, -G * 0.8, 0], [1, 2 * G, 0, G * 0.8, 0]]; }
  draw(g) {
    const d = G * 0.8;
    g.poly([[-d, 0], [0, -d], [d, 0], [0, d]], { stroke: g.body, width: g.lw * 0.9, fill: g.fill, close: true });
    if (this.isCurrent()) {
      g.line(-G * 0.42, 0, G * 0.3, 0, g.accent, g.lw);
      g.poly([[G * 0.42, 0], [G * 0.1, -G * 0.22], [G * 0.1, G * 0.22]], { fill: g.accent });
    } else {
      g.text('+', -G * 0.36, 0, { size: 10, color: g.pos, bold: true });
      g.text('−', G * 0.36, 0, { size: 10, color: g.neg, bold: true });
    }
  }
}
register(DepSource);
