// Real-life relays (8-pin, 14-pin, automotive, module), ULN2003, stabilizer, flasher, and the
// wind turbine following its wind knob in both directions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { net, run } from './netlib.js';

const rms = (sim, f, t = 0.1, dt = 1e-4) => { let a = 0, n = 0; run(sim, t, dt, () => { a += f() ** 2; n++; }); return Math.sqrt(a / n); };

test('wind turbine speed, voltage and power follow the wind knob down as well as up', () => {
  const { sim, els } = net([['windgen', [1, 0], { wind: 12 }], ['resistor', [1, 0], { r: 10 }]]);
  assert.ok(sim.start(), sim.error);
  const w = els[0], at = (wind, t) => { w.p.wind = wind; sim.discontinuity(); run(sim, t, 2e-3); return { rpm: (w.w * 60) / (2 * Math.PI), v: sim.v(1) }; };
  const hi = at(12, 20), mid = at(8, 20), lo = at(4, 20), up = at(10, 20), calm = at(0, 60);
  assert.ok(hi.rpm > mid.rpm * 1.3 && mid.rpm > lo.rpm * 1.5, `rpm ${hi.rpm} → ${mid.rpm} → ${lo.rpm}`);
  assert.ok(hi.v > mid.v && mid.v > lo.v, `volts ${hi.v} → ${mid.v} → ${lo.v}`);
  assert.ok(up.rpm > mid.rpm && up.rpm < hi.rpm, `back up to 10 m/s: ${up.rpm}`);
  assert.ok(calm.rpm < 5, `no wind: the rotor coasts to a stop (${calm.rpm} rpm)`);
});

test('wind turbine on a stiff battery gives more torque with more wind (no stall dip)', () => {
  let last = 0;
  for (const wind of [4, 6, 8, 10, 12]) {
    const { sim, els } = net([['windgen', [1, 0], { wind }], ['dcv', [1, 0], { amp: 12 }]]);
    sim.start(); run(sim, 25, 2e-3);
    assert.ok(els[0].io > last, `${wind} m/s: ${els[0].io} A after ${last} A`);
    last = els[0].io;
  }
});

test('8-pin MY2N: 230 V AC coil pulls in on mains, 9 → 5 closes and 9 → 1 opens; wrong coil voltage does nothing or burns', () => {
  // pins: 14, 13, 9 COM, 1 NC, 5 NO, 12 COM, 4 NC, 8 NO
  const a = net([['mains', [1, 0]], ['relay8', [1, 0, 2, 3, 4, 2, 5, 6]], ['dcv', [2, 0], { amp: 12 }], ...[3, 4, 5, 6].map((n) => ['resistor', [n, 0], { r: 1000 }])]);
  a.sim.start(); run(a.sim, 0.2, 1e-4);
  assert.ok(a.els[1].contactsClosed(), 'energised');
  assert.ok(Math.abs(a.sim.v(4) - 12) < 0.05 && Math.abs(a.sim.v(3)) < 0.05, `NO ${a.sim.v(4)} NC ${a.sim.v(3)}`);
  assert.ok(Math.abs(a.sim.v(6) - 12) < 0.05 && Math.abs(a.sim.v(5)) < 0.05, 'pole 2');
  const b = net([['dcv', [1, 0], { amp: 12 }], ['relay8', [1, 0, 2, 3, 4, 2, 5, 6]], ['dcv', [2, 0], { amp: 12 }], ...[3, 4, 5, 6].map((n) => ['resistor', [n, 0], { r: 1000 }])]);
  b.sim.start(); run(b.sim, 0.2, 1e-4);
  assert.ok(!b.els[1].contactsClosed(), 'a 230 V AC coil does not pull in on 12 V DC');
  const c = net([['mains', [1, 0]], ['relay8', [1, 0, 2, 3, 4, 2, 5, 6], { model: '12 V DC', vcoil: 12, rcoil: 160, lcoil: 0.3, ac: false }]]);
  c.sim.start(); for (let i = 0; i < 50000 && !c.els[1].damaged; i++) c.sim.step(1e-4);
  assert.match(c.els[1].damaged?.why || '', /Coil burnt/);
});

test('14-pin MY4N: all four poles change over together', () => {
  // pins: 14, 13, then (COM, NC, NO) × 4
  const poles = [[3, 4], [5, 6], [7, 8], [9, 10]];
  const { sim, els } = net([['dcv', [1, 0], { amp: 24 }], ['relay14', [1, 0, ...poles.flatMap(([nc, no]) => [2, nc, no])], { model: '24 V DC', vcoil: 24, rcoil: 650, lcoil: 1.2, ac: false }],
    ['dcv', [2, 0], { amp: 5 }], ...poles.flat().map((n) => ['resistor', [n, 0], { r: 1000 }])]);
  sim.start(); run(sim, 0.3, 1e-4);
  assert.ok(els[1].contactsClosed());
  for (const [nc, no] of poles) assert.ok(sim.v(no) > 4.9 && sim.v(nc) < 0.1, `pole ${no}`);
});

test('automotive 5-pin relay: 30 → 87a released, 30 → 87 energised', () => {
  for (const coil of [0, 12]) {
    const { sim } = net([['dcv', [1, 0], { amp: coil || 1e-6 }], ['relayauto5', [1, 0, 2, 3, 4]], ['dcv', [2, 0], { amp: 12 }], ['resistor', [3, 0], { r: 10 }], ['resistor', [4, 0], { r: 10 }]]);
    sim.start(); run(sim, 0.1, 1e-4);
    assert.ok(coil ? sim.v(4) > 11.9 && sim.v(3) < 0.1 : sim.v(3) > 11.9 && sim.v(4) < 0.1, `coil ${coil} V`);
  }
});

test('relay module: low-level trigger switches on with IN low, high-level with IN high', () => {
  for (const trig of ['low', 'high']) for (const vin of [0, 5]) {
    const { sim, els } = net([['dcv', [1, 0], { amp: 5 }], ['dcv', [2, 0], { amp: vin || 1e-6 }], ['relaymod', [1, 0, 2, 4, 3, 5], { trig }], ['dcv', [3, 0], { amp: 12 }], ['resistor', [4, 0], { r: 100 }], ['resistor', [5, 0], { r: 100 }]]);
    sim.start(); run(sim, 0.05, 1e-4);
    const want = trig === 'low' ? vin === 0 : vin === 5;
    assert.equal(els[2].on, want, `${trig} trigger, IN = ${vin} V`);
    assert.ok(want ? sim.v(4) > 11.9 && sim.v(5) < 0.1 : sim.v(5) > 11.9 && sim.v(4) < 0.1, 'NO / NC');
    if (want) assert.ok(els[2].iin > 1e-3 && els[2].iin < 5e-3, 'input current ' + els[2].iin);
  }
});

test('ULN2003 sinks a 12 V relay coil from a 5 V input and clamps the turn-off kick at COM', () => {
  const nodes = [2, 0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 1];
  const { sim, els } = net([['dcv', [1, 0], { amp: 12 }], ['dcv', [2, 0], { amp: 5 }], ['uln2003', nodes], ['relay', [1, 3, 5, 6, 7], { vcoil: 12, rcoil: 400 }], ...[5, 6, 7].map((n) => ['resistor', [n, 0], { r: 1e3 }])]);
  sim.start(); run(sim, 0.05, 1e-5);
  assert.ok(sim.v(3) > 0.5 && sim.v(3) < 1.0, 'Vce(sat) ' + sim.v(3));
  assert.ok(els[3].on, 'relay pulled in');
  els[1].p.amp = 0; sim.discontinuity();
  let vmax = 0; run(sim, 0.02, 1e-6, () => { vmax = Math.max(vmax, sim.v(3)); });
  assert.ok(vmax < 13.5, 'kick clamped to ' + vmax);
  assert.ok(!els[3].on && !els[2].damaged, 'released, ULN intact');
});

test('voltage stabilizer keeps a load near 220 V from 150 to 260 V and cuts out beyond', () => {
  for (const [vin, lo, hi] of [[150, 200, 240], [180, 200, 240], [230, 205, 240], [260, 200, 240], [120, 0, 1], [300, 0, 1]]) {
    const { sim, els } = net([['mains', [1, 0], { vrms: vin }], ['stabilizer', [1, 2, 0]], ['rload', [2, 0], { p: 500, v: 230 }]]);
    sim.start(); run(sim, 4, 1e-4);
    const vo = rms(sim, () => sim.v(2));
    assert.ok(vo >= lo && vo <= hi, `${vin} V in → ${vo} V out (${els[1].readings()[0][1]})`);
  }
});

test('stabilizer: a sudden swell from 150 V to 260 V never reaches the load', () => {
  const { sim, els } = net([['mains', [1, 0], { vrms: 150 }], ['stabilizer', [1, 2, 0]], ['bulb', [2, 0], { w: 100 }]]);
  sim.start(); run(sim, 4, 1e-4);
  els[0].p.vrms = 260; sim.discontinuity(); run(sim, 1, 1e-4);
  assert.ok(!els[2].damaged, els[2].damaged?.why);
  assert.match(els[1].readings()[0][1], /Buck/);
});

test('flasher: ≈85 flashes a minute, twice as fast with a bulb out', () => {
  for (const [w, lo, hi] of [[42, 70, 100], [21, 150, 200]]) {
    const { sim, els } = net([['dcv', [1, 0], { amp: 12.6 }], ['flasher', [1, 0, 2]], ['resistor', [2, 0], { r: 144 / w }]]);
    sim.start(); let n = 0, p = false; run(sim, 12, 1e-3, () => { if (els[1].on && !p) n++; p = els[1].on; });
    assert.ok(n * 5 >= lo && n * 5 <= hi, `${w} W: ${n * 5}/min`);
  }
});
