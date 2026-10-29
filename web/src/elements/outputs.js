// Output devices: RGB / bi-colour / IR / laser LEDs, LED bar-graph (LM3914),
// hex display, loudspeaker, piezo buzzer, solenoid and RC servo.

import { Element, TwoTerm, register, GRID } from './base.js';
import { LED } from './semis.js';
import { Capacitor } from './passive.js';
import { Digital } from './digital.js';
import { Composite, CycleMeter, withChip } from './kit.js';
import { fmtShort, fmtQty } from '../engine/units.js';

const G = GRID;

const RGB = { red: '255,50,50', green: '60,255,90', blue: '60,130,255' };

export class RGBLED extends Composite {
  static type = 'rgbled'; static title = 'RGB LED (common cathode)'; static category = 'Output';
  static prefix = 'LED'; static keywords = 'rgb led colour mixing common cathode tricolor';
  static props = [{ key: 'imax', label: 'Rated current (each)', unit: 'A', def: 0.02, min: 1e-4, max: 1, log: true }];
  static description = 'Three LEDs (red ≈2 V, green ≈2.2 V, blue ≈3 V) in one package with a common cathode — the glow mixes the three currents.';
  parts() { return ['red', 'green', 'blue'].map((c, i) => { const d = new LED(0, 0); d.p.color = c; return [d, [i, 3]]; }); }
  sync() { for (const s of this.subs || []) { s.el.p.imax = this.p.imax; s.el.onParamChange(); } }
  localPosts() { return [[-2 * G, -G], [-2 * G, 0], [-2 * G, G], [2 * G, 0]]; }
  localBox() { return [-2 * G, -1.5 * G, 2 * G, 1.5 * G]; }
  leads() { return [[0, -2 * G, -G, -0.8 * G, -0.5 * G], [1, -2 * G, 0, -0.9 * G, 0], [2, -2 * G, G, -0.8 * G, 0.5 * G], [3, 2 * G, 0, 0.9 * G, 0]]; }
  valueLabel() { return ''; }
  readings() { return ['Red', 'Green', 'Blue'].map((n, i) => [`I ${n.toLowerCase()}`, this.postCurrents[i], 'A']); }
  draw(g) {
    const im = this.p.imax, l = [0, 1, 2].map((i) => (g.running ? Math.max(0, Math.min(1.2, this.postCurrents[i] / im)) : 0));
    const tot = l[0] + l[1] + l[2];
    if (tot > 0.02) {
      const c = [0, 1, 2].map((k) => Math.round(Math.min(255, (l[0] * [255, 50, 50][k] + l[1] * [60, 255, 90][k] + l[2] * [60, 130, 255][k]) / Math.max(1, Math.max(...l)))));
      g.glow(0, 0, G * (1.3 + tot * 0.5), c.join(','), Math.min(1, 0.3 + tot * 0.5));
      g.circle(0, 0, 0.85 * G, { fill: `rgba(${c.join(',')},0.6)` });
    }
    g.circle(0, 0, 0.85 * G, { stroke: g.body, width: g.lw * 0.9 });
    ['R', 'G', 'B'].forEach((t, i) => g.text(t, -1.35 * G, (i - 1) * G - 0.35 * G, { size: 6.5, color: `rgb(${RGB[['red', 'green', 'blue'][i]]})`, bold: true }));
  }
}
register(RGBLED);

export class BicolorLED extends Composite {
  static type = 'bicolor'; static title = 'Bi-colour LED (2-lead)'; static category = 'Output';
  static prefix = 'LED'; static keywords = 'bicolor bi colour led red green polarity indicator two lead';
  static props = [{ key: 'imax', label: 'Rated current', unit: 'A', def: 0.02, min: 1e-4, max: 1, log: true }];
  static description = 'Red and green LEDs in anti-parallel: red lights for current left→right, green for right→left (yellow-ish on AC). A polarity indicator.';
  parts() { const r = new LED(0, 0); r.p.color = 'red'; const gr = new LED(0, 0); gr.p.color = 'green'; return [[r, [0, 1]], [gr, [1, 0]]]; }
  sync() { for (const s of this.subs || []) { s.el.p.imax = this.p.imax; s.el.onParamChange(); } }
  leads() { return [[0, -2 * G, 0, -0.85 * G, 0], [1, 2 * G, 0, 0.85 * G, 0]]; }
  localBox() { return [-2 * G, -G, 2 * G, G]; }
  valueLabel() { return ''; }
  readings() { const [r, gr] = this.subs.map((s) => s.el.i); return [['Red current', r, 'A'], ['Green current', gr, 'A']]; }
  draw(g) {
    const [r, gr] = this.subs.map((s) => (g.running ? Math.max(0, Math.min(1.2, s.el.i / this.p.imax)) : 0));
    if (r > 0.02) g.glow(0, 0, G * (1.2 + r), RGB.red, Math.min(1, 0.3 + r * 0.7));
    if (gr > 0.02) g.glow(0, 0, G * (1.2 + gr), RGB.green, Math.min(1, 0.3 + gr * 0.7));
    g.circle(0, 0, 0.85 * G, { stroke: g.body, width: g.lw * 0.9, fill: g.fill });
    g.poly([[-0.45 * G, -0.35 * G], [0.2 * G, -0.35 * G], [-0.12 * G, -0.02 * G]], { fill: `rgba(${RGB.red},0.8)` });
    g.poly([[0.45 * G, 0.35 * G], [-0.2 * G, 0.35 * G], [0.12 * G, 0.02 * G]], { fill: `rgba(${RGB.green},0.8)` });
  }
}
register(BicolorLED);

export class IRLED extends LED {
  static type = 'irled'; static title = 'Infrared LED (940 nm)';
  static keywords = 'ir led infrared emitter 940nm remote control transmitter';
  static props = LED.props.map((p) => (p.key === 'color' ? { ...p, def: 'ir' } : p.key === 'imax' ? { ...p, def: 0.05 } : p));
  static description = 'Infrared emitter (≈1.3 V forward): invisible to the eye — the glow here is shown in dark red. Used in remotes and optical sensors.';
}
register(IRLED);

export class LaserDiode extends LED {
  static type = 'laser'; static title = 'Laser Diode'; static keywords = 'laser diode 650nm red laser module pointer threshold current';
  static props = [...LED.props.map((p) => (p.key === 'color' ? { ...p, def: 'red', hidden: true } : p.key === 'imax' ? { ...p, def: 0.03 } : p)),
    { key: 'ith', label: 'Threshold current', unit: 'A', def: 0.02, min: 1e-4, max: 1, log: true }];
  static description = 'Laser diode: below the threshold current it only glows faintly (LED-like); above it, stimulated emission produces a sharp beam whose power rises steeply with current.';
  draw(g) {
    super.draw(g);
    if (g.running && this.i > this.p.ith) {
      const k = Math.min(1, (this.i - this.p.ith) / this.p.ith);
      g.line(0.6 * G, -0.6 * G, 3 * G, -1.8 * G, `rgba(255,40,40,${0.4 + 0.6 * k})`, 2 + 3 * k);
    }
  }
}
register(LaserDiode);

export class LEDBar extends Element {
  static type = 'vubar'; static title = 'LED Bar Graph (LM3914)'; static category = 'Output';
  static prefix = 'U'; static keywords = 'led bar graph lm3914 vu meter level indicator battery level dot bar';
  static props = [
    { key: 'vfs', label: 'Full-scale voltage', unit: 'V', def: 1.2, min: 0.01, max: 100, knob: true },
    { key: 'mode', label: 'Mode', type: 'select', def: 'bar', options: [['bar', 'Bar'], ['dot', 'Dot']] },
    { key: 'scale', label: 'Scale', type: 'select', def: 'lin', options: [['lin', 'Linear (LM3914)'], ['log', 'Log 3 dB/step (LM3916)']] },
  ];
  static description = 'Ten-LED level meter driver: segment k lights when Vin ≥ k/10 of full scale (linear) or at 3 dB steps (log, VU-meter style). High-impedance input.';
  constructor(x, y) { super(x, y); this.postCurrents = [0, 0]; }
  localPosts() { return [[-2 * G, 0], [-2 * G, 2 * G]]; }
  localBox() { return [-2 * G, -1.1 * G, 4 * G, 2.2 * G]; }
  leads() { return [[0, -2 * G, 0, -1.2 * G, 0], [1, -2 * G, 2 * G, -1.2 * G, 2 * G]]; }
  labelSide() { return [0, -1]; }
  stamp(s) { s.addG(this.nodes[0], this.nodes[1], 1e-9); }
  stampAC(ac) { ac.addY(this.nodes[0], this.nodes[1], 1e-9); }
  accept(s) { this.vin = s.v(this.nodes[0]) - s.v(this.nodes[1]); this.i = this.vin * 1e-9; this.postCurrents = [this.i, -this.i]; }
  level() {
    const v = this.vin || 0, f = this.p.vfs;
    if (this.p.scale === 'log') { let n = 0; for (let k = 1; k <= 10; k++) if (v >= f * Math.pow(10, (-3 * (10 - k)) / 20)) n = k; return n; }
    return Math.max(0, Math.min(10, Math.floor((v / f) * 10 + 1e-9)));
  }
  valueLabel() { return ''; }
  readings() { return [['Input', this.vin || 0, 'V'], ['Segments lit', this.level(), '']]; }
  draw(g) {
    g.box(-1.2 * G, -0.9 * G, 3.9 * G, 2.1 * G, { stroke: g.body, width: g.lw * 0.9, fill: '#0b0f14', r: 4 });
    const n = g.running ? this.level() : 0;
    for (let k = 0; k < 10; k++) {
      const x = -0.9 * G + k * 0.46 * G, on = this.p.mode === 'dot' ? k + 1 === n : k < n;
      const col = k < 6 ? '60,255,90' : k < 8 ? '255,210,60' : '255,60,60';
      g.box(x, -0.6 * G, x + 0.32 * G, 0.9 * G, { fill: on ? `rgb(${col})` : 'rgba(255,255,255,0.07)', r: 1.5 });
    }
    g.text('IN', -0.85 * G, 1.55 * G, { size: 6.5, color: g.muted, align: 'left' });
  }
}
register(LEDBar);

export class HexDisplay extends withChip(Digital) {
  static type = 'hexdisp'; static title = 'Hex Display (4-bit)'; static category = 'Output';
  static prefix = 'DS'; static keywords = 'hex display til311 binary display nibble digit';
  static pins = [['D0', 'L'], ['D1', 'L'], ['D2', 'L'], ['D3', 'L']];
  static props = [{ key: 'vdd', label: 'Logic high level', unit: 'V', def: 5, min: 0.5, max: 30 }];
  static description = 'Displays the 4-bit input as a hexadecimal digit 0–F (like the TIL311).';
  inputs() { return [0, 1, 2, 3]; }
  outputs() { return []; }
  connectivity() { return null; }
  compute() { return []; }
  val() { return (this.inState || []).reduce((a, b, i) => a | ((b ? 1 : 0) << i), 0); }
  readings(s) { return [['Value', this.val().toString(16).toUpperCase(), ''], ...[0, 1, 2, 3].map((i) => ['D' + i, s.v(this.nodes[i]), 'V'])]; }
  draw(g) {
    this.drawChip(g, '', { fill: '#0b0f14' });
    g.upright(() => g.text(g.running ? this.val().toString(16).toUpperCase() : '8', 0, 0, { size: 22, color: g.running ? '#ff3a3a' : 'rgba(255,255,255,0.12)', bold: true, mono: true }), 0.25 * G, 0.1 * G);
  }
}
register(HexDisplay);

// --------------------------------------------------------------- sound
export class Speaker extends TwoTerm {
  static type = 'speaker'; static title = 'Loudspeaker (8 Ω)'; static category = 'Output';
  static prefix = 'LS'; static keywords = 'speaker loudspeaker 8 ohm audio voice coil sound';
  static props = [
    { key: 're', label: 'Voice-coil resistance', unit: 'Ω', def: 6.5, min: 0.1, max: 1e3 },
    { key: 'le', label: 'Voice-coil inductance', unit: 'H', def: 0.3e-3, min: 1e-7, max: 1, log: true },
    { key: 'w', label: 'Power rating', unit: 'W', def: 1, min: 0.01, max: 1000, log: true },
  ];
  static description = 'Moving-coil speaker (Re + Le voice coil). Plays the detected fundamental frequency through the device speaker when sound is enabled; the cone moves with the current. Driven at much more than its power rating (or with DC straight from a battery) the voice coil burns open within seconds.';
  constructor(x, y) { super(x, y); this.m = new CycleMeter(0.1); }
  branchCount() { return 1; }
  reset() { this.il = 0; this.vl = 0; this.m = new CycleMeter(0.1); this.setCurrent(0); this.sounding = false; }
  /** voice coil R and L — a burnt coil is open */
  re() { return this.damaged ? 1e9 : this.p.re; }
  le() { return this.damaged ? 0 : this.p.le; }
  stamp(s) {
    const k = this.branches[0], [a, b] = this.nodes;
    s.addBranchKCL(a, b, k); s.addA(k, a - 1, 1); s.addA(k, b - 1, -1);
    s.addA(k, k, -(this.re() + (s.mode === 'dc' ? 0 : (s.method === 'be' ? 1 : 2) * this.le() / s.dt)));
  }
  stampStep(s) { if (s.mode !== 'dc') s.b[this.branches[0]] += s.method === 'be' ? -(this.le() / s.dt) * this.il : -(2 * this.le() / s.dt) * this.il - this.vl; }
  accept(s) {
    const i = s.x[this.branches[0]];
    this.vl = s.mode === 'dc' ? 0 : this.voltageDiff(s) - this.re() * i;
    this.il = i; this.setCurrent(i);
    if (s.mode === 'dc') return;
    // music peaks are fine; ≈2.5 × the rated power for a couple of seconds melts the voice coil
    this.overheat(s, (i * i * this.p.re) / this.p.w, 2, 2.5, () => `Voice coil burnt open — about ${fmtShort(this._hav * this.p.w, 'W')} in a ${fmtShort(this.p.w, 'W')} speaker`);
    this.m.push(s.t, s.dt, i);
    const f = this.m.f;
    this.sounding = this.m.vrms > 1e-3 && f > 20 && f < 16000;
    this.tone = f;
  }
  get soundTone() { return this.tone || 440; }
  stampAC(ac) { const k = this.branches[0], [a, b] = this.nodes; ac.addBranchKCL(a, b, k); ac.addA(k, a - 1, 1); ac.addA(k, b - 1, -1); ac.addA(k, k, -this.re(), -ac.omega * this.le()); }
  valueLabel() { return fmtShort(this.p.re + 1.5, 'Ω'); }
  readings() { return [['Current (RMS)', this.m.vrms, 'A'], ['Power (avg)', this.m.vrms ** 2 * this.p.re, 'W'], ['Frequency', this.m.f, 'Hz']]; }
  localBox() { return [-2 * G, -1.2 * G, 2 * G, 1.2 * G]; }
  leads() { return [[0, -2 * G, 0, -0.6 * G, 0.4 * G], [1, 2 * G, 0, 0.6 * G, 0.4 * G]]; }
  draw(g) {
    const d = g.running ? Math.max(-3, Math.min(3, (this.i / Math.sqrt(this.p.w / this.p.re)) * 3)) : 0;
    g.upright(() => {
      g.box(-0.3 * G, -0.35 * G, 0.3 * G, 0.35 * G, { stroke: g.body, width: g.lw * 0.9, fill: g.fill });
      g.poly([[-0.3 * G, -0.35 * G], [-0.85 * G + d, -1 * G], [0.85 * G + d, -1 * G], [0.3 * G, -0.35 * G]], { stroke: g.body, width: g.lw * 0.9, fill: g.fill, close: true });
    }, 0, 0.1 * G);
    if (g.running && this.sounding) g.glow(0, -0.6 * G, G, '34,211,238', 0.3);
  }
}
register(Speaker);

export class PiezoBuzzer extends Capacitor {
  static type = 'piezobuzz'; static title = 'Piezo Buzzer (passive)'; static category = 'Output';
  static prefix = 'BZ'; static keywords = 'piezo buzzer passive transducer beeper tone speaker disc';
  static props = [{ key: 'c', label: 'Capacitance', unit: 'F', def: 20e-9, min: 1e-12, max: 1e-5, log: true }, { key: 'ic', label: 'Initial voltage', unit: 'V', def: 0, min: -100, max: 100, hidden: true }];
  static description = 'Passive piezo transducer: electrically a capacitor. It sounds at the frequency you drive it with (unlike the active buzzer, it needs an AC / PWM signal).';
  constructor(x, y) { super(x, y); this.m = new CycleMeter(0.05); }
  reset() { super.reset(); this.m = new CycleMeter(0.05); this.sounding = false; }
  accept(s) {
    super.accept(s);
    if (s.mode === 'dc') return;
    this.m.push(s.t, s.dt, this.voltageDiff(s));
    const f = this.m.f, amp = Math.sqrt(Math.max(0, this.m.vrms ** 2 - this.m.vmean ** 2));
    this.sounding = amp > 0.3 && f > 50 && f < 20000; this.tone = f;
  }
  get soundTone() { return this.tone || 2000; }
  valueLabel() { return ''; }
  readings(s) { return [['Drive frequency', this.m.f, 'Hz'], ['Voltage', this.voltageDiff(s), 'V'], ['Sounding', this.sounding ? 'yes' : 'no', '']]; }
  leads() { return [[0, -2 * G, 0, -0.8 * G, 0], [1, 2 * G, 0, 0.8 * G, 0]]; }
  draw(g) {
    g.circle(0, 0, 0.8 * G, { stroke: g.body, width: g.lw * 0.9, fill: g.fill });
    g.circle(0, 0, 0.45 * G, { stroke: g.muted, width: g.lw * 0.6 });
    if (g.running && this.sounding) g.glow(0, 0, 1.3 * G, '255,200,80', 0.5);
  }
}
register(PiezoBuzzer);

export class Solenoid extends TwoTerm {
  static type = 'solenoid'; static title = 'Solenoid Actuator'; static category = 'Output';
  static prefix = 'Y'; static keywords = 'solenoid actuator plunger valve lock electromagnet door lock';
  static props = [
    { key: 'r', label: 'Coil resistance', unit: 'Ω', def: 20, min: 0.1, max: 1e5, log: true },
    { key: 'l', label: 'Coil inductance', unit: 'H', def: 0.05, min: 1e-6, max: 100, log: true },
    { key: 'ipull', label: 'Pull-in current', unit: 'A', def: 0.4, min: 1e-4, max: 100, log: true },
  ];
  static description = 'Pull-type solenoid: an R–L coil whose plunger pulls in when the current exceeds the pull-in value (drop-out at 50 %). Remember the flyback diode!';
  branchCount() { return 1; }
  reset() { this.il = 0; this.vl = 0; this.pulled = false; this.setCurrent(0); }
  stamp(s) {
    const k = this.branches[0], [a, b] = this.nodes;
    s.addBranchKCL(a, b, k); s.addA(k, a - 1, 1); s.addA(k, b - 1, -1);
    s.addA(k, k, -(this.p.r + (s.mode === 'dc' ? 0 : (s.method === 'be' ? 1 : 2) * this.p.l / s.dt)));
  }
  stampStep(s) { if (s.mode !== 'dc') s.b[this.branches[0]] += s.method === 'be' ? -(this.p.l / s.dt) * this.il : -(2 * this.p.l / s.dt) * this.il - this.vl; }
  accept(s) {
    const i = s.x[this.branches[0]];
    this.vl = s.mode === 'dc' ? 0 : this.voltageDiff(s) - this.p.r * i;
    this.il = i; this.setCurrent(i);
    const a = Math.abs(i);
    this.pulled = this.pulled ? a > this.p.ipull * 0.5 : a > this.p.ipull;
  }
  stampAC(ac) { const k = this.branches[0], [a, b] = this.nodes; ac.addBranchKCL(a, b, k); ac.addA(k, a - 1, 1); ac.addA(k, b - 1, -1); ac.addA(k, k, -this.p.r, -ac.omega * this.p.l); }
  valueLabel() { return ''; }
  readings(s) { return [['Plunger', this.pulled ? 'Pulled in' : 'Released', ''], ['Coil current', this.i, 'A'], ['Voltage', this.voltageDiff(s), 'V']]; }
  localBox() { return [-2 * G, -1.2 * G, 2 * G, 0.7 * G]; }
  draw(g) {
    g.box(-G, -0.5 * G, G, 0.5 * G, { stroke: g.grad(-G, 0, G, 0, g.pv(0), g.pv(1)), width: g.lw, fill: g.fill, r: 2 });
    for (let k = -3; k <= 3; k++) g.line(k * 0.28 * G, -0.5 * G, k * 0.28 * G + 3, 0.5 * G, g.muted, g.lw * 0.4);
    const x = this.pulled && g.running ? 0.1 * G : 0.9 * G;
    g.box(x - 0.2 * G, -1.05 * G, x + 1.1 * G, -0.7 * G, { fill: '#94a3b8', r: 2 });
  }
}
register(Solenoid);

export class Servo extends Element {
  static type = 'servo'; static title = 'RC Servo Motor'; static category = 'Output';
  static prefix = 'M'; static keywords = 'servo motor rc servo sg90 pwm position control arduino';
  static props = [
    { key: 'tmin', label: 'Pulse for 0°', unit: 's', def: 1e-3, min: 1e-4, max: 5e-3 },
    { key: 'tmax', label: 'Pulse for 180°', unit: 's', def: 2e-3, min: 1e-4, max: 5e-3 },
    { key: 'speed', label: 'Slew rate', unit: '°/s', def: 600, min: 1, max: 1e5, log: true },
  ];
  static description = 'Hobby servo: measures the width of each high pulse on SIG (1–2 ms, typically every 20 ms) and turns its arm to 0–180° at a limited speed. Input impedance ≈10 kΩ.';
  constructor(x, y) { super(x, y); this.postCurrents = [0, 0]; }
  localPosts() { return [[-2 * G, 0], [-2 * G, 2 * G]]; }
  localBox() { return [-2 * G, -1.4 * G, 1.8 * G, 2.2 * G]; }
  leads() { return [[0, -2 * G, 0, -1.2 * G, 0], [1, -2 * G, 2 * G, -1.2 * G, 2 * G]]; }
  reset() { this.ang = 90; this.target = 90; this.hi = false; this.t0 = 0; this.pw = 0; }
  stamp(s) { s.addG(this.nodes[0], this.nodes[1], 1e-4); }
  stampAC(ac) { ac.addY(this.nodes[0], this.nodes[1], 1e-4); }
  accept(s) {
    const v = s.v(this.nodes[0]) - s.v(this.nodes[1]);
    this.i = v * 1e-4; this.postCurrents = [this.i, -this.i];
    if (s.mode === 'dc') return;
    const hi = this.hi ? v > 1.0 : v > 1.5;
    if (hi && !this.hi) this.t0 = s.t;
    if (!hi && this.hi) {
      this.pw = s.t - this.t0;
      if (this.pw > 2e-4 && this.pw < 5e-3) this.target = Math.max(0, Math.min(180, ((this.pw - this.p.tmin) / (this.p.tmax - this.p.tmin)) * 180));
    }
    this.hi = hi;
    const d = this.target - this.ang, m = this.p.speed * s.dt;
    this.ang += Math.abs(d) <= m ? d : Math.sign(d) * m;
  }
  valueLabel() { return fmtQty(Math.round(this.ang ?? 90), '°'); }
  readings() { return [['Angle', this.ang ?? 90, '°'], ['Commanded', this.target ?? 90, '°'], ['Last pulse width', this.pw || 0, 's']]; }
  draw(g) {
    g.box(-1.2 * G, -1.2 * G, 1.6 * G, 2 * G, { stroke: g.body, width: g.lw * 0.9, fill: g.fill, r: 4 });
    g.upright(() => {
      const a = (((this.ang ?? 90) - 90) * Math.PI) / 180;
      g.circle(0, 0, 0.25 * G, { fill: g.body });
      g.line(0, 0, Math.sin(a) * 0.9 * G, -Math.cos(a) * 0.9 * G, g.accent, g.lw * 1.6);
    }, 0.2 * G, 0.1 * G);
    g.text('SIG', -0.95 * G, 0, { size: 6.5, color: g.muted, align: 'left' });
    g.text('GND', -0.95 * G, 1.6 * G, { size: 6.5, color: g.muted, align: 'left' });
  }
}
register(Servo);
