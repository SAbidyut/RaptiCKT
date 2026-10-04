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
