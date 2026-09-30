// Wire auto-routing: clean orthogonal routes that respect parts and other wires.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CircuitDoc, makeElement } from '../src/ui/doc.js';
import { autoRoute, exitDir } from '../src/ui/autoroute.js';

const G = 20;
function doc(parts, wires = []) {
  const d = new CircuitDoc('t');
  for (const [type, x, y, rot = 0] of parts) { const e = makeElement(type, x * G, y * G); e.rot = rot; d.add(e); }
  for (const w of wires) d.addWire(w.map(([x, y]) => [x * G, y * G]));
  return d;
}
const segs = (pts) => pts.slice(1).map((q, i) => [pts[i], q]);
const hitsBox = (pts, [x1, y1, x2, y2]) => segs(pts).some(([p, q]) => {
  const n = Math.max(Math.abs(q[0] - p[0]), Math.abs(q[1] - p[1])) / 2;
  for (let s = 0; s <= n; s++) {
    const x = p[0] + (q[0] - p[0]) * s / n, y = p[1] + (q[1] - p[1]) * s / n;
    if (x > x1 + 0.5 && x < x2 - 0.5 && y > y1 + 0.5 && y < y2 - 0.5) return true;
  }
  return false;
});
const orthogonal = (pts) => segs(pts).every(([p, q]) => p[0] === q[0] || p[1] === q[1]);

test('exit direction follows the lead', () => {
  const d = doc([['resistor', 0, 0]]);
  const [p0, p1] = d.elements[0].getPosts();
  assert.equal(exitDir(d.elements[0], p0), 2); // left terminal leaves to the left
  assert.equal(exitDir(d.elements[0], p1), 0);
  const v = doc([['resistor', 0, 0, 1]]);
  const [q0, q1] = v.elements[0].getPosts();
  assert.equal(exitDir(v.elements[0], q0), 3); // top terminal leaves upwards
  assert.equal(exitDir(v.elements[0], q1), 1);
});

test('route between two parts never cuts through either body', () => {
  // resistor A at (0,0); voltmeter B below-right, vertical
  const d = doc([['resistor', 0, 0], ['voltmeter', 6, 6, 1]]);
  const [a0, a1] = d.elements[0].getPosts();
  const [b0, b1] = d.elements[1].getPosts();
  for (const [s, t] of [[a1, b0], [a0, b1], [a1, b1], [a0, b0]]) {
    const r = autoRoute(d, s, t);
    assert.ok(r, 'route found');
    assert.ok(orthogonal(r));
    assert.deepEqual(r[0], s); assert.deepEqual(r[r.length - 1], t);
    for (const e of d.elements) assert.ok(!hitsBox(r, e.worldBox()), 'crosses ' + e.name + ' ' + JSON.stringify(r));
  }
});

test('route does not run along or bend on another wire, nor touch other terminals', () => {
  const d = doc([['resistor', 0, 0], ['resistor', 0, 6], ['resistor', 10, 3, 1]], [[[-6, 3], [16, 3]]]);
  const a = d.elements[0].getPosts()[1], b = d.elements[1].getPosts()[1];
  const r = autoRoute(d, a, b);
  assert.ok(r);
  const other = d.wires[0].pts;
  for (const [p, q] of segs(r)) {
    const horizOnWire = p[1] === q[1] && p[1] === other[0][1];
    assert.ok(!horizOnWire, 'runs along the other wire');
  }
  for (const c of r.slice(1, -1)) assert.ok(c[1] !== 3 * G, 'bends on the other wire');
  const posts = d.elements.flatMap((e) => e.getPosts()).map((p) => p.join(','));
  for (const c of r.slice(1, -1)) assert.ok(!posts.includes(c.join(',')));
});
