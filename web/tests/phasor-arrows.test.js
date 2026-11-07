// The live phasor readings of a series R–L loop (100∠20° V, j40 Ω, 30 Ω): the current is
// I = V/Z = 100∠20° / (30 + j40) = 2∠−33.13° A out of the + terminal. Every current label
// must read 2∠−33.1° A with its arrow the way it flows (not 2∠146.9° A pointing backwards).
import test from 'node:test';
import assert from 'node:assert/strict';
import { CircuitDoc, makeElement } from '../src/ui/doc.js';
import { Simulator } from '../src/engine/sim.js';
import { C } from '../src/engine/phasor.js';
import { refAngle, orientCurrent, phasorReadings, docOmega } from '../src/ui/phasor-view.js';

const G = 20;
function loop() {
  const d = new CircuitDoc('R-L loop');
  d.domain = 'phasor';
  const pts = { s0: [0, 0], s1: [1, 0], A: [2, 0], B: [2, 1], z: [0, 1] };
  const pt = (n) => pts[n].map((v) => v * 4 * G);
  const add = (type, from, to, props) => {
    const P = pt(from), Q = pt(to), hor = P[1] === Q[1];
    const e = makeElement(type, (P[0] + Q[0]) / 2, (P[1] + Q[1]) / 2);
    e.rot = hor ? (P[0] < Q[0] ? 0 : 2) : (P[1] < Q[1] ? 1 : 3);
    Object.assign(e.p, props); e.onParamChange?.();
    d.elements.push(e);
    const [p0, p1] = e.getPosts();
    if (p0[0] !== P[0] || p0[1] !== P[1]) d.addWire([P, p0]);
    if (p1[0] !== Q[0] || p1[1] !== Q[1]) d.addWire([p1, Q]);
    return e;
  };
  const w = 1;
  const V = add('acv', 's0', 's1', { wave: 'cos', amp: 100, phase: 20, freq: w / (2 * Math.PI) });
  const L = add('inductor', 's1', 'A', { l: 40 });
  const R = add('resistor', 'A', 'B', { r: 30 });
  d.addWire([pt('B'), pt('z')]); d.addWire([pt('z'), pt('s0')]);
  d.assignNames();
  return { d, V, L, R };
}
const deg = (z) => (Math.atan2(z[1], z[0]) * 180) / Math.PI;

test('series R–L: every current label reads 2∠−33.1° A, the arrows round the loop out of +', () => {
  const { d, V, L, R } = loop();
  const sim = new Simulator().build(d.elements, d.wires);
  sim.start();
  const sol = sim.phasorSolve(docOmega(d));
  const ref = refAngle(d, sol.omega);
  assert.ok(Math.abs(ref - 20) < 1e-9, 'read against the source phase');
  for (const e of [V, L, R]) {
    const o = orientCurrent(sol.current(e), ref);
    assert.ok(Math.abs(C.abs(o.z) - 2) < 1e-6, `${e.name}: |I| = 2 A`);
    assert.ok(Math.abs(deg(o.z) + 33.13) < 0.01, `${e.name}: ∠${deg(o.z)}, not −33.13°`);
  }
  // the source's arrow points out of + (its terminal 1): against terminal 1 → 2
  assert.equal(orientCurrent(sol.current(V), ref).flip, true);
  const rows = Object.fromEntries(phasorReadings(V, sol));
  assert.equal(rows['I (phasor, out of +)'], '2∠−33.13° A');
  assert.equal(rows['S delivered = ½VI*'], '60 + j80 VA');
});
