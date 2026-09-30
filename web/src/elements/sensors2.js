// More sensors: resistive (PTC, Pt1000, soil moisture, rain), LM335, touch
// pad, tilt switch, powered sensor modules with analog outputs (accelerometer,
// IR distance, pressure, flame, UV, anemometer, ultrasonic), current sensor
// ACS712, AC voltage sensor, digital-output modules (Hall switch, IR
// proximity, rotary encoder, flow meter), pH electrode, piezo vibration
// sensor, tachogenerator, load cell bridge and LVDT.

import { Element, TwoTerm, register, GRID } from './base.js';
import { ResSensor, RTD, ThreePinSensor } from './sensors.js';
import { Capacitor } from './passive.js';
import { Zener } from './semis.js';
import { Windings, withChip } from './kit.js';
import { fmtShort, fmtQty } from '../engine/units.js';

const G = GRID;
const TAU = 2 * Math.PI;

// ----------------------------------------------------------------- resistive
export class PTC extends ResSensor {
  static type = 'ptc'; static title = 'PTC Thermistor'; static keywords = 'ptc thermistor positive temperature coefficient heater protection';
  static props = [
    { key: 'temp', label: 'Temperature', unit: '°C', def: 25, min: -40, max: 250, knob: true },
    { key: 'r25', label: 'R at 25 °C', unit: 'Ω', def: 100, min: 0.1, max: 1e7, log: true },
    { key: 'tc', label: 'Switching (Curie) temperature', unit: '°C', def: 80, min: 0, max: 250 },
  ];
  static description = 'Switching PTC thermistor: roughly constant below its Curie temperature, then its resistance rises steeply (≈×10 per 10 °C).';
  resistance() { const { temp, r25, tc } = this.p; return r25 * (1 + 0.004 * (temp - 25)) * (1 + Math.pow(10, (temp - tc) / 10)); }
  localBox() { return [-2 * G, -1.0 * G, 2 * G, 1.15 * G]; }
  draw(g) {
    this.drawBody(g);
    g.poly([[-1.2 * G, 0.8 * G], [-0.9 * G, 0.8 * G], [0.9 * G, -0.8 * G]], { stroke: g.accent, width: g.lw * 0.7 });
    g.text('+t°', 0.9 * G, 0.8 * G, { size: 8, color: g.muted });
  }
}
register(PTC);

export class PT1000 extends RTD {
  static type = 'pt1000'; static title = 'RTD (Pt1000)'; static keywords = 'pt1000 rtd platinum temperature sensor';
  static props = RTD.props.map((p) => (p.key === 'r0' ? { ...p, def: 1000 } : p));
  static description = 'Platinum RTD with R0 = 1000 Ω (IEC 60751 Callendar–Van Dusen).';
}
register(PT1000);

export class SoilMoisture extends ResSensor {
  static type = 'soilm'; static title = 'Soil Moisture Probe'; static keywords = 'soil moisture sensor probe fc-28 irrigation garden';
  static props = [
    { key: 'm', label: 'Moisture', unit: '%', def: 30, min: 0, max: 100, knob: true },
    { key: 'rdry', label: 'Resistance when dry', unit: 'Ω', def: 1e6, min: 1e3, max: 1e9, log: true },
    { key: 'rwet', label: 'Resistance when saturated', unit: 'Ω', def: 1000, min: 10, max: 1e6, log: true },
  ];
  static description = 'Two-prong resistive soil probe: resistance falls (logarithmically) from dry to wet. Use it in a divider with a comparator for automatic irrigation.';
  resistance() { const f = this.p.m / 100; return Math.exp(Math.log(this.p.rdry) * (1 - f) + Math.log(this.p.rwet) * f); }
  draw(g) {
    g.line(-G, 0, -0.35 * G, 0, g.vc(g.pv(0)), g.lw); g.line(G, 0, 0.35 * G, 0, g.vc(g.pv(1)), g.lw);
    for (const x of [-0.35, 0.35]) g.poly([[x * G, 0], [x * G, 0.8 * G], [x * G + (x < 0 ? 3 : -3), 0.95 * G]], { stroke: g.body, width: g.lw });
    g.box(-0.8 * G, 0.5 * G, 0.8 * G, 1.1 * G, { fill: `rgba(120,80,40,${0.2 + 0.5 * (this.p.m / 100)})` });
  }
  localBox() { return [-2 * G, -0.6 * G, 2 * G, 1.2 * G]; }
}
register(SoilMoisture);

export class RainSensor extends ResSensor {
  static type = 'rain'; static title = 'Rain Sensor Plate'; static keywords = 'rain sensor water drop detector plate yl-83 wetness';
  static props = [{ key: 'wet', label: 'Wetness', unit: '%', def: 0, min: 0, max: 100, knob: true }];
  static description = 'Interleaved-track rain plate: very high resistance when dry, falling to a few kΩ as water bridges the tracks.';
  resistance() { const f = this.p.wet / 100; return f <= 0 ? 1e8 : 2000 / Math.pow(f, 1.5); }
  draw(g) {
    this.drawBody(g);
    for (let k = -2; k <= 2; k++) g.line(k * 0.35 * G, -0.25 * G, k * 0.35 * G, 0.25 * G, g.muted, g.lw * 0.5);
    if (this.p.wet > 1) g.circle(0.3 * G, -0.75 * G, 3, { fill: '#60a5fa' });
  }
  localBox() { return [-2 * G, -1.0 * G, 2 * G, 0.6 * G]; }
}
register(RainSensor);

export class LM335 extends Zener {
  static type = 'lm335'; static title = 'LM335 Temp Sensor'; static category = 'Sensors';
  static keywords = 'lm335 temperature sensor 10mv kelvin zener';
  static props = [
    { key: 'temp', label: 'Temperature', unit: '°C', def: 25, min: -40, max: 100, knob: true },
    { key: 'is', label: 'Is', unit: 'A', def: 1e-14, min: 1e-20, max: 1e-3, log: true, hidden: true },
    { key: 'n', label: 'n', unit: '', def: 1, min: 0.5, max: 5, hidden: true },
    { key: 'bv', label: 'Breakdown', unit: 'V', def: 2.98, min: 0.5, max: 10, hidden: true },
    { key: 'model', label: 'Model', type: 'select', def: 'custom', options: [['custom', 'Custom']], hidden: true },
  ];
  static description = 'Two-terminal temperature sensor that behaves like a Zener of 10 mV/K: 2.98 V at 25 °C. Bias with ≈1 mA through a resistor (cathode = +).';
  onParamChange() { this.p.bv = (this.p.temp + 273.15) * 0.01; super.onParamChange(); }
  constructor(x, y) { super(x, y); this.onParamChange(); }
  valueLabel() { return fmtQty(this.p.temp, '°C'); }
}
register(LM335);

export class TouchPad extends Capacitor {
  static type = 'capsense'; static title = 'Capacitive Touch Pad'; static category = 'Sensors';
  static keywords = 'capacitive touch sensor pad button ttp223 proximity';
  static props = [
    { key: 'touch', label: 'Touched', type: 'bool', def: false },
    { key: 'c0', label: 'Pad capacitance', unit: 'F', def: 10e-12, min: 1e-15, max: 1e-6, log: true },
    { key: 'cf', label: 'Finger capacitance', unit: 'F', def: 100e-12, min: 1e-15, max: 1e-6, log: true },
    { key: 'ic', label: 'Initial voltage', unit: 'V', def: 0, min: -100, max: 100, hidden: true },
  ];
  static description = 'Touch pad modelled as its capacitance to ground: a finger adds capacitance, which slows an RC charge time or shifts an oscillator. Tap to touch.';
  interactive = true;
  constructor(x, y) { super(x, y); this.sync(); }
  sync() { this.p.c = this.p.c0 + (this.p.touch ? this.p.cf : 0); }
  onParamChange() { this.sync(); }
  reset() { this.sync(); super.reset(); }
  onTap() { this.p.touch = !this.p.touch; this.sync(); return true; }
  valueLabel() { return this.p.touch ? 'touched' : ''; }
  draw(g) {
    g.line(-0.22 * G, -0.7 * G, -0.22 * G, 0.7 * G, g.vc(g.pv(0)), g.lw * 1.4);
    g.line(0.22 * G, -0.7 * G, 0.22 * G, 0.7 * G, g.vc(g.pv(1)), g.lw * 1.4);
    g.circle(0, -1.1 * G, 0.35 * G, { stroke: g.body, width: g.lw * 0.7, fill: this.p.touch ? 'rgba(34,211,238,0.5)' : null });
  }
  localBox() { return [-2 * G, -1.5 * G, 2 * G, 0.8 * G]; }
}
register(TouchPad);

export class TiltSwitch extends TwoTerm {
  static type = 'tilt'; static title = 'Tilt Switch'; static category = 'Sensors';
  static prefix = 'S'; static keywords = 'tilt switch ball switch mercury orientation sw-520d vibration';
  static props = [
    { key: 'angle', label: 'Tilt angle', unit: '°', def: 0, min: -90, max: 90, knob: true },
    { key: 'trip', label: 'Switching angle', unit: '°', def: 30, min: 1, max: 89 },
  ];
  static description = 'Rolling-ball tilt switch: closed when upright, opens when tilted beyond the switching angle.';
  branchCount() { return 1; }
  closed() { return Math.abs(this.p.angle) < this.p.trip; }
  stamp(s) {
    const k = this.branches[0], [a, b] = this.nodes;
    s.addBranchKCL(a, b, k);
    if (this.closed()) { s.addA(k, a - 1, 1); s.addA(k, b - 1, -1); s.addA(k, k, -0.1); } else s.addA(k, k, 1);
  }
  stampAC(ac) { const k = this.branches[0], [a, b] = this.nodes; ac.addBranchKCL(a, b, k); if (this.closed()) { ac.addA(k, a - 1, 1); ac.addA(k, b - 1, -1); ac.addA(k, k, -0.1); } else ac.addA(k, k, 1); }
  accept(s) { this.setCurrent(s.x[this.branches[0]]); }
  valueLabel() { return fmtQty(this.p.angle, '°'); }
  readings() { return [['Angle', this.p.angle, '°'], ['Contact', this.closed() ? 'Closed' : 'Open', ''], ['Current', this.i, 'A']]; }
  localBox() { return [-2 * G, -0.9 * G, 2 * G, 0.9 * G]; }
  draw(g) {
    g.upright(() => {
      g.box(-0.7 * G, -0.45 * G, 0.7 * G, 0.45 * G, { stroke: g.body, width: g.lw * 0.8, r: 0.45 * G });
      const a = (this.p.angle * Math.PI) / 180, x = Math.max(-0.4, Math.min(0.4, Math.sin(a))) * G;
      g.circle(x, 0, 0.3 * G, { fill: '#cbd5e1' });
    });
    g.line(-G, 0, -0.7 * G, 0, g.vc(g.pv(0)), g.lw); g.line(G, 0, 0.7 * G, 0, g.vc(g.pv(1)), g.lw);
  }
}
register(TiltSwitch);

// ---------------------------------------------------- powered sensor modules
/**
 * VCC / OUT / GND module: Vout − Vgnd = r·(Vcc − Vgnd) + c through Rout
 * (r: ratiometric part, c: fixed part), drawing a small supply current.
 */
class Module extends ThreePinSensor {
  static category = 'Sensors';
  rout() { return 100; }
  outFn() { return { r: 0, c: 0 }; }
  stamp(s) {
    const [vcc, out, gnd] = this.nodes, k = this.branches[0], { r, c } = this.outFn();
    s.addG(vcc, gnd, 1 / 8e4);
    s.addBranchKCL(out, gnd, k);
    s.addA(k, out - 1, 1); s.addA(k, gnd - 1, -1 + r); s.addA(k, vcc - 1, -r); s.addA(k, k, -this.rout());
    this.cOut = c;
  }
  stampStep(s) { s.b[this.branches[0]] += this.cOut * (s.srcScale ?? 1); }
  stampAC(ac) {
    const [vcc, out, gnd] = this.nodes, k = this.branches[0], { r } = this.outFn();
    ac.addY(vcc, gnd, 1 / 8e4);
    ac.addBranchKCL(out, gnd, k); ac.addA(k, out - 1, 1); ac.addA(k, gnd - 1, -1 + r); ac.addA(k, vcc - 1, -r); ac.addA(k, k, -this.rout());
  }
  readings(s) { const k = this.knobProp(); return [[k.label, this.p[k.key], k.unit], ['Vout', s.v(this.nodes[1]) - s.v(this.nodes[2]), 'V'], ['Vcc', s.v(this.nodes[0]) - s.v(this.nodes[2]), 'V']]; }
  draw(g) { this.drawBox(g, this.constructor.tag || 'SENS'); }
}

function mod(type, title, tag, knob, outFn, keywords, desc, extra = []) {
  const C = class extends Module {};
  Object.assign(C, { type, title, tag, keywords, description: desc, props: [knob, ...extra] });
  C.prototype.outFn = outFn;
  register(C);
  return C;
}

mod('accel', 'Accelerometer (ADXL335)', 'ACC', { key: 'a', label: 'Acceleration', unit: 'g', def: 0, min: -3, max: 3, knob: true },
  function () { return { r: 0.5 + (0.1 * this.p.a) / 1, c: 0 }; }, 'accelerometer adxl335 acceleration tilt vibration imu g sensor',
  'Analog accelerometer axis: ratiometric output Vcc/2 at 0 g, sensitivity ≈10 % of Vcc per g (300 mV/g at 3 V).');
mod('irdist', 'IR Distance Sensor (GP2Y0A21)', 'IR-D', { key: 'd', label: 'Distance', unit: 'cm', def: 30, min: 10, max: 80, knob: true },
  function () { return { r: 0, c: Math.min(3.1, 29.988 * Math.pow(this.p.d, -1.173)) }; }, 'sharp gp2y0a21 infrared distance sensor range finder analog',
  'Sharp triangulating IR distance sensor (10–80 cm): Vout ≈ 30·d^−1.17 (nonlinear, higher when closer).');
mod('pressure', 'Pressure Sensor (MPX5010)', 'kPa', { key: 'p', label: 'Pressure', unit: 'kPa', def: 5, min: 0, max: 10, knob: true },
  function () { return { r: 0.09 * this.p.p + 0.04, c: 0 }; }, 'pressure sensor mpx5010 differential pressure transducer analog',
  'Integrated pressure sensor: Vout = Vs·(0.09·P[kPa] + 0.04) (ratiometric).');
mod('flame', 'Flame Sensor (IR)', 'FIRE', { key: 'lvl', label: 'Flame intensity', unit: '%', def: 0, min: 0, max: 100, knob: true },
  function () { return { r: 1 - 0.9 * (this.p.lvl / 100), c: 0 }; }, 'flame sensor fire detector ir photodiode module',
  'IR flame module (analog output): output falls from ≈Vcc towards 0.1·Vcc as the flame intensity rises.');
mod('uv', 'UV Sensor (GUVA-S12SD)', 'UV', { key: 'uvi', label: 'UV index', unit: '', def: 3, min: 0, max: 11, knob: true },
  function () { return { r: 0, c: this.p.uvi * 0.1 }; }, 'uv sensor ultraviolet guva-s12sd uv index',
  'UV photodiode module: Vout ≈ UV index / 10 (V).');
mod('anemometer', 'Anemometer (wind speed)', 'WIND', { key: 'v', label: 'Wind speed', unit: 'm/s', def: 5, min: 0, max: 32.4, knob: true },
  function () { return { r: 0, c: 0.4 + (1.6 * this.p.v) / 32.4 }; }, 'anemometer wind speed sensor cup weather station',
  'Cup anemometer with analog output: 0.4 V (calm) to 2.0 V at 32.4 m/s, linear.');
mod('ultrasonic', 'Ultrasonic Range Finder', 'SONAR', { key: 'd', label: 'Distance', unit: 'cm', def: 100, min: 15, max: 640, knob: true },
  function () { return { r: this.p.d / 2.54 / 512, c: 0 }; }, 'ultrasonic distance sensor sonar maxbotix range finder level',
  'Analog ultrasonic range finder (MaxBotix LV style): Vout = (Vcc/512) per inch of distance.');

export class ACS712 extends withChip(Element) {
  static type = 'acs712'; static title = 'Current Sensor (ACS712)'; static category = 'Sensors';
  static prefix = 'U'; static keywords = 'acs712 hall current sensor isolated current measurement 5a 20a 30a';
  static props = [{ key: 'range', label: 'Range', type: 'select', def: '5', options: [['5', '±5 A (185 mV/A)'], ['20', '±20 A (100 mV/A)'], ['30', '±30 A (66 mV/A)']] }];
  static pins = [['IP+', 'L'], ['IP−', 'L'], ['VCC', 'R'], ['OUT', 'R'], ['GND', 'R']];
  static chipOpts = { dense: true };
  static description = 'Hall-effect current sensor: current through IP+ → IP− (1.2 mΩ, isolated) gives Vout = Vcc/2 + S·I (S ratiometric to 5 V).';
  constructor(x, y) { super(x, y); this.postCurrents = [0, 0, 0, 0, 0]; }
  connectivity() { return [[0, 1], [2, 3, 4]]; }
  branchCount() { return 2; }
  sens() { return { 5: 0.185, 20: 0.1, 30: 0.066 }[this.p.range] || 0.185; }
  stamp(s) {
    const [p, m, vcc, out, gnd] = this.nodes, [ki, ko] = this.branches, S = this.sens() / 5;
    s.addBranchKCL(p, m, ki); s.addA(ki, p - 1, 1); s.addA(ki, m - 1, -1); s.addA(ki, ki, -0.0012);
    s.addG(vcc, gnd, 1 / 500);
    // Vout − Vgnd = (Vcc − Vgnd)·(0.5 + S·I) — linearised in I around the Vcc estimate of 5 V
    s.addBranchKCL(out, gnd, ko);
    s.addA(ko, out - 1, 1); s.addA(ko, gnd - 1, -0.5); s.addA(ko, vcc - 1, -0.5); s.addA(ko, ko, -10);
    s.addA(ko, ki, -S * 5);
  }
  accept(s) {
    const [ki, ko] = this.branches, i = s.x[ki], io = s.x[ko], iq = (s.v(this.nodes[2]) - s.v(this.nodes[4])) / 500;
    this.postCurrents = [i, -i, iq, io, -iq - io]; this.i = i;
  }
  stampAC(ac) {
    const [p, m, vcc, out, gnd] = this.nodes, [ki, ko] = this.branches, S = this.sens() / 5;
    ac.addBranchKCL(p, m, ki); ac.addA(ki, p - 1, 1); ac.addA(ki, m - 1, -1); ac.addA(ki, ki, -0.0012);
    ac.addY(vcc, gnd, 1 / 500);
    ac.addBranchKCL(out, gnd, ko); ac.addA(ko, out - 1, 1); ac.addA(ko, gnd - 1, -0.5); ac.addA(ko, vcc - 1, -0.5); ac.addA(ko, ko, -10); ac.addA(ko, ki, -S * 5);
  }
  valueLabel() { return `±${this.p.range}A`; }
  readings(s) { return [['Sensed current', this.i, 'A'], ['Vout', s.v(this.nodes[3]) - s.v(this.nodes[4]), 'V'], ['Sensitivity', this.sens(), 'V/A']]; }
  draw(g) { this.drawChip(g, 'ACS712'); }
}
register(ACS712);

export class ACVoltageSensor extends withChip(Element) {
  static type = 'vsense'; static title = 'AC Voltage Sensor (ZMPT101B)'; static category = 'Sensors';
  static prefix = 'U'; static keywords = 'zmpt101b ac voltage sensor mains voltage measurement isolated transformer module';
  static props = [{ key: 'k', label: 'Output per input volt', unit: 'V/V', def: 0.005, min: 1e-5, max: 1, log: true, knob: true }];
  static pins = [['L', 'L'], ['N', 'L'], ['VCC', 'R'], ['OUT', 'R'], ['GND', 'R']];
  static chipOpts = { dense: true };
  static description = 'Isolated AC voltage sensor module: high-impedance input (L–N, ≈1 MΩ) and an output biased at Vcc/2 that swings k·Vin around it — feed it to an ADC.';
  constructor(x, y) { super(x, y); this.postCurrents = [0, 0, 0, 0, 0]; }
  connectivity() { return [[0, 1], [2, 3, 4]]; }
  branchCount() { return 1; }
  stamp(s) {
    const [l, n, vcc, out, gnd] = this.nodes, k = this.branches[0];
    s.addG(l, n, 1e-6); s.addG(vcc, gnd, 1 / 1e4);
    s.addBranchKCL(out, gnd, k);
    s.addA(k, out - 1, 1); s.addA(k, gnd - 1, -0.5); s.addA(k, vcc - 1, -0.5); s.addA(k, k, -100);
    s.addA(k, l - 1, -this.p.k); s.addA(k, n - 1, this.p.k);
  }
  accept(s) {
    const [l, n, vcc, , gnd] = this.nodes, io = s.x[this.branches[0]], ii = (s.v(l) - s.v(n)) * 1e-6, iq = (s.v(vcc) - s.v(gnd)) / 1e4;
    this.postCurrents = [ii, -ii, iq, io, -iq - io]; this.i = ii;
  }
  stampAC(ac) {
    const [l, n, vcc, out, gnd] = this.nodes, k = this.branches[0];
    ac.addY(l, n, 1e-6); ac.addY(vcc, gnd, 1e-4);
    ac.addBranchKCL(out, gnd, k); ac.addA(k, out - 1, 1); ac.addA(k, gnd - 1, -0.5); ac.addA(k, vcc - 1, -0.5); ac.addA(k, k, -100); ac.addA(k, l - 1, -this.p.k); ac.addA(k, n - 1, this.p.k);
  }
  valueLabel() { return ''; }
  readings(s) { return [['Input voltage', s.v(this.nodes[0]) - s.v(this.nodes[1]), 'V'], ['Vout', s.v(this.nodes[3]) - s.v(this.nodes[4]), 'V']]; }
  draw(g) { this.drawChip(g, 'ZMPT'); }
}
register(ACVoltageSensor);

// -------------------------------------------------- digital-output modules
class DigitalModule extends ThreePinSensor {
  static category = 'Sensors';
  active() { return false; }
  openCollector() { return true; }
  stamp(s) {
    const [vcc, out, gnd] = this.nodes, k = this.branches[0], on = this.state;
    s.addG(vcc, gnd, 1 / 8e4);
    s.addBranchKCL(out, gnd, k);
    if (this.openCollector()) {
      // open collector: pulls OUT low through 20 Ω when active, else off
      if (on) { s.addA(k, out - 1, 1); s.addA(k, gnd - 1, -1); s.addA(k, k, -20); } else s.addA(k, k, 1);
    } else {
      s.addA(k, out - 1, 1); s.addA(k, gnd - 1, -1 + (on ? 1 : 0)); s.addA(k, vcc - 1, on ? -1 : 0); s.addA(k, k, -50);
    }
  }
  stampAC(ac) { const [vcc, out, gnd] = this.nodes, k = this.branches[0]; ac.addY(vcc, gnd, 1 / 8e4); ac.addBranchKCL(out, gnd, k); ac.addA(k, k, 1); }
  reset() { this.state = this.active(0); }
  preStep(s) { const n = this.active(s.mode === 'dc' ? 0 : s.tNext); if (n !== this.state) { this.state = n; s.markEvent(); } }
  readings(s) { const k = this.knobProp(); return [[k.label, this.p[k.key], k.unit], ['Output', this.state ? 'ACTIVE' : 'idle', ''], ['Vout', s.v(this.nodes[1]) - s.v(this.nodes[2]), 'V']]; }
  draw(g) { this.drawBox(g, this.constructor.tag); g.circle(0.4 * G, 0.55 * G, 2.6, { fill: this.state && g.running ? '#ef4444' : g.lo }); }
}

export class HallSwitch extends DigitalModule {
  static type = 'hallswitch'; static title = 'Hall Switch (A3144)'; static tag = 'HALL';
  static keywords = 'hall switch a3144 digital hall effect magnet detector speed sensor open collector';
  static props = [{ key: 'b', label: 'Magnetic field', unit: 'G', def: 0, min: -1000, max: 1000, knob: true }, { key: 'bop', label: 'Operate point', unit: 'G', def: 100, min: 1, max: 1000 }];
  static description = 'Unipolar Hall switch with open-collector output: pulls OUT low when the south-pole field exceeds the operate point (needs a pull-up resistor).';
  active() { return this.state ? this.p.b > this.p.bop * 0.7 : this.p.b > this.p.bop; }
}
register(HallSwitch);

export class IRProximity extends DigitalModule {
  static type = 'irprox'; static title = 'IR Obstacle Sensor (FC-51)'; static tag = 'IR';
  static keywords = 'ir obstacle avoidance sensor proximity fc-51 line follower digital';
  static props = [{ key: 'd', label: 'Object distance', unit: 'cm', def: 30, min: 0, max: 100, knob: true }, { key: 'range', label: 'Detection range', unit: 'cm', def: 10, min: 1, max: 80 }];
  static description = 'Reflective IR obstacle sensor: output goes LOW when an object is closer than the set range (active-low module with on-board pull-up).';
  openCollector() { return false; }
  active() { return !(this.p.d < this.p.range); } // output HIGH when nothing is detected
}
register(IRProximity);

export class FlowSensor extends DigitalModule {
  static type = 'flow'; static title = 'Water Flow Sensor (YF-S201)'; static tag = 'FLOW';
  static keywords = 'water flow sensor yf-s201 hall turbine pulse flow meter';
  static props = [{ key: 'q', label: 'Flow rate', unit: 'L/min', def: 5, min: 0, max: 30, knob: true }, { key: 'k', label: 'Pulses per L/min', unit: 'Hz', def: 7.5, min: 0.1, max: 100 }];
  static description = 'Turbine flow meter with a Hall pulse output: f = 7.5 × Q (L/min) square wave.';
  openCollector() { return false; }
  active(t) { const f = this.p.k * this.p.q; return f > 0 ? t * f - Math.floor(t * f) < 0.5 : false; }
}
register(FlowSensor);

export class RotaryEncoder extends withChip(Element) {
  static type = 'encoder'; static title = 'Rotary Encoder (quadrature)'; static category = 'Sensors';
  static prefix = 'U'; static keywords = 'rotary encoder quadrature incremental encoder a b channel ppr speed position';
  static props = [
    { key: 'rpm', label: 'Shaft speed', unit: 'rpm', def: 60, min: -6000, max: 6000, knob: true },
    { key: 'ppr', label: 'Pulses per revolution', unit: '', def: 20, min: 1, max: 10000 },
    { key: 'vh', label: 'Output high', unit: 'V', def: 5, min: 0.5, max: 30 },
  ];
  static pins = [['A', 'R'], ['B', 'R'], ['GND', 'B']];
  static description = 'Incremental encoder: channels A and B are square waves 90° apart at ppr × rpm / 60 Hz; B leads A when turning backwards (negative rpm).';
  constructor(x, y) { super(x, y); this.postCurrents = [0, 0, 0]; }
  branchCount() { return 2; }
  reset() { this.lv = [false, false]; this.postCurrents.fill(0); }
  levels(t) {
    const f = (this.p.ppr * this.p.rpm) / 60, ph = t * f;
    const a = ph - Math.floor(ph) < 0.5, b = ph + 0.25 - Math.floor(ph + 0.25) < 0.5;
    return [a, b];
  }
  stamp(s) {
    const [a, b, gnd] = this.nodes;
    [a, b].forEach((o, i) => { const k = this.branches[i]; s.addBranchKCL(o, gnd, k); s.addA(k, o - 1, 1); s.addA(k, gnd - 1, -1); s.addA(k, k, -50); });
  }
  stampStep(s) {
    const lv = s.mode === 'dc' ? [false, false] : this.levels(s.tNext);
    lv.forEach((l, i) => { s.b[this.branches[i]] += l ? this.p.vh : 0; });
    if (lv[0] !== this.lv[0] || lv[1] !== this.lv[1]) s.event = true;
    this.lv = lv;
  }
  accept(s) { const [i1, i2] = this.branches.map((k) => s.x[k]); this.postCurrents = [i1, i2, -i1 - i2]; this.i = i1; }
  stampAC(ac) { const [a, b, gnd] = this.nodes; [a, b].forEach((o, i) => { const k = this.branches[i]; ac.addBranchKCL(o, gnd, k); ac.addA(k, o - 1, 1); ac.addA(k, gnd - 1, -1); ac.addA(k, k, -50); }); }
  valueLabel() { return fmtQty(this.p.rpm, 'rpm'); }
  readings() { return [['Speed', this.p.rpm, 'rpm'], ['Pulse frequency', Math.abs((this.p.ppr * this.p.rpm) / 60), 'Hz']]; }
  draw(g) {
    this.drawChip(g, 'ENC');
    g.circle(-0.35 * G, 0.1 * G, 0.5 * G, { stroke: g.body, width: g.lw * 0.7 });
    for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4; g.line(-0.35 * G + Math.cos(a) * 0.3 * G, 0.1 * G + Math.sin(a) * 0.3 * G, -0.35 * G + Math.cos(a) * 0.5 * G, 0.1 * G + Math.sin(a) * 0.5 * G, g.muted, g.lw * 0.5); }
  }
}
register(RotaryEncoder);

// ------------------------------------------------------ source-like sensors
class SourceSensor extends TwoTerm {
  static category = 'Sensors';
  branchCount() { return 1; }
  emf() { return 0; }
  rs() { return 1; }
  refNode = 1;
  stamp(s) { const k = this.branches[0], [a, b] = this.nodes; s.addBranchKCL(a, b, k); s.addA(k, a - 1, 1); s.addA(k, b - 1, -1); s.addA(k, k, -this.rs()); }
  stampStep(s) { s.b[this.branches[0]] += this.emf(s.mode === 'dc' ? 0 : s.tNext) * (s.srcScale ?? 1); }
  accept(s) { this.setCurrent(s.x[this.branches[0]]); }
  stampAC(ac) { const k = this.branches[0], [a, b] = this.nodes; ac.addBranchKCL(a, b, k); ac.addA(k, a - 1, 1); ac.addA(k, b - 1, -1); ac.addA(k, k, -this.rs()); }
  valueLabel() { const k = this.knobProp(); return fmtQty(this.p[k.key], k.unit); }
  readings(s) { const k = this.knobProp(); return [[k.label, this.p[k.key], k.unit], ['EMF', this.emf(s.t), 'V'], ['Terminal voltage', this.voltageDiff(s), 'V']]; }
  localBox() { return [-2 * G, -0.9 * G, 2 * G, 0.9 * G]; }
}

export class PHProbe extends SourceSensor {
  static type = 'ph'; static title = 'pH Electrode'; static keywords = 'ph electrode probe glass electrode nernst chemistry water quality';
  static props = [
    { key: 'ph', label: 'pH', unit: '', def: 7, min: 0, max: 14, knob: true },
    { key: 'temp', label: 'Temperature', unit: '°C', def: 25, min: 0, max: 100 },
    { key: 'r', label: 'Electrode resistance', unit: 'Ω', def: 1e8, min: 1e3, max: 1e10, log: true },
  ];
  static description = 'Glass pH electrode (Nernst): E = −(RT ln10 / F)·(pH − 7) ≈ −59.16 mV/pH at 25 °C, with ≈100 MΩ source resistance — it must be read with a high-impedance buffer (op-amp follower).';
  emf() { return (-8.314 * (this.p.temp + 273.15) * Math.log(10)) / 96485 * (this.p.ph - 7); }
  rs() { return this.p.r; }
  valueLabel() { return `pH ${this.p.ph.toFixed(1)}`; }
  draw(g) {
    g.box(-G, -0.35 * G, 0.6 * G, 0.35 * G, { stroke: g.body, width: g.lw * 0.8, fill: g.fill, r: 3 });
    g.circle(0.8 * G, 0, 0.3 * G, { stroke: g.body, width: g.lw * 0.8, fill: 'rgba(96,165,250,0.3)' });
    g.upright(() => g.text('pH', -0.2 * G, 0, { size: 7, color: g.accent, bold: true }));
  }
}
register(PHProbe);

export class PiezoSensor extends SourceSensor {
  static type = 'piezosens'; static title = 'Piezo Vibration Sensor'; static keywords = 'piezo vibration sensor knock sensor accelerometer piezoelectric disc';
  static props = [
    { key: 'amp', label: 'Vibration amplitude', unit: 'g', def: 1, min: 0, max: 50, knob: true },
    { key: 'f', label: 'Vibration frequency', unit: 'Hz', def: 100, min: 0.1, max: 1e5, log: true },
    { key: 'sens', label: 'Sensitivity', unit: 'V/g', def: 0.5, min: 1e-4, max: 100, log: true },
    { key: 'c', label: 'Element capacitance', unit: 'F', def: 20e-9, min: 1e-12, max: 1e-5, log: true },
  ];
  static description = 'Piezoelectric sensor: a sinusoidal charge source (voltage source behind its capacitance). Being capacitive, it has no DC output and needs a high input impedance.';
  constructor(x, y) { super(x, y); this.vc = 0; this.ic = 0; }
  reset() { this.vc = 0; this.ic = 0; this.setCurrent(0); }
  emf(t) { return this.p.amp * this.p.sens * Math.sin(TAU * this.p.f * t); }
  rs() { return 1e3; }
  // series capacitance: source + C (backward-Euler companion in the branch)
  stamp(s) {
    const k = this.branches[0], [a, b] = this.nodes;
    s.addBranchKCL(a, b, k); s.addA(k, a - 1, 1); s.addA(k, b - 1, -1);
    s.addA(k, k, -(this.rs() + (s.mode === 'dc' ? 1e12 : s.dt / this.p.c)));
  }
  // row: v_a − v_b − (R + dt/C)·i = E(t) + v_C,prev   (i flows a → b, charging C)
  stampStep(s) { if (s.mode !== 'dc') s.b[this.branches[0]] += this.emf(s.tNext) + this.vc; }
  accept(s) { const i = s.x[this.branches[0]]; this.setCurrent(i); if (s.mode !== 'dc') this.vc += (i * s.dt) / this.p.c; }
  stampAC(ac) { const k = this.branches[0], [a, b] = this.nodes; ac.addBranchKCL(a, b, k); ac.addA(k, a - 1, 1); ac.addA(k, b - 1, -1); ac.addA(k, k, -this.rs(), 1 / (ac.omega * this.p.c)); }
  draw(g) {
    g.line(-0.3 * G, -0.7 * G, -0.3 * G, 0.7 * G, g.vc(g.pv(0)), g.lw * 1.3);
    g.line(0.3 * G, -0.7 * G, 0.3 * G, 0.7 * G, g.vc(g.pv(1)), g.lw * 1.3);
    g.box(-0.2 * G, -0.5 * G, 0.2 * G, 0.5 * G, { stroke: g.body, width: g.lw * 0.7 });
  }
}
register(PiezoSensor);

export class Tachogenerator extends SourceSensor {
  static type = 'tacho'; static title = 'Tachogenerator'; static keywords = 'tachogenerator tacho generator speed sensor dc tachometer feedback';
  static props = [
    { key: 'rpm', label: 'Shaft speed', unit: 'rpm', def: 1000, min: -1e5, max: 1e5, knob: true },
    { key: 'k', label: 'Constant', unit: 'V/krpm', def: 7, min: 1e-3, max: 1e3, log: true },
    { key: 'ra', label: 'Armature resistance', unit: 'Ω', def: 50, min: 0.01, max: 1e5, log: true },
  ];
  static description = 'DC tachogenerator for speed feedback: V = K·speed (e.g. 7 V per 1000 rpm), polarity follows the direction.';
  emf() { return (this.p.k * this.p.rpm) / 1000; }
  rs() { return this.p.ra; }
  draw(g) { g.circle(0, 0, 0.8 * G, { stroke: g.body, width: g.lw * 0.9, fill: g.fill }); g.upright(() => g.text('TG', 0, 0.5, { size: 8, color: g.accent, bold: true })); g.text('+', -1.2 * G, -0.55 * G, { size: 10, color: g.pos, bold: true }); }
}
register(Tachogenerator);

// ------------------------------------------------------------ load cell
export class LoadCell extends withChip(Element) {
  static type = 'loadcell'; static title = 'Load Cell (bridge)'; static category = 'Sensors';
  static prefix = 'LC'; static keywords = 'load cell strain gauge wheatstone bridge weighing scale hx711 force';
  static props = [
    { key: 'load', label: 'Load', unit: 'kg', def: 1, min: -100, max: 1000, knob: true },
    { key: 'cap', label: 'Capacity', unit: 'kg', def: 5, min: 0.01, max: 1e5, log: true },
    { key: 'mvv', label: 'Rated output', unit: 'mV/V', def: 2, min: 0.1, max: 10 },
    { key: 'r', label: 'Bridge resistance', unit: 'Ω', def: 350, min: 10, max: 1e5, log: true },
  ];
  static pins = [['E+', 'L'], ['E−', 'L'], ['S+', 'R'], ['S−', 'R']];
  static description = 'Full Wheatstone bridge of four strain gauges: output (S+ − S−) = Vexc × rated mV/V × load / capacity (e.g. 2 mV/V). Needs an instrumentation amplifier.';
  constructor(x, y) { super(x, y); this.postCurrents = [0, 0, 0, 0]; }
  strain() { return (this.p.mvv * 1e-3 * this.p.load) / this.p.cap; }
  arms() { const R = this.p.r, x = this.strain(); return [[0, 2, R * (1 - x)], [2, 1, R * (1 + x)], [0, 3, R * (1 + x)], [3, 1, R * (1 - x)]]; }
  stamp(s) { for (const [a, b, R] of this.arms()) s.addG(this.nodes[a], this.nodes[b], 1 / R); }
  stampAC(ac) { for (const [a, b, R] of this.arms()) ac.addY(this.nodes[a], this.nodes[b], 1 / R); }
  accept(s) {
    this.postCurrents.fill(0);
    for (const [a, b, R] of this.arms()) { const i = (s.v(this.nodes[a]) - s.v(this.nodes[b])) / R; this.postCurrents[a] += i; this.postCurrents[b] -= i; }
    this.i = this.postCurrents[0];
  }
  valueLabel() { return fmtQty(this.p.load, '') + 'kg'; }
  readings(s) { const n = this.nodes; return [['Load', this.p.load, 'kg'], ['Excitation', s.v(n[0]) - s.v(n[1]), 'V'], ['Output S+ − S−', s.v(n[2]) - s.v(n[3]), 'V']]; }
  draw(g) {
    this.drawChip(g, 'LOAD');
    g.upright(() => {
      const r = 0.5 * G;
      g.poly([[0, -r], [r, 0], [0, r], [-r, 0]], { stroke: g.body, width: g.lw * 0.7, close: true });
    }, 0, 0.15 * G);
  }
}
register(LoadCell);

// ----------------------------------------------------------------- LVDT
export class LVDT extends withChip(Element) {
  static type = 'lvdt'; static title = 'LVDT (displacement)'; static category = 'Sensors';
  static prefix = 'T'; static keywords = 'lvdt linear variable differential transformer displacement position transducer';
  static props = [
    { key: 'x', label: 'Core position', unit: '%', def: 0, min: -100, max: 100, knob: true },
    { key: 'lp', label: 'Primary inductance', unit: 'H', def: 0.05, min: 1e-6, max: 10, log: true },
    { key: 'ls', label: 'Secondary inductance (each)', unit: 'H', def: 0.05, min: 1e-6, max: 10, log: true },
    { key: 'k0', label: 'Coupling at centre', unit: '', def: 0.4, min: 0.01, max: 0.49 },
  ];
  static pins = [['P1', 'L'], ['P2', 'L'], ['S1', 'R'], ['S2', 'R']];
  static description = 'Linear variable differential transformer: an AC-excited primary and two series-opposed secondaries. The movable core shifts the coupling, so the output amplitude is proportional to displacement and its phase flips at the centre (null) position.';
  constructor(x, y) { super(x, y); this.postCurrents = [0, 0, 0, 0]; this.W = new Windings(3); }
  connectivity() { return [[0, 1], [2, 3, 'i0']]; }
  internalNodeCount() { return 1; }
  branchCount() { return 3; }
  ends() { const [p1, p2, s1, s2] = this.nodes, m = this.inodes[0]; return [[p1, p2], [s1, m], [s2, m]]; }
  L() {
    const { lp, ls, k0 } = this.p, x = Math.max(-1, Math.min(1, this.p.x / 100)), M = Math.sqrt(lp * ls);
    const ka = k0 * (1 + x), kb = k0 * (1 - x);
    return [[lp, ka * M, kb * M], [ka * M, ls, 0], [kb * M, 0, ls]];
  }
  R() { return [20, 30, 30]; }
  reset() { this.W = new Windings(3); this.postCurrents.fill(0); }
  stamp(s) { this.W.stamp(s, this.ends(), this.branches, this.L(), this.R()); s.addG(this.inodes[0], this.nodes[3], 1e-9); }
  stampStep(s) { this.W.stampStep(s, this.branches, this.L()); }
  accept(s) {
    this.W.accept(s, this.ends(), this.branches, this.R());
    const [ip, ia, ib] = this.W.i;
    this.postCurrents = [ip, -ip, ia, ib]; this.i = ip;
  }
  stampAC(ac) { this.W.stampAC(ac, this.ends(), this.branches, this.L(), this.R()); }
  valueLabel() { return `x=${this.p.x.toFixed(0)}%`; }
  readings(s) { const n = this.nodes; return [['Core position', this.p.x, '%'], ['Primary voltage', s.v(n[0]) - s.v(n[1]), 'V'], ['Output S1 − S2', s.v(n[2]) - s.v(n[3]), 'V']]; }
  draw(g) {
    this.drawChip(g, 'LVDT');
    const x = (this.p.x / 100) * 0.5 * G;
    g.box(-0.75 * G + x, 0, 0.75 * G + x, 0.2 * G, { fill: '#94a3b8' });
  }
}
register(LVDT);
