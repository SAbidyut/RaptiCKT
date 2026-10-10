// Quantitative checks of the power / machine / protection models against
// textbook values.
import test from 'node:test';
import assert from 'node:assert/strict';
import { getType } from '../src/elements/index.js';
import { Simulator } from '../src/engine/sim.js';

/** Tiny netlist builder: el(type, [nodes], props) */
function net() {
  const els = [];
  const el = (type, nodes, p = {}) => {
    const C = getType(type);
    assert.ok(C, 'unknown type ' + type);
    const e = new C(0, 0);
    Object.assign(e.p, p);
    if (type === 'resistor' && p.pw === undefined) e.p.pw = '0'; // test loads stay ideal (a new resistor is ¼ W)
    e.nodes = nodes; e.name = type + els.length;
    e.onParamChange?.();
    els.push(e);
    return e;
  };
  const run = (T, dt, each) => {
    const sim = new Simulator().buildNet(els);
    assert.ok(sim.start() || !sim.fatal, sim.error);
    const n = Math.round(T / dt);
    for (let k = 0; k < n; k++) { assert.ok(sim.step(dt), `step ${k}: ${sim.error}`); each?.(sim); }
    return sim;
  };
  return { el, run, els };
}
const rmsOf = (arr) => Math.sqrt(arr.reduce((a, b) => a + b * b, 0) / arr.length);

test('mains: 230 V RMS, 325 V peak', () => {
  const { el, run } = net();
  el('mains', [1, 0]); const r = el('resistor', [1, 0], { r: 100 });
  const v = [];
  run(0.04, 1e-5, (s) => { if (s.t > 0.02) v.push(s.v(1)); });
  assert.ok(Math.abs(rmsOf(v) - 230) < 2, 'rms ' + rmsOf(v));
  void r;
});

test('3-phase supply: line voltage = 400 V RMS, 120° apart', () => {
  const { el, run } = net();
  el('ac3y', [1, 2, 3, 0]);
  for (const n of [1, 2, 3]) el('resistor', [n, 0], { r: 100 });
  const vl = [];
  run(0.04, 1e-5, (s) => { if (s.t > 0.02) vl.push(s.v(1) - s.v(2)); });
  assert.ok(Math.abs(rmsOf(vl) - 400) < 3, 'VLL ' + rmsOf(vl));
});

test('MCB: magnetic trip on short circuit, holds at rated current', () => {
  let a = net();
  a.el('mains', [1, 0]);
  const q = a.el('mcb', [1, 2], { in: 10, curve: 'C' });
  a.el('resistor', [2, 0], { r: 0.1 });
  a.run(0.02, 1e-5);
  assert.ok(q.tripped && /magnetic/.test(q.cause), 'should trip magnetically');
  a = net();
  a.el('mains', [1, 0]);
  const q2 = a.el('mcb', [1, 2], { in: 10, curve: 'C' });
  a.el('resistor', [2, 0], { r: 230 / 9 });
  a.run(0.2, 1e-4);
  assert.ok(!q2.tripped, 'must not trip at 0.9 In');
});

test('MCB: thermal trip time at 2.55·In within the IEC 1–60 s band', () => {
  const { el, run } = net();
  el('dcv', [1, 0], { amp: 25.5 });
  const q = el('mcb', [1, 2], { in: 10, curve: 'D' });
  el('resistor', [2, 0], { r: 1 });
  let tTrip = null;
  run(70, 0.01, (s) => { if (q.tripped && tTrip === null) tTrip = s.t; });
  assert.ok(tTrip !== null && tTrip > 1 && tTrip < 60, 'trip at ' + tTrip);
});

test('RCCB trips on 50 mA earth leakage but not on a healthy load', () => {
  for (const [app, expect] of [['fault', true], ['heater', false]]) {
    const { el, run } = net();
    el('mains', [1, 2]);
    const rc = el('rccb', [1, 2, 3, 4]);
    el('socket', [3, 4, 0], { app });
    run(0.2, 1e-4);
    assert.equal(rc.tripped, expect, `${app}: tripped=${rc.tripped}`);
  }
});

test('incandescent bulb: inrush ≈ 10–16× rated current, settles to rated power', () => {
  const { el, run } = net();
  el('acv', [1, 0], { amp: 325, freq: 50, phase: 90 }); // switched on at the voltage peak
  const b = el('bulb', [1, 0], { w: 60 });
  let ipk = 0;
  const late = [];
  run(1, 5e-5, (s) => { if (s.t < 0.02) ipk = Math.max(ipk, Math.abs(b.i)); if (s.t > 0.9) late.push(b.i); });
  const irated = 60 / 230;
  const ratio = ipk / (irated * Math.SQRT2);
  assert.ok(ratio > 8 && ratio < 18, 'inrush ratio ' + ratio);
  assert.ok(Math.abs(rmsOf(late) * 230 - 60) < 6, 'P ' + rmsOf(late) * 230);
});

test('fluorescent tube lights with ballast + starter and runs near its arc voltage', () => {
  const { el, run } = net();
  el('mains', [1, 0]);
  el('ballast', [1, 2]);
  const t = el('tube', [2, 3, 4, 0]);
  const st = el('starter', [3, 4]);
  let litAt = null;
  const va = [];
  run(3, 5e-5, (s) => { if (t.arc.lit && litAt === null) litAt = s.t; if (litAt !== null && s.t > litAt + 0.5) va.push(t.va); });
  assert.ok(litAt !== null, 'tube never struck');
  assert.ok(!st.closed, 'starter must be open while the tube runs');
  const vr = rmsOf(va);
  assert.ok(vr > 70 && vr < 140, 'arc RMS ' + vr);
  assert.ok(t.pavg > 20 && t.pavg < 60, 'tube power ' + t.pavg);
});

test('TRIAC dimmer: load RMS voltage falls with the level setting', () => {
  const rmsAt = (level) => {
    const { el, run } = net();
    el('mains', [1, 0]);
    el('dimmer', [1, 2], { level });
    el('resistor', [2, 0], { r: 500 });
    const v = [];
    run(0.1, 2e-5, (s) => { if (s.t > 0.06) v.push(s.v(2)); });
    return rmsOf(v);
  };
  const full = rmsAt(100), half = rmsAt(50), low = rmsAt(15);
  assert.ok(full > 220, 'full ' + full);
  // α = 90°: Vrms = V·√(1/2) ≈ 163 V
  assert.ok(Math.abs(half - 163) < 8, 'half ' + half);
  assert.ok(low < half && low > 5, 'low ' + low);
});

test('3-phase induction motor starts (≈6× current) and runs just below synchronous speed', () => {
  const { el, run } = net();
  el('ac3y', [1, 2, 3, 0]);
  const m = el('im3', [1, 2, 3], { load: 10 });
  let ipk = 0;
  run(1.2, 1e-4, (s) => { if (s.t < 0.1) ipk = Math.max(ipk, Math.abs(m.postCurrents[0])); });
  const rpm = (m.wm * 60) / (2 * Math.PI);
  assert.ok(rpm > 1400 && rpm < 1500, 'rpm ' + rpm);
  assert.ok(ipk > 40, 'starting current peak ' + ipk);
  assert.ok(Math.abs(m.te - 10) < 1.5, 'torque ' + m.te);
});

test('1-phase capacitor motor starts with its run capacitor', () => {
  const { el, run } = net();
  el('mains', [1, 0]);
  const m = el('im1', [1, 2, 0], { load: 0.5 });
  el('capacitor', [1, 2], { c: 8e-6 });
  run(1.5, 1e-4);
  const rpm = (m.wm * 60) / (2 * Math.PI);
  assert.ok(rpm > 1200 && rpm < 1500, 'rpm ' + rpm);
});

test('Dyn11 transformer: 11 kV/415 V ratio and +30° phase shift', () => {
  const { el, run } = net();
  el('ac3y', [1, 2, 3, 0], { vll: 11000 });
  const t = el('tx3ph', [1, 2, 3, 4, 5, 6, 7]);
  el('ground', [7]);
  for (const n of [4, 5, 6]) el('resistor', [n, 7], { r: 1e3 });
  const van = [], vAN = [];
  run(0.06, 2e-5, (s) => { if (s.t > 0.04) { van.push(s.v(4) - s.v(7)); vAN.push(s.v(1)); } });
  const vll = rmsOf(van) * Math.sqrt(3);
  assert.ok(Math.abs(vll - 415) < 10, 'secondary VLL ' + vll);
  // phase: find the lag in samples between the rising zero crossings
  const cross = (a) => a.findIndex((v, i) => i > 0 && a[i - 1] < 0 && v >= 0);
  const d = (cross(vAN) - cross(van)) * 2e-5 * 50 * 360; // positive when secondary leads
  const lead = ((d % 360) + 360) % 360;
  assert.ok(Math.abs(lead - 30) < 6, 'phase shift ' + lead);
  void t;
});

test('bench PSU limits current (CC mode) into a heavy load', () => {
  const { el, run } = net();
  const ps = el('benchpsu', [1, 0], { vset: 12, ilim: 1 });
  el('resistor', [1, 0], { r: 2 });
  run(0.01, 1e-4);
  assert.ok(Math.abs(-ps.i - 1) < 0.02, 'I ' + -ps.i);
  assert.ok(ps.cc);
});

test('DC shunt motor settles at the speed where back-EMF ≈ supply', () => {
  const { el, run } = net();
  el('dcv', [1, 0], { amp: 220 });
  const m = el('dcshunt', [1, 0], { load: 2 });
  run(0.5, 1e-3);
  const E = m.kphi() * m.w;
  assert.ok(E > 200 && E < 220, 'EMF ' + E);
});

test('SCR latches on a gate pulse and turns off below holding current', () => {
  const { el, run } = net();
  el('dcv', [1, 0], { amp: 12 });
  const sw = el('switch', [1, 4], { closed: true });
  el('resistor', [4, 2], { r: 100 });
  const scr = el('scr', [2, 0, 3]);
  const gp = el('pulse', [5, 0], { amp: 5, freq: 100, duty: 5 });
  el('resistor', [5, 3], { r: 220 });
  const sim = run(0.004, 1e-5);
  assert.ok(scr.on, 'should be on after the gate pulse');
  assert.ok(scr.ia > 0.1, 'anode current ' + scr.ia);
  // remove the gate drive: stays latched
  gp.p.amp = 0; sim.dirty = true;
  for (let k = 0; k < 500; k++) sim.step(1e-5);
  assert.ok(scr.on, 'latched without gate');
  // interrupt the anode supply: drops out
  sw.p.closed = false; sim.dirty = true;
  for (let k = 0; k < 50; k++) sim.step(1e-5);
  assert.ok(!scr.on, 'must turn off when anode current stops');
});

test('DIAC-triggered TRIAC dimmer controls a lamp', () => {
  const rms = (rpot) => {
    const { el, run } = net();
    el('mains', [1, 0]);
    el('resistor', [1, 2], { r: 500 }); // load
    const t = el('triac', [2, 0, 3]);
    el('resistor', [2, 4], { r: rpot });
    el('capacitor', [4, 0], { c: 100e-9 });
    el('diac', [4, 3]);
    const v = [];
    run(0.12, 1e-5, (s) => { if (s.t > 0.06) v.push(s.v(1) - s.v(2)); });
    void t;
    return rmsOf(v);
  };
  const bright = rms(10e3), dim = rms(150e3);
  assert.ok(bright > 180, 'bright ' + bright);
  assert.ok(dim < bright - 40 && dim > 10, 'dim ' + dim);
});

test('UJT relaxation oscillator oscillates near 1/(R·C·ln(1/(1−η)))', () => {
  const { el, run } = net();
  el('dcv', [1, 0], { amp: 12 });
  el('resistor', [1, 2], { r: 47e3 });
  el('capacitor', [2, 0], { c: 100e-9 });
  el('resistor', [1, 3], { r: 470 });
  el('ujt', [2, 3, 4]);
  el('resistor', [4, 0], { r: 47 });
  let n = 0, prev = 0;
  run(0.05, 2e-6, (s) => { const v = s.v(4); if (prev < 0.5 && v >= 0.5) n++; prev = v; });
  const fExpected = 1 / (47e3 * 100e-9 * Math.log(1 / (1 - 0.65)));
  const f = n / 0.05;
  assert.ok(Math.abs(f - fExpected) / fExpected < 0.35, `f ${f} vs ${fExpected}`);
});

test('optocoupler transfers ≈CTR × If', () => {
  const { el, run } = net();
  el('dcv', [1, 0], { amp: 5 });
  el('resistor', [1, 2], { r: 380 });
  const oc = el('opto', [2, 0, 3, 0], { ctr: 100 });
  el('dcv', [4, 0], { amp: 12 });
  el('resistor', [4, 3], { r: 1000 });
  run(0.001, 1e-5);
  const If = oc.postCurrents[0], Ic = oc.postCurrents[2];
  assert.ok(If > 8e-3 && If < 11e-3, 'If ' + If);
  assert.ok(Math.abs(Ic / If - 1) < 0.35, 'CTR ' + Ic / If);
});

test('bridge rectifier: DC output ≈ peak − 2 diode drops', () => {
  const { el, run } = net();
  el('acv', [1, 2], { amp: 12, freq: 50 });
  el('bridge', [1, 2, 3, 4]);
  el('ground', [4]);
  el('resistor', [3, 4], { r: 1000 });
  el('capacitor', [3, 4], { c: 1000e-6 });
  let v = 0;
  run(0.2, 5e-5, (s) => { v = s.v(3) - s.v(4); });
  assert.ok(v > 9.8 && v < 11, 'Vdc ' + v);
});

test('buck module: 12 V → 5 V with input current from power balance', () => {
  const { el, run } = net();
  el('dcv', [1, 0], { amp: 12 });
  const b = el('buckmod', [1, 0, 2, 0], { vset: 5, eff: 0.9 });
  el('resistor', [2, 0], { r: 5 });
  run(0.001, 1e-5);
  assert.ok(Math.abs(b.vout - 5) < 0.05, 'vout ' + b.vout);
  const iin = (5 * 1) / (0.9 * 12);
  assert.ok(Math.abs(b.i - iin) < 0.02, `iin ${b.i} vs ${iin}`);
});

test('PID loop drives a first-order plant to the set-point', () => {
  const { el, run } = net();
  el('dcv', [1, 0], { amp: 2 });
  el('pid', [1, 3, 2], { kp: 2, ki: 50, kd: 0 });
  el('tf1', [2, 3], { k: 1, tau: 0.05 });
  let y = 0;
  run(0.5, 1e-4, (s) => { y = s.v(3); });
  assert.ok(Math.abs(y - 2) < 0.01, 'y ' + y);
});

test('2nd-order block: step overshoot matches e^(−πζ/√(1−ζ²))', () => {
  const { el, run } = net();
  el('stepsrc', [1, 0], { v0: 0, v1: 1, t0: 0, tr: 0 });
  el('tf2', [1, 2], { fn: 50, zeta: 0.3 });
  let peak = 0;
  run(0.2, 2e-5, (s) => { peak = Math.max(peak, s.v(2)); });
  const expected = 1 + Math.exp((-Math.PI * 0.3) / Math.sqrt(1 - 0.09));
  assert.ok(Math.abs(peak - expected) < 0.02, `peak ${peak} vs ${expected}`);
});

test('TL431 regulates to 2.495·(1 + R1/R2)', () => {
  const { el, run } = net();
  el('dcv', [1, 0], { amp: 12 });
  el('resistor', [1, 2], { r: 470 });
  el('tl431', [3, 2, 0]);
  el('resistor', [2, 3], { r: 10e3 });
  el('resistor', [3, 0], { r: 10e3 });
  let v = 0;
  run(0.001, 1e-5, (s) => { v = s.v(2); });
  assert.ok(Math.abs(v - 4.99) < 0.05, 'Vka ' + v);
});

test('79xx gives −5 V; INA128 gain = 1 + 50k/RG', () => {
  let a = net();
  a.el('dcv', [0, 1], { amp: 12 }); // node 1 at −12 V
  a.el('reg79', [1, 2, 0], { vout: 5 });
  a.el('resistor', [2, 0], { r: 100 });
  let v = 0;
  a.run(0.001, 1e-5, (s) => { v = s.v(2); });
  assert.ok(Math.abs(v + 5) < 0.05, '79xx ' + v);
  a = net();
  a.el('dcv', [1, 0], { amp: 0.01 });
  a.el('instamp', [0, 1, 0, 2], { rg: 500 });
  a.el('resistor', [2, 0], { r: 1e4 });
  a.run(0.001, 1e-5, (s) => { v = s.v(2); });
  assert.ok(Math.abs(v - 1.01) < 0.01, 'INA ' + v);
});

test('transmission line: open end reflects and doubles the step', () => {
  const { el, run } = net();
  el('stepsrc', [1, 0], { v0: 0, v1: 2, t0: 0, tr: 0 });
  el('resistor', [1, 2], { r: 50 });
  el('tline', [2, 0, 3, 0], { z0: 50, td: 1e-6 });
  let early = null, late = 0;
  run(4e-6, 1e-8, (s) => { if (s.t > 0.5e-6 && s.t < 0.9e-6) early = s.v(2); if (s.t > 1.2e-6 && s.t < 1.8e-6) late = s.v(3); });
  assert.ok(Math.abs(early - 1) < 0.05, 'launched ' + early);
  assert.ok(Math.abs(late - 2) < 0.08, 'open end ' + late);
});

test('staircase wiring: two-way + intermediate + two-way switches all control the lamp', () => {
  const { el, run } = net();
  el('dcv', [1, 0], { amp: 12 });
  const s1 = el('twoway', [1, 2, 3]);
  const mid = el('intermediate', [2, 3, 4, 5]);
  const s2 = el('twoway', [6, 4, 5]);
  el('resistor', [6, 0], { r: 100 });
  const sim = run(0.0005, 1e-5);
  const on = () => Math.abs(sim.v(6)) > 6;
  const first = on();
  for (const sw of [s1, mid, s2]) {
    const before = on();
    sw.onTap(); sim.dirty = true;
    for (let k = 0; k < 5; k++) sim.step(1e-5);
    assert.notEqual(on(), before, sw.constructor.type + ' did not toggle the lamp');
  }
  void first;
});

test('contactor self-latches with its auxiliary contact (DOL start/stop)', () => {
  const { el, run } = net();
  el('mains', [1, 0]);
  const stop = el('pushnc', [1, 2]);
  const start = el('pushno', [2, 3]);
  const km = el('contactor', [3, 0, 7, 8, 9, 10, 11, 12, 2, 3]);
  const sim = run(0.02, 1e-4);
  assert.ok(!km.contactsClosed(), 'initially off');
  start.pressed = true; sim.dirty = true;
  for (let k = 0; k < 300; k++) sim.step(1e-4);
  assert.ok(km.contactsClosed(), 'pulled in');
  start.pressed = false; sim.dirty = true;
  for (let k = 0; k < 300; k++) sim.step(1e-4);
  assert.ok(km.contactsClosed(), 'held in through the aux contact');
  stop.pressed = true; sim.dirty = true;
  for (let k = 0; k < 300; k++) sim.step(1e-4);
  assert.ok(!km.contactsClosed(), 'stopped');
});

test('on-delay timer relay switches after the set time', () => {
  const { el, run } = net();
  el('dcv', [1, 0], { amp: 230 });
  const t = el('tdr', [1, 0, 2, 3, 4], { t: 0.5, ac: false });
  let at = null;
  run(1, 1e-3, (s) => { if (t.out && at === null) at = s.t; });
  assert.ok(at !== null && Math.abs(at - 0.5) < 0.02, 'switched at ' + at);
});

test('IGBT switches a load; Darlington has β² gain', () => {
  let a = net();
  a.el('dcv', [1, 0], { amp: 100 });
  a.el('resistor', [1, 2], { r: 10 });
  const q = a.el('igbt', [3, 2, 0]);
  a.el('dcv', [3, 0], { amp: 15 });
  a.run(0.001, 1e-5);
  assert.ok(q.postCurrents[1] > 9, 'IGBT Ic ' + q.postCurrents[1]);
  a = net();
  a.el('dcv', [1, 0], { amp: 5 });
  a.el('resistor', [1, 2], { r: 4700 });
  const d = a.el('darlnpn', [2, 3, 0], { bf: 50 });
  a.el('dcv', [4, 0], { amp: 12 });
  a.el('resistor', [4, 3], { r: 3 }); // stays in the active region (Ic < 4 A)
  a.run(0.001, 1e-5);
  const gain = d.postCurrents[1] / d.postCurrents[0];
  assert.ok(gain > 1000, 'Darlington gain ' + gain);
});

test('instruments: frequency, phase, power factor, VAR, kWh on an R-L load', () => {
  const { el, run } = net();
  el('mains', [1, 0]);
  const fm = el('freqmeter', [1, 0]);
  const pf = el('pfmeter', [1, 2, 0]);
  const vq = el('varmeter', [2, 3, 0]);
  const e = el('kwh', [3, 4, 0]);
  el('rlload', [4, 0], { p: 1000, pf: 0.8 });
  run(0.3, 5e-5);
  assert.ok(Math.abs(fm.m.f - 50) < 0.05, 'f ' + fm.m.f);
  assert.ok(Math.abs(pf.PF() - 0.8) < 0.02 && pf.lagging(), 'pf ' + pf.PF());
  assert.ok(Math.abs(pf.P() - 1000) < 30, 'P ' + pf.P());
  assert.ok(Math.abs(vq.Q() - 750) < 30, 'Q ' + vq.Q());
  // ≈ 1000 W for ~0.3 s ≈ 0.083 Wh
  assert.ok(Math.abs(e.e / 3600 - (1000 * 0.3) / 3600) < 0.01, 'Wh ' + e.e / 3600);
});

test('phase meter: RC low-pass at its corner lags by 45°', () => {
  const { el, run } = net();
  el('acv', [1, 0], { amp: 5, freq: 1000 });
  el('resistor', [1, 2], { r: 1000 });
  el('capacitor', [2, 0], { c: 1 / (2 * Math.PI * 1000 * 1000) });
  const pm = el('phasemeter', [1, 2, 0]);
  run(0.02, 2e-6);
  assert.ok(Math.abs(pm.phase() + 45) < 2, 'phase ' + pm.phase());
});

test('LCR meter reads a 1 µF capacitor and a 10 mH inductor', () => {
  let a = net();
  const m = a.el('lcr', [1, 0], { f: 1000 });
  a.el('capacitor', [1, 0], { c: 1e-6 });
  a.el('resistor', [1, 0], { r: 1e9 });
  a.run(0.03, 1e-6);
  const w = 2 * Math.PI * 1000, z = m.Z();
  assert.ok(Math.abs(-1 / (w * z.x) - 1e-6) / 1e-6 < 0.03, 'C ' + -1 / (w * z.x));
  a = net();
  const m2 = a.el('lcr', [1, 0], { f: 1000 });
  a.el('inductor', [1, 0], { l: 0.01, rs: 1 });
  a.run(0.03, 1e-6);
  const z2 = m2.Z();
  assert.ok(Math.abs(z2.x / w - 0.01) / 0.01 < 0.03, 'L ' + z2.x / w);
});

test('digital: 4-bit adder, decade counter and 4:1 mux', () => {
  const { el, run } = net();
  // A = 5 (0101), B = 6 (0110) → 11
  const hi = 1, lo = 0;
  el('dcv', [20, 0], { amp: 5 });
  const pins = [hi, lo, hi, lo, lo, hi, hi, lo, lo].map((b) => (b ? 20 : 0));
  const add = el('adder4', [...pins, 21, 22, 23, 24, 25]);
  const clk = el('square', [30, 0], { amp: 2.5, offset: 2.5, freq: 1000 });
  const dec = el('decade', [30, 0, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49]);
  const mux = el('mux4', [0, 0, 20, 0, 0, 20, 50]); // I2 = 1, S = 2 (S0 = 0, S1 = 1)
  run(0.0035, 1e-5);
  assert.equal(add.sum, 11);
  assert.equal(dec.st, 3, 'decade count ' + dec.st);
  assert.ok(mux.out[0], 'mux');
  void clk;
});

test('sensors: load cell mV/V, ACS712 185 mV/A, LVDT proportional', () => {
  let a = net();
  a.el('dcv', [1, 0], { amp: 5 });
  const lc = a.el('loadcell', [1, 0, 2, 3], { load: 5, cap: 5, mvv: 2 });
  let v = 0;
  a.run(0.001, 1e-5, (s) => { v = s.v(2) - s.v(3); });
  assert.ok(Math.abs(v - 0.01) < 2e-4, 'bridge ' + v);
  void lc;
  a = net();
  a.el('dcv', [1, 0], { amp: 5 });
  a.el('dcv', [2, 0], { amp: 2 });
  a.el('acs712', [2, 3, 1, 4, 0]);
  a.el('resistor', [3, 0], { r: 1 }); // 2 A
  a.el('resistor', [4, 0], { r: 1e5 });
  a.run(0.001, 1e-5, (s) => { v = s.v(4); });
  assert.ok(Math.abs(v - (2.5 + 0.185 * 2)) < 0.02, 'ACS ' + v);
  const lv = (x) => {
    const b = net();
    b.el('acv', [1, 0], { amp: 5, freq: 5000 });
    b.el('lvdt', [1, 0, 2, 3], { x });
    b.el('resistor', [2, 3], { r: 1e5 });
    b.el('ground', [3]);
    const o = [];
    b.run(0.004, 2e-6, (s) => { if (s.t > 0.002) o.push(s.v(2) - s.v(3)); });
    return rmsOf(o);
  };
  const v0 = lv(0), v50 = lv(50), v100 = lv(100);
  assert.ok(v0 < 0.02 * v100, 'null ' + v0);
  assert.ok(Math.abs(v50 / v100 - 0.5) < 0.05, 'linear ' + v50 / v100);
});

test('servo follows a 1.5 ms pulse to 90° and a 2 ms pulse to 180°', () => {
  for (const [pw, ang] of [[1.5e-3, 90], [2e-3, 180]]) {
    const { el, run } = net();
    el('pulse', [1, 0], { amp: 5, freq: 50, duty: pw * 50 * 100 });
    const sv = el('servo', [1, 0]);
    run(0.6, 2e-5);
    assert.ok(Math.abs(sv.ang - ang) < 3, `pw ${pw}: ${sv.ang}`);
  }
});
