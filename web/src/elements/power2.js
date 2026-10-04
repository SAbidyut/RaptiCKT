// Power-electronics building blocks:
//  - switch-level bridges with freewheeling diodes: H-bridge motor driver,
//    3-phase inverter bridge, BLDC six-step driver (Hall commutation + PWM),
//    stepper driver with fixed-off-time current chopping and microstepping
//  - SPWM / V/f modulator (3-phase or 1-phase, soft-start ramp)
//  - thyristor firing unit (line-synchronised, four isolated gate outputs)
//  - averaged DC-DC converters: inverting buck-boost, Ćuk, SEPIC, flyback,
//    forward, push-pull, half-bridge and full-bridge (open-loop duty cycle
//    or regulated output, CCM conversion ratios, power balance)

import { Element, register, GRID } from './base.js';
import { withChip } from './kit.js';
import { Junction, diodeIV } from './semis.js';
import { DCDC, smin, smax } from './thyristors.js';
import { Digital, DIGI_PROPS } from './digital.js';
import { fmtQty, fmtShort } from '../engine/units.js';

const G = GRID;
const TAU = 2 * Math.PI;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const DIS = 1e-9, DN = 1.8; // freewheeling diode: Vf ≈ 0.9 V at 10 A

// ------------------------------------------------------- bridge base
/**
 * N half-bridge legs between P and N. Each leg: upper switch P→AC and lower
 * switch AC→N (on-resistance / off-leakage) with anti-parallel diodes.
 * Subclasses set the leg states from their control logic in preStep.
 */
class Bridge extends withChip(Element) {
  static category = 'Thyristors & Power';
  static prefix = 'U';
  static ronProp = { key: 'ron', label: 'Switch on-resistance', unit: 'Ω', def: 0.05, min: 1e-4, max: 100, log: true };
  nonlinear = true;
  constructor(x, y) {
    super(x, y);
    this.postCurrents = new Array(this.localPosts().length).fill(0);
    this.J = this.legs().map(() => [new Junction(DIS, DN), new Junction(DIS, DN)]);
  }
  legs() { return []; } // [[P, AC, N] post indices]
  logicRef() { return null; } // post index the logic inputs are measured from
  inputs() { return []; }
  connectivity() { return null; }
  reset() {
    this.st = this.legs().map(() => [false, false]);
    this.il = this.legs().map(() => [0, 0]);
    for (const j of this.J) { j[0].vd = 0; j[1].vd = 0; }
    this.ins = this.inputs().map(() => false);
    this.postCurrents.fill(0);
    this.resetCtl?.();
  }
  g(on) { return on ? 1 / Math.max(this.p.ron, 1e-4) : 1e-8; }
  stamp(s) {
    const n = this.nodes;
    this.legs().forEach(([P, AC, N], k) => { s.addG(n[P], n[AC], this.g(this.st[k][0])); s.addG(n[AC], n[N], this.g(this.st[k][1])); });
    const r = this.logicRef();
    if (r != null) for (const i of this.inputs()) s.addG(n[i], n[r], 1e-5); // 100 kΩ input pull-downs
  }
  stampNL(s) {
    const n = this.nodes;
    this.legs().forEach(([P, AC, N], k) => {
      const a = n[AC], p = n[P], m = n[N];
      let v = this.J[k][0].limit(s, s.v(a) - s.v(p)), d = diodeIV(v, DIS, DN, 0);
      s.addG(a, p, d.g); s.addI(a, p, d.i - d.g * v);
      v = this.J[k][1].limit(s, s.v(m) - s.v(a)); d = diodeIV(v, DIS, DN, 0);
      s.addG(m, a, d.g); s.addI(m, a, d.i - d.g * v);
    });
  }
  stampAC(ac) {
    const n = this.nodes;
    this.legs().forEach(([P, AC, N], k) => { ac.addY(n[P], n[AC], this.g(this.st[k][0])); ac.addY(n[AC], n[N], this.g(this.st[k][1])); });
    const r = this.logicRef();
    if (r != null) for (const i of this.inputs()) ac.addY(n[i], n[r], 1e-5);
  }
  readIns(s, th = 2.5) {
    const n = this.nodes, r = this.logicRef();
    return this.inputs().map((pi, k) => { const v = s.v(n[pi]) - (r != null ? s.v(n[r]) : 0); return this.ins[k] ? v > th * 0.8 : v > th * 1.2; });
  }
  setLegs(s, want) {
    let ch = false;
    want.forEach(([h, l], k) => { if (h && l) { h = false; l = false; } if (h !== this.st[k][0] || l !== this.st[k][1]) { this.st[k] = [h, l]; ch = true; } });
    if (ch) s.markEvent();
  }
  accept(s) {
    const n = this.nodes, pc = this.postCurrents;
    pc.fill(0);
    this.legs().forEach(([P, AC, N], k) => {
      const vp = s.v(n[P]), va = s.v(n[AC]), vn = s.v(n[N]);
      this.J[k][0].vd = va - vp; this.J[k][1].vd = vn - va;
      const ih = (vp - va) * this.g(this.st[k][0]) - diodeIV(va - vp, DIS, DN, 0).i;
      const il = (va - vn) * this.g(this.st[k][1]) - diodeIV(vn - va, DIS, DN, 0).i;
      this.il[k] = [ih, il];
      pc[P] += ih; pc[AC] += il - ih; pc[N] -= il;
    });
    const r = this.logicRef();
    if (r != null) for (const i of this.inputs()) { const ii = (s.v(n[i]) - s.v(n[r])) * 1e-5; pc[i] += ii; pc[r] -= ii; }
    this.i = pc[0];
    this.afterAccept?.(s);
  }
  /** current flowing out of leg k's AC terminal into the load */
  iout(k) { const [ih, il] = this.il?.[k] || [0, 0]; return ih - il; }
  legLabel(k) { const [h, l] = this.st?.[k] || []; return h ? '+' : l ? '−' : '0'; }
  valueLabel() { return ''; }
}

// ---------------------------------------------------------- H-bridge
const HB_MODELS = { 'L298N (bipolar)': { ron: 1.2 }, 'DRV8871 (MOSFET)': { ron: 0.6 }, 'BTS7960 (MOSFET, 43 A)': { ron: 0.008 } };
export class HBridge extends Bridge {
  static type = 'hbridge'; static title = 'H-Bridge Motor Driver';
  static keywords = 'h bridge motor driver l298n l293d bts7960 drv8871 dc motor direction pwm brake full bridge inverter';
  static props = [
    { key: 'model', label: 'Model', type: 'select', def: 'L298N (bipolar)', options: Object.keys(HB_MODELS).map((k) => [k, k]).concat([['custom', 'Custom']]), preset: HB_MODELS },
    { key: 'ron', label: 'Switch on-resistance', unit: 'Ω', def: 1.2, min: 1e-4, max: 100, log: true },
  ];
  static pins = [['IN1', 'L'], ['IN2', 'L'], ['EN', 'L'], ['VS', 'R'], ['OUT1', 'R'], ['OUT2', 'R'], ['GND', 'R']];
  static description = 'Full H-bridge (two legs with freewheeling diodes) with logic inputs referred to GND. EN high: IN1/IN2 high connects OUT1/OUT2 to VS, low connects it to GND — IN1≠IN2 drives the motor one way or the other, IN1 = IN2 brakes it (both ends shorted). EN low turns every switch off and the motor coasts (current freewheels through the diodes). PWM on EN controls the speed. Also usable as a single-phase full-bridge inverter.';
  legs() { return [[3, 4, 6], [3, 5, 6]]; }
  logicRef() { return 6; }
  inputs() { return [0, 1, 2]; }
  preStep(s) {
    this.ins = this.readIns(s);
    const [a, b, en] = this.ins;
    this.setLegs(s, en ? [[a, !a], [b, !b]] : [[false, false], [false, false]]);
  }
  readings(s) {
    const n = this.nodes;
    return [['State', !this.ins?.[2] ? 'disabled (coast)' : this.ins[0] === this.ins[1] ? 'brake' : this.ins[0] ? 'forward (OUT1 +)' : 'reverse (OUT2 +)', ''],
      ['V(OUT1 − OUT2)', s.v(n[4]) - s.v(n[5]), 'V'], ['Load current OUT1 → OUT2', this.iout(0), 'A'], ['Supply current', this.postCurrents[3], 'A']];
  }
  draw(g) { this.drawChip(g, 'H-BR'); }
}
register(HBridge);

// ------------------------------------------------- 3-phase inverter bridge
export class Inverter3 extends Bridge {
  static type = 'inv3'; static title = '3-Phase Inverter Bridge';
  static keywords = 'three phase inverter bridge six switch igbt vsi vfd drive dc to ac motor drive';
  static props = [
    { key: 'ron', label: 'Switch on-resistance', unit: 'Ω', def: 0.05, min: 1e-4, max: 100, log: true },
    { key: 'td', label: 'Dead time', unit: 's', def: 0, min: 0, max: 1e-3 },
  ];
  static pins = [['HA', 'L'], ['HB', 'L'], ['HC', 'L'], ['EN', 'L'], ['P', 'R'], ['A', 'R'], ['B', 'R'], ['C', 'R'], ['N', 'R']];
  static description = 'Six-switch voltage-source inverter (IGBTs with freewheeling diodes) between the DC bus P / N. Logic inputs are referred to N: HA high connects output A to P, low connects it to N (complementary, with optional dead time during which only the diodes conduct); EN low turns everything off. Drive it with the SPWM generator to make variable-frequency three-phase AC for an induction motor.';
  legs() { return [[4, 5, 8], [4, 6, 8], [4, 7, 8]]; }
  logicRef() { return 8; }
  inputs() { return [0, 1, 2, 3]; }
  resetCtl() { this.tch = [0, 0, 0]; this.want = [false, false, false]; }
  preStep(s) {
    this.ins = this.readIns(s);
    const t = s.mode === 'dc' ? 0 : s.tNext, td = s.mode === 'dc' ? 0 : this.p.td, en = this.ins[3];
    const st = [0, 1, 2].map((k) => {
      const w = this.ins[k];
      if (w !== this.want[k]) { this.want[k] = w; this.tch[k] = t; }
      if (!en) return [false, false];
      if (t - this.tch[k] < td) return [false, false];
      return [w, !w];
    });
    this.setLegs(s, st);
  }
  readings(s) {
    const n = this.nodes, v = (a, b) => s.v(n[a]) - s.v(n[b]);
    return [['Legs A B C', [0, 1, 2].map((k) => this.legLabel(k)).join(' '), ''], ['DC bus', v(4, 8), 'V'], ['V_AB', v(5, 6), 'V'], ['I_A', this.iout(0), 'A'], ['I_B', this.iout(1), 'A'], ['I_C', this.iout(2), 'A'], ['DC current', this.postCurrents[4], 'A']];
  }
  draw(g) {
    this.drawChip(g, 'INV 3~');
  }
}
register(Inverter3);

// -------------------------------------------------------- BLDC driver
// Hall code H1H2H3 → [phase driven high (PWM), phase driven low]
const COMM = { '101': [0, 1], '100': [0, 2], '110': [1, 2], '010': [1, 0], '011': [2, 0], '001': [2, 1] };
export class BLDCDriver extends Bridge {
  static type = 'bldcdrv'; static title = 'BLDC Motor Driver (6-step)';
  static keywords = 'bldc driver esc electronic speed controller six step trapezoidal hall commutation brushless';
  static props = [
    { key: 'duty', label: 'Speed command (PWM duty)', unit: '%', def: 60, min: 0, max: 100, knob: true },
    { key: 'dir', label: 'Direction', type: 'select', def: 'fwd', options: [['fwd', 'Forward'], ['rev', 'Reverse']] },
    { key: 'fpwm', label: 'PWM frequency', unit: 'Hz', def: 10000, min: 100, max: 100000, log: true },
    { key: 'ron', label: 'Switch on-resistance', unit: 'Ω', def: 0.02, min: 1e-4, max: 100, log: true },
  ];
  static pins = [['H1', 'L'], ['H2', 'L'], ['H3', 'L'], ['EN', 'L'], ['P', 'R'], ['A', 'R'], ['B', 'R'], ['C', 'R'], ['N', 'R']];
  static description = 'Six-step (trapezoidal) BLDC controller with a 3-phase MOSFET bridge: the Hall code (H1–H3, logic referred to N) selects which phase is switched to +V (chopped at the PWM duty cycle) and which to 0 V; the third phase floats. 101 → A+B−, 100 → A+C−, 110 → B+C−, 010 → B+A−, 011 → C+A−, 001 → C+B−. Reverse swaps the pair. Invalid codes (000/111) or EN low turn all switches off.';
  legs() { return [[4, 5, 8], [4, 6, 8], [4, 7, 8]]; }
  logicRef() { return 8; }
  inputs() { return [0, 1, 2, 3]; }
  resetCtl() { this.code = '000'; }
  preStep(s) {
    this.ins = this.readIns(s);
    const code = this.ins.slice(0, 3).map((b) => (b ? 1 : 0)).join('');
    this.code = code;
    const pair = COMM[code], want = [[false, false], [false, false], [false, false]];
    if (pair && this.ins[3]) {
      let [hi, lo] = pair;
      if (this.p.dir === 'rev') [hi, lo] = [lo, hi];
      const t = s.mode === 'dc' ? 0 : s.tNext, ph = t * this.p.fpwm - Math.floor(t * this.p.fpwm);
      want[hi][0] = ph < this.p.duty / 100;
      want[lo][1] = true;
    }
    this.setLegs(s, want);
  }
  readings(s) {
    const pair = COMM[this.code];
    return [['Hall code', this.code, ''], ['Driving', pair ? `${'ABC'[pair[this.p.dir === 'rev' ? 1 : 0]]}+ ${'ABC'[pair[this.p.dir === 'rev' ? 0 : 1]]}−` : 'off', ''],
      ['DC bus', s.v(this.nodes[4]) - s.v(this.nodes[8]), 'V'], ['DC current', this.postCurrents[4], 'A'], ['I_A', this.iout(0), 'A']];
  }
  valueLabel() { return `${Math.round(this.p.duty)}%`; }
  draw(g) { this.drawChip(g, 'BLDC DRV'); }
}
register(BLDCDriver);

// ------------------------------------------------------- stepper driver
const MICRO = { full: 1, half: 2, '1/4': 4, '1/8': 8, '1/16': 16 };
export class StepperDriver extends Bridge {
  static type = 'stepdrv'; static title = 'Stepper Motor Driver (A4988 class)';
  static keywords = 'stepper driver a4988 drv8825 microstepping step dir current chopping bipolar cnc 3d printer';
  static props = [
    { key: 'ilim', label: 'Current limit (per phase, peak)', unit: 'A', def: 1, min: 0.01, max: 10, knob: true },
    { key: 'mode', label: 'Step mode', type: 'select', def: 'full', options: Object.keys(MICRO).map((k) => [k, k === 'full' ? 'Full step' : k === 'half' ? 'Half step' : `${k} microstep`]) },
    { key: 'toff', label: 'Chopper off time', unit: 's', def: 2e-5, min: 1e-6, max: 1e-3, log: true },
    { key: 'ron', label: 'Switch on-resistance', unit: 'Ω', def: 0.3, min: 1e-4, max: 100, log: true },
  ];
  static pins = [['STEP', 'L'], ['DIR', 'L'], ['¬EN', 'L'], ['VS', 'R'], ['A+', 'R'], ['A−', 'R'], ['B+', 'R'], ['B−', 'R'], ['GND', 'R']];
  static description = 'Bipolar stepper driver: each rising edge on STEP advances the electrical angle by 90° / microsteps (backwards when DIR is low) and the two H-bridges regulate the winding currents to I·cos θ and I·sin θ by fixed-off-time chopping — drive the winding until the current reaches the target, then let it decay (slow decay) for the off time; fast decay through the diodes when the current must fall or reverse. ¬EN high disables the outputs. Inputs are logic levels referred to GND (100 kΩ pull-downs, so leaving ¬EN low enables it).';
  legs() { return [[3, 4, 8], [3, 5, 8], [3, 6, 8], [3, 7, 8]]; }
  logicRef() { return 8; }
  inputs() { return [0, 1, 2]; }
  resetCtl() { this.th = Math.PI / 4; this.steps = 0; this.offUntil = [0, 0]; this.mode = ['drive', 'drive']; }
  targets() { return [this.p.ilim * Math.cos(this.th), this.p.ilim * Math.sin(this.th)]; }
  wind(k) { return this.iout(2 * k); }
  preStep(s) {
    const prev = this.ins, ins = this.readIns(s);
    this.ins = ins;
    if (s.mode !== 'dc' && ins[0] && !prev[0]) { const d = (Math.PI / 2) / (MICRO[this.p.mode] || 1); this.th += ins[1] ? d : -d; this.steps += ins[1] ? 1 : -1; }
    const t = s.mode === 'dc' ? 0 : s.tNext, T = this.targets(), want = [];
    for (let k = 0; k < 2; k++) {
      const it = T[k], i = this.wind(k);
      let m;
      if (ins[2] || Math.abs(it) < 1e-6 * this.p.ilim) m = 'off';
      else if (t < this.offUntil[k]) m = this.mode[k];
      else if (i * Math.sign(it) < -0.02 * this.p.ilim || Math.abs(i) > Math.abs(it) * 1.1) { m = 'off'; this.offUntil[k] = t + this.p.toff; }
      else if (Math.abs(i) >= Math.abs(it)) { m = 'slow'; this.offUntil[k] = t + this.p.toff; }
      else m = 'drive';
      this.mode[k] = m;
      const pos = it > 0;
      want.push(...(m === 'drive' ? [[pos, !pos], [!pos, pos]] : m === 'slow' ? [[false, true], [false, true]] : [[false, false], [false, false]]));
    }
    this.setLegs(s, want);
  }
  readings(s) {
    const T = this.targets();
    return [['Step count', this.steps, ''], ['Electrical angle', (this.th * 180) / Math.PI, '°'], ['Target I(A)', T[0], 'A'], ['I(A)', this.wind(0), 'A'], ['Target I(B)', T[1], 'A'], ['I(B)', this.wind(1), 'A'], ['Enabled', this.ins?.[2] ? 'no' : 'yes', '']];
  }
  valueLabel() { return `${fmtShort(this.p.ilim, 'A')} ${this.p.mode}`; }
  draw(g) { this.drawChip(g, 'STEP DRV'); }
}
register(StepperDriver);

// ------------------------------------------------------ SPWM generator
export class SPWMGen extends withChip(Digital) {
  static type = 'spwm'; static title = 'SPWM / V-f Modulator'; static category = 'Thyristors & Power';
  static keywords = 'spwm sinusoidal pwm modulator v/f vfd inverter control carrier triangle soft start three phase';
  static props = [
    { key: 'f', label: 'Output frequency', unit: 'Hz', def: 50, min: 0, max: 400, knob: true },
    { key: 'm', label: 'Modulation index at base frequency', unit: '', def: 1, min: 0, max: 1.15 },
    { key: 'fbase', label: 'Base frequency (V/f)', unit: 'Hz', def: 50, min: 1, max: 400 },
    { key: 'boost', label: 'Low-speed voltage boost', unit: '', def: 0.03, min: 0, max: 0.3 },
    { key: 'fc', label: 'Carrier frequency', unit: 'Hz', def: 2000, min: 100, max: 50000, log: true },
    { key: 'ramp', label: 'Acceleration time (0 → f)', unit: 's', def: 0.5, min: 0, max: 100 },
    { key: 'mode', label: 'Outputs', type: 'select', def: '3ph', options: [['3ph', '3-phase (HA HB HC, 120°)'], ['1bi', '1-phase bipolar (HB = not HA)'], ['1uni', '1-phase unipolar (HA, HB)']] },
    { key: 'thi', label: 'Third-harmonic injection (SVPWM-equivalent)', type: 'bool', def: true },
    { key: 'dir', label: 'Phase sequence', type: 'select', def: 'fwd', options: [['fwd', 'A-B-C (forward)'], ['rev', 'A-C-B (reverse)']] },
    ...DIGI_PROPS,
  ];
  static pins = [['HA', 'R'], ['HB', 'R'], ['HC', 'R']];
  static description = 'Sine-triangle PWM modulator for inverter bridges: compares sine references with a triangular carrier and outputs the leg commands HA/HB/HC (logic levels). V/f control: the frequency ramps from 0 to the set value over the acceleration time and the modulation index follows m·f/f_base (plus a small boost at low speed), keeping the motor flux constant. The fundamental line voltage of a 3-phase bridge is ≈0.612·m·Vdc RMS; third-harmonic injection lets m reach 1.15 without over-modulation (like space-vector PWM), i.e. up to ≈0.707·Vdc.';
  outputs() { return [0, 1, 2]; }
  resetState() { this.ph = 0; this.tAcc = undefined; this.fnow = this.p.ramp > 0 ? 0 : this.p.f; this.mnow = 0; }
  compute(ins, settle) { return settle ? [false, false, false] : this.out; }
  levels(t) {
    const m = this.mnow, ph = this.ph + TAU * this.fnow * (t - this.tAcc), sg = this.p.dir === 'rev' ? -1 : 1;
    let r = [0, 1, 2].map((k) => m * Math.sin(ph - sg * k * TAU / 3));
    if (this.p.mode === '3ph' && this.p.thi) { const z = (Math.max(...r) + Math.min(...r)) / 2; r = r.map((x) => x - z); }
    const x = t * this.p.fc - Math.floor(t * this.p.fc), car = x < 0.5 ? 4 * x - 1 : 3 - 4 * x;
    if (this.p.mode === '1bi') { const a = r[0] > car; return [a, !a, false]; }
    if (this.p.mode === '1uni') return [r[0] > car, -r[0] > car, false];
    return r.map((v) => v > car);
  }
  preStep(s) {
    if (s.mode === 'dc') return;
    this.tAcc ??= s.t;
    const o = this.levels(s.tNext);
    if (o.some((v, k) => v !== this.out[k])) { this.out = o; s.event = true; }
  }
  accept(s) {
    super.accept(s);
    if (s.mode === 'dc') { this.tAcc = s.t; return; }
    this.ph += TAU * this.fnow * (s.t - (this.tAcc ?? s.t)); this.tAcc = s.t;
    const f = this.p.f, a = this.p.ramp > 0 ? (this.p.fbase / this.p.ramp) * s.dt : Infinity;
    this.fnow = this.fnow < f ? Math.min(f, this.fnow + a) : Math.max(f, this.fnow - a);
    const vf = Math.min(1, this.fnow / this.p.fbase);
    this.mnow = Math.min(this.p.mode === '3ph' && this.p.thi ? 1.155 : 1, this.p.m * Math.max(vf, this.fnow > 0 ? this.p.boost : 0));
  }
  valueLabel() { return fmtQty(this.p.f, 'Hz'); }
  readings() { return [['Output frequency now', this.fnow || 0, 'Hz'], ['Modulation index now', this.mnow || 0, ''], ['Carrier', this.p.fc, 'Hz']]; }
  draw(g) {
    this.drawChip(g, 'SPWM');
    const ctx = g.ctx; ctx.beginPath();
    for (let k = 0; k <= 16; k++) { const x = -0.6 * G + (k / 16) * 1.2 * G, y = 0.25 * G - 0.3 * G * Math.sin((k / 16) * TAU); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.strokeStyle = g.accent; ctx.lineWidth = g.lw * 0.6; ctx.stroke();
  }
}
register(SPWMGen);

// --------------------------------------------------- thyristor firing unit
export class FiringUnit extends withChip(Element) {
  static type = 'firing'; static title = 'Thyristor Firing Unit (1-phase bridge)'; static category = 'Thyristors & Power';
  static prefix = 'U'; static keywords = 'thyristor firing circuit gate trigger unit firing angle alpha phase control converter scr bridge pulse transformer';
  static props = [
    { key: 'alpha', label: 'Firing angle α', unit: '°', def: 60, min: 0, max: 180, knob: true },
    { key: 'pw', label: 'Pulse width', unit: '°', def: 40, min: 1, max: 179 },
    { key: 'vg', label: 'Gate pulse voltage', unit: 'V', def: 10, min: 1, max: 30 },
    { key: 'rg', label: 'Gate source resistance', unit: 'Ω', def: 20, min: 0.1, max: 1e4, log: true },
  ];
  static pins = [['L', 'L'], ['N', 'L'], ['G1', 'R'], ['K1', 'R'], ['G2', 'R'], ['K2', 'R'], ['G3', 'R'], ['K3', 'R'], ['G4', 'R'], ['K4', 'R']];
  static chipOpts = { dense: true };
  static description = 'Line-synchronised firing unit for a single-phase thyristor bridge: it detects the zero crossings of the sync voltage L–N and fires G1/K1 and G4/K4 at α in the positive half-cycle and G2/K2 and G3/K3 at α + 180°, through isolated pulse outputs (pulse-transformer style, each G–K pair floating). For a half-controlled bridge use outputs 1 and 2.';
  constructor(x, y) { super(x, y); this.postCurrents = new Array(10).fill(0); }
  connectivity() { return [[0, 1], [2, 3], [4, 5], [6, 7], [8, 9]]; }
  branchCount() { return 4; }
  reset() { this.pos = false; this.t0 = null; this.T = 0.02; this.on = [false, false, false, false]; this.postCurrents.fill(0); }
  stamp(s) {
    s.addG(this.nodes[0], this.nodes[1], 1e-6);
    for (let k = 0; k < 4; k++) {
      const g = this.nodes[2 + 2 * k], c = this.nodes[3 + 2 * k], br = this.branches[k];
      s.addBranchKCL(g, c, br); s.addA(br, g - 1, 1); s.addA(br, c - 1, -1); s.addA(br, br, -this.p.rg);
    }
  }
  stampStep(s) { for (let k = 0; k < 4; k++) s.b[this.branches[k]] += this.on[k] ? this.p.vg : 0; }
  preStep(s) {
    if (s.mode === 'dc') return;
    const v = s.v(this.nodes[0]) - s.v(this.nodes[1]), t = s.tNext;
    const pos = this.pos ? v > -0.5 : v > 0.5;
    if (pos && !this.pos) { if (this.t0 != null) this.T = clamp(t - this.t0, 1e-3, 1); this.t0 = t; }
    this.pos = pos;
    let on = [false, false, false, false];
    if (this.t0 != null) {
      const deg = (((t - this.t0) / this.T) * 360) % 360, a = this.p.alpha, w = this.p.pw;
      const inWin = (x) => { const d = (deg - x + 360) % 360; return d < w; };
      const p1 = a < 180 && inWin(a), p2 = a < 180 && inWin(a + 180);
      on = [p1, p2, p2, p1];
    }
    if (on.some((x, k) => x !== this.on[k])) { this.on = on; s.event = true; }
  }
  accept(s) {
    const i = this.branches.map((b) => s.x[b]), iin = (s.v(this.nodes[0]) - s.v(this.nodes[1])) * 1e-6;
    this.postCurrents = [iin, -iin, i[0], -i[0], i[1], -i[1], i[2], -i[2], i[3], -i[3]];
  }
  stampAC(ac) {
    ac.addY(this.nodes[0], this.nodes[1], 1e-6);
    for (let k = 0; k < 4; k++) { const g = this.nodes[2 + 2 * k], c = this.nodes[3 + 2 * k], br = this.branches[k]; ac.addBranchKCL(g, c, br); ac.addA(br, g - 1, 1); ac.addA(br, c - 1, -1); ac.addA(br, br, -this.p.rg); }
  }
  valueLabel() { return `α ${Math.round(this.p.alpha)}°`; }
  readings() { return [['Firing angle', this.p.alpha, '°'], ['Line frequency', 1 / this.T, 'Hz'], ['Pulses', this.on.map((x, k) => (x ? `G${k + 1}` : '')).filter(Boolean).join(' ') || '—', '']]; }
  draw(g) { this.drawChip(g, 'FIRING'); }
}
register(FiringUnit);

// ---------------------------------------------- averaged DC-DC converters
const RATIO = {
  buckboost: { M: (d, n) => d / (1 - d), inv: (r, n) => r / (1 + r), inverting: true, iso: false, dmax: 0.85, tag: 'B-B' },
  cuk: { M: (d, n) => d / (1 - d), inv: (r, n) => r / (1 + r), inverting: true, iso: false, dmax: 0.85, tag: 'ĆUK' },
  sepic: { M: (d, n) => d / (1 - d), inv: (r, n) => r / (1 + r), iso: false, dmax: 0.85, tag: 'SEPIC' },
  flyback: { M: (d, n) => (n * d) / (1 - d), inv: (r, n) => r / (n + r), iso: true, dmax: 0.6, tag: 'FLYBK' },
  forward: { M: (d, n) => n * d, inv: (r, n) => r / n, iso: true, dmax: 0.45, tag: 'FWD' },
  pushpull: { M: (d, n) => 2 * n * d, inv: (r, n) => r / (2 * n), iso: true, dmax: 0.45, tag: 'P-P' },
  halfbridge: { M: (d, n) => n * d, inv: (r, n) => r / n, iso: true, dmax: 0.45, tag: '½-BR' },
  fullbridge: { M: (d, n) => 2 * n * d, inv: (r, n) => r / (2 * n), iso: true, dmax: 0.45, tag: 'FULL-BR' },
};

class AvgConverter extends DCDC {
  static topo = 'sepic';
  T() { return RATIO[this.constructor.topo]; }
  static mkProps(topo, vset) {
    const R = RATIO[topo], p = [
      { key: 'ctl', label: 'Control', type: 'select', def: 'reg', options: [['reg', 'Regulated (feedback holds Vset)'], ['duty', 'Open loop (fixed duty cycle)']] },
      { key: 'vset', label: 'Output voltage set (magnitude)', unit: 'V', def: vset, min: 0.5, max: 1000, knob: true },
      { key: 'duty', label: 'Duty cycle (open loop)', unit: '%', def: 40, min: 0, max: 95 },
    ];
    if (R.iso) p.push({ key: 'n', label: 'Turns ratio Ns/Np', unit: '', def: topo === 'flyback' ? 0.1 : 0.15, min: 0.001, max: 100, log: true });
    p.push({ key: 'dmax', label: 'Maximum duty cycle', unit: '%', def: R.dmax * 100, min: 5, max: 95 },
      { key: 'eff', label: 'Efficiency', unit: '', def: R.iso ? 0.85 : 0.9, min: 0.3, max: 1 },
      { key: 'rout', label: 'Output resistance', unit: 'Ω', def: 0.05, min: 1e-4, max: 100, log: true });
    return p;
  }
  constructor(x, y) { super(x, y); }
  n() { return this.T().iso ? this.p.n : 1; }
  ends() {
    const n = this.nodes;
    return this.T().inverting ? { ip: n[0], im: n[1], op: n[2], om: n[1] } : { ip: n[0], im: n[1], op: n[2], om: n[3] };
  }
  connectivity() { return this.T().inverting ? [[0, 1, 2]] : this.T().iso ? [[0, 1], [2, 3]] : [[0, 1, 2, 3]]; }
  vo(vin) {
    const T = this.T(), n = this.n(), sg = T.inverting ? -1 : 1;
    if (this.p.ctl === 'duty') { const M = T.M(clamp(this.p.duty / 100, 0, 0.95), n); const c = smax(M * vin, 0, 0.02); return { y: sg * c.y, d: sg * M * c.da }; }
    const Mmax = T.M(clamp(this.p.dmax / 100, 0.01, 0.95), n), m = smin(this.p.vset, Mmax * vin, 0.05), c = smax(m.y, 0, 0.02);
    return { y: sg * c.y, d: sg * c.da * m.db * Mmax };
  }
  accept(s) {
    super.accept(s);
    if (this.T().inverting) { const [iin, , io] = this.postCurrents; this.postCurrents = [iin, -iin - io, io]; }
  }
  dutyNow() {
    const T = this.T(), vin = this.vin || 0, vo = Math.abs(this.vout || 0);
    if (this.p.ctl === 'duty') return this.p.duty / 100;
    return vin > 0.1 ? clamp(T.inv(vo / vin, this.n()), 0, this.p.dmax / 100) : 0;
  }
  valueLabel() { return this.p.ctl === 'duty' ? `D ${Math.round(this.p.duty)}%` : fmtShort((this.T().inverting ? -1 : 1) * this.p.vset, 'V'); }
  readings(s) { return [...super.readings(s), ['Duty cycle', this.dutyNow() * 100, '%'], ['Isolated', this.T().iso ? 'yes' : 'no', '']]; }
  draw(g) {
    this.drawChip(g, this.T().tag);
    if (this.T().iso) { const ctx = g.ctx; ctx.setLineDash([3, 3]); g.line(0, -0.55 * G, 0, 0.75 * G, g.muted, g.lw * 0.5); ctx.setLineDash([]); }
  }
}

function conv(type, title, topo, vset, keywords, desc) {
  const C = class extends AvgConverter {};
  const R = RATIO[topo];
  Object.assign(C, { type, title, topo, keywords, description: desc });
  C.props = AvgConverter.mkProps(topo, vset);
  C.pins = R.inverting ? [['VIN', 'L'], ['GND', 'L'], ['−VOUT', 'R']] : [['IN+', 'L'], ['IN−', 'L'], ['OUT+', 'R'], ['OUT−', 'R']];
  register(C);
  return C;
}
const AVG = ' Averaged (switching-cycle mean) model in continuous conduction: open loop the output follows the conversion ratio; regulated, the duty cycle adjusts to hold Vset until it reaches the maximum duty. Input current follows from power balance.';
conv('buckboost', 'Buck-Boost Converter (inverting)', 'buckboost', 12, 'buck boost converter inverting negative output dc dc smps',
  'Inverting buck-boost: Vout = −Vin·D/(1 − D) — step up or down with reversed polarity (output negative with respect to GND).' + AVG);
conv('cuk', 'Ćuk Converter', 'cuk', 12, 'cuk converter inverting capacitive transfer low ripple dc dc',
  'Ćuk converter: Vout = −Vin·D/(1 − D) like the buck-boost, but energy passes through a series capacitor and both input and output currents are continuous (low ripple).' + AVG);
conv('sepic', 'SEPIC Converter', 'sepic', 12, 'sepic converter single ended primary inductor buck boost non inverting led driver battery',
  'SEPIC: non-inverting Vout = Vin·D/(1 − D) — keeps a constant output whether the input is above or below it (e.g. 12 V from a 9–16 V battery).' + AVG);
conv('flyback', 'Flyback Converter (isolated)', 'flyback', 12, 'flyback converter isolated smps charger adapter coupled inductor',
  'Isolated flyback: Vout = Vin·n·D/(1 − D) with n = Ns/Np — the coupled-inductor stores energy while the switch is on and releases it to the output when off. Phone chargers and small adapters.' + AVG);
conv('forward', 'Forward Converter (isolated)', 'forward', 12, 'forward converter isolated transformer reset winding smps',
  'Single-switch forward converter: Vout = n·D·Vin; the transformer passes energy while the switch is on, D ≤ 0.5 for core reset.' + AVG);
conv('pushpull', 'Push-Pull Converter (isolated)', 'pushpull', 24, 'push pull converter centre tapped transformer isolated smps inverter',
  'Push-pull converter: two switches drive a centre-tapped primary alternately: Vout = 2·n·D·Vin (D per switch ≤ 0.5).' + AVG);
conv('halfbridge', 'Half-Bridge Converter (isolated)', 'halfbridge', 24, 'half bridge converter isolated smps split capacitor transformer',
  'Half-bridge converter: the primary sees ±Vin/2 from a split capacitor: Vout = n·D·Vin (D per switch ≤ 0.5).' + AVG);
conv('fullbridge', 'Full-Bridge Converter (isolated)', 'fullbridge', 48, 'full bridge converter isolated smps phase shifted high power transformer',
  'Full-bridge converter: four switches apply ±Vin to the primary: Vout = 2·n·D·Vin (D per diagonal ≤ 0.5) — the high-power choice.' + AVG);
