// AC circuits in the phasor domain, checked against Alexander & Sadiku's worked examples
// (Fundamentals of Electric Circuits, ch. 10 and 13): every method reaches the book's answer.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CircuitDoc, makeElement } from '../src/ui/doc.js';
import { prepareAC, runACTheorem } from '../src/engine/theorem-ac.js';
import { Simulator } from '../src/engine/sim.js';
import { parsePhasor, fmtPhasor, fmtRect, fmtTime, C } from '../src/engine/phasor.js';

const G = 20;
function board(spec) {
  const d = new CircuitDoc(spec.name);
  const pt = (n) => spec.pts[n].map((v) => v * 4 * G);
  for (const [type, from, to, props = {}] of spec.parts) {
    const P = pt(from);
    if (to == null) { const e = makeElement(type, P[0], P[1]); Object.assign(e.p, props); e.onParamChange?.(); d.elements.push(e); continue; }
    const Q = pt(to);
    const hor = P[1] === Q[1];
    const mx = (P[0] + Q[0]) / 2, my = (P[1] + Q[1]) / 2;
    const e = makeElement(type, mx, my);
    e.rot = hor ? (P[0] < Q[0] ? 0 : 2) : (P[1] < Q[1] ? 1 : 3);
    Object.assign(e.p, props); e.onParamChange?.();
    d.elements.push(e);
    const [p0, p1] = e.getPosts();
    if (p0[0] !== P[0] || p0[1] !== P[1]) d.addWire([P, p0]);
    if (p1[0] !== Q[0] || p1[1] !== Q[1]) d.addWire([p1, Q]);
  }
  for (const [a, b] of spec.wires || []) d.addWire([pt(a), pt(b)]);
  d.assignNames();
  return d;
}
const BOOK = {
  // Example 10.1 (Fig. 10.1): ix = 7.59∠108.4° A in the 0.1 F capacitor; V1 = 18.97∠18.43° V
  ex101: { name: 'Example 10.1', pts: { s: [0, 0], A: [1, 0], B: [2, 0], C: [3, 0], D: [4, 0], z0: [0, 1], z1: [1, 1], z2: [2, 1], z3: [3, 1], z4: [4, 1] },
    parts: [['acv', 's', 'z0', { wave: 'cos', amp: 20, freq: 4 / (2 * Math.PI) }], ['resistor', 's', 'A', { r: 10 }], ['capacitor', 'A', 'z1', { c: 0.1 }], ['inductor', 'A', 'C', { l: 1 }],
      ['depsrc', 'z3', 'C', { kind: 'cccs', gain: 2, ctrl: 'i:C1', sym: 'ix' }], ['inductor', 'D', 'z4', { l: 0.5 }], ['ground', 'z2']],
    wires: [['z0', 'z4'], ['C', 'D']], target: 'C1', expect: { I: [7.59, 108.4] } },
  // Example 10.3 (Fig. 10.7): I2 = 6.12∠35.22° A (Io = −I2) in the 4 Ω
  ex103: { name: 'Example 10.3', pts: { a: [0, 0], b: [1, 0], c: [2, 0], d: [0, 1], e: [1, 1], f: [0, 2], g: [1, 2], h: [2, 2] },
    parts: [['aci', 'd', 'a', { wave: 'cos', amp: 5, freq: 1 / (2 * Math.PI) }], ['inductor', 'd', 'e', { l: 10 }], ['capacitor', 'b', 'e', { c: 0.5 }], ['resistor', 'd', 'f', { r: 8 }], ['capacitor', 'e', 'g', { c: 0.5 }],
      ['resistor', 'b', 'c', { r: 4 }], ['acv', 'c', 'h', { wave: 'cos', amp: 20, phase: 90, freq: 1 / (2 * Math.PI) }]],
    wires: [['a', 'b'], ['f', 'g'], ['g', 'h']], target: 'R2', expect: { I: [6.12, -35.22] } },
  // Example 10.8 (Fig. 10.22): Z_th = 6.48 − j2.64 Ω, V_th = 37.95∠220.31° V (load between e and c)
  ex108: { name: 'Example 10.8', pts: { d: [1, 0], dd: [3, 0], s0: [0, 0], e: [1, 1], c: [3, 1], f: [1, 2], ff: [3, 2], s1: [0, 2] },
    parts: [['acv', 's0', 's1', { wave: 'cos', amp: 120, phase: 75, freq: 1 / (2 * Math.PI) }], ['capacitor', 'd', 'e', { c: 1 / 6 }], ['resistor', 'e', 'f', { r: 8 }], ['resistor', 'dd', 'c', { r: 4 }], ['inductor', 'c', 'ff', { l: 12 }],
      ['resistor', 'e', 'c', { r: 1000 }]],
    wires: [['s0', 'd'], ['d', 'dd'], ['s1', 'f'], ['f', 'ff']], target: 'R3', expect: { Zth: [6.48, -2.64], Vth: [37.95, 220.31] } },
  // Example 13.2 (Fig. 13.11): I1 = 20.3∠3.5° A, I2 = 8.693∠19° A (in the 5 Ω)
  ex132: { name: 'Example 13.2', pts: { s: [0, 0], A: [1, 0], B: [2, 0], C: [3, 0], z0: [0, 1], z2: [2, 1], z3: [3, 1], m: [2, 0] },
    parts: [['acv', 's', 'z0', { wave: 'cos', amp: 100, freq: 1 / (2 * Math.PI) }], ['resistor', 's', 'A', { r: 4 }], ['capacitor', 'A', 'B', { c: 1 / 3 }], ['inductor', 'B', 'z2', { l: 6, dot: 'a' }],
      ['inductor', 'B', 'C', { l: 8, dot: 'b' }], ['resistor', 'C', 'z3', { r: 5 }], ['mutual', 'm', null, { m: 2 }]],
    wires: [['z0', 'z3']], target: 'R2', expect: { I: [8.693, 19.03] } },
};

const deg = (z) => (Math.atan2(z[1], z[0]) * 180) / Math.PI;
const near = (z, [m, a], what) => {
  assert.ok(Math.abs(Math.hypot(...z) - m) < 0.01 * m + 0.01, `${what}: magnitude ${Math.hypot(...z)} ≠ ${m}`);
  assert.ok(Math.abs((((deg(z) - a) % 360) + 540) % 360 - 180) < 0.2, `${what}: angle ${deg(z)} ≠ ${a}`);
};
const solve = (k, th) => {
  const spec = BOOK[k], prep = prepareAC(board(spec));
  assert.deepEqual(prep.bad, []);
  const T = prep.targets.find((t) => t.name === spec.target);
  return runACTheorem(prep, th, T.src, 'I');
};

for (const [k, th] of [['ex101', 'nodal'], ['ex101', 'thevenin'], ['ex101', 'norton'], ['ex103', 'nodal'], ['ex103', 'mesh'], ['ex103', 'superposition'], ['ex103', 'thevenin'], ['ex108', 'nodal'], ['ex108', 'mesh'], ['ex132', 'mesh'], ['ex132', 'thevenin'], ['ex132', 'norton']]) {
  test(`${BOOK[k].name}: ${th} gives the book's answer`, () => {
    const r = solve(k, th);
    assert.ok(r.ok, r.error);
    if (BOOK[k].expect.I) near(r.answer.I, BOOK[k].expect.I, 'I');
    const d = r.check[0].I;
    assert.ok(Math.hypot(r.answer.I[0] - d[0], r.answer.I[1] - d[1]) < 1e-6 * Math.max(1, Math.hypot(...d)), 'agrees with the direct solution');
    assert.ok(r.steps.length >= 3 && (th === 'superposition' || /phasor domain/.test(r.steps[0].title)));
  });
}

test('Example 10.8: Thevenin finds Z_th = 6.48 − j2.64 Ω and V_th = 37.95∠220.31° V', () => {
  const r = solve('ex108', 'thevenin');
  assert.equal(r.steps[1].result[0][1], '6.48 − j2.64 Ω');
  assert.match(r.steps[2].result[0][1], /^37\.95∠−139\.7° V$/);
});

test('Example 13.2: the mesh equations are the book’s, with ±jωM', () => {
  const r = solve('ex132', 'mesh');
  const txt = JSON.stringify(r.steps[1].blocks);
  assert.match(txt, /\(4 \+ j3\)I_\{1\} − j8I_\{2\} = 100/);
  assert.match(txt, /−j8I_\{1\} \+ \(5 \+ j18\)I_\{2\} = 0/);
  assert.match(txt, /Δ = 30 \+ j87/);
});

test('Example 10.1: nodal analysis names the nodes V1, V2 as the book does', () => {
  const r = solve('ex101', 'nodal');
  const txt = JSON.stringify(r.steps);
  assert.match(txt, /V_\{1\} = .*18\.97∠18\.43° V/);
  assert.match(txt, /V_\{2\} = .*13\.91∠−161\.57° V/);
});

test('nodal analysis with coupled coils points to mesh analysis; one source refuses superposition', () => {
  assert.match(solve('ex132', 'nodal').error, /mesh analysis/);
  assert.match(solve('ex101', 'superposition').error, /two or more/);
});

test('sources at different frequencies: superposition adds the time functions', () => {
  const d = board({ name: 'two frequencies', pts: { s: [0, 0], A: [1, 0], B: [2, 0], z0: [0, 1], z1: [1, 1], z2: [2, 1] },
    parts: [['acv', 's', 'z0', { wave: 'cos', amp: 10, freq: 2 / (2 * Math.PI) }], ['resistor', 's', 'A', { r: 2 }], ['inductor', 'A', 'z1', { l: 1 }], ['resistor', 'A', 'B', { r: 2 }], ['dcv', 'B', 'z2', { amp: 5 }]],
    wires: [['z0', 'z2']], target: 'R1' });
  const prep = prepareAC(d), T = prep.targets.find((t) => t.name === 'R1');
  assert.match(runACTheorem(prep, 'thevenin', T.src).error, /different frequencies/);
  const r = runACTheorem(prep, 'superposition', T.src);
  assert.ok(r.ok, r.error);
  assert.match(r.head.main, /cos\(2t/);
  assert.equal(r.steps.length, 4);
});

test('the phasor solve of the simulator agrees with the transient (Example 13.2)', () => {
  const doc = board(BOOK.ex132);
  const sim = new Simulator().build(doc.elements, doc.wires);
  sim.start();
  const R2 = doc.elements.find((e) => e.name === 'R2');
  near(sim.phasorSolve(1).current(R2), [8.693, 19.03], 'phasor');
  let peak = 0;
  for (let i = 0; i < 50000; i++) { sim.step(2e-3); if (sim.t > 80) peak = Math.max(peak, Math.abs(R2.i)); }
  assert.ok(Math.abs(peak - 8.693) < 0.02, `transient peak ${peak}`);
});

test('phasors are typed and printed the book’s way', () => {
  near(parsePhasor('10∠30'), [10, 30], '10∠30');
  near(parsePhasor('10<-45°'), [10, -45], '10<-45');
  assert.deepEqual(parsePhasor('4 - j3'), [4, -3]);
  assert.deepEqual(parsePhasor('-j2.5'), [0, -2.5]);
  assert.deepEqual(parsePhasor('j8'), [0, 8]);
  assert.equal(fmtRect([4, -3], 'Ω'), '4 − j3 Ω');
  assert.equal(fmtRect([0, -2.5]), '−j2.5');
  assert.equal(fmtPhasor(C.polar(20.3, 3.5), 'A'), '20.3∠3.5° A');
  assert.equal(fmtTime(C.polar(7.59, 108.4), 4, 'A'), '7.59 cos(4t + 108.4°) A');
});
