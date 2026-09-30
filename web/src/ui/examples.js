// Built-in example circuits. Coordinates are in grid units (1 = 20 px).

import { CircuitDoc, makeElement } from './doc.js';
import { GRID } from '../elements/index.js';

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
    w(...pts) { doc.addWire(pts.map(([x, y]) => [x * G, y * G])); },
    node(x, y, color) { doc.probes.push({ id: 'e' + pid++, kind: 'node', pos: [x * G, y * G], color, label: '', unit: 'V' }); },
    volt(e, color) { doc.probes.push({ id: 'e' + pid++, kind: 'volt', el: e.id, color, label: '', unit: 'V' }); },
    cur(e, color) { doc.probes.push({ id: 'e' + pid++, kind: 'cur', el: e.id, color, label: '', unit: 'A' }); },
  };
  return b;
}

const C = ['#facc15', '#22d3ee', '#f472b6', '#4ade80'];

export const EXAMPLES = [
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
      b.h('diode', 4, -4, { model: '1N4007', is: 7e-9, n: 1.9, bv: 1000 });
      b.v('ecap', 8, 0, { c: 470e-6 });
      b.v('resistor', 12, 0, { r: 1000 });
      b.el('ground', 0, 6);
      b.w([0, -2], [0, -4], [2, -4]); b.w([6, -4], [8, -4], [8, -2]); b.w([8, -4], [12, -4], [12, -2]);
      b.w([12, 2], [12, 4], [0, 4]); b.w([8, 2], [8, 4]); b.w([0, 2], [0, 4]); b.w([0, 4], [0, 6]);
      b.node(0, -4, C[0]); b.node(12, -4, C[1]);
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
      const rl = b.v('resistor', 20, 0, { r: 220 });
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
      b.vr('diode', 14, -4, { model: '1N5819', is: 3e-6, n: 1.1, bv: 40 });
      b.el('nmos', 9, 2, { model: 'IRLZ44N', vt: 1.6, kp: 25, lambda: 0.005, cgs: 1.6e-9, cgd: 2e-10, bodyDiode: true });
      b.v('pulse', 0, 4, { amp: 5, freq: 1000, duty: 60 });
      b.h('resistor', 4, 2, { r: 100 });
      b.el('ground', 10, 6);
      b.w([10, -10], [10, -6]); b.w([10, -6], [14, -6]); b.w([14, -2], [10, -2]); b.w([10, -2], [10, 0]);
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
      const r = b.v('resistor', 8, 0, { r: 7 });
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
      b.el('rail', 4, -8, { amp: 9 });
      b.el('timer555', 10, 0);
      b.v('resistor', 4, -4, { r: 1000 });
      b.v('resistor', 4, 0, { r: 10000 });
      const c = b.v('capacitor', 4, 6, { c: 10e-6 });
      b.el('capacitor', 13, 5, { c: 10e-9 }, 1);
      b.h('resistor', 17, -2, { r: 470 });
      b.v('led', 19, 2, { color: 'green' });
      b.el('ground', 4, 10);
      b.w([4, -8], [4, -6]); b.w([4, -6], [11, -6]); b.w([9, -4], [9, -6]); b.w([11, -4], [11, -6]);
      b.w([4, -2], [7, -2]); b.w([4, 2], [7, 2]); b.w([7, 0], [6, 0], [6, 2]); b.w([4, 2], [4, 4]);
      b.w([4, 8], [19, 8]); b.w([10, 4], [10, 8]); b.w([13, 2], [13, 3]); b.w([13, 7], [13, 8]);
      b.w([13, -2], [15, -2]); b.w([19, -2], [19, 0]); b.w([19, 4], [19, 8]); b.w([4, 8], [4, 10]);
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
];

export const EXAMPLE_ALLOW_OPEN = { relay: 1 };

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
  return cats;
}
