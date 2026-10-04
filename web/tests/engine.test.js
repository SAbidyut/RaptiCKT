// Engine verification against analytic circuit theory.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulator } from '../src/engine/sim.js';
import { getType } from '../src/elements/index.js';

function mk(type, nodes, props = {}) {
  const C = getType(type);
  assert.ok(C, 'unknown type ' + type);
  const e = new C(0, 0);
  Object.assign(e.p, props);
  e.onParamChange();
  e.nodes = nodes;
  e.name = type;
  return e;
}
function sim(els, opt) { return new Simulator(opt).buildNet(els); }
const close = (a, b, rel, msg) => assert.ok(Math.abs(a - b) <= rel * Math.max(Math.abs(b), 1e-15), `${msg}: got ${a}, expected ${b}`);

test('voltage divider', () => {
  const s = sim([mk('dcv', [1, 0], { amp: 12 }), mk('resistor', [1, 2], { r: 1000 }), mk('resistor', [2, 0], { r: 2000 })]);
  assert.ok(s.start());
  close(s.v(2), 8, 1e-9, 'Vout');
});

test('RC charging reaches 63.2 % at t = τ', () => {
  const s = sim([mk('dcv', [1, 0], { amp: 10 }), mk('resistor', [1, 2], { r: 1000 }), mk('capacitor', [2, 0], { c: 1e-6 })], { initialDC: false });
  s.start();
  for (let i = 0; i < 1000; i++) s.step(1e-6);
  close(s.v(2), 10 * (1 - Math.exp(-1)), 2e-3, 'Vc(τ)');
});

test('RL current rise', () => {
  const L = mk('inductor', [2, 0], { l: 0.1 });
  const s = sim([mk('dcv', [1, 0], { amp: 10 }), mk('resistor', [1, 2], { r: 100 }), L], { initialDC: false });
  s.start();
  for (let i = 0; i < 1000; i++) s.step(1e-6); // τ = 1 ms
  close(L.i, 0.1 * (1 - Math.exp(-1)), 2e-3, 'iL(τ)');
});

test('LC tank oscillates at 1/(2π√LC)', () => {
  const C = mk('capacitor', [1, 0], { c: 1e-6, ic: 1 });
  const s = sim([mk('inductor', [1, 0], { l: 1e-3 }), C], { initialDC: false, method: 'trap' });
  s.start();
  const f0 = 1 / (2 * Math.PI * Math.sqrt(1e-3 * 1e-6));
  const dt = 1 / f0 / 400;
  let last = s.v(1), crossings = [];
  for (let i = 0; i < 400 * 10; i++) {
    s.step(dt);
    const v = s.v(1);
    if (last < 0 && v >= 0) crossings.push(s.t - dt * (v / (v - last)));
    last = v;
  }
  const per = (crossings.at(-1) - crossings[0]) / (crossings.length - 1);
  close(1 / per, f0, 2e-3, 'f0');
});

test('diode forward drop satisfies Shockley equation', () => {
  const D = mk('diode', [2, 0]);
  const s = sim([mk('dcv', [1, 0], { amp: 5 }), mk('resistor', [1, 2], { r: 470 }), D]);
  assert.ok(s.start());
  const vd = s.v(2);
  const Id = D.p.is * (Math.exp(vd / (D.p.n * 0.025852)) - 1);
  close(Id, (5 - vd) / 470, 1e-3, 'KCL at diode');
  assert.ok(vd > 0.6 && vd < 0.8, 'vd ' + vd);
});

test('zener regulator holds ~Vz', () => {
  const s = sim([mk('dcv', [1, 0], { amp: 12 }), mk('resistor', [1, 2], { r: 1000 }), mk('zener', [0, 2], { bv: 5.1 })]);
  assert.ok(s.start());
  assert.ok(Math.abs(s.v(2) - 5.1) < 0.25, 'Vz ' + s.v(2));
});

test('LED current with series resistor', () => {
  const led = mk('led', [2, 0], { color: 'red' });
  const s = sim([mk('dcv', [1, 0], { amp: 5 }), mk('resistor', [1, 2], { r: 150 }), led]);
  assert.ok(s.start());
  assert.ok(Math.abs(led.i - 0.02) < 0.003, 'I_led ' + led.i + ' V ' + s.v(2));
});

test('NPN common-emitter bias: Ic = β·Ib consistent with Ebers–Moll', () => {
  const q = mk('npn', [2, 3, 0], { model: 'custom', bf: 100, va: 0, cje: 0, cjc: 0, br: 1, is: 1e-14 });
  const s = sim([mk('dcv', [1, 0], { amp: 10 }), mk('resistor', [1, 2], { r: 430e3 }), mk('resistor', [1, 3], { r: 2000 }), q]);
  assert.ok(s.start());
  const ib = q.postCurrents[0], ic = q.postCurrents[1];
  close(ic / ib, 100, 0.02, 'β');
  close(ib, (10 - s.v(2)) / 430e3, 1e-6, 'Ib');
  assert.equal(q.region(), 'Active');
});

test('NMOS square law in saturation', () => {
  const m = mk('nmos', [1, 2, 0], { model: 'custom', vt: 2, kp: 0.01, lambda: 0, cgs: 0, cgd: 0, bodyDiode: false });
  const s = sim([mk('dcv', [1, 0], { amp: 4 }), mk('dcv', [3, 0], { amp: 12 }), mk('resistor', [3, 2], { r: 100 }), m]);
  assert.ok(s.start());
  close(m.postCurrents[1], 0.5 * 0.01 * 4, 1e-6, 'Id');
});

test('ideal op-amp inverting amplifier gain = −Rf/Rin', () => {
  const s = sim([mk('dcv', [1, 0], { amp: 0.5 }), mk('resistor', [1, 2], { r: 1000 }), mk('resistor', [2, 3], { r: 10000 }), mk('opamp', [2, 0, 3])]);
  assert.ok(s.start());
  close(s.v(3), -5, 1e-4, 'Vout');
});

test('op-amp saturates at the rails', () => {
  const s = sim([mk('dcv', [1, 0], { amp: 3 }), mk('opamp', [0, 1, 2], { vpos: 12, vneg: -12 }), mk('resistor', [2, 0], { r: 1e4 })]);
  assert.ok(s.start());
  assert.ok(Math.abs(s.v(2) - 12) < 0.05, 'Vsat ' + s.v(2));
});

test('AC analysis: RC low-pass −3 dB and −45° at fc', () => {
  const src = mk('acv', [1, 0], { amp: 1, freq: 1000 });
  const s = sim([src, mk('resistor', [1, 2], { r: 1000 }), mk('capacitor', [2, 0], { c: 1e-6 })]);
  s.start();
  const fc = 1 / (2 * Math.PI * 1e-3);
  const r = s.acSweep(src, 2, 0, fc, fc * 1.0001, 1);
  const H = r[0];
  close(20 * Math.log10(Math.hypot(H.re, H.im)), -3.0103, 1e-3, 'dB');
  close(Math.atan2(H.im, H.re) * 180 / Math.PI, -45, 1e-3, 'phase');
});

test('AC analysis: op-amp GBW macromodel closed-loop bandwidth', () => {
  const src = mk('acv', [1, 0], { amp: 0.01, freq: 1000 });
  const oa = mk('opamp', [2, 1, 3], { model: 'custom', a0: 2e5, gbw: 1e6, sr: 0.5e6 });
  const s = sim([src, oa, mk('resistor', [3, 2], { r: 9000 }), mk('resistor', [2, 0], { r: 1000 })]);
  s.start();
  const res = s.acSweep(src, 3, 0, 10, 1e7, 50);
  const g0 = Math.hypot(res[0].re, res[0].im);
  close(g0, 10, 1e-3, 'DC gain');
  const f3 = res.find((p) => Math.hypot(p.re, p.im) < g0 / Math.SQRT2).f;
  assert.ok(f3 > 0.85e5 && f3 < 1.15e5, 'f-3dB ' + f3);
});

test('transformer steps voltage by turns ratio', () => {
  const src = mk('acv', [1, 0], { amp: 100, freq: 50 });
  const t = mk('transformer', [1, 0, 2, 0], { l1: 10, n: 0.1, k: 0.9999, r1: 0.01, r2: 0.01 });
  const s = sim([src, t, mk('resistor', [2, 0], { r: 1e4 })]);
  s.start();
  let peak = 0;
  for (let i = 0; i < 4000; i++) { s.step(1e-5); if (s.t > 0.02) peak = Math.max(peak, s.v(2)); }
  close(peak, 10, 0.01, 'secondary peak');
});

test('NAND gate truth table', () => {
  for (const [a, b] of [[0, 0], [0, 1], [1, 0], [1, 1]]) {
    const g = mk('nand', [1, 2, 3]);
    const s = sim([mk('logicin', [1], { on: !!a }), mk('logicin', [2], { on: !!b }), g, mk('resistor', [3, 0], { r: 1e5 })]);
    s.start();
    s.step(1e-6); s.step(1e-6);
    const out = s.v(3) > 2.5;
    assert.equal(out, !(a && b), `NAND(${a},${b})`);
  }
});

test('555 astable frequency ≈ 1.44/((R1+2R2)C)', () => {
  // nodes: 1 vcc, 2 dis, 3 thr/trig, 4 out, 5 ctrl
  const t = mk('timer555', [1, 0, 3, 3, 5, 1, 4, 2]);
  const s = sim([mk('dcv', [1, 0], { amp: 9 }), mk('resistor', [1, 2], { r: 1000 }), mk('resistor', [2, 3], { r: 10000 }),
    mk('capacitor', [3, 0], { c: 1e-6 }), mk('capacitor', [5, 0], { c: 10e-9 }), t, mk('resistor', [4, 0], { r: 1000 })], { initialDC: false });
  s.start();
  const edges = [];
  let last = false;
  for (let i = 0; i < 200000 && edges.length < 6; i++) {
    s.step(1e-6);
    const hi = s.v(4) > 4.5;
    if (hi && !last) edges.push(s.t);
    last = hi;
  }
  const per = (edges.at(-1) - edges[1]) / (edges.length - 2);
  const expected = 1 / (Math.LN2 * (1000 + 2 * 10000) * 1e-6);
  assert.ok(Math.abs(1 / per - expected) / expected < 0.03, `f=${1 / per} expected ${expected}`);
});

test('7805 regulation and dropout', () => {
  for (const [vin, vexp] of [[9, 5], [6, 4]]) {
    const s = sim([mk('dcv', [1, 0], { amp: vin }), mk('reg78', [1, 2, 0], { vout: 5, vdo: 2 }), mk('resistor', [2, 0], { r: 100 })]);
    assert.ok(s.start());
    assert.ok(Math.abs(s.v(2) - vexp) < 0.06, `vin ${vin}: ${s.v(2)}`);
  }
});

test('LM317 sets Vout = 1.25(1 + R2/R1)', () => {
  const s = sim([mk('dcv', [1, 0], { amp: 15 }), mk('lm317', [1, 2, 3]), mk('resistor', [2, 3], { r: 240 }), mk('resistor', [3, 0], { r: 720 }), mk('resistor', [2, 0], { r: 200 })]);
  assert.ok(s.start());
  close(s.v(2), 5, 0.01, 'Vout');
});

test('DC motor steady-state speed', () => {
  const m = mk('motor', [1, 0], { ra: 2, la: 1e-3, k: 0.01, j: 1e-6, b: 1e-6, load: 0 });
  const s = sim([mk('dcv', [1, 0], { amp: 6 }), m]);
  assert.ok(s.start());
  assert.equal(m.w, 0, 'the rotor starts at rest');
  for (let i = 0; i < 4000; i++) assert.ok(s.step(1e-4)); // τ_mech ≈ 20 ms
  const w = (6 * 0.01) / (2 * 1e-6 + 0.01 * 0.01);
  close(m.w, w, 1e-3, 'ω');
});

test('solar cell open-circuit voltage ≈ Voc', () => {
  const pv = mk('solar', [1, 0], { irr: 1000, isc: 0.5, voc: 0.6 });
  const s = sim([pv, mk('resistor', [1, 0], { r: 1e9 })]);
  assert.ok(s.start());
  close(s.v(1), 0.6, 0.01, 'Voc');
});

test('relay switches load when coil is energised', () => {
  const rl = mk('relay', [1, 0, 2, 3, 4]);
  const s = sim([mk('dcv', [1, 0], { amp: 5 }), mk('dcv', [2, 0], { amp: 12 }), rl, mk('resistor', [4, 0], { r: 100 }), mk('resistor', [3, 0], { r: 100 })], { initialDC: false });
  s.start();
  for (let i = 0; i < 20000; i++) s.step(1e-5);
  assert.ok(rl.on, 'relay should be on');
  close(s.v(4), 12, 1e-3, 'NO load');
  assert.ok(Math.abs(s.v(3)) < 1e-3);
});

test('counter counts clock edges', () => {
  const ctr = mk('counter', [1, 0, 2, 3, 4, 5]);
  const s = sim([mk('clock', [1], { freq: 1000 }), ctr]);
  s.start();
  for (let i = 0; i < 5000; i++) s.step(1e-6); // 5 ms = 5 rising edges (first at t = 0)
  assert.ok(ctr.count === 5 || ctr.count === 4, 'count ' + ctr.count);
});

test('floating island is auto-referenced', () => {
  // secondary circuit isolated by transformer has no ground
  const s = sim([mk('dcv', [1, 2], { amp: 5 }), mk('resistor', [1, 2], { r: 100 })]);
  assert.ok(s.start());
  close(s.v(1) - s.v(2), 5, 1e-9, 'V');
});

test('singular circuit reports an error', () => {
  const s = sim([mk('dcv', [1, 0], { amp: 5 }), mk('dcv', [1, 0], { amp: 3 })]);
  s.start();
  assert.ok(s.error || s.fatal);
});

test('a capacitor held by an ideal source does not ring after a step (trapezoidal damping)', () => {
  // 5 V → 10 V step into 100 µF straight across the source: the trapezoidal rule alone leaves
  // the capacitor current flipping sign every step for ever; the engine must damp it
  const src = mk('dcv', [1, 0], { amp: 5 }), C = mk('capacitor', [1, 0], { c: 100e-6 });
  const s = sim([src, mk('resistor', [1, 0], { r: 100 }), C]);
  assert.ok(s.start());
  for (let i = 0; i < 50; i++) s.step(2e-5);
  src.p.amp = 10; s.dirty = true; // a change the engine is not told about
  for (let i = 0; i < 60; i++) s.step(2e-5);
  const tail = [];
  for (let i = 0; i < 20; i++) { s.step(2e-5); tail.push(C.i); }
  assert.ok(Math.max(...tail.map(Math.abs)) < 1e-3, 'capacitor current still ' + Math.max(...tail.map(Math.abs)));
});
