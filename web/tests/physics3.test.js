// Physical checks for machines, sensors and power-electronics blocks (third wave).
import test from 'node:test';
import assert from 'node:assert/strict';
import { net, run } from './netlib.js';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);
const rpm = (w) => (w * 60) / (2 * Math.PI);

test('6-terminal motor: delta draws 3× the line current of star (locked rotor)', () => {
  const lineRms = (delta) => {
    // supply R=1 Y=2 B=3 N=0; motor U1 V1 W1 U2 V2 W2
    const ends = delta ? [1, 2, 3, 2, 3, 1] : [1, 2, 3, 9, 9, 9];
    const { sim, els } = net([['ac3y', [1, 2, 3, 0], { zs: 0.001 }], ['im3d', ends, { j: 1e4 }]]);
    assert.ok(sim.start(), sim.error);
    let sq = 0, n = 0;
    run(sim, 0.1, 5e-5, () => {
      if (sim.t < 0.06) return;
      const i = els[1].iprev, il = delta ? i[0] - i[2] : i[0];
      sq += il * il; n++;
    });
    return Math.sqrt(sq / n);
  };
  const ratio = lineRms(true) / lineRms(false);
  near(ratio, 3, 0.05, 'I_line(delta) / I_line(star)');
});

test('6-terminal motor in star behaves like the 3-terminal motor', () => {
  const speed = (type) => {
    const nodes = type === 'im3' ? [1, 2, 3] : [1, 2, 3, 9, 9, 9];
    const { sim, els } = net([['ac3y', [1, 2, 3, 0]], [type, nodes, { load: 10 }]]);
    assert.ok(sim.start(), sim.error);
    run(sim, 1.2, 1e-4);
    return rpm(els[1].wm);
  };
  near(speed('im3d'), speed('im3'), 2, 'speed');
});

test('synchronous motor pulls into step and its excitation sets the power factor', () => {
  const { sim, els } = net([['ac3y', [1, 2, 3, 0]], ['syncmotor', [1, 2, 3], { load: 10 }]]);
  const m = els[1];
  assert.ok(sim.start(), sim.error);
  run(sim, 2, 1e-4);
  assert.ok(m.fieldOn, 'field applied');
  let sum = 0, n = 0;
  run(sim, 0.4, 1e-4, () => { sum += m.wm; n++; });
  near(rpm(sum / n), 1500, 0.5, 'average speed in synchronism');
  m.p.field = 70; run(sim, 1, 1e-4);
  const qUnder = m.pq[1];
  m.p.field = 150; run(sim, 1, 1e-4);
  const qOver = m.pq[1];
  near(rpm(m.wm), 1500, 5, 'still synchronous');
  assert.ok(qUnder > 0, 'under-excited absorbs reactive power (lagging), Q=' + qUnder);
  assert.ok(qOver < 0, 'over-excited delivers reactive power (leading), Q=' + qOver);
});

test('PMSM locks to a low-frequency supply', () => {
  // 8 poles at 2 Hz → 30 rpm
  const { sim, els } = net([['ac3y', [1, 2, 3, 0], { vll: 8, freq: 2 }], ['pmsm', [1, 2, 3], { load: 0 }]]);
  assert.ok(sim.start(), sim.error);
  run(sim, 3, 1e-4);
  let sum = 0, n = 0;
  run(sim, 1, 1e-4, () => { sum += els[1].wm; n++; });
  near(rpm(sum / n), 30, 0.5, 'PMSM speed');
});

test('stepper moves exactly 1.8° per full step', () => {
  const { sim, els } = net([['dcv', [1, 0], { amp: 0 }], ['dcv', [2, 0], { amp: 0 }], ['stepper', [1, 0, 2, 0], { load: 0 }]]);
  const [va, vb, m] = els;
  assert.ok(sim.start(), sim.error);
  const seq = [[5.6, 0], [0, 5.6], [-5.6, 0], [0, -5.6], [5.6, 0], [0, 5.6]];
  const pos = [];
  for (const [a, b] of seq) {
    va.p.amp = a; vb.p.amp = b; sim.dirty = true;
    run(sim, 0.08, 2e-5);
    pos.push(m.position());
  }
  pos.forEach((p, k) => near(p, 1.8 * k, 0.05, `position after step ${k}`));
  near(m.il[1], 2, 0.05, 'winding current V/R');
});

test('compound motor: cumulative slows more and differential less than shunt under load', () => {
  const speed = (type, extra = {}) => {
    // started light with the series field shorted (as practice requires for a differential
    // motor, whose fast series field would otherwise overpower the slow shunt field);
    // after 1.5 s: series field in, full load
    const { sim, els } = net([['dcv', [1, 0], { amp: 220 }], [type, [1, 0], { load: 0.5, kse: 0 }]]);
    assert.ok(sim.start(), sim.error);
    run(sim, 1.5, 1e-4);
    assert.ok(els[1].w > 100, type + ' runs forward');
    Object.assign(els[1].p, { load: 4, kse: 0.05, ...extra }); sim.dirty = true;
    run(sim, 2, 1e-4);
    return rpm(els[1].w);
  };
  const sh = speed('dcshunt'), cum = speed('dccompound', { mode: 'cum' }), dif = speed('dccompound', { mode: 'diff', kse: 0.003 });
  assert.ok(cum < sh - 50, `cumulative ${cum} < shunt ${sh}`);
  assert.ok(dif > sh + 2, `differential ${dif} > shunt ${sh}`);
});

test('universal motor runs on AC with unidirectional torque', () => {
  const { sim, els } = net([['mains', [1, 0]], ['universal', [1, 0]]]);
  assert.ok(sim.start(), sim.error);
  let neg = 0;
  run(sim, 1.5, 5e-5, () => { if (sim.t > 0.2 && els[1].kphi() * els[1].ia < -0.05) neg++; });
  assert.ok(rpm(els[1].w) > 1000, 'speed ' + rpm(els[1].w));
  assert.equal(neg, 0, 'torque never reverses');
});

test('1-phase generator: regulation with a resistive load', () => {
  const { sim, els } = net([['acgen1', [1, 0]], ['resistor', [1, 0], { r: 23 }]]);
  assert.ok(sim.start(), sim.error);
  let sq = 0, n = 0;
  run(sim, 0.2, 2e-5, () => { if (sim.t > 0.1) { sq += sim.v(1) ** 2; n++; } });
  const v = Math.sqrt(sq / n), expect = (230 * 23) / Math.hypot(23.3, 2);
  near(v, expect, 1.5, 'terminal RMS');
});

test('inductive proximity sensor: range, material factor, hysteresis, PNP/NPN, supply window', () => {
  // 24 V, PNP-NO with a 1 kΩ load from BK to 0 V
  const { sim, els } = net([['dcv', [1, 0], { amp: 24 }], ['proxind', [1, 2, 0], { d: 20 }], ['resistor', [2, 0], { r: 1000 }]]);
  const [src, px] = els;
  assert.ok(sim.start(), sim.error);
  const step = () => run(sim, 1e-3, 1e-5);
  step(); assert.ok(sim.v(2) < 0.1, 'no target: off ' + sim.v(2));
  px.p.d = 5; step(); near(sim.v(2), 24 * 1000 / 1030, 0.2, 'target at 5 mm: load gets ≈ supply − drop');
  px.p.d = 8.5; step(); assert.ok(sim.v(2) > 20, 'hysteresis keeps it on at 8.5 mm');
  px.p.d = 9; step(); assert.ok(sim.v(2) < 0.1, 'released beyond 110 % of Sn');
  px.p.mat = 'Aluminium'; px.p.d = 5; step(); assert.ok(sim.v(2) < 0.1, 'aluminium: Sr = 3.2 mm');
  px.p.d = 3; step(); assert.ok(sim.v(2) > 20, 'aluminium at 3 mm');
  src.p.amp = 6; sim.dirty = true; step(); assert.ok(sim.v(2) < 0.1, 'under-voltage: off');
});

test('NPN-NC proximity sinks its load until a target arrives; photo eye dark-on', () => {
  const { sim, els } = net([['dcv', [1, 0], { amp: 24 }], ['proxcap', [1, 2, 0], { out: 'NPN-NC', d: 50 }], ['resistor', [1, 2], { r: 1000 }],
    ['photoeye', [1, 3, 0], { mode: 'retro', sn: 3000, op: 'dark', d: 10000 }], ['resistor', [3, 0], { r: 1000 }]]);
  assert.ok(sim.start(), sim.error);
  run(sim, 1e-3, 1e-5);
  near(24 - sim.v(2), 24 * 1000 / 1030, 0.2, 'NC: load energised with no target');
  assert.ok(sim.v(3) < 0.1, 'beam clear: dark-on output off');
  els[1].p.d = 5; els[3].p.d = 1200; run(sim, 1e-3, 1e-5);
  assert.ok(24 - sim.v(2) < 0.1, 'NC opens on target');
  assert.ok(sim.v(3) > 20, 'object in the beam: dark-on output on');
});

test('4–20 mA transmitter: current follows the measurement until lift-off', () => {
  const { sim, els } = net([['dcv', [1, 0], { amp: 24 }], ['ptx', [1, 2], { x: 5 }], ['resistor', [2, 0], { r: 250 }]]);
  assert.ok(sim.start(), sim.error);
  near(sim.v(2), 3, 0.02, '12 mA → 3 V on 250 Ω');
  els[1].p.x = 0; sim.dirty = true; run(sim, 1e-4, 1e-5); near(sim.v(2), 1, 0.01, '4 mA at range low');
  els[1].p.x = 10; run(sim, 1e-4, 1e-5); near(sim.v(2), 5, 0.02, '20 mA at range high');
  els[1].p.x = 50; run(sim, 1e-4, 1e-5); near(sim.v(2) / 250, 0.0205, 0.0002, 'saturates at 20.5 mA');
  els[2].p.r = 1500; els[1].p.x = 10; sim.dirty = true; run(sim, 1e-4, 1e-5);
  assert.ok(sim.v(2) / 1500 < 0.016, 'too much loop resistance: current collapses below 20 mA, got ' + sim.v(2) / 1500);
});

test('smoke detector latches into alarm and resets only on power removal', () => {
  const { sim, els } = net([['dcv', [1, 0], { amp: 24 }], ['resistor', [1, 2], { r: 470 }], ['smoke', [2, 0]]]);
  const [src, , sd] = els;
  assert.ok(sim.start(), sim.error);
  run(sim, 0.01, 1e-5);
  near(sd.i, 6e-5, 5e-6, 'standby current');
  sd.p.smoke = 5; run(sim, 0.01, 1e-5);
  assert.ok(sd.alarm, 'alarm');
  assert.ok(sim.v(2) > 5.5 && sim.v(2) < 7.5, 'line clamps to ≈6 V: ' + sim.v(2));
  assert.ok(sd.i > 0.025, 'alarm current ' + sd.i);
  sd.p.smoke = 0; run(sim, 0.05, 1e-5); assert.ok(sd.alarm, 'stays latched');
  src.p.amp = 0; sim.dirty = true; run(sim, 0.2, 1e-5);
  src.p.amp = 24; sim.dirty = true; run(sim, 0.01, 1e-5);
  assert.ok(!sd.alarm, 'reset after power removal');
});

test('HC-SR04 echo width is the sound round trip; TCS3200 frequency follows the filter', () => {
  const { sim, els } = net([['dcv', [1, 0], { amp: 0 }], ['hcsr04', [1, 2], { d: 50 }], ['resistor', [2, 0], { r: 1e5 }],
    ['colorsens', [0, 0, 3]], ['resistor', [3, 0], { r: 1e5 }]]);
  assert.ok(sim.start(), sim.error);
  run(sim, 1e-4, 1e-6);
  els[0].p.amp = 5; sim.dirty = true; run(sim, 15e-6, 1e-6);
  els[0].p.amp = 0; sim.dirty = true;
  let hi = 0, edges = 0, last = false;
  run(sim, 0.01, 1e-6, () => { if (sim.v(2) > 2.5) hi += 1e-6; const h = sim.v(3) > 2.5; if (h && !last) edges++; last = h; });
  near(hi, 1 / (331.3 + 0.606 * 20), 5e-6, 'echo width for 50 cm');
  near(edges / 0.01, 12000 * 200 / 255, 150, 'red channel frequency');
});

test('IMU resolves gravity into its axes', () => {
  const { sim } = net([['dcv', [1, 0], { amp: 5 }], ['imu', [1, 0, 2, 3, 4, 5, 6, 7], { roll: 90 }],
    ...[2, 3, 4, 5, 6, 7].map((n) => ['resistor', [n, 0], { r: 1e6 }])]);
  assert.ok(sim.start(), sim.error);
  near(sim.v(3), 2.0, 0.01, 'ay = −1 g');
  near(sim.v(4), 2.5, 0.01, 'az = 0 g');
  near(sim.v(2), 2.5, 0.01, 'ax = 0 g');
});

test('H-bridge: forward, reverse, brake and coast', () => {
  const { sim, els } = net([['dcv', [1, 0], { amp: 12 }], ['dcv', [2, 0], { amp: 5 }], ['dcv', [3, 0], { amp: 0 }], ['dcv', [4, 0], { amp: 5 }],
    ['hbridge', [2, 3, 4, 1, 5, 6, 0]], ['resistor', [5, 6], { r: 10 }]]);
  const [, in1, in2, en] = els;
  assert.ok(sim.start(), sim.error);
  const st = () => { sim.dirty = true; run(sim, 1e-4, 1e-5); return sim.v(5) - sim.v(6); };
  near(st(), 12 * 10 / 12.4, 0.05, 'forward');
  in1.p.amp = 0; in2.p.amp = 5; near(st(), -12 * 10 / 12.4, 0.05, 'reverse');
  in1.p.amp = 5; near(st(), 0, 0.01, 'brake');
  en.p.amp = 0; near(st(), 0, 0.05, 'coast');
});

test('SPWM + 3-phase inverter: fundamental line voltage 0.612·m·Vdc into an RL load', () => {
  // Vdc 600 V; star RL load 10 Ω + 10 mH per phase
  const { sim, els } = net([['dcv', [1, 0], { amp: 600 }], ['dcv', [9, 0], { amp: 5 }], ['spwm', [2, 3, 4], { ramp: 0, m: 1 }],
    ['inv3', [2, 3, 4, 9, 1, 5, 6, 7, 0]],
    ['resistor', [5, 15], { r: 10 }], ['inductor', [15, 8], { l: 0.01 }], ['resistor', [6, 16], { r: 10 }], ['inductor', [16, 8], { l: 0.01 }],
    ['resistor', [7, 17], { r: 10 }], ['inductor', [17, 8], { l: 0.01 }]]);
  assert.ok(sim.start(), sim.error);
  run(sim, 0.04, 5e-6);
  let sq = 0, n = 0;
  run(sim, 0.04, 5e-6, () => { const i = els[3].iout(0); sq += i * i; n++; });
  const irms = Math.sqrt(sq / n), vph = (0.612 * 600) / Math.sqrt(3), z = Math.hypot(10, 2 * Math.PI * 50 * 0.01);
  near(irms, vph / z, 0.6, 'phase current RMS');
});

test('BLDC driver commutates from the Hall sensors: runs forward and reverses', () => {
  const spin = (dir) => {
    const { sim, els } = net([['dcv', [1, 0], { amp: 24 }], ['dcv', [9, 0], { amp: 5 }], ['bldc', [5, 6, 7, 2, 3, 4], { load: 0.02 }],
      ['bldcdrv', [2, 3, 4, 9, 1, 5, 6, 7, 0], { duty: 60, dir, fpwm: 5000 }]]);
    assert.ok(sim.start(), sim.error);
    run(sim, 0.25, 2e-6);
    return els[2].wm * 60 / (2 * Math.PI);
  };
  const f = spin('fwd'), r = spin('rev');
  assert.ok(f > 1500 && f < 3300, 'forward speed ' + f);
  assert.ok(r < -1500 && r > -3300, 'reverse speed ' + r);
});

test('stepper driver: current chopping and one 1.8° step per STEP pulse', () => {
  const { sim, els } = net([['dcv', [1, 0], { amp: 24 }], ['dcv', [9, 0], { amp: 5 }], ['clock', [2], { freq: 100 }],
    ['stepdrv', [2, 9, 0, 1, 5, 6, 7, 8, 0], { ilim: 1 }], ['stepper', [5, 6, 7, 8], { load: 0 }]]);
  const [, , , drv, m] = els;
  assert.ok(sim.start(), sim.error);
  let imax = 0;
  run(sim, 0.205, 2e-6, () => { if (sim.t > 0.1) imax = Math.max(imax, Math.abs(drv.wind(0))); });
  near(m.position(), 0.9 + 1.8 * drv.steps, 0.15, `position after ${drv.steps} steps`);
  assert.ok(drv.steps >= 20, 'steps ' + drv.steps);
  assert.ok(imax > 0.6 && imax < 0.85, 'chopped to I·cos45° ≈ 0.71 A, peak ' + imax);
});

test('firing unit + SCR bridge: Vdc = (Vm/π)(1 + cos α) on a resistive load', () => {
  // mains L=1 N=0; bridge: T1 1→3, T3 0→3 (top), T2 4→0... (A,K,G)
  const { sim, els } = net([['mains', [1, 0], { zs: 0.01 }], ['firing', [1, 0, 11, 3, 12, 3, 13, 1, 14, 4], { alpha: 60 }],
    ['scr', [1, 3, 11]], ['scr', [0, 3, 12]], ['scr', [4, 0, 13]], ['scr', [4, 1, 14]], ['resistor', [3, 4], { r: 50 }]]);
  assert.ok(sim.start(), sim.error);
  run(sim, 0.04, 1e-5);
  let sum = 0, n = 0;
  run(sim, 0.04, 1e-5, () => { sum += sim.v(3) - sim.v(4); n++; });
  const vm = 230 * Math.SQRT2;
  near(sum / n, (vm / Math.PI) * 1.5 - 1.5, 5, 'average output');
});

test('averaged isolated and inverting converters', () => {
  const { sim, els } = net([['dcv', [1, 0], { amp: 325 }], ['flyback', [1, 0, 2, 3]], ['resistor', [2, 3], { r: 6 }],
    ['dcv', [4, 0], { amp: 12 }], ['buckboost', [4, 0, 5], { ctl: 'duty', duty: 60 }], ['resistor', [5, 0], { r: 1e4 }]]);
  assert.ok(sim.start(), sim.error);
  run(sim, 1e-4, 1e-5);
  near(sim.v(2) - sim.v(3), 12 * 6 / 6.05, 0.05, 'flyback regulated output');
  near(els[1].i, (sim.v(2) - sim.v(3)) ** 2 / 6 / (0.85 * 325), 0.002, 'flyback input current from power balance');
  near(els[1].dutyNow(), 0.037 / 0.137, 0.01, 'flyback duty');
  near(sim.v(5), -18, 0.1, 'inverting buck-boost at D = 60 %');
});
