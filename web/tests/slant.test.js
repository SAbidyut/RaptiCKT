// Slanted parts at any angle: terminals on grid points, the frame inverts, saved and opened
// again (also as the 45°-only version saved them), angles the grid allows, and the checks a
// straight slanting wire and a slanted part's outline are held to.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CircuitDoc, makeElement } from '../src/ui/doc.js';
import { Element, slantFor, slantAlong } from '../src/elements/index.js';
import { straightClear, partsHit, routeCost, wireContext } from '../src/ui/autoroute.js';
import { Simulator } from '../src/engine/sim.js';

const G = 20;
const onGrid = (ps) => ps.every(([x, y]) => x % G === 0 && y % G === 0);

test('slanted any way, a part keeps its terminals on grid points, its length the step given', () => {
  for (const type of ['resistor', 'capacitor', 'inductor', 'dcv', 'diode', 'lamp']) {
    for (const sv of [[4, 1], [3, 3], [5, 3], [-2, 1], [1, -4], [-3, -2], [6, 0], [0, -5], [2, 1]]) {
      const e = makeElement(type, 100, 60);
      e.setSlant(sv); e.snapPosts();
      const [a, b] = e.getPosts();
      assert.ok(onGrid([a, b]), `${type} ${sv}: terminals on grid points`);
      assert.deepEqual([(b[0] - a[0]) / G, (b[1] - a[1]) / G], sv, `${type} ${sv}: the step given`);
      // local ↔ world both ways, inside the body and out along the leads
      for (const [lx, ly] of [[0, 0], [10, 5], [-15, -8], [35, 3], [-39, -6]]) {
        const [x, y] = e.toLocal(...e.toWorld(lx, ly));
        assert.ok(Math.abs(x - lx) < 1e-9 && Math.abs(y - ly) < 1e-9, `${type} ${sv}: (${lx}, ${ly}) comes back`);
      }
      assert.ok(e.hitTest(...e.toWorld(0, 0)), 'its middle hits it');
    }
  }
});

test('a slant along a grid line at its usual length is no slant: just turned', () => {
  const e = makeElement('resistor', 0, 0);
  for (const [sv, rot] of [[[4, 0], 0], [[0, 4], 1], [[-4, 0], 2], [[0, -4], 3]]) {
    e.setSlant([1, 1]); e.setSlant(sv);
    assert.equal(e.sv, null); assert.equal(e.rot, rot);
  }
  const op = makeElement('opamp', 0, 0);
  assert.ok(!op.canSlant(), 'an op amp has no two terminals in line');
  assert.ok(!makeElement('ground', 0, 0).canSlant(), 'nor a ground');
});

test('saved slanted and opened again; a 45° slant saved by the older version opens 45°', () => {
  const e = makeElement('resistor', 40, 20);
  e.setSlant([5, 3]); e.snapPosts();
  const back = Element.fromJSON(JSON.parse(JSON.stringify(e.toJSON())));
  assert.deepEqual(back.sv, [5, 3]);
  assert.deepEqual(back.getPosts(), e.getPosts());
  for (const [r, step] of [[0, [4, 4]], [1, [-4, 4]], [2, [-4, -4]], [3, [4, -4]]]) {
    const o = Element.fromJSON({ t: 'resistor', x: 0, y: 0, r, s: 1 });
    assert.deepEqual(o.sv, step, `rot ${r}`);
    const [a, b] = o.getPosts();
    assert.ok(onGrid([a, b]) && a[0] + b[0] === 0 && a[1] + b[1] === 0, 'about the same middle');
  }
});

test('angles: the nearest the grid allows within a few degrees; a line\'s own grid points', () => {
  for (let d = -180; d < 180; d += 5) {
    const [P, Q] = slantFor((d * Math.PI) / 180, 4);
    let err = Math.abs((Math.atan2(Q, P) * 180) / Math.PI - d);
    err = Math.min(err, 360 - err);
    assert.ok(err <= 5.01, `${d}°: ${P},${Q} is ${err.toFixed(1)}° off`);
    const len = Math.hypot(P, Q);
    assert.ok(len >= 3.4 && len <= 7, `${d}°: about its usual length (${len.toFixed(2)})`);
  }
  assert.deepEqual(slantAlong(12, 6, 4), [4, 2]);
  assert.deepEqual(slantAlong(6, 6, 4), [3, 3]);
  assert.deepEqual(slantAlong(-6, 12, 4), [-2, 4]);
  assert.equal(slantAlong(13, 7, 4), null, 'no grid point near enough along it');
});

test('a slanted part in a circuit solves as when straight', () => {
  const build = (slant) => {
    const d = new CircuitDoc('t');
    const v = makeElement('dcv', 0, 0); v.rot = 1; v.p.amp = 10; d.add(v);
    const r = makeElement('resistor', 120, 0); r.p.r = 100; d.add(r);
    if (slant) { r.setSlant([3, 4]); r.snapPosts(); } else r.rot = 1;
    const [a, b] = r.getPosts(), [p, q] = v.getPosts();
    d.addWire([p, [p[0], p[1] - 40], [a[0], p[1] - 40], a]);
    d.addWire([q, [q[0], q[1] + 40], [b[0], q[1] + 40], b]);
    const g = makeElement('ground', q[0], q[1]); d.add(g);
    const sim = new Simulator().build(d.elements, d.wires);
    assert.ok(sim.start(), sim.error);
    for (let i = 0; i < 20; i++) assert.ok(sim.step(1e-4), sim.error);
    return Math.abs(r.i);
  };
  assert.ok(Math.abs(build(true) - 0.1) < 1e-9 && Math.abs(build(false) - 0.1) < 1e-9);
});

test('a straight slanting wire runs clear only past parts, terminals and other wires', () => {
  const d = new CircuitDoc('t');
  const r = makeElement('resistor', 200, 100); d.add(r); // level, from (160, 100) to (240, 100)
  assert.ok(straightClear(d, [0, 0], [100, 60]), 'open board');
  assert.ok(!straightClear(d, [180, 40], [220, 160]), 'across the resistor');
  assert.ok(!straightClear(d, [100, 40], [220, 160]), 'over its terminal (160, 100)');
  assert.ok(straightClear(d, [240, 100], [300, 40]), 'from its terminal, away from it');
  const w = d.addWire([[0, 200], [200, 300]]);
  assert.ok(!straightClear(d, [100, 250], [300, 350]), 'along another wire');
  assert.ok(straightClear(d, [0, 300], [200, 200]), 'across another wire (no joint)');
  assert.ok(straightClear(d, [100, 250], [300, 350], new Set([w])), 'the wire itself left out');
});

test('a slanted part takes room by its own turned outline, not its square box', () => {
  const a = makeElement('resistor', 0, 0), b = makeElement('resistor', 0, 0);
  a.setSlant([4, 4]); a.x = 0; a.y = 0;
  b.x = 60; b.y = -50; // beside it, inside its square box, clear of the part
  const [x1, y1, x2, y2] = a.worldBox(), [p1, q1, p2, q2] = b.worldBox();
  assert.ok(x1 < p2 && p1 < x2 && y1 < q2 && q1 < y2, 'the square boxes overlap');
  assert.ok(!partsHit(a, b), '…the parts do not');
  b.x = 10; b.y = 10;
  assert.ok(partsHit(a, b), 'on top of it, they do');
  // a wire running on in line with its lead, past its square box's corner, costs nothing
  const d = new CircuitDoc('t'); d.add(a);
  const [p] = a.getPosts();
  assert.equal(routeCost(wireContext(d), [p, [p[0] - 60, p[1] - 60]]), 0);
});
