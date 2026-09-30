// Live AC readings: windowed RMS / average over one supply cycle, and the
// meters' Auto mode (RMS in AC circuits, average for DC quantities).
import test from 'node:test';
import assert from 'node:assert/strict';
import { getType } from '../src/elements/index.js';
import { Simulator } from '../src/engine/sim.js';
import { RmsTracker, acFrequency } from '../src/ui/rms.js';

function build(parts) {
  const els = parts.map(([type, nodes, p = {}], i) => {
    const e = new (getType(type))(0, 0);
    Object.assign(e.p, p); e.nodes = nodes; e.name = type + i; e.onParamChange?.();
    return e;
  });
  const sim = new Simulator().buildNet(els);
  sim.start();
  return { sim, els };
}

test('acFrequency finds the mains supply and ignores square waves', () => {
  const { els } = build([['mains', [1, 0]], ['resistor', [1, 0]]]);
  assert.equal(acFrequency(els), 50);
  const sq = build([['square', [1, 0]], ['resistor', [1, 0]]]);
  assert.equal(acFrequency(sq.els), 0);
});

test('230 V : 12-0-12 transformer reads 12 V RMS on each half', () => {
  const { sim, els } = build([
    ['mains', [1, 0]],
    ['xfmrct', [1, 0, 2, 3, 4]],
    ['resistor', [2, 3], { r: 1000 }],
    ['voltmeter', [2, 3]],
    ['resistor', [3, 0], { r: 1e9 }], // reference the isolated secondary
  ]);
  sim.acPeriod = 1 / 50;
  const tr = new RmsTracker(1 / 50, sim.nodeCount, [els[2]]);
  const dt = 2e-5;
  for (let k = 0; k < 0.1 / dt; k++) { const t0 = sim.t; assert.ok(sim.step(dt), sim.error); tr.sample(sim, sim.t - t0); }
  assert.ok(tr.ready);
  const vm = els[3];
  const auto = vm.display(vm.v);
  assert.ok(Math.abs(auto - 12) < 0.3, 'voltmeter auto ' + auto);
  assert.ok(vm.showsRms());
  const iR = tr.part(els[2]);
  assert.ok(iR.ac && Math.abs(iR.v - 0.012) < 0.0004, 'resistor current ' + JSON.stringify(iR));
  const prim = tr.node(1);
  assert.ok(prim.ac && Math.abs(prim.v - 230) < 3, 'primary ' + JSON.stringify(prim));
});

test('a smoothed DC node reads its average, not an AC value', () => {
  // DC 10 V with a small 1 V sine ripple on top
  const { sim } = build([['dcv', [1, 2], { amp: 10 }], ['acv', [2, 0], { amp: 1, freq: 50 }], ['resistor', [1, 0], { r: 100 }]]);
  const tr = new RmsTracker(1 / 50, sim.nodeCount, []);
  for (let k = 0; k < 2000; k++) { const t0 = sim.t; sim.step(2e-5); tr.sample(sim, sim.t - t0); }
  const r = tr.node(1);
  assert.equal(r.ac, false);
  assert.ok(Math.abs(r.v - 10) < 0.05, 'dc ' + r.v);
});
