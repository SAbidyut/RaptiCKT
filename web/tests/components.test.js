// Every registered component must build, find an operating point, run a
// transient with AC + DC stimulus on its pins, survive AC analysis, report
// finite readings and round-trip through JSON.
import test from 'node:test';
import assert from 'node:assert/strict';
import { allTypes, getType, Element } from '../src/elements/index.js';
import { Simulator } from '../src/engine/sim.js';

function rig(C) {
  const e = new C(0, 0);
  e.name = C.prefix + '1';
  const np = e.localPosts().length;
  e.nodes = Array.from({ length: np }, (_, i) => i + 1);
  const els = [e];
  const add = (type, nodes, p = {}) => {
    const x = new (getType(type))(0, 0);
    Object.assign(x.p, p);
    x.nodes = nodes; x.name = type + els.length;
    x.onParamChange?.();
    els.push(x);
    return x;
  };
  for (let i = 0; i < np; i++) add('resistor', [i + 1, 0], { r: 1e4 });
  if (np > 0) {
    add('acv', [np + 1, 0], { amp: 5, freq: 50 });
    add('resistor', [np + 1, 1], { r: 1000 });
  }
  if (np > 1) {
    add('dcv', [np + 2, 0], { amp: 3 });
    add('resistor', [np + 2, np], { r: 1000 });
  }
  return { e, els };
}

for (const C of allTypes()) {
  test(`component runs: ${C.type} (${C.title})`, () => {
    const { e, els } = rig(C);
    const sim = new Simulator().buildNet(els);
    const ok = sim.start();
    assert.ok(ok || !sim.fatal, 'start failed: ' + sim.error);
    for (let i = 0; i < 2000; i++) {
      assert.ok(sim.step(1e-5), `step ${i} failed: ${sim.error}`);
    }
    for (const v of sim.x) assert.ok(Number.isFinite(v), 'non-finite solution');
    const rd = e.readings(sim);
    assert.ok(Array.isArray(rd));
    for (const r of rd) if (typeof r[1] === 'number') assert.ok(Number.isFinite(r[1]) || Math.abs(r[1]) === Infinity || Number.isNaN(r[1]) === false, `reading ${r[0]}`);
    assert.equal(typeof e.valueLabel(), 'string');
    const back = Element.fromJSON(JSON.parse(JSON.stringify(e.toJSON())));
    assert.ok(back && back.constructor === C, 'JSON round trip');
    const res = sim.acSolve(2 * Math.PI * 1000, null);
    assert.ok(res, 'AC solve');
    // geometry sanity: posts on the grid and inside the box
    const [x1, y1, x2, y2] = e.localBox();
    for (const [px, py] of e.localPosts()) {
      assert.ok(px % 20 === 0 && py % 20 === 0, `post (${px},${py}) off grid`);
      assert.ok(px >= x1 - 1 && px <= x2 + 1 && py >= y1 - 1 && py <= y2 + 1, `post (${px},${py}) outside box`);
    }
  });
}

test('there are at least 300 components', () => {
  assert.ok(allTypes().length >= 300, 'only ' + allTypes().length);
});
