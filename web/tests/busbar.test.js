// Busbar: the number of taps and the bar size can be chosen; current shares out correctly.
import test from 'node:test';
import assert from 'node:assert/strict';
import { getType } from '../src/elements/index.js';
import { Simulator } from '../src/engine/sim.js';

test('busbar with 8 taps feeds 7 loads; size presets set area and rating', () => {
  const Bus = getType('busbar'), V = getType('dcv'), R = getType('resistor');
  const bus = new Bus(0, 0);
  bus.p.taps = '8'; bus.onParamChange();
  assert.equal(bus.getPosts().length, 8);
  bus.nodes = [1, 2, 3, 4, 5, 6, 7, 8];
  const src = new V(0, 0); src.p.amp = 230; src.nodes = [1, 0];
  const loads = [2, 3, 4, 5, 6, 7, 8].map((n) => { const r = new R(0, 0); r.p.r = 23; r.nodes = [n, 0]; return r; });
  const s = new Simulator().buildNet([src, bus, ...loads]);
  assert.ok(s.start(), s.error);
  for (let i = 0; i < 20; i++) assert.ok(s.step(1e-4));
  assert.ok(Math.abs(bus.imax - 70) < 0.5, 'feed section carries all 7 × 10 A: ' + bus.imax);
  assert.ok(Math.abs(bus.postCurrents.reduce((a, b) => a + b, 0)) < 1e-6, 'currents balance');
  for (const r of loads) assert.ok(Math.abs(Math.abs(r.i) - 10) < 0.05, 'each load 10 A');
  // a 50 × 10 mm bar: 500 mm², ≈1 kA
  const def = Bus.props.find((p) => p.key === 'model');
  Object.assign(bus.p, def.preset['50×10']); bus.p.model = '50×10';
  assert.equal(bus.p.w, 500); assert.ok(bus.p.rating > 900);
  bus.p.taps = '3'; bus.onParamChange();
  assert.equal(bus.getPosts().length, 3); assert.equal(bus.postCurrents.length, 3);
});
