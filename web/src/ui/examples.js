// Built-in example circuits. Coordinates are in grid units (1 = 20 px).

import { CircuitDoc, makeElement } from './doc.js';
import { GRID } from '../elements/index.js';
import { WIRE_PRESETS } from '../elements/cables.js';
import { EXAMPLES2, ALLOW_OPEN2 } from './examples2.js';
import { EXAMPLES3, ALLOW_OPEN3 } from './examples3.js';
import { EXAMPLES4, ALLOW_OPEN4 } from './examples4.js';

const G = GRID;

function builder(name) {
  const doc = new CircuitDoc(name);
  let pid = 1;
  const b = {
    doc,
    /** place element: rot 0 horizontal; 'v' = rot 1 (post0 on top); 'vr' = rot 3 (post0 at bottom) */
    el(type, x, y, p = {}, rot = 0, flip = false) {
      const e = makeElement(type, x * G, y * G);
      if (!e) throw new Error('unknown type ' + type);
      e.rot = rot; e.flip = flip;
      Object.assign(e.p, p);
      e.onParamChange();
      doc.add(e);
      return e;
    },
    h(type, x, y, p) { return b.el(type, x, y, p, 0); },
    v(type, x, y, p) { return b.el(type, x, y, p, 1); },
    vr(type, x, y, p) { return b.el(type, x, y, p, 3); },
    /**
     * wires drawn after setting b.cable get that cable; by default (null) the same 1.5 mm² house
     * wire as a newly drawn wire, so example wires overheat and burn like real ones too
     * ('ideal' = a wire with no limit)
     */
    cable: null,
    w(...pts) { const c = b.cable === 'ideal' ? null : b.cable || WIRE_PRESETS['hw1.5']; doc.addWire(pts.map(([x, y]) => [x * G, y * G]), c ? { cable: { ...c } } : null); },
    node(x, y, color) { doc.probes.push({ id: 'e' + pid++, kind: 'node', pos: [x * G, y * G], color, label: '', unit: 'V' }); },
    volt(e, color) { doc.probes.push({ id: 'e' + pid++, kind: 'volt', el: e.id, color, label: '', unit: 'V' }); },
    cur(e, color) { doc.probes.push({ id: 'e' + pid++, kind: 'cur', el: e.id, color, label: '', unit: 'A' }); },
    /** grid coordinates of post k of element e */
    pin(e, k) { const p = e.getPosts()[k]; return [p[0] / G, p[1] / G]; },
    label(x, y, text, size = 10) { return b.el('label', x, y, { text, size }); },
  };
  return b;
}

const C = ['#facc15', '#22d3ee', '#f472b6', '#4ade80'];

const BASE = [
  {
    id: 'led', cat: 'Basics', title: 'LED with switch',
    desc: 'The "hello world" of electronics. Tap the switch to turn the LED on. The resistor limits current to I = (9 V − Vf)/470 Ω ≈ 15 mA.',
    build(b) {
      b.v('dcv', 0, 0, { amp: 9 });
      b.h('switch', 4, -4, { closed: true });
      b.h('resistor', 10, -4, { r: 470 });
      const led = b.v('led', 14, 0, { color: 'red' });
      b.el('ground', 0, 4);
      b.w([0, -2], [0, -4], [2, -4]); b.w([6, -4], [8, -4]); b.w([12, -4], [14, -4], [14, -2]);
      b.w([14, 2], [14, 4], [0, 4]); b.w([0, 2], [0, 4]);
      b.cur(led, C[0]);
    },
  },
  {
    id: 'divider', cat: 'Basics', title: 'Voltage divider & potentiometer',
    desc: 'Vout = Vin·R2/(R1+R2) = 12 V · 4.7k/14.7k ≈ 3.84 V. Select the potentiometer and turn the knob to vary its wiper voltage continuously.',
    build(b) {
      b.v('dcv', 0, 0, { amp: 12 });
      b.v('resistor', 6, -2, { r: 10000 });
      b.v('resistor', 6, 2, { r: 4700 });
      b.v('voltmeter', 10, 2);
      b.v('pot', 16, 0, { r: 10000, pos: 30 });
      b.v('voltmeter', 22, 2);
      b.el('ground', 0, 6);
      b.w([0, -2], [0, -4], [6, -4]); b.w([0, 2], [0, 4], [6, 4]); b.w([0, 4], [0, 6]);
      b.w([6, 0], [10, 0]); b.w([6, 4], [10, 4]);
      b.w([6, -4], [16, -4], [16, -2]); b.w([10, 4], [16, 4], [16, 2]);
      b.w([18, 0], [22, 0]); b.w([16, 4], [22, 4]);
    },
  },
  {
    id: 'network', cat: 'Basics', title: 'Series–parallel resistors',
    desc: 'Equivalent resistance: 100 Ω + (200‖200) + (300‖300‖300) = 300 Ω, so the source supplies 3 V / 300 Ω = 10 mA. Watch how the current splits at every junction (Kirchhoff\'s current law).',
    build(b) {
      b.v('dcv', 0, 2, { amp: 3 });
      const r1 = b.v('resistor', 8, -2, { r: 100 });
      b.v('resistor', 4, 4, { r: 200 }); b.v('resistor', 12, 4, { r: 200 });
      for (const x of [2, 8, 14]) b.v('resistor', x, 10, { r: 300 });
      b.el('ground', 0, 16);
      b.w([0, 0], [0, -4], [8, -4]); b.w([8, 0], [8, 2]); b.w([4, 2], [12, 2]);
      b.w([4, 6], [12, 6]); b.w([8, 6], [8, 8]); b.w([2, 8], [14, 8]);
      b.w([2, 12], [14, 12]); b.w([0, 4], [0, 14], [8, 14], [8, 12]); b.w([0, 14], [0, 16]);
      b.cur(r1, C[0]);
    },
  },
  {
    id: 'rc', cat: 'Basics', title: 'RC charging & discharging',
    desc: 'Close the switch to charge the 100 µF capacitor through 1 kΩ (τ = RC = 0.1 s): after one τ it reaches 63 % of the supply. Open it and hold the push button to discharge through 100 Ω.',
    build(b) {
      b.v('dcv', 0, 0, { amp: 5 });
      b.h('switch', 4, -4, { closed: false });
      b.h('resistor', 10, -4, { r: 1000 });
      const c = b.v('capacitor', 14, 0, { c: 100e-6 });
      b.v('pushno', 18, 0);
      b.v('resistor', 18, 4, { r: 100 });
      b.el('ground', 0, 8);
      b.w([0, -2], [0, -4], [2, -4]); b.w([6, -4], [8, -4]); b.w([12, -4], [14, -4], [14, -2]);
      b.w([14, -4], [18, -4], [18, -2]); b.w([0, 2], [0, 6], [18, 6]); b.w([14, 2], [14, 6]); b.w([0, 6], [0, 8]);
      b.volt(c, C[0]); b.cur(c, C[1]);
      b.doc.simSettings.speed = 0.15;
    },
  },
  {
    id: 'lrc', cat: 'Basics', title: 'LRC oscillator',
    desc: 'With the switch closed the inductor carries 50 mA. Open the switch: the stored energy rings between L and C at f = 1/(2π√LC) ≈ 71 Hz, decaying with α = R/2L = 25 s⁻¹.',
    build(b) {
      b.h('resistor', 4, -4, { r: 50 });
      const c = b.h('capacitor', 4, 4, { c: 5e-6 });
      const l = b.v('inductor', 8, 0, { l: 1 });
      b.h('switch', 12, -4, { closed: true });
      b.v('dcv', 16, 0, { amp: 5 });
      b.h('resistor', 12, 4, { r: 100 });
      b.el('ground', 8, 6);
      b.w([2, -4], [2, 4]); b.w([6, -4], [8, -4], [8, -2]); b.w([6, 4], [8, 4], [8, 2]);
      b.w([8, -4], [10, -4]); b.w([14, -4], [16, -4], [16, -2]); b.w([16, 2], [16, 4], [14, 4]);
      b.w([10, 4], [8, 4]); b.w([8, 4], [8, 6]);
      b.cur(l, C[0]); b.volt(c, C[1]);
      b.doc.simSettings.speed = 0.03;
    },
  },
  {
    id: 'diodeiv', cat: 'Basics', title: 'Diode I–V characteristic',
    desc: 'Open Analysis → DC Sweep, sweep V1 from 0 to 3 V and measure I(D1) to trace the exponential Shockley curve. Try the Zener or LED models too.',
    build(b) {
      b.v('dcv', 0, 0, { amp: 1.5 });
      b.h('resistor', 4, -4, { r: 10 });
      const d = b.v('diode', 8, 0);
      b.el('ground', 0, 4);
      b.w([0, -2], [0, -4], [2, -4]); b.w([6, -4], [8, -4], [8, -2]); b.w([8, 2], [8, 4], [0, 4]); b.w([0, 2], [0, 4]);
      b.cur(d, C[0]); b.volt(d, C[1]);
    },
  },
  {
    id: 'lowpass', cat: 'AC & Filters', title: 'RC low-pass filter',
    desc: 'First-order filter with cut-off fc = 1/(2πRC) ≈ 1 kHz. Open Analysis → AC Sweep to draw the Bode plot: −3 dB and −45° at fc, then −20 dB/decade.',
    build(b) {
      b.v('acv', 0, 0, { amp: 1, freq: 1000 });
      b.h('resistor', 4, -4, { r: 1000 });
      b.v('capacitor', 8, 0, { c: 159e-9 });
      b.el('ground', 0, 6);
      b.w([0, -2], [0, -4], [2, -4]); b.w([6, -4], [8, -4], [8, -2]); b.w([8, -4], [11, -4]);
      b.w([8, 2], [8, 4], [0, 4]); b.w([0, 2], [0, 4]); b.w([0, 4], [0, 6]);
      b.node(0, -4, C[0]); b.node(11, -4, C[1]);
    },
  },
  {
    id: 'bandpass', cat: 'AC & Filters', title: 'Series RLC resonance',
    desc: 'L = 10 mH and C = 100 nF resonate at f₀ = 1/(2π√LC) ≈ 5.03 kHz where the output peaks. Q = (1/R)√(L/C) ≈ 3.2. Run an AC sweep, or turn the source frequency knob.',
    build(b) {
      b.v('acv', 0, 0, { amp: 1, freq: 5033 });
      b.h('inductor', 4, -4, { l: 0.01 });
      b.h('capacitor', 10, -4, { c: 100e-9 });
      const r = b.v('resistor', 14, 0, { r: 100 });
      b.el('ground', 0, 6);
      b.w([0, -2], [0, -4], [2, -4]); b.w([6, -4], [8, -4]); b.w([12, -4], [14, -4], [14, -2]);
      b.w([14, 2], [14, 4], [0, 4]); b.w([0, 2], [0, 4]); b.w([0, 4], [0, 6]);
      b.node(0, -4, C[0]); b.volt(r, C[1]);
    },
  },
  {
    id: 'halfwave', cat: 'Power', title: 'Half-wave rectifier',
    desc: 'The diode conducts only on positive half-cycles; the 470 µF reservoir capacitor holds the voltage up between peaks. Ripple ≈ I/(f·C).',
    build(b) {
      b.v('acv', 0, 0, { amp: 12, freq: 50 });
      b.h('diode', 5, -4, { model: '1N4007', is: 7e-9, n: 1.9, bv: 1000 });
      b.v('ecap', 10, 0, { c: 470e-6 });
      b.v('resistor', 15, 0, { r: 1000 });
      b.el('ground', 0, 6);
      b.w([0, -2], [0, -4], [3, -4]); b.w([7, -4], [10, -4], [10, -2]); b.w([10, -4], [15, -4], [15, -2]);
      b.w([15, 2], [15, 4], [0, 4]); b.w([10, 2], [10, 4]); b.w([0, 2], [0, 4]); b.w([0, 4], [0, 6]);
      b.node(0, -4, C[0]); b.node(15, -4, C[1]);
    },
  },
  {
    id: 'bridge', cat: 'Power', title: 'Transformer + bridge rectifier',
    desc: '230 V mains (325 V peak) stepped down 20:1 by the transformer, full-wave rectified by four diodes and smoothed by 1000 µF. Both half-cycles charge the capacitor, halving the ripple.',
    build(b) {
      b.v('acv', -10, 0, { amp: 325, freq: 50 });
      b.el('ground', -10, 4);
      b.el('transformer', -4, 0, { l1: 10, n: 0.05, k: 0.999, r1: 1, r2: 0.05 });
      const dm = { model: '1N4007', is: 7e-9, n: 1.9, bv: 1000 };
      b.h('diode', 6, -2, dm); b.h('diode', 10, -2, dm); b.h('diode', 6, 2, dm); b.h('diode', 10, 2, dm);
      b.v('ecap', 16, 0, { c: 1000e-6, vmax: 35 });
      const rl = b.v('resistor', 20, 0, { r: 220, pw: '1' });
      b.w([-10, -2], [-6, -2]); b.w([-10, 2], [-6, 2]); b.w([-10, 2], [-10, 4]);
      b.w([4, -2], [4, 2]); b.w([12, -2], [12, 2]);
      b.w([-2, -2], [-2, -6], [8, -6], [8, -2]); b.w([-2, 2], [-2, 6], [8, 6], [8, 2]);
      b.w([12, -2], [16, -2]); b.w([16, -2], [20, -2]);
      b.w([4, 2], [4, 8], [16, 8], [16, 2]); b.w([20, 2], [20, 8], [16, 8]);
      b.volt(rl, C[0]);
      b.doc.simSettings.speed = 0.04;
    },
  },
  {
    id: 'zener', cat: 'Power', title: 'Zener shunt regulator',
    desc: 'The 5.1 V Zener holds the output nearly constant while the input varies. Turn the source knob: above ~5.5 V the output stays at the Zener voltage while the resistor drops the rest.',
    build(b) {
      b.v('dcv', 0, 0, { amp: 12 });
      b.h('resistor', 4, -4, { r: 470 });
      b.vr('zener', 8, 0, { bv: 5.1 });
      b.v('resistor', 12, 0, { r: 1000 });
      b.v('voltmeter', 16, 0);
      b.el('ground', 0, 6);
      b.w([0, -2], [0, -4], [2, -4]); b.w([6, -4], [8, -4], [8, -2]); b.w([8, -4], [12, -4], [12, -2]); b.w([12, -4], [16, -4], [16, -2]);
      b.w([0, 2], [0, 4], [16, 4], [16, 2]); b.w([8, 2], [8, 4]); b.w([12, 2], [12, 4]); b.w([0, 4], [0, 6]);
    },
  },
  {
    id: 'reg7805', cat: 'Power', title: '5 V regulated supply (7805)',
    desc: 'A linear regulator keeps the output at 5 V as long as the input stays ≥ 7 V (2 V dropout). Lower the battery voltage with the knob to watch it drop out of regulation.',
    build(b) {
      b.v('dcv', 0, 0, { amp: 9 });
      b.el('reg78', 6, -4, { vout: 5, vdo: 2 });
      b.v('resistor', 12, 0, { r: 100 });
      b.v('voltmeter', 16, 0);
      b.el('ground', 0, 6);
      b.w([0, -2], [0, -4], [4, -4]); b.w([8, -4], [12, -4], [12, -2]); b.w([12, -4], [16, -4], [16, -2]);
      b.w([6, -2], [6, 4]); b.w([0, 2], [0, 4], [16, 4], [16, 2]); b.w([12, 2], [12, 4]); b.w([0, 4], [0, 6]);
    },
  },
  {
    id: 'ceamp', cat: 'Transistors', title: 'Common-emitter amplifier',
    desc: 'Voltage-divider biasing (VB ≈ 2.1 V, IC ≈ 1.4 mA) with emitter bypass capacitor. Small-signal gain ≈ −RC‖RL / re ≈ −130: the 10 mV input becomes ~1.3 V at the output. Run an AC sweep to see the pass-band.',
    build(b) {
      b.el('rail', 9, -10, { amp: 12 });
      b.v('resistor', 4, -6, { r: 47000 });
      b.v('resistor', 4, 4, { r: 10000 });
      b.el('npn', 8, 0, { model: '2N3904' });
      b.v('resistor', 9, -6, { r: 3300 });
      b.v('resistor', 9, 6, { r: 1000 });
      b.v('ecap', 13, 6, { c: 100e-6 });
      b.h('capacitor', 1, 0, { c: 10e-6 });
      b.v('acv', -6, 4, { amp: 0.01, freq: 1000 });
      b.h('capacitor', 13, -4, { c: 10e-6 });
      b.v('resistor', 17, 0, { r: 10000 });
      b.el('ground', 4, 10);
      b.w([9, -10], [9, -8]); b.w([4, -8], [9, -8]);
      b.w([4, -4], [4, 0], [6, 0]); b.w([4, 0], [4, 2]);
      b.w([9, -4], [9, -2]); b.w([9, -4], [11, -4]); b.w([9, 2], [9, 4]); b.w([9, 4], [13, 4]);
      b.w([4, 6], [4, 8], [13, 8]); b.w([4, 8], [4, 10]);
      b.w([3, 0], [4, 0]); b.w([-6, 2], [-6, 0], [-1, 0]); b.w([-6, 6], [-6, 8], [4, 8]);
      b.w([15, -4], [17, -4], [17, -2]); b.w([17, 2], [17, 8], [13, 8]);
      b.node(-6, 0, C[0]); b.node(17, -4, C[1]);
      b.doc.simSettings.speed = 0.001;
    },
  },
  {
    id: 'mosfet', cat: 'Transistors', title: 'MOSFET PWM motor control',
    desc: 'A logic-level MOSFET switches the motor with a 1 kHz PWM signal. Motor speed follows the duty cycle – select the pulse source and change its duty. The flyback diode clamps the inductive kick.',
    build(b) {
      b.el('rail', 10, -10, { amp: 12 });
      const m = b.v('motor', 10, -4);
      b.vr('diode', 22, -4, { model: '1N5819', is: 3e-6, n: 1.1, bv: 40 });
      b.el('nmos', 9, 2, { model: 'IRLZ44N', vt: 1.6, kp: 25, lambda: 0.005, cgs: 1.6e-9, cgd: 2e-10, bodyDiode: true });
      b.v('pulse', 0, 4, { amp: 5, freq: 1000, duty: 60 });
      b.h('resistor', 4, 2, { r: 100 });
      b.el('ground', 10, 6);
      b.w([10, -10], [10, -6]); b.w([10, -6], [22, -6]); b.w([22, -2], [10, -2]); b.w([10, -2], [10, 0]);
      b.w([10, 4], [10, 6]); b.w([0, 2], [2, 2]); b.w([6, 2], [7, 2]); b.w([0, 6], [0, 8], [10, 8], [10, 6]);
      b.cur(m, C[0]);
      b.doc.simSettings.speed = 0.02;
    },
  },
  {
    id: 'inverting', cat: 'Op-Amps', title: 'Inverting amplifier',
    desc: 'Gain = −Rf/Rin = −10. The op-amp drives its inverting input to a virtual ground. Switch the op-amp model to LM741 to see finite bandwidth in an AC sweep.',
    build(b) {
      b.el('opamp', 8, 0);
      b.h('resistor', 2, -1, { r: 1000 });
      b.h('resistor', 8, -5, { r: 10000 });
      b.el('ground', 6, 3);
      b.v('acv', -2, 3, { amp: 0.5, freq: 1000 });
      b.el('ground', -2, 5);
      b.v('resistor', 14, 2, { r: 10000 });
      b.el('ground', 14, 4);
      b.w([4, -1], [6, -1]); b.w([6, -5], [6, -1]); b.w([10, -5], [10, 0]); b.w([6, 1], [6, 3]);
      b.w([-2, 1], [-2, -1], [0, -1]); b.w([10, 0], [14, 0]);
      b.node(-2, -1, C[0]); b.node(14, 0, C[1]);
    },
  },
  {
    id: 'thermo', cat: 'Sensors', title: 'Temperature alarm (NTC)',
    desc: 'An NTC thermistor forms a divider with 10 kΩ. When it heats above ≈ 30 °C its voltage exceeds the 2.8 V reference and the comparator sounds the buzzer. Select the NTC and turn the temperature knob.',
    build(b) {
      b.el('rail', 2, -10, { amp: 5 });
      b.v('ntc', 2, -4, { temp: 22 });
      b.v('resistor', 2, 4, { r: 10000 });
      b.el('comparator', 8, 1, {}, 0, true);
      b.el('rail', 6, 4, { amp: 2.8 }, 2);
      b.v('buzzer', 14, 4);
      b.v('led', 18, 2, { color: 'red' });
      b.v('resistor', 18, 6, { r: 220 });
      b.el('ground', 2, 10);
      b.w([2, -10], [2, -6]); b.w([2, -2], [2, 2]); b.w([2, 0], [6, 0]); b.w([6, 2], [6, 4]);
      b.w([10, 1], [14, 1], [14, 2]); b.w([14, 1], [18, 1], [18, 0]);
      b.w([2, 6], [2, 8], [18, 8]); b.w([14, 6], [14, 8]); b.w([2, 8], [2, 10]);
      b.node(2, 0, C[0]);
    },
  },
  {
    id: 'nightlight', cat: 'Sensors', title: 'LDR night light',
    desc: 'In bright light the LDR has low resistance, holding the transistor off. As it gets dark its resistance rises, the base voltage climbs and the LED switches on. Select the LDR and turn the light knob.',
    build(b) {
      b.el('rail', 4, -14, { amp: 9 });
      b.v('resistor', 4, -6, { r: 10000 });
      b.v('ldr', 4, 2, { lux: 1000 });
      b.h('resistor', 8, 0, { r: 4700 });
      b.el('npn', 14, 0, { model: 'BC547' });
      b.v('resistor', 15, -10, { r: 470 });
      const led = b.v('led', 15, -6, { color: 'yellow' });
      b.el('ground', 4, 8);
      b.w([4, -14], [4, -12], [15, -12]); b.w([4, -12], [4, -8]); b.w([4, -4], [4, 0]); b.w([4, 0], [6, 0]); b.w([10, 0], [12, 0]);
      b.w([15, -4], [15, -2]); b.w([15, 2], [15, 6]); b.w([4, 4], [4, 6], [15, 6]); b.w([4, 6], [4, 8]);
      b.cur(led, C[0]);
    },
  },
  {
    id: 'bridge-sg', cat: 'Sensors', title: 'Strain-gauge Wheatstone bridge',
    desc: 'A 350 Ω strain gauge in a balanced bridge. Strain ε changes its resistance by GF·ε, producing a small differential voltage ≈ Vs·GF·ε/4 (≈ 2.5 mV at 1000 µε).',
    build(b) {
      b.el('rail', 6, -8, { amp: 5 });
      b.v('resistor', 2, -4, { r: 350 }); b.v('resistor', 2, 0, { r: 350 });
      b.v('strain', 10, -4, { strain: 1000 }); b.v('resistor', 10, 0, { r: 350 });
      b.h('voltmeter', 6, -2);
      b.el('ground', 6, 4);
      b.w([6, -8], [6, -6]); b.w([2, -6], [10, -6]); b.w([2, 2], [10, 2]); b.w([6, 2], [6, 4]);
      b.w([2, -2], [4, -2]); b.w([8, -2], [10, -2]);
    },
  },
  {
    id: 'solar', cat: 'Sensors', title: 'Solar panel with load',
    desc: '36-cell panel (Voc ≈ 21.6 V, Isc = 3 A). Change the irradiance knob, or run a DC sweep of the load resistance and measure power to find the maximum power point.',
    build(b) {
      b.v('solar', 0, 0, { cells: 36, isc: 3, voc: 0.6, irr: 1000 });
      b.h('ammeter', 4, -4);
      const r = b.v('resistor', 8, 0, { r: 7, pw: '100' });
      b.v('voltmeter', 12, 0);
      b.el('ground', 0, 6);
      b.w([0, -2], [0, -4], [2, -4]); b.w([6, -4], [8, -4], [8, -2]); b.w([8, -4], [12, -4], [12, -2]);
      b.w([0, 2], [0, 4], [12, 4], [12, 2]); b.w([8, 2], [8, 4]); b.w([0, 4], [0, 6]);
      b.volt(r, C[0]); b.cur(r, C[1]);
    },
  },
  {
    id: 'timer555', cat: 'Timers & ICs', title: '555 astable LED flasher',
    desc: 'Classic NE555 astable: the capacitor charges through R1 + R2 and discharges through R2. f = 1.44/((R1 + 2R2)·C) ≈ 6.9 Hz, duty ≈ 52 %.',
    build(b) {
      b.el('rail', 3, -8, { amp: 9 });
      b.el('timer555', 10, 0);
      b.v('resistor', 3, -4, { r: 1000 });
      b.v('resistor', 3, 0, { r: 10000 });
      const c = b.v('capacitor', 3, 6, { c: 10e-6 });
      b.el('capacitor', 13, 5, { c: 10e-9 }, 1);
      b.h('resistor', 17, -2, { r: 470 });
      b.v('led', 19, 2, { color: 'green' });
      b.el('ground', 3, 10);
      b.w([3, -8], [3, -6]); b.w([3, -6], [11, -6]); b.w([9, -4], [9, -6]); b.w([11, -4], [11, -6]);
      b.w([3, -2], [7, -2]); b.w([3, 2], [7, 2]); b.w([7, 0], [6, 0], [6, 2]); b.w([3, 2], [3, 4]);
      b.w([3, 8], [19, 8]); b.w([10, 4], [10, 8]); b.w([13, 2], [13, 3]); b.w([13, 7], [13, 8]);
      b.w([13, -2], [15, -2]); b.w([19, -2], [19, 0]); b.w([19, 4], [19, 8]); b.w([3, 8], [3, 10]);
      b.volt(c, C[0]); b.node(13, -2, C[1]);
      b.doc.simSettings.speed = 0.5;
    },
  },
  {
    id: 'gates', cat: 'Digital', title: 'Logic gates truth table',
    desc: 'Toggle inputs A and B and watch every basic gate respond: NOT, AND, OR, NAND, NOR, XOR and XNOR.',
    build(b) {
      b.el('logicin', -1, -8, { on: true });
      b.el('logicin', -1, -6, { on: false });
      b.w([0, -8], [4, -8], [4, 19]);
      b.w([0, -6], [6, -6], [6, 21]);
      b.el('not', 10, -4); b.w([4, -4], [8, -4]); b.el('logicout', 15, -4); b.w([12, -4], [14, -4]);
      b.el('label', 20, -4, { text: 'NOT A', size: 12 });
      ['and', 'or', 'nand', 'nor', 'xor', 'xnor'].forEach((t, i) => {
        const y = i * 4;
        b.el(t, 10, y);
        b.w([4, y - 1], [8, y - 1]); b.w([6, y + 1], [8, y + 1]);
        b.el('logicout', 15, y); b.w([12, y], [14, y]);
        b.el('label', 20, y, { text: 'A ' + t.toUpperCase() + ' B', size: 12 });
      });
      b.el('label', -3, -8, { text: 'A', size: 13 });
      b.el('label', -3, -6, { text: 'B', size: 13 });
    },
  },
  {
    id: 'counter', cat: 'Digital', title: 'Counter & 7-segment display',
    desc: 'A 2 Hz clock drives a 4-bit binary counter; the decoder converts the count to 7-segment patterns (0–F). Toggle RESET to clear the counter.',
    build(b) {
      b.el('clock', 2, -4, { freq: 2 });
      b.el('counter', 6, 0);
      b.el('decoder7', 14, 0);
      b.el('sevenseg', 20, 0);
      b.el('logicin', 1, 3, { on: false });
      b.w([2, -4], [2, -1], [4, -1]); b.w([2, 3], [2, 1], [4, 1]);
      for (const k of [-2, -1, 0, 1]) b.w([8, k], [12, k]);
      for (const k of [-3, -2, -1, 0, 1, 2, 3]) b.w([16, k], [18, k]);
      b.el('label', 1, 5, { text: 'RESET', size: 11 });
      b.doc.simSettings.speed = 1;
    },
  },
  {
    id: 'relay', cat: 'Switches', title: 'Relay-controlled lamp',
    desc: 'Hold the push button to energise the relay coil; its contact switches the 12 V lamp. The flyback diode absorbs the coil\'s inductive kick when the button is released.',
    build(b) {
      b.v('dcv', 0, 0, { amp: 12 });
      b.h('pushno', 4, -4);
      b.el('relay', 10, 0, { vcoil: 12, rcoil: 400, lcoil: 0.05 });
      b.vr('diode', 5, 1);
      b.v('lamp', 12, -5, { v: 12, w: 5 });
      b.el('ground', 0, 8);
      b.w([0, -2], [0, -4], [2, -4]); b.w([0, -4], [0, -8], [12, -8], [12, -7]);
      b.w([6, -4], [8, -4], [8, -1]); b.w([5, -1], [8, -1]); b.w([5, 3], [8, 3], [8, 1]);
      b.w([8, 3], [8, 6]); b.w([0, 2], [0, 6], [11, 6], [11, 2]); b.w([12, -3], [12, -2]); b.w([0, 6], [0, 8]);
    },
  },
  {
    id: 'tubelight', cat: 'Electrical Wiring', title: 'Tube light (choke + starter)',
    desc: 'Classic fluorescent fitting. Switch on: the starter glows and closes, pre-heating both filaments through the choke. When the bimetal opens, the choke\'s L·di/dt kick strikes the arc, and the choke then limits the lamp current while the tube runs at ≈100 V.',
    build(b) {
      b.v('mains', 0, 0);
      b.h('oneway', 4, -6, { on: true });
      const ch = b.h('ballast', 10, -6);
      b.h('tube', 18, 0);
      b.h('starter', 18, 4);
      b.w([0, -2], [0, -6], [2, -6]); b.w([6, -6], [8, -6]);
      b.w([12, -6], [15, -6], [15, -1]);
      b.w([15, 1], [15, 4], [16, 4]); b.w([20, 4], [21, 4], [21, 1]);
      b.w([21, -1], [24, -1], [24, 8], [0, 8], [0, 2]);
      b.cur(ch, C[0]);
      b.doc.simSettings.speed = 0.2;
    },
  },
  {
    id: 'staircase', cat: 'Electrical Wiring', title: 'Staircase wiring (2-way + intermediate)',
    desc: 'One lamp controlled from three places: a two-way switch at each end of the stairs and an intermediate switch on the landing. Tap any switch to toggle the lamp.',
    build(b) {
      b.v('mains', 0, 0);
      b.h('twoway', 4, -6);
      b.h('intermediate', 10, -6);
      b.el('twoway', 16, -6, { pos: true }, 2);
      b.v('bulb', 22, 0, { w: 60 });
      b.w([0, -2], [0, -6], [2, -6]);
      b.w([6, -7], [8, -7]); b.w([6, -5], [8, -5]);
      b.w([12, -7], [14, -7]); b.w([12, -5], [14, -5]);
      b.w([18, -6], [22, -6], [22, -2]);
      b.w([22, 2], [22, 6], [0, 6], [0, 2]);
      b.el('label', 4, -9, { text: 'Downstairs', size: 11 });
      b.el('label', 10, -9, { text: 'Landing', size: 11 });
      b.el('label', 16, -9, { text: 'Upstairs', size: 11 });
      b.doc.simSettings.speed = 0.1;
    },
  },
  {
    id: 'housewiring', cat: 'Electrical Wiring', title: 'House wiring: meter, RCCB, MCBs',
    desc: 'Energy meter → RCCB (main switch + earth-leakage protection) → MCB per circuit. The lighting circuit has a switch and lamp; the socket feeds a 1 kW heater. Change the socket\'s appliance to "Faulty" to trip the RCCB, or to "Short circuit" to trip the MCB.',
    build(b) {
      b.v('mains', 0, 0);
      b.h('kwh', 4, -6);
      b.el('rccb', 12, -5);
      b.v('mcb', 18, -2, { in: 6, curve: 'B' });
      b.v('oneway', 18, 4, { on: true });
      const lamp = b.v('bulb', 18, 10, { w: 100 });
      b.v('mcb', 30, -2, { in: 16, curve: 'C' });
      const sk = b.h('socket', 32, 6, { app: 'heater' });
      b.el('earth', 32, 10);
      b.w([0, -2], [0, -6], [2, -6]); b.w([6, -6], [10, -6]);
      b.w([0, 2], [0, 4], [4, 4]); b.w([4, 4], [8, 4], [8, -4], [10, -4]); b.w([4, -4], [4, 4]);
      b.w([14, -6], [18, -6], [18, -4]); b.w([18, -6], [30, -6], [30, -4]);
      b.w([18, 0], [18, 2]); b.w([18, 6], [18, 8]); b.w([18, 12], [18, 14]);
      b.w([14, -4], [14, 14], [18, 14]); b.w([18, 14], [30, 14]);
      b.w([30, 0], [30, 5]); b.w([30, 7], [30, 14]); b.w([32, 8], [32, 10]);
      b.cur(lamp, C[0]); void sk;
      b.doc.simSettings.speed = 0.1;
    },
  },
  {
    id: 'dimmer', cat: 'Electrical Wiring', title: 'TRIAC lamp dimmer & fan regulator',
    desc: 'A TRIAC phase-control dimmer — turn its level knob and watch the RMS lamp voltage follow Vrms = V·√(1 − α/π + sin2α/2π). The top branch is a capacitor-type fan regulator — each step changes the series capacitor and so the fan speed.',
    build(b) {
      b.v('mains', 0, 0);
      b.h('dimmer', 4, -6, { level: 60 });
      b.v('bulb', 10, -2, { w: 100 });
      b.v('acvolt', 16, -2);
      b.h('fanregcap', 4, -10, { step: 3 });
      b.v('fan', 21, -6);
      b.w([0, -2], [0, -10], [2, -10]); b.w([0, -6], [2, -6]);
      b.w([6, -6], [10, -6], [10, -4]); b.w([10, -6], [16, -6], [16, -4]);
      b.w([6, -10], [21, -10], [21, -8]);
      b.w([10, 0], [10, 2], [0, 2]); b.w([16, 0], [16, 2], [10, 2]); b.w([21, -4], [21, 2], [16, 2]);
      b.doc.simSettings.speed = 0.05;
    },
  },
  {
    id: 'pfc', cat: 'Power Systems', title: 'Power-factor correction',
    desc: 'A 1 kW inductive load at PF 0.7 draws extra reactive current. Close the switch to add a 700 VAR capacitor: the PF meter rises to ≈0.96 while the real power stays the same.',
    build(b) {
      b.v('mains', 0, 0);
      b.h('pfmeter', 4, -6);
      b.v('rlload', 10, -2, { p: 1000, pf: 0.7 });
      b.v('oneway', 16, -2, { on: false });
      b.v('pfcap', 16, 4, { q: 700 });
      b.w([0, -2], [0, -6], [2, -6]); b.w([6, -6], [16, -6], [16, -4]); b.w([10, -6], [10, -4]);
      b.w([16, 0], [16, 2]);
      b.w([0, 2], [0, 8], [16, 8], [16, 6]); b.w([10, 0], [10, 8]); b.w([4, -4], [4, 8]);
      b.doc.simSettings.speed = 0.05;
    },
  },
  {
    id: 'dol', cat: 'Power Systems', title: 'DOL starter: 3-phase motor',
    desc: 'Direct-on-line starter. Press START: the contactor coil pulls in and its auxiliary contact (13–14) seals itself in, so the motor keeps running after you let go. Press STOP to break the coil circuit. Watch the ≈6× starting current settle as the motor reaches ≈1440 rpm.',
    build(b) {
      b.el('ac3y', 0, 0);
      b.el('earth', 2, 3);
      b.el('mcb3p', 7, -1, { in: 32, curve: 'D' });
      b.el('contactor', 12, 10);
      b.el('im3', 12, 17, { load: 10 }, 1);
      b.h('pushnc', 0, 9);
      b.h('pushno', 6, 9);
      b.el('earth', 9, 13);
      b.w([2, 1], [2, 3]);
      b.w([2, -2], [3, -2], [3, -3], [5, -3]); b.w([2, -1], [5, -1]); b.w([2, 0], [3, 0], [3, 1], [5, 1]);
      b.w([9, 1], [11, 1], [11, 7]); b.w([9, -1], [12, -1], [12, 7]); b.w([9, -3], [13, -3], [13, 7]);
      b.w([11, 13], [11, 15]); b.w([12, 13], [12, 15]); b.w([13, 13], [13, 15]);
      b.w([11, 5], [-2, 5], [-2, 9]); b.w([2, 9], [4, 9]); b.w([8, 9], [9, 9]); b.w([9, 11], [9, 13]);
      b.w([15, 9], [17, 9], [17, 23], [3, 23], [3, 9]);
      b.w([15, 11], [16, 11], [16, 22], [8, 22], [8, 9]);
      b.el('label', 0, 11.5, { text: 'STOP', size: 11 });
      b.el('label', 6, 11.5, { text: 'START', size: 11 });
      b.doc.simSettings.speed = 0.1;
    },
  },

  // ------------------------------------------------------------ big projects
  {
    id: 'house', cat: 'Projects', title: 'Complete house wiring: service main to earthing (2-storey house)',
    desc: 'A whole two-storey house, from the street pole to the earth pits, as one ladder diagram. ① Service main: the pole transformer (neutral earthed at the substation) feeds a 25 m overhead service drop of 2 × 16 mm² aluminium. ② Service cut-out: a 63 A HRC fuse in the phase and a solid neutral link. ③ Energy meter (kWh). ④ Double-pole main switch. ⑤ 30 mA RCCB. ⑥ Distribution board: an ammeter shows the total current, the L busbar feeds ten MCBs (B6 for lights and fans, C16 for sockets and the pump, C20 for the kitchen, geyser and air conditioner) and every circuit returns to the N bar. Ground floor: LED and CFL lights, a dusk-to-dawn verandah light, the staircase lamp on two 2-way switches (one on each floor), calling bell, two fans with regulators, TV and fridge sockets, kitchen sockets, water pump. First floor: bedroom and bathroom lights, a corridor lamp switched from three places (2-way – intermediate – 2-way), fans, study and bedroom sockets, 2 kW geyser and a 1.5-ton air conditioner. ⑦ Earthing: every 3-pin socket\'s earth pin goes over the green earth continuity conductor to the earth bar and on to two earth electrodes (pipe earthing, ≈5 Ω each). Press Run (the board switches to ✋ Operate) and tap switches to watch the total current, the kWh meter and the cables; switch on the geyser, AC, pump and microwave together to load the house. Set a socket to "Faulty appliance" and the RCCB trips through the earth path; set one to "Short circuit" and only its MCB trips. Tap ✋ Operate / Wire at the top right to edit while it runs.',
    build(b) {
      const cu = (size) => ({ type: 'housewire', size, shape: size >= 10 ? 'RM' : 'RE', inst: 'B1' });
      const L = 10, N = 50, PE = 54; // the L busbar, N bar and earth bar of the distribution board (x)
      // ---------------------------------------------------------------- ① – ⑤ incomer
      // phase on the lower line (y = −5), neutral on the upper line (y = −7)
      b.cable = cu(16);
      b.vr('mains', -30, -6, { zs: 0.05 });
      b.el('cable', -24, -6, { len: 25, size: '16', mat: 'al', temp: 40 }, 0, true);
      b.w([-30, -4], [-28, -4], [-28, -5], [-26, -5]); b.w([-30, -8], [-28, -8], [-28, -7], [-26, -7]);
      b.h('hrcfuse', -18, -5, { rating: 63 });
      b.w([-22, -5], [-20, -5]); b.w([-22, -7], [-12, -7]);
      b.cable = cu(10);
      b.el('kwh', -12, -5, {}, 0, true);
      b.w([-16, -5], [-14, -5]); b.w([-12, -7], [-8, -7]);
      b.el('dpst', -6, -6, { on: true }, 0, true);
      b.w([-10, -5], [-8, -5]);
      b.el('rccb', 0, -6, { in: 63, idn: 0.03 }, 0, true);
      b.w([-4, -5], [-2, -5]); b.w([-4, -7], [-2, -7]);
      b.h('acamp', 6, -5);
      b.w([2, -5], [4, -5]);
      // L busbar down the left (after the ammeter), N bar down the right
      b.w([8, -5], [L, -5], [L, 115]);
      b.w([2, -7], [N, -7], [N, 115]);
      // ---------------------------------------------------------------- ⑥ final circuits
      const mcb = (y, p) => { b.h('mcb', 14, y, p); b.w([L, y], [12, y]); };
      const feed = (y0, y1) => b.w([16, y0], [18, y0], [18, y1]); // MCB → the circuit's own L run
      const sw = (y, on) => b.h('oneway', 20, y, { on });
      const load = (y, type, p, from = 22) => { const e = b.h(type, 44, y, p); b.w([from, y], [42, y]); b.w([46, y], [N, y]); return e; };
      const socket = (y, app, on = true) => {
        sw(y, on);
        const e = b.el('socket', 44, y + 2, { app }, 1, true); // L (43, y), N (45, y), E (46, y + 2)
        b.w([22, y], [43, y]); b.w([45, y], [N, y]);
        b.cable = cu(1.5); b.w([46, y + 2], [PE, y + 2]); // green earth continuity conductor
        return e;
      };
      const fan = (y, step) => { sw(y, true); b.h('fanregcap', 26, y, { step }); b.w([22, y], [24, y]); return load(y, 'fan', {}, 28); };
      // Ground floor – lights (B6, 1.5 mm²)
      b.cable = cu(1.5);
      mcb(2, { in: 6, curve: 'B' }); feed(2, 25);
      sw(2, true); load(2, 'ledbulb', { w: 15 });
      sw(6, true); load(6, 'cfl', { w: 20 });
      sw(10, true); load(10, 'ledbulb', { w: 18 });
      b.el('photocell', 21, 15, { lux: 5 }); // dusk-to-dawn: it is night (5 lx)
      b.w([18, 14], [19, 14]); load(14, 'ledbulb', { w: 12 }, 23);
      b.w([19, 16], [19, 17], [N, 17]); // the photocell's own supply (N), clear of its body
      b.h('twoway', 20, 20); b.el('twoway', 26, 20, {}, 2);
      b.w([22, 19], [24, 19]); b.w([22, 21], [24, 21]);
      load(20, 'bulb', { w: 40 }, 28);
      b.h('pushno', 20, 25); load(25, 'bell');
      // Ground floor – fans (B6)
      mcb(30, { in: 6, curve: 'B' }); feed(30, 34);
      fan(30, 4); fan(34, 3);
      // Ground floor – sockets (C16, 2.5 mm²)
      b.cable = cu(2.5);
      mcb(39, { in: 16, curve: 'C' }); feed(39, 45);
      socket(39, 'tv'); b.cable = cu(2.5); socket(45, 'fridge');
      // Kitchen power (C20, 4 mm²)
      b.cable = cu(4);
      mcb(51, { in: 20, curve: 'C' }); feed(51, 57);
      socket(51, 'ricecooker'); b.cable = cu(4); socket(57, 'microwave', false);
      // Water pump (C16, 2.5 mm²)
      b.cable = cu(2.5);
      mcb(63, { in: 16, curve: 'C' }); b.w([16, 63], [18, 63]);
      socket(63, 'motor', false);
      // First floor – lights (B6)
      b.cable = cu(1.5);
      mcb(69, { in: 6, curve: 'B' }); feed(69, 82);
      sw(69, true); load(69, 'ledbulb', { w: 12 });
      sw(73, false); load(73, 'ledbulb', { w: 12 });
      sw(77, true); load(77, 'ledbulb', { w: 9 });
      // corridor lamp from three places: 2-way – intermediate – 2-way
      b.h('twoway', 20, 82); b.h('intermediate', 26, 82); b.el('twoway', 32, 82, {}, 2);
      b.w([22, 81], [24, 81]); b.w([22, 83], [24, 83]); b.w([28, 81], [30, 81]); b.w([28, 83], [30, 83]);
      load(82, 'bulb', { w: 60 }, 34);
      // First floor – fans (B6)
      mcb(88, { in: 6, curve: 'B' }); feed(88, 92);
      fan(88, 5); fan(92, 2);
      // First floor – sockets (C16, 2.5 mm²)
      b.cable = cu(2.5);
      mcb(97, { in: 16, curve: 'C' }); feed(97, 103);
      socket(97, 'computer'); b.cable = cu(2.5); socket(103, 'iron', false);
      // Geyser (C20, 4 mm²), switched off
      b.cable = cu(4);
      mcb(109, { in: 20, curve: 'C' }); b.w([16, 109], [18, 109]);
      sw(109, false); load(109, 'heater', { w: 2000 });
      // Air conditioner (C20, 4 mm²) on its own earthed socket, switched off
      mcb(114, { in: 20, curve: 'C' }); b.w([16, 114], [18, 114]);
      socket(114, 'ac', false);
      // ---------------------------------------------------------------- ⑦ earthing
      b.cable = cu(6);
      b.w([PE, 41], [PE, 122]);
      b.w([PE, 122], [48, 122], [48, 124]); b.w([PE, 122], [60, 122], [60, 124]);
      b.el('earthrod', 48, 124, { r: 5 }); b.el('earthrod', 60, 124, { r: 5 });
      b.cable = null;
      // ---------------------------------------------------------------- labels
      [[-30, -10.5, '① Service main'], [-24, -10.5, 'Service drop'], [-18, -9.5, '② Cut-out'], [-12, -10.5, '③ Energy meter'], [-6, -10.5, '④ Main switch'], [0, -10.5, '⑤ RCCB 30 mA'], [6, -9.5, 'Total']]
        .forEach(([x, y, t]) => b.label(x, y, t, 10));
      b.label(-24, -2.2, '2×16 mm² Al, 25 m', 9);
      b.label(-18, -7.9, 'N link', 9);
      b.label(-30, -1.8, 'Pole transformer', 9);
      b.label(30, -2.5, '⑥ Distribution board: L bar → MCBs → loads → N bar', 10);
      [[0, 'GROUND FLOOR · lights (B6)'], [28, 'GROUND FLOOR · fans (B6)'], [36.6, 'GROUND FLOOR · sockets (C16)'], [48.6, 'Kitchen (C20)'], [60.6, 'Water pump (C16)'],
        [66.6, 'FIRST FLOOR · lights (B6)'], [86, 'FIRST FLOOR · fans (B6)'], [94.6, 'FIRST FLOOR · sockets (C16)'], [106.6, 'Geyser (C20)'], [111.6, 'Air conditioner (C20)']]
        .forEach(([y, t]) => b.label(32, y, t, 10));
      [[2, 'Drawing room'], [6, 'Dining'], [10, 'Kitchen'], [14, 'Verandah'], [20, 'Staircase'], [25, 'Calling bell'], [30, 'Drawing fan'], [34, 'Dining fan'],
        [39, 'TV'], [45, 'Fridge'], [51, 'Rice cooker'], [57, 'Microwave'], [63, 'Pump'], [69, 'Bedroom 1'], [73, 'Bedroom 2'], [77, 'Bathroom'], [82, 'Corridor'],
        [88, 'Bed 1 fan'], [92, 'Bed 2 fan'], [97, 'Study PC'], [103, 'Iron'], [109, 'Geyser 2 kW'], [114, 'AC 1.5 ton']]
        .forEach(([y, t]) => b.label(4, y, t, 10));
      b.label(20, 22.6, 'GF', 9); b.label(26, 22.6, '1F', 9);
      b.label(PE + 4, 40, 'Earth bar', 10);
      b.label(54, 128, '⑦ Earth electrodes (2 pits, ≈5 Ω each)', 10);
      b.doc.simSettings.speed = 0.1;
    },
  },
  {
    id: 'flat', cat: 'Projects', title: 'Complete house wiring (2-room flat)',
    desc: 'A whole flat as a ladder diagram. Incomer: energy meter → double-pole main switch → 30 mA RCCB. The L bus feeds one MCB per circuit and every load returns to the N bus: lights (bedroom and drawing-room lamps, a staircase lamp on two 2-way switches, calling bell), fan with regulator, 2 kW geyser and two earthed sockets. Tap switches to watch the total current and kWh change; set a socket to "Faulty appliance" to trip the RCCB or to "Short circuit" to trip its MCB. Every wire is a real cable sized like a real installation: 10 mm² meter tails and buses, 1.5 mm² lights and fan, 4 mm² geyser, 2.5 mm² sockets (tap a wire → Cable to see or change it).',
    build(b) {
      const cu = (size) => ({ type: 'housewire', size, shape: size >= 10 ? 'RM' : 'RE', inst: 'B1' });
      // incomer — the neutral runs on the upper line, the phase on the lower one
      b.cable = cu(10);
      b.vr('mains', -4, -6);
      b.el('kwh', 0, -4, {}, 0, true);
      b.h('dpst', 6, -5, { on: true });
      b.el('rccb', 12, -5, { in: 40, idn: 0.03 }, 0, true);
      b.h('acamp', 8, 0);
      b.w([-4, -4], [-2, -4]); b.w([2, -4], [4, -4]); b.w([8, -4], [10, -4]);
      b.w([-4, -8], [3, -8], [3, -6], [4, -6]); b.w([0, -6], [0, -8]); b.w([8, -6], [10, -6]);
      // L bus down the left (through the ammeter), N bus down the right
      b.w([14, -4], [16, -4], [16, 0], [10, 0]); b.w([6, 0], [0, 0], [0, 31]);
      b.w([14, -6], [28, -6], [28, 37]);
      const mcb = (y, p) => { b.h('mcb', 4, y, p); b.w([0, y], [2, y]); };
      const load = (y, type, p) => { const e = b.h(type, 22, y, p); b.w([24, y], [28, y]); return e; };
      // circuit 1 – lighting (B6): one MCB, several points
      b.cable = cu(1.5);
      mcb(4, { in: 6, curve: 'B' }); b.w([6, 4], [8, 4], [8, 16]);
      b.h('oneway', 10, 4, { on: true }); b.w([12, 4], [20, 4]); load(4, 'bulb', { w: 100 });
      b.h('oneway', 10, 8, { on: true }); b.w([12, 8], [20, 8]); load(8, 'bulb', { w: 40 });
      b.h('twoway', 10, 12); b.el('twoway', 16, 12, {}, 2);
      b.w([12, 11], [14, 11]); b.w([12, 13], [14, 13]); b.w([18, 12], [20, 12]); load(12, 'bulb', { w: 60 });
      b.h('pushno', 10, 16); b.w([12, 16], [20, 16]); load(16, 'bell');
      // circuit 2 – fan (B6) with capacitive regulator
      mcb(21, { in: 6, curve: 'B' }); b.w([6, 21], [8, 21]);
      b.h('oneway', 10, 21, { on: true }); b.h('fanregcap', 15, 21, { step: 4 });
      b.w([12, 21], [13, 21]); b.w([17, 21], [20, 21]); load(21, 'fan');
      // circuit 3 – geyser (C20), switched off
      b.cable = cu(4);
      mcb(26, { in: 20, curve: 'C' }); b.w([6, 26], [8, 26]);
      b.h('oneway', 10, 26, { on: false }); b.w([12, 26], [20, 26]); load(26, 'heater', { w: 2000 });
      // circuit 4 – switched sockets (C16), earth pins bonded to PE
      b.cable = cu(2.5);
      mcb(31, { in: 16, curve: 'C' }); b.w([6, 31], [8, 31], [8, 37]);
      for (const [y, app] of [[31, 'iron'], [37, 'tv']]) {
        b.h('oneway', 10, y, { on: true }); b.w([12, y], [21, y]);
        b.el('socket', 22, y + 2, { app }, 1, true);
        b.w([23, y], [28, y]); b.w([24, y + 2], [25, y + 2]); b.el('earth', 25, y + 2);
      }
      b.cable = null;
      b.el('label', 6, -2.2, { text: 'Main switch', size: 10 });
      [[4, 'Bedroom'], [8, 'Drawing room'], [12, 'Staircase'], [16, 'Calling bell'], [21, 'Ceiling fan'], [26, 'Geyser'], [31, 'Kitchen socket'], [37, 'TV socket']]
        .forEach(([y, text]) => b.el('label', -4, y, { text, size: 11 }));
      b.doc.simSettings.speed = 0.1;
    },
  },
  {
    id: 'norlatch', cat: 'Digital', title: '1-bit memory cell (NOR latch)',
    desc: 'The building block of every static RAM: two NOR gates, each feeding the other. Press SET and Q goes high; press RESET and it goes low. Let go and the loop keeps the bit — that is memory. Pressing both at once gives the forbidden state (Q = Q̄ = 0).',
    build(b) {
      b.el('nor', 8, 6); b.el('nor', 8, 0); // Q̄ gate first: the cell powers up holding 0
      b.el('logicin', 1, -1, { momentary: true }); b.el('logicin', 1, 7, { momentary: true });
      b.w([2, -1], [6, -1]); b.w([2, 7], [6, 7]);
      b.w([10, 0], [11, 0], [11, 2], [5, 2], [5, 5], [6, 5]); // Q → lower gate
      b.w([10, 6], [12, 6], [12, 4], [4, 4], [4, 1], [6, 1]); // Q̄ → upper gate
      b.w([11, 0], [14, 0]); b.w([12, 6], [14, 6]);
      b.el('logicout', 15, 0); b.el('logicout', 15, 6);
      b.el('label', -2.5, -1, { text: 'RESET', size: 11 }); b.el('label', -2.5, 7, { text: 'SET', size: 11 });
      b.el('label', 18, 0, { text: 'Q', size: 13 }); b.el('label', 18, 6, { text: 'Q̄', size: 13 });
    },
  },
  {
    id: 'ram16', cat: 'Projects', title: '16-bit RAM (4 words × 4 bits)',
    desc: 'A small static RAM built like a real memory chip: 16 D-latch cells in 4 rows (words) × 4 columns (bits). To write: set DATA IN on the hex keypad, choose the address with A1 A0 and hold WRITE — the address decoder raises one word line and that row of cells copies the bit lines. To read: the multiplexer under each column picks the cell of the addressed row, so DATA OUT shows the word stored at A1 A0. Store a different digit at each of the four addresses, then step through them.',
    build(b) {
      const cols = [3, 2, 1, 0].map((bit, i) => ({ bit, x: 10 + 10 * i })); // bit 3 on the left, like a binary number
      const rows = [0, 7, 14, 21]; // word 0 … word 3
      // DATA IN: hex keypad → one bit line down the left of each column, tapped into every cell's D input
      b.el('hexin', 0, -6, { v: 10 });
      b.el('label', -4.6, -6, { text: 'DATA IN', size: 11 });
      for (const { bit, x } of cols) {
        const bl = x - 3, y0 = -7 + bit;
        b.w([2, y0], [bl, y0], [bl, rows[3] - 1], [x - 2, rows[3] - 1]);
        for (const y of rows.slice(0, 3)) b.w([bl, y - 1], [x - 2, y - 1]);
        b.el('label', x, -3.2, { text: 'bit ' + bit, size: 10 });
      }
      // the memory cells; each Q runs down the right of its column to that column's read multiplexer
      rows.forEach((y, j) => {
        for (const { x } of cols) {
          b.el('dlatch', x, y);
          b.w([x - 2, y + 1], [x - 2, y + 3]); // EN ← word line j
          b.w([x + 2, y - 1], [x + 6 - j, y - 1], [x + 6 - j, 25]); // Q → mux input I_j
        }
        b.el('label', -2.5, y, { text: 'word ' + j, size: 10 });
      });
      // address decoder (write): WRITE enables it, so only the addressed word line goes high
      b.el('dec2to4', 3, 27, {}, 3);
      rows.forEach((y, j) => b.w([2 + j, 25], [2 + j, y + 3], [cols[3].x - 2, y + 3]));
      // read multiplexers: S1 S0 = address, output = the addressed cell of this column
      for (const { bit, x } of cols) {
        b.el('mux4', x + 5, 27, {}, 1);
        b.w([x + 1, 27], [x - 1, 27], [x - 1, 34]); // S0 ← A0
        b.w([x + 1, 28], [x, 28], [x, 32]); // S1 ← A1
        b.w([x + 5, 29], [x + 5, 36 + bit], [47, 36 + bit]); // Y → DATA OUT bit
      }
      b.el('hexdisp', 49, 37);
      b.el('label', 49, 42, { text: 'DATA OUT', size: 11 });
      // address and write controls
      b.el('logicin', -4, 32); b.el('logicin', -4, 34);
      b.w([-3, 32], [cols[3].x, 32]); b.w([-3, 34], [cols[3].x - 1, 34]);
      b.w([3, 29], [3, 32]); b.w([2, 29], [2, 34]);
      b.el('label', -7, 32, { text: 'A1', size: 11 }); b.el('label', -7, 34, { text: 'A0', size: 11 });
      b.el('logicin', -4, 30, { momentary: true }); b.w([-3, 30], [4, 30], [4, 29]);
      b.el('label', -7.6, 30, { text: 'WRITE', size: 11 });
    },
  },
  {
    id: 'psu5v', cat: 'Projects', title: 'Mains to 5 V regulated power supply',
    desc: 'Every stage of a linear DC supply: 230 V mains → fuse → 230 V : 12 V transformer → bridge rectifier → 1000 µF smoothing capacitor → 7805 regulator → steady 5 V with a power LED and a 100 Ω load. The scope compares the rippling ≈15 V on the capacitor with the flat 5 V output. Lower the mains voltage or the capacitor to watch the ripple dip below 7 V and the regulator drop out.',
    build(b) {
      b.v('mains', 0, 0);
      b.h('fuse', 4, -4, { rating: 0.5 });
      b.el('txstepdown', 10, 0);
      b.v('acvolt', 14, 0);
      b.el('bridge', 20, 0);
      b.v('ecap', 25, 1, { c: 1000e-6, vmax: 25 });
      b.el('reg78', 30, -1, { vout: 5, vdo: 2 });
      b.v('ecap', 35, 1, { c: 100e-6, vmax: 16 });
      b.v('resistor', 39, 1, { r: 330 });
      b.v('led', 39, 5, { color: 'green' });
      b.v('resistor', 44, 1, { r: 100 });
      b.v('voltmeter', 49, 1);
      b.el('ground', 30, 9);
      b.w([0, -2], [0, -4], [2, -4]); b.w([6, -4], [8, -4], [8, -2]); b.w([0, 2], [0, 4], [8, 4], [8, 2]);
      b.w([12, -2], [14, -2]); b.w([14, -2], [16, -2], [16, -1], [18, -1]);
      b.w([12, 2], [14, 2]); b.w([14, 2], [16, 2], [16, 1], [18, 1]);
      b.w([22, -1], [28, -1]); b.w([32, -1], [49, -1]);
      b.w([39, 7], [39, 9]); b.w([22, 1], [22, 9], [49, 9]);
      for (const x of [25, 35, 44, 49]) b.w([x, 3], [x, 9]);
      b.w([30, 1], [30, 9]);
      [[4, -6.5, 'Fuse'], [10, -4, 'Step-down'], [20, -4, 'Rectifier'], [25, -3.5, 'Filter'], [30, -4.5, 'Regulator'], [44, -3.5, 'Load']]
        .forEach(([x, y, text]) => b.el('label', x, y, { text, size: 10 }));
      b.node(25, -1, C[0]); b.node(32, -1, C[1]);
      b.doc.simSettings.speed = 0.05;
    },
  },
  {
    id: 'traffic', cat: 'Projects', title: 'Traffic light controller (4017)',
    desc: 'A 1 Hz clock steps a CD4017 decade counter through ten states — exactly one output is high at a time. Diodes combine the outputs (diode-OR logic): Q0–Q4 light RED for 5 s, Q5–Q8 GREEN for 4 s and Q9 YELLOW for 1 s, then the cycle repeats. Rewire the diodes to make your own timing.',
    build(b) {
      b.el('clock', 2, 0, { freq: 1 });
      b.el('decade', 6, 0);
      b.w([2, 0], [4, 0]); b.w([4, 1], [4, 3]); b.el('ground', 4, 3);
      // Q0 (top) runs furthest right, so the ten output lines never cross
      for (let k = 0; k < 10; k++) {
        const x = 12 + 3 * (9 - k);
        b.w([8, k - 4], [x, k - 4], [x, 7]);
        b.v('diode', x, 9);
      }
      b.w([27, 11], [39, 11]); b.w([15, 11], [24, 11]); // red bus (Q0–Q4), green bus (Q5–Q8)
      for (const [x, color, text] of [[12, 'yellow', 'YELLOW'], [20, 'green', 'GREEN'], [32, 'red', 'RED']]) {
        b.w([x, 11], [x, 14]);
        b.v('led', x, 16, { color });
        b.v('resistor', x, 20, { r: 220 });
        b.el('ground', x, 22);
        b.el('label', x, 24.6, { text, size: 11 });
      }
      b.doc.simSettings.speed = 1;
      b.doc.simSettings.maxStep = 5e-4; // a 1 Hz clock needs no finer step; keeps slow phones real-time
    },
  },
  {
    id: 'adder', cat: 'Projects', title: '4-bit binary adder (calculator)',
    desc: 'Adds two 4-bit numbers, like the ALU inside a CPU. Tap keypad A and keypad B to pick 0–F; the 74HC283 adder shows the sum on the hex display. A sum above 15 does not fit in 4 bits, so CARRY lights — it is worth 16 (A = 9, B = 8 → display 1 + CARRY = 17). Cin adds one more, which is how adders are chained into 8, 16 or 64 bits.',
    build(b) {
      b.el('adder4', 10, 0);
      b.el('hexin', 1, -3, { v: 9 });
      b.el('hexin', 1, 6, { v: 5 });
      for (let k = 0; k < 4; k++) {
        b.w([3, k - 4], [8, k - 4]); // A
        b.w([3, 5 + k], [4 + k, 5 + k], [4 + k, k], [8, k]); // B
        b.w([12, k - 2], [16, k - 2]); // sum
      }
      b.el('logicin', 5, 11); b.w([6, 11], [8, 11], [8, 4]);
      b.el('hexdisp', 18, -1);
      b.w([12, 2], [13, 2], [13, 4], [21, 4]); b.el('logicout', 22, 4);
      b.el('label', -2.5, -3, { text: 'A', size: 14 }); b.el('label', -2.5, 6, { text: 'B', size: 14 });
      b.el('label', 2, 11, { text: 'Cin', size: 11 }); b.el('label', 18, -5, { text: 'A + B', size: 11 });
      b.el('label', 25.5, 4, { text: 'CARRY', size: 11 });
    },
  },
  {
    id: 'clock60', cat: 'Projects', title: 'Digital seconds counter 00–59',
    desc: 'The heart of every digital clock. A 1 Hz clock drives the units BCD counter; each time it wraps 9 → 0 its carry clocks the tens counter. An AND gate watches the tens counter: the moment it reaches 6 (Q1 = Q2 = 1) it resets it, so the display goes 58, 59, 00. Each digit passes through a BCD → 7-segment decoder. Turn the clock up to 10 Hz to see the roll-over sooner.',
    build(b) {
      // tens digit (top row) – reset to 0 when it reaches 6
      b.el('bcdcounter', 6, 0); b.el('decoder7', 14, 0); b.el('sevenseg', 22, 0);
      for (let k = 0; k < 4; k++) b.w([8, k - 2], [12, k - 2]);
      for (let i = 0; i < 7; i++) b.w([16, i - 3], [20, i - 3]);
      b.el('and', 12, 5);
      b.w([10, 0], [10, 4]); b.w([9, -1], [9, 6], [10, 6]); // Q2, Q1 → AND
      b.w([14, 5], [15, 5], [15, 7], [3, 7], [3, 1], [4, 1]); // AND → RST
      // units digit (bottom row); its decoder feeds the right-hand display
      b.el('bcdcounter', 6, 12); b.el('decoder7', 14, 12); b.el('sevenseg', 36, 0);
      for (let k = 0; k < 4; k++) b.w([8, k + 10], [12, k + 10]);
      for (let i = 0; i < 7; i++) b.w([16, 9 + i], [25 + i, 9 + i], [25 + i, i - 3], [34, i - 3]);
      b.el('clock', 0, 11, { freq: 1 }); b.w([0, 11], [4, 11]);
      b.w([4, 13], [4, 15]); b.el('ground', 4, 15);
      b.w([8, 14], [9, 14], [9, 17], [2, 17], [2, -1], [4, -1]); // units CO → tens CLK
      b.el('label', 22, -5, { text: 'tens', size: 11 }); b.el('label', 36, -5, { text: 'units', size: 11 });
      b.el('label', 18.5, 5.6, { text: '= 6 → reset', size: 10 });
      b.doc.simSettings.speed = 1;
      b.doc.simSettings.maxStep = 5e-4; // a 1 Hz clock needs no finer step; keeps slow phones real-time
    },
  },
  {
    id: 'streetlight', cat: 'Projects', title: 'Automatic street light (LDR + relay)',
    desc: 'A low-voltage sensor switching a mains lamp. In daylight the LDR has a low resistance and holds the transistor\'s base low. At dusk (below ≈30 lux) the divider voltage rises, the BC547 turns on and energises the 12 V relay, whose contact switches the 230 V lamp. The diode absorbs the coil\'s kick at switch-off, and because the relay drops out at a lower current than it pulls in, the lamp only turns off again above ≈60 lux — no chattering at dusk. Select the LDR and turn the light level down.',
    build(b) {
      b.el('rail', 2, -12, { amp: 12 });
      b.v('resistor', 2, -6, { r: 47000 });
      b.v('ldr', 2, 2, { lux: 1000 });
      b.h('resistor', 8, -2, { r: 10000 });
      b.el('npn', 12, -2, { model: 'BC547' });
      b.el('relay', 16, -8, { vcoil: 12, rcoil: 400 });
      b.vr('diode', 10, -8);
      b.el('ground', 8, 6);
      b.w([2, -12], [13, -12], [13, -9], [14, -9]); b.w([2, -12], [2, -8]);
      b.w([2, -4], [2, 0]); b.w([2, -2], [6, -2]);
      b.w([13, -4], [13, -7], [14, -7]); b.w([10, -10], [10, -12]); b.w([10, -6], [13, -6]);
      b.w([13, 0], [13, 6]); b.w([2, 4], [2, 6], [13, 6]);
      // 230 V side: L → relay COM, NO → lamp → N
      b.vr('mains', 28, -6);
      b.h('bulb', 24, -14, { w: 100 });
      b.w([17, -6], [17, -2], [28, -2], [28, -4]);
      b.w([18, -10], [18, -14], [22, -14]); b.w([26, -14], [28, -14], [28, -8]);
      b.el('label', 8, -14.6, { text: '12 V control', size: 10 });
      b.el('label', 32.5, -11, { text: '230 V lamp', size: 10 });
      b.doc.simSettings.speed = 0.1;
    },
  },
];

export const EXAMPLES = [...BASE, ...EXAMPLES2, ...EXAMPLES3, ...EXAMPLES4];

// unused outputs that are legitimately left open (relay NC contacts, the RAM cells' Q̄, the tens carry)
export const EXAMPLE_ALLOW_OPEN = { relay: 1, ram16: 16, clock60: 1, streetlight: 1, ...ALLOW_OPEN2, ...ALLOW_OPEN3, ...ALLOW_OPEN4 };

export function buildExample(ex) {
  const b = builder(ex.title);
  ex.build(b);
  b.doc.description = ex.desc;
  b.doc.assignNames();
  return b.doc;
}

export function exampleCategories() {
  const cats = [];
  for (const e of EXAMPLES) if (!cats.includes(e.cat)) cats.push(e.cat);
  // the big build-along projects come first, right after "All"
  return cats.includes('Projects') ? ['Projects', ...cats.filter((c) => c !== 'Projects')] : cats;
}
