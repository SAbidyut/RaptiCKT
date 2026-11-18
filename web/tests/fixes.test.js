// Regressions: each of these gave a wrong answer, a crash or a runaway before it was fixed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { net, run } from './netlib.js';
import { getType, Element } from '../src/elements/index.js';
import { Simulator } from '../src/engine/sim.js';
import { parseSI } from '../src/engine/units.js';
import { CircuitDoc, makeElement, simplify } from '../src/ui/doc.js';
import { RmsTracker } from '../src/ui/rms.js';
import { solveLoadFlow } from '../src/engine/loadflow.js';
import { loadCase } from '../src/engine/loadflow-cases.js';
import { prepareAC, runACTheorem } from '../src/engine/theorem-ac.js';
import { C } from '../src/engine/phasor.js';

const near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b} (±${tol})`);

// ------------------------------------------------------------------ numbers
test('a decimal comma after a leading zero is not a thousands separator', () => {
  near(parseSI('0,123'), 0.123, 1e-12, '0,123');
  near(parseSI('-0,250'), -0.25, 1e-12, '-0,250');
  assert.equal(parseSI('1,000'), 1000);
  assert.equal(parseSI('12,500,000'), 12.5e6);
});

// ---------------------------------------------------------------- documents
test('a wire that doubles back keeps the stretch beyond the turn', () => {
  assert.deepEqual(simplify([[0, 0], [100, 0], [40, 0]]), [[0, 0], [100, 0], [40, 0]]);
  assert.deepEqual(simplify([[0, 0], [50, 0], [100, 0]]), [[0, 0], [100, 0]]); // a point on a straight run still goes
});

test('a damaged circuit file is read as far as it goes', () => {
  assert.equal(CircuitDoc.fromJSON(null).elements.length, 0);
  const d = CircuitDoc.fromJSON({ elements: [{ t: 'resistor', x: 0, y: 0 }], wires: [[null, [0, 0]], { p: [null, null] }, [['a', 'b'], ['c', 'd']], [[0, 0], [40, 0]]], om: 1e999 });
  assert.equal(d.wires.length, 1);
  assert.equal(d.omega, 0);
});

test('a probe stays on its part when an earlier part of the file is left out', () => {
  const src = new CircuitDoc('p');
  for (const [t, x] of [['resistor', 0], ['resistor', 200], ['capacitor', 400]]) src.add(makeElement(t, x, 0));
  src.assignNames();
  src.probes.push({ id: 'p1', kind: 'cur', el: src.elements[1].id, color: '#facc15', label: 'I(R2)' });
  const o = JSON.parse(JSON.stringify(src.toJSON()));
  o.elements[0] = null; // (a part of a kind this version does not know)
  const d = CircuitDoc.fromJSON(o);
  const on = d.elements.find((e) => e.id === d.probes[0].el);
  assert.equal(on.constructor.type, 'resistor');
});

test('text, NaN and absurd values in a file do not reach the solver', () => {
  const r = Element.fromJSON({ t: 'resistor', x: 0, y: 0, p: { r: 'abc' } });
  assert.equal(r.p.r, getType('resistor').props.find((p) => p.key === 'r').def);
  const u = Element.fromJSON({ t: 'rfid', x: 0, y: 0, p: { baud: 1e12 } });
  assert.ok(u.p.baud <= 115200);
  const f = Element.fromJSON({ t: 'floatsw', x: 0, y: 0, p: { hyst: 60 } }); // a little outside its range: kept (an example uses it)
  assert.equal(f.p.hyst, 60);
});

test('a saved circuit does not share its points or settings with the open one', () => {
  const d = new CircuitDoc('s');
  const w = d.addWire([[0, 0], [40, 0]]);
  d.simSettings.speed = 0.5;
  const o = d.toJSON();
  w.pts[1][0] = 80; d.simSettings.speed = 2;
  assert.equal(o.wires[0][1][0], 40);
  assert.equal(o.sim.speed, 0.5);
});

test('posts() follows a part that was moved after the circuit was built', () => {
  const d = new CircuitDoc('m');
  const e = d.add(makeElement('resistor', 0, 0));
  new Simulator().build(d.elements, d.wires);
  assert.equal(e.posts(), e._posts); // as built: the solver's own list
  e.x += 100;
  assert.deepEqual(e.posts(), e.getPosts());
});

// ---------------------------------------------------------------- simulator
test('a step that works clears the error of one that failed', () => {
  const { sim } = net([['dcv', [1, 0], { amp: 5 }], ['resistor', [1, 0], { r: 100 }]]);
  assert.ok(sim.start());
  sim.error = 'Simulation failed to converge. Try a smaller timestep.'; sim.errorElement = {}; // (left by a step that failed)
  assert.ok(sim.step(1e-5));
  assert.equal(sim.error, null);
  assert.equal(sim.errorElement, null);
});

test('a phasor current of a part with both ends on ground is not looked for for ever', () => {
  const { sim, els } = net([['acv', [1, 0]], ['resistor', [1, 0]], ['resistor', [0, 0]]]);
  sim.start();
  const z = sim.phasorSolve(2 * Math.PI * 50).current(els[2]);
  assert.ok(Number.isNaN(z[0]));
});

test('an AC sweep with no range ends at once', () => {
  const { sim, els } = net([['acv', [1, 0]], ['resistor', [1, 2]], ['resistor', [2, 0]]]);
  sim.start();
  assert.deepEqual(sim.acSweep(els[0], 2, 0, 0, 1000), []);
});

test('RMS window fills although a period is more steps than it holds', () => {
  const tr = new RmsTracker(0.02, 3, []);
  const sim = { nodeVoltage: () => 1 };
  for (let k = 0; k < 90000; k++) tr.sample(sim, 2.5e-7);
  assert.ok(tr.ready);
  near(tr.node(1).v, 1, 1e-6, 'steady 1 V');
});

// --------------------------------------------------------------- components
test('LM358 follower on a single 5 V supply follows its input', () => {
  const PRE = getType('opamp').props.find((p) => p.key === 'model').preset;
  for (const [model, vin] of [['LM358', 2.5], ['LM358', 4], ['LM324', 4], ['Rail-to-rail 5V', 4]]) {
    const { sim } = net([['dcv', [1, 0], { amp: vin }], ['resistor', [1, 2], { r: 100 }], ['opamp', [3, 2, 3], { ...PRE[model], model }], ['resistor', [3, 0], { r: 10000 }]]);
    assert.ok(sim.start());
    assert.equal(sim.opFallback, false, `${model}: operating point found`);
    near(sim.v(3), vin, 0.01, `${model} at t = 0`);
    run(sim, 2e-3, 2e-6);
    near(sim.v(3), vin, 0.01, `${model} after 2 ms`);
  }
});

test('a gas discharge tube drops its arc voltage (and does not deliver power)', () => {
  const { sim, els } = net([['dcv', [1, 0], { amp: 100 }], ['resistor', [1, 2], { r: 10 }], ['gdt', [2, 0], { vspark: 90, varc: 15 }]]);
  sim.start();
  run(sim, 4e-3, 2e-6);
  near(sim.v(2), 22.73, 0.05, 'tube voltage');
  near(els[2].i, 7.727, 0.02, 'tube current');
});

test('a tunnel diode biased past its peak is solved', () => {
  const { sim } = net([['dcv', [1, 0], { amp: 12 }], ['resistor', [1, 2], { r: 1000 }], ['tunnel', [2, 0]]]);
  assert.ok(sim.start());
  run(sim, 1e-3, 1e-5);
  near(sim.v(2), 0.523, 0.01, 'diode voltage');
});

test('a JFET whose drain steps below its source keeps running', () => {
  const { sim } = net([['square', [1, 0], { amp: 5, freq: 370 }], ['resistor', [1, 2], { r: 100 }], ['njfet', [4, 2, 3]], ['resistor', [3, 5], { r: 1000 }],
    ['dcv', [5, 0], { amp: 5 }], ['square', [6, 0], { amp: 5, freq: 1000 }], ['resistor', [6, 4], { r: 100 }]]);
  sim.start();
  run(sim, 8e-3, 2e-6);
  assert.equal(sim.fatal, false);
});

test('an opto-TRIAC fired with the mains across it conducts', () => {
  const { sim, els } = net([['acv', [1, 0], { amp: 325, freq: 50 }], ['resistor', [1, 2], { r: 100 }], ['optotriac', [3, 0, 2, 0]], ['dcv', [4, 0], { amp: 5 }], ['resistor', [4, 3], { r: 220 }]]);
  sim.start();
  run(sim, 6e-3, 2e-5);
  assert.ok(Math.abs(els[2].postCurrents[2]) < 5, 'load current is the load\'s, not 10¹⁵ A');
  assert.ok(Math.abs(sim.v(2)) < 10, 'on-state voltage');
});

test('LED panels and emergency lights in series stay at the supply voltage', () => {
  for (const t of ['ledpanel', 'emerg']) {
    const { sim, els } = net([['acv', [1, 0], { amp: 325, freq: 50 }], ['resistor', [1, 2], { r: 0.2 }], [t, [2, 3]], [t, [3, 0]]]);
    sim.start();
    let vmax = 0;
    run(sim, 0.1, 2e-5, (s) => { vmax = Math.max(vmax, Math.abs(s.v(3))); });
    assert.ok(vmax < 330, `${t}: ${vmax} V`);
    assert.ok(!els[2].damaged && !els[3].damaged, t);
  }
});

test('stepper and BLDC motors with heavy friction slow down instead of diverging', () => {
  for (const t of ['stepper', 'bldc']) {
    const C2 = getType(t), e0 = new C2(0, 0), n = e0.localPosts().length;
    const { sim, els } = net([['dcv', [1, 0], { amp: 12 }], [t, Array.from({ length: n }, (_, k) => (k === 0 ? 1 : k === 1 ? 0 : k + 1)), { b: 10 }]]);
    sim.start();
    for (let k = 0; k < 2000 && !sim.fatal; k++) sim.step(1e-5);
    assert.ok(Math.abs(els[1].wm || 0) < 1e3, `${t}: ${els[1].wm} rad/s`);
  }
});

test('a rocker switch\'s terminal currents add up', () => {
  const { sim, els } = net([['dcv', [1, 0], { amp: 100 }], ['rockersw', [1, 2, 0], { on: true, rlamp: 1000 }], ['resistor', [2, 0], { r: 1000 }]]);
  sim.start();
  run(sim, 1e-3, 1e-5);
  const pc = els[1].postCurrents;
  near(pc[0] + pc[1] + pc[2], 0, 1e-6, 'sum');
  near(pc[2], -0.1, 1e-3, 'lamp current leaves at N');
});

// ---------------------------------------------------------------- load flow
test('DC load flow: a phase shifter and a tap give balanced flows', () => {
  const sys = loadCase('blank');
  sys.buses[1].Pd = 50; sys.buses[1].Qd = 0;
  Object.assign(sys.branches[0], { R: 0, B: 0, shift: 5 });
  const dc = solveLoadFlow(sys, { method: 'dc' }), nr = solveLoadFlow(sys, { method: 'nr' });
  near(dc.branches[0].Pf, nr.branches[0].Pf, 0.5, 'flow through the phase shifter');
  Object.assign(sys.branches[0], { shift: 0, tap: 0.9 });
  near(solveLoadFlow(sys, { method: 'dc' }).branches[0].Pf, 50, 0.01, 'flow through the tapped branch');
  assert.equal(solveLoadFlow({ baseMVA: 100, buses: sys.buses }).ok !== undefined, true); // (no branch list: no throw)
});

// ------------------------------------------------------------- AC theorems
const G = 20;
function board(spec) {
  const d = new CircuitDoc(spec.name);
  const pt = (n) => spec.pts[n].map((v) => v * 4 * G);
  for (const [type, from, to, props = {}] of spec.parts) {
    const P = pt(from);
    if (to == null) { const e = makeElement(type, P[0], P[1]); Object.assign(e.p, props); e.onParamChange?.(); d.elements.push(e); continue; }
    const Q = pt(to), hor = P[1] === Q[1];
    const e = makeElement(type, (P[0] + Q[0]) / 2, (P[1] + Q[1]) / 2);
    e.rot = hor ? (P[0] < Q[0] ? 0 : 2) : (P[1] < Q[1] ? 1 : 3);
    Object.assign(e.p, props); e.onParamChange?.(); d.elements.push(e);
    const [p0, p1] = e.getPosts();
    if (p0[0] !== P[0] || p0[1] !== P[1]) d.addWire([P, p0]);
    if (p1[0] !== Q[0] || p1[1] !== Q[1]) d.addWire([p1, Q]);
  }
  for (const [a, b] of spec.wires || []) d.addWire([pt(a), pt(b)]);
  d.assignNames();
  return d;
}
const answer = (d, method, name) => runACTheorem(prepareAC(d), method, d.elements.findIndex((e) => e.name === name));

test('mesh analysis with a dependent voltage source agrees with the direct solution', () => {
  const pts = { a: [0, 0], b: [1, 0], c: [2, 0], z0: [0, 1], z2: [2, 1] };
  for (const [kind, gain, ctrl] of [['vcvs', 0.5, 'v:R1'], ['ccvs', 3, 'i:R1']]) for (const [p, q] of [['c', 'z2'], ['z2', 'c']]) {
    const d = board({ pts, parts: [['acv', 'a', 'z0', { wave: 'cos', amp: 20, freq: 2 / (2 * Math.PI) }], ['resistor', 'a', 'b', { r: 4 }], ['depsrc', p, q, { kind, gain, ctrl }], ['ground', 'z0']], wires: [['b', 'c'], ['z0', 'z2']] });
    const r = answer(d, 'mesh', 'R1');
    assert.ok(r.ok, `${kind}: ${r.error || ''}`);
    near(C.abs(C.sub(r.answer.I, r.check[0].I)), 0, 1e-6, `${kind} (+ at ${p})`);
  }
});

test('Thevenin says so when only a current source feeds the load', () => {
  const d = board({ pts: { a: [0, 0], b: [1, 0], z0: [0, 1], z1: [1, 1] }, parts: [['aci', 'z0', 'a', { wave: 'cos', amp: 10, freq: 1 / (2 * Math.PI) }], ['resistor', 'b', 'z1', { r: 5 }], ['ground', 'z0']], wires: [['a', 'b'], ['z0', 'z1']] });
  const th = answer(d, 'thevenin', 'R1');
  assert.equal(th.ok, false);
  const no = answer(d, 'norton', 'R1');
  assert.ok(no.ok, no.error || '');
  near(C.abs(no.answer.I), 10, 1e-6, 'Norton: all of the source current');
});
