// Remaining parts from the component list:
//  - ramp source, magnetometer (compass), water-level probe module
//  - LED panel light, 5-band graphic equaliser, SAW band-pass filter
//  - 74HC595 shift register with output latch, SPI master, I²C master and a
//    PCF8574 I²C I/O expander (behavioural bus transactions, no firmware)

import { Element, register, GRID } from './base.js';
import { withChip } from './kit.js';
import { SigSource } from './sources2.js';
import { mod } from './sensors2.js';
import { Chip, P, bits, val } from './digital2.js';
import { DIGI_PROPS } from './digital.js';
import { FilterBlock, designFilter } from './comm.js';
import { fmtQty, fmtShort } from '../engine/units.js';

const G = GRID;
const TAU = 2 * Math.PI;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const db = (x) => Math.pow(10, x / 20);
const hexBytes = (txt) => String(txt ?? '').split(/[\s,]+/).filter(Boolean).map((h) => parseInt(h, 16) & 255).filter((v) => Number.isFinite(v));

// -------------------------------------------------------------- ramp source
export class RampSource extends SigSource {
  static type = 'rampsrc'; static title = 'Ramp Source'; static glyph = '⟋';
  static keywords = 'ramp source linear ramp soft start slope test signal';
  static props = [
    { key: 'v1', label: 'Final value', unit: 'V', def: 10, min: -1e5, max: 1e5, knob: true },
    { key: 'v0', label: 'Initial value', unit: 'V', def: 0, min: -1e5, max: 1e5 },
    { key: 'td', label: 'Start delay', unit: 's', def: 0, min: 0, max: 1e4 },
    { key: 'tr', label: 'Ramp time', unit: 's', def: 0.01, min: 1e-12, max: 1e4, log: true },
    { key: 'rep', label: 'Repeat (sawtooth)', type: 'bool', def: false },
  ];
  static description = 'Linear ramp from the initial to the final value over the ramp time (after the start delay), then holds — or repeats as a sawtooth. Use it for soft-start tests and to sweep a circuit slowly.';
  f(t) {
    const p = this.p; let x = (t - p.td) / p.tr;
    if (x <= 0) return p.v0;
    if (p.rep) x -= Math.floor(x); else x = Math.min(1, x);
    return p.v0 + (p.v1 - p.v0) * x;
  }
  valueLabel() { return `${fmtShort(this.p.v0, 'V')}→${fmtShort(this.p.v1, 'V')}`; }
}
register(RampSource);

// --------------------------------------------------------- magnetometer
export class Magnetometer extends withChip(Element) {
  static type = 'magneto'; static title = 'Magnetometer / Compass (3-axis)'; static category = 'Sensors';
  static prefix = 'U'; static keywords = 'magnetometer compass heading earth magnetic field 3 axis hmc5883 qmc5883 magnetic sensor';
  static props = [
    { key: 'hdg', label: 'Heading (from magnetic north)', unit: '°', def: 0, min: 0, max: 360, knob: true },
    { key: 'b', label: 'Earth field strength', unit: 'µT', def: 45, min: 0, max: 1000 },
    { key: 'inc', label: 'Inclination (dip)', unit: '°', def: 30, min: -90, max: 90 },
  ];
  static pins = [['VCC', 'L'], ['GND', 'L'], ['X', 'R'], ['Y', 'R'], ['Z', 'R']];
  static chipOpts = { dense: true };
  static description = 'Three-axis magnetometer with ratiometric analog outputs (Vcc/2 = 0, 1 % of Vcc per µT, ±50 µT range): the horizontal component of the earth’s field B·cos(dip) splits into X = cos(heading) and Y = −sin(heading) parts, Z = B·sin(dip). Heading = atan2(−Y, X) — a digital compass.';
  constructor(x, y) { super(x, y); this.postCurrents = [0, 0, 0, 0, 0]; }
  connectivity() { return [[0, 1, 2, 3, 4]]; }
  branchCount() { return 3; }
  axes() { const h = (this.p.hdg * Math.PI) / 180, i = (this.p.inc * Math.PI) / 180, bh = this.p.b * Math.cos(i); return [bh * Math.cos(h), -bh * Math.sin(h), this.p.b * Math.sin(i)]; }
  ratios() { return this.axes().map((b) => clamp(0.5 + 0.01 * b, 0.02, 0.98)); }
  stamp(s) {
    const [vcc, gnd] = this.nodes, rr = this.ratios();
    s.addG(vcc, gnd, 1e-4);
    for (let k = 0; k < 3; k++) { const o = this.nodes[2 + k], br = this.branches[k]; s.addBranchKCL(o, gnd, br); s.addA(br, o - 1, 1); s.addA(br, gnd - 1, -1 + rr[k]); s.addA(br, vcc - 1, -rr[k]); s.addA(br, br, -100); }
  }
  stampAC(ac) {
    const [vcc, gnd] = this.nodes, rr = this.ratios();
    ac.addY(vcc, gnd, 1e-4);
    for (let k = 0; k < 3; k++) { const o = this.nodes[2 + k], br = this.branches[k]; ac.addBranchKCL(o, gnd, br); ac.addA(br, o - 1, 1); ac.addA(br, gnd - 1, -1 + rr[k]); ac.addA(br, vcc - 1, -rr[k]); ac.addA(br, br, -100); }
  }
  accept(s) { const io = this.branches.map((b) => s.x[b]), iq = (s.v(this.nodes[0]) - s.v(this.nodes[1])) * 1e-4; this.postCurrents = [iq, -iq - io[0] - io[1] - io[2], ...io]; }
  valueLabel() { return `${Math.round(this.p.hdg)}°`; }
  readings() { const [x, y, z] = this.axes(); return [['Bx', x, 'µT'], ['By', y, 'µT'], ['Bz', z, 'µT'], ['Heading from X, Y', ((Math.atan2(-y, x) * 180) / Math.PI + 360) % 360, '°']]; }
  draw(g) {
    this.drawChip(g, 'MAG');
    const h = (this.p.hdg * Math.PI) / 180, r = 0.45 * G;
    g.circle(0, 0.15 * G, r, { stroke: g.muted, width: g.lw * 0.5 });
    g.line(0, 0.15 * G, Math.sin(-h) * r, 0.15 * G - Math.cos(-h) * r, '#ef4444', g.lw);
  }
}
register(Magnetometer);

mod('waterlevel', 'Water Level Sensor (analog)', 'H₂O', { key: 'depth', label: 'Immersion depth', unit: 'mm', def: 20, min: 0, max: 40, knob: true },
  function () { const x = clamp(this.p.depth / 40, 0, 1); return { r: x > 0 ? 0.25 + 0.45 * Math.sqrt(x) : 0, c: 0 }; }, 'water level sensor analog module conductive probe tank level rain',
  'Conductive water-level probe module: the parallel traces conduct through the water, so the output rises (non-linearly) with the immersion depth — 0 when dry, ≈0.25·Vcc when just wet, ≈0.7·Vcc fully immersed (40 mm).');

// ----------------------------------------------------------- LED panel
export class LEDPanel extends Element {
  static type = 'ledpanel'; static title = 'LED Panel Light (PFC driver)'; static category = 'Electrical';
  static prefix = 'LP'; static keywords = 'led panel light ceiling panel 2x2 600x600 office light flat panel downlight';
  static props = [
    { key: 'w', label: 'Rated power', unit: 'W', def: 36, min: 1, max: 500, knob: true },
    { key: 'eff', label: 'Efficacy', unit: 'lm/W', def: 100, min: 10, max: 250 },
    { key: 'v', label: 'Rated voltage (RMS)', unit: 'V', def: 230, min: 12, max: 400 },
  ];
  static description = 'Flat LED panel with a power-factor-corrected constant-current driver: it draws its rated power as a sinusoidal current in phase with the mains (PF ≈ 0.95+) from about 100 V to 250 V; below ≈90 V the driver drops out, and more than ≈25 % above its rated voltage for a few seconds burns the driver.';
  constructor(x, y) { super(x, y); this.postCurrents = [0, 0]; }
  localPosts() { return [[-2 * G, 0], [2 * G, 0]]; }
  localBox() { return [-2 * G, -0.9 * G, 2 * G, 0.6 * G]; }
  leads() { return [[0, -2 * G, 0, -1.4 * G, 0], [1, 2 * G, 0, 1.4 * G, 0]]; }
  reset() { this.v2 = this.p.v ** 2; this.vprev = 0; this.on = true; this.pin = 0; this.postCurrents = [0, 0]; }
  gin() { return this.on && !this.damaged ? (this.p.w / 0.92) / Math.max(this.v2, 100) : 0; }
  // The driver's load is in the matrix as a conductance (as it was when last stamped); only what
  // it has changed by since is a current worked out from the last step's voltage, and it is
  // stamped anew once that is a fifth of it. (All of it used to be such a current: behind any
  // series impedance — two panels in series, a long cable — that swings further every step, up
  // to megavolts.)
  stamp(s) { this.gst = this.gin(); s.addG(this.nodes[0], this.nodes[1], 1e-7 + this.gst); }
  stampStep(s) { s.addI(this.nodes[0], this.nodes[1], (this.gin() - (this.gst || 0)) * this.vprev); }
  stampAC(ac) { ac.addY(this.nodes[0], this.nodes[1], 1e-7); }
  accept(s) {
    const v = s.v(this.nodes[0]) - s.v(this.nodes[1]), i = this.gin() * v + v * 1e-7;
    this.vprev = v; this.postCurrents = [i, -i]; this.i = i;
    if (s.mode === 'dc') return;
    this.v2 += (v * v - this.v2) * Math.min(1, s.dt / 0.02);
    this.pin += (v * i - this.pin) * Math.min(1, s.dt / 0.05);
    const on = this.on ? this.v2 > 80 * 80 : this.v2 > 95 * 95;
    if (on !== this.on) { this.on = on; s.event = true; }
    this.overheat(s, this.v2 / this.p.v ** 2, 2, 1.5625, () => `Driver burnt — ${fmtShort(Math.sqrt(this.v2), 'V')} on a ${fmtShort(this.p.v, 'V')} panel (over-voltage)`);
    const g = this.gin(), g0 = this.gst || 0;
    if (Math.abs(g - g0) > 0.2 * Math.max(g, g0)) s.dirty = true;
  }
  valueLabel() { return fmtQty(this.p.w, 'W').replace(' ', ''); }
  readings() { return [['Input power', this.pin || 0, 'W'], ['Light output', (this.pin || 0) * 0.92 * this.p.eff, 'lm'], ['Supply (RMS)', Math.sqrt(this.v2 || 0), 'V'], ['Driver', this.damaged ? 'burnt' : this.on ? 'ON' : 'off (low voltage)', '']]; }
  draw(g) {
    const b = g.running ? clamp((this.pin || 0) / (this.p.w / 0.92), 0, 1.1) : 0;
    if (b > 0.03) g.glow(0, -0.15 * G, 1.6 * G, '240,248,255', Math.min(0.8, b));
    g.box(-1.4 * G, -0.7 * G, 1.4 * G, 0.4 * G, { stroke: g.body, width: g.lw * 0.9, fill: b > 0.03 ? `rgba(245,250,255,${0.4 + 0.6 * Math.min(1, b)})` : g.fill, r: 2 });
    g.box(-1.2 * G, -0.55 * G, 1.2 * G, 0.25 * G, { stroke: g.muted, width: g.lw * 0.4, r: 1 });
  }
}
register(LEDPanel);

// ---------------------------------------------------- equaliser, SAW filter
const EQB = [60, 230, 910, 3600, 14000];
function peaking(f0, gdb, Q) {
  const w = TAU * f0, A = Math.pow(10, gdb / 40);
  return { b: [w * w, (A * w) / Q, 1], a: [w * w, w / (A * Q), 1] };
}
export class Equalizer extends FilterBlock {
  static type = 'equalizer'; static title = 'Graphic Equaliser (5-band)'; static category = 'Output';
  static keywords = 'equalizer equaliser graphic eq 5 band peaking filter audio bass mid treble';
  static props = [
    ...EQB.map((f, k) => ({ key: 'g' + k, label: `${f >= 1000 ? f / 1000 + ' kHz' : f + ' Hz'} band`, unit: 'dB', def: [4, 1, 0, 2, 3][k], min: -12, max: 12, knob: k === 0 })),
    { key: 'q', label: 'Band Q', unit: '', def: 1.4, min: 0.3, max: 10 },
    { key: 'rout', label: 'Output resistance', unit: 'Ω', def: 100, min: 0, max: 1e6 },
  ];
  static description = 'Five-band graphic equaliser: a cascade of peaking (bell) filters at 60 Hz, 230 Hz, 910 Hz, 3.6 kHz and 14 kHz, each ±12 dB with the set Q — boost or cut each part of the audio spectrum independently. See the curve in the AC analysis.';
  sections() { return EQB.map((f, k) => peaking(f, this.p['g' + k], this.p.q)); }
  gain() { return 1; }
  zin() { return 47e3; }
  glyph() { return 'EQ'; }
  valueLabel() { return EQB.map((_, k) => Math.round(this.p['g' + k])).join(' '); }
  draw(g) {
    const [, y1, , y2] = this.localBox();
    g.box(-1.2 * G, y1 + 3, 1.2 * G, y2 - 3, { stroke: g.body, width: g.lw * 0.9, fill: g.fill, r: 3 });
    EQB.forEach((_, k) => { const x = -0.8 * G + k * 0.4 * G, y = -(this.p['g' + k] / 12) * 0.7 * G; g.line(x, -0.75 * G, x, 0.75 * G, g.muted, g.lw * 0.4); g.box(x - 3, y - 2, x + 3, y + 2, { fill: g.accent, r: 1 }); });
  }
}
register(Equalizer);

export class SAWFilter extends FilterBlock {
  static type = 'sawfilter'; static title = 'SAW Band-Pass Filter'; static category = 'Communication';
  static keywords = 'saw filter surface acoustic wave band pass rf 433 mhz 915 mhz receiver front end';
  static props = [
    { key: 'fc', label: 'Centre frequency', unit: 'Hz', def: 433.92e6, min: 1e5, max: 1e10, log: true, knob: true },
    { key: 'bw', label: '3 dB bandwidth', unit: 'Hz', def: 1e6, min: 1e3, max: 1e9, log: true },
    { key: 'il', label: 'Insertion loss', unit: 'dB', def: 3, min: 0, max: 30 },
  ];
  static description = 'Surface-acoustic-wave band-pass filter (behavioural): a very selective RF band-pass (modelled as 3rd-order Chebyshev) with a few dB insertion loss, 50 Ω in and out — the front-end filter of 433/868/915 MHz receivers and remote controls.';
  sections() { return designFilter('bp', 'cheby', 3, this.p.fc, this.p.bw); }
  gain() { return db(-this.p.il); }
  zin() { return 50; }
  rout() { return 50; }
  glyph() { return 'SAW'; }
  valueLabel() { return fmtShort(this.p.fc, 'Hz'); }
}
register(SAWFilter);

// ------------------------------------------------------------- 74HC595
export class HC595 extends Chip {
  static type = 'hc595'; static title = 'Shift Register 74HC595 (latched)'; static category = 'Digital';
  static chip = '595'; static keywords = '74hc595 595 shift register latch serial to parallel spi led driver output expander';
  static pins = [P('SER', 'L', 'i'), P('SRCLK', 'L', 'i'), P('RCLK', 'L', 'i'), P('¬OE', 'L', 'i'), ...[0, 1, 2, 3, 4, 5, 6, 7].map((k) => P('Q' + k, 'R', 'o')), P("Q7'", 'R', 'o')];
  static chipOpts = { dense: true };
  static description = '8-bit serial-in shift register with an output latch: each rising SRCLK edge shifts SER into the register (Q7′ is the serial output for cascading); a rising RCLK edge copies the register to Q0–Q7 at once, so the outputs never show the shifting. ¬OE high tri-states (here: pulls low) the outputs. With MSB-first SPI, the first bit sent ends on Q7.';
  resetState() { this.sr = 0; this.lat = 0; this.pc = false; this.pl = false; }
  compute(i, settle) {
    if (!settle && i[1] && !this.pc) this.sr = ((this.sr << 1) | (i[0] ? 1 : 0)) & 255;
    if (!settle && i[2] && !this.pl) this.lat = this.sr;
    this.pc = i[1]; this.pl = i[2];
    const q = i[3] ? bits(0, 8) : bits(this.lat, 8);
    return [...q, !!(this.sr & 128)];
  }
  shown() { return (this.lat ?? 0).toString(2).padStart(8, '0'); }
}
register(HC595);

// ---------------------------------------------------------------- SPI master
export class SPIMaster extends Chip {
  static type = 'spimaster'; static title = 'SPI Master (byte sender)'; static category = 'Communication';
  static chip = 'SPI'; static keywords = 'spi master serial peripheral interface sck mosi cs chip select clock data behavioural';
  static pins = [P('SCK', 'R', 'o'), P('MOSI', 'R', 'o'), P('¬CS', 'R', 'o')];
  static props = [
    { key: 'data', label: 'Bytes to send (hex)', type: 'text', def: '81 42 24 18' },
    { key: 'clk', label: 'Clock frequency', unit: 'Hz', def: 10000, min: 1, max: 1e8, log: true },
    { key: 'gap', label: 'Pause between bytes', unit: 's', def: 0.05, min: 0, max: 100 },
    ...DIGI_PROPS,
  ];
  static description = 'Behavioural SPI master (mode 0, MSB first, no code): for each byte it pulls ¬CS low, clocks out eight bits on MOSI (data changes while SCK is low, the slave samples on the rising edge) and releases ¬CS, then pauses — cycling through the list. Drive a 74HC595 (SCK→SRCLK, MOSI→SER, ¬CS→RCLK) to set eight outputs.';
  outputs() { return [0, 1, 2]; }
  inputs() { return []; }
  resetState() { this.t0 = null; this.idx = 0; }
  compute() { return [false, false, true]; }
  preStep(s) {
    if (s.mode === 'dc') return;
    const t = s.tNext, T = 1 / this.p.clk, bytes = hexBytes(this.p.data);
    this.t0 ??= t;
    const frameT = 9 * T + this.p.gap, n = bytes.length || 1, k = Math.floor((t - this.t0) / frameT), tt = t - this.t0 - k * frameT;
    this.idx = k % n;
    const byte = bytes[this.idx] ?? 0;
    let o;
    if (tt < 0.5 * T || tt >= 8.5 * T) o = [false, false, true];
    else { const b = Math.floor((tt - 0.5 * T) / T), ph = (tt - 0.5 * T) / T - b; o = [ph >= 0.5, !!((byte >> (7 - b)) & 1), false]; }
    if (o.some((v, j) => v !== this.out[j])) { this.out = o; s.event = true; }
  }
  shown() { const b = hexBytes(this.p.data)[this.idx ?? 0]; return b == null ? '' : '0x' + b.toString(16).toUpperCase().padStart(2, '0'); }
  readings() { return [['Sending byte', this.shown(), ''], ['Clock', this.p.clk, 'Hz']]; }
}
register(SPIMaster);

// -------------------------------------------------------------- I²C bus
/** open-drain bus pin helper: pulls low through 20 Ω or releases */
const OD_ON = 1 / 20, OD_OFF = 1e-9;

export class I2CMaster extends withChip(Element) {
  static type = 'i2cmaster'; static title = 'I²C Master (byte writer)'; static category = 'Communication';
  static prefix = 'U'; static keywords = 'i2c iic twi master sda scl open drain pull up address ack write behavioural';
  static props = [
    { key: 'addr', label: '7-bit slave address', unit: '', def: 32, min: 0, max: 127 },
    { key: 'data', label: 'Data bytes (hex)', type: 'text', def: 'FE FD FB F7 EF DF BF 7F' },
    { key: 'rate', label: 'Bus speed', unit: 'Hz', def: 20000, min: 100, max: 1e6, log: true },
    { key: 'gap', label: 'Pause between transactions', unit: 's', def: 0.02, min: 0, max: 100 },
    { key: 'vdd', label: 'Logic supply (thresholds)', unit: 'V', def: 5, min: 1, max: 15 },
  ];
  static pins = [['SCL', 'R'], ['SDA', 'R']];
  static description = 'Behavioural I²C master (no code): repeatedly writes one data byte per transaction to the slave address — START, address + W, ACK, data, ACK, STOP — through open-drain SCL/SDA (add pull-up resistors, e.g. 4.7 kΩ to 5 V). It checks the slave’s acknowledge bits and reports ACK / NACK.';
  constructor(x, y) { super(x, y); this.postCurrents = [0, 0]; }
  connectivity() { return [[0, 'gnd'], [1, 'gnd']]; }
  reset() { this.t0 = null; this.dr = [false, false]; this.lastAck = '—'; this.idx = 0; this.ackBits = []; this.postCurrents = [0, 0]; }
  /** sequence of quarter-bit states [sclLow, sdaLow, sampleAck] for one transaction */
  seqFor(byte) {
    const q = [], addr = ((this.p.addr & 127) << 1) | 0;
    q.push([false, false, 0], [false, true, 0], [true, true, 0]); // idle → START (SDA falls while SCL high) → SCL low
    const sendByte = (b) => {
      for (let k = 7; k >= 0; k--) { const low = !((b >> k) & 1); q.push([true, low, 0], [false, low, 0], [false, low, 0], [true, low, 0]); }
      q.push([true, false, 0], [false, false, 1], [false, false, 0], [true, false, 0]); // ACK bit: release SDA, sample while SCL high
    };
    sendByte(addr); sendByte(byte);
    q.push([true, true, 0], [false, true, 0], [false, false, 0]); // STOP: SDA rises while SCL high
    return q;
  }
  stamp(s) { const [scl, sda] = this.nodes; s.addG(scl, 0, this.dr[0] ? OD_ON : OD_OFF); s.addG(sda, 0, this.dr[1] ? OD_ON : OD_OFF); }
  stampAC(ac) { const [scl, sda] = this.nodes; ac.addY(scl, 0, OD_OFF); ac.addY(sda, 0, OD_OFF); }
  preStep(s) {
    if (s.mode === 'dc') return;
    const bytes = hexBytes(this.p.data), Tq = 1 / (4 * this.p.rate), t = s.tNext;
    this.t0 ??= t;
    const qlen = 3 + 2 * 36 + 3, frameT = qlen * Tq + this.p.gap, k = Math.floor((t - this.t0) / frameT), tt = t - this.t0 - k * frameT;
    this.idx = k % Math.max(1, bytes.length);
    const qs = this.seqFor(bytes[this.idx] ?? 0), qi = Math.floor(tt / Tq);
    const st = qi < qs.length ? qs[qi] : [false, false, 0];
    if (st[2] && this.sampleAt !== k * 1000 + qi) {
      this.sampleAt = k * 1000 + qi;
      this.ackBits.push(s.v(this.nodes[1]) < 0.3 * this.p.vdd);
      if (this.ackBits.length === 2) { this.lastAck = this.ackBits.every(Boolean) ? 'ACK' : 'NACK (no slave answered)'; this.ackBits = []; }
    }
    const dr = [st[0], st[1]];
    if (dr[0] !== this.dr[0] || dr[1] !== this.dr[1]) { this.dr = dr; s.markEvent(); }
  }
  accept(s) { const [scl, sda] = this.nodes; this.postCurrents = [s.v(scl) * (this.dr[0] ? OD_ON : OD_OFF), s.v(sda) * (this.dr[1] ? OD_ON : OD_OFF)]; this.i = this.postCurrents[1]; }
  valueLabel() { return `0x${(this.p.addr & 127).toString(16).toUpperCase().padStart(2, '0')}`; }
  readings() { const b = hexBytes(this.p.data)[this.idx ?? 0]; return [['Address', this.valueLabel(), ''], ['Writing', b == null ? '—' : '0x' + b.toString(16).toUpperCase().padStart(2, '0'), ''], ['Slave response', this.lastAck, '']]; }
  draw(g) { this.drawChip(g, 'I²C M'); }
}
register(I2CMaster);

export class PCF8574 extends withChip(Element) {
  static type = 'pcf8574'; static title = 'I²C I/O Expander (PCF8574)'; static category = 'Communication';
  static prefix = 'U'; static keywords = 'pcf8574 i2c io expander port expander 8 bit quasi bidirectional led lcd backpack';
  static props = [
    { key: 'addr', label: '7-bit address', unit: '', def: 32, min: 0, max: 127 },
    { key: 'vdd', label: 'Supply', unit: 'V', def: 5, min: 1, max: 15 },
  ];
  static pins = [['SCL', 'L'], ['SDA', 'L'], ...[0, 1, 2, 3, 4, 5, 6, 7].map((k) => ['P' + k, 'R'])];
  static chipOpts = { dense: true };
  static description = 'I²C slave with eight quasi-bidirectional port pins: it watches SCL/SDA for a START, compares the address, acknowledges by pulling SDA low on the 9th clock, and writes each received data byte to P0–P7 (1 = weak pull-up ≈100 µA, 0 = strong sink ≈25 mA — so LEDs are connected from VCC to the pin, active low). Default address 0x20.';
  constructor(x, y) { super(x, y); this.postCurrents = new Array(10).fill(0); }
  connectivity() { return null; }
  reset() { this.st = 'idle'; this.sh = 0; this.nb = 0; this.ack = false; this.port = 255; this.pScl = true; this.pSda = true; this.sel = false; this.rx = 0; this.postCurrents.fill(0); }
  pinG(k) { return (this.port >> k) & 1 ? 1 / 50e3 : 1 / 20; }
  stamp(s) {
    s.addG(this.nodes[1], 0, this.ack ? OD_ON : OD_OFF); s.addG(this.nodes[0], 0, OD_OFF);
    for (let k = 0; k < 8; k++) s.addG(this.nodes[2 + k], 0, this.pinG(k));
  }
  stampStep(s) { for (let k = 0; k < 8; k++) if ((this.port >> k) & 1) s.addI(0, this.nodes[2 + k], this.p.vdd / 50e3); }
  stampAC(ac) { for (let k = 0; k < 8; k++) ac.addY(this.nodes[2 + k], 0, this.pinG(k)); ac.addY(this.nodes[1], 0, OD_OFF); }
  preStep(s) {
    if (s.mode === 'dc') return;
    const lvl = (n, prev) => { const v = s.v(n); return prev ? v > 0.3 * this.p.vdd : v > 0.7 * this.p.vdd; };
    const scl = lvl(this.nodes[0], this.pScl), sda = lvl(this.nodes[1], this.pSda);
    let ack = this.ack, port = this.port;
    if (scl && this.pScl && this.pSda && !sda) { this.st = 'addr'; this.sh = 0; this.nb = 0; ack = false; } // START
    else if (scl && this.pScl && !this.pSda && sda) { this.st = 'idle'; ack = false; } // STOP
    else if (this.st !== 'idle') {
      if (scl && !this.pScl) { // rising SCL: sample
        if (this.nb < 8) { this.sh = ((this.sh << 1) | (sda ? 1 : 0)) & 255; this.nb++; }
      } else if (!scl && this.pScl) { // falling SCL
        if (this.nb === 8 && !ack) {
          if (this.st === 'addr') { this.sel = this.sh >> 1 === (this.p.addr & 127) && !(this.sh & 1); ack = this.sel; this.st = this.sel ? 'data' : 'idle'; }
          else if (this.st === 'data') { port = this.sh; this.rx++; ack = true; }
          this.nb = 9;
        } else if (this.nb === 9) { ack = false; this.nb = 0; this.sh = 0; }
      }
    }
    this.pScl = scl; this.pSda = sda;
    if (ack !== this.ack || port !== this.port) { this.ack = ack; this.port = port; s.markEvent(); }
  }
  accept(s) {
    this.postCurrents[0] = s.v(this.nodes[0]) * OD_OFF;
    this.postCurrents[1] = s.v(this.nodes[1]) * (this.ack ? OD_ON : OD_OFF);
    for (let k = 0; k < 8; k++) { const n = this.nodes[2 + k]; this.postCurrents[2 + k] = s.v(n) * this.pinG(k) - ((this.port >> k) & 1 ? this.p.vdd / 50e3 : 0); }
    this.i = this.postCurrents[1];
  }
  valueLabel() { return `0x${(this.p.addr & 127).toString(16).toUpperCase().padStart(2, '0')}`; }
  readings() { return [['Port P7…P0', (this.port ?? 255).toString(2).padStart(8, '0'), ''], ['Bytes received', this.rx || 0, ''], ['Bus state', this.st, '']]; }
  draw(g) { this.drawChip(g, '8574'); }
}
register(PCF8574);
