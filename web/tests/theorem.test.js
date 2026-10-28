// Network theorems: every theorem must reach the same load current as a direct solution,
// with the textbook values of Rth, Vth, IN on circuits worked by hand.
import test from 'node:test';
import assert from 'node:assert/strict';
import { runTheorem, prepareTheorem, extractNetwork, spTree } from '../src/engine/theorem.js';
import { getType } from '../src/elements/index.js';
import { CircuitDoc } from '../src/ui/doc.js';

// a network written as [name, kind, n0, n1, value]; kind R, V (+ at n0), I (flows n0 → n1)
function net(list, nodeCount = 10) {
  const elems = list.map(([name, kind, a, b, val], i) => ({ id: i, kind, n: [a, b], val, name, src: i }));
  return { net: { elems, nodeCount, hasGround: true, nodePos: new Map(), notes: [], bad: [], posts: [] } };
}
const src = (prep, name) => prep.net.elems.find((e) => e.name === name).src;
const close = (x, y, what) => assert.ok(Math.abs(x - y) <= 1e-9 * Math.max(1, Math.abs(y)), `${what}: ${x} ≠ ${y}`);
const ALL = ['thevenin', 'norton', 'superposition', 'source'];

// 12 V, R1 4 Ω to node 2, R2 6 Ω to ground, R3 3 Ω to the load RL 5 Ω
const ladder = () => net([['V1', 'V', 1, 0, 12], ['R1', 'R', 1, 2, 4], ['R2', 'R', 2, 0, 6], ['R3', 'R', 2, 3, 3], ['RL', 'R', 3, 0, 5]]);

test('ladder: Thevenin values worked by hand', () => {
  const p = ladder();
  const r = runTheorem(p, 'thevenin', src(p, 'RL'));
  assert.ok(r.ok, r.error);
  close(r.Rth, 5.4, 'Rth');
  close(r.Vth, 7.2, 'Vth');
  close(r.answer.I, 7.2 / 10.4, 'IL');
  close(r.answer.V, (7.2 / 10.4) * 5, 'VL');
});

test('ladder: Norton values worked by hand', () => {
  const p = ladder();
  const r = runTheorem(p, 'norton', src(p, 'RL'));
  assert.ok(r.ok, r.error);
  close(r.Rn, 5.4, 'RN');
  close(r.In, 7.2 / 5.4, 'IN');
  close(r.answer.I, 7.2 / 10.4, 'IL');
});

test('ladder: source transformation reaches the end and agrees', () => {
  const p = ladder();
  const r = runTheorem(p, 'source', src(p, 'RL'));
  assert.ok(r.ok, r.error);
  assert.ok(!r.stuck, 'stuck: ' + r.steps.map((s) => s.title).join(' / '));
  close(r.answer.I, 7.2 / 10.4, 'IL');
  assert.ok(r.steps.some((s) => /current source/.test(s.title)), 'has a V → I transformation');
  assert.ok(r.steps.some((s) => /voltage source/.test(s.title)), 'has an I → V transformation');
});

test('superposition: two sources add up', () => {
  // V1 12 V through R1 6 Ω into a; I1 2 A pushed into a; RL 3 Ω from a to ground
  const p = net([['V1', 'V', 1, 0, 12], ['R1', 'R', 1, 2, 6], ['I1', 'I', 0, 2, 2], ['RL', 'R', 2, 0, 3]]);
  const r = runTheorem(p, 'superposition', src(p, 'RL'));
  assert.ok(r.ok, r.error);
  close(r.answer.I, 12 / 9 + (2 * 6) / 9, 'IL');
  assert.equal(r.steps.filter((s) => /Only/.test(s.title)).length, 2);
});

test('every theorem agrees with the direct solution on assorted circuits', () => {
  const circuits = [
    ladder(),
    // two voltage sources and a bridge-like middle
    net([['V1', 'V', 1, 0, 10], ['R1', 'R', 1, 2, 2], ['R2', 'R', 2, 0, 4], ['R3', 'R', 2, 3, 6], ['V2', 'V', 4, 0, 5], ['R4', 'R', 4, 3, 3], ['RL', 'R', 3, 0, 8]]),
    // current source with a series resistor (drops out) and a resistor across a voltage source
    net([['I1', 'I', 0, 1, 0.5], ['R5', 'R', 1, 2, 100], ['R1', 'R', 2, 0, 20], ['R2', 'R', 2, 3, 10], ['V1', 'V', 4, 0, 6], ['R6', 'R', 4, 0, 50], ['R3', 'R', 4, 3, 30], ['RL', 'R', 3, 0, 15]]),
    // load floating between two inner nodes (no end on ground)
    net([['V1', 'V', 1, 0, 9], ['R1', 'R', 1, 2, 1000], ['R2', 'R', 2, 0, 2000], ['R3', 'R', 1, 3, 3000], ['R4', 'R', 3, 0, 1500], ['RL', 'R', 2, 3, 4700]]),
    // a negative source and a current source the other way
    net([['V1', 'V', 0, 1, 5], ['R1', 'R', 1, 2, 10], ['I1', 'I', 2, 0, 0.2], ['R2', 'R', 2, 0, 40], ['RL', 'R', 2, 0, 20]]),
  ];
  for (const p of circuits) for (const th of ALL) {
    const r = runTheorem(p, th, src(p, 'RL'));
    assert.ok(r.ok, `${th}: ${r.error}`);
    close(r.answer.I, r.full.I, `${th} IL`);
    close(r.answer.V, r.full.V, `${th} VL`);
    assert.ok(r.answer.I >= -1e-12, `${th}: a is the higher end, so IL ≥ 0`);
    for (const s of r.steps) for (const b of s.blocks) for (const l of b.lines || [b.text]) assert.doesNotMatch(String(l), /NaN|undefined/, `${th}: ${l}`);
  }
});

test('bridge: Rth by a test current, superposition still exact', () => {
  // Wheatstone bridge fed through R0, so the dead network is not series-parallel
  const p = net([['V1', 'V', 1, 0, 10], ['R0', 'R', 1, 5, 1], ['R1', 'R', 5, 2, 1], ['R2', 'R', 5, 3, 2], ['R3', 'R', 2, 0, 3], ['R4', 'R', 3, 0, 4], ['R5', 'R', 2, 3, 5], ['RL', 'R', 5, 0, 7]]);
  for (const th of ['thevenin', 'norton', 'superposition']) {
    const r = runTheorem(p, th, src(p, 'RL'));
    assert.ok(r.ok, r.error);
    close(r.answer.I, r.full.I, th);
  }
});

test('source transformation that cannot finish says so and still answers', () => {
  const p = net([['V1', 'V', 1, 0, 10], ['R1', 'R', 1, 2, 1], ['R2', 'R', 1, 3, 2], ['R3', 'R', 2, 0, 3], ['R4', 'R', 3, 0, 4], ['RL', 'R', 2, 3, 5]]);
  const r = runTheorem(p, 'source', src(p, 'RL'));
  assert.ok(r.ok);
  close(r.answer.I, r.full.I, 'IL');
});

test('Thevenin without a resistive path points to Norton, and the reverse', () => {
  const onlyI = net([['I1', 'I', 0, 1, 0.01], ['RL', 'R', 1, 0, 100]]);
  let r = runTheorem(onlyI, 'thevenin', src(onlyI, 'RL'));
  assert.ok(r.ok);
  assert.match(r.steps.at(-1).title, /No Thevenin/);
  r = runTheorem(onlyI, 'norton', src(onlyI, 'RL'));
  close(r.answer.I, 0.01, 'all of IN in RL');
  const onlyV = net([['V1', 'V', 1, 0, 5], ['RL', 'R', 1, 0, 100]]);
  r = runTheorem(onlyV, 'norton', src(onlyV, 'RL'));
  assert.match(r.steps.at(-1).title, /No Norton/);
  r = runTheorem(onlyV, 'thevenin', src(onlyV, 'RL'));
  close(r.answer.I, 0.05, 'IL');
});

test('series-parallel decomposition keeps the order from s to t', () => {
  const e = (name, a, b) => ({ name, kind: 'R', n: [a, b], val: 1 });
  const { tree } = spTree([e('A', 1, 2), e('B', 2, 3), e('C', 3, 2)], 1, 3);
  assert.equal(tree.k, 'S');
  assert.equal(tree.kids[0].e.name, 'A');
  assert.equal(tree.kids[1].k, 'P');
  assert.equal(spTree([e('A', 1, 2)], 1, 3).open, true);
});

test('a drawn circuit becomes the right network', () => {
  const doc = new CircuitDoc();
  const G = 20;
  const add = (type, x, y, rot, p = {}) => { const el = new (getType(type))(x, y); el.rot = rot; Object.assign(el.p, p); doc.add(el); return el; };
  // battery standing up on the left (+ on top), R1 along the top, R2 down on the right, ground under
  add('dcv', 0, 0, 1, { amp: 9 });
  add('resistor', 4 * G, -4 * G, 0, { r: 1000 });
  add('resistor', 8 * G, 0, 1, { r: 2000 });
  add('ground', 0, 4 * G, 0);
  add('switch', 4 * G, 4 * G, 0, { closed: true });
  doc.assignNames();
  const w = (...pts) => doc.addWire(pts);
  w([0, -2 * G], [0, -4 * G], [2 * G, -4 * G]);
  w([6 * G, -4 * G], [8 * G, -4 * G], [8 * G, -2 * G]);
  w([0, 2 * G], [0, 4 * G], [2 * G, 4 * G]);
  w([6 * G, 4 * G], [8 * G, 4 * G], [8 * G, 2 * G]);
  const n = extractNetwork(doc);
  assert.deepEqual(n.bad, []);
  assert.equal(n.elems.length, 3, 'the closed switch is a plain wire');
  const prep = prepareTheorem(doc);
  const r = runTheorem(prep, 'thevenin', doc.elements.findIndex((e) => e.name === 'R2'));
  assert.ok(r.ok, r.error);
  close(r.answer.V, 6, 'divider: 9 V × 2k / 3k');
});
