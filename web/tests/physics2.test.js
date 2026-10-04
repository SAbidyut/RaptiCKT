// Physical checks for the second wave of component models.
import test from 'node:test';
import assert from 'node:assert/strict';
import { getType } from '../src/elements/index.js';

import { net, run } from './netlib.js';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

test('diode reverse recovery: standard diode recovers far slower than ultra-fast', () => {
  const peak = (model) => {
    // square wave ±10 V, 10 kHz, through 10 Ω: forward ≈ 1 A, then reverse
    const { sim, els } = net([['square', [1, 0], { amp: 10, freq: 10000, offset: 0 }], ['resistor', [1, 2], { r: 10 }], ['diodeq', [2, 0], { model }]]);
    Object.assign(els[2].p, getType('diodeq').props.find((p) => p.key === 'model').preset[model]);
    els[2].onParamChange();
    assert.ok(sim.start(), sim.error);
    let minI = 0, revCharge = 0;
    run(sim, 3e-4, 2e-8, () => { const i = els[2].i; if (sim.t > 1e-4) { minI = Math.min(minI, i); if (i < -0.05) revCharge += -i * 2e-8; } });
    return { minI, revCharge };
  };
  const std = peak('1N4007'), uf = peak('UF4007'), sig = peak('1N4148');
  assert.ok(std.minI < -0.5, 'standard diode should pass a large reverse-recovery current, got ' + std.minI);
  assert.ok(std.revCharge > 5 * uf.revCharge, `recovery charge std ${std.revCharge} vs UF ${uf.revCharge}`);
  assert.ok(uf.revCharge > sig.revCharge * 0.5, 'UF4007 recovers slower than 1N4148');
});

test('SiC Schottky has no recovery charge and ≈1.5 V at 10 A', () => {
  const { sim, els } = net([['dci', [0, 1], { amp: 10 }], ['sicdiode', [1, 0]]]);
  assert.ok(sim.start(), sim.error);
  const v = sim.v(1);
  assert.ok(v > 1.2 && v < 1.9, 'SiC Vf at 10 A ' + v);
});

test('Kelvin shunt: sense terminals read I·R exactly despite lead resistance', () => {
  // 10 A through a 10 mΩ shunt with 20 mΩ of lead/contact resistance on each force lead
  const { sim, els } = net([['dci', [0, 1], { amp: 10 }], ['shuntr', [1, 0, 2, 3], { r: 0.01, rlead: 0.02 }], ['resistor', [2, 0], { r: 1e6 }], ['resistor', [3, 0], { r: 1e6 }]]);
  assert.ok(sim.start(), sim.error);
  near(sim.v(2) - sim.v(3), 0.1, 1e-4, 'sense voltage');
  near(sim.v(1), 10 * 0.05, 1e-3, 'force voltage includes leads');
});

test('fusible resistor opens on a sustained overload', () => {
  const { sim, els } = net([['dcv', [1, 0], { amp: 12 }], ['fusibler', [1, 0], { r: 10, pmax: 0.5, kfuse: 10, tau: 0.05 }]]);
  assert.ok(sim.start());
  run(sim, 0.3, 1e-4);
  assert.ok(els[1].blown, 'blown at 14.4 W (29× rating)');
  assert.ok(Math.abs(els[1].i) < 1e-6, 'open after blowing');
});

test('SIDAC breaks over near 120 V and then holds ≈1 V', () => {
  const { sim, els } = net([['dcv', [1, 0], { amp: 150 }], ['resistor', [1, 2], { r: 100 }], ['sidac', [2, 0]]]);
  assert.ok(sim.start());
  run(sim, 1e-3, 1e-6);
  assert.ok(els[2].on, 'conducting');
  assert.ok(sim.v(2) < 3, 'on-state voltage ' + sim.v(2));
});

test('SCS turns on from the anode gate and off from the cathode gate', () => {
  // A=1, K=0, GK=3, GA=4. Anode 12 V through 100 Ω.
  const { sim, els } = net([['dcv', [1, 0], { amp: 12 }], ['resistor', [1, 2], { r: 100 }], ['scs', [2, 0, 3, 4]], ['resistor', [3, 0], { r: 1e5 }], ['resistor', [4, 5], { r: 1000 }], ['dcv', [5, 0], { amp: 12 }]]);
  assert.ok(sim.start());
  run(sim, 1e-3, 1e-5);
  assert.ok(!els[2].on, 'off while GA is held at the anode level');
  els[5].p.amp = 0; sim.discontinuity(); // pull the anode gate low: current flows out of GA
  run(sim, 1e-3, 1e-5);
  assert.ok(els[2].on, 'triggered by anode-gate current');
  els[5].p.amp = 12; sim.discontinuity();
  run(sim, 5e-4, 1e-5);
  assert.ok(els[2].on, 'stays latched');
});

test('LASCR fires on light alone', () => {
  const { sim, els } = net([['dcv', [1, 0], { amp: 24 }], ['resistor', [1, 2], { r: 100 }], ['lascr', [2, 0, 3], { light: 0 }], ['resistor', [3, 0], { r: 1e4 }]]);
  assert.ok(sim.start());
  run(sim, 1e-3, 1e-5);
  assert.ok(!els[2].on, 'dark: blocking');
  els[2].p.light = 100;
  run(sim, 1e-3, 1e-5);
  assert.ok(els[2].on, 'lit: latched on');
  els[2].p.light = 0;
  run(sim, 1e-3, 1e-5);
  assert.ok(els[2].on, 'stays on after the light goes');
});

test('IPM: interlock, switching and over-current latch-off', () => {
  // HIN=1, LIN=2, FO=3 (pulled up), P=4, AC=5, N=0. 48 V bus, 10 Ω load AC→N.
  const parts = [['dcv', [1, 0], { amp: 5 }], ['dcv', [2, 0], { amp: 0 }], ['resistor', [3, 6], { r: 10000 }], ['dcv', [6, 0], { amp: 5 }],
    ['dcv', [4, 0], { amp: 48 }], ['ipm', [1, 2, 3, 4, 5, 0], { ioc: 10 }], ['resistor', [5, 0], { r: 10 }]];
  const { sim, els } = net(parts);
  assert.ok(sim.start());
  run(sim, 1e-4, 1e-6);
  near(sim.v(5), 48 * 10 / 10.05, 0.3, 'upper switch on drives AC to the bus');
  els[1].p.amp = 5; sim.discontinuity(); // both inputs high → interlock
  run(sim, 1e-4, 1e-6);
  assert.ok(!els[5].hi && !els[5].lo, 'shoot-through interlock: both off');
  els[1].p.amp = 0; els[6].p.r = 1; sim.dirty = true; sim.discontinuity(); // 48 A short → trip
  run(sim, 1e-4, 1e-6);
  assert.ok(els[5].fault, 'over-current fault latched');
  assert.ok(sim.v(3) < 1, 'FO pulled low');
});

test('GaN HEMT on-resistance is a few milliohm', () => {
  const { sim, els } = net([['dcv', [1, 0], { amp: 5 }], ['dci', [0, 2], { amp: 10 }], ['hemt', [1, 2, 0]]]);
  assert.ok(sim.start(), sim.error);
  const r = sim.v(2) / 10;
  assert.ok(r > 0.002 && r < 0.02, 'Rds(on) ' + r);
});

test('PIN diode RF resistance falls with bias current', () => {
  const rAt = (ibias) => {
    const { sim, els } = net([['dci', [0, 1], { amp: ibias }], ['pindiode', [1, 0]]]);
    assert.ok(sim.start());
    run(sim, 2e-5, 1e-7);
    return els[1].rI;
  };
  const r0 = rAt(1e-6), r1 = rAt(1e-3), r10 = rAt(1e-2);
  assert.ok(r0 > 1000, 'near zero bias ' + r0);
  near(r1, 10, 1.5, 'at 1 mA');
  assert.ok(r10 < 2, 'at 10 mA ' + r10);
});

test('Gunn diode has negative differential resistance above threshold', () => {
  const G = new (getType('gunn'))(0, 0);
  const a = G.iv(2).i, b = G.iv(3.4).i, c = G.iv(6).i;
  assert.ok(b > a && c < b, `I(2)=${a} I(3.4)=${b} I(6)=${c}`);
  assert.ok(G.iv(6).g < 0, 'dI/dV < 0');
});

// ------------------------------------------------------------ analog blocks
test('voltage follower, difference amp and TIA give their ideal outputs', () => {
  let r = net([['dcv', [1, 0], { amp: 2.5 }], ['follower', [1, 2]], ['resistor', [2, 0], { r: 100 }]]);
  assert.ok(r.sim.start()); near(r.sim.v(2), 2.5, 1e-3, 'follower');
  r = net([['dcv', [1, 0], { amp: 1.0 }], ['dcv', [2, 0], { amp: 1.3 }], ['dcv', [3, 0], { amp: 0.5 }], ['diffamp', [1, 2, 4, 3], { gain: 10 }], ['resistor', [4, 0], { r: 1e4 }]]);
  assert.ok(r.sim.start()); near(r.sim.v(4), 10 * 0.3 + 0.5, 0.01, 'difference amp');
  r = net([['dci', [0, 1], { amp: 10e-6 }], ['tia', [1, 2], { rf: 100000 }], ['resistor', [2, 0], { r: 1e4 }]]);
  assert.ok(r.sim.start()); near(r.sim.v(2), -1.0, 0.01, 'TIA −Iin·Rf');
  near(r.sim.v(1), 0, 1e-3, 'virtual ground');
});

test('power amp clips at the rails; current amp multiplies within compliance', () => {
  let r = net([['dcv', [1, 0], { amp: 1 }], ['poweramp', [1, 2]], ['resistor', [2, 0], { r: 8 }]]);
  assert.ok(r.sim.start()); near(r.sim.v(2), 16 - 1.8, 0.3, 'clipped near +rail');
  r = net([['dcv', [1, 0], { amp: 0.05 }], ['dcv', [2, 0], { amp: 0.0 }], ['resistor', [1, 3], { r: 1000 }], ['curramp', [3, 2, 4], { gain: 10 }], ['resistor', [4, 0], { r: 100 }]]);
  assert.ok(r.sim.start()); near(r.sim.v(4), 10 * 50e-6 * 100, 2e-3, 'current gain ×10 into 100 Ω');
});

test('LM337 gives −1.25·(1 + R2/R1)', () => {
  // IN=1 (−15 V), OUT=2, ADJ=3; R1 = 240 Ω OUT→ADJ, R2 = 1.2 kΩ ADJ→GND
  const r = net([['dcv', [1, 0], { amp: -15 }], ['lm337', [1, 2, 3]], ['resistor', [2, 3], { r: 240 }], ['resistor', [3, 0], { r: 1200 }], ['resistor', [2, 0], { r: 1000 }]]);
  assert.ok(r.sim.start(), r.sim.error); near(r.sim.v(2), -1.25 * (1 + 1200 / 240), 0.08, 'LM337 output');
});

test('open-collector comparator needs and uses a pull-up', () => {
  const r = net([['dcv', [1, 0], { amp: 2 }], ['dcv', [2, 0], { amp: 3 }], ['comparatoroc', [1, 2, 3]], ['resistor', [3, 4], { r: 4700 }], ['dcv', [4, 0], { amp: 5 }]]);
  assert.ok(r.sim.start()); near(r.sim.v(3), 5, 0.01, 'V+ > V−: off, pulled up');
  r.els[1].p.amp = 1; r.sim.discontinuity(); run(r.sim, 1e-4, 1e-6);
  assert.ok(r.sim.v(3) < 0.1, 'V+ < V−: sinks to ground ' + r.sim.v(3));
});

test('CD4046 PLL locks its VCO to the input frequency', () => {
  // SIG = 2 kHz square; loop: VCO → COMP, PC2 → 10 kΩ / 1 µF + 1 kΩ zero → VCOIN
  const r = net([['square', [1, 0], { amp: 2.5, offset: 2.5, freq: 2000 }], ['pll4046', [1, 5, 3, 0, 2, 5]], ['resistor', [2, 4], { r: 10000 }], ['resistor', [4, 3], { r: 1000 }], ['capacitor', [3, 0], { c: 1e-6 }], ['resistor', [5, 0], { r: 1e5 }]]);
  // the 4th pin (PC1) goes to ground through the node 0 entry: give it its own node instead
  assert.ok(r.sim.start());
  run(r.sim, 0.25, 2e-6);
  near(r.els[1].f, 2000, 60, 'VCO frequency after lock');
});

// ------------------------------------------------------------ digital parts
function logic(type, nIn, nOut, props = {}) {
  const parts = [];
  for (let k = 0; k < nIn; k++) parts.push(['dcv', [k + 1, 0], { amp: 0 }]);
  const pins = [...Array.from({ length: nIn }, (_, k) => k + 1), ...Array.from({ length: nOut }, (_, k) => nIn + 1 + k)];
  parts.push([type, pins, props]);
  for (let k = 0; k < nOut; k++) parts.push(['resistor', [nIn + 1 + k, 0], { r: 1e5 }]);
  const r = net(parts);
  const set = (vals) => { vals.forEach((v, k) => { r.els[k].p.amp = v ? 5 : 0; }); r.sim.discontinuity(); run(r.sim, 2e-5, 1e-6); };
  const out = () => Array.from({ length: nOut }, (_, k) => r.sim.v(nIn + 1 + k) > 2.5 ? 1 : 0);
  assert.ok(r.sim.start());
  return { set, out, el: r.els[nIn], sim: r.sim };
}

test('subtractor, demux and 8-to-3 encoder truth', () => {
  const s = logic('sub4', 9, 5);
  s.set([1, 0, 1, 0, 1, 1, 0, 0, 0]); // A = 5, B = 3 → 2
  assert.deepEqual(s.out(), [0, 1, 0, 0, 0]);
  s.set([1, 1, 0, 0, 0, 0, 1, 0, 0]); // 3 − 4 = −1 → 1111, borrow
  assert.deepEqual(s.out(), [1, 1, 1, 1, 1]);
  const d = logic('demux4', 3, 4);
  d.set([1, 0, 1]); assert.deepEqual(d.out(), [0, 0, 1, 0]);
  const e = logic('enc8to3', 8, 4);
  e.set([1, 0, 0, 1, 0, 1, 0, 0]); assert.deepEqual(e.out(), [1, 0, 1, 1]); // highest = I5
});

test('74HC194 universal shift register: load, shift right, shift left', () => {
  // D0..D3, DSR, DSL, S0, S1, CLK, CLR
  const u = logic('univ194', 10, 4);
  const v = [1, 0, 0, 1, 0, 1, 1, 1, 0, 0]; // load 1001
  u.set(v); v[8] = 1; u.set(v); v[8] = 0; u.set(v);
  assert.deepEqual(u.out(), [1, 0, 0, 1]);
  v[6] = 1; v[7] = 0; v[4] = 1; // shift right with DSR = 1 → 1 1 0 0
  v[8] = 1; u.set(v); v[8] = 0; u.set(v);
  assert.deepEqual(u.out(), [1, 1, 0, 0]);
  v[6] = 0; v[7] = 1; v[5] = 1; // shift left with DSL = 1 → 1 0 0 1
  v[8] = 1; u.set(v); v[8] = 0; u.set(v);
  assert.deepEqual(u.out(), [1, 0, 0, 1]);
});

test('74HC165 PISO shifts D7 out first; Johnson counter has 8 states', () => {
  const p = logic('piso8', 11, 1);
  const v = [1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0]; // D = 1000 0101 (D0..D7 = 1,0,1,0,0,0,0,1), load
  p.set(v); v[9] = 1; p.set(v);
  const seen = [];
  for (let k = 0; k < 8; k++) { seen.push(p.out()[0]); v[10] = 1; p.set(v); v[10] = 0; p.set(v); }
  assert.deepEqual(seen, [1, 0, 0, 0, 0, 1, 0, 1]);
  const j = logic('johnson4', 2, 4);
  const states = new Set();
  for (let k = 0; k < 10; k++) { states.add(j.out().join('')); j.set([1, 0]); j.set([0, 0]); }
  assert.equal(states.size, 8);
});

test('RAM stores per address; ROM decodes hex to 7-segment', () => {
  const m = logic('ram16x4', 9, 4);
  m.set([1, 0, 0, 0, 1, 0, 1, 0, 1]); m.set([1, 0, 0, 0, 1, 0, 1, 0, 0]); // write 5 at address 1
  m.set([0, 1, 0, 0, 1, 1, 1, 1, 1]); m.set([0, 1, 0, 0, 0, 0, 0, 0, 0]); // write 15 at address 2
  m.set([1, 0, 0, 0, 0, 0, 0, 0, 0]); assert.deepEqual(m.out(), [1, 0, 1, 0]);
  m.set([0, 1, 0, 0, 0, 0, 0, 0, 0]); assert.deepEqual(m.out(), [1, 1, 1, 1]);
  const r = logic('rom16x8', 5, 8);
  r.set([1, 0, 0, 0, 1]); assert.deepEqual(r.out(), [0, 1, 1, 0, 0, 0, 0, 0]); // address 1: "1" = segments b, c
  r.set([0, 1, 0, 0, 1]); assert.deepEqual(r.out(), [1, 1, 0, 1, 1, 0, 1, 0]); // address 2: "2" = 0x5B
  r.set([1, 0, 0, 0, 0]); assert.deepEqual(r.out(), [0, 0, 0, 0, 0, 0, 0, 0]); // CE low
});

test('8-bit ADC → DAC round trip and the programmable timer', () => {
  const r = net([['dcv', [1, 0], { amp: 3.21 }], ['dcv', [2, 0], { amp: 5 }], ['adc8', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ['dac8', [3, 4, 5, 6, 7, 8, 9, 10, 11], { rout: 1 }], ['resistor', [11, 0], { r: 1e6 }]]);
  assert.ok(r.sim.start()); run(r.sim, 1e-4, 1e-6);
  near(r.sim.v(11), 3.21, 5 / 256, 'reconstructed voltage within 1 LSB');
  const t = logic('dtimer', 3, 2, { n: 3 });
  t.set([0, 1, 0]); assert.deepEqual(t.out(), [1, 0], 'counting');
  for (let k = 0; k < 3; k++) { t.set([1, 1, 0]); t.set([0, 1, 0]); }
  assert.deepEqual(t.out(), [0, 1], 'done after N clocks');
});
