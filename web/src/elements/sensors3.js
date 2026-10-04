// Industrial and module sensors:
//  - 3-wire proximity sensors (inductive, capacitive, photoelectric) with
//    PNP/NPN, NO/NC outputs, sensing range, hysteresis and a supply window
//  - 2-wire 4–20 mA loop-powered transmitters (level, pressure, temperature,
//    flow) with lift-off voltage
//  - conventional 2-wire smoke detector (latching alarm current)
//  - gyroscope, 6-axis IMU, NDIR CO2, sound module, colour sensor (TCS3200),
//    ultrasonic HC-SR04 (trigger/echo) and a linear quadrature encoder
// All are behavioural models with physically meaningful terminal behaviour.

import { Element, register, GRID } from './base.js';
import { ThreePinSensor } from './sensors.js';
import { mod, RotaryEncoder } from './sensors2.js';
import { NL2 } from './semis2.js';
import { withChip } from './kit.js';
import { Chip, P } from './digital2.js';
import { DIGI_PROPS } from './digital.js';
import { fmtQty, fmtShort } from '../engine/units.js';

const G = GRID;
const TAU = 2 * Math.PI;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// ------------------------------------------------ 3-wire proximity sensors
const OUT_OPTS = [['PNP-NO', 'PNP (sourcing), normally open'], ['PNP-NC', 'PNP (sourcing), normally closed'], ['NPN-NO', 'NPN (sinking), normally open'], ['NPN-NC', 'NPN (sinking), normally closed']];
const RON = 30; // output transistor on-resistance (≈1.5–2 V drop at 50–60 mA)

/** BN (+V, top) / BK (output, right) / BU (0 V, bottom). */
class Prox3 extends ThreePinSensor {
  static category = 'Sensors';
  static prefix = 'B';
  static tag = 'PROX';
  branchCount() { return 0; }
  detect() { return false; }
  pnp() { return String(this.p.out).startsWith('PNP'); }
  nc() { return String(this.p.out).endsWith('NC'); }
  reset() { this.det = this.detect(false); this.pw = true; this.on = this.pw && this.det !== this.nc(); this.postCurrents.fill(0); }
  gsw() { return this.on ? 1 / RON : 1e-8; }
  stamp(s) {
    const [vcc, out, gnd] = this.nodes;
    s.addG(vcc, gnd, 1 / 2400); // ≈10 mA quiescent at 24 V
    s.addG(out, this.pnp() ? vcc : gnd, this.gsw());
  }
  stampAC(ac) { const [vcc, out, gnd] = this.nodes; ac.addY(vcc, gnd, 1 / 2400); ac.addY(out, this.pnp() ? vcc : gnd, this.gsw()); }
  preStep(s) {
    const vs = s.v(this.nodes[0]) - s.v(this.nodes[2]);
    // 10–30 V DC sensor: switches off below ≈8 V (with 2 V hysteresis)
    this.pw = this.pw ? vs > 8 : vs > 10;
    this.det = this.detect(this.det);
    const on = this.pw && this.det !== this.nc();
    if (on !== this.on) { this.on = on; s.markEvent(); }
  }
  accept(s) {
    const [vcc, out, gnd] = this.nodes, iq = (s.v(vcc) - s.v(gnd)) / 2400, g = this.gsw();
    if (this.pnp()) { const i = (s.v(vcc) - s.v(out)) * g; this.postCurrents = [iq + i, -i, -iq]; } else { const i = (s.v(out) - s.v(gnd)) * g; this.postCurrents = [iq, i, -iq - i]; }
    this.i = this.postCurrents[1];
  }
  readings(s) {
    const k = this.knobProp();
    return [[k.label, this.p[k.key], k.unit], ['Target detected', this.det ? 'yes' : 'no', ''], ['Output', this.on ? 'ON' : 'off', ''],
      ['Supply', s.v(this.nodes[0]) - s.v(this.nodes[2]), 'V'], ['Load current', Math.abs(this.postCurrents[1] || 0), 'A']];
  }
  valueLabel() { const k = this.knobProp(); return `${fmtQty(this.p[k.key], k.unit)} ${this.p.out}`; }
  draw(g) {
    // barrel body with the sensing face on the left
    g.box(-1.8 * G, -G, 0.8 * G, G, { stroke: g.body, width: g.lw * 0.9, fill: g.fill, r: 4 });
    g.box(-1.8 * G, -0.75 * G, -1.45 * G, 0.75 * G, { stroke: g.body, width: g.lw * 0.6, fill: g.accent + '33', r: 2 });
    const side = g.rot & 1;
    g.text(this.constructor.tag, -0.45 * G, side ? 0 : -0.35 * G, { size: 8, color: g.accent, bold: true, maxW: side ? 1.6 * G : 2 * G });
    g.text(this.p.out, -0.45 * G, 0.4 * G, { size: 5.5, color: g.muted, maxW: 2 * G });
    g.text('BN', -0.6 * G, -1.35 * G, { size: 6.5, color: '#a0522d', align: 'left', bold: true });
    g.text('BU', -0.6 * G, 1.35 * G, { size: 6.5, color: '#3b82f6', align: 'left', bold: true });
    g.text('BK', 1.4 * G, -0.35 * G, { size: 6.5, color: g.muted, bold: true });
    g.circle(0.45 * G, -0.65 * G, 2.6, { fill: this.on && g.running ? '#f59e0b' : g.lo });
  }
}

const RANGE_HYST = 1.1; // releases at 110 % of the switching distance
function proxDetect(d, sr, prev) { return prev ? d <= sr * RANGE_HYST : d <= sr; }

const IND_MAT = { 'Mild steel (Fe 360)': 1, 'Stainless steel': 0.7, Brass: 0.45, Aluminium: 0.4, Copper: 0.35 };
export class InductiveProx extends Prox3 {
  static type = 'proxind'; static title = 'Inductive Proximity Sensor'; static tag = 'IND';
  static keywords = 'inductive proximity sensor 3 wire pnp npn metal detection m18 m12 industrial plc';
  static props = [
    { key: 'd', label: 'Target distance', unit: 'mm', def: 20, min: 0, max: 100, knob: true },
    { key: 'sn', label: 'Rated sensing distance Sn', unit: 'mm', def: 8, min: 0.5, max: 60 },
    { key: 'mat', label: 'Target material', type: 'select', def: 'Mild steel (Fe 360)', options: Object.keys(IND_MAT).map((k) => [k, k]) },
    { key: 'out', label: 'Output', type: 'select', def: 'PNP-NO', options: OUT_OPTS },
  ];
  static description = 'Three-wire inductive proximity switch (10–30 V DC) for metal targets: switches when the target comes within the real sensing distance Sr = Sn × material factor (steel 1, stainless 0.7, brass 0.45, aluminium 0.4, copper 0.35) and releases at 110 % of it. PNP output sources +V into a load to 0 V; NPN sinks a load from +V to 0 V. BN = +V, BK = output, BU = 0 V.';
  detect(prev) { return proxDetect(this.p.d, this.p.sn * (IND_MAT[this.p.mat] ?? 1), prev); }
}
register(InductiveProx);

const CAP_MAT = { 'Water / wet material': 1, Metal: 1, Wood: 0.6, Glass: 0.5, 'Plastic (PVC)': 0.4, 'Paper / cardboard': 0.3, Oil: 0.15 };
export class CapacitiveProx extends Prox3 {
  static type = 'proxcap'; static title = 'Capacitive Proximity Sensor'; static tag = 'CAP';
  static keywords = 'capacitive proximity sensor level detection non metal grain water liquid bin 3 wire pnp npn';
  static props = [
    { key: 'd', label: 'Target distance', unit: 'mm', def: 30, min: 0, max: 100, knob: true },
    { key: 'sn', label: 'Rated sensing distance Sn (sensitivity)', unit: 'mm', def: 15, min: 1, max: 60 },
    { key: 'mat', label: 'Target material', type: 'select', def: 'Water / wet material', options: Object.keys(CAP_MAT).map((k) => [k, k]) },
    { key: 'out', label: 'Output', type: 'select', def: 'PNP-NO', options: OUT_OPTS },
  ];
  static description = 'Three-wire capacitive proximity switch: detects metals and non-metals (water, grain, plastic, wood…) through the change in capacitance — used for level detection through a tank wall. The real sensing distance scales with the material’s dielectric effect (water 1, wood 0.6, glass 0.5, plastic 0.4, paper 0.3, oil 0.15).';
  detect(prev) { return proxDetect(this.p.d, this.p.sn * (CAP_MAT[this.p.mat] ?? 1), prev); }
}
register(CapacitiveProx);

export class PhotoSensor extends Prox3 {
  static type = 'photoeye'; static title = 'Photoelectric Sensor'; static tag = 'PHOTO';
  static keywords = 'photoelectric sensor photo eye diffuse retroreflective through beam light on dark on conveyor counting';
  static props = [
    { key: 'd', label: 'Object distance', unit: 'mm', def: 1000, min: 0, max: 20000, knob: true },
    { key: 'mode', label: 'Type', type: 'select', def: 'diffuse', options: [['diffuse', 'Diffuse (object reflects the light)'], ['retro', 'Retro-reflective (object breaks the beam)'], ['through', 'Through-beam (object breaks the beam)']] },
    { key: 'sn', label: 'Range / distance to reflector or receiver', unit: 'mm', def: 300, min: 10, max: 20000, log: true },
    { key: 'op', label: 'Operation', type: 'select', def: 'light', options: [['light', 'Light-on (output ON when light is received)'], ['dark', 'Dark-on (output ON when light is blocked)']] },
    { key: 'out', label: 'Output', type: 'select', def: 'PNP-NO', options: OUT_OPTS },
  ];
  static description = 'Three-wire photoelectric sensor. Diffuse: the light reaches the receiver when an object within range reflects it. Retro-reflective / through-beam: an object anywhere closer than the reflector / receiver blocks the beam. Light-on mode switches the output on when light is received, dark-on when it is blocked — the standard choice for conveyor counting and position detection.';
  detect(prev) {
    const near = proxDetect(this.p.d, this.p.sn, prev);
    const light = this.p.mode === 'diffuse' ? near : !near;
    return this.p.op === 'dark' ? !light : light;
  }
  readings(s) { const r = super.readings(s); r[1] = ['Light received', (this.det !== (this.p.op === 'dark')) ? 'yes' : 'no', '']; return r; }
}
register(PhotoSensor);

// ------------------------------------------- 4–20 mA loop transmitters
class Transmitter extends NL2 {
  static category = 'Sensors';
  static prefix = 'TT';
  static tag = 'TT';
  static quantity = { key: 'x', label: 'Measured value', unit: '', def: 50, min: 0, max: 100, knob: true };
  static range = [0, 100];
  maxStep = 2;
  static make() {
    const q = this.quantity, [lo, hi] = this.range;
    return [
      { ...q, min: Math.min(q.min, lo), max: Math.max(q.max, hi) },
      { key: 'lo', label: 'Range low (4 mA)', unit: q.unit, def: lo, min: -1e6, max: 1e6 },
      { key: 'hi', label: 'Range high (20 mA)', unit: q.unit, def: hi, min: -1e6, max: 1e6 },
      { key: 'vmin', label: 'Minimum loop voltage (lift-off)', unit: 'V', def: 10, min: 1, max: 40 },
    ];
  }
  span() { const q = this.p, d = q.hi - q.lo; return Math.abs(d) > 1e-12 ? (q.x - q.lo) / d : 0; }
  iset() { return clamp(0.004 + 0.016 * this.span(), 0.0038, 0.0205); }
  iv(v) {
    if (v <= 0) return { i: v * 1e-9, g: 1e-9 }; // reverse-polarity protected
    const I = this.iset(), k = 3 / this.p.vmin, t = Math.tanh(k * v);
    return { i: I * t + v * 1e-7, g: I * k * (1 - t * t) + 1e-7 };
  }
  valueLabel() { const q = this.constructor.quantity; return `${fmtQty(this.p.x, q.unit)}`; }
  readings(s) {
    const v = this.voltageDiff(s);
    return [[this.constructor.quantity.label, this.p.x, this.constructor.quantity.unit], ['Loop current', this.i, 'A'], ['Signal', clamp(this.span(), -0.0125, 1.03) * 100, '%'],
      ['Terminal voltage', v, 'V'], ['Status', v < this.p.vmin * 0.95 ? 'loop voltage too low' : 'OK', '']];
  }
  leads() { return [[0, -2 * G, 0, -0.9 * G, 0], [1, 2 * G, 0, 0.9 * G, 0]]; }
  localBox() { return [-2 * G, -1.1 * G, 2 * G, 1.1 * G]; }
  draw(g) {
    g.circle(0, 0, 0.9 * G, { stroke: g.body, width: g.lw * 0.9, fill: g.fill });
    g.line(-0.9 * G, 0, 0.9 * G, 0, g.body, g.lw * 0.5);
    g.upright(() => { g.text(this.constructor.tag, 0, -0.38 * G, { size: 8, color: g.accent, bold: true }); g.text('4-20', 0, 0.4 * G, { size: 5.5, color: g.muted }); });
    g.text('+', -1.45 * G, -0.55 * G, { size: 10, color: g.pos, bold: true });
  }
}

function transmitter(type, title, tag, quantity, range, keywords, desc) {
  const C = class extends Transmitter {};
  Object.assign(C, { type, title, tag, quantity, range, keywords, description: desc + ' Two-wire, loop-powered: it regulates the loop current to 4 mA at the range low and 20 mA at the range high (3.8–20.5 mA limits), as long as at least the lift-off voltage (≈10 V) is left across it. Put it in series with a 24 V supply and a 250 Ω receiver resistor (1–5 V) or a PLC analog input.' });
  C.props = C.make();
  register(C);
  return C;
}
transmitter('ltx', 'Level Transmitter (4–20 mA)', 'LT', { key: 'x', label: 'Level', unit: 'm', def: 2.5, min: 0, max: 10, knob: true }, [0, 5],
  'level transmitter 4-20 ma hydrostatic tank level loop powered two wire process instrument', 'Hydrostatic tank level transmitter.');
transmitter('ptx', 'Pressure Transmitter (4–20 mA)', 'PT', { key: 'x', label: 'Pressure', unit: 'bar', def: 5, min: 0, max: 40, knob: true }, [0, 10],
  'pressure transmitter 4-20 ma gauge pressure loop powered two wire process instrument', 'Gauge pressure transmitter.');
transmitter('ttx', 'Temperature Transmitter (4–20 mA)', 'TT', { key: 'x', label: 'Temperature', unit: '°C', def: 75, min: -50, max: 400, knob: true }, [0, 150],
  'temperature transmitter 4-20 ma rtd pt100 head mounted loop powered two wire', 'RTD temperature transmitter.');
transmitter('ftx', 'Flow Transmitter (4–20 mA)', 'FT', { key: 'x', label: 'Flow', unit: 'm³/h', def: 50, min: 0, max: 500, knob: true }, [0, 100],
  'flow transmitter 4-20 ma electromagnetic flow meter loop powered', 'Flow transmitter (magnetic flow meter).');

// ------------------------------------------------------- smoke detector
export class SmokeDetector extends NL2 {
  static type = 'smoke'; static title = 'Smoke Detector (2-wire)'; static category = 'Sensors';
  static prefix = 'SD'; static keywords = 'smoke detector fire alarm conventional 2 wire optical photoelectric zone fire panel';
  static props = [
    { key: 'smoke', label: 'Smoke density (obscuration)', unit: '%/m', def: 0, min: 0, max: 20, knob: true },
    { key: 'th', label: 'Alarm threshold', unit: '%/m', def: 3, min: 0.5, max: 15 },
    { key: 'va', label: 'Alarm clamp voltage', unit: 'V', def: 6, min: 2, max: 20 },
    { key: 'ra', label: 'Alarm resistance', unit: 'Ω', def: 10, min: 1, max: 1e4, log: true },
    { key: 'iq', label: 'Standby current at 24 V', unit: 'A', def: 6e-5, min: 1e-6, max: 0.01, log: true },
  ];
  static description = 'Conventional optical smoke detector for a fire-alarm zone (+ / −, 9–33 V): in standby it draws ≈60 µA; when smoke exceeds the threshold it latches into alarm, clamping the line to ≈6 V and drawing a large current (limited by the panel’s zone resistor) — the panel detects the current rise. The red LED lights in alarm. It resets only when the panel removes the zone power.';
  maxStep = 2;
  reset() { super.reset(); this.alarm = false; this.offT = 0; }
  iv(v) {
    if (v <= 0) return { i: v * 1e-9, g: 1e-9 };
    const g0 = this.p.iq / 24;
    if (!this.alarm) return { i: v * g0, g: g0 };
    // smooth knee (softplus) above the clamp voltage
    const vt = 0.15, x = (v - this.p.va) / vt, sp = x > 30 ? x : Math.log1p(Math.exp(x)), sg = 1 / (1 + Math.exp(-x));
    return { i: v * g0 + (vt * sp) / this.p.ra, g: g0 + sg / this.p.ra };
  }
  accept(s) {
    super.accept(s);
    if (s.mode === 'dc') return;
    const v = this.voltageDiff(s);
    if (!this.alarm && v > 8 && this.p.smoke >= this.p.th) { this.alarm = true; s.markEvent(); }
    if (this.alarm) {
      this.offT = v < 2 ? this.offT + s.dt : 0;
      if (this.offT > 0.1) { this.alarm = false; this.offT = 0; s.markEvent(); }
    }
  }
  valueLabel() { return this.alarm ? 'ALARM' : fmtQty(this.p.smoke, '%/m'); }
  readings(s) { return [['Smoke', this.p.smoke, '%/m'], ['State', this.alarm ? 'ALARM (latched)' : 'standby', ''], ['Line voltage', this.voltageDiff(s), 'V'], ['Current', this.i, 'A']]; }
  leads() { return [[0, -2 * G, 0, -G, 0], [1, 2 * G, 0, G, 0]]; }
  localBox() { return [-2 * G, -1.1 * G, 2 * G, 1.1 * G]; }
  draw(g) {
    g.circle(0, 0, G, { stroke: g.body, width: g.lw * 0.9, fill: g.fill });
    g.circle(0, 0, 0.6 * G, { stroke: g.muted, width: g.lw * 0.5 });
    for (let k = 0; k < 6; k++) { const a = (k * Math.PI) / 3; g.line(Math.cos(a) * 0.62 * G, Math.sin(a) * 0.62 * G, Math.cos(a) * 0.9 * G, Math.sin(a) * 0.9 * G, g.muted, g.lw * 0.5); }
    g.upright(() => g.text('SD', 0, 0, { size: 8, color: g.accent, bold: true }));
    const on = this.alarm && g.running;
    g.circle(0.55 * G, -0.55 * G, 3, { fill: on ? '#ef4444' : g.lo });
    if (on) g.glow(0.55 * G, -0.55 * G, 0.6 * G, '239,68,68', 0.5);
    g.text('+', -1.45 * G, -0.55 * G, { size: 10, color: g.pos, bold: true });
  }
}
register(SmokeDetector);

// ----------------------------------------------- analog module sensors
mod('gyro', 'Gyroscope (analog yaw rate)', 'GYRO', { key: 'w', label: 'Rotation rate', unit: '°/s', def: 0, min: -400, max: 400, knob: true },
  function () { return { r: clamp(0.5 + 0.001 * this.p.w, 0.02, 0.98), c: 0 }; }, 'gyroscope gyro angular rate yaw sensor mems adxrs',
  'MEMS rate gyro (one axis): ratiometric output Vcc/2 at rest, 5 mV per °/s at 5 V (0.1 % of Vcc per °/s), clamped near the rails beyond ±480 °/s.');
mod('co2', 'CO₂ Sensor (NDIR, analog)', 'CO2', { key: 'ppm', label: 'CO₂ concentration', unit: 'ppm', def: 800, min: 0, max: 5000, knob: true },
  function () { return { r: 0, c: 0.4 + (1.6 * clamp(this.p.ppm, 0, 5000)) / 5000 }; }, 'co2 sensor carbon dioxide ndir mh-z19 air quality ventilation',
  'NDIR carbon-dioxide sensor with analog output (MH-Z19 style): 0.4 V at 0 ppm to 2.0 V at 5000 ppm, linear. Fresh air ≈ 420 ppm; above 1000 ppm the room needs ventilation.');

export class SoundModule extends ThreePinSensor {
  static type = 'soundmod'; static title = 'Sound Sensor Module (analog)'; static category = 'Sensors';
  static keywords = 'sound sensor module microphone amplifier ky-038 max4466 clap detector noise level';
  static props = [
    { key: 'spl', label: 'Sound level', unit: 'dB SPL', def: 70, min: 30, max: 120, knob: true },
    { key: 'freq', label: 'Tone frequency', unit: 'Hz', def: 1000, min: 20, max: 20000, log: true },
    { key: 'gain', label: 'Output at 94 dB SPL', unit: 'V', def: 0.5, min: 0.001, max: 5, log: true },
  ];
  static description = 'Electret microphone with an amplifier (MAX4466 / KY-038 style): output idles at Vcc/2 and carries the sound waveform; the amplitude (peak) is “Output at 94 dB” × 10^((L − 94)/20), clipped at the rails. 60 dB is speech, 94 dB = 1 Pa.';
  amp() { return this.p.gain * Math.pow(10, (this.p.spl - 94) / 20); }
  stamp(s) {
    const [vcc, out, gnd] = this.nodes, k = this.branches[0];
    s.addG(vcc, gnd, 1 / 8e4);
    s.addBranchKCL(out, gnd, k); s.addA(k, out - 1, 1); s.addA(k, gnd - 1, -0.5); s.addA(k, vcc - 1, -0.5); s.addA(k, k, -100);
  }
  stampStep(s) {
    if (s.mode === 'dc') return;
    const vs = s.v(this.nodes[0]) - s.v(this.nodes[2]), lim = Math.max(0, vs / 2 - 0.05);
    s.b[this.branches[0]] += clamp(this.amp() * Math.sin(TAU * this.p.freq * s.tNext), -lim, lim);
  }
  stampAC(ac) {
    const [vcc, out, gnd] = this.nodes, k = this.branches[0];
    ac.addY(vcc, gnd, 1 / 8e4);
    ac.addBranchKCL(out, gnd, k); ac.addA(k, out - 1, 1); ac.addA(k, gnd - 1, -0.5); ac.addA(k, vcc - 1, -0.5); ac.addA(k, k, -100);
  }
  readings(s) { return [['Sound level', this.p.spl, 'dB SPL'], ['Signal amplitude', this.amp(), 'V'], ['Vout', s.v(this.nodes[1]) - s.v(this.nodes[2]), 'V']]; }
  draw(g) { this.drawBox(g, 'SOUND'); }
}
register(SoundModule);

// ------------------------------------------------------------ 6-axis IMU
export class IMU6 extends withChip(Element) {
  static type = 'imu'; static title = 'IMU (6-axis, analog outputs)'; static category = 'Sensors';
  static prefix = 'U'; static keywords = 'imu inertial measurement unit 6 axis accelerometer gyroscope tilt roll pitch mpu6050 drone balance robot';
  static props = [
    { key: 'roll', label: 'Roll angle', unit: '°', def: 0, min: -180, max: 180, knob: true },
    { key: 'pitch', label: 'Pitch angle', unit: '°', def: 0, min: -90, max: 90 },
    { key: 'lin', label: 'Extra forward acceleration', unit: 'g', def: 0, min: -3, max: 3 },
    { key: 'gx', label: 'Roll rate', unit: '°/s', def: 0, min: -400, max: 400 },
    { key: 'gy', label: 'Pitch rate', unit: '°/s', def: 0, min: -400, max: 400 },
    { key: 'gz', label: 'Yaw rate', unit: '°/s', def: 0, min: -400, max: 400 },
  ];
  static pins = [['VCC', 'L'], ['GND', 'L'], ['AX', 'R'], ['AY', 'R'], ['AZ', 'R'], ['GX', 'R'], ['GY', 'R'], ['GZ', 'R']];
  static chipOpts = { dense: true };
  static description = 'Six-axis inertial sensor with ratiometric analog outputs (Vcc/2 = zero): the accelerometer measures gravity resolved into the board axes — ax = sin(pitch) + forward acceleration, ay = −sin(roll)·cos(pitch), az = cos(roll)·cos(pitch) — at 10 % of Vcc per g; the gyro outputs 0.1 % of Vcc per °/s. Set the tilt and rotation rates to see what a balancing robot or drone controller reads.';
  constructor(x, y) { super(x, y); this.postCurrents = new Array(8).fill(0); }
  connectivity() { return [[0, 1, 2, 3, 4, 5, 6, 7]]; }
  branchCount() { return 6; }
  axes() {
    const r = (this.p.roll * Math.PI) / 180, p = (this.p.pitch * Math.PI) / 180;
    return [Math.sin(p) + this.p.lin, -Math.sin(r) * Math.cos(p), Math.cos(r) * Math.cos(p), this.p.gx, this.p.gy, this.p.gz];
  }
  ratios() { return this.axes().map((v, k) => clamp(0.5 + (k < 3 ? 0.1 : 0.001) * v, 0.02, 0.98)); }
  stamp(s) {
    const [vcc, gnd] = this.nodes, rr = this.ratios();
    s.addG(vcc, gnd, 1 / 1e3);
    for (let k = 0; k < 6; k++) {
      const o = this.nodes[2 + k], br = this.branches[k];
      s.addBranchKCL(o, gnd, br); s.addA(br, o - 1, 1); s.addA(br, gnd - 1, -1 + rr[k]); s.addA(br, vcc - 1, -rr[k]); s.addA(br, br, -100);
    }
  }
  stampAC(ac) {
    const [vcc, gnd] = this.nodes, rr = this.ratios();
    ac.addY(vcc, gnd, 1 / 1e3);
    for (let k = 0; k < 6; k++) { const o = this.nodes[2 + k], br = this.branches[k]; ac.addBranchKCL(o, gnd, br); ac.addA(br, o - 1, 1); ac.addA(br, gnd - 1, -1 + rr[k]); ac.addA(br, vcc - 1, -rr[k]); ac.addA(br, br, -100); }
  }
  accept(s) {
    const io = this.branches.map((b) => s.x[b]), iq = (s.v(this.nodes[0]) - s.v(this.nodes[1])) / 1e3;
    this.postCurrents = [iq, -iq - io.reduce((a, b) => a + b, 0), ...io];
  }
  valueLabel() { return `roll ${Math.round(this.p.roll)}°`; }
  readings(s) {
    const a = this.axes();
    return [['ax', a[0], 'g'], ['ay', a[1], 'g'], ['az', a[2], 'g'], ['Roll rate', a[3], '°/s'], ['Pitch rate', a[4], '°/s'], ['Yaw rate', a[5], '°/s'], ['V(AZ)', s.v(this.nodes[4]) - s.v(this.nodes[1]), 'V']];
  }
  draw(g) { this.drawChip(g, 'IMU'); }
}
register(IMU6);

// ------------------------------------------------- colour sensor TCS3200
const FILT = { '00': 'R', '01': 'B', '11': 'G', '10': 'C' };
export class ColorSensor extends Chip {
  static type = 'colorsens'; static title = 'Colour Sensor (TCS3200)'; static category = 'Sensors';
  static chip = 'TCS3200'; static keywords = 'colour color sensor tcs3200 tcs230 rgb light to frequency sorting machine';
  static pins = [P('S2', 'L', 'i'), P('S3', 'L', 'i'), P('OUT', 'R', 'o')];
  static props = [
    { key: 'r', label: 'Red', unit: '', def: 200, min: 0, max: 255, knob: true },
    { key: 'gr', label: 'Green', unit: '', def: 60, min: 0, max: 255 },
    { key: 'b', label: 'Blue', unit: '', def: 40, min: 0, max: 255 },
    { key: 'fs', label: 'Full-scale frequency (20 % scaling)', unit: 'Hz', def: 12000, min: 100, max: 600000, log: true },
    ...DIGI_PROPS,
  ];
  static description = 'Light-to-frequency colour sensor: S2/S3 select the photodiode filter (LL red, LH blue, HH green, HL clear) and OUT is a 50 % square wave whose frequency is proportional to that colour’s intensity (full scale at 255). Measure the three frequencies to identify the object colour.';
  resetState() { this.ph = 0; this.f = 0; }
  chan(ins) { return FILT[`${ins[0] ? 1 : 0}${ins[1] ? 1 : 0}`]; }
  freq(ins) {
    const c = this.chan(ins), { r, gr, b } = this.p, v = c === 'R' ? r : c === 'G' ? gr : c === 'B' ? b : Math.min(255, (r + gr + b) / 1.5);
    return (this.p.fs * clamp(v, 0, 255)) / 255;
  }
  compute(ins, settle) { this.f = this.freq(ins); return [settle ? false : this.ph - Math.floor(this.ph) < 0.5]; }
  preStep(s) {
    const ins = this.readInputs(s);
    this.inState = ins; this.f = this.freq(ins);
    const ph = this.ph + this.f * (s.dt || 0), o = s.mode !== 'dc' && this.f > 0 && ph - Math.floor(ph) < 0.5;
    if (o !== this.out[0]) { this.out = [o]; s.event = true; }
  }
  accept(s) { super.accept(s); if (s.mode !== 'dc') this.ph += this.f * s.dt; }
  shown() { return FILT[`${this.inState[0] ? 1 : 0}${this.inState[1] ? 1 : 0}`] || ''; }
  readings(s) { return [['Filter', { R: 'red', G: 'green', B: 'blue', C: 'clear' }[this.shown()] || '', ''], ['Output frequency', this.f || 0, 'Hz'], ...super.readings(s).slice(1)]; }
  draw(g) {
    super.draw(g);
    const { r, gr, b } = this.p;
    g.circle(0, -0.25 * G, 0.32 * G, { fill: `rgb(${r | 0},${gr | 0},${b | 0})`, stroke: g.body, width: 0.8 });
  }
}
register(ColorSensor);

// ---------------------------------------------- ultrasonic HC-SR04
export class HCSR04 extends Chip {
  static type = 'hcsr04'; static title = 'Ultrasonic Sensor (HC-SR04)'; static category = 'Sensors';
  static chip = 'HC-SR04'; static keywords = 'hc-sr04 ultrasonic distance sensor trigger echo sonar robot parking';
  static pins = [P('TRIG', 'L', 'i'), P('ECHO', 'R', 'o')];
  static props = [
    { key: 'd', label: 'Object distance', unit: 'cm', def: 50, min: 2, max: 400, knob: true },
    { key: 'temp', label: 'Air temperature', unit: '°C', def: 20, min: -20, max: 50 },
    ...DIGI_PROPS,
  ];
  static description = 'Ultrasonic range finder: a ≥10 µs high pulse on TRIG sends a 40 kHz burst; ≈0.5 ms later ECHO goes high for the round-trip time of the sound, t = 2·d / c with c = 331 + 0.6·T m/s (≈58 µs per cm). Beyond 4 m it times out with a 38 ms echo.';
  resetState() { this.trigT = null; this.echoStart = null; this.echoEnd = null; }
  c() { return 331.3 + 0.606 * this.p.temp; }
  compute(ins, settle) {
    if (settle) return [false];
    return this.out;
  }
  preStep(s) {
    const ins = this.readInputs(s), t = s.tNext;
    if (s.mode !== 'dc') {
      if (ins[0] && !this.inState[0]) this.trigT = t;
      if (!ins[0] && this.inState[0] && this.trigT != null && t - this.trigT >= 9.5e-6 && this.echoEnd == null) {
        const tof = this.p.d > 400 ? 0.038 : (2 * this.p.d / 100) / this.c();
        this.echoStart = t + 0.5e-3; this.echoEnd = this.echoStart + tof;
      }
    }
    this.inState = ins;
    const o = this.echoStart != null && t >= this.echoStart && t < this.echoEnd;
    if (this.echoEnd != null && t >= this.echoEnd) { this.echoStart = null; this.echoEnd = null; }
    if (o !== this.out[0]) { this.out = [o]; s.event = true; }
  }
  readings(s) { return [['Distance', this.p.d, 'cm'], ['Echo width', this.p.d > 400 ? 0.038 : (2 * this.p.d / 100) / this.c(), 's'], ['Speed of sound', this.c(), 'm/s'], ...super.readings(s)]; }
  draw(g) {
    super.draw(g);
    for (const x of [-0.45, 0.45]) { g.circle(x * G, -0.2 * G, 0.36 * G, { stroke: g.body, width: g.lw * 0.6, fill: g.bg }); g.circle(x * G, -0.2 * G, 0.15 * G, { fill: g.muted }); }
  }
}
register(HCSR04);

// ------------------------------------------------------- linear encoder
export class LinearEncoder extends RotaryEncoder {
  static type = 'linenc'; static title = 'Linear Encoder (quadrature)';
  static keywords = 'linear encoder optical scale quadrature position measurement cnc dro glass scale magnetic';
  static props = [
    { key: 'v', label: 'Slide speed', unit: 'mm/s', def: 10, min: -1000, max: 1000, knob: true },
    { key: 'res', label: 'Resolution (per count, ×4 decoding)', unit: 'µm', def: 5, min: 0.1, max: 1000, log: true },
    { key: 'vh', label: 'Output high', unit: 'V', def: 5, min: 0.5, max: 30 },
  ];
  static description = 'Incremental linear scale (glass or magnetic) as used on CNC machines and DROs: A and B are square waves 90° apart, one full cycle per 4 counts, so the signal period is 4 × resolution of travel; B leads A when moving in the negative direction.';
  levels(t) {
    const f = (this.p.v * 1000) / (4 * this.p.res), ph = t * f;
    return [ph - Math.floor(ph) < 0.5, ph + 0.25 - Math.floor(ph + 0.25) < 0.5];
  }
  valueLabel() { return fmtQty(this.p.v, 'mm/s'); }
  readings(s) { return [['Speed', this.p.v, 'mm/s'], ['Signal frequency', Math.abs((this.p.v * 1000) / (4 * this.p.res)), 'Hz'], ['Count rate', Math.abs((this.p.v * 1000) / this.p.res), '1/s'], ['Position', (this.p.v * s.t) / 1000, 'm']]; }
  draw(g) {
    this.drawChip(g, 'LIN');
    for (let k = -3; k <= 3; k++) g.line(k * 0.15 * G - 0.35 * G, 0.15 * G, k * 0.15 * G - 0.35 * G, (k % 2 ? 0.35 : 0.5) * G, g.muted, g.lw * 0.5);
  }
}
register(LinearEncoder);
